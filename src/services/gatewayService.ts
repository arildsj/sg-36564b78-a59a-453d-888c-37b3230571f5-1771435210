import { supabase } from "@/integrations/supabase/client";

// CRITICAL FIX: Cast supabase client to bypass TypeScript limitations
const db = supabase as any;

export interface Gateway {
  id: string;
  tenant_id: string;
  name: string;
  phone_number: string;
  api_key?: string; // Mapped from api_key_encrypted
  base_url?: string; // Mapped from config.base_url
  status: "active" | "inactive" | "error";
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

    // Transform data: extract base_url from config JSONB
    return (data || []).map((gw: any) => ({
      ...gw,
      api_key: gw.api_key_encrypted,
      base_url: gw.config?.base_url || null
    }));
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

    if (!data) return null;

    return {
      ...data,
      api_key: data.api_key_encrypted,
      base_url: data.config?.base_url || null
    };
  },

  async getActive(): Promise<Gateway[]> {
    const { data, error } = await db
      .from("sms_gateways")
      .select("*")
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching active gateways:", error);
      throw error;
    }

    return (data || []).map((gw: any) => ({
      ...gw,
      api_key: gw.api_key_encrypted,
      base_url: gw.config?.base_url || null
    }));
  },

  async create(gateway: Omit<Gateway, "id" | "created_at" | "updated_at">): Promise<Gateway> {
    // Get current user and tenant_id
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const { data: profile } = await db
      .from("user_profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!profile) throw new Error("User profile not found");

    // Transform data to match database schema
    const dbGateway = {
      tenant_id: profile.tenant_id,
      name: gateway.name,
      phone_number: gateway.phone_number,
      api_key_encrypted: gateway.api_key || "",
      status: gateway.status || "active",
      config: {
        base_url: gateway.base_url || ""
      }
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

    return {
      ...data,
      api_key: data.api_key_encrypted,
      base_url: data.config?.base_url || null
    };
  },

  async update(id: string, gateway: Partial<Gateway>): Promise<Gateway> {
    const updates: any = {};

    if (gateway.name) updates.name = gateway.name;
    if (gateway.phone_number) updates.phone_number = gateway.phone_number;
    if (gateway.status) updates.status = gateway.status;
    
    // Handle api_key update
    if (gateway.api_key !== undefined) {
      updates.api_key_encrypted = gateway.api_key;
    }

    // Handle base_url update - merge with existing config
    if (gateway.base_url !== undefined) {
      const { data: existing } = await db
        .from("sms_gateways")
        .select("config")
        .eq("id", id)
        .single();

      updates.config = {
        ...(existing?.config || {}),
        base_url: gateway.base_url
      };
    }

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

    return {
      ...data,
      api_key: data.api_key_encrypted,
      base_url: data.config?.base_url || null
    };
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