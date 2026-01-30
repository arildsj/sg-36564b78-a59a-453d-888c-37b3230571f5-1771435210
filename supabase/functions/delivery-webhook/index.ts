// SeMSe + FairGateway: Delivery Status Webhook Handler
// PROMPT 2: Track message delivery status from provider

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DeliveryWebhook {
  external_message_id: string;
  status: "sent" | "delivered" | "failed" | "undelivered";
  error_code?: string;
  error_message?: string;
  timestamp: string;
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

    const webhook: DeliveryWebhook = await req.json();

    if (!webhook.external_message_id || !webhook.status) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find message by external ID
    const { data: message } = await supabase
      .from("messages")
      .select("id, status")
      .eq("external_message_id", webhook.external_message_id)
      .single();

    if (!message) {
      console.warn(`Message not found for external_id: ${webhook.external_message_id}`);
      return new Response(
        JSON.stringify({ status: "ignored", reason: "message_not_found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update message status
    await supabase
      .from("messages")
      .update({
        status: webhook.status,
        error_message: webhook.error_message,
        delivered_at: webhook.status === "delivered" ? webhook.timestamp : null,
      })
      .eq("id", message.id);

    // Log delivery event
    await supabase.from("delivery_status_events").insert({
      message_id: message.id,
      status: webhook.status,
      external_message_id: webhook.external_message_id,
      error_code: webhook.error_code,
      provider_response: webhook,
      event_timestamp: webhook.timestamp,
    });

    return new Response(
      JSON.stringify({ status: "success", message_id: message.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Delivery webhook error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});