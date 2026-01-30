import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

// Helper types to avoid deep nesting issues
type MessageRow = Database["public"]["Tables"]["messages"]["Row"];
type ThreadRow = Database["public"]["Tables"]["message_threads"]["Row"];
type GroupRow = Database["public"]["Tables"]["groups"]["Row"];

export type Message = MessageRow & {
  is_acknowledged: boolean;
};

export type MessageThread = {
  id: string;
  contact_phone: string;
  resolved_group_id: string;
  is_resolved: boolean;
  last_message_at: string;
  created_at: string;
  group_name: string;
  unread_count: number;
  last_message_content: string;
  is_fallback: boolean;
};

export const messageService = {
  /**
   * Get all message threads for a specific group
   */
  async getThreadsByGroup(groupId: string): Promise<MessageThread[]> {
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

    return this._mapThreadsResponse(data);
  },

  /**
   * Get all threads across all groups for current user
   */
  async getAllThreads(): Promise<MessageThread[]> {
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

    return this._mapThreadsResponse(data);
  },

  /**
   * Get fallback threads (threads with fallback messages)
   */
  async getFallbackThreads(): Promise<MessageThread[]> {
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
    return this._mapThreadsResponse(data).map(t => ({ ...t, is_fallback: true }));
  },

  /**
   * Get escalated threads (unacknowledged messages past threshold)
   */
  async getEscalatedThreads(thresholdMinutes: number = 30): Promise<MessageThread[]> {
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
    const threadMap = new Map<string, MessageThread>();
    
    (data || []).forEach((msg: any) => {
      const thread = msg.message_threads;
      if (!threadMap.has(thread.id)) {
        threadMap.set(thread.id, {
          id: thread.id,
          contact_phone: thread.contact_phone,
          resolved_group_id: thread.resolved_group_id,
          is_resolved: thread.is_resolved,
          last_message_at: msg.created_at, // Use message time for sorting in escalation view
          created_at: thread.created_at,
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
   * Send a reply message
   */
  async sendMessage(content: string, toNumber: string, fromNumber: string, threadId: string) {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error("Not authenticated");

    const { data: profile } = await supabase
      .from("users")
      .select("tenant_id, id")
      .eq("auth_user_id", user.user.id)
      .single();

    if (!profile) throw new Error("User profile not found");

    // First insert the message
    const { data, error } = await supabase
      .from("messages")
      .insert({
        content,
        to_number: toNumber,
        from_number: fromNumber,
        direction: "outbound",
        status: "pending",
        thread_id: threadId,
        tenant_id: profile.tenant_id,
        is_fallback: false
      })
      .select()
      .single();

    if (error) throw error;
    return data;
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
  _mapThreadsResponse(data: any[] | null): MessageThread[] {
    return (data || []).map((thread: any) => {
      const messages = Array.isArray(thread.messages) ? thread.messages : [];
      const unreadCount = messages.filter((m: any) => !m.acknowledged_at).length;
      
      // Sort messages to find latest
      const sortedMessages = messages.sort((a: any, b: any) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      const lastMessage = sortedMessages[0] || { content: "", is_fallback: false };

      return {
        id: thread.id,
        contact_phone: thread.contact_phone,
        resolved_group_id: thread.resolved_group_id,
        is_resolved: thread.is_resolved,
        last_message_at: thread.last_message_at,
        created_at: thread.created_at,
        group_name: thread.groups?.name || "Unknown",
        unread_count: unreadCount,
        last_message_content: lastMessage.content,
        is_fallback: lastMessage.is_fallback || false,
      };
    });
  }
};