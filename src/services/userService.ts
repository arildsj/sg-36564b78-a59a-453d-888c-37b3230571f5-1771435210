import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type User = Database["public"]["Tables"]["users"]["Row"];
type OnDutyStatus = Database["public"]["Tables"]["on_duty_status"]["Row"];

export const userService = {
  async getAllUsers(): Promise<User[]> {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .order("name");

    if (error) throw error;
    return data || [];
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
      .single();

    if (error) return null;
    return data;
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

  async getOnDutyUsersForGroup(groupId: string): Promise<User[]> {
    const { data, error } = await supabase
      .from("on_duty_status")
      .select(`
        users(*)
      `)
      .eq("group_id", groupId)
      .eq("is_on_duty", true);

    if (error) throw error;
    return (data || []).map((item: any) => item.users).filter(Boolean);
  },
};