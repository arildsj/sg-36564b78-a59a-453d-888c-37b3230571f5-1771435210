import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

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
  const { data, error } = await supabase
    .from("sms_gateways")
    .select(`
      *,
      groups(id, name)
    `)
    .eq("group_id", groupId)
    .eq("is_active", true);

  if (error) {
    console.error("Error fetching gateways for group:", error);
    return [];
  }

  // Map result properly without 'as unknown' chained casts 
  // which trigger 'excessively deep' TS instantiation errors
  const result: GatewayWithGroup[] = (data || []).map(item => ({
    ...item,
    groups: Array.isArray(item.groups) ? item.groups[0] : item.groups
  })) as GatewayWithGroup[];
  
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