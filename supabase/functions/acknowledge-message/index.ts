// SeMSe + FairGateway: Message Acknowledgement Handler
// FR31002: Mark messages as acknowledged

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AcknowledgePayload {
  message_id: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload: AcknowledgePayload = await req.json();

    if (!payload.message_id) {
      return new Response(
        JSON.stringify({ error: "Missing message_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // FR31002: Mark message as acknowledged
    const { data: message, error: updateError } = await supabase
      .from("messages")
      .update({
        acknowledged_at: new Date().toISOString(),
        acknowledged_by_user_id: user.id,
      })
      .eq("id", payload.message_id)
      .eq("direction", "inbound")
      .is("acknowledged_at", null) // Only acknowledge once
      .select()
      .single();

    if (updateError || !message) {
      return new Response(
        JSON.stringify({ error: "Failed to acknowledge message or already acknowledged" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log acknowledgement (FR31003 - audit escalation-related events)
    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    await supabaseService.rpc("log_audit_event", {
      p_actor_user_id: user.id,
      p_tenant_id: message.tenant_id,
      p_action_type: "message_acknowledged",
      p_entity_type: "message",
      p_entity_id: message.id,
      p_scope: "group",
      p_scope_id: message.resolved_group_id,
      p_metadata: {
        acknowledged_at: message.acknowledged_at,
        escalation_level_at_ack: message.escalation_level,
      },
    });

    return new Response(
      JSON.stringify({
        status: "success",
        message_id: message.id,
        acknowledged_at: message.acknowledged_at,
        acknowledged_by: user.id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Acknowledgement error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});