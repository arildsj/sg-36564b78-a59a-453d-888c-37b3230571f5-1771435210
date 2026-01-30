import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Message = Database["public"]["Tables"]["messages"]["Row"] & {
  is_acknowledged: boolean;
};

export const messageService = {
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

    return (data || []).map(msg => ({
      ...msg,
      is_acknowledged: false
    }));
  },

  async getMessagesByThread(threadKey: string) {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("thread_key", threadKey)
      .order("created_at", { ascending: true });

    if (error) throw error;
    
    return (data || []).map(msg => ({
      ...msg,
      is_acknowledged: !!msg.acknowledged_at
    }));
  },

  async sendMessage(content: string, toNumber: string, fromNumber: string, threadKey: string) {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error("Not authenticated");

    // Get tenant_id from current user profile
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
        thread_key: threadKey,
        tenant_id: profile.tenant_id
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async acknowledgeMessage(messageId: string) {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error("Not authenticated");

    // Get internal user id
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
        acknowledged_by_user_id: profile.id
      })
      .eq("id", messageId);

    if (error) throw error;
  },
  
  async acknowledgeThread(threadKey: string) {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error("Not authenticated");

    // Get internal user id
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
        acknowledged_by_user_id: profile.id
      })
      .eq("thread_key", threadKey)
      .is("acknowledged_at", null)
      .eq("direction", "inbound");

    if (error) throw error;
  }
};