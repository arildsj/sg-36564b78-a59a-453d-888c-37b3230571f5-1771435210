import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Group = Database["public"]["Tables"]["groups"]["Row"];
type GroupWithMembers = Group & {
  member_count?: number;
  on_duty_count?: number;
  children?: GroupWithMembers[];
};

export const groupService = {
  async getAllGroups(): Promise<GroupWithMembers[]> {
    const { data, error } = await supabase
      .from("groups")
      .select(`
        *,
        group_memberships(count),
        on_duty_status(count)
      `)
      .order("name");

    if (error) throw error;

    return (data || []).map((group: any) => ({
      ...group,
      member_count: group.group_memberships?.[0]?.count || 0,
      on_duty_count: group.on_duty_status?.filter((s: any) => s.is_on_duty)?.length || 0,
    }));
  },

  async getGroupsHierarchy(): Promise<GroupWithMembers[]> {
    const { data, error } = await supabase
      .from("groups")
      .select(`
        *,
        group_memberships(count),
        on_duty_status(count)
      `)
      .order("name");

    if (error) throw error;

    const groups: GroupWithMembers[] = (data || []).map((group: any) => ({
      ...group,
      member_count: group.group_memberships?.[0]?.count || 0,
      on_duty_count: group.on_duty_status?.filter((s: any) => s.is_on_duty)?.length || 0,
      children: [],
    }));

    // Build hierarchy
    const groupMap = new Map<string, GroupWithMembers>();
    const rootGroups: GroupWithMembers[] = [];

    // First pass: create map
    groups.forEach(group => {
      groupMap.set(group.id, group);
    });

    // Second pass: build tree
    groups.forEach(group => {
      if (group.parent_id) {
        const parent = groupMap.get(group.parent_id);
        if (parent) {
          parent.children = parent.children || [];
          parent.children.push(group);
        } else {
          rootGroups.push(group);
        }
      } else {
        rootGroups.push(group);
      }
    });

    return rootGroups;
  },

  async getOperationalGroups(): Promise<Group[]> {
    const { data, error } = await supabase
      .from("groups")
      .select("*")
      .eq("kind", "operational")
      .order("name");

    if (error) throw error;
    return data || [];
  },

  async getGroupById(id: string): Promise<Group | null> {
    const { data, error } = await supabase
      .from("groups")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;
    return data;
  },

  async createGroup(group: Omit<Group, "id" | "created_at" | "updated_at">): Promise<Group> {
    const { data, error } = await supabase
      .from("groups")
      .insert(group)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateGroup(id: string, updates: Partial<Group>): Promise<Group> {
    const { data, error } = await supabase
      .from("groups")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteGroup(id: string): Promise<void> {
    const { error } = await supabase
      .from("groups")
      .delete()
      .eq("id", id);

    if (error) throw error;
  },
};