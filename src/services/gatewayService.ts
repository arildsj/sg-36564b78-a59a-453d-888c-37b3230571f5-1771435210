import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/database.types";

export type Gateway = Tables<"sms_gateways">;

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

  return gateway?.gw_phone || "";
}

export interface GatewayWithGroup extends Gateway {
  groups: { id: string; name: string } | null;
}

export async function getGatewaysForGroup(groupId: string): Promise<GatewayWithGroup[]> {
  const response = await supabase
    .from("sms_gateways")
    .select("*, groups(id, name)")
    .eq("group_id", groupId)
    .eq("is_active", true)
    .returns<(Gateway & { groups: { id: string; name: string } | { id: string; name: string }[] | null })[]>();

  if (response.error) {
    console.error("Error fetching gateways for group:", response.error);
    return [];
  }

  // Type-safe map without `as unknown as any` chains
  const result: GatewayWithGroup[] = (response.data || []).map((item) => {
    const groupData = item.groups;
    const singleGroup = Array.isArray(groupData) ? groupData[0] : groupData;
    
    return {
      ...item,
      groups: singleGroup || null
    };
  });
  
  return result;
}

export async function getAll(): Promise<Gateway[]> {
  const { data, error } = await supabase
    .from("sms_gateways")
    .select("*")
    .order("created_at", { ascending: false });
    
  if (error) throw error;
  return data || [];
}

export async function create(gatewayData: TablesInsert<"sms_gateways">): Promise<Gateway> {
  const { data, error } = await supabase
    .from("sms_gateways")
    .insert(gatewayData)
    .select()
    .single();
    
  if (error) throw error;
  return data;
}

export async function deleteGateway(id: string): Promise<void> {
  const { error } = await supabase
    .from("sms_gateways")
    .delete()
    .eq("id", id);
    
  if (error) throw error;
}

export const gatewayService = {
  getGatewayById,
  getGatewaysForGroup,
  getAll,
  create,
  delete: deleteGateway
};