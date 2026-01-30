// SeMSe + FairGateway: Message Escalation Handler
// FR31001-FR31003: Escalate unacknowledged messages

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // FR31001: Find unacknowledged inbound messages past escalation timeout
    const { data: groupsWithEscalation } = await supabase
      .from("groups")
      .select("id, tenant_id, escalation_timeout_minutes, name")
      .eq("escalation_enabled", true)
      .is("deleted_at", null);

    if (!groupsWithEscalation || groupsWithEscalation.length === 0) {
      return new Response(
        JSON.stringify({ status: "no_escalation_groups" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let totalEscalated = 0;

    for (const group of groupsWithEscalation) {
      const timeoutThreshold = new Date(
        Date.now() - group.escalation_timeout_minutes * 60000
      ).toISOString();

      // FR31002: Find messages that are unacknowledged
      const { data: unacknowledgedMessages } = await supabase
        .from("messages")
        .select("id, tenant_id, resolved_group_id, from_number, content, created_at, escalation_level")
        .eq("resolved_group_id", group.id)
        .eq("direction", "inbound")
        .is("acknowledged_at", null)
        .is("deleted_at", null)
        .lt("created_at", timeoutThreshold)
        .order("created_at", { ascending: true });

      if (!unacknowledgedMessages || unacknowledgedMessages.length === 0) {
        continue;
      }

      for (const message of unacknowledgedMessages) {
        await escalateMessage(supabase, message, group);
        totalEscalated++;
      }
    }

    return new Response(
      JSON.stringify({
        status: "success",
        escalated_count: totalEscalated,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Escalation processing error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function escalateMessage(supabase: any, message: any, group: any): Promise<void> {
  const newEscalationLevel = message.escalation_level + 1;

  // Determine escalation target based on level
  let escalatedToUserIds: string[] = [];
  let escalatedToGroupId: string | null = null;

  if (newEscalationLevel === 1) {
    // Level 1: Escalate to all group members (not just on-duty)
    const { data: groupMembers } = await supabase
      .from("group_memberships")
      .select("user_id")
      .eq("group_id", group.id)
      .is("deleted_at", null);

    escalatedToUserIds = groupMembers?.map((m: any) => m.user_id) || [];
  } else if (newEscalationLevel === 2) {
    // Level 2: Escalate to tenant admins
    const { data: tenantAdmins } = await supabase
      .from("user_profiles")
      .select("id")
      .eq("tenant_id", group.tenant_id)
      .eq("role", "tenant_admin")
      .eq("status", "active")
      .is("deleted_at", null);

    escalatedToUserIds = tenantAdmins?.map((a: any) => a.id) || [];
  } else {
    // Level 3+: No further escalation (capped)
    console.log(`Message ${message.id} reached maximum escalation level`);
    return;
  }

  // Update message escalation status
  await supabase
    .from("messages")
    .update({
      escalated_at: new Date().toISOString(),
      escalation_level: newEscalationLevel,
    })
    .eq("id", message.id);

  // Create escalation event (FR31003)
  await supabase.from("escalation_events").insert({
    message_id: message.id,
    escalation_level: newEscalationLevel,
    escalated_to_user_ids: escalatedToUserIds,
    escalated_to_group_id: escalatedToGroupId,
    reason: `Unacknowledged for ${group.escalation_timeout_minutes} minutes`,
  });

  // FR31003: Log escalation event
  await supabase.rpc("log_audit_event", {
    p_actor_user_id: null,
    p_tenant_id: message.tenant_id,
    p_action_type: "message_escalated",
    p_entity_type: "message",
    p_entity_id: message.id,
    p_scope: "group",
    p_scope_id: group.id,
    p_metadata: {
      escalation_level: newEscalationLevel,
      escalated_to_user_ids: escalatedToUserIds,
      escalated_to_group_id: escalatedToGroupId,
      reason: `Unacknowledged for ${group.escalation_timeout_minutes} minutes`,
    },
  });

  console.log(`Escalated message ${message.id} to level ${newEscalationLevel}`);

  // Note: Actual notification delivery (email/push) would be implemented here
  // For now, we log the escalation and the audit trail
}