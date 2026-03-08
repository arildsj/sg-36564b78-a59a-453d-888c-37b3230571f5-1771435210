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
          group_id: target_group_id || gateway.group_id,
          tenant_id: gateway.tenant_id,
        })
        .select()
        .single();

      if (contactError) {
        throw new Error(`Failed to create contact: ${contactError.message}`);
      }
      contact = newContact;
    }

    let threadId = null;
    let resolvedGroupId = target_group_id || contact.group_id;

    if (parent_message_id) {
      const { data: parentMsg } = await supabaseClient
        .from("messages")
        .select("thread_id, group_id")
        .eq("id", parent_message_id)
        .maybeSingle();

      if (parentMsg) {
        threadId = parentMsg.thread_id;
        if (!target_group_id) {
          resolvedGroupId = parentMsg.group_id;
        }
      }
    }

    if (!threadId) {
      const { data: existingThread } = await supabaseClient
        .from("message_threads")
        .select("*")
        .eq("contact_phone", from_number)
        .eq("tenant_id", gateway.tenant_id)
        .eq("is_resolved", false)
        .maybeSingle();

      if (existingThread) {
        threadId = existingThread.id;
        if (!target_group_id) {
          resolvedGroupId = existingThread.resolved_group_id;
        }
      } else {
        if (!target_group_id) {
          resolvedGroupId = contact.group_id || gateway.group_id;

          const { data: rules, error: rulesError } = await supabaseClient
            .from("routing_rules")
            .select("*")
            .eq("is_active", true)
            .order("priority", { ascending: true });

          if (rules && rules.length > 0) {
            for (const rule of rules) {
              let matches = false;

              const conditions = rule.conditions || {};

              if (conditions.keywords && Array.isArray(conditions.keywords)) {
                matches = conditions.keywords.some((kw: string) =>
                  content.toLowerCase().includes(kw.toLowerCase())
                );
              } else if (conditions.phone_numbers && Array.isArray(conditions.phone_numbers)) {
                matches = conditions.phone_numbers.includes(from_number);
              } else if (conditions.start_hour !== undefined || conditions.end_hour !== undefined) {
                const now = new Date();
                const currentHour = now.getHours();
                const currentDay = now.getDay();

                const hourMatch =
                  conditions.start_hour !== undefined &&
                  conditions.end_hour !== undefined &&
                  currentHour >= conditions.start_hour &&
                  currentHour < conditions.end_hour;

                const dayMatch =
                  !conditions.days_of_week ||
                  conditions.days_of_week.length === 0 ||
                  conditions.days_of_week.includes(currentDay);

                matches = hourMatch && dayMatch;
              }

              if (matches) {
                resolvedGroupId = rule.group_id;
                break;
              }
            }
          }
        }

        if (!resolvedGroupId) {
          throw new Error(
            "No target group found - no routing rules matched and no fallback group configured"
          );
        }

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

    return new Response(JSON.stringify({ success: true, message }), {
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