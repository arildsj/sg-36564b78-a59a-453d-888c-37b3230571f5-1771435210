import { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      email,
      password,
      full_name,
      phone,
      role,
      tenant_id,
      group_ids,
      admin_group_ids, // NEW: Admin permissions for group_admin role
      granted_by, // NEW: ID of the admin creating the user
    } = req.body;

    // Validate required fields
    if (!email || !password || !full_name || !phone || !role || !tenant_id) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Validate group membership - all users must belong to at least one group
    if (!group_ids || !Array.isArray(group_ids) || group_ids.length === 0) {
      return res.status(400).json({ 
        error: "Group membership required",
        details: "All users must be assigned to at least one group"
      });
    }

    // NEW: Validate admin_group_ids if role is group_admin
    if (role === "group_admin" && (!Array.isArray(admin_group_ids) || admin_group_ids.length === 0)) {
      return res.status(400).json({ 
        error: "Group admins must have at least one group to administrate",
        details: "admin_group_ids array is required for group_admin role"
      });
    }

    // Verify environment variables exist
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("❌ Missing environment variables!");
      return res.status(500).json({
        error: "Server configuration error: Missing environment variables",
      });
    }

    // Initialize Supabase Admin Client
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    console.log("✅ Supabase Admin Client created");
    console.log("📝 Request data:", { email, full_name, phone, role, tenant_id, group_ids });

    // VALIDATION: Verify groups exist and belong to tenant
    console.log("🔍 Validating groups...");
    const { data: groupsData, error: groupsError } = await supabaseAdmin
      .from("groups")
      .select("id, name, tenant_id")
      .in("id", group_ids);

    if (groupsError) {
      console.error("❌ Group validation error:", groupsError);
      return res.status(400).json({
        error: "Failed to validate groups",
        details: groupsError.message
      });
    }

    if (!groupsData || groupsData.length !== group_ids.length) {
      console.error("❌ Some groups don't exist:", { 
        requested: group_ids, 
        found: groupsData?.map(g => g.id) 
      });
      return res.status(400).json({
        error: "Invalid group IDs",
        details: "One or more group IDs do not exist"
      });
    }

    // Verify all groups belong to the same tenant
    const invalidTenantGroups = groupsData.filter(g => g.tenant_id !== tenant_id);
    if (invalidTenantGroups.length > 0) {
      console.error("❌ Groups belong to wrong tenant:", invalidTenantGroups);
      return res.status(400).json({
        error: "Invalid groups for tenant",
        details: "One or more groups do not belong to the specified tenant"
      });
    }

    console.log("✅ Groups validated:", groupsData.map(g => g.name).join(", "));

    // STEP 1: Create auth user
    console.log("🔐 Creating auth user...");
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, phone }
    });

    if (authError) {
      console.error("❌ Auth creation error:", authError);
      return res.status(400).json({
        error: "Failed to create auth user",
        details: authError.message
      });
    }

    if (!authData.user) {
      console.error("❌ No auth user data returned");
      return res.status(500).json({
        error: "Failed to create auth user (no data returned)"
      });
    }

    const userId = authData.user.id;
    console.log("✅ Auth user created:", userId);

    // STEP 2: Create user profile (FASIT: use 'phone', not 'phone')
    console.log("👤 Creating user profile...");
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from("user_profiles")
      .insert({
        id: userId,
        email,
        full_name,
        phone: phone,  // FASIT: 'phone' (not 'phone')
        role: role || "member",
        tenant_id,
        status: "active",
        group_id: group_ids[0]  // FASIT: Primary group in user_profiles
      })
      .select()
      .single();

    if (profileError) {
      console.error("❌ Profile creation error:", profileError);
      
      // Rollback: Delete auth user
      console.log("🔄 Rolling back: Deleting auth user...");
      await supabaseAdmin.auth.admin.deleteUser(userId);
      
      return res.status(500).json({
        error: "Failed to create user profile",
        details: profileError.message
      });
    }

    if (!profileData) {
      console.error("❌ No profile data returned");
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return res.status(500).json({
        error: "Failed to create user profile (no data returned)"
      });
    }

    console.log("✅ User profile created");

    // STEP 3: Add user to groups (CRITICAL - MUST SUCCEED)
    console.log("👥 Adding user to groups:", groupsData.map(g => g.name).join(", "));
    
    const memberships = group_ids.map((group_id: string) => ({
      user_id: userId,
      group_id,
      tenant_id
    }));

    const { data: membershipData, error: membershipError } = await supabaseAdmin
      .from("group_memberships")
      .insert(memberships)
      .select();

    if (membershipError) {
      throw new Error(`Failed to add user to groups: ${membershipError.message}`);
    }

    // NEW: Create admin permissions if role is group_admin
    if (role === "group_admin" && admin_group_ids && admin_group_ids.length > 0) {
      const adminPermissions = admin_group_ids.map((group_id: string) => ({
        user_id: userId,
        group_id,
        tenant_id,
        granted_by: granted_by || null, // Use passed ID or null
      }));

      const { error: permissionError } = await supabaseAdmin
        .from("admin_group_permissions")
        .insert(adminPermissions);

      if (permissionError) {
        throw new Error(`Failed to grant admin permissions: ${permissionError.message}`);
      }
    }

    if (!membershipData || membershipData.length !== group_ids.length) {
      console.error("❌ Incorrect number of memberships created");
      console.error("Expected:", group_ids.length, "Created:", membershipData?.length || 0);
      
      // ROLLBACK
      console.log("🔄 Rolling back: Deleting profile and auth user...");
      await supabaseAdmin.from("user_profiles").delete().eq("id", userId);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      
      return res.status(500).json({
        error: "Failed to create all group memberships",
        details: `Expected ${group_ids.length} memberships, created ${membershipData?.length || 0}`,
        rollback: "User creation rolled back completely"
      });
    }

    console.log("✅ User added to groups successfully");
    console.log("✅ Memberships created:", membershipData.length);

    console.log("=== CREATE USER SUCCESS ===");

    // Success!
    return res.status(201).json({
      success: true,
      message: "User created successfully",
      user: {
        id: userId,
        email,
        full_name,
        groups: groupsData.map(g => g.name)
      }
    });

  } catch (error: any) {
    console.error("❌ Unexpected error:", error);
    return res.status(500).json({
      error: error.message || "Internal server error",
    });
  }
}