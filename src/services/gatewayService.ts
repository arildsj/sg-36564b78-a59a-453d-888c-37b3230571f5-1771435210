import { supabase } from "@/integrations/supabase/client";

// CRITICAL FIX: Cast supabase client to bypass TypeScript limitations
const db = supabase as any;

export interface Gateway {
  id: string;
  tenant_id: string;
  name: string;
  provider: string;
  phone_number: string;
  api_url?: string;
  api_key?: string;
  username?: string;
  password?: string;
  status: "active" | "inactive" | "error";
  last_test_at?: string;
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
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching active gateways:", error);
      throw error;
    }

    return data || [];
  },

  async create(gateway: Omit<Gateway, "id" | "created_at" | "updated_at">): Promise<Gateway> {
    const { data, error } = await db
      .from("sms_gateways")
      .insert(gateway)
      .select()
      .single();

    if (error) {
      console.error("Error creating gateway:", error);
      throw error;
    }

    return data;
  },

  async update(id: string, gateway: Partial<Gateway>): Promise<Gateway> {
    const { data, error } = await db
      .from("sms_gateways")
      .update(gateway)
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