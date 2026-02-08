import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase Admin Client (bypasses RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

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

  try {
    const { full_name, email, phone, password, organization_name }: OnboardRequest = req.body;

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

    // Check if email already exists in auth.users
    const { data: userList, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error("Error listing users:", listError);
      // Continue anyway, createUser will fail if duplicate exists
    }

    const users = userList?.users || [];
    const emailExists = users.some(u => u.email === email);
    
    if (emailExists) {
      return res.status(409).json({
        success: false,
        message: "E-postadressen er allerede registrert"
      });
    }

    // Check if organization name already exists
    const { data: existingTenant } = await supabaseAdmin
      .from("tenants")
      .select("id")
      .eq("name", organization_name)
      .single();

    if (existingTenant) {
      return res.status(409).json({
        success: false,
        message: "Organisasjonsnavnet er allerede tatt"
      });
    }

    // STEP 1: Create Supabase Auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email for MVP
      user_metadata: {
        full_name
      }
    });

    if (authError || !authData.user) {
      console.error("Auth user creation error:", authError);
      return res.status(500).json({
        success: false,
        message: "Kunne ikke opprette bruker i autentiseringssystem"
      });
    }

    const authUserId = authData.user.id;

    // STEP 2: Create tenant
    const { data: tenantData, error: tenantError } = await supabaseAdmin
      .from("tenants")
      .insert({
        name: organization_name,
        status: "active"
      })
      .select()
      .single();

    if (tenantError || !tenantData) {
      console.error("Tenant creation error:", tenantError);
      
      // Rollback: Delete auth user
      await supabaseAdmin.auth.admin.deleteUser(authUserId);
      
      return res.status(500).json({
        success: false,
        message: "Kunne ikke opprette organisasjon"
      });
    }

    const tenantId = tenantData.id;

    // STEP 3: Create user in users table
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

    if (userError || !userData) {
      console.error("User creation error:", userError);
      
      // Rollback: Delete tenant and auth user
      await supabaseAdmin.from("tenants").delete().eq("id", tenantId);
      await supabaseAdmin.auth.admin.deleteUser(authUserId);
      
      return res.status(500).json({
        success: false,
        message: "Kunne ikke opprette brukerprofil"
      });
    }

    // Success!
    return res.status(201).json({
      success: true,
      message: "Organisasjon og administrator opprettet",
      tenant_id: tenantId,
      user_id: authUserId
    });

  } catch (error) {
    console.error("Onboarding error:", error);
    return res.status(500).json({
      success: false,
      message: "En uventet feil oppstod"
    });
  }
}