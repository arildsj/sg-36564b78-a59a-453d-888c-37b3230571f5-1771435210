import { supabase } from "@/integrations/supabase/client";

// CRITICAL FIX: Cast supabase client to bypass TypeScript limitations
const db = supabase as any;

export interface Gateway {
  id: string;
  tenant_id: string;
  gateway_name: string;
  api_key: string;
  api_secret?: string;
  sender_id?: string;
  webhook_secret?: string;
  base_url: string;
  is_active: boolean;
  group_id?: string;
  created_at: string;
  updated_at: string;
}

export const gatewayService = {
  async getAll(): Promise<Gateway[]> {
    const { data, error } = await db
      .from("sms_gateways")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching gateways:", error);
      throw error;
    }

    return data || [];
  },

  async getById(id: string): Promise<Gateway | null> {
    const { data, error } = await db
      .from("sms_gateways")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("Error fetching gateway:", error);
      throw error;
    }

    return data;
  },

  async getActive(): Promise<Gateway[]> {
    const { data, error } = await db
      .from("sms_gateways")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching active gateways:", error);
      throw error;
    }

    return data || [];
  },

  async create(gateway: Omit<Gateway, "id" | "created_at" | "updated_at" | "tenant_id">): Promise<Gateway> {
    // Get current user and tenant_id
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const { data: profile } = await db
      .from("user_profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!profile) throw new Error("User profile not found");

    const dbGateway = {
      tenant_id: profile.tenant_id,
      gateway_name: gateway.gateway_name,
      api_key: gateway.api_key,
      base_url: gateway.base_url,
      is_active: gateway.is_active ?? true,
      api_secret: gateway.api_secret || null,
      sender_id: gateway.sender_id || null,
      webhook_secret: gateway.webhook_secret || null,
      group_id: gateway.group_id || null
    };

    const { data, error } = await db
      .from("sms_gateways")
      .insert(dbGateway)
      .select()
      .single();

    if (error) {
      console.error("Error creating gateway:", error);
      throw error;
    }

    return data;
  },

  async update(id: string, gateway: Partial<Gateway>): Promise<Gateway> {
    const updates: any = {};

    if (gateway.gateway_name !== undefined) updates.gateway_name = gateway.gateway_name;
    if (gateway.api_key !== undefined) updates.api_key = gateway.api_key;
    if (gateway.base_url !== undefined) updates.base_url = gateway.base_url;
    if (gateway.is_active !== undefined) updates.is_active = gateway.is_active;
    if (gateway.api_secret !== undefined) updates.api_secret = gateway.api_secret;
    if (gateway.sender_id !== undefined) updates.sender_id = gateway.sender_id;
    if (gateway.webhook_secret !== undefined) updates.webhook_secret = gateway.webhook_secret;
    if (gateway.group_id !== undefined) updates.group_id = gateway.group_id;

    const { data, error } = await db
      .from("sms_gateways")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating gateway:", error);
      throw error;
    }

    return data;
  },

  async delete(id: string): Promise<void> {
    const { error } = await db
      .from("sms_gateways")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting gateway:", error);
      throw error;
    }
  },

  async testConnection(id: string): Promise<boolean> {
    // Mock test - in production this would actually test the gateway
    await new Promise(resolve => setTimeout(resolve, 1000));
    return true;
  }
};