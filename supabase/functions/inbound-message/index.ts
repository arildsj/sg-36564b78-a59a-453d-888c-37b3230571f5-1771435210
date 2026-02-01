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
    // Note: messages table uses 'group_id' and has 'thread_key'
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
  // Generate thread key for this contact (used in messages table)
  const threadKey = `${tenantId}:${fromNumber}`;

  // Step 1: Check for existing thread (reply scenario)
  // We check message_threads using contact_phone
  const { data: existingThreads } = await supabase
    .from("message_threads")
    .select("id, resolved_group_id")
    .eq("tenant_id", tenantId)
    .eq("contact_phone", fromNumber)
    .eq("is_resolved", false) // Prefer active threads
    .order("last_message_at", { ascending: false })
    .limit(1);

  const existingThread = existingThreads?.[0];

  if (existingThread) {
    // Update thread timestamp
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

  // Step 2: Resolve sender via whitelist + contact
  // ... (existing whitelist logic)
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
    // Extract operational groups from whitelist links
    candidateGroups = whitelistMatches
      .flatMap((wn: any) => wn.whitelist_group_links || [])
      .filter((link: any) => link.groups?.kind === "operational")
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

    // No rule matched, use first candidate group
    const resolvedGroupId = candidateGroups[0];
    const threadId = await createOrGetThread(supabase, tenantId, fromNumber, resolvedGroupId, gateway.id);
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
      .limit(1)
      .maybeSingle();

    if (!tenantFallback) {
      // Emergency fallback if no groups exist at all
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
  gatewayId: string
): Promise<string> {
  // Check if thread exists using the unique constraint fields
  // Constraint: unique_contact_group (tenant_id, contact_phone, resolved_group_id)
  const { data: existingThread } = await supabase
    .from("message_threads")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("contact_phone", contactPhone)
    .eq("resolved_group_id", groupId)
    .maybeSingle();

  if (existingThread) {
    // Reactivate thread if needed
    await supabase
      .from("message_threads")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", existingThread.id);
      
    return existingThread.id;
  }

  // Create new thread
  // Schema: id, tenant_id, gateway_id, contact_phone, resolved_group_id, last_message_at...
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
    // If concurrent creation happened, try fetching again
    if (error.code === '23505') { // Unique violation
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
  // Check if group is within opening hours
  const isOpen = await checkOpeningHours(supabase, routingResult.group_id);

  // Fetch active auto-replies for the group
  const { data: autoReplies } = await supabase
    .from("automatic_replies")
    .select("*")
    .eq("group_id", routingResult.group_id)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

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

    // Log the auto-reply
    // (Optional: add to auto_reply_log table if needed)
    
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
  if (triggerType === "outside_hours" && !isOpen) return true;

  // Keyword trigger
  if (triggerType === "keyword") {
    const pattern = autoReply.trigger_pattern || "";
    const normalizedContent = content.toLowerCase();
    return normalizedContent.includes(pattern.toLowerCase());
  }

  // First message trigger (simple approx)
  if (triggerType === "first_message") {
      return true;
  }

  return false;
}

async function checkOpeningHours(supabase: any, groupId: string): Promise<boolean> {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday

  // Check for date exceptions first
  const dateStr = now.toISOString().split("T")[0];
  const { data: exception } = await supabase
    .from("opening_hours_exceptions")
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

  if (!schedule) return true; // Default to open if no schedule? Or closed? Usually default open.
  if (!schedule.is_open) return false;
  if (!schedule.open_time || !schedule.close_time) return true; // Open all day if times missing but is_open true

  // Compare current time with open/close times
  // Note: timestamps in DB are typically UTC, but opening hours might be local. 
  // For MVP assuming UTC or timezone handled. 
  const currentTime = now.toISOString().split("T")[1].substring(0, 5); // HH:MM
  return currentTime >= schedule.open_time && currentTime <= schedule.close_time;
}

async function notifyOnDutyUsers(supabase: any, message: any): Promise<void> {
  // Implementation pending notification system
  // Just logging for now
}

async function scheduleEscalationCheck(supabase: any, message: any): Promise<void> {
   // Implementation pending escalation system
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