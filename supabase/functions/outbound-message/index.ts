// SeMSe + FairGateway: Outbound Message Handler
// PROMPT 2: Send messages via FairGateway with delivery tracking

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OutboundPayload {
  message_id: string;
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

    const { message_id } = await req.json();

    if (!message_id) {
      return new Response(
        JSON.stringify({ error: "Missing message_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch message with gateway credentials
    const { data: message, error: messageError } = await supabase
      .from("messages")
      .select(`
        *,
        gateways (
          id,
          provider_name,
          api_key,
          api_endpoint,
          from_number
        )
      `)
      .eq("id", message_id)
      .eq("direction", "out")
      .single();

    if (messageError || !message) {
      return new Response(
        JSON.stringify({ error: "Message not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (message.status !== "queued") {
      return new Response(
        JSON.stringify({ error: "Message already processed", status: message.status }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send via FairGateway
    const gateway = message.gateways;
    const result = await sendViaFairGateway(gateway, message);

    // Update message status
    await supabase
      .from("messages")
      .update({
        status: result.success ? "sent" : "failed",
        external_message_id: result.external_id,
        sent_at: result.success ? new Date().toISOString() : null,
        error_message: result.error,
      })
      .eq("id", message_id);

    // Log delivery event
    if (result.success) {
      await supabase.from("delivery_status_events").insert({
        message_id: message_id,
        status: "sent",
        external_message_id: result.external_id,
        provider_response: result.response,
      });
    }

    return new Response(
      JSON.stringify({
        status: "success",
        message_id: message_id,
        delivery_status: result.success ? "sent" : "failed",
        external_id: result.external_id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Outbound message error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function sendViaFairGateway(
  gateway: any,
  message: any
): Promise<{ success: boolean; external_id?: string; error?: string; response?: any }> {
  try {
    const payload = {
      from: message.from_number,
      to: message.to_number,
      message: message.content,
      media_urls: message.mms_urls || [],
    };

    const response = await fetch(gateway.api_endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${gateway.api_key}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (response.ok) {
      return {
        success: true,
        external_id: data.message_id || data.id,
        response: data,
      };
    } else {
      return {
        success: false,
        error: data.error || "Unknown gateway error",
        response: data,
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}