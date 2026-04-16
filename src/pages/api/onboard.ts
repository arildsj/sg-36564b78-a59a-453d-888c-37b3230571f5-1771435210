import type { NextApiRequest, NextApiResponse } from "next";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

interface OnboardRequest {
  user_id: string;
  full_name: string;
  email: string;
  phone: string;
  organization_name: string;
}

interface OnboardResponse {
  success: boolean;
  message?: string;
  tenant_id?: string;
  user_id?: string;
  debug?: any;
}

const WELCOME_MESSAGE =
  "Velkommen til SeMSe! Din organisasjon er registrert og du har fått en gratis simuleringslisens i 30 dager. Svar INFO for informasjon, STOPP for å melde deg av.";

/**
 * Send a welcome SMS via the "Fair Teknologi Main" gateway and log it in the
 * messages table so it appears in that gateway's inbox.
 *
 * Failures are logged but never propagate — a broken welcome SMS must never
 * block successful account creation.
 */
async function sendWelcomeSms(
  admin: SupabaseClient,
  phone: string,
  newTenantId: string,
  newUserId: string
): Promise<void> {
  const GATEWAY_NAME = "Fair Teknologi Main";

  // 1. Resolve gateway by name at runtime — never hardcode the UUID
  const { data: gateway, error: gatewayError } = await admin
    .from("sms_gateways")
    .select("id, gw_phone, tenant_id")
    .eq("name", GATEWAY_NAME)
    .eq("is_active", true)
    .maybeSingle();

  if (gatewayError || !gateway) {
    console.error(`[welcome-sms] Gateway "${GATEWAY_NAME}" not found:`, gatewayError?.message ?? "no row");
    return;
  }

  const now = new Date().toISOString();

  // 2. Find or create the thread for this phone number inside the gateway's tenant
  const { data: existingThread } = await admin
    .from("message_threads")
    .select("id")
    .eq("contact_phone", phone)
    .eq("tenant_id", gateway.tenant_id)
    .eq("is_resolved", false)
    .maybeSingle();

  let threadId: string;

  if (existingThread) {
    threadId = existingThread.id;
    await admin
      .from("message_threads")
      .update({ gateway_id: gateway.id, last_message_at: now, updated_at: now })
      .eq("id", threadId);
  } else {
    const { data: newThread, error: threadError } = await admin
      .from("message_threads")
      .insert({
        contact_phone: phone,
        tenant_id: gateway.tenant_id,
        gateway_id: gateway.id,
        last_message_at: now,
      })
      .select("id")
      .single();

    if (threadError || !newThread) {
      console.error("[welcome-sms] Failed to create thread:", threadError?.message);
      return;
    }
    threadId = newThread.id;
  }

  // 3. Log the outbound message — tenant_id = gateway owner so it shows in their inbox
  const { error: msgError } = await admin
    .from("messages")
    .insert({
      direction: "outbound",
      from_number: gateway.gw_phone,
      to_number: phone,
      content: WELCOME_MESSAGE,
      status: "sent",
      gateway_id: gateway.id,
      tenant_id: gateway.tenant_id,
      thread_id: threadId,
      thread_key: phone,
      metadata: {
        welcome_sms: true,
        onboarding_tenant_id: newTenantId,
        onboarding_user_id: newUserId,
      },
    });

  if (msgError) {
    console.error("[welcome-sms] Failed to insert message:", msgError.message);
    return;
  }

  // 4. Keep thread last_message_at fresh (best-effort)
  await admin
    .from("message_threads")
    .update({ last_message_at: now })
    .eq("id", threadId);

  console.log(`[welcome-sms] ✅ Sent to ${phone.substring(0, 6)}***`);
}

/**
 * Generate URL-safe slug from organization name
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
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
    const { user_id, full_name, email, phone, organization_name }: OnboardRequest = req.body;

    console.log("📝 Request body:", { user_id, full_name, email, phone: phone.substring(0, 5) + "***", organization_name });

    // Validate required fields
    if (!user_id || !full_name || !email || !phone || !organization_name) {
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

    // Auth user already exists, use the provided user_id
    console.log("Using existing auth user:", user_id);

    // STEP 1: Create tenant
    console.log("Creating tenant with name:", organization_name);
    const tenantSlug = generateSlug(organization_name);
    console.log("Generated slug:", tenantSlug);
    
    const { data: tenantData, error: tenantError } = await supabaseAdmin
      .from("tenants")
      .insert({
        name: organization_name,
        slug: tenantSlug,
        status: "active"
      })
      .select()
      .single();

    if (tenantError) {
      console.error("❌ Tenant creation error:", tenantError);
      
      // Rollback: Delete auth user
      console.log("Rolling back: Deleting auth user...");
      await supabaseAdmin.auth.admin.deleteUser(user_id);
      
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
      await supabaseAdmin.auth.admin.deleteUser(user_id);
      return res.status(500).json({
        success: false,
        message: "Kunne ikke opprette organisasjon (ingen data returnert)"
      });
    }

    const tenantId = tenantData.id;
    console.log("✅ Tenant created:", tenantId);

    // STEP 2: Create user in users table (use user_profiles now)
    console.log("Creating user profile...");
    const { data: userData, error: userError } = await supabaseAdmin
      .from("user_profiles")
      .insert({
        id: user_id,
        tenant_id: tenantId,
        email,
        full_name: full_name,
        phone: phone,
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
      await supabaseAdmin.auth.admin.deleteUser(user_id);
      
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
      await supabaseAdmin.auth.admin.deleteUser(user_id);
      return res.status(500).json({
        success: false,
        message: "Kunne ikke opprette brukerprofil (ingen data returnert)"
      });
    }

    console.log("✅ User profile created");

    // STEP 3: Send welcome SMS — fire-and-forget; never blocks success response
    try {
      await sendWelcomeSms(supabaseAdmin, phone, tenantId, user_id);
    } catch (smsErr: any) {
      console.error("[welcome-sms] Unexpected error (ignored):", smsErr?.message);
    }

    console.log("=== ONBOARD SUCCESS ===");

    // Success!
    return res.status(201).json({
      success: true,
      message: "Organisasjon og administrator opprettet",
      tenant_id: tenantId,
      user_id: user_id
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