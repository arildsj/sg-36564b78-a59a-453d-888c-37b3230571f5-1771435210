import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

// Define the type manually since it's not in the generated types yet
type AdminGroupPermission = {
  id: string;
  user_id: string;
  group_id: string;
  tenant_id: string;
  granted_by: string | null;
  created_at: string | null;
  updated_at: string | null;
};

/**
 * Grant admin permission to a user for a specific group
 * Only tenant_admin can grant permissions
 */
export async function grantAdminPermission(
  userId: string,
  groupId: string,
  tenantId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session) {
      return { success: false, error: "Not authenticated" };
    }

    const { error } = await supabase
      .from("admin_group_permissions" as any)
      .insert({
        user_id: userId,
        group_id: groupId,
        tenant_id: tenantId,
        granted_by: session.session.user.id,
      });

    if (error) {
      console.error("Error granting admin permission:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Error granting admin permission:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Revoke admin permission from a user for a specific group
 * Only tenant_admin can revoke permissions
 */
export async function revokeAdminPermission(
  userId: string,
  groupId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from("admin_group_permissions" as any)
      .delete()
      .eq("user_id", userId)
      .eq("group_id", groupId);

    if (error) {
      console.error("Error revoking admin permission:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Error revoking admin permission:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Get all group IDs that a user has admin permissions for
 */
export async function getAdminPermissions(
  userId: string
): Promise<{ groupIds: string[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from("admin_group_permissions" as any)
      .select("group_id")
      .eq("user_id", userId);

    if (error) {
      console.error("Error fetching admin permissions:", error);
      return { groupIds: [], error: error.message };
    }

    // Cast data to any to avoid TS errors with the missing table type
    const permissions = (data || []) as any[];
    const groupIds = permissions.map((p) => p.group_id);
    return { groupIds };
  } catch (error) {
    console.error("Error fetching admin permissions:", error);
    return { groupIds: [], error: String(error) };
  }
}

/**
 * Get all users who have admin permissions for a specific group
 */
export async function getGroupAdmins(
  groupId: string
): Promise<{ admins: Array<Tables<"user_profiles">>; error?: string }> {
  try {
    const { data, error } = await supabase
      .from("admin_group_permissions" as any)
      .select(
        `
        user_id,
        user_profiles!admin_group_permissions_user_id_fkey (
          id,
          email,
          full_name,
          role,
          phone,
          status,
          tenant_id,
          group_id,
          created_at,
          updated_at,
          deleted_at
        )
      `
      )
      .eq("group_id", groupId);

    if (error) {
      console.error("Error fetching group admins:", error);
      return { admins: [], error: error.message };
    }

    const admins = Array.isArray(data)
      ? data
          .map((p: any) => p.user_profiles)
          .filter((profile): profile is Tables<"user_profiles"> => profile !== null)
      : [];

    return { admins };
  } catch (error) {
    console.error("Error fetching group admins:", error);
    return { admins: [], error: String(error) };
  }
}

/**
 * Bulk update admin permissions for a user
 * Removes old permissions and adds new ones
 */
export async function updateAdminPermissions(
  userId: string,
  groupIds: string[],
  tenantId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session) {
      return { success: false, error: "Not authenticated" };
    }

    // First, remove all existing permissions for this user
    const { error: deleteError } = await supabase
      .from("admin_group_permissions" as any)
      .delete()
      .eq("user_id", userId);

    if (deleteError) {
      console.error("Error removing old permissions:", deleteError);
      return { success: false, error: deleteError.message };
    }

    // If no groups selected, we're done
    if (groupIds.length === 0) {
      return { success: true };
    }

    // Insert new permissions
    const permissions = groupIds.map((groupId) => ({
      user_id: userId,
      group_id: groupId,
      tenant_id: tenantId,
      granted_by: session.session.user.id,
    }));

    const { error: insertError } = await supabase
      .from("admin_group_permissions" as any)
      .insert(permissions);

    if (insertError) {
      console.error("Error adding new permissions:", insertError);
      return { success: false, error: insertError.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Error updating admin permissions:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Check if a user has admin permission for a specific group
 */
export async function hasAdminPermission(
  userId: string,
  groupId: string
): Promise<{ hasPermission: boolean; error?: string }> {
  try {
    const { data, error } = await supabase
      .from("admin_group_permissions" as any)
      .select("id")
      .eq("user_id", userId)
      .eq("group_id", groupId)
      .maybeSingle();

    if (error) {
      console.error("Error checking admin permission:", error);
      return { hasPermission: false, error: error.message };
    }

    return { hasPermission: data !== null };
  } catch (error) {
    console.error("Error checking admin permission:", error);
    return { hasPermission: false, error: String(error) };
  }
}

export const adminPermissionService = {
  grantAdminPermission,
  revokeAdminPermission,
  getAdminPermissions,
  getGroupAdmins,
  updateAdminPermissions,
  hasAdminPermission,
};