import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export interface GroupNode {
  id: string;
  name: string;
  kind: string;
  description?: string | null;
  gateway_id?: string | null;
  effective_gateway_id?: string | null;
  gateway_name?: string | null;
  is_gateway_inherited?: boolean;
  parent_group_id?: string | null;
  parent_name?: string | null;
  total_members?: number;
  active_members?: number;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
}

export const groupService = {
  async getAllGroups(): Promise<GroupNode[]> {
    const { data, error } = await supabase
      .from("group_admin_view")
      .select("*")
      .order("name");

    if (error) throw error;
    return (data || []) as GroupNode[];
  },

  async getOperationalGroups(): Promise<GroupNode[]> {
    const { data, error } = await supabase
      .from("group_admin_view")
      .select("*")
      .eq("kind", "operational")
      .order("name");

    if (error) throw error;
    return (data || []) as GroupNode[];
  },

  async createGroup(group: {
    name: string;
    kind: string;
    description?: string | null;
    parent_group_id?: string | null;
    gateway_id?: string | null;
    tenant_id: string;
    escalation_enabled?: boolean;
    escalation_timeout_minutes?: number;
  }) {
    // Map frontend camelCase to DB snake_case
    const dbGroup = {
      name: group.name,
      kind: group.kind,
      description: group.description,
      parent_id: group.parent_group_id, // Map parent_group_id to parent_id
      gateway_id: group.gateway_id,
      tenant_id: group.tenant_id,
      escalation_enabled: group.escalation_enabled,
      escalation_timeout_minutes: group.escalation_timeout_minutes
    };

    const { data, error } = await supabase
      .from("groups")
      .insert([dbGroup])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateGroup(groupId: string, updates: {
    name?: string;
    description?: string | null;
    gateway_id?: string | null;
    is_fallback?: boolean;
    escalation_enabled?: boolean;
    escalation_timeout_minutes?: number;
  }) {
    const { data, error } = await supabase
      .from("groups")
      .update(updates)
      .eq("id", groupId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteGroup(groupId: string) {
    const { error } = await supabase
      .from("groups")
      .delete()
      .eq("id", groupId);

    if (error) throw error;
  }
};