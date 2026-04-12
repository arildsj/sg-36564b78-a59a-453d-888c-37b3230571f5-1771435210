import { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { createAdminClient, getRequestUser } from "@/lib/supabaseAdmin";

const bodySchema = z.object({
  gateway_id:        z.string().uuid(),
  from_number:       z.string().min(1),
  to_number:         z.string().min(1),
  content:           z.string().min(1),
  received_at:       z.string().optional(),
  campaign_id:       z.string().uuid().nullable().optional(),
  parent_message_id: z.string().uuid().nullable().optional(),
  target_group_id:   z.string().uuid().nullable().optional(),
});

// ── Routing rule matching (mirrors inbound-message Edge Function) ─────────────
function matchesRule(rule: any, from_number: string, content: string): boolean {
  if (rule.match_type === "sender" && rule.match_value) {
    return rule.match_value.trim().toLowerCase() === from_number.trim().toLowerCase();
  }
  if (rule.match_type === "keyword" && rule.match_value) {
    return content.toLowerCase().includes(rule.match_value.trim().toLowerCase());
  }
  if (rule.match_type === "prefix" && rule.match_value) {
    return content.toLowerCase().startsWith(rule.match_value.trim().toLowerCase());
  }
  if (rule.match_type === "fallback") {
    return true;
  }
  return false;
}

// ── Routing rule resolution ───────────────────────────────────────────────────
async function resolveGroupByRules(
  admin: any,
  tenantId: string,
  from_number: string,
  content: string,
  contactGroupId: string | null,
  gatewayFallbackGroupId: string | null
): Promise<string | null> {
  const { data: rules } = await admin
    .from("routing_rules")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("priority", { ascending: true });

  console.log("[simulate] routing rules loaded:", rules?.length ?? 0, "active rules");

  if (rules && rules.length > 0) {
    for (const rule of rules) {
      const matched = matchesRule(rule, from_number, content);
      console.log(`[simulate] rule "${rule.name}" (${rule.match_type}="${rule.match_value}") → ${matched ? "MATCH" : "no match"}`);
      if (matched) {
        console.log("[simulate] rule matched — resolvedGroupId:", rule.target_group_id);
        return rule.target_group_id;
      }
    }
  }

  return contactGroupId || gatewayFallbackGroupId;
}

// ─────────────────────────────────────────────────────────────────────────────

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const user = await getRequestUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0].message });
  }

  const {
    gateway_id,
    from_number,
    to_number,
    content,
    received_at,
    campaign_id       = null,
    parent_message_id = null,
    target_group_id   = null,
  } = parsed.data;

  const admin = createAdminClient() as any;

  // ── Gateway ───────────────────────────────────────────────────────────────
  const { data: gateway, error: gatewayError } = await admin
    .from("sms_gateways")
    .select("*")
    .eq("id", gateway_id)
    .single();

  if (gatewayError || !gateway) {
    return res.status(404).json({ error: `Gateway not found: ${gateway_id}` });
  }

  // ── Gateway fallback group (first group linked to gateway, alphabetically) ─
  const { data: gatewayGroup } = await admin
    .from("groups")
    .select("id")
    .eq("gateway_id", gateway_id)
    .order("name", { ascending: true })
    .limit(1)
    .maybeSingle();

  const gatewayFallbackGroupId: string | null = gatewayGroup?.id ?? null;

  // ── Contact: find or create ───────────────────────────────────────────────
  const { data: existingContact } = await admin
    .from("contacts")
    .select("*")
    .eq("phone", from_number)
    .maybeSingle();

  let contact = existingContact;
  if (!contact) {
    const { data: newContact, error: contactError } = await admin
      .from("contacts")
      .insert({
        phone:     from_number,
        name:      from_number,
        group_id:  target_group_id || gatewayFallbackGroupId,
        tenant_id: gateway.tenant_id,
      })
      .select()
      .single();

    if (contactError || !newContact) {
      return res.status(500).json({ error: `Failed to create contact: ${contactError?.message}` });
    }
    contact = newContact;
  }

  // ── Thread resolution ─────────────────────────────────────────────────────
  let threadId: string | null = null;
  let resolvedGroupId: string | null = target_group_id || contact.group_id;

  // 1. Inherit thread from parent message (bulk campaign reply)
  if (parent_message_id) {
    const { data: parentMsg } = await admin
      .from("messages")
      .select("thread_id, group_id")
      .eq("id", parent_message_id)
      .maybeSingle();

    if (parentMsg) {
      threadId = parentMsg.thread_id;
      if (!target_group_id) resolvedGroupId = parentMsg.group_id;
    }
  }

  // 2. Find existing open thread for this sender
  if (!threadId) {
    const { data: existingThread } = await admin
      .from("message_threads")
      .select("*")
      .eq("contact_phone", from_number)
      .eq("tenant_id", gateway.tenant_id)
      .eq("is_resolved", false)
      .maybeSingle();

    if (existingThread) {
      threadId = existingThread.id;
      resolvedGroupId = existingThread.resolved_group_id;
      console.log("[simulate] existing thread found:", threadId, "→ current group:", resolvedGroupId);

      // Always re-evaluate routing rules — rule changes must win over thread history
      if (!target_group_id) {
        const ruleGroupId = await resolveGroupByRules(admin, gateway.tenant_id, from_number, content, contact.group_id, gatewayFallbackGroupId);
        if (ruleGroupId && ruleGroupId !== existingThread.resolved_group_id) {
          resolvedGroupId = ruleGroupId;
          await admin
            .from("message_threads")
            .update({ resolved_group_id: ruleGroupId })
            .eq("id", threadId);
          console.log("[simulate] routing rule overrode existing thread → new group:", ruleGroupId);
        }
      }
    } else {
      // 3. New thread — evaluate routing rules
      console.log("[simulate] no existing thread, evaluating routing rules");
      if (!target_group_id) {
        resolvedGroupId = await resolveGroupByRules(admin, gateway.tenant_id, from_number, content, contact.group_id, gatewayFallbackGroupId);
      }

      if (!resolvedGroupId) {
        return res.status(422).json({
          error: "No target group found — no routing rules matched and no fallback configured",
        });
      }

      const { data: newThread, error: threadError } = await admin
        .from("message_threads")
        .insert({
          contact_phone:     from_number,
          resolved_group_id: resolvedGroupId,
          gateway_id,
          tenant_id:         gateway.tenant_id,
          last_message_at:   received_at || new Date().toISOString(),
        })
        .select()
        .single();

      if (threadError || !newThread) {
        return res.status(500).json({ error: `Failed to create thread: ${threadError?.message}` });
      }
      threadId = newThread.id;
    }
  }

  // ── Insert message ────────────────────────────────────────────────────────
  const { data: message, error: messageError } = await admin
    .from("messages")
    .insert({
      thread_id:         threadId,
      contact_id:        contact.id,
      direction:         "inbound",
      content,
      status:            "received",
      gateway_id,
      group_id:          resolvedGroupId,
      from_number,
      to_number,
      tenant_id:         gateway.tenant_id,
      thread_key:        `${from_number}-${gateway_id}`,
      campaign_id:       campaign_id || null,
      parent_message_id: parent_message_id || null,
    })
    .select()
    .single();

  if (messageError || !message) {
    return res.status(500).json({ error: `Failed to create message: ${messageError?.message}` });
  }

  // ── Update thread timestamp ───────────────────────────────────────────────
  await admin
    .from("message_threads")
    .update({ last_message_at: message.created_at })
    .eq("id", threadId);

  return res.status(200).json({
    success:          true,
    message,
    is_bulk_response: !!(campaign_id && parent_message_id),
    is_fallback:      !target_group_id && resolvedGroupId === gatewayFallbackGroupId,
  });
}
