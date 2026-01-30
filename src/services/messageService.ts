import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Message = Database["public"]["Tables"]["messages"]["Row"] & {
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
  async getThreadsByGroup(groupId: string) {
    const { data, error } = await supabase
      .from("message_threads")
      .select(`
        id,
        contact_phone,
        resolved_group_id,
        is_resolved,
        last_message_at,
        created_at,
        groups!message_threads_resolved_group_id_fkey (
          name
        ),
        messages!inner (
          id,
          content,
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

    // Process threads with unread counts
    const threads: MessageThread[] = (data || []).map((thread: any) => {
      const messages = Array.isArray(thread.messages) ? thread.messages : [];
      const unreadCount = messages.filter((m: any) => !m.acknowledged_at).length;
      const lastMessage = messages[0] || { content: "", is_fallback: false };

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

    return threads;
  },

  /**
   * Get all threads across all groups for current user
   */
  async getAllThreads() {
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
        id,
        contact_phone,
        resolved_group_id,
        is_resolved,
        last_message_at,
        created_at,
        groups!message_threads_resolved_group_id_fkey (
          id,
          name
        ),
        messages!inner (
          id,
          content,
          acknowledged_at,
          is_fallback,
          created_at
        )
      `)
      .eq("tenant_id", profile.tenant_id)
      .eq("is_resolved", false)
      .order("last_message_at", { ascending: false });

    if (error) {
      console.error("Error fetching all threads:", error);
      throw error;
    }

    const threads: MessageThread[] = (data || []).map((thread: any) => {
      const messages = Array.isArray(thread.messages) ? thread.messages : [];
      const unreadCount = messages.filter((m: any) => !m.acknowledged_at).length;
      
      // Get last message (most recent)
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

    return threads;
  },

  /**
   * Get fallback threads (messages from unknown senders)
   */
  async getFallbackThreads() {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error("Not authenticated");

    const { data: profile } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("auth_user_id", user.user.id)
      .single();

    if (!profile) throw new Error("Profile not found");

    const { data, error } = await supabase
      .from("message_threads")
      .select(`
        id,
        contact_phone,
        resolved_group_id,
        is_resolved,
        last_message_at,
        created_at,
        groups!message_threads_resolved_group_id_fkey (
          id,
          name
        ),
        messages!inner (
          id,
          content,
          acknowledged_at,
          is_fallback,
          created_at
        )
      `)
      .eq("tenant_id", profile.tenant_id)
      .eq("is_resolved", false)
      .order("last_message_at", { ascending: false });

    if (error) throw error;

    // Filter threads that have at least one fallback message
    const fallbackThreads: MessageThread[] = (data || [])
      .filter((thread: any) => {
        const messages = Array.isArray(thread.messages) ? thread.messages : [];
        return messages.some((m: any) => m.is_fallback === true);
      })
      .map((thread: any) => {
        const messages = Array.isArray(thread.messages) ? thread.messages : [];
        const unreadCount = messages.filter((m: any) => !m.acknowledged_at).length;
        
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
          is_fallback: true,
        };
      });

    return fallbackThreads;
  },

  /**
   * Get escalated threads (unacknowledged messages past threshold)
   */
  async getEscalatedThreads(thresholdMinutes: number = 30) {
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
          groups!message_threads_resolved_group_id_fkey (
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

    return data || [];
  },

  /**
   * Get all messages for a specific thread
   */
  async getMessagesByThread(threadId: string) {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    const formattedMessages: Message[] = (data || []).map((msg: any) => ({
      ...msg,
      is_acknowledged: !!msg.acknowledged_at,
    }));

    return formattedMessages;
  },

  /**
   * Send a reply message
   */
  async sendMessage(content: string, toNumber: string, fromNumber: string, threadId: string) {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error("Not authenticated");

    const { data: profile } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("auth_user_id", user.user.id)
      .single();

    if (!profile) throw new Error("User profile not found");

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
   * Reclassify a thread to a different group (for fallback messages)
   */
  async reclassifyThread(threadId: string, newGroupId: string) {
    const { error } = await supabase
      .from("message_threads")
      .update({
        resolved_group_id: newGroupId,
      })
      .eq("id", threadId);

    if (error) throw error;

    // Also update the is_fallback flag on messages
    const { error: msgError } = await supabase
      .from("messages")
      .update({
        is_fallback: false,
        resolved_group_id: newGroupId,
      })
      .eq("thread_id", threadId)
      .eq("is_fallback", true);

    if (msgError) throw msgError;
  },

  /**
   * Resolve a thread (mark as completed)
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

  /**
   * Get unacknowledged messages (legacy method)
   */
  async getUnacknowledgedMessages() {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .is("acknowledged_at", null)
      .eq("direction", "inbound")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching unacknowledged messages:", error);
      throw error;
    }

    return (data || []).map((msg) => ({
      ...msg,
      is_acknowledged: false,
    }));
  },
};