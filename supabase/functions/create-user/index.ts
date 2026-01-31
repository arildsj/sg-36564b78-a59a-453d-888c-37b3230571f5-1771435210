import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    // Get the authorization header from the request
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      throw new Error("Missing Authorization header");
    }

    // Create a Supabase client with the user's JWT to verify authentication
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Verify the user is authenticated
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      console.error("Auth error:", userError);
      throw new Error("Invalid token or user not authenticated");
    }

    // Verify the caller is a tenant_admin
    const { data: callerProfile, error: profileError } = await supabaseClient
      .from("users")
      .select("role, tenant_id")
      .eq("auth_user_id", user.id)
      .single();

    if (profileError || !callerProfile) {
      console.error("Profile error:", profileError);
      throw new Error("Could not verify user profile");
    }

    if (callerProfile.role !== "tenant_admin") {
      throw new Error("Only tenant administrators can create users");
    }

    // Parse request body
    const { email, password, phone } = await req.json();

    if (!email || !password) {
      throw new Error("Email and password are required");
    }

    // Create Supabase Admin client to manage auth users (requires service role key)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Create the new user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm the user
      phone,
      user_metadata: {
        created_by_tenant_admin: user.id,
        tenant_id: callerProfile.tenant_id,
      },
    });

    if (authError) {
      console.error("Create user error:", authError);
      throw authError;
    }

    // Return the created user data
    return new Response(JSON.stringify(authData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error in create-user function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});