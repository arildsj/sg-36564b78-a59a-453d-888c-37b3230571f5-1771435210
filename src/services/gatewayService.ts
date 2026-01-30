import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Gateway = Database["public"]["Tables"]["gateways"]["Row"];
type GatewayInsert = Database["public"]["Tables"]["gateways"]["Insert"];
type GatewayUpdate = Database["public"]["Tables"]["gateways"]["Update"];

export const gatewayService = {
  async getAllGateways(): Promise<Gateway[]> {
    const { data, error } = await supabase
      .from("gateways")
      .select("*")
      .order("name");

    if (error) throw error;
    return data || [];
  },

  async getGatewayById(id: string): Promise<Gateway | null> {
    const { data, error } = await supabase
      .from("gateways")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;
    return data;
  },

  async createGateway(gateway: GatewayInsert): Promise<Gateway> {
    const { data, error } = await supabase
      .from("gateways")
      .insert(gateway)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateGateway(id: string, updates: GatewayUpdate): Promise<Gateway> {
    const { data, error } = await supabase
      .from("gateways")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteGateway(id: string): Promise<void> {
    const { error } = await supabase
      .from("gateways")
      .delete()
      .eq("id", id);

    if (error) throw error;
  },

  async setDefaultGateway(id: string, tenantId: string): Promise<void> {
    // First, unset all other gateways as default
    await supabase
      .from("gateways")
      .update({ is_default: false })
      .eq("tenant_id", tenantId);

    // Then set the selected gateway as default
    const { error } = await supabase
      .from("gateways")
      .update({ is_default: true })
      .eq("id", id);

    if (error) throw error;
  },
};