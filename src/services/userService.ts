import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type User = Database["public"]["Tables"]["users"]["Row"];
type OnDutyStatus = Database["public"]["Tables"]["on_duty_status"]["Row"];

export const userService = {
  async getAllUsers(): Promise<(User & { groups: string[], group_ids: string[] })[]> {
    const { data, error } = await supabase
      .from("users")
      .select("*, group_memberships(group:groups(id, name))")
      .order("name");

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
    name: string;
    email: string;
    phone: string;
    role: "tenant_admin" | "group_admin" | "member";
    group_ids: string[];
    status?: string;
    on_duty?: boolean;
  }>) {
    // 1. Prepare User Profile updates
    const profileUpdates: any = {};
    if (updates.name !== undefined) profileUpdates.name = updates.name;
    if (updates.email !== undefined) profileUpdates.email = updates.email;
    if (updates.phone !== undefined) profileUpdates.phone_number = updates.phone;
    if (updates.role !== undefined) profileUpdates.role = updates.role;
    if (updates.status !== undefined) profileUpdates.status = updates.status;
    if (updates.on_duty !== undefined) profileUpdates.on_duty = updates.on_duty;

    if (Object.keys(profileUpdates).length > 0) {
      const { error: profileError } = await supabase
        .from("users")
        .update(profileUpdates)
        .eq("id", userId);

      if (profileError) throw new Error(`Failed to update user profile: ${profileError.message}`);
    }

    // 2. Update Group Memberships only if group_ids is provided
    if (updates.group_ids !== undefined) {
      // Get existing to minimize churn if needed, but delete-insert is robust for full sync
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

  async getUserById(id: string): Promise<User | null> {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;
    return data;
  },

  async getCurrentUser(): Promise<User | null> {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) return null;

    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("auth_user_id", authData.user.id)
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
  getImpersonatedUser(): User | null {
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
  setImpersonatedUser(user: User | null): void {
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
  async getCurrentUserWithDemo(): Promise<User | null> {
    const impersonated = this.getImpersonatedUser();
    if (impersonated) return impersonated;
    return this.getCurrentUser();
  },

  async getOnDutyStatus(groupId: string, userId: string): Promise<OnDutyStatus | null> {
    const { data, error } = await supabase
      .from("on_duty_status")
      .select("*")
      .eq("group_id", groupId)
      .eq("user_id", userId)
      .single();

    if (error) return null;
    return data;
  },

  async toggleOnDuty(groupId: string, userId: string, isOnDuty: boolean): Promise<void> {
    const { error } = await supabase
      .from("on_duty_status")
      .upsert({
        group_id: groupId,
        user_id: userId,
        is_on_duty: isOnDuty,
        last_toggled_at: new Date().toISOString(),
      });

    if (error) throw error;
  },

  async getOnDutyUsersForGroup(groupId: string) {
    // This requires a more complex query joining group_memberships and shifts/status
    // Simplified for now: Get all users in group
    const { data, error } = await supabase
      .from("group_memberships")
      .select("user:users(*)")
      .eq("group_id", groupId);
      
    if (error) throw error;
    
    return data.map(d => d.user).filter(Boolean);
  },

  async createUser(userData: {
    name: string;
    email: string;
    phone: string;
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
        phone: userData.phone
      }
    });

    if (authError) throw new Error(`Failed to create auth user: ${authError.message}`);
    if (!authData?.user?.id) throw new Error("Failed to create auth user: No ID returned");

    const authUserId = authData.user.id;

    // 3. Create User Profile
    const { data: userProfile, error: profileError } = await supabase
      .from("users")
      .insert({
        auth_user_id: authUserId,
        tenant_id: currentUser.tenant_id,
        name: userData.name,
        email: userData.email,
        phone_number: userData.phone,
        role: userData.role,
        status: "active"
      })
      .select()
      .single();

    if (profileError) {
      // Cleanup: delete auth user if profile creation fails
      // Note: This requires another Edge Function or manual cleanup, 
      // but for now we just throw the error.
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
        // We don't throw here as the user is created successfully
        console.warn("Bruker opprettet, men feilet ved tildeling av grupper.");
      }
    }

    return userProfile;
  },

  async deleteUser(userId: string) {
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', userId);

    if (error) throw error;
    
    // Also delete from auth (requires admin privileges or edge function usually, 
    // but we'll start with DB record which might trigger cascade or be enough for soft delete logic if implemented)
    // For now, we assume DB deletion is what's requested.
    return true;
  },

  async getUsersByGroup(groupId: string): Promise<User[]> {
    const { data, error } = await supabase
      .from("group_memberships")
      .select("user:users(*)")
      .eq("group_id", groupId);

    if (error) {
      console.error("Error fetching group members:", error);
      throw error;
    }

    // Filter out any null users (shouldn't happen with inner join implicit in select, but safe to do)
    return data.map((d) => d.user).filter((u): u is User => u !== null);
  }
};