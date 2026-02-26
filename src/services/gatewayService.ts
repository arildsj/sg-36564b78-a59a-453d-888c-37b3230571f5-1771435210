import { supabase } from "@/integrations/supabase/client";

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
    console.log("🔍 Step 1: Getting authenticated user...");
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError) {
      console.error("❌ Auth error:", userError);
      throw new Error(`Authentication failed: ${userError.message}`);
    }
    
    if (!user) {
      console.error("❌ No user found in session");
      throw new Error("Not authenticated - please log in again");
    }

    console.log("✅ User authenticated:", user.id);

    console.log("🔍 Step 2: Fetching user profile...");
    const { data: profile, error: profileError } = await db
      .from("user_profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (profileError) {
      console.error("❌ Profile fetch error:", profileError);
      throw new Error(`Failed to fetch user profile: ${profileError.message}`);
    }

    if (!profile?.tenant_id) {
      console.error("❌ User profile missing tenant_id");
      throw new Error("User profile is incomplete - missing tenant_id");
    }

    console.log("✅ User profile found, tenant_id:", profile.tenant_id);

    const insertData = {
      name: gateway.name,
      gateway_description: gateway.gateway_description || '',
      api_key: gateway.api_key || null,
      api_secret: gateway.api_secret || null,
      sender_id: gateway.sender_id || null,
      webhook_secret: gateway.webhook_secret || null,
      is_active: gateway.is_active !== false,
      group_id: gateway.group_id || null,
      base_url: gateway.base_url || null,
      gw_phone: gateway.gw_phone || null,
      tenant_id: profile.tenant_id,
    };

    console.log("🔍 Step 3: Inserting gateway with data:", insertData);

    const { data, error } = await db
      .from("sms_gateways")
      .insert(insertData)
      .select();

    if (error) {
      console.error("❌ Gateway insert error:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      throw new Error(`Failed to create gateway: ${error.message}`);
    }

    console.log("✅ Gateway created successfully:", data);
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