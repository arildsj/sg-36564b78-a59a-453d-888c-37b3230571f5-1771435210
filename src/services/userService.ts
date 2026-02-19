import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export const getUserProfile = async (userId: string): Promise<Tables<"user_profiles"> | null> => {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("Error fetching user profile:", error);
    return null;
  }

  return data;
};

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
    try {
      // Get current session to get the access token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;

      // Call API route with auth token (uses service role internally)
      const response = await fetch("/api/user-profile", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json"
        }
      });

      if (!response.ok) {
        console.error("Failed to fetch user profile:", response.statusText);
        return null;
      }

      const result = await response.json();
      
      if (!result.success) {
        console.error("Error fetching user profile:", result.error);
        return null;
      }

      return result.data as UserProfile;
    } catch (error) {
      console.error("Error fetching user profile:", error);
      return null;
    }
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