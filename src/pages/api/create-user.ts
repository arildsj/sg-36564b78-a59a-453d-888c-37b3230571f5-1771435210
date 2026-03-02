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
    const { email, password, full_name, phone, role, tenant_id, group_ids } = req.body;

    // Validate required fields
    if (!email || !password || !full_name || !phone || !role || !tenant_id) {
      return res.status(400).json({ error: "Missing required fields" });
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

    // STEP 1: Create auth user
    console.log("Creating auth user...");
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

    // STEP 2: Create user profile
    console.log("Creating user profile...");
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from("user_profiles")
      .insert({
        id: userId,
        email,
        full_name,
        phone,
        role: role || "member",
        tenant_id,
        status: true
      })
      .select()
      .single();

    if (profileError) {
      console.error("❌ Profile creation error:", profileError);
      
      // Rollback: Delete auth user
      console.log("Rolling back: Deleting auth user...");
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

    // STEP 3: Add user to groups if group_ids provided
    if (group_ids && Array.isArray(group_ids) && group_ids.length > 0) {
      console.log("Adding user to groups:", group_ids);
      
      const memberships = group_ids.map((group_id: string) => ({
        user_id: userId,
        group_id,
        is_admin: false
      }));

      const { error: membershipError } = await supabaseAdmin
        .from("group_memberships")
        .insert(memberships);

      if (membershipError) {
        console.error("❌ Membership creation error:", membershipError);
        // Don't rollback - user is created, just log the error
        console.warn("User created but failed to add to groups");
      } else {
        console.log("✅ User added to groups");
      }
    }

    console.log("=== CREATE USER SUCCESS ===");

    // Success!
    return res.status(201).json({
      success: true,
      message: "User created successfully",
      user: {
        id: userId,
        email,
        full_name
      }
    });

  } catch (error: any) {
    console.error("❌ Unexpected error:", error);
    return res.status(500).json({
      error: error.message || "Internal server error",
    });
  }
}