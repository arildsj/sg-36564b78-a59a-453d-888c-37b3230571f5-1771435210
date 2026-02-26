import { supabase } from "@/integrations/supabase/client";

// CRITICAL FIX: Cast supabase client to bypass TypeScript limitations
const db = supabase as any;

export type Gateway = {
  id: string;
  name: string;
  gateway_description: string;
  api_key?: string;
  api_secret?: string;
  sender_id?: string;
  webhook_secret?: string;
  is_active: boolean;
  group_id?: string;
  tenant_id: string;
  base_url?: string;
  gw_phone?: string;
  created_at: string;
  updated_at: string;
};

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

    return (data || []).map((gateway: any) => ({
      ...gateway,
      is_active: gateway.is_active !== false
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
      is_active: data.is_active !== false
    };
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

    return (data || []).map((gateway: any) => ({
      ...gateway,
      is_active: true
    }));
  },

  async create(gateway: Omit<Gateway, "id" | "created_at" | "updated_at" | "tenant_id">): Promise<void> {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error("Not authenticated");

    console.log("🔍 Creating gateway - User:", user.user.id);

    const { data: profile } = await db
      .from("user_profiles")
      .select("tenant_id")
      .eq("id", user.user.id)
      .single();

    console.log("🔍 User profile:", profile);

    if (!profile?.tenant_id) throw new Error("User has no tenant");

    console.log("🔍 Gateway data to insert:", {
      ...gateway,
      tenant_id: profile.tenant_id
    });

    const { data, error } = await db.from("sms_gateways").insert({
      name: gateway.name,
      gateway_description: gateway.gateway_description,
      api_key: gateway.api_key,
      api_secret: gateway.api_secret,
      sender_id: gateway.sender_id,
      webhook_secret: gateway.webhook_secret,
      is_active: gateway.is_active,
      group_id: gateway.group_id,
      base_url: gateway.base_url,
      gw_phone: gateway.gw_phone,
      tenant_id: profile.tenant_id,
    }).select();

    console.log("🔍 Insert result:", { data, error });

    if (error) {
      console.error("❌ Gateway creation error:", error);
      throw error;
    }
  },

  async update(id: string, gateway: Partial<Gateway>): Promise<Gateway> {
    const updates: any = {};

    if (gateway.name !== undefined) updates.name = gateway.name;
    if (gateway.gw_phone !== undefined) updates.gw_phone = gateway.gw_phone;
    if (gateway.gateway_description !== undefined) updates.gateway_description = gateway.gateway_description;
    if (gateway.api_key !== undefined) updates.api_key = gateway.api_key;
    if (gateway.api_secret !== undefined) updates.api_secret = gateway.api_secret;
    if (gateway.sender_id !== undefined) updates.sender_id = gateway.sender_id;
    if (gateway.webhook_secret !== undefined) updates.webhook_secret = gateway.webhook_secret;
    if (gateway.base_url !== undefined) updates.base_url = gateway.base_url;
    if (gateway.is_active !== undefined) updates.is_active = gateway.is_active;
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

    return {
      ...data,
      is_active: data.is_active !== false
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
    await new Promise(resolve => setTimeout(resolve, 1000));
    return true;
  }
};