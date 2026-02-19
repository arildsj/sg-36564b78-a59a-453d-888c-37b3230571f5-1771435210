import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Tables = Database["public"]["Tables"];
type UserProfile = Tables["user_profiles"]["Row"];
type Group = Tables["groups"]["Row"];

/**
 * Permission Service - Handles all authorization logic at application level
 * This replaces complex RLS policies to avoid recursion and improve performance
 */

// ============================================================================
// USER & TENANT HELPERS
// ============================================================================

/**
 * Get current user's profile with tenant info
 */
export async function getCurrentUserProfile(): Promise<UserProfile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Error fetching user profile:", error);
    return null;
  }

  return data;
}

/**
 * Get user's tenant ID
 */
export async function getUserTenantId(): Promise<string | null> {
  const profile = await getCurrentUserProfile();
  return profile?.tenant_id || null;
}

/**
 * Check if user belongs to specific tenant
 */
export async function isUserInTenant(tenantId: string): Promise<boolean> {
  const userTenantId = await getUserTenantId();
  return userTenantId === tenantId;
}

// ============================================================================
// GROUP MEMBERSHIP HELPERS
// ============================================================================

/**
 * Get all group IDs that user is a member of
 */
export async function getUserGroupIds(): Promise<string[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("group_memberships")
    .select("group_id")
    .eq("user_id", user.id);

  if (error) {
    console.error("Error fetching user groups:", error);
    return [];
  }

  return data.map((membership: any) => membership.group_id);
}

/**
 * Check if user is member of specific group
 */
export async function isUserInGroup(groupId: string): Promise<boolean> {
  const groupIds = await getUserGroupIds();
  return groupIds.includes(groupId);
}

/**
 * Check if user is member of any of the specified groups
 */
export async function isUserInAnyGroup(groupIds: string[]): Promise<boolean> {
  const userGroupIds = await getUserGroupIds();
  return groupIds.some(id => userGroupIds.includes(id));
}

// ============================================================================
// ROLE-BASED PERMISSIONS
// ============================================================================

/**
 * Check if user has specific role
 */
export async function userHasRole(role: string): Promise<boolean> {
  const profile = await getCurrentUserProfile();
  return profile?.role === role;
}

/**
 * Check if user is admin
 */
export async function isUserAdmin(): Promise<boolean> {
  return userHasRole("admin");
}

/**
 * Check if user is supervisor
 */
export async function isUserSupervisor(): Promise<boolean> {
  return userHasRole("supervisor");
}

/**
 * Check if user is operator
 */
export async function isUserOperator(): Promise<boolean> {
  return userHasRole("operator");
}

// ============================================================================
// MESSAGE PERMISSIONS
// ============================================================================

/**
 * Check if user can view a message
 * Rules:
 * - Admin: can view all messages in their tenant
 * - Supervisor: can view all messages in their groups
 * - Operator: can view messages in their groups
 */
export async function canUserViewMessage(messageId: string): Promise<boolean> {
  const profile = await getCurrentUserProfile();
  if (!profile) return false;

  // Get message details
  const { data: message, error } = await supabase
    .from("messages")
    .select("tenant_id, resolved_group_id")
    .eq("id", messageId)
    .maybeSingle();

  if (error || !message) return false;

  // Check tenant isolation
  if (message.tenant_id !== profile.tenant_id) return false;

  // Admin can view all in tenant
  if (profile.role === "admin") return true;

  // Check group membership
  if (message.resolved_group_id) {
    return await isUserInGroup(message.resolved_group_id);
  }

  return false;
}

/**
 * Check if user can send messages from a group
 */
export async function canUserSendFromGroup(groupId: string): Promise<boolean> {
  const profile = await getCurrentUserProfile();
  if (!profile) return false;

  // Get group details
  const { data: group, error } = await supabase
    .from("groups")
    .select("tenant_id")
    .eq("id", groupId)
    .maybeSingle();

  if (error || !group) return false;

  // Check tenant isolation
  if (group.tenant_id !== profile.tenant_id) return false;

  // Check group membership
  return await isUserInGroup(groupId);
}

/**
 * Check if user can update message status
 */
export async function canUserUpdateMessage(messageId: string): Promise<boolean> {
  // For now, same rules as viewing
  // Can be extended later for more granular control
  return await canUserViewMessage(messageId);
}

// ============================================================================
// CONTACT PERMISSIONS
// ============================================================================

/**
 * Check if user can view a contact
 */
export async function canUserViewContact(contactId: string): Promise<boolean> {
  const profile = await getCurrentUserProfile();
  if (!profile) return false;

  const { data: contact, error } = await supabase
    .from("whitelisted_numbers")
    .select("tenant_id")
    .eq("id", contactId)
    .maybeSingle();

  if (error || !contact) return false;

  return contact.tenant_id === profile.tenant_id;
}

/**
 * Check if user can manage contacts (create, update, delete)
 */
export async function canUserManageContacts(): Promise<boolean> {
  const profile = await getCurrentUserProfile();
  if (!profile) return false;

  // Only admin and supervisor can manage contacts
  return profile.role === "admin" || profile.role === "supervisor";
}

// ============================================================================
// GROUP PERMISSIONS
// ============================================================================

/**
 * Check if user can view a group
 */
export async function canUserViewGroup(groupId: string): Promise<boolean> {
  const profile = await getCurrentUserProfile();
  if (!profile) return false;

  const { data: group, error } = await supabase
    .from("groups")
    .select("tenant_id")
    .eq("id", groupId)
    .maybeSingle();

  if (error || !group) return false;

  return group.tenant_id === profile.tenant_id;
}

/**
 * Check if user can manage groups (create, update, delete)
 */
export async function canUserManageGroups(): Promise<boolean> {
  const profile = await getCurrentUserProfile();
  if (!profile) return false;

  // Only admin can manage groups
  return profile.role === "admin";
}

// ============================================================================
// ADMIN PERMISSIONS
// ============================================================================

/**
 * Check if user can manage routing rules
 */
export async function canUserManageRoutingRules(): Promise<boolean> {
  return await isUserAdmin();
}

/**
 * Check if user can manage gateways
 */
export async function canUserManageGateways(): Promise<boolean> {
  return await isUserAdmin();
}

/**
 * Check if user can view audit logs
 */
export async function canUserViewAuditLogs(): Promise<boolean> {
  return await isUserAdmin();
}

// ============================================================================
// BULK CAMPAIGN PERMISSIONS
// ============================================================================

/**
 * Check if user can create bulk campaigns
 */
export async function canUserCreateBulkCampaign(): Promise<boolean> {
  const profile = await getCurrentUserProfile();
  if (!profile) return false;

  // Admin and supervisor can create campaigns
  return profile.role === "admin" || profile.role === "supervisor";
}

/**
 * Check if user can view a bulk campaign
 */
export async function canUserViewBulkCampaign(campaignId: string): Promise<boolean> {
  const profile = await getCurrentUserProfile();
  if (!profile) return false;

  const { data: campaign, error } = await supabase
    .from("bulk_campaigns")
    .select("tenant_id, created_by_user_id")
    .eq("id", campaignId)
    .maybeSingle();

  if (error || !campaign) return false;

  // Check tenant isolation
  if (campaign.tenant_id !== profile.tenant_id) return false;

  // Admin can view all campaigns in tenant
  if (profile.role === "admin") return true;

  // Others can only view their own campaigns
  return campaign.created_by_user_id === profile.id;
}

// ============================================================================
// QUERY HELPERS WITH TENANT ISOLATION
// ============================================================================

/**
 * Get base query with tenant isolation applied
 * Use this as starting point for all queries that need tenant filtering
 */
export async function getMessagesQuery() {
  const tenantId = await getUserTenantId();
  if (!tenantId) throw new Error("User has no tenant");

  return supabase
    .from("messages")
    .select("*")
    .eq("tenant_id", tenantId);
}

export async function getContactsQuery() {
  const tenantId = await getUserTenantId();
  if (!tenantId) throw new Error("User has no tenant");

  return supabase
    .from("whitelisted_numbers")
    .select("*")
    .eq("tenant_id", tenantId);
}

export async function getGroupsQuery() {
  const tenantId = await getUserTenantId();
  if (!tenantId) throw new Error("User has no tenant");

  return supabase
    .from("groups")
    .select("*")
    .eq("tenant_id", tenantId);
}

export async function getBulkCampaignsQuery() {
  const tenantId = await getUserTenantId();
  if (!tenantId) throw new Error("User has no tenant");

  return supabase
    .from("bulk_campaigns")
    .select("*")
    .eq("tenant_id", tenantId);
}