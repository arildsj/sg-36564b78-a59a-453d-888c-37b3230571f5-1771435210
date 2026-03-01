import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing Authorization header");
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error("Invalid token or user not authenticated");
    }

    const { data: callerProfile, error: profileError } = await supabaseClient
      .from("user_profiles")
      .select("role, tenant_id")
      .eq("id", user.id)
      .single();

    if (profileError || !callerProfile) {
      throw new Error("Could not verify user profile");
    }

    if (callerProfile.role !== "tenant_admin" && callerProfile.role !== "group_admin") {
      throw new Error("Only administrators can create users");
    }

    const { email, password, full_name, phone_number, role, group_ids } = await req.json();

    if (!email || !password) {
      throw new Error("Email and password are required");
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      phone: phone_number,
      user_metadata: {
        full_name,
        created_by: user.id,
        tenant_id: callerProfile.tenant_id,
      },
    });

    if (authError) {
      console.error("Create user error:", authError);
      throw authError;
    }

    if (!authData.user) {
      throw new Error("User creation failed - no user returned");
    }

    const { error: profileInsertError } = await supabaseAdmin
      .from("user_profiles")
      .insert({
        id: authData.user.id,
        email: email,
        full_name: full_name || null,
        phone_number: phone_number || null,
        role: role || "member",
        tenant_id: callerProfile.tenant_id,
      });

    if (profileInsertError) {
      console.error("Profile insert error:", profileInsertError);
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw new Error(`Failed to create user profile: ${profileInsertError.message}`);
    }

    if (group_ids && Array.isArray(group_ids) && group_ids.length > 0) {
      const memberships = group_ids.map((group_id: string) => ({
        user_id: authData.user.id,
        group_id: group_id,
      }));

      const { error: membershipError } = await supabaseAdmin
        .from("group_memberships")
        .insert(memberships);

      if (membershipError) {
        console.error("Group membership error:", membershipError);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: authData.user,
        message: "User created successfully"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Error in create-user function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});