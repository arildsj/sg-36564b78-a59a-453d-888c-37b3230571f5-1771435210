import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ImportRequest {
  import_type: "users" | "whitelisted_numbers" | "whitelist_group_links" | "contacts";
  csv_data: string;
  group_id?: string;
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

    if (!payload.import_type || !payload.csv_data) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get authenticated user from JWT token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user's tenant_id from user_profiles
    const { data: userProfile, error: profileError } = await supabase
      .from("user_profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (profileError || !userProfile) {
      return new Response(
        JSON.stringify({ error: "User profile not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tenant_id = userProfile.tenant_id;
    const created_by_user_id = user.id;

    const { data: importJob, error: jobError } = await supabase
      .from("csv_import_jobs")
      .insert({
        tenant_id: tenant_id,
        import_type: payload.import_type,
        status: "processing",
        created_by_user_id: created_by_user_id,
      })
      .select()
      .single();

    if (jobError) {
      return new Response(
        JSON.stringify({ error: "Failed to create import job" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const csvContent = atob(payload.csv_data);
    const rows = parseCSV(csvContent);

    if (rows.length === 0) {
      await supabase
        .from("csv_import_jobs")
        .update({ status: "failed", error_message: "Empty CSV file" })
        .eq("id", importJob.id);

      return new Response(
        JSON.stringify({ error: "Empty CSV file" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validationResult = await validateImport(supabase, payload.import_type, rows, tenant_id);

    if (!validationResult.valid) {
      await supabase
        .from("csv_import_jobs")
        .update({
          status: "failed",
          error_message: validationResult.errors.join("; "),
          processed_rows: 0,
          error_count: rows.length,
        })
        .eq("id", importJob.id);

      return new Response(
        JSON.stringify({ error: "Validation failed", details: validationResult.errors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let result;
    if (payload.import_type === "contacts") {
      result = await batchImportContacts(supabase, rows, tenant_id, payload.group_id);
    } else {
      result = await processImport(supabase, payload.import_type, rows, tenant_id);
    }

    await supabase
      .from("csv_import_jobs")
      .update({
        status: result.failed === 0 ? "completed" : "partially_failed",
        processed_rows: result.success,
        success_count: result.success,
        error_count: result.failed,
        total_rows: rows.length,
        updated_at: new Date().toISOString(),
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
  const crlfPattern = String.fromCharCode(13) + String.fromCharCode(10);
  const crPattern = String.fromCharCode(13);
  const lfPattern = String.fromCharCode(10);
  
  let normalized = content.split(crlfPattern).join(lfPattern);
  normalized = normalized.split(crPattern).join(lfPattern);
  const lines = normalized.split(lfPattern).filter(line => line.trim());
  
  if (lines.length < 2) return [];

  const headerLine = lines[0];
  const delimiter = headerLine.includes(";") ? ";" : ",";

  const headers = headerLine.split(delimiter).map((h) => h.trim().replace(/^"|"$/g, ""));
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(delimiter).map((v) => v.trim().replace(/^"|"$/g, ""));
    const row: any = {};
    headers.forEach((header, index) => {
      row[header.toLowerCase()] = values[index] || "";
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
    const lineNum = i + 2;

    switch (importType) {
      case "contacts":
        const name = row.navn || row.name || row.full_name;
        if (!name) {
          errors.push(`Line ${lineNum}: Missing Name`);
        }
        
        const relation = row.relasjon || row.relation || row.type;
        const relatedTo = row.tilhorer || row.related_to || row.subject;
        
        if (relation && !relatedTo) {
           errors.push(`Line ${lineNum}: Relation specified but missing related field`);
        }
        break;

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
          errors.push(`Line ${lineNum}: Invalid phone_number`);
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
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: row.email,
    email_confirm: true,
    user_metadata: {
      full_name: row.full_name,
    },
  });

  if (authError) throw authError;

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
  const { data: group } = await supabase
    .from("groups")
    .select("id")
    .eq("tenant_id", tenantId)
    .or(`name.eq.${row.group_name},id.eq.${row.group_id}`)
    .single();

  if (!group) throw new Error(`Group not found: ${row.group_name || row.group_id}`);

  const { data: whitelistedNumber } = await supabase
    .from("whitelisted_numbers")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("phone_number", row.phone_number)
    .single();

  if (!whitelistedNumber) throw new Error(`Whitelisted number not found: ${row.phone_number}`);

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

async function batchImportContacts(
  supabase: any,
  rows: any[],
  tenantId: string,
  targetGroupId?: string
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;
  
  const contacts = rows.map(row => ({
    name: row.navn || row.name || row.full_name,
    phone: row.tlf || row.telefon || row.phone || row.mobile || row.mobil,
    email: row.epost || row.email || row.mail,
    group: row.gruppe || row.klasse || row.group || row.class,
    relation: row.relasjon || row.relation || row.type,
    relatedTo: row.tilhorer || row.related_to || row.subject || row.belongs_to,
    externalId: row.ekstern_id || row.external_id || row.id,
    row_data: row
  })).filter(c => c.name);

  const groupNames = [...new Set(contacts.map(c => c.group).filter(Boolean))];
  const groupMap = new Map<string, string>();
  
  if (groupNames.length > 0) {
    const { data: groups } = await supabase
      .from("groups")
      .select("id, name")
      .eq("tenant_id", tenantId)
      .in("name", groupNames);
      
    groups?.forEach((g: any) => groupMap.set(g.name, g.id));
  }

  for (const contact of contacts) {
    try {
      let groupId = contact.group ? groupMap.get(contact.group) : targetGroupId;
      
      const contactData = {
        tenant_id: tenantId,
        name: contact.name,
        phone_number: contact.phone || null,
        email: contact.email || null,
        group_id: groupId || null,
        external_id: contact.externalId || null,
        metadata: { imported: true }
      };

      if (contact.externalId) {
        const { data } = await supabase.from("contacts").select("id").eq("tenant_id", tenantId).eq("external_id", contact.externalId).single();
        if (data) {
             await supabase.from("contacts").update(contactData).eq("id", data.id);
        } else {
             await supabase.from("contacts").insert(contactData);
        }
      } else if (contact.phone) {
        await supabase.from("contacts").upsert(contactData, { onConflict: "tenant_id, phone_number" });
      } else {
        let query = supabase.from("contacts").select("id").eq("tenant_id", tenantId).eq("name", contact.name);
        if (groupId) query = query.eq("group_id", groupId);
        
        const { data } = await query.maybeSingle();
        if (data) {
           await supabase.from("contacts").update(contactData).eq("id", data.id);
        } else {
           await supabase.from("contacts").insert(contactData);
        }
      }
      success++;
    } catch (e) {
      console.error("Error importing contact:", e);
      failed++;
    }
  }

  const relationRows = contacts.filter(c => c.relation && c.relatedTo);
  
  for (const row of relationRows) {
    try {
      const { data: subject } = await supabase
        .from("contacts")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("name", row.relatedTo)
        .limit(1)
        .maybeSingle();
        
      if (!subject) {
        console.warn(`Could not find subject for relation`);
        continue;
      }

      let relatedQuery = supabase.from("contacts").select("id").eq("tenant_id", tenantId);
      if (row.phone) relatedQuery = relatedQuery.eq("phone_number", row.phone);
      else relatedQuery = relatedQuery.eq("name", row.name);
      
      const { data: related } = await relatedQuery.limit(1).maybeSingle();

      if (!related) {
         continue; 
      }
      
      await supabase.from("contact_relationships").upsert({
        tenant_id: tenantId,
        subject_contact_id: subject.id,
        related_contact_id: related.id,
        relationship_type: row.relation
      }, { onConflict: "subject_contact_id, related_contact_id" });
      
    } catch (e) {
      console.error("Error creating relationship:", e);
    }
  }

  return { success, failed };
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidE164(phone: string): boolean {
  return /^\+[1-9]\d{1,14}$/.test(phone);
}