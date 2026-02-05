import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface ImportRequest {
  import_type: "users" | "whitelisted_numbers" | "whitelist_group_links" | "contacts";
  csv_data: string;
  group_id?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" } });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
    }

    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("auth_user_id", user.id)
      .single();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: "User profile not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
    }

    const tenant_id = profile.tenant_id;
    const created_by_user_id = user.id;

    const payload: ImportRequest = await req.json();
    const csvContent = atob(payload.csv_data);
    const rows = parseCSV(csvContent);

    if (rows.length === 0) {
      return new Response(JSON.stringify({ error: "No valid rows found in CSV" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    const { data: importJob, error: jobError } = await supabase
      .from("csv_import_jobs")
      .insert({
        tenant_id: tenant_id,
        import_type: payload.import_type === "contacts" ? "whitelisted_numbers" : payload.import_type,
        status: "pending",
        created_by_user_id: created_by_user_id,
      })
      .select()
      .single();

    if (jobError) {
      console.error("Failed to create import job:", jobError);
      return new Response(JSON.stringify({ error: "Failed to create import job" }), { status: 500, headers: { "Content-Type": "application/json" } });
    }

    const validationResult = await validateImport(supabase, payload.import_type, rows, tenant_id);
    if (!validationResult.valid) {
      await supabase.from("csv_import_jobs").update({ status: "failed", completed_at: new Date().toISOString() }).eq("id", importJob.id);
      return new Response(JSON.stringify({ error: "Validation failed", details: validationResult.errors }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    let result;
    if (payload.import_type === "contacts") {
      result = await processContactsImport(supabase, rows, tenant_id, payload.group_id);
    } else {
      result = await processImport(supabase, payload.import_type, rows, tenant_id);
    }

    await supabase.from("csv_import_jobs").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", importJob.id);

    return new Response(JSON.stringify({ success: true, imported: result.imported, failed: result.failed, job_id: importJob.id }), { status: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
  } catch (error: any) {
    console.error("Import error:", error);
    return new Response(JSON.stringify({ error: error.message || "Import failed" }), { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
  }
});

function parseCSV(content: string): any[] {
  const normalized = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n").filter(line => line.trim());
  
  if (lines.length < 2) return [];

  const separator = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(separator).map(h => h.trim().toLowerCase());
  
  return lines.slice(1).map(line => {
    const values = line.split(separator);
    const row: any = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx]?.trim() || null;
    });
    return row;
  }).filter(row => Object.values(row).some(v => v));
}

async function validateImport(supabase: any, type: string, rows: any[], tenant_id: string) {
  const errors: string[] = [];
  
  for (let idx = 0; idx < rows.length; idx++) {
    const row = rows[idx];
    if (type === "contacts" || type === "whitelisted_numbers") {
      const phone = row.tlf || row.phone_number || row.telefon;
      if (!phone) {
        errors.push(`Row ${idx + 2}: Missing phone number`);
      } else if (!isValidE164(phone)) {
        errors.push(`Row ${idx + 2}: Invalid phone format (must be E.164, e.g., +4712345678)`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

async function processImport(supabase: any, type: string, rows: any[], tenant_id: string) {
  let imported = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      if (type === "users") {
        await supabase.from("users").insert({ ...row, tenant_id });
        imported++;
      } else if (type === "whitelisted_numbers") {
        const phone = row.tlf || row.phone_number || row.telefon;
        await supabase.from("whitelisted_numbers").insert({ phone_number: phone, description: row.navn || row.name, tenant_id });
        imported++;
      }
    } catch (error) {
      console.error("Row import failed:", error);
      failed++;
    }
  }

  return { imported, failed };
}

async function processContactsImport(supabase: any, rows: any[], tenant_id: string, default_group_id?: string) {
  let imported = 0;
  let failed = 0;
  const groupCache = new Map<string, string>();

  for (const row of rows) {
    try {
      const phone = row.tlf || row.phone_number || row.telefon;
      const name = row.navn || row.name;
      const groupName = row.gruppe || row.group;

      if (!phone) {
        failed++;
        continue;
      }

      const { data: existing } = await supabase
        .from("whitelisted_numbers")
        .select("id")
        .eq("phone_number", phone)
        .eq("tenant_id", tenant_id)
        .single();

      let contactId: string;

      if (existing) {
        contactId = existing.id;
        await supabase
          .from("whitelisted_numbers")
          .update({ description: name })
          .eq("id", contactId);
      } else {
        const { data: newContact, error: insertError } = await supabase
          .from("whitelisted_numbers")
          .insert({ phone_number: phone, description: name, tenant_id })
          .select()
          .single();

        if (insertError) throw insertError;
        contactId = newContact.id;
      }

      let groupId = default_group_id;

      if (groupName && !groupId) {
        if (groupCache.has(groupName)) {
          groupId = groupCache.get(groupName);
        } else {
          const { data: existingGroup } = await supabase
            .from("groups")
            .select("id")
            .eq("name", groupName)
            .eq("tenant_id", tenant_id)
            .single();

          if (existingGroup) {
            groupId = existingGroup.id;
          } else {
            const { data: newGroup } = await supabase
              .from("groups")
              .insert({ name: groupName, tenant_id, kind: "operational" })
              .select()
              .single();

            if (newGroup) groupId = newGroup.id;
          }

          if (groupId) groupCache.set(groupName, groupId);
        }
      }

      if (groupId) {
        const { data: existingLink } = await supabase
          .from("whitelist_group_links")
          .select("id")
          .eq("whitelisted_number_id", contactId)
          .eq("group_id", groupId)
          .single();

        if (!existingLink) {
          await supabase
            .from("whitelist_group_links")
            .insert({ whitelisted_number_id: contactId, group_id: groupId });
        }
      }

      imported++;
    } catch (error) {
      console.error("Contact import failed:", error);
      failed++;
    }
  }

  return { imported, failed };
}

function isValidE164(phone: string): boolean {
  const pattern = /^\+[1-9]\d{1,14}$/;
  return pattern.test(phone);
}