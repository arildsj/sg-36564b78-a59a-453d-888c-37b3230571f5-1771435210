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
  parent_id?: string | null; // For UI component compatibility
  parent_group_id?: string | null; // Database column
  parent_name?: string | null;
  total_members?: number;
  active_members?: number;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
  escalation_enabled?: boolean;
  escalation_timeout_minutes?: number;
  min_on_duty_count?: number;
}

export const groupService = {
  async getAllGroups(): Promise<GroupNode[]> {
    const { data, error } = await supabase
      .from("group_admin_view")
      .select("*")
      .order("name");

    if (error) throw error;
    
    // Map database fields to UI expected fields if necessary
    return (data || []).map(group => ({
      ...group,
      parent_id: group.parent_group_id // Ensure compatibility
    })) as GroupNode[];
  },

  async getOperationalGroups(): Promise<GroupNode[]> {
    const { data, error } = await supabase
      .from("group_admin_view")
      .select("*")
      .eq("kind", "operational")
      .order("name");

    if (error) throw error;
    
    return (data || []).map(group => ({
      ...group,
      parent_id: group.parent_group_id
    })) as GroupNode[];
  },

  async createGroup(group: {
    name: string;
    kind: string;
    description?: string | null;
    parent_id?: string | null;
    gateway_id?: string | null;
    tenant_id: string;
    escalation_enabled?: boolean;
    escalation_timeout_minutes?: number;
    min_on_duty_count?: number;
  }) {
    // Map input fields to database columns
    const dbPayload = {
      name: group.name,
      kind: group.kind,
      description: group.description,
      parent_group_id: group.parent_id || null, // Map parent_id -> parent_group_id
      gateway_id: group.gateway_id || null,
      tenant_id: group.tenant_id,
      escalation_enabled: group.escalation_enabled,
      escalation_timeout_minutes: group.escalation_timeout_minutes,
      min_on_duty_count: group.min_on_duty_count
    };

    const { data, error } = await supabase
      .from("groups")
      .insert([dbPayload])
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
    min_on_duty_count?: number;
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