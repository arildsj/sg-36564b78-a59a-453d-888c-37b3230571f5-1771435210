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
    });

    const { data: gateway, error: gatewayError } = await supabaseClient
      .from("gateways")
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
          group_id: target_group_id || gateway.fallback_group_id,
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
        .select("thread_id, target_group_id")
        .eq("id", parent_message_id)
        .maybeSingle();

      if (parentMsg) {
        threadId = parentMsg.thread_id;
        if (!target_group_id) {
          resolvedGroupId = parentMsg.target_group_id;
        }
      }
    }

    if (!threadId) {
      const { data: existingThread } = await supabaseClient
        .from("messages")
        .select("thread_id, target_group_id")
        .eq("contact_id", contact.id)
        .eq("direction", "outbound")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingThread) {
        threadId = existingThread.thread_id;
        if (!target_group_id) {
          resolvedGroupId = existingThread.target_group_id;
        }
      } else {
        if (!target_group_id) {
          resolvedGroupId = contact.group_id || gateway.fallback_group_id;

          const { data: routingRules } = await supabaseClient
            .from("routing_rules")
            .select("*")
            .eq("is_active", true)
            .order("priority", { ascending: true });

          if (routingRules && routingRules.length > 0) {
            for (const rule of routingRules) {
              let matches = false;

              if (rule.rule_type === "keyword") {
                const keywords = rule.conditions?.keywords || [];
                matches = keywords.some((kw: string) =>
                  content.toLowerCase().includes(kw.toLowerCase())
                );
              } else if (rule.rule_type === "sender") {
                const numbers = rule.conditions?.phone_numbers || [];
                matches = numbers.includes(from_number);
              } else if (rule.rule_type === "time") {
                const now = new Date();
                const currentHour = now.getHours();
                const currentDay = now.getDay();
                const { start_hour, end_hour, days_of_week } =
                  rule.conditions || {};

                const hourMatch =
                  start_hour !== undefined &&
                  end_hour !== undefined &&
                  currentHour >= start_hour &&
                  currentHour < end_hour;

                const dayMatch =
                  !days_of_week ||
                  days_of_week.length === 0 ||
                  days_of_week.includes(currentDay);

                matches = hourMatch && dayMatch;
              }

              if (matches) {
                resolvedGroupId = rule.target_group_id;
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
          .from("threads")
          .insert({
            contact_id: contact.id,
            target_group_id: resolvedGroupId,
            status: "open",
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
        content,
        status: "received",
        gateway_id,
        target_group_id: resolvedGroupId,
        from_number,
        to_number,
        received_at: received_at || new Date().toISOString(),
        campaign_id: campaign_id || null,
        parent_message_id: parent_message_id || null,
      })
      .select()
      .single();

    if (messageError) {
      throw new Error(`Failed to create message: ${messageError.message}`);
    }

    await supabaseClient
      .from("threads")
      .update({
        last_message_at: message.received_at || message.created_at,
        status: "open",
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