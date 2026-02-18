import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type UserProfile = Database["public"]["Tables"]["user_profiles"]["Row"];
type OnDutyState = Database["public"]["Tables"]["on_duty_state"]["Row"];

export const userService = {
  async getAllUsers(): Promise<(UserProfile & { groups: string[], group_ids: string[] })[]> {
    const { data, error } = await supabase
      .from("user_profiles")
      .select("*, group_memberships(group:groups(id, name))")
      .order("full_name");

    console.log("getAllUsers result:", { data, error });

    if (error) {
      console.error("Error fetching users:", error);
      throw error;
    }

    return (data || []).map((user: any) => ({
      ...user,
      groups: user.group_memberships?.map((gm: any) => gm.group?.name).filter(Boolean) || [],
      group_ids: user.group_memberships?.map((gm: any) => gm.group?.id).filter(Boolean) || []
    }));
  },

  async updateUser(userId: string, updates: Partial<{
    full_name: string;
    email: string;
    phone_number: string;
    role: string;
    group_ids: string[];
    status: string;
  }>) {
    const authUpdates: any = {};
    const profileUpdates: any = {};

    if (updates.full_name !== undefined) profileUpdates.full_name = updates.full_name;
    if (updates.email !== undefined) authUpdates.email = updates.email;
    if (updates.phone_number !== undefined) profileUpdates.phone_number = updates.phone_number;
    if (updates.role !== undefined) profileUpdates.role = updates.role;
    if (updates.status !== undefined) profileUpdates.status = updates.status;

    if (Object.keys(authUpdates).length > 0) {
      const { error: authError } = await supabase.auth.admin.updateUserById(userId, authUpdates);
      if (authError) throw new Error(`Failed to update user auth: ${authError.message}`);
    }

    if (Object.keys(profileUpdates).length > 0) {
      const { error: profileError } = await supabase
        .from("user_profiles")
        .update(profileUpdates)
        .eq("id", userId);
      if (profileError) throw new Error(`Failed to update user profile: ${profileError.message}`);
    }

    // Update Group Memberships only if group_ids is provided
    if (updates.group_ids !== undefined) {
      const { error: deleteError } = await supabase
        .from("group_memberships")
        .delete()
        .eq("user_id", userId);

      if (deleteError) throw new Error(`Failed to clear existing groups: ${deleteError.message}`);

      if (updates.group_ids.length > 0) {
        const { error: insertError } = await supabase
          .from("group_memberships")
          .insert(updates.group_ids.map(gid => ({
            user_id: userId,
            group_id: gid
          })));

        if (insertError) throw new Error(`Failed to add new groups: ${insertError.message}`);
      }
    }
  },

  async getUserById(id: string): Promise<UserProfile | null> {
    const { data, error } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;
    return data;
  },

  async getCurrentUser(): Promise<UserProfile | null> {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) return null;

    const { data, error } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (error) {
      console.error("Error fetching current user:", error);
      return null;
    }
    return data;
  },

  /**
   * DEMO MODE: Get impersonated user from localStorage
   * Used for presentations and demos to show different user perspectives
   */
  getImpersonatedUser(): UserProfile | null {
    if (typeof window === "undefined") return null;
    const stored = localStorage.getItem("semse_demo_user");
    if (!stored) return null;
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  },

  /**
   * DEMO MODE: Set user to impersonate (for demos/presentations)
   */
  setImpersonatedUser(user: UserProfile | null): void {
    if (typeof window === "undefined") return;
    if (user) {
      localStorage.setItem("semse_demo_user", JSON.stringify(user));
    } else {
      localStorage.removeItem("semse_demo_user");
    }
  },

  /**
   * DEMO MODE: Get current user with impersonation support
   * Returns impersonated user if set, otherwise real current user
   */
  async getCurrentUserWithDemo(): Promise<UserProfile | null> {
    const impersonated = this.getImpersonatedUser();
    if (impersonated) return impersonated;
    return this.getCurrentUser();
  },

  async getOnDutyState(groupId: string, userId: string): Promise<OnDutyState | null> {
    const { data, error } = await supabase
      .from("on_duty_state")
      .select("*")
      .eq("group_id", groupId)
      .eq("user_id", userId)
      .single();

    if (error) return null;
    return data;
  },

  async toggleOnDuty(groupId: string, userId: string, isOnDuty: boolean): Promise<void> {
    const { error } = await supabase
      .from("on_duty_state")
      .upsert({
        group_id: groupId,
        user_id: userId,
        is_on_duty: isOnDuty,
        last_toggled_at: new Date().toISOString(),
      });

    if (error) throw error;
  },

  async getOnDutyUsersForGroup(groupId: string) {
    const { data, error } = await supabase
      .from("group_memberships")
      .select("user:user_profiles(*)")
      .eq("group_id", groupId);
      
    if (error) throw error;
    
    return data.map(d => d.user).filter(Boolean);
  },

  async createUser(userData: {
    full_name: string;
    email: string;
    phone_number: string;
    role: "tenant_admin" | "group_admin" | "member";
    password?: string;
    group_ids?: string[];
  }) {
    // 1. Get current user's tenant_id
    const currentUser = await this.getCurrentUser();
    if (!currentUser?.tenant_id) throw new Error("Could not determine current tenant");

    // 2. Create Auth User via Edge Function
    const { data: authData, error: authError } = await supabase.functions.invoke('create-user', {
      body: {
        email: userData.email,
        password: userData.password,
        phone: userData.phone_number
      }
    });

    if (authError) throw new Error(`Failed to create auth user: ${authError.message}`);
    if (!authData?.user?.id) throw new Error("Failed to create auth user: No ID returned");

    const authUserId = authData.user.id;

    // 3. Create User Profile
    const { data: userProfile, error: profileError } = await supabase
      .from("user_profiles")
      .insert({
        id: authUserId,
        tenant_id: currentUser.tenant_id,
        full_name: userData.full_name,
        email: userData.email,
        phone_number: userData.phone_number,
        role: userData.role,
        status: "active"
      })
      .select()
      .single();

    if (profileError) {
      throw new Error(`Failed to create user profile: ${profileError.message}`);
    }

    // 4. Add Group Memberships
    if (userData.group_ids && userData.group_ids.length > 0) {
      const memberships = userData.group_ids.map(groupId => ({
        user_id: userProfile.id,
        group_id: groupId
      }));

      const { error: membershipError } = await supabase
        .from("group_memberships")
        .insert(memberships);

      if (membershipError) {
        console.error("Failed to add group memberships:", membershipError);
        console.warn("User created, but failed to assign groups.");
      }
    }

    return userProfile;
  },

  async deleteUser(userId: string) {
    const { error } = await supabase
      .from('user_profiles')
      .delete()
      .eq('id', userId);

    if (error) throw error;
    
    return true;
  },

  async getUsersByGroup(groupId: string): Promise<UserProfile[]> {
    const { data, error } = await supabase
      .from("group_memberships")
      .select("user:user_profiles(*)")
      .eq("group_id", groupId);

    if (error) {
      console.error("Error fetching group members:", error);
      throw error;
    }

    return data.map((d) => d.user).filter((u): u is UserProfile => u !== null);
  }
};