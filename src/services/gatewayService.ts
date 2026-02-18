import { supabase } from "@/integrations/supabase/client";

// CRITICAL FIX: Cast supabase to any to completely bypass "Type instantiation is excessively deep" errors
const db = supabase as any;

export type Gateway = {
  id: string;
  name: string;
  phone_number: string;
  status: "active" | "inactive" | "error";
  tenant_id: string;
  config: any;
  created_at: string;
  updated_at: string;
  is_default?: boolean;
};

export const gatewayService = {
  async getGateways(): Promise<Gateway[]> {
    const { data, error } = await db
      .from("gateways")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async createGateway(gateway: {
    name: string;
    phone_number: string;
    api_key: string;
    base_url: string;
    is_default?: boolean;
  }) {
    // 1. Get user for tenant_id
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error("Not authenticated");

    const { data: profile } = await db
      .from("user_profiles")
      .select("tenant_id")
      .eq("id", user.user.id)
      .single();

    if (!profile) throw new Error("User profile not found");

    // 2. Insert Gateway (API key will be encrypted by DB trigger or Edge Function ideally, 
    // but here we just store it - in prod use encryption)
    const { data: newGateway, error } = await db
      .from("gateways")
      .insert({
        tenant_id: profile.tenant_id,
        name: gateway.name,
        phone_number: gateway.phone_number,
        api_key_encrypted: gateway.api_key, // Simplified for demo
        config: { base_url: gateway.base_url },
        status: "active",
        is_default: gateway.is_default || false
      })
      .select()
      .single();

    if (error) throw error;
    return newGateway;
  },

  async updateGateway(id: string, updates: Partial<Gateway> & { api_key?: string, base_url?: string }) {
    const dbUpdates: any = { ...updates };
    
    // Map fields to DB structure
    if (updates.api_key) {
      dbUpdates.api_key_encrypted = updates.api_key;
      delete dbUpdates.api_key;
    }
    
    if (updates.base_url) {
      dbUpdates.config = { ...updates.config, base_url: updates.base_url };
      delete dbUpdates.base_url;
    }

    const { error } = await db
      .from("gateways")
      .update(dbUpdates)
      .eq("id", id);

    if (error) throw error;
  },

  async deleteGateway(id: string) {
    const { error } = await db
      .from("gateways")
      .delete()
      .eq("id", id);

    if (error) throw error;
  },

  async testConnection(id: string): Promise<boolean> {
    // Simulate test connection
    await new Promise(resolve => setTimeout(resolve, 1000));
    return true;
  }
};