import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

interface OnboardRequest {
  full_name: string;
  email: string;
  phone: string;
  password: string;
  organization_name: string;
}

interface OnboardResponse {
  success: boolean;
  message?: string;
  tenant_id?: string;
  user_id?: string;
  debug?: any;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<OnboardResponse>
) {
  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({ 
      success: false, 
      message: "Method not allowed" 
    });
  }

  // Debug: Check environment variables
  console.log("=== ONBOARD API DEBUG ===");
  console.log("NEXT_PUBLIC_SUPABASE_URL:", process.env.NEXT_PUBLIC_SUPABASE_URL ? "✅ Set" : "❌ Missing");
  console.log("SUPABASE_SERVICE_ROLE_KEY:", process.env.SUPABASE_SERVICE_ROLE_KEY ? "✅ Set (length: " + process.env.SUPABASE_SERVICE_ROLE_KEY.length + ")" : "❌ Missing");
  
  // Verify environment variables exist
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("❌ Missing environment variables!");
    return res.status(500).json({
      success: false,
      message: "Server configuration error: Missing environment variables",
      debug: {
        hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
      }
    });
  }

  try {
    const { full_name, email, phone, password, organization_name }: OnboardRequest = req.body;

    console.log("📝 Request body:", { full_name, email, phone: phone.substring(0, 5) + "***", organization_name });

    // Validate required fields
    if (!full_name || !email || !phone || !password || !organization_name) {
      return res.status(400).json({
        success: false,
        message: "Alle felt må fylles ut"
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Ugyldig e-postadresse"
      });
    }

    // Validate phone format (E.164)
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({
        success: false,
        message: "Telefonnummer må være i E.164-format (f.eks. +4791234567)"
      });
    }

    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Passord må være minst 6 tegn"
      });
    }

    console.log("✅ All validation passed");
    console.log("Creating Supabase Admin Client...");

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

    // STEP 1: Create Supabase Auth user
    console.log("Creating auth user with email:", email);
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name
      }
    });

    // Log detailed error information
    if (authError) {
      console.error("❌ Auth user creation error:");
      console.error("  - Message:", authError.message);
      console.error("  - Status:", authError.status);
      console.error("  - Code:", authError.code);
      console.error("  - Full error:", JSON.stringify(authError, null, 2));
      
      // Check if error is due to duplicate email
      if (authError.message?.includes("already registered") || authError.message?.includes("already exists")) {
        return res.status(409).json({
          success: false,
          message: "E-postadressen er allerede registrert"
        });
      }
      
      // Return detailed error for debugging
      return res.status(500).json({
        success: false,
        message: `Kunne ikke opprette bruker: ${authError.message}`,
        debug: { 
          authError: {
            message: authError.message,
            status: authError.status,
            code: authError.code,
            name: authError.name
          }
        }
      });
    }

    if (!authData.user) {
      console.error("❌ No user returned from createUser");
      return res.status(500).json({
        success: false,
        message: "Kunne ikke opprette bruker (ingen brukerdata returnert)"
      });
    }

    const authUserId = authData.user.id;
    console.log("✅ Auth user created:", authUserId);

    // STEP 2: Create tenant
    console.log("Creating tenant with name:", organization_name);
    const { data: tenantData, error: tenantError } = await supabaseAdmin
      .from("tenants")
      .insert({
        name: organization_name,
        status: "active"
      })
      .select()
      .single();

    if (tenantError) {
      console.error("❌ Tenant creation error:", tenantError);
      
      // Rollback: Delete auth user
      console.log("Rolling back: Deleting auth user...");
      await supabaseAdmin.auth.admin.deleteUser(authUserId);
      
      // Check if error is due to duplicate organization name
      if (tenantError.code === "23505" || tenantError.message?.includes("unique")) {
        return res.status(409).json({
          success: false,
          message: "Organisasjonsnavnet er allerede tatt"
        });
      }
      
      return res.status(500).json({
        success: false,
        message: "Kunne ikke opprette organisasjon",
        debug: { 
          tenantError: {
            message: tenantError.message,
            code: tenantError.code,
            details: tenantError.details
          }
        }
      });
    }

    if (!tenantData) {
      console.error("❌ No tenant data returned");
      await supabaseAdmin.auth.admin.deleteUser(authUserId);
      return res.status(500).json({
        success: false,
        message: "Kunne ikke opprette organisasjon (ingen data returnert)"
      });
    }

    const tenantId = tenantData.id;
    console.log("✅ Tenant created:", tenantId);

    // STEP 3: Create user in users table
    console.log("Creating user profile...");
    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .insert({
        id: authUserId,
        tenant_id: tenantId,
        email,
        name: full_name,
        phone_number: phone,
        role: "tenant_admin",
        status: "active"
      })
      .select()
      .single();

    if (userError) {
      console.error("❌ User creation error:", userError);
      
      // Rollback: Delete tenant and auth user
      console.log("Rolling back: Deleting tenant and auth user...");
      await supabaseAdmin.from("tenants").delete().eq("id", tenantId);
      await supabaseAdmin.auth.admin.deleteUser(authUserId);
      
      return res.status(500).json({
        success: false,
        message: "Kunne ikke opprette brukerprofil",
        debug: { 
          userError: {
            message: userError.message,
            code: userError.code,
            details: userError.details
          }
        }
      });
    }

    if (!userData) {
      console.error("❌ No user data returned");
      await supabaseAdmin.from("tenants").delete().eq("id", tenantId);
      await supabaseAdmin.auth.admin.deleteUser(authUserId);
      return res.status(500).json({
        success: false,
        message: "Kunne ikke opprette brukerprofil (ingen data returnert)"
      });
    }

    console.log("✅ User profile created");
    console.log("=== ONBOARD SUCCESS ===");

    // Success!
    return res.status(201).json({
      success: true,
      message: "Organisasjon og administrator opprettet",
      tenant_id: tenantId,
      user_id: authUserId
    });

  } catch (error: any) {
    console.error("❌ Unexpected error:", error);
    console.error("Stack trace:", error?.stack);
    return res.status(500).json({
      success: false,
      message: "En uventet feil oppstod",
      debug: {
        error: error?.message || "Unknown error",
        name: error?.name,
        stack: error?.stack
      }
    });
  }
}