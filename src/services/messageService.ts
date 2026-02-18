import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { formatPhoneNumber } from "@/lib/utils";

// Define simpler types to avoid TS deep instantiation errors with complex Supabase types
export type MessageFilter = "all" | "unread" | "resolved";

export type Message = {
  id: string;
  created_at: string;
  updated_at: string;
  tenant_id: string;
  thread_id: string | null;
  campaign_id?: string | null; // Added campaign_id
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
  group_id?: string;
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
  // Bulk specific fields
  is_bulk?: boolean;
  subject_line?: string;
  bulk_code?: string;
  recipient_stats?: {
    total: number;
    responded: number;
    pending: number;
  };
};

// CRITICAL FIX: Cast supabase to any to completely bypass "Type instantiation is excessively deep" errors
// This disconnects the complex type inference chain while preserving runtime behavior
const db = supabase as any;

export const messageService = {
  /**
   * Find or create a message thread for a contact
   * NEW LOGIC: One thread per phone number, dynamically update resolved_group_id
   * Gateway is determined by the group sending the message, not at thread creation
   */
  async findOrCreateThread(
    contactPhone: string,
    targetGroupId?: string,
    gatewayId?: string
  ): Promise<MessageThread> {
    const formattedPhone = formatPhoneNumber(contactPhone);

    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) throw new Error("User not authenticated");

    // 1. Get current user's tenant
    const { data: userData } = await db
      .from("user_profiles")
      .select("tenant_id")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (!userData) throw new Error("User not found");
    const tenantId = userData.tenant_id;

    // 2. Check if thread already exists (ONE thread per phone number)
    const { data: existingThread } = await db
      .from("message_threads")
      .select("*")
      .eq("contact_phone", formattedPhone)
      .eq("tenant_id", tenantId)
      .eq("is_resolved", false)
      .maybeSingle();

    if (existingThread) {
      // Thread exists - update resolved_group_id and gateway_id if provided
      const updates: any = { updated_at: new Date().toISOString() };
      
      if (targetGroupId && existingThread.resolved_group_id !== targetGroupId) {
        updates.resolved_group_id = targetGroupId;
      }
      
      if (gatewayId && existingThread.gateway_id !== gatewayId) {
        updates.gateway_id = gatewayId;
      }
      
      if (Object.keys(updates).length > 1) { // More than just updated_at
        const { data: updatedThread } = await db
          .from("message_threads")
          .update(updates)
          .eq("id", existingThread.id)
          .select("*")
          .maybeSingle();
        
        return updatedThread as MessageThread;
      }
      
      return existingThread as MessageThread;
    }
    
    // 3. Gateway is required for new threads
    if (!gatewayId) {
      throw new Error("Gateway ID is required to create a new message thread. Please ensure the group has a gateway configured.");
    }

    // 4. Create new thread (one per phone number)
    const { data: newThread, error } = await db
      .from("message_threads")
      .insert({
        contact_phone: formattedPhone,
        tenant_id: tenantId,
        gateway_id: gatewayId,
        resolved_group_id: targetGroupId || null
      })
      .select("*")
      .maybeSingle();

    if (error) throw error;
    if (!newThread) throw new Error("Failed to create thread");
    return newThread as MessageThread;
  },

  /**
   * Get all message threads for a specific group
   */
  async getThreadsByGroup(groupId: string): Promise<ExtendedMessageThread[]> {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) throw new Error("Not authenticated");

    const { data: profile } = await db
      .from("user_profiles")
      .select("tenant_id")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (!profile) {
      console.warn("getThreadsByGroup: Profile not found, returning empty array");
      return [];
    }

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
   * Get all threads including Bulk Campaigns merged into the list
   * This replaces getAllThreads for the Inbox view
   */
  async getInboxThreads(): Promise<ExtendedMessageThread[]> {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error("Not authenticated");

    const { data: profile } = await db
      .from("user_profiles")
      .select("tenant_id")
      .eq("id", user.user.id)
      .maybeSingle();

    if (!profile) {
      console.warn("getInboxThreads: Profile not found, returning empty array");
      return [];
    }

    // 1. Fetch standard threads
    const { data: threads, error: threadsError } = await db
      .from("message_threads")
      .select("*, groups(name)")
      .eq("tenant_id", profile.tenant_id)
      .eq("is_resolved", false)
      .order("last_message_at", { ascending: false });

    if (threadsError) throw threadsError;

    // 2. Fetch active Bulk Campaigns
    const { data: campaigns, error: campaignsError } = await db
      .from("bulk_campaigns")
      .select(`
        *,
        groups:source_group_id(name),
        bulk_recipients(count)
      `)
      .eq("tenant_id", profile.tenant_id)
      .neq("status", "archived")
      .order("created_at", { ascending: false });

    if (campaignsError) throw campaignsError;

    // 3. For each campaign, get actual inbound response count
    const campaignIds = (campaigns || []).map((c: any) => c.id);
    const { data: allCampaignMessages } = campaignIds.length > 0
      ? await db
          .from("messages")
          .select("campaign_id, direction")
          .in("campaign_id", campaignIds)
      : { data: [] };

    // Count inbound messages per campaign
    const responseCounts = new Map<string, number>();
    (allCampaignMessages || []).forEach((msg: any) => {
      if (msg.direction === "inbound") {
        responseCounts.set(msg.campaign_id, (responseCounts.get(msg.campaign_id) || 0) + 1);
      }
    });

    // 4. Map threads
    const threadIds = (threads || []).map((t: any) => t.id);
    const { data: threadMessages } = await db
      .from("messages")
      .select("*")
      .in("thread_id", threadIds)
      .order("created_at", { ascending: true });

    const mappedThreads = this._mapThreadsResponse(threads, threadMessages);

    // 5. Map campaigns to thread structure
    const mappedCampaigns: ExtendedMessageThread[] = (campaigns || []).map((c: any) => {
      const totalRecipients = c.bulk_recipients?.[0]?.count || 0;
      const responseCount = responseCounts.get(c.id) || 0;

      return {
        id: c.id,
        is_bulk: true,
        subject_line: c.subject_line,
        bulk_code: c.bulk_code,
        tenant_id: c.tenant_id,
        created_at: c.created_at,
        updated_at: c.created_at,
        contact_phone: c.name,
        last_message_at: c.created_at,
        last_message_content: c.message_template,
        group_name: c.groups?.name || "Ukjent gruppe",
        resolved_group_id: c.source_group_id,
        is_resolved: c.status === 'completed',
        resolved_at: null,
        gateway_id: null,
        unread_count: 0,
        recipient_stats: {
          total: totalRecipients,
          responded: responseCount,
          pending: totalRecipients - responseCount
        }
      };
    });

    // 6. Merge and sort
    const combined = [...mappedThreads, ...mappedCampaigns];
    combined.sort((a, b) => 
      new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime()
    );

    return combined;
  },

  /**
   * Get all threads across all groups for current user
   */
  async getAllThreads(): Promise<ExtendedMessageThread[]> {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error("Not authenticated");

    const { data: profile } = await db
      .from("user_profiles")
      .select("tenant_id")
      .eq("id", user.user.id)
      .maybeSingle();

    if (!profile) {
      console.warn("getAllThreads: Profile not found, returning empty array");
      return [];
    }

    const { data: threads, error } = await db
      .from("message_threads")
      .select("*, groups(name)")
      .eq("tenant_id", profile.tenant_id)
      .eq("is_resolved", false)
      .order("last_message_at", { ascending: false });

    if (error) {
      console.error("Error fetching all threads:", error);
      throw error;
    }

    if (!threads || threads.length === 0) return [];

    const threadIds = threads.map((t: any) => t.id);
    
    const { data: messages } = await db
      .from("messages")
      .select("*")
      .in("thread_id", threadIds)
      .order("created_at", { ascending: true });

    return this._mapThreadsResponse(threads, messages);
  },

  /**
   * Get fallback threads (threads with fallback messages)
   */
  async getFallbackThreads(): Promise<ExtendedMessageThread[]> {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error("Not authenticated");

    const { data: profile } = await db
      .from("user_profiles")
      .select("tenant_id")
      .eq("id", user.user.id)
      .maybeSingle();

    if (!profile) {
      console.warn("getFallbackThreads: Profile not found, returning empty array");
      return [];
    }

    const { data, error } = await db
      .from("message_threads")
      .select(`
        *,
        groups (
          id,
          name
        )
      `)
      .eq("tenant_id", profile.tenant_id)
      .eq("is_resolved", false)
      .order("last_message_at", { ascending: false });

    if (error) throw error;

    if (!data || data.length === 0) return [];

    const threadIds = data.map((t: any) => t.id);
    
    const { data: messages } = await db
      .from("messages")
      .select("*")
      .in("thread_id", threadIds)
      .eq("is_fallback", true)
      .order("created_at", { ascending: true });

    const threadsWithFallback = data.filter((t: any) => 
      messages?.some((m: any) => m.thread_id === t.id)
    );

    return this._mapThreadsResponse(threadsWithFallback, messages).map((t: any) => ({ 
      ...t, 
      is_fallback: true 
    }));
  },

  /**
   * Get escalated threads (unacknowledged messages past threshold)
   */
  async getEscalatedThreads(thresholdMinutes: number = 30): Promise<ExtendedMessageThread[]> {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error("Not authenticated");

    const { data: profile } = await db
      .from("user_profiles")
      .select("tenant_id")
      .eq("id", user.user.id)
      .maybeSingle();

    if (!profile) {
      console.warn("getEscalatedThreads: Profile not found, returning empty array");
      return [];
    }

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
   * Send a message with smart thread management
   * NEW LOGIC: Always use/create ONE thread per phone number, update resolved_group_id dynamically
   * Gateway is determined by the group sending the message
   */
  async sendMessage(
    content: string,
    toNumber: string,
    fromNumber: string,
    threadId?: string,
    explicitGroupId?: string
  ): Promise<Message> {
    const formattedToNumber = formatPhoneNumber(toNumber);

    // Get User Context
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error("User not authenticated");
    
    const { data: userProfile } = await db
     .from("user_profiles")
     .select("id, tenant_id")
     .eq("id", userData.user.id)
     .maybeSingle();
     
    if (!userProfile) throw new Error("User profile not found");

    // Determine target group for this outgoing message
    let targetGroupId: string | undefined = explicitGroupId;

    // If no explicit group provided, try to find a sensible default
    if (!targetGroupId) {
      const { data: userGroups } = await db
        .from("group_memberships")
        .select("group_id, groups(id, kind)")
        .eq("user_id", userProfile.id);

      if (userGroups && userGroups.length > 0) {
         // Prefer operational groups
         const operationalGroup = userGroups.find((g: any) => g.groups?.kind === 'operational');
         targetGroupId = operationalGroup ? operationalGroup.group_id : userGroups[0].group_id;
      } else {
         // Fallback to finding ANY operational group in tenant (emergency fallback)
         const { data: anyGroup } = await db
           .from("groups")
           .select("id")
           .eq("tenant_id", userProfile.tenant_id)
           .eq("kind", "operational")
           .limit(1)
           .maybeSingle();
         
         targetGroupId = anyGroup?.id;
      }
    }
    
    // Fallback logic if we STILL don't have a group (e.g. fresh tenant, no groups)
    if (!targetGroupId) {
       // Try to find the fallback group
       const { data: fallbackGroup } = await db
         .from("groups")
         .select("id")
         .eq("tenant_id", userProfile.tenant_id)
         .eq("kind", "fallback")
         .maybeSingle();
       
       targetGroupId = fallbackGroup?.id;
    }

    if (!targetGroupId) {
       throw new Error("Could not determine sending group. Please join a group first.");
    }

    // Get gateway from group (with parent inheritance)
    const { data: groupData } = await db
      .from("groups")
      .select("id, name, gateway_id, parent_id")
      .eq("id", targetGroupId)
      .maybeSingle();

    if (!groupData) {
      throw new Error("Group not found");
    }

    let gatewayId = groupData.gateway_id;

    // If group doesn't have gateway, inherit from parent
    if (!gatewayId && groupData.parent_id) {
      const { data: parentGroup } = await db
        .from("groups")
        .select("gateway_id, parent_id")
        .eq("id", groupData.parent_id)
        .maybeSingle();

      if (parentGroup?.gateway_id) {
        gatewayId = parentGroup.gateway_id;
      } else if (parentGroup?.parent_id) {
        // Check grandparent (max 2 levels up)
        const { data: grandparentGroup } = await db
          .from("groups")
          .select("gateway_id")
          .eq("id", parentGroup.parent_id)
          .maybeSingle();

        if (grandparentGroup?.gateway_id) {
          gatewayId = grandparentGroup.gateway_id;
        }
      }
    }

    if (!gatewayId) {
      throw new Error(`No gateway configured for group "${groupData.name}" or its parent groups. Please configure a gateway in Admin settings.`);
    }

    // Find or create thread (ONE per phone number, update resolved_group_id to targetGroupId and gateway)
    const thread = await this.findOrCreateThread(formattedToNumber, targetGroupId, gatewayId);

    // Get gateway phone number for sending
    const { data: gateway } = await db
      .from("gateways")
      .select("phone_number")
      .eq("id", gatewayId)
      .maybeSingle();

    if (!gateway) {
      throw new Error("Gateway not found");
    }

    // MOCK SENDING to external API
    console.log("🚀 MOCK API SENDING:", {
      to: formattedToNumber,
      from: gateway.phone_number || fromNumber,
      content,
      threadId: thread.id,
      threadContactPhone: thread.contact_phone,
      routedToGroup: targetGroupId,
      gatewayId,
      gatewayPhone: gateway.phone_number
    });

    // Store in database
    const { data: messageData, error: insertError } = await db
      .from("messages")
      .insert({
        thread_id: thread.id,
        tenant_id: thread.tenant_id,
        thread_key: thread.contact_phone,
        direction: "outbound",
        content,
        from_number: gateway.phone_number || fromNumber,
        to_number: formattedToNumber,
        status: "sent",
        group_id: targetGroupId
      })
      .select("*")
      .maybeSingle();

    if (insertError) throw insertError;
    if (!messageData) throw new Error("Failed to create message");

    // Update thread timestamp
    await db
      .from("message_threads")
      .update({ 
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("id", thread.id);

    return messageData as Message;
  },

  /**
   * Acknowledge a single message
   */
  async acknowledgeMessage(messageId: string) {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error("Not authenticated");

    const { data: profile } = await db
      .from("user_profiles")
      .select("id")
      .eq("id", user.user.id)
      .maybeSingle();

    if (!profile) {
      console.warn("acknowledgeMessage: Profile not found, cannot acknowledge");
      return;
    }

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
      .from("user_profiles")
      .select("id")
      .eq("id", user.user.id)
      .maybeSingle();

    if (!profile) {
      console.warn("acknowledgeThread: Profile not found, cannot acknowledge");
      return;
    }

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
   * NEW: Simply updates resolved_group_id (one thread per phone)
   */
  async reclassifyThread(threadId: string, newGroupId: string) {
    const { error } = await db
      .from("message_threads")
      .update({
        resolved_group_id: newGroupId,
        updated_at: new Date().toISOString()
      })
      .eq("id", threadId);

    if (error) throw error;

    // Clear fallback flag on messages
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
    const { data: authData } = await supabase.auth.getUser();
    if (!authData?.user) {
      console.warn("getUnacknowledgedMessages: Not authenticated");
      return [];
    }

    const { data: profile } = await db
      .from("user_profiles")
      .select("tenant_id")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (!profile) {
      console.warn("getUnacknowledgedMessages: Profile not found, returning empty array");
      return [];
    }

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

    // If messages are provided separately, use them
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
    }

    return Array.from(threadMap.values());
  },

  async getRecentMessages(limit: number) {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("direction", "inbound")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Error fetching recent messages:", error);
      return [];
    }

    return data || [];
  }
};