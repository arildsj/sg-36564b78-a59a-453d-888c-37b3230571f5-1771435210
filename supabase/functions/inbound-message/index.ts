import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const {
      from_number,
      to_number,
      content,
      gateway_id,
      received_at,
      campaign_id,
      parent_message_id,
      target_group_id,
    } = await req.json();

    if (!from_number || !to_number || !content || !gateway_id) {
      throw new Error("Missing required fields");
    }

    console.log("Processing inbound message:", {
      from_number,
      to_number,
      content,
      gateway_id,
      target_group_id,
      campaign_id,
    });

    const { data: gateway, error: gatewayError } = await supabaseClient
      .from("sms_gateways")
      .select("*")
      .eq("id", gateway_id)
      .single();

    if (gatewayError || !gateway) {
      throw new Error(`Gateway not found: ${gateway_id}`);
    }

    // sms_gateways has no group_id — look up the first group linked to this gateway as fallback
    const { data: gatewayGroup } = await supabaseClient
      .from("groups")
      .select("id")
      .eq("gateway_id", gateway_id)
      .order("name", { ascending: true })
      .limit(1)
      .maybeSingle();

    const gatewayFallbackGroupId = gatewayGroup?.id ?? null;

    let contact = null;
    const { data: existingContact } = await supabaseClient
      .from("contacts")
      .select("*")
      .eq("phone", from_number)
      .maybeSingle();

    if (existingContact) {
      contact = existingContact;
    } else {
      const { data: newContact, error: contactError } = await supabaseClient
        .from("contacts")
        .insert({
          phone: from_number,
          name: from_number,
          group_id: target_group_id || gatewayFallbackGroupId,
          tenant_id: gateway.tenant_id,
        })
        .select()
        .single();

      if (contactError) {
        throw new Error(`Failed to create contact: ${contactError.message}`);
      }
      contact = newContact;
    }

    // ── Routing rule resolution ─────────────────────────────────────────────
    async function resolveGroupByRules(
      client: any,
      tenantId: string,
      fromNumber: string,
      msgContent: string,
      contactGroupId: string | null,
      fallbackGroupId: string | null
    ): Promise<string | null> {
      const { data: rules } = await client
        .from("routing_rules")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .order("priority", { ascending: true });

      if (rules && rules.length > 0) {
        for (const rule of rules) {
          let matches = false;
          if (rule.match_type === "sender" && rule.match_value)
            matches = rule.match_value.trim().toLowerCase() === fromNumber.trim().toLowerCase();
          else if (rule.match_type === "keyword" && rule.match_value)
            matches = msgContent.toLowerCase().includes(rule.match_value.trim().toLowerCase());
          else if (rule.match_type === "prefix" && rule.match_value)
            matches = msgContent.toLowerCase().startsWith(rule.match_value.trim().toLowerCase());
          else if (rule.match_type === "fallback")
            matches = true;
          if (matches) return rule.target_group_id;
        }
      }
      return contactGroupId || fallbackGroupId;
    }

    let threadId = null;
    let resolvedGroupId: string | null = null;

    if (parent_message_id) {
      const { data: parentMsg } = await supabaseClient
        .from("messages")
        .select("thread_id, group_id")
        .eq("id", parent_message_id)
        .maybeSingle();

      if (parentMsg) {
        threadId = parentMsg.thread_id;
        resolvedGroupId = target_group_id || parentMsg.group_id;
      }
    }

    // Routing rules always win — resolve group before any thread lookup
    if (!threadId) {
      resolvedGroupId = target_group_id ?? await resolveGroupByRules(
        supabaseClient, gateway.tenant_id, from_number, content,
        contact.group_id, gatewayFallbackGroupId
      );

      if (!resolvedGroupId) {
        throw new Error(
          "No target group found - no routing rules matched and no fallback group configured"
        );
      }

      // Find existing open thread scoped to the resolved group
      const { data: existingThread } = await supabaseClient
        .from("message_threads")
        .select("id")
        .eq("contact_phone", from_number)
        .eq("tenant_id", gateway.tenant_id)
        .eq("resolved_group_id", resolvedGroupId)
        .eq("is_resolved", false)
        .order("last_message_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingThread) {
        threadId = existingThread.id;
      } else {
        const { data: newThread, error: threadError } = await supabaseClient
          .from("message_threads")
          .insert({
            contact_phone: from_number,
            resolved_group_id: resolvedGroupId,
            gateway_id: gateway_id,
            tenant_id: gateway.tenant_id,
            last_message_at: received_at || new Date().toISOString(),
          })
          .select()
          .single();

        if (threadError) {
          throw new Error(`Failed to create thread: ${threadError.message}`);
        }
        threadId = newThread.id;
      }
    }

    const { data: message, error: messageError } = await supabaseClient
      .from("messages")
      .insert({
        thread_id: threadId,
        contact_id: contact.id,
        direction: "inbound",
        content: content,
        status: "received",
        gateway_id,
        group_id: resolvedGroupId,
        from_number,
        to_number,
        tenant_id: gateway.tenant_id,
        thread_key: `${from_number}-${gateway_id}`,
        campaign_id: campaign_id || null,
        parent_message_id: parent_message_id || null,
      })
      .select()
      .single();

    if (messageError) {
      throw new Error(`Failed to create message: ${messageError.message}`);
    }

    await supabaseClient
      .from("message_threads")
      .update({
        last_message_at: message.created_at,
      })
      .eq("id", threadId);

    return new Response(JSON.stringify({
      success: true,
      message,
      is_bulk_response: !!(campaign_id && parent_message_id),
      is_fallback: !target_group_id && resolvedGroupId === gatewayFallbackGroupId,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error processing inbound message:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});