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
    // Parse request body first
    const { email, password, phone } = await req.json();

    if (!email || !password) {
      throw new Error("Email and password are required");
    }

    // Create Supabase client with the user's JWT to verify they are authenticated
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // Verify the caller is authenticated
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      throw new Error("Not authenticated");
    }

    // Verify the caller is a tenant_admin by checking users table
    const { data: callerProfile, error: profileError } = await supabaseClient
      .from("users")
      .select("role, tenant_id")
      .eq("auth_user_id", user.id)
      .single();

    if (profileError || !callerProfile) {
      throw new Error("Could not verify user profile");
    }

    if (callerProfile.role !== "tenant_admin") {
      throw new Error("Only tenant administrators can create users");
    }

    // Create Supabase Admin client to manage auth users
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm for manually created users
      phone,
      user_metadata: {
        created_by_tenant_admin: user.id,
        tenant_id: callerProfile.tenant_id,
      }
    });

    if (authError) throw authError;

    // Return the created user data
    return new Response(JSON.stringify(authData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error in create-user:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});