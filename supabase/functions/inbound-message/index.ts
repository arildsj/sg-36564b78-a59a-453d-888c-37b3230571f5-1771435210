// SeMSe + FairGateway: Inbound Message Webhook Handler
// PROMPT 2: Deterministic routing with idempotency

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InboundPayload {
  gateway_id: string;
  from_number: string;
  to_number: string;
  content: string;
  mms_urls?: string[];
  external_message_id: string;
  received_at: string;
}

interface RoutingResult {
  group_id: string;
  routing_rule_id?: string;
  thread_id: string;
  thread_key: string;
  is_fallback: boolean;
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

    const payload: InboundPayload = await req.json();

    // Validate required fields
    if (!payload.gateway_id || !payload.from_number || !payload.to_number || !payload.content) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalize phone numbers to E.164
    const fromNumber = normalizeE164(payload.from_number);
    const toNumber = normalizeE164(payload.to_number);

    // Get gateway and tenant context
    const { data: gateway, error: gatewayError } = await supabase
      .from("gateways")
      .select("id, tenant_id, provider_name")
      .eq("id", payload.gateway_id)
      .eq("status", "active")
      .single();

    if (gatewayError || !gateway) {
      console.error("Gateway not found or inactive:", gatewayError);
      return new Response(
        JSON.stringify({ error: "Invalid gateway" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Route the message
    const routingResult = await routeInboundMessage(
      supabase,
      gateway.tenant_id,
      fromNumber,
      toNumber,
      payload.content,
      gateway
    );

    // Create message record
    const { data: message, error: messageError } = await supabase
      .from("messages")
      .insert({
        tenant_id: gateway.tenant_id,
        gateway_id: payload.gateway_id,
        direction: "inbound",
        from_number: fromNumber,
        to_number: toNumber,
        content: payload.content,
        mms_media_urls: payload.mms_urls || [],
        resolved_group_id: routingResult.resolved_group_id,
        thread_id: routingResult.thread_id,
        status: "received",
        idempotency_key: idempotencyKey,
        external_id: payload.external_message_id,
        received_at: payload.received_at,
        acknowledged_at: null, // FR31002: Requires manual acknowledgement
        escalation_level: 0,
      })
      .select()
      .single();

    if (messageError) {
      console.error("Failed to create message:", messageError);
      return new Response(
        JSON.stringify({ error: "Failed to create message", details: messageError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Evaluate auto-replies (FR3901-FR3905)
    await evaluateAutoReplies(supabase, message, routingResult);

    // Check on-duty coverage and notify (FR3301, FR31101)
    await notifyOnDutyUsers(supabase, message);

    // Schedule escalation check if enabled (FR31001)
    await scheduleEscalationCheck(supabase, message);

    return new Response(
      JSON.stringify({
        status: "success",
        message_id: message.id,
        group_id: routingResult.group_id,
        thread_id: routingResult.thread_id,
        is_fallback: routingResult.is_fallback,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Inbound message processing error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function routeInboundMessage(
  supabase: any,
  tenantId: string,
  fromNumber: string,
  toNumber: string,
  content: string,
  gateway: any
): Promise<RoutingResult> {
  // Step 1: Check for existing thread (reply scenario)
  const { data: existingThread } = await supabase
    .from("message_threads")
    .select("id, resolved_group_id")
    .eq("tenant_id", tenantId)
    .eq("contact_phone", fromNumber)
    .is("deleted_at", null)
    .order("last_message_at", { ascending: false })
    .limit(1)
    .single();

  if (existingThread) {
    return {
      resolved_group_id: existingThread.resolved_group_id,
      thread_id: existingThread.id,
      is_fallback: false,
    };
  }

  // Step 2: Resolve sender via whitelist + contact
  const { data: whitelistMatches } = await supabase
    .from("whitelisted_numbers")
    .select(`
      id,
      contact_id,
      whitelist_group_links (
        group_id,
        groups (
          id,
          kind,
          is_active
        )
      )
    `)
    .eq("tenant_id", tenantId)
    .eq("phone_number", fromNumber)
    .is("deleted_at", null);

  let candidateGroups: string[] = [];

  if (whitelistMatches && whitelistMatches.length > 0) {
    // Extract operational groups from whitelist links
    candidateGroups = whitelistMatches
      .flatMap((wn: any) => wn.whitelist_group_links || [])
      .filter((link: any) => link.groups?.kind === "operational" && link.groups?.is_active)
      .map((link: any) => link.group_id);
  }

  // Step 3: Apply routing rules if candidate groups exist
  if (candidateGroups.length > 0) {
    const { data: routingRules } = await supabase
      .from("routing_rules")
      .select("id, target_group_id, rule_type, pattern")
      .eq("tenant_id", tenantId)
      .in("target_group_id", candidateGroups)
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("priority", { ascending: false });

    if (routingRules && routingRules.length > 0) {
      for (const rule of routingRules) {
        if (matchesRoutingRule(content, rule.rule_type, rule.pattern)) {
          const threadId = await createOrGetThread(supabase, tenantId, fromNumber, rule.target_group_id, threadKey);
          return {
            group_id: rule.target_group_id,
            routing_rule_id: rule.id,
            thread_id: threadId,
            thread_key: threadKey,
            is_fallback: false,
          };
        }
      }
    }

    // No rule matched, use first candidate group
    const resolvedGroupId = candidateGroups[0];
    const threadId = await createOrGetThread(supabase, tenantId, fromNumber, resolvedGroupId, threadKey);
    return {
      group_id: resolvedGroupId,
      thread_id: threadId,
      thread_key: threadKey,
      is_fallback: false,
    };
  }

  // Step 4: Unknown sender → fallback
  let fallbackGroupId: string;

  if (gateway.fallback_group_id) {
    // Use gateway-specific fallback group
    fallbackGroupId = gateway.fallback_group_id;
  } else {
    // Use tenant-level fallback (first operational group)
    const { data: tenantFallback } = await supabase
      .from("groups")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("kind", "operational")
      .eq("is_active", true)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();

    if (!tenantFallback) {
      throw new Error("No fallback operational group configured");
    }

    fallbackGroupId = tenantFallback.id;
  }

  const threadId = await createOrGetThread(supabase, tenantId, fromNumber, fallbackGroupId, threadKey);

  return {
    group_id: fallbackGroupId,
    thread_id: threadId,
    thread_key: threadKey,
    is_fallback: true,
  };
}

function matchesRoutingRule(content: string, ruleType: string, pattern: string): boolean {
  const normalizedContent = content.trim().toLowerCase();
  const normalizedPattern = pattern.trim().toLowerCase();

  switch (ruleType) {
    case "prefix":
      return normalizedContent.startsWith(normalizedPattern);
    case "keyword":
      // Word boundary matching
      const regex = new RegExp(`\\b${escapeRegExp(normalizedPattern)}\\b`, "i");
      return regex.test(normalizedContent);
    case "exact":
      return normalizedContent === normalizedPattern;
    default:
      return false;
  }
}

async function createOrGetThread(
  supabase: any,
  tenantId: string,
  contactPhone: string,
  groupId: string,
  threadKey: string
): Promise<string> {
  // Check if thread exists
  const { data: existingThread } = await supabase
    .from("message_threads")
    .select("id")
    .eq("thread_key", threadKey)
    .maybeSingle();

  if (existingThread) {
    return existingThread.id;
  }

  // Create new thread
  const { data: newThread, error } = await supabase
    .from("message_threads")
    .insert({
      tenant_id: tenantId,
      thread_key: threadKey,
      contact_phone: contactPhone,
      group_id: groupId,
      last_message_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    console.error("Failed to create thread:", error);
    throw new Error("Thread creation failed: " + error.message);
  }

  return newThread.id;
}

async function evaluateAutoReplies(
  supabase: any,
  message: any,
  routingResult: RoutingResult
): Promise<void> {
  // Check if group is within opening hours
  const isOpen = await checkOpeningHours(supabase, routingResult.resolved_group_id);

  // Fetch active auto-replies for the group
  const { data: autoReplies } = await supabase
    .from("auto_replies")
    .select("*")
    .eq("group_id", routingResult.resolved_group_id)
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("priority", { ascending: false });

  if (!autoReplies || autoReplies.length === 0) return;

  for (const autoReply of autoReplies) {
    // Evaluate conditions
    const shouldSend = evaluateAutoReplyConditions(
      autoReply,
      message.content,
      isOpen,
      routingResult.is_fallback
    );

    if (!shouldSend) continue;

    // Check cooldown
    const { data: recentAutoReply } = await supabase
      .from("messages")
      .select("id, created_at")
      .eq("thread_id", routingResult.thread_id)
      .eq("direction", "outbound")
      .gte(
        "created_at",
        new Date(Date.now() - (autoReply.cooldown_minutes || 60) * 60000).toISOString()
      )
      .limit(1)
      .maybeSingle();

    if (recentAutoReply) {
      console.log(`Auto-reply cooldown active for thread ${routingResult.thread_id}`);
      continue;
    }

    // Send auto-reply
    await supabase.from("messages").insert({
      tenant_id: message.tenant_id,
      gateway_id: message.gateway_id,
      direction: "out",
      from_number: message.to_number,
      to_number: message.from_number,
      content: autoReply.response_template,
      resolved_group_id: routingResult.resolved_group_id,
      thread_id: routingResult.thread_id,
      status: "queued",
      is_auto_reply: true,
      triggered_by_message_id: message.id,
    });

    break; // Send only first matching auto-reply
  }
}

function evaluateAutoReplyConditions(
  autoReply: any,
  content: string,
  isOpen: boolean,
  isFallback: boolean
): boolean {
  const triggerType = autoReply.trigger_type;

  // Outside hours trigger
  if (triggerType === "outside_hours" && isOpen) return false;

  // Keyword trigger
  if (triggerType === "keyword") {
    const keywords = autoReply.trigger_keywords || [];
    const normalizedContent = content.toLowerCase();
    const matched = keywords.some((kw: string) => normalizedContent.includes(kw.toLowerCase()));
    if (!matched) return false;
  }

  // First message trigger (handled by checking thread creation)
  return true;
}

async function checkOpeningHours(supabase: any, groupId: string): Promise<boolean> {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday

  // Check for date exceptions first
  const dateStr = now.toISOString().split("T")[0];
  const { data: exception } = await supabase
    .from("opening_hour_exceptions")
    .select("is_open")
    .eq("group_id", groupId)
    .eq("exception_date", dateStr)
    .maybeSingle();

  if (exception) return exception.is_open;

  // Check regular schedule
  const { data: schedule } = await supabase
    .from("opening_hours")
    .select("is_open, open_time, close_time")
    .eq("group_id", groupId)
    .eq("day_of_week", dayOfWeek)
    .maybeSingle();

  if (!schedule || !schedule.is_open) return false;

  // Compare current time with open/close times
  const currentTime = now.toTimeString().split(" ")[0].substring(0, 5); // HH:MM
  return currentTime >= schedule.open_time && currentTime <= schedule.close_time;
}

async function notifyOnDutyUsers(supabase: any, message: any): Promise<void> {
  // FR3301: Only on-duty users receive notifications
  const { data: onDutyUsers, error } = await supabase
    .from("on_duty_state")
    .select(`
      user_id,
      user_profiles!inner (
        id,
        email,
        full_name
      )
    `)
    .eq("group_id", message.resolved_group_id)
    .eq("is_on_duty", true);

  if (error) {
    console.error("Failed to fetch on-duty users:", error);
    return;
  }

  if (!onDutyUsers || onDutyUsers.length === 0) {
    console.log(`No on-duty users for group ${message.resolved_group_id}`);
    return;
  }

  // Log notification (actual notification implementation pending)
  console.log(`Would notify ${onDutyUsers.length} on-duty users for message ${message.id}`);
}

async function scheduleEscalationCheck(supabase: any, message: any): Promise<void> {
  // FR31001: Check if escalation is enabled for this group
  const { data: group } = await supabase
    .from("groups")
    .select("escalation_enabled, escalation_timeout_minutes")
    .eq("id", message.resolved_group_id)
    .single();

  if (!group) {
    return;
  }

  // Log that escalation would be scheduled (actual implementation pending)
  console.log(`Escalation check would be scheduled for message ${message.id}`);
}

function normalizeE164(phone: string): string {
  // Remove all non-numeric characters except leading +
  let normalized = phone.replace(/[^\d+]/g, "");
  if (!normalized.startsWith("+")) {
    normalized = "+" + normalized;
  }
  return normalized;
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}