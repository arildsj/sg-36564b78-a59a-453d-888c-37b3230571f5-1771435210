import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Group = {
  id: string;
  name: string;
  kind: "operational" | "structural" | "administrative" | "billing";
  parent_id: string | null;
  parent_id?: string | null; // Added for UI compatibility
  gateway_id?: string | null;
  tenant_id: string;
  created_at: string;
  updated_at: string;
  escalation_enabled: boolean;
  escalation_timeout_minutes: number;
  min_on_duty_count: number;
  active_members?: number; // From view
  children?: Group[];
};

export interface GroupNode {
  id: string;
  name: string;
  kind: "operational" | "structural";
  active_members?: number;
  children?: GroupNode[];
}

export const groupService = {
  async getGroups(): Promise<Group[]> {
    const { data, error } = await supabase
      .from("group_admin_view")
      .select("*")
      .order("name");

    if (error) throw error;
    
    // Map database fields to UI expected fields if necessary
    return (data || []).map(group => ({
      ...group,
      parent_id: group.parent_group_id // Ensure compatibility
    })) as Group[];
  },

  async getAllGroups(): Promise<Group[]> {
    return this.getGroups();
  },

  async getOperationalGroups(): Promise<Group[]> {
    const { data, error } = await supabase
      .from("group_admin_view")
      .select("*")
      .eq("kind", "operational")
      .order("name");

    if (error) throw error;
    
    return (data || []).map(group => ({
      ...group,
      parent_id: group.parent_group_id
    })) as Group[];
  },

  async getGroupHierarchy(): Promise<GroupNode[]> {
    const groups = await this.getGroups();
    
    const buildHierarchy = (parentId: string | null = null): GroupNode[] => {
      return groups
        .filter(g => g.parent_group_id === parentId)
        .map(g => ({
          id: g.id,
          name: g.name,
          kind: (g.kind === "operational" || g.kind === "structural") ? g.kind : "structural",
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
    parent_id?: string | null;
    gateway_id?: string | null;
    tenant_id: string;
    escalation_enabled?: boolean;
    escalation_timeout_minutes?: number;
    min_on_duty_count?: number;
  }) {
    // Hent brukerens ID
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    // Hvis det er en undergruppe, arv gateway_id fra forelder
    let finalGatewayId = group.gateway_id;
    
    if (group.parent_id && group.parent_id !== "none") {
      const { data: parentGroup, error: parentError } = await (supabase as any)
        .from("groups")
        .select("gateway_id")
        .eq("id", group.parent_id)
        .single();
      
      if (parentError) throw new Error("Failed to fetch parent group");
      finalGatewayId = parentGroup?.gateway_id;
    }

    // Valider at rotgrupper har gateway_id
    if ((!group.parent_id || group.parent_id === "none") && !finalGatewayId) {
      throw new Error("Root groups must have a gateway assigned");
    }

    // Map input fields to database columns
    const dbPayload = {
      name: group.name,
      kind: group.kind,
      description: group.description,
      parent_group_id: group.parent_id === "none" ? null : group.parent_id,
      gateway_id: finalGatewayId,
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

    // Automatisk legg til oppretteren som group_admin
    const { error: membershipError } = await supabase
      .from("group_memberships")
      .insert({
        group_id: data.id,
        user_id: user.id,
        role: "group_admin"
      });

    if (membershipError) {
      console.error("Failed to add creator as group admin:", membershipError);
      // Ikke throw error her - gruppen er allerede opprettet
    }

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