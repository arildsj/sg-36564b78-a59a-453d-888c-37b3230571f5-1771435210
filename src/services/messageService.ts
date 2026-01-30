import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Message = Database["public"]["Tables"]["messages"]["Row"];
type MessageWithDetails = Message & {
  group_name?: string;
  acknowledged_by_name?: string;
};

export const messageService = {
  async getMessagesByGroup(groupId: string, limit = 50): Promise<MessageWithDetails[]> {
    const { data, error } = await supabase
      .from("messages")
      .select(`
        *,
        groups(name),
        users(name)
      `)
      .eq("group_id", groupId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;

    return (data || []).map((msg: any) => ({
      ...msg,
      group_name: msg.groups?.name,
      acknowledged_by_name: msg.users?.name,
    }));
  },

  async getMessagesByThread(threadKey: string): Promise<Message[]> {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("thread_key", threadKey)
      .order("created_at", { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async getUnacknowledgedMessages(): Promise<MessageWithDetails[]> {
    const { data, error } = await supabase
      .from("messages")
      .select(`
        *,
        groups(name)
      `)
      .eq("direction", "inbound")
      .is("acknowledged_at", null)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return (data || []).map((msg: any) => ({
      ...msg,
      group_name: msg.groups?.name,
    }));
  },

  async acknowledgeMessage(messageId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from("messages")
      .update({
        acknowledged_at: new Date().toISOString(),
        acknowledged_by_user_id: userId,
      })
      .eq("id", messageId);

    if (error) throw error;
  },

  async sendMessage(
    groupId: string,
    gatewayId: string,
    toNumber: string,
    content: string,
    threadKey: string
  ): Promise<Message> {
    const { data: gateway } = await supabase
      .from("gateways")
      .select("phone_number, tenant_id")
      .eq("id", gatewayId)
      .single();

    if (!gateway) throw new Error("Gateway not found");

    const { data, error } = await supabase
      .from("messages")
      .insert({
        tenant_id: gateway.tenant_id,
        gateway_id: gatewayId,
        group_id: groupId,
        thread_key: threadKey,
        direction: "outbound",
        from_number: gateway.phone_number,
        to_number: toNumber,
        content,
        status: "pending",
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};