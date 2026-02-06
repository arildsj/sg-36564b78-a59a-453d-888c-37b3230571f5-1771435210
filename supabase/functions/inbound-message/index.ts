import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Normalize phone to E.164 format or keep alphanumeric sender ID
function normalizeE164(phone: string): string {
  const trimmed = phone.trim();
  const hasLetters = /[a-zA-Z]/.test(trimmed);
  
  if (hasLetters) {
    // Alphanumeric sender (e.g., "DALANEKRAFT")
    // Remove all non-alphanumeric characters and limit to 11 chars
    const cleaned = trimmed.replace(/[^A-Za-z0-9]/g, "");
    return cleaned.substring(0, 11);
  }
  
  // Numeric phone number - normalize to E.164
  let normalized = trimmed.replace(/[^\d+]/g, "");
  if (!normalized.startsWith("+")) {
    normalized = "+" + normalized;
  }
  return normalized;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { from_number, to_number, content, gateway_id, received_at } = await req.json();

    if (!from_number || !to_number || !content || !gateway_id) {
      throw new Error("Missing required fields");
    }

    // Normalize phone numbers
    const normalizedFrom = normalizeE164(from_number);
    const normalizedTo = normalizeE164(to_number);

    console.log("Processing inbound message:", {
      original_from: from_number,
      normalized_from: normalizedFrom,
      original_to: to_number,
      normalized_to: normalizedTo,
      gateway_id,
    });

    // Get gateway info
    const { data: gateway, error: gatewayError } = await supabaseClient
      .from("gateways")
      .select("id, name, phone_number, tenant_id, fallback_group_id")
      .eq("id", gateway_id)
      .single();

    if (gatewayError) throw new Error(`Gateway lookup failed: ${gatewayError.message}`);
    if (!gateway) throw new Error("Gateway not found");

    // Find or create contact
    let contact;
    const { data: existingContact, error: contactLookupError } = await supabaseClient
      .from("contacts")
      .select("id, name, phone_number, group_id, tenant_id")
      .eq("phone_number", normalizedFrom)
      .eq("tenant_id", gateway.tenant_id)
      .maybeSingle();

    if (contactLookupError) {
      throw new Error(`Contact lookup failed: ${contactLookupError.message}`);
    }

    if (existingContact) {
      contact = existingContact;
    } else {
      // Create new contact - use gateway's tenant_id
      const { data: newContact, error: contactError } = await supabaseClient
        .from("contacts")
        .insert({
          phone_number: normalizedFrom,
          name: normalizedFrom,
          tenant_id: gateway.tenant_id,
          group_id: null, // Will be assigned by routing rules or manually
        })
        .select()
        .single();

      if (contactError) throw new Error(`Contact creation failed: ${contactError.message}`);
      contact = newContact;
    }

    // CRITICAL FIX: Check for bulk campaign response FIRST
    const { data: bulkRecipient, error: bulkError } = await supabaseClient
      .from("bulk_recipients")
      .select("id, campaign_id, phone_number, sent_message_id, sent_thread_id")
      .eq("phone_number", normalizedFrom)
      .eq("status", "sent")
      .maybeSingle();

    let resolvedGroupId;
    let thread;
    const messageTimestamp = received_at || new Date().toISOString();

    if (!bulkError && bulkRecipient && bulkRecipient.sent_thread_id) {
      // THIS IS A BULK CAMPAIGN RESPONSE - Use existing thread
      console.log(`Bulk campaign response detected for recipient ${bulkRecipient.id}`);
      
      const { data: existingThread, error: threadError } = await supabaseClient
        .from("message_threads")
        .select("id, contact_phone, gateway_id, resolved_group_id")
        .eq("id", bulkRecipient.sent_thread_id)
        .single();

      if (threadError || !existingThread) {
        throw new Error(`Bulk thread lookup failed: ${threadError?.message}`);
      }

      thread = existingThread;
      resolvedGroupId = thread.resolved_group_id;

      // Update thread's last_message_at
      await supabaseClient
        .from("message_threads")
        .update({ 
          last_message_at: messageTimestamp,
        })
        .eq("id", thread.id);

      // Update bulk recipient status
      await supabaseClient
        .from("bulk_recipients")
        .update({
          status: "replied",
          responded_at: messageTimestamp,
        })
        .eq("id", bulkRecipient.id);

      console.log(`Updated bulk recipient ${bulkRecipient.id} status to replied`);
    } else {
      // REGULAR MESSAGE - Apply routing rules
      resolvedGroupId = contact.group_id || gateway.fallback_group_id;

      // Evaluate routing rules based on gateway
      const { data: rules, error: rulesError } = await supabaseClient
        .from("routing_rules")
        .select("id, priority, rule_type, pattern, target_group_id, gateway_id")
        .eq("tenant_id", gateway.tenant_id)
        .or(`gateway_id.eq.${gateway.id},gateway_id.is.null`)
        .eq("is_active", true)
        .order("priority", { ascending: true });

      if (rulesError) throw new Error(`Routing rules fetch failed: ${rulesError.message}`);

      // Apply routing rules
      if (rules && rules.length > 0) {
        for (const rule of rules) {
          let matches = false;
          const pattern = (rule.pattern || "").toLowerCase();
          const contentLower = content.toLowerCase();

          switch (rule.rule_type) {
            case "keyword":
              matches = contentLower.includes(pattern);
              break;
            case "prefix":
              matches = contentLower.startsWith(pattern);
              break;
            case "fallback":
              matches = true;
              break;
          }

          if (matches) {
            resolvedGroupId = rule.target_group_id;
            console.log(`Matched rule ${rule.id}, routing to group ${resolvedGroupId}`);
            break;
          }
        }
      }

      if (!resolvedGroupId) {
        throw new Error("No target group found - no routing rules matched and no fallback group configured");
      }

      // Find or create thread for regular messages
      const { data: existingThread, error: threadLookupError } = await supabaseClient
        .from("message_threads")
        .select("id, contact_phone, gateway_id, resolved_group_id")
        .eq("tenant_id", gateway.tenant_id)
        .eq("contact_phone", normalizedFrom)
        .eq("gateway_id", gateway.id)
        .maybeSingle();

      if (threadLookupError) {
        throw new Error(`Thread lookup failed: ${threadLookupError.message}`);
      }

      if (existingThread) {
        thread = existingThread;
        
        // Update thread's last_message_at and resolved_group_id if changed
        await supabaseClient
          .from("message_threads")
          .update({ 
            last_message_at: messageTimestamp,
            resolved_group_id: resolvedGroupId,
          })
          .eq("id", thread.id);
      } else {
        // Create new thread
        const { data: newThread, error: threadError } = await supabaseClient
          .from("message_threads")
          .insert({
            tenant_id: gateway.tenant_id,
            gateway_id: gateway.id,
            contact_phone: normalizedFrom,
            resolved_group_id: resolvedGroupId,
            last_message_at: messageTimestamp,
            is_resolved: false,
          })
          .select()
          .single();

        if (threadError) {
          throw new Error(`Thread creation failed: ${threadError.message}`);
        }
        thread = newThread;
      }
    }

    // Create message in the correct thread
    const { data: message, error: messageError } = await supabaseClient
      .from("messages")
      .insert({
        tenant_id: gateway.tenant_id,
        thread_id: thread.id,
        gateway_id: gateway.id,
        group_id: resolvedGroupId,
        direction: "inbound",
        content: content,
        status: "delivered",
        from_number: normalizedFrom,
        to_number: normalizedTo,
        thread_key: `${normalizedFrom}-${gateway.id}`,
        created_at: messageTimestamp,
      })
      .select()
      .single();

    if (messageError) throw new Error(`Message creation failed: ${messageError.message}`);

    return new Response(
      JSON.stringify({
        success: true,
        message_id: message.id,
        thread_id: thread.id,
        contact_phone: normalizedFrom,
        resolved_group_id: resolvedGroupId,
        is_bulk_response: !!bulkRecipient,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error processing inbound message:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Unknown error occurred",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});