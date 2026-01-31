import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { formatPhoneNumber } from "@/lib/utils";

export type Message = Database["public"]["Tables"]["messages"]["Row"] & {
  is_acknowledged?: boolean;
};

export type MessageThread = Database["public"]["Tables"]["message_threads"]["Row"];

// Simplified type to avoid deep type instantiation issues
export type ExtendedMessageThread = {
  id: string;
  tenant_id: string;
  gateway_id: string | null;
  contact_phone: string;
  resolved_group_id: string | null;
  is_resolved: boolean;
  resolved_at: string | null;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
  group_name?: string;
  unread_count?: number;
  last_message_content?: string;
  is_fallback?: boolean;
};

export const messageService = {
  /**
   * Find or create a message thread for a contact
   */
  async findOrCreateThread(
    contactPhone: string,
    targetGroupId?: string
  ): Promise<MessageThread> {
    const formattedPhone = formatPhoneNumber(contactPhone);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    // 1. Get current user's tenant (Moved up)
    const { data: userData } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("auth_user_id", user.id)
      .single();

    if (!userData) throw new Error("User not found");
    const tenantId = userData.tenant_id;

    // 3. Check if thread already exists
    const { data: existingThread } = await supabase
      .from("message_threads")
      .select()
      .eq("contact_phone", formattedPhone) // Use formatted phone
      .eq("tenant_id", tenantId)
      .eq("is_resolved", false)
      .maybeSingle();

    if (existingThread) {
      return existingThread as MessageThread;
    }
    
    // 4. Get default gateway
    // If no specific gateway logic, get the first active one or default
    const { data: gateway } = await supabase
      .from("gateways")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .limit(1)
      .single();

    // Create new thread
    const { data: newThread, error } = await supabase
      .from("message_threads")
      .insert({
        contact_phone: formattedPhone, // Use formatted phone
        tenant_id: tenantId,
        gateway_id: gateway?.id, // Fallback to null if no gateway found
        resolved_group_id: targetGroupId
      })
      .select()
      .single();

    if (error) throw error;
    return newThread as MessageThread;
  },

  /**
   * Get all message threads for a specific group
   */
  async getThreadsByGroup(groupId: string): Promise<ExtendedMessageThread[]> {
    const { data, error } = await supabase
      .from("message_threads")
      .select(`
        *,
        groups (
          name
        ),
        messages (
          id,
          content,
          created_at,
          acknowledged_at,
          is_fallback
        )
      `)
      .eq("resolved_group_id", groupId)
      .eq("is_resolved", false)
      .order("last_message_at", { ascending: false });

    if (error) {
      console.error("Error fetching threads by group:", error);
      throw error;
    }

    // Cast data to any to avoid deep type instantiation issues with complex joins
    return this._mapThreadsResponse(data as any);
  },

  /**
   * Get all threads across all groups for current user
   */
  async getAllThreads(): Promise<ExtendedMessageThread[]> {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error("Not authenticated");

    // Get user's tenant_id
    const { data: profile } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("auth_user_id", user.user.id)
      .single();

    if (!profile) throw new Error("Profile not found");

    const { data, error } = await supabase
      .from("message_threads")
      .select(`
        *,
        groups (
          id,
          name
        ),
        messages (
          id,
          content,
          created_at,
          acknowledged_at,
          is_fallback
        )
      `)
      .eq("tenant_id", profile.tenant_id)
      .eq("is_resolved", false)
      .order("last_message_at", { ascending: false });

    if (error) {
      console.error("Error fetching all threads:", error);
      throw error;
    }

    // Cast data to any to avoid deep type instantiation issues
    return this._mapThreadsResponse(data as any);
  },

  /**
   * Get fallback threads (threads with fallback messages)
   */
  async getFallbackThreads(): Promise<ExtendedMessageThread[]> {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error("Not authenticated");

    const { data: profile } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("auth_user_id", user.user.id)
      .single();

    if (!profile) throw new Error("Profile not found");

    // We look for threads where the resolved_group is the fallback group OR messages are flagged as fallback
    // Simplest approach: check threads with messages that have is_fallback=true
    
    // First, let's find threads that contain fallback messages
    const { data, error } = await supabase
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

    // Use our mapper, but we know these are fallback threads
    return this._mapThreadsResponse(data as any).map(t => ({ ...t, is_fallback: true }));
  },

  /**
   * Get escalated threads (unacknowledged messages past threshold)
   */
  async getEscalatedThreads(thresholdMinutes: number = 30): Promise<ExtendedMessageThread[]> {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error("Not authenticated");

    const { data: profile } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("auth_user_id", user.user.id)
      .single();

    if (!profile) throw new Error("Profile not found");

    const thresholdTime = new Date();
    thresholdTime.setMinutes(thresholdTime.getMinutes() - thresholdMinutes);

    // Find messages that are unacknowledged and older than threshold
    const { data, error } = await supabase
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

    // Map these messages to a unique list of threads
    const threadMap = new Map<string, ExtendedMessageThread>();
    
    (data || []).forEach((msg: any) => {
      const thread = msg.message_threads;
      if (!threadMap.has(thread.id)) {
        threadMap.set(thread.id, {
          ...thread, // Spread original thread properties
          group_name: thread.groups?.name || "Unknown",
          unread_count: 1, // At least this message
          last_message_content: msg.content,
          is_fallback: false, // Default for escalation view
        });
      }
    });

    return Array.from(threadMap.values());
  },

  /**
   * Get all messages for a specific thread
   */
  async getMessagesByThread(threadId: string): Promise<Message[]> {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    return (data || []).map((msg) => ({
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

    // If no threadId provided OR if threadId is not a valid UUID (e.g. phone number), find or create one
    // Also protect against threadId being passed as an object/invalid string
    const isValidUUID = (id: string | undefined) => 
      id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    if (!finalThreadId || !isValidUUID(finalThreadId)) {
       // We need to find the correct tenant and group context
       const { data: userData } = await supabase.auth.getUser();
       if (!userData.user) throw new Error("User not authenticated");
       
       const { data: userProfile } = await supabase
        .from("users")
        .select("tenant_id")
        .eq("id", userData.user.id)
        .single();
        
       if (!userProfile) throw new Error("User profile not found");
       
       // Default logic: Find a group for this message
       // Try fallback group first
       let targetGroupId: string | undefined;
       
       const { data: fallbackGroup } = await supabase
         .from("groups")
         .select("id")
         .eq("tenant_id", userProfile.tenant_id)
         .eq("kind", "fallback")
         .maybeSingle();
         
       if (fallbackGroup) {
         targetGroupId = fallbackGroup.id;
       } else {
         // Try finding any group
         const { data: anyGroup } = await supabase
            .from("groups")
            .select("id")
            .eq("tenant_id", userProfile.tenant_id)
            .limit(1)
            .maybeSingle();
            
         if (anyGroup) {
            targetGroupId = anyGroup.id;
         } else {
            // Create a default group if absolutely none exist
             const { data: newGroup, error: createError } = await supabase
              .from("groups")
              .insert({
                name: "Generell Innboks",
                kind: "fallback",
                tenant_id: userProfile.tenant_id,
                description: "Automatisk opprettet innboks"
              })
              .select()
              .single();
              
             if (!createError && newGroup) {
                targetGroupId = newGroup.id;
             }
         }
       }

       const thread = await this.findOrCreateThread(formattedToNumber, targetGroupId);
       finalThreadId = thread.id;
    }
    
    // Ensure we have the thread details (specifically tenant_id and contact_phone for thread_key)
    // If we reused an existing threadId passed in, we might need to fetch it to be sure
    let currentThread: MessageThread | null = null;
    
    if (finalThreadId) {
        const { data } = await supabase
            .from("message_threads")
            .select("*")
            .eq("id", finalThreadId)
            .single();
        currentThread = data;
    }
    
    if (!currentThread) throw new Error("Could not find thread context");

    // MOCK SENDING to external API (simulated)
    console.log("🚀 MOCK API SENDING:", {
      to: formattedToNumber,
      from: fromNumber,
      content,
      threadId: finalThreadId
    });

    // Store in database
    const { data: messageData, error: insertError } = await supabase
      .from("messages")
      .insert({
        thread_id: finalThreadId,
        tenant_id: currentThread.tenant_id,     // Explicitly set tenant_id
        thread_key: currentThread.contact_phone, // Use contact phone as thread key
        direction: "outbound",
        content,
        from_number: fromNumber,
        to_number: formattedToNumber,
        status: "sent" // Mock successful send
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Update thread timestamp
    if (finalThreadId) {
      await supabase
        .from("message_threads")
        .update({ 
          last_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq("id", finalThreadId);
    }

    return messageData;
  },

  /**
   * Acknowledge a single message
   */
  async acknowledgeMessage(messageId: string) {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error("Not authenticated");

    const { data: profile } = await supabase
      .from("users")
      .select("id")
      .eq("auth_user_id", user.user.id)
      .single();

    if (!profile) throw new Error("User profile not found");

    const { error } = await supabase
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

    const { data: profile } = await supabase
      .from("users")
      .select("id")
      .eq("auth_user_id", user.user.id)
      .single();

    if (!profile) throw new Error("User profile not found");

    const { error } = await supabase
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
    // 1. Update the thread's resolved group
    const { error } = await supabase
      .from("message_threads")
      .update({
        resolved_group_id: newGroupId,
      })
      .eq("id", threadId);

    if (error) throw error;

    // 2. Mark all messages in this thread as NOT fallback anymore
    // Since they are now assigned to a specific group
    const { error: msgError } = await supabase
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

    const { data: profile } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("auth_user_id", user.user.id)
      .single();

    if (!profile) throw new Error("Profile not found");

    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("tenant_id", profile.tenant_id)
      .eq("direction", "inbound")
      .is("acknowledged_at", null)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return (data || []).map((msg) => ({
      ...msg,
      is_acknowledged: false,
    }));
  },

  /**
   * Resolve a thread (mark as completed/closed)
   */
  async resolveThread(threadId: string) {
    const { error } = await supabase
      .from("message_threads")
      .update({
        is_resolved: true,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", threadId);

    if (error) throw error;
  },

  // Helper to map Supabase response to MessageThread type
  _mapThreadsResponse(data: any[] | null): ExtendedMessageThread[] {
    return (data || []).map((thread: any) => {
      const messages = Array.isArray(thread.messages) ? thread.messages : [];
      const unreadCount = messages.filter((m: any) => !m.acknowledged_at).length;
      
      // Sort messages to find latest
      const sortedMessages = messages.sort((a: any, b: any) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      const lastMessage = sortedMessages[0] || { content: "", is_fallback: false };

      return {
        ...thread, // Spread all properties from the DB row (id, tenant_id, gateway_id, etc.)
        group_name: thread.groups?.name || "Unknown",
        unread_count: unreadCount,
        last_message_content: lastMessage.content,
        is_fallback: lastMessage.is_fallback || false,
      };
    });
  }
};