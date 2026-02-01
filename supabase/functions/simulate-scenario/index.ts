// SeMSe + FairGateway: Simulation Mode Handler
// PROMPT 2: Execute demo scenarios respecting RLS

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SimulationRequest {
  scenario_id: string;
  user_id: string;
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

    const { scenario_id, user_id } = await req.json();

    if (!scenario_id || !user_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch scenario
    const { data: scenario, error: scenarioError } = await supabase
      .from("simulation_scenarios")
      .select("*")
      .eq("id", scenario_id)
      .single();

    if (scenarioError || !scenario) {
      return new Response(
        JSON.stringify({ error: "Scenario not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user has access (RLS check)
    const { data: userProfile } = await supabase
      .from("user_profiles")
      .select("tenant_id, role")
      .eq("id", user_id)
      .single();

    if (!userProfile || userProfile.tenant_id !== scenario.tenant_id) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Execute scenario events
    const events = scenario.simulation_config?.events || [];
    const results = [];

    for (const event of events) {
      try {
        const result = await executeSimulationEvent(supabase, scenario.tenant_id, event);
        results.push(result);

        // Log simulation event
        await supabase.from("simulation_events").insert({
          scenario_id: scenario_id,
          event_type: event.type,
          event_data: event,
          result_data: result,
        });
      } catch (error) {
        console.error(`Simulation event failed:`, error);
        results.push({ error: error.message });
      }
    }

    return new Response(
      JSON.stringify({
        status: "success",
        scenario_id: scenario_id,
        events_executed: results.length,
        results: results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Simulation error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function executeSimulationEvent(supabase: any, tenantId: string, event: any): Promise<any> {
  switch (event.type) {
    case "inbound_message":
      return await simulateInboundMessage(supabase, tenantId, event);

    case "outbound_message":
      return await simulateOutboundMessage(supabase, tenantId, event);

    case "routing_test":
      return await simulateRoutingTest(supabase, tenantId, event);

    case "auto_reply_test":
      return await simulateAutoReplyTest(supabase, tenantId, event);

    default:
      throw new Error(`Unknown event type: ${event.type}`);
  }
}

async function simulateInboundMessage(supabase: any, tenantId: string, event: any): Promise<any> {
  // Get first active gateway
  const { data: gateway } = await supabase
    .from("gateways")
    .select("id, from_number")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .limit(1)
    .single();

  if (!gateway) {
    throw new Error("No active gateway for simulation");
  }

  // Call inbound-message function
  const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/inbound-message`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
    },
    body: JSON.stringify({
      gateway_id: gateway.id,
      from_number: event.from_number,
      to_number: gateway.from_number,
      content: event.content,
      external_message_id: `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      received_at: new Date().toISOString(),
    }),
  });

  return await response.json();
}

async function simulateOutboundMessage(supabase: any, tenantId: string, event: any): Promise<any> {
  const { data: gateway } = await supabase
    .from("gateways")
    .select("id, from_number")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .limit(1)
    .single();

  if (!gateway) {
    throw new Error("No active gateway for simulation");
  }

  // Create message
  const { data: message } = await supabase
    .from("messages")
    .insert({
      tenant_id: tenantId,
      gateway_id: gateway.id,
      direction: "outbound", // Changed from "out" to "outbound" to match enum
      from_number: gateway.from_number,
      to_number: event.to_number,
      content: event.content,
      status: "queued",
      group_id: event.group_id, // Changed from resolved_group_id to group_id
    })
    .select()
    .single();

  return { message_id: message.id, status: "queued" };
}

async function simulateRoutingTest(supabase: any, tenantId: string, event: any): Promise<any> {
  // Test routing without actually creating message
  const { data: whitelistMatches } = await supabase
    .from("whitelisted_numbers")
    .select(`
      id,
      whitelisted_number_group_links (
        group_id,
        groups (name, group_kind)
      )
    `)
    .eq("tenant_id", tenantId)
    .eq("phone_number", event.from_number);

  const { data: routingRules } = await supabase
    .from("routing_rules")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("priority", { ascending: false });

  return {
    whitelist_matches: whitelistMatches,
    applicable_rules: routingRules,
    expected_group: event.expected_group_id,
  };
}

async function simulateAutoReplyTest(supabase: any, tenantId: string, event: any): Promise<any> {
  const { data: autoReplies } = await supabase
    .from("auto_replies")
    .select("*")
    .eq("group_id", event.group_id)
    .eq("is_active", true)
    .order("priority", { ascending: false });

  const matchingReplies = autoReplies?.filter((ar) => {
    if (ar.trigger_type === "keyword") {
      return ar.trigger_keywords.some((kw: string) =>
        event.content.toLowerCase().includes(kw.toLowerCase())
      );
    }
    return true;
  });

  return {
    total_auto_replies: autoReplies?.length || 0,
    matching_replies: matchingReplies?.length || 0,
    would_trigger: matchingReplies?.[0] || null,
  };
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}