import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Group = Database["public"]["Tables"]["groups"]["Row"];
type GroupInsert = Database["public"]["Tables"]["groups"]["Insert"];
type GroupUpdate = Database["public"]["Tables"]["groups"]["Update"];

type GroupWithMembers = Group & {
  member_count?: number;
  on_duty_count?: number;
  children?: GroupWithMembers[];
};

export const groupService = {
  async getAllGroups(): Promise<GroupWithMembers[]> {
    // Simplified query without complex aggregations
    const { data, error } = await supabase
      .from("groups")
      .select("*")
      .order("name");

    console.log("getAllGroups result:", { data, error });

    if (error) {
      console.error("Error fetching groups:", error);
      throw error;
    }

    // Get member counts separately if needed
    return (data || []).map((group: any) => ({
      ...group,
      member_count: 0, // Will be calculated separately if needed
      on_duty_count: 0,
    }));
  },

  async getGroupsHierarchy(): Promise<GroupWithMembers[]> {
    // First, get all groups with basic info
    const { data, error } = await supabase
      .from("groups")
      .select("*")
      .order("name");

    console.log("getGroupsHierarchy raw data:", { data, error });

    if (error) {
      console.error("Error fetching groups for hierarchy:", error);
      throw error;
    }

    if (!data || data.length === 0) {
      console.warn("No groups found in database");
      return [];
    }

    const groups: GroupWithMembers[] = (data || []).map((group: any) => ({
      ...group,
      member_count: 0,
      on_duty_count: 0,
      children: [],
    }));

    console.log("Groups before hierarchy build:", groups);

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
          // Parent not found, treat as root
          rootGroups.push(group);
        }
      } else {
        // No parent, this is a root group
        rootGroups.push(group);
      }
    });

    console.log("Root groups after hierarchy:", rootGroups);

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

  async createGroup(group: GroupInsert): Promise<Group> {
    const { data, error } = await supabase
      .from("groups")
      .insert(group)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateGroup(id: string, updates: GroupUpdate): Promise<Group> {
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