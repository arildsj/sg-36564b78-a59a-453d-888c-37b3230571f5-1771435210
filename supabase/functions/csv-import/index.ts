// SeMSe + FairGateway: CSV Import Handler
// PROMPT 2: Validate and import users, whitelisted numbers, and links

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ImportRequest {
  tenant_id: string;
  import_type: "users" | "whitelisted_numbers" | "whitelist_group_links";
  csv_data: string; // Base64 encoded CSV
  created_by_user_id: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const payload: ImportRequest = await req.json();

    if (!payload.tenant_id || !payload.import_type || !payload.csv_data) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create import job
    const { data: importJob, error: jobError } = await supabase
      .from("import_jobs")
      .insert({
        tenant_id: payload.tenant_id,
        import_type: payload.import_type,
        status: "processing",
        created_by: payload.created_by_user_id,
      })
      .select()
      .single();

    if (jobError) {
      return new Response(
        JSON.stringify({ error: "Failed to create import job" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Decode and parse CSV
    const csvContent = atob(payload.csv_data);
    const rows = parseCSV(csvContent);

    if (rows.length === 0) {
      await supabase
        .from("import_jobs")
        .update({ status: "failed", error_message: "Empty CSV file" })
        .eq("id", importJob.id);

      return new Response(
        JSON.stringify({ error: "Empty CSV file" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate entire file before applying
    const validationResult = await validateImport(supabase, payload.import_type, rows, payload.tenant_id);

    if (!validationResult.valid) {
      await supabase
        .from("import_jobs")
        .update({
          status: "failed",
          error_message: validationResult.errors.join("; "),
          rows_processed: 0,
          rows_failed: rows.length,
        })
        .eq("id", importJob.id);

      return new Response(
        JSON.stringify({ error: "Validation failed", details: validationResult.errors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Process import
    const result = await processImport(supabase, payload.import_type, rows, payload.tenant_id);

    // Update import job
    await supabase
      .from("import_jobs")
      .update({
        status: result.failed === 0 ? "completed" : "partially_failed",
        rows_processed: result.success,
        rows_failed: result.failed,
        completed_at: new Date().toISOString(),
      })
      .eq("id", importJob.id);

    return new Response(
      JSON.stringify({
        status: "success",
        import_job_id: importJob.id,
        total: rows.length,
        success: result.success,
        failed: result.failed,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("CSV import error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function parseCSV(content: string): any[] {
  const lines = content.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim());
    const row: any = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || "";
    });
    rows.push(row);
  }

  return rows;
}

async function validateImport(
  supabase: any,
  importType: string,
  rows: any[],
  tenantId: string
): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const lineNum = i + 2; // CSV line number (header is 1)

    switch (importType) {
      case "users":
        if (!row.email || !isValidEmail(row.email)) {
          errors.push(`Line ${lineNum}: Invalid email`);
        }
        if (!row.full_name) {
          errors.push(`Line ${lineNum}: Missing full_name`);
        }
        if (row.role && !["tenant_admin", "group_admin", "member"].includes(row.role)) {
          errors.push(`Line ${lineNum}: Invalid role`);
        }
        break;

      case "whitelisted_numbers":
        if (!row.phone_number || !isValidE164(row.phone_number)) {
          errors.push(`Line ${lineNum}: Invalid phone_number (must be E.164)`);
        }
        break;

      case "whitelist_group_links":
        if (!row.phone_number) {
          errors.push(`Line ${lineNum}: Missing phone_number`);
        }
        if (!row.group_name && !row.group_id) {
          errors.push(`Line ${lineNum}: Missing group_name or group_id`);
        }
        break;
    }

    if (errors.length > 10) {
      errors.push("... and more errors");
      break;
    }
  }

  return { valid: errors.length === 0, errors };
}

async function processImport(
  supabase: any,
  importType: string,
  rows: any[],
  tenantId: string
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      switch (importType) {
        case "users":
          await importUser(supabase, row, tenantId);
          break;

        case "whitelisted_numbers":
          await importWhitelistedNumber(supabase, row, tenantId);
          break;

        case "whitelist_group_links":
          await importWhitelistGroupLink(supabase, row, tenantId);
          break;
      }
      success++;
    } catch (error) {
      console.error(`Failed to import row:`, error);
      failed++;
    }
  }

  return { success, failed };
}

async function importUser(supabase: any, row: any, tenantId: string): Promise<void> {
  // Create auth user first
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: row.email,
    email_confirm: true,
    user_metadata: {
      full_name: row.full_name,
    },
  });

  if (authError) throw authError;

  // Create user profile
  await supabase.from("user_profiles").insert({
    id: authUser.user.id,
    tenant_id: tenantId,
    email: row.email,
    full_name: row.full_name,
    role: row.role || "member",
    is_active: true,
  });
}

async function importWhitelistedNumber(supabase: any, row: any, tenantId: string): Promise<void> {
  // Check if contact exists
  let contactId = null;

  if (row.contact_name || row.contact_email) {
    const { data: existingContact } = await supabase
      .from("contacts")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("email", row.contact_email)
      .single();

    if (existingContact) {
      contactId = existingContact.id;
    } else {
      const { data: newContact } = await supabase
        .from("contacts")
        .insert({
          tenant_id: tenantId,
          full_name: row.contact_name,
          email: row.contact_email,
        })
        .select()
        .single();

      contactId = newContact.id;
    }
  }

  // Insert whitelisted number (idempotent)
  await supabase
    .from("whitelisted_numbers")
    .upsert(
      {
        tenant_id: tenantId,
        phone_number: row.phone_number,
        contact_id: contactId,
        notes: row.notes,
      },
      { onConflict: "tenant_id,phone_number" }
    );
}

async function importWhitelistGroupLink(supabase: any, row: any, tenantId: string): Promise<void> {
  // Resolve group
  const { data: group } = await supabase
    .from("groups")
    .select("id")
    .eq("tenant_id", tenantId)
    .or(`name.eq.${row.group_name},id.eq.${row.group_id}`)
    .single();

  if (!group) throw new Error(`Group not found: ${row.group_name || row.group_id}`);

  // Resolve whitelisted number
  const { data: whitelistedNumber } = await supabase
    .from("whitelisted_numbers")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("phone_number", row.phone_number)
    .single();

  if (!whitelistedNumber) throw new Error(`Whitelisted number not found: ${row.phone_number}`);

  // Create link (idempotent)
  await supabase
    .from("whitelisted_number_group_links")
    .upsert(
      {
        whitelisted_number_id: whitelistedNumber.id,
        group_id: group.id,
      },
      { onConflict: "whitelisted_number_id,group_id" }
    );
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidE164(phone: string): boolean {
  return /^\+[1-9]\d{1,14}$/.test(phone);
}