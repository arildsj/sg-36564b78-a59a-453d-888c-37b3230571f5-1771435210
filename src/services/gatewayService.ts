import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

// Update type definition to match actual DB schema
type Gateway = Database["public"]["Tables"]["gateways"]["Row"] & {
  base_url: string | null;
  is_default: boolean;
};

type GatewayInsert = Database["public"]["Tables"]["gateways"]["Insert"] & {
  base_url?: string | null;
  is_default?: boolean;
};

type GatewayUpdate = Database["public"]["Tables"]["gateways"]["Update"] & {
  base_url?: string | null;
  is_default?: boolean;
};

export const gatewayService = {
  async getAllGateways(): Promise<Gateway[]> {
    const { data, error } = await supabase
      .from("gateways")
      .select("*")
      .order("name");

    if (error) throw error;
    return (data || []) as Gateway[];
  },

  async getGatewayById(id: string): Promise<Gateway | null> {
    const { data, error } = await supabase
      .from("gateways")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;
    return data as Gateway;
  },

  async createGateway(gateway: any): Promise<Gateway> {
    // Map frontend fields to DB fields
    const dbGateway = {
      ...gateway,
      status: gateway.is_active ? 'active' : 'inactive',
      // Remove fields that might not exist in type
    };
    delete dbGateway.is_active;

    const { data, error } = await supabase
      .from("gateways")
      .insert(dbGateway)
      .select()
      .single();

    if (error) throw error;
    return data as Gateway;
  },

  async updateGateway(id: string, updates: any): Promise<Gateway> {
    const dbUpdates = {
      ...updates,
    };
    
    if (updates.is_active !== undefined) {
      dbUpdates.status = updates.is_active ? 'active' : 'inactive';
      delete dbUpdates.is_active;
    }

    const { data, error } = await supabase
      .from("gateways")
      .update(dbUpdates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data as Gateway;
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