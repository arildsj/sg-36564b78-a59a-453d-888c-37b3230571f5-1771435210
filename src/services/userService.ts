import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: "member" | "group_admin" | "tenant_admin";
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  tenant_id: string;
  phone_number?: string | null;
}

export const userService = {
  async getCurrentUserProfile(): Promise<UserProfile | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (error) {
      console.error("Error fetching user profile:", error);
      return null;
    }

    return data as UserProfile;
  },

  async getGroupMembers(groupId: string): Promise<UserProfile[]> {
    const { data, error } = await supabase
      .from("group_memberships")
      .select(`
        user:user_profiles(*)
      `)
      .eq("group_id", groupId);

    if (error) {
      console.error("Error fetching group members:", error);
      throw error;
    }

    return (data || [])
      .map((d: any) => d.user)
      .filter((u: any): u is UserProfile => u !== null);
  }
};