import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { formatPhoneNumber } from "@/lib/utils";

// Define simpler types to avoid TS deep instantiation errors with complex Supabase types
export type Message = {
  id: string;
  created_at: string;
  updated_at: string;
  tenant_id: string;
  thread_id: string | null;
  thread_key: string | null;
  direction: "inbound" | "outbound";
  content: string;
  from_number: string;
  to_number: string;
  status: string;
  provider_message_id: string | null;
  error_message: string | null;
  acknowledged_at: string | null;
  acknowledged_by_user_id: string | null;
  is_fallback?: boolean;
  is_acknowledged?: boolean;
};

export type MessageThread = {
  id: string;
  created_at: string;
  updated_at: string;
  tenant_id: string;
  gateway_id: string | null;
  contact_phone: string;
  resolved_group_id: string | null;
  is_resolved: boolean;
  resolved_at: string | null;
  last_message_at: string | null;
};

export type ExtendedMessageThread = MessageThread & {
  group_name?: string;
  unread_count?: number;
  last_message_content?: string;
  is_fallback?: boolean;
};

// CRITICAL FIX: Cast supabase to any to completely bypass "Type instantiation is excessively deep" errors
// This disconnects the complex type inference chain while preserving runtime behavior
const db = supabase as any;

export const messageService = {
  /**
   * Find or create a message thread for a contact
   */
  async findOrCreateThread(
    contactPhone: string,
    targetGroupId?: string
  ): Promise<MessageThread> {
    const formattedPhone = formatPhoneNumber(contactPhone);

    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) throw new Error("User not authenticated");

    // 1. Get current user's tenant
    const { data: userData } = await db
      .from("users")
      .select("tenant_id")
      .eq("auth_user_id", authData.user.id)
      .single();

    if (!userData) throw new Error("User not found");
    const tenantId = userData.tenant_id;

    // 3. Check if thread already exists
    const { data: existingThread } = await db
      .from("message_threads")
      .select("*")
      .eq("contact_phone", formattedPhone)
      .eq("tenant_id", tenantId)
      .eq("is_resolved", false)
      .maybeSingle();

    if (existingThread) {
      return existingThread as MessageThread;
    }
    
    // 4. Get default gateway
    const { data: gateway } = await db
      .from("gateways")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    // Create new thread
    const { data: newThread, error } = await db
      .from("message_threads")
      .insert({
        contact_phone: formattedPhone,
        tenant_id: tenantId,
        gateway_id: gateway?.id,
        resolved_group_id: targetGroupId
      })
      .select("*")
      .single();

    if (error) throw error;
    return newThread as MessageThread;
  },

  /**
   * Get all message threads for a specific group
   */
  async getThreadsByGroup(groupId: string): Promise<ExtendedMessageThread[]> {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) throw new Error("Not authenticated");

    // First, get all threads for the group
    const { data: threads, error: threadsError } = await db
      .from("message_threads")
      .select("*, groups(name)")
      .eq("resolved_group_id", groupId)
      .eq("is_resolved", false)
      .order("last_message_at", { ascending: false });

    if (threadsError) {
      console.error("Error fetching threads by group:", threadsError);
      throw threadsError;
    }

    if (!threads || threads.length === 0) return [];

    // Then, get all messages for these threads
    const threadIds = threads.map((t: any) => t.id);
    
    const { data: messages, error: messagesError } = await db
      .from("messages")
      .select("*")
      .in("thread_id", threadIds)
      .order("created_at", { ascending: true });

    if (messagesError) {
      console.error("Error fetching messages for threads:", messagesError);
      throw messagesError;
    }

    return this._mapThreadsResponse(threads, messages);
  },

  /**
   * Get all threads across all groups for current user
   */
  async getAllThreads(): Promise<ExtendedMessageThread[]> {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error("Not authenticated");

    const { data: profile } = await db
      .from("users")
      .select("tenant_id")
      .eq("auth_user_id", user.user.id)
      .single();

    if (!profile) throw new Error("Profile not found");

    // RLS policies automatically filter threads to only those in groups the user is a member of
    // No need for manual filtering - RLS handles it!
    const { data: threads, error } = await db
      .from("message_threads")
      .select("*")
      .eq("tenant_id", profile.tenant_id)
      .order("last_message_at", { ascending: false });

    if (error) {
      console.error("Error fetching all threads:", error);
      throw error;
    }

    return this._mapThreadsResponse(threads);
  },

  /**
   * Get fallback threads (threads with fallback messages)
   */
  async getFallbackThreads(): Promise<ExtendedMessageThread[]> {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error("Not authenticated");

    const { data: profile } = await db
      .from("users")
      .select("tenant_id")
      .eq("auth_user_id", user.user.id)
      .single();

    if (!profile) throw new Error("Profile not found");

    const { data, error } = await db
      .from("message_threads")
      .select(`
        *,
        groups (
          id,
          name
        ),
        messages!inner (
          id,
          content,
          created_at,
          acknowledged_at,
          is_fallback
        )
      `)
      .eq("tenant_id", profile.tenant_id)
      .eq("is_resolved", false)
      .eq("messages.is_fallback", true)
      .order("last_message_at", { ascending: false });

    if (error) throw error;

    return this._mapThreadsResponse(data).map((t: any) => ({ ...t, is_fallback: true }));
  },

  /**
   * Get escalated threads (unacknowledged messages past threshold)
   */
  async getEscalatedThreads(thresholdMinutes: number = 30): Promise<ExtendedMessageThread[]> {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error("Not authenticated");

    const { data: profile } = await db
      .from("users")
      .select("tenant_id")
      .eq("auth_user_id", user.user.id)
      .single();

    if (!profile) throw new Error("Profile not found");

    const thresholdTime = new Date();
    thresholdTime.setMinutes(thresholdTime.getMinutes() - thresholdMinutes);

    const { data, error } = await db
      .from("messages")
      .select(`
        id,
        content,
        created_at,
        from_number,
        thread_id,
        acknowledged_at,
        message_threads!inner (
          id,
          contact_phone,
          resolved_group_id,
          created_at,
          last_message_at,
          is_resolved,
          tenant_id,
          gateway_id,
          updated_at,
          resolved_at,
          groups (
            name
          )
        )
      `)
      .eq("tenant_id", profile.tenant_id)
      .eq("direction", "inbound")
      .is("acknowledged_at", null)
      .lt("created_at", thresholdTime.toISOString())
      .order("created_at", { ascending: true });

    if (error) throw error;

    const threadMap = new Map<string, ExtendedMessageThread>();
    
    (data || []).forEach((msg: any) => {
      const thread = msg.message_threads;
      if (!threadMap.has(thread.id)) {
        threadMap.set(thread.id, {
          id: thread.id,
          contact_phone: thread.contact_phone,
          resolved_group_id: thread.resolved_group_id,
          created_at: thread.created_at,
          last_message_at: thread.last_message_at,
          is_resolved: thread.is_resolved,
          tenant_id: thread.tenant_id,
          gateway_id: thread.gateway_id,
          updated_at: thread.updated_at,
          resolved_at: thread.resolved_at,
          group_name: thread.groups?.name || "Unknown",
          unread_count: 1,
          last_message_content: msg.content,
          is_fallback: false,
        });
      }
    });

    return Array.from(threadMap.values());
  },

  /**
   * Get all messages for a specific thread
   */
  async getMessagesByThread(threadId: string): Promise<Message[]> {
    const { data, error } = await db
      .from("messages")
      .select("*")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    return (data || []).map((msg: any) => ({
      ...msg,
      is_acknowledged: !!msg.acknowledged_at,
    }));
  },

  /**
   * Send a message (finds or creates thread automatically if threadId not provided)
   */
  async sendMessage(
    content: string,
    toNumber: string,
    fromNumber: string,
    threadId?: string
  ): Promise<Message> {
    const formattedToNumber = formatPhoneNumber(toNumber);
    let finalThreadId = threadId;

    // Get User Context regardless
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error("User not authenticated");
    
    const { data: userProfile } = await db
     .from("users")
     .select("id, tenant_id")
     .eq("auth_user_id", userData.user.id)
     .single();
     
    if (!userProfile) throw new Error("User profile not found");

    // Logic to determine Target Group ID if creating/updating thread
    let targetGroupId: string | undefined;

    // Try to find the group the CURRENT USER belongs to
    const { data: userGroups } = await db
      .from("group_memberships")
      .select("group_id, groups(id, kind)")
      .eq("user_id", userProfile.id);

    if (userGroups && userGroups.length > 0) {
       // Prefer operational groups if available, otherwise just take the first one
       const operationalGroup = userGroups.find((g: any) => g.groups?.kind === 'operational');
       targetGroupId = operationalGroup ? operationalGroup.group_id : userGroups[0].group_id;
    } else {
       // Fallback logic
       const { data: fallbackGroup } = await db
         .from("groups")
         .select("id")
         .eq("tenant_id", userProfile.tenant_id)
         .eq("kind", "fallback")
         .maybeSingle();
       
       targetGroupId = fallbackGroup?.id;
    }
    
    // CRITICAL: If still no group found, get ANY operational group from tenant
    if (!targetGroupId) {
       const { data: anyGroup } = await db
         .from("groups")
         .select("id")
         .eq("tenant_id", userProfile.tenant_id)
         .eq("kind", "operational")
         .limit(1)
         .maybeSingle();
       
       if (!anyGroup) {
         throw new Error("No operational groups found in tenant. Please create a group first.");
       }
       
       targetGroupId = anyGroup.id;
    }

    const isValidUUID = (id: string | undefined) => 
      id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    if (!finalThreadId || !isValidUUID(finalThreadId)) {
       const thread = await this.findOrCreateThread(formattedToNumber, targetGroupId);
       finalThreadId = thread.id;
    }
    
    // Ensure we have the thread details
    let currentThread: MessageThread | null = null;
    if (finalThreadId) {
        const { data } = await db
            .from("message_threads")
            .select("*")
            .eq("id", finalThreadId)
            .single();
        currentThread = data as MessageThread;
    }
    
    if (!currentThread) throw new Error("Could not find thread context");

    // CRITICAL: Update resolved_group_id if the sender is in a specific group
    // This ensures replies come back to this group
    if (targetGroupId && currentThread.resolved_group_id !== targetGroupId) {
       await db
         .from("message_threads")
         .update({ resolved_group_id: targetGroupId })
         .eq("id", finalThreadId);
       
       currentThread.resolved_group_id = targetGroupId;
    }

    // MOCK SENDING to external API (simulated)
    console.log("🚀 MOCK API SENDING:", {
      to: formattedToNumber,
      from: fromNumber,
      content,
      threadId: finalThreadId,
      threadContactPhone: currentThread.contact_phone,
      routedToGroup: targetGroupId
    });

    // Store in database
    const { data: messageData, error: insertError } = await db
      .from("messages")
      .insert({
        thread_id: finalThreadId,
        tenant_id: currentThread.tenant_id,
        thread_key: currentThread.contact_phone,
        direction: "outbound",
        content,
        from_number: fromNumber,
        to_number: formattedToNumber,
        status: "sent"
      })
      .select("*")
      .single();

    if (insertError) throw insertError;

    // Update thread timestamp
    if (finalThreadId) {
      await db
        .from("message_threads")
        .update({ 
          last_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq("id", finalThreadId);
    }

    return messageData as Message;
  },

  /**
   * Acknowledge a single message
   */
  async acknowledgeMessage(messageId: string) {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error("Not authenticated");

    const { data: profile } = await db
      .from("users")
      .select("id")
      .eq("auth_user_id", user.user.id)
      .single();

    if (!profile) throw new Error("User profile not found");

    const { error } = await db
      .from("messages")
      .update({
        acknowledged_at: new Date().toISOString(),
        acknowledged_by_user_id: profile.id,
      })
      .eq("id", messageId);

    if (error) throw error;
  },

  /**
   * Acknowledge all messages in a thread
   */
  async acknowledgeThread(threadId: string) {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error("Not authenticated");

    const { data: profile } = await db
      .from("users")
      .select("id")
      .eq("auth_user_id", user.user.id)
      .single();

    if (!profile) throw new Error("User profile not found");

    const { error } = await db
      .from("messages")
      .update({
        acknowledged_at: new Date().toISOString(),
        acknowledged_by_user_id: profile.id,
      })
      .eq("thread_id", threadId)
      .is("acknowledged_at", null)
      .eq("direction", "inbound");

    if (error) throw error;
  },

  /**
   * Reclassify a thread to a different group
   */
  async reclassifyThread(threadId: string, newGroupId: string) {
    const { error } = await db
      .from("message_threads")
      .update({
        resolved_group_id: newGroupId,
      })
      .eq("id", threadId);

    if (error) throw error;

    const { error: msgError } = await db
      .from("messages")
      .update({
        is_fallback: false
      })
      .eq("thread_id", threadId)
      .eq("is_fallback", true);

    if (msgError) throw msgError;
  },

  /**
   * Get unacknowledged messages count and details
   */
  async getUnacknowledgedMessages(): Promise<Message[]> {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error("Not authenticated");

    const { data: profile } = await db
      .from("users")
      .select("tenant_id")
      .eq("auth_user_id", user.user.id)
      .single();

    if (!profile) throw new Error("Profile not found");

    const { data, error } = await db
      .from("messages")
      .select("*")
      .eq("tenant_id", profile.tenant_id)
      .eq("direction", "inbound")
      .is("acknowledged_at", null)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return (data || []).map((msg: any) => ({
      ...msg,
      is_acknowledged: false,
    }));
  },

  /**
   * Resolve a thread (mark as completed/closed)
   */
  async resolveThread(threadId: string) {
    const { error } = await db
      .from("message_threads")
      .update({
        is_resolved: true,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", threadId);

    if (error) throw error;
  },

  // Helper to map Supabase response to MessageThread type
  _mapThreadsResponse(threads: any[] | null, messages: any[] | null = null): ExtendedMessageThread[] {
    const threadMap = new Map<string, ExtendedMessageThread>();
    
    (threads || []).forEach((t: any) => {
      threadMap.set(t.id, {
        id: t.id,
        tenant_id: t.tenant_id,
        gateway_id: t.gateway_id,
        contact_phone: t.contact_phone,
        resolved_group_id: t.resolved_group_id,
        is_resolved: t.is_resolved,
        resolved_at: t.resolved_at,
        last_message_at: t.last_message_at,
        created_at: t.created_at,
        updated_at: t.updated_at,
        group_name: t.groups?.name || "Unknown",
        unread_count: 0,
        last_message_content: "",
        is_fallback: false,
      });
    });

    // If messages are provided separately (getThreadsByGroup), use them
    if (messages) {
      messages.forEach((m: any) => {
        const thread = threadMap.get(m.thread_id);
        if (thread) {
           if (!m.acknowledged_at && m.direction === 'inbound') {
            thread.unread_count = (thread.unread_count || 0) + 1;
          }
          if (!thread.last_message_content || new Date(m.created_at) > new Date(thread.last_message_at || 0)) {
            thread.last_message_content = m.content;
            thread.is_fallback = m.is_fallback || false;
          }
        }
      });
    } else {
      // If messages are nested (getAllThreads), use them
      (threads || []).forEach((t: any) => {
        const thread = threadMap.get(t.id);
        if (thread && Array.isArray(t.messages)) {
          const threadMessages = t.messages;
          thread.unread_count = threadMessages.filter((m: any) => !m.acknowledged_at && m.direction === 'inbound').length;
          
          const sortedMessages = threadMessages.sort((a: any, b: any) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
          const lastMessage = sortedMessages[0];
          if (lastMessage) {
            thread.last_message_content = lastMessage.content;
            thread.is_fallback = lastMessage.is_fallback || false;
          }
        }
      });
    }

    return Array.from(threadMap.values());
  }
};