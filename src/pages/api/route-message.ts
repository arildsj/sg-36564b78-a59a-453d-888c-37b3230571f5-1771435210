import { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabaseAdmin";

const bodySchema = z.object({
  sender:       z.string().min(1),
  message_text: z.string(),
  gateway_id:   z.string().uuid(),
});

type RouteMessageResponse = {
  matched_rule_id: string;
  group_id:        string;
  rule_type:       string;
  match_value:     string | null;
} | { error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<RouteMessageResponse>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0].message });
  }

  const { sender, message_text, gateway_id } = parsed.data;
  const admin = createAdminClient();

  // ── Fetch all active rules for this gateway, ordered by priority ─────
  const { data: rules, error: rulesError } = await admin
    .from("routing_rules")
    .select("id, name, match_type, match_value, target_group_id, priority")
    .eq("gateway_id", gateway_id)
    .eq("is_active", true)
    .order("priority", { ascending: true });

  if (rulesError) {
    console.error("[route-message] Failed to load rules:", rulesError);
    return res.status(500).json({ error: "Failed to load routing rules" });
  }

  if (!rules || rules.length === 0) {
    return res.status(404).json({ error: "No active routing rules for this gateway" });
  }

  // ── Evaluate rules in priority order: sender → prefix → keyword → fallback
  type Rule = (typeof rules)[number];

  const senderRules  = rules.filter((r: Rule) => r.match_type === "sender");
  const prefixRules  = rules.filter((r: Rule) => r.match_type === "prefix");
  const keywordRules = rules.filter((r: Rule) => r.match_type === "keyword");
  const fallbackRule = rules.find((r: Rule) => r.match_type === "fallback") ?? null;

  let matched: Rule | null = null;

  // 1. Sender — exact match
  for (const rule of senderRules) {
    if (rule.match_value && sender === rule.match_value) {
      matched = rule;
      break;
    }
  }

  // 2. Prefix — case-insensitive starts-with
  if (!matched) {
    for (const rule of prefixRules) {
      if (
        rule.match_value &&
        message_text.toLowerCase().startsWith(rule.match_value.toLowerCase())
      ) {
        matched = rule;
        break;
      }
    }
  }

  // 3. Keyword — case-insensitive whole-word match
  if (!matched) {
    for (const rule of keywordRules) {
      if (rule.match_value) {
        const escaped = rule.match_value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(`\\b${escaped}\\b`, "i");
        if (regex.test(message_text)) {
          matched = rule;
          break;
        }
      }
    }
  }

  // 4. Fallback
  if (!matched && fallbackRule) {
    matched = fallbackRule;
  }

  if (!matched) {
    return res.status(422).json({ error: "No rule matched and no fallback configured" });
  }

  // ── Log the routing event ─────────────────────────────────────────────
  const { error: logError } = await admin.from("audit_log").insert({
    user_id:    null,
    action:     "route_message",
    resource_type: "routing_rule",
    resource_id:   matched.id,
    event_type: "rule_matched",
    group_id:   matched.target_group_id,
    metadata: {
      sender,
      matched_rule_name: matched.name,
      match_type:        matched.match_type,
      match_value:       matched.match_value,
      target_group_id:   matched.target_group_id,
      gateway_id,
    },
  });

  if (logError) {
    // Log but don't fail the request
    console.error("[route-message] Failed to write audit log:", logError);
  }

  // ── Schedule escalation steps if any are configured for this rule ────
  const { data: steps } = await admin
    .from("routing_rule_escalation_steps")
    .select("id, step_order, timeout_seconds, target_group_id")
    .eq("rule_id", matched.id)
    .eq("is_active", true)
    .order("step_order", { ascending: true });

  if (steps && steps.length > 0) {
    const now = Date.now();
    let cumulativeOffsetMs = 0;

    const queueRows = steps.map((step) => {
      cumulativeOffsetMs += step.timeout_seconds * 1000;
      return {
        rule_id:      matched!.id,
        message_id:   null as string | null,
        group_id:     step.target_group_id,
        level_number: step.step_order,
        trigger_at:   new Date(now + cumulativeOffsetMs).toISOString(),
        status:       "pending",
      };
    });

    const { error: queueError } = await admin
      .from("escalation_queue")
      .insert(queueRows);

    if (queueError) {
      // Non-fatal — log but don't fail the routing response
      console.error("[route-message] Failed to enqueue escalation steps:", queueError);
    }
  }

  return res.status(200).json({
    matched_rule_id: matched.id,
    group_id:        matched.target_group_id,
    rule_type:       matched.match_type,
    match_value:     matched.match_value ?? null,
  });
}
