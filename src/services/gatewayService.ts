import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export interface Gateway {
  id: string;
  name: string;
  gw_phone: string;
  gateway_description?: string;
  is_active?: boolean;
  group_id?: string | null;
  tenant_id?: string | null;
  api_key?: string | null;
  api_secret?: string | null;
  sender_id?: string | null;
  webhook_secret?: string | null;
  base_url?: string | null;
}

export async function getGatewayById(id: string): Promise<string> {
  const { data: gateway, error } = await supabase
    .from("sms_gateways")
    .select("id, name, gw_phone")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching gateway:", error);
    return "";
  }

  // Fallback to empty string if no phone number
  return gateway?.gw_phone || "";
}

export async function getGatewaysForGroup(groupId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from("sms_gateways")
    .select(
      `
      id,
      name,
      gw_phone,
      groups!sms_gateways_group_id_fkey(id, name)
    `
    )
    .eq("group_id", groupId)
    .eq("is_active", true);

  if (error) {
    console.error("Error fetching gateways for group:", error);
    return [];
  }

  return data || [];
}

export const gatewayService = {
  getGatewayById,
  getGatewaysForGroup
};