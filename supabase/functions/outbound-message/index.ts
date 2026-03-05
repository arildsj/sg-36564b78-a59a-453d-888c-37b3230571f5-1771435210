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

    const { data: message, error: messageError } = await supabase
      .from("messages")
      .select(`
        *,
        sms_gateways (
          id,
          name,
          api_key,
          base_url,
          gw_phone
        )
      `)
      .eq("id", message_id)
      .eq("direction", "outbound")
      .single();

    if (messageError || !message) {
      return new Response(
        JSON.stringify({ error: "Message not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (message.status !== "pending") {
      return new Response(
        JSON.stringify({ error: "Message already processed", status: message.status }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const gateway = message.sms_gateways;
    const result = await sendViaGateway(gateway, message);

    await supabase
      .from("messages")
      .update({
        status: result.success ? "sent" : "failed",
        external_id: result.external_id,
        error_message: result.error,
      })
      .eq("id", message_id);

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

async function sendViaGateway(
  gateway: any,
  message: any
): Promise<{ success: boolean; external_id?: string; error?: string; response?: any }> {
  try {
    const payload = {
      from: message.from_number,
      to: message.to_number,
      message: message.content,
    };

    const response = await fetch(gateway.base_url || "https://api.example.com/send", {
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