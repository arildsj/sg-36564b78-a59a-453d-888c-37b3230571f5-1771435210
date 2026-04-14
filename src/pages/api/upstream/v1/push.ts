import { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { resolveGroupByRules } from "@/lib/routingUtils";

const bodySchema = z.object({
  from_number: z.string().min(1),
  to_number:   z.string().min(1),
  content:     z.string().min(1),
  received_at: z.string().optional(),
});

async function getGatewayFromToken(admin: any, req: NextApiRequest) {
  const authHeader = req.headers.authorization ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  if (!token) return null;
  const { data } = await admin
    .from("sms_gateways")
    .select("*")
    .eq("device_token", token)
    .eq("is_active", true)
    .maybeSingle();
  return data ?? null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const admin = createAdminClient() as any;

  const gateway = await getGatewayFromToken(admin, req);
  if (!gateway)
    return res.status(401).json({ error: "Invalid or missing device token" });

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.errors[0].message });

  const { from_number, to_number, content, received_at = new Date().toISOString() } = parsed.data;

  // ── Gateway fallback group ────────────────────────────────────────────────
  const { data: gatewayGroup } = await admin
    .from("groups")
    .select("id")
    .eq("gateway_id", gateway.id)
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
        group_id:  gatewayFallbackGroupId,
        tenant_id: gateway.tenant_id,
      })
      .select()
      .single();
    if (contactError || !newContact)
      return res.status(500).json({ error: `Failed to create contact: ${contactError?.message}` });
    contact = newContact;
  }

  // ── Routing rules always win — resolve group before any thread lookup ─────
  const resolvedGroupId = await resolveGroupByRules(
    admin, gateway.tenant_id, from_number, content,
    contact.group_id, gatewayFallbackGroupId
  );
  if (!resolvedGroupId)
    return res.status(422).json({ error: "No target group — no routing rules matched and no fallback configured" });

  // ── Find existing open thread scoped to the resolved group ────────────────
  const { data: existingThread } = await admin
    .from("message_threads")
    .select("id")
    .eq("contact_phone", from_number)
    .eq("tenant_id", gateway.tenant_id)
    .eq("resolved_group_id", resolvedGroupId)
    .eq("is_resolved", false)
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let threadId: string;
  if (existingThread) {
    threadId = existingThread.id;
  } else {
    const { data: newThread, error: threadError } = await admin
      .from("message_threads")
      .insert({
        contact_phone:     from_number,
        resolved_group_id: resolvedGroupId,
        gateway_id:        gateway.id,
        tenant_id:         gateway.tenant_id,
        last_message_at:   received_at,
      })
      .select()
      .single();
    if (threadError || !newThread)
      return res.status(500).json({ error: `Failed to create thread: ${threadError?.message}` });
    threadId = newThread.id;
  }

  // ── Insert message ────────────────────────────────────────────────────────
  const { data: message, error: messageError } = await admin
    .from("messages")
    .insert({
      thread_id:   threadId,
      contact_id:  contact.id,
      direction:   "inbound",
      content,
      status:      "received",
      gateway_id:  gateway.id,
      group_id:    resolvedGroupId,
      from_number,
      to_number,
      tenant_id:   gateway.tenant_id,
      thread_key:  `${from_number}-${gateway.id}`,
    })
    .select()
    .single();
  if (messageError || !message)
    return res.status(500).json({ error: `Failed to create message: ${messageError?.message}` });

  // ── Update thread timestamp ───────────────────────────────────────────────
  await admin
    .from("message_threads")
    .update({ last_message_at: message.created_at })
    .eq("id", threadId);

  return res.status(200).json({ success: true });
}
