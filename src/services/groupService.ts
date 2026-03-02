import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Group = {
  id: string;
  name: string;
  kind: "operational" | "administrative";  // FASIT: only these two
  parent_id: string | null;  // FASIT: 'parent_id' (not 'parent_group_id')
  gateway_id?: string | null;  // FASIT: gateway_id exists
  tenant_id: string;
  created_at: string;
  updated_at: string;
  escalation_enabled: boolean;
  escalation_timeout_minutes: number;
  min_on_duty_count: number;
  description?: string | null;
  active_members?: number;
  children?: Group[];
};

export interface GroupNode {
  id: string;
  name: string;
  kind: "operational" | "administrative";
  active_members?: number;
  children?: GroupNode[];
}

export const groupService = {
  async getGroups(): Promise<Group[]> {
    const { data, error } = await supabase
      .from("groups")
      .select("*")
      .order("name");

    if (error) throw error;
    
    return (data || []) as Group[];
  },

  async getAllGroups(): Promise<Group[]> {
    return this.getGroups();
  },

  async getOperationalGroups(): Promise<Group[]> {
    const { data, error } = await supabase
      .from("groups")
      .select("*")
      .eq("kind", "operational")
      .order("name");

    if (error) throw error;
    
    return (data || []) as Group[];
  },

  async getGroupHierarchy(): Promise<GroupNode[]> {
    const groups = await this.getGroups();
    
    const buildHierarchy = (parentId: string | null = null): GroupNode[] => {
      return groups
        .filter(g => g.parent_id === parentId)
        .map(g => ({
          id: g.id,
          name: g.name,
          kind: g.kind,
          active_members: g.active_members,
          children: buildHierarchy(g.id)
        }));
    };

    return buildHierarchy(null);
  },

  async createGroup(group: {
    name: string;
    kind: string;
    description?: string | null;
    parent_id?: string | null;  // FASIT: 'parent_id'
    gateway_id?: string | null;  // FASIT: gateway_id
    tenant_id: string;
    escalation_enabled?: boolean;
    escalation_timeout_minutes?: number;
    min_on_duty_count?: number;
  }) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const { data: userProfile, error: profileError } = await supabase
      .from("user_profiles")
      .select("tenant_id, role")
      .eq("id", user.id)
      .single();

    if (profileError || !userProfile) {
      console.error("Failed to fetch user profile:", profileError);
      throw new Error("Failed to verify user permissions");
    }

    const validatedTenantId = userProfile.tenant_id;

    if (!["tenant_admin", "group_admin"].includes(userProfile.role)) {
      throw new Error("Insufficient permissions");
    }

    // If it's a subgroup, inherit gateway_id from parent
    let finalGatewayId = group.gateway_id;
    
    if (group.parent_id && group.parent_id !== "none") {
      const { data: parentGroup, error: parentError } = await supabase
        .from("groups")
        .select("gateway_id")
        .eq("id", group.parent_id)
        .single();
      
      if (parentError) {
        console.error("Failed to fetch parent group:", parentError);
        throw new Error("Failed to fetch parent group");
      }
      
      finalGatewayId = (parentGroup as any)?.gateway_id;
    }

    // Validate that root groups have gateway_id
    if ((!group.parent_id || group.parent_id === "none") && !finalGatewayId) {
      throw new Error("Root groups must have a gateway assigned");
    }

    const dbPayload = {
      name: group.name,
      kind: group.kind,
      description: group.description,
      parent_id: group.parent_id === "none" ? null : group.parent_id,  // FASIT: parent_id
      gateway_id: finalGatewayId,  // FASIT: gateway_id
      tenant_id: validatedTenantId,
      escalation_enabled: group.escalation_enabled,
      escalation_timeout_minutes: group.escalation_timeout_minutes,
      min_on_duty_count: group.min_on_duty_count
    };

    console.log("Creating group with payload:", dbPayload);

    const { data, error } = await supabase
      .from("groups")
      .insert([dbPayload as any])
      .select()
      .single();

    if (error) {
      console.error("Database error:", error);
      throw error;
    }

    // Automatically add creator as group_admin
    const { error: membershipError } = await supabase
      .from("group_memberships")
      .insert({
        group_id: data.id,
        user_id: user.id,
        is_admin: true
      });

    if (membershipError) {
      console.error("Failed to add creator as group admin:", membershipError);
    }

    return data;
  },

  async updateGroup(groupId: string, updates: {
    name?: string;
    description?: string | null;
    kind?: string;
    parent_id?: string | null;  // FASIT: parent_id
    gateway_id?: string | null;  // FASIT: gateway_id
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