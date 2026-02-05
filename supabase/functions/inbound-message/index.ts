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
  media_urls?: string[];
  external_message_id?: string;
  received_at?: string;
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

    if (!payload.gateway_id || !payload.from_number || !payload.to_number || !payload.content) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fromNumber = normalizeE164(payload.from_number);
    const toNumber = normalizeE164(payload.to_number);

    const { data: gateway, error: gatewayError } = await supabase
      .from("gateways")
      .select("id, tenant_id, name, fallback_group_id")
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

    const routingResult = await routeInboundMessage(
      supabase,
      gateway.tenant_id,
      fromNumber,
      toNumber,
      payload.content,
      gateway
    );

    const { data: message, error: messageError } = await supabase
      .from("messages")
      .insert({
        tenant_id: gateway.tenant_id,
        gateway_id: payload.gateway_id,
        direction: "inbound",
        from_number: fromNumber,
        to_number: toNumber,
        content: payload.content,
        media_urls: payload.media_urls || [],
        group_id: routingResult.group_id,
        thread_id: routingResult.thread_id,
        thread_key: routingResult.thread_key,
        status: "delivered",
        external_message_id: payload.external_message_id || null,
        is_fallback: routingResult.is_fallback,
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

    await evaluateAutoReplies(supabase, message, routingResult);
    await notifyOnDutyUsers(supabase, message);
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
  const threadKey = `${tenantId}:${fromNumber}`;

  const { data: existingThreads } = await supabase
    .from("message_threads")
    .select("id, resolved_group_id")
    .eq("tenant_id", tenantId)
    .eq("contact_phone", fromNumber)
    .eq("is_resolved", false)
    .order("last_message_at", { ascending: false })
    .limit(1);

  const existingThread = existingThreads?.[0];

  if (existingThread) {
    await supabase
      .from("message_threads")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", existingThread.id);

    return {
      group_id: existingThread.resolved_group_id,
      thread_id: existingThread.id,
      thread_key: threadKey,
      is_fallback: false,
    };
  }

  const { data: whitelistMatches } = await supabase
    .from("whitelisted_numbers")
    .select(`
      id,
      whitelist_group_links (
        group_id,
        groups (
          id,
          kind
        )
      )
    `)
    .eq("tenant_id", tenantId)
    .eq("phone_number", fromNumber);

  let candidateGroups: string[] = [];

  if (whitelistMatches && whitelistMatches.length > 0) {
    candidateGroups = whitelistMatches
      .flatMap((wn: any) => wn.whitelist_group_links || [])
      .filter((link: any) => link.groups?.kind === "operational")
      .map((link: any) => link.group_id);
  }

  if (candidateGroups.length > 0) {
    const { data: routingRules } = await supabase
      .from("routing_rules")
      .select("id, target_group_id, rule_type, pattern")
      .eq("tenant_id", tenantId)
      .in("target_group_id", candidateGroups)
      .eq("is_active", true)
      .order("priority", { ascending: false });

    if (routingRules && routingRules.length > 0) {
      for (const rule of routingRules) {
        if (matchesRoutingRule(content, rule.rule_type, rule.pattern)) {
          const threadId = await createOrGetThread(supabase, tenantId, fromNumber, rule.target_group_id, gateway.id);
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

    const resolvedGroupId = candidateGroups[0];
    const threadId = await createOrGetThread(supabase, tenantId, fromNumber, resolvedGroupId, gateway.id);
    return {
      group_id: resolvedGroupId,
      thread_id: threadId,
      thread_key: threadKey,
      is_fallback: false,
    };
  }

  let fallbackGroupId: string;

  if (gateway.fallback_group_id) {
    fallbackGroupId = gateway.fallback_group_id;
  } else {
    const { data: tenantFallback } = await supabase
      .from("groups")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("kind", "operational")
      .limit(1)
      .maybeSingle();

    if (!tenantFallback) {
      throw new Error("No fallback operational group configured");
    }

    fallbackGroupId = tenantFallback.id;
  }

  const threadId = await createOrGetThread(supabase, tenantId, fromNumber, fallbackGroupId, gateway.id);

  return {
    group_id: fallbackGroupId,
    thread_id: threadId,
    thread_key: threadKey,
    is_fallback: true,
  };
}

function matchesRoutingRule(content: string, ruleType: string, pattern: string): boolean {
  const normalizedContent = content.trim().toLowerCase();
  const normalizedPattern = pattern?.trim().toLowerCase() || "";

  switch (ruleType) {
    case "prefix":
      return normalizedContent.startsWith(normalizedPattern);
    case "keyword":
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
  gatewayId: string
): Promise<string> {
  const { data: existingThread } = await supabase
    .from("message_threads")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("contact_phone", contactPhone)
    .eq("resolved_group_id", groupId)
    .maybeSingle();

  if (existingThread) {
    await supabase
      .from("message_threads")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", existingThread.id);
      
    return existingThread.id;
  }

  const { data: newThread, error } = await supabase
    .from("message_threads")
    .insert({
      tenant_id: tenantId,
      gateway_id: gatewayId,
      contact_phone: contactPhone,
      resolved_group_id: groupId,
      last_message_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    console.error("Failed to create thread:", error);
    if (error.code === '23505') {
        const { data: retryThread } = await supabase
            .from("message_threads")
            .select("id")
            .eq("tenant_id", tenantId)
            .eq("contact_phone", contactPhone)
            .eq("resolved_group_id", groupId)
            .maybeSingle();
        if (retryThread) return retryThread.id;
    }
    throw new Error("Thread creation failed: " + error.message);
  }

  return newThread.id;
}

async function evaluateAutoReplies(
  supabase: any,
  message: any,
  routingResult: RoutingResult
): Promise<void> {
  const isOpen = await checkOpeningHours(supabase, routingResult.group_id);

  const { data: autoReplies } = await supabase
    .from("automatic_replies")
    .select("*")
    .eq("group_id", routingResult.group_id)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (!autoReplies || autoReplies.length === 0) return;

  for (const autoReply of autoReplies) {
    const shouldSend = evaluateAutoReplyConditions(
      autoReply,
      message.content,
      isOpen,
      routingResult.is_fallback
    );

    if (!shouldSend) continue;

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

    await supabase.from("messages").insert({
      tenant_id: message.tenant_id,
      gateway_id: message.gateway_id,
      direction: "outbound",
      from_number: message.to_number,
      to_number: message.from_number,
      content: autoReply.message_template,
      group_id: routingResult.group_id,
      thread_id: routingResult.thread_id,
      thread_key: routingResult.thread_key,
      status: "queued",
      is_fallback: false,
    });
    
    break;
  }
}

function evaluateAutoReplyConditions(
  autoReply: any,
  content: string,
  isOpen: boolean,
  isFallback: boolean
): boolean {
  const triggerType = autoReply.trigger_type;

  if (triggerType === "outside_hours" && isOpen) return false;
  if (triggerType === "outside_hours" && !isOpen) return true;

  if (triggerType === "keyword") {
    const pattern = autoReply.trigger_pattern || "";
    const normalizedContent = content.toLowerCase();
    return normalizedContent.includes(pattern.toLowerCase());
  }

  if (triggerType === "first_message") {
      return true;
  }

  return false;
}

async function checkOpeningHours(supabase: any, groupId: string): Promise<boolean> {
  const now = new Date();
  const dayOfWeek = now.getDay();

  const dateStr = now.toISOString().split("T")[0];
  const { data: exception } = await supabase
    .from("opening_hours_exceptions")
    .select("is_open")
    .eq("group_id", groupId)
    .eq("exception_date", dateStr)
    .maybeSingle();

  if (exception) return exception.is_open;

  const { data: schedule } = await supabase
    .from("opening_hours")
    .select("is_open, open_time, close_time")
    .eq("group_id", groupId)
    .eq("day_of_week", dayOfWeek)
    .maybeSingle();

  if (!schedule) return true;
  if (!schedule.is_open) return false;
  if (!schedule.open_time || !schedule.close_time) return true;

  const currentTime = now.toISOString().split("T")[1].substring(0, 5);
  return currentTime >= schedule.open_time && currentTime <= schedule.close_time;
}

async function notifyOnDutyUsers(supabase: any, message: any): Promise<void> {
  return;
}

async function scheduleEscalationCheck(supabase: any, message: any): Promise<void> {
  return;
}

function normalizeE164(phone: string): string {
  if (!phone) return "";
  
  const trimmed = phone.trim();
  
  // Check if it has letters -> Alphanumeric Sender ID
  if (/[a-zA-Z]/.test(trimmed)) {
    // Keep only alphanumeric characters and ensure max 11 chars
    return trimmed.replace(/[^a-zA-Z0-9]/g, "").substring(0, 11);
  }
  
  // Standard phone number normalization
  let normalized = trimmed.replace(/[^\d+]/g, "");
  if (normalized.length > 0 && !normalized.startsWith("+")) {
    normalized = "+" + normalized;
  }
  return normalized;
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}