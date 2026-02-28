import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Group = {
  id: string;
  name: string;
  kind: "operational" | "structural" | "administrative" | "billing";
  parent_id: string | null;
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
    
    // Map database fields to UI expected fields
    // Vi caster til any for å håndtere både parent_id (fasit) og parent_group_id (gamle typer)
    return (data || []).map(group => {
      const g = group as any;
      return {
        ...group,
        // Prioriter parent_id hvis den finnes, ellers fallback til parent_group_id
        parent_id: g.parent_id || g.parent_group_id,
        // Sikre at gateway_id kommer med hvis den finnes i viewet
        gateway_id: g.gateway_id
      };
    }) as Group[];
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
    
    return (data || []).map(group => {
      const g = group as any;
      return {
        ...group,
        parent_id: g.parent_id || g.parent_group_id,
        gateway_id: g.gateway_id
      };
    }) as Group[];
  },

  async getGroupHierarchy(): Promise<GroupNode[]> {
    const groups = await this.getGroups();
    
    const buildHierarchy = (parentId: string | null = null): GroupNode[] => {
      return groups
        .filter(g => g.parent_id === parentId)
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
    // Hent brukerens ID og profil
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    // Hent brukerens profil for å verifisere tenant_id og rolle
    const { data: userProfile, error: profileError } = await supabase
      .from("user_profiles")
      .select("tenant_id, role")
      .eq("id", user.id)
      .single();

    if (profileError || !userProfile) {
      console.error("Failed to fetch user profile:", profileError);
      throw new Error("Failed to verify user permissions");
    }

    // Bruk ALLTID brukerens tenant_id (ignorer input fra UI)
    const validatedTenantId = userProfile.tenant_id;

    // Verifiser at brukeren har admin-rettigheter
    if (!["tenant_admin", "group_admin"].includes(userProfile.role)) {
      throw new Error("Insufficient permissions");
    }

    // Hvis det er en undergruppe, arv gateway_id fra forelder
    let finalGatewayId = group.gateway_id;
    
    if (group.parent_id && group.parent_id !== "none") {
      // Vi bruker select("*") og caster til any fordi database.types.ts mangler gateway_id
      // selv om CSV-fasiten sier den finnes.
      const { data: parentGroupRaw, error: parentError } = await supabase
        .from("groups")
        .select("*")
        .eq("id", group.parent_id)
        .single();
      
      if (parentError) {
        console.error("Failed to fetch parent group:", parentError);
        throw new Error("Failed to fetch parent group");
      }
      
      const parentGroup = parentGroupRaw as any;
      finalGatewayId = parentGroup?.gateway_id;
    }

    // Valider at rotgrupper har gateway_id
    if ((!group.parent_id || group.parent_id === "none") && !finalGatewayId) {
      throw new Error("Root groups must have a gateway assigned");
    }

    // Map input fields to database columns (CSV fasit: parent_id, ikke parent_group_id)
    const dbPayload = {
      name: group.name,
      kind: group.kind,
      description: group.description,
      parent_id: group.parent_id === "none" ? null : group.parent_id,
      gateway_id: finalGatewayId,
      tenant_id: validatedTenantId, // Bruk validert tenant_id fra brukerens profil
      escalation_enabled: group.escalation_enabled,
      escalation_timeout_minutes: group.escalation_timeout_minutes,
      min_on_duty_count: group.min_on_duty_count
    };

    console.log("Creating group with payload:", dbPayload);
    console.log("User profile:", { tenant_id: userProfile.tenant_id, role: userProfile.role });

    // Vi bruker any-casting her fordi TypeScript-definisjonene henger etter CSV-fasiten
    const { data, error } = await supabase
      .from("groups")
      .insert([dbPayload as any])
      .select()
      .single();

    if (error) {
      console.error("Database error:", error);
      throw error;
    }

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