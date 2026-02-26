import { supabase } from "@/integrations/supabase/client";

// CRITICAL FIX: Cast supabase client to bypass TypeScript limitations
const db = supabase as any;

export interface Gateway {
  id: string;
  tenant_id: string;
  name: string;
  phone_number?: string;
  api_key: string; // Mapped from api_key_encrypted in DB
  base_url: string;
  is_active: boolean;
  status?: string;
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

    // Map api_key_encrypted -> api_key for UI
    return (data || []).map((gateway: any) => ({
      ...gateway,
      api_key: gateway.api_key_encrypted || "",
      is_active: gateway.status === "active"
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

    // Map api_key_encrypted -> api_key for UI
    return {
      ...data,
      api_key: data.api_key_encrypted || "",
      is_active: data.status === "active"
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

    // Map api_key_encrypted -> api_key for UI
    return (data || []).map((gateway: any) => ({
      ...gateway,
      api_key: gateway.api_key_encrypted || "",
      is_active: true
    }));
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

    // Map api_key -> api_key_encrypted for DB
    const dbGateway = {
      tenant_id: profile.tenant_id,
      name: gateway.name,
      phone_number: gateway.phone_number || "",
      api_key_encrypted: gateway.api_key, // Map to correct column name
      base_url: gateway.base_url,
      status: gateway.is_active ? "active" : "inactive",
      group_id: gateway.group_id || null,
      config: {} // Empty JSONB for now
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

    // Map api_key_encrypted -> api_key for return value
    return {
      ...data,
      api_key: data.api_key_encrypted || "",
      is_active: data.status === "active"
    };
  },

  async update(id: string, gateway: Partial<Gateway>): Promise<Gateway> {
    const updates: any = {};

    if (gateway.name !== undefined) updates.name = gateway.name;
    if (gateway.phone_number !== undefined) updates.phone_number = gateway.phone_number;
    if (gateway.api_key !== undefined) updates.api_key_encrypted = gateway.api_key; // Map to correct column
    if (gateway.base_url !== undefined) updates.base_url = gateway.base_url;
    if (gateway.is_active !== undefined) updates.status = gateway.is_active ? "active" : "inactive";
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

    // Map api_key_encrypted -> api_key for return value
    return {
      ...data,
      api_key: data.api_key_encrypted || "",
      is_active: data.status === "active"
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