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
      .select("id, name, phone_number, tenant_id")
      .eq("id", gateway_id)
      .single();

    if (gatewayError) throw new Error(`Gateway lookup failed: ${gatewayError.message}`);
    if (!gateway) throw new Error("Gateway not found");

    // Find or create contact
    let contact;
    const { data: existingContact, error: contactLookupError } = await supabaseClient
      .from("contacts")
      .select("id, full_name, phone_number, group_id, tenant_id")
      .eq("phone_number", normalizedFrom)
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
          full_name: normalizedFrom,
          tenant_id: gateway.tenant_id,
          group_id: null, // Will be assigned by routing rules or manually
        })
        .select()
        .single();

      if (contactError) throw new Error(`Contact creation failed: ${contactError.message}`);
      contact = newContact;
    }

    // Find or create thread
    let thread;
    const { data: existingThread, error: threadLookupError } = await supabaseClient
      .from("message_threads")
      .select("id, contact_id, gateway_id, contact_phone, gateway_phone")
      .eq("contact_phone", normalizedFrom)
      .eq("gateway_phone", normalizedTo)
      .maybeSingle();

    if (threadLookupError) {
      throw new Error(`Thread lookup failed: ${threadLookupError.message}`);
    }

    if (existingThread) {
      thread = existingThread;
    } else {
      // Create new thread
      const { data: newThread, error: threadError } = await supabaseClient
        .from("message_threads")
        .insert({
          contact_id: contact.id,
          gateway_id: gateway.id,
          contact_phone: normalizedFrom,
          gateway_phone: normalizedTo,
          last_message_at: received_at || new Date().toISOString(),
        })
        .select()
        .single();

      if (threadError) {
        throw new Error(`Thread creation failed: ${threadError.message}`);
      }
      thread = newThread;
    }

    // Evaluate routing rules - use contact's group_id if available, otherwise gateway's tenant_id
    const groupIdForRouting = contact.group_id || gateway.tenant_id;
    
    const { data: rules, error: rulesError } = await supabaseClient
      .from("routing_rules")
      .select("id, priority, match_type, match_pattern, assigned_user_id")
      .eq("group_id", groupIdForRouting)
      .eq("is_active", true)
      .order("priority", { ascending: true });

    if (rulesError) throw new Error(`Routing rules fetch failed: ${rulesError.message}`);

    let assignedUserId = null;
    if (rules && rules.length > 0) {
      for (const rule of rules) {
        let matches = false;
        const pattern = rule.match_pattern.toLowerCase();
        const contentLower = content.toLowerCase();

        switch (rule.match_type) {
          case "contains":
            matches = contentLower.includes(pattern);
            break;
          case "starts_with":
            matches = contentLower.startsWith(pattern);
            break;
          case "ends_with":
            matches = contentLower.endsWith(pattern);
            break;
          case "regex":
            try {
              const regex = new RegExp(pattern, "i");
              matches = regex.test(content);
            } catch {
              console.error(`Invalid regex pattern: ${pattern}`);
            }
            break;
          case "exact":
            matches = contentLower === pattern;
            break;
        }

        if (matches) {
          assignedUserId = rule.assigned_user_id;
          console.log(`Matched rule ${rule.id}, assigning to user ${assignedUserId}`);
          break;
        }
      }
    }

    // Create message
    const { data: message, error: messageError } = await supabaseClient
      .from("messages")
      .insert({
        thread_id: thread.id,
        contact_id: contact.id,
        gateway_id: gateway.id,
        direction: "inbound",
        content: content,
        status: "received",
        from_number: normalizedFrom,
        to_number: normalizedTo,
        received_at: received_at || new Date().toISOString(),
        assigned_user_id: assignedUserId,
      })
      .select()
      .single();

    if (messageError) throw new Error(`Message creation failed: ${messageError.message}`);

    // Update thread's last_message_at
    await supabaseClient
      .from("message_threads")
      .update({ last_message_at: message.received_at })
      .eq("id", thread.id);

    // Check for bulk campaign response
    const { data: bulkRecipient, error: bulkError } = await supabaseClient
      .from("bulk_recipients")
      .select("id, campaign_id, phone_number")
      .eq("phone_number", normalizedFrom)
      .eq("status", "sent")
      .maybeSingle();

    if (!bulkError && bulkRecipient) {
      // Update bulk recipient status
      await supabaseClient
        .from("bulk_recipients")
        .update({
          status: "responded",
          response_message_id: message.id,
          responded_at: message.received_at,
        })
        .eq("id", bulkRecipient.id);

      console.log(`Updated bulk recipient ${bulkRecipient.id} status to responded`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message_id: message.id,
        thread_id: thread.id,
        contact_id: contact.id,
        assigned_user_id: assignedUserId,
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