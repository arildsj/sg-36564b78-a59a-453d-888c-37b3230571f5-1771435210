import { NextApiRequest, NextApiResponse } from "next";
import { createAdminClient } from "@/lib/supabaseAdmin";

// ── Bearer device_token validation ────────────────────────────────────────────
async function getGatewayFromToken(admin: any, req: NextApiRequest) {
  const authHeader = req.headers.authorization ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null;
  if (!token) return null;

  const { data } = await admin
    .from("sms_gateways")
    .select("id, tenant_id")
    .eq("device_token", token)
    .eq("is_active", true)
    .maybeSingle();

  return data ?? null;
}

// ── Status mapping: FairGateway → SeMSe ──────────────────────────────────────
const STATUS_MAP: Record<string, string> = {
  Sent:       "sent",
  Delivered:  "delivered",
  Failed:     "failed",
};

// ─────────────────────────────────────────────────────────────────────────────

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = createAdminClient() as any;

  const gateway = await getGatewayFromToken(admin, req);
  if (!gateway)
    return res.status(401).json({ error: "Invalid or missing device token" });

  // ── GET — return pending outbound messages ────────────────────────────────
  if (req.method === "GET") {
    const limit  = Math.min(parseInt(String(req.query.limit  ?? "50"), 10), 200);
    const offset = parseInt(String(req.query.offset ?? "0"),  10);

    const { data: messages, error } = await admin
      .from("messages")
      .select("id, to_number, content, created_at, thread_id, status")
      .eq("gateway_id", gateway.id)
      .eq("direction",  "outbound")
      .eq("status",     "pending")
      .order("created_at", { ascending: true })
      .range(offset, offset + limit - 1);

    if (error)
      return res.status(500).json({ error: error.message });

    const queue = (messages || []).map((m: any) => ({
      id:                 m.id,
      deviceId:           gateway.id,
      phoneNumbers:       [m.to_number],
      message:            m.content,
      isEncrypted:        false,
      priority:           1,
      createdAt:          m.created_at,
      withDeliveryReport: true,
      simNumber:          null,
      ttl:                null,
      validUntil:         null,
    }));

    return res.status(200).json(queue);
  }

  // ── PATCH — update message delivery status ────────────────────────────────
  if (req.method === "PATCH") {
    const items: { id: string; status: string }[] = req.body;
    if (!Array.isArray(items) || items.length === 0)
      return res.status(400).json({ error: "Body must be a non-empty array" });

    const results: { id: string; ok: boolean; error?: string }[] = [];

    for (const item of items) {
      const mappedStatus = STATUS_MAP[item.status];
      if (!mappedStatus) {
        results.push({ id: item.id, ok: false, error: `Unknown status: ${item.status}` });
        continue;
      }

      // Update message status
      const { data: updated, error: updateError } = await admin
        .from("messages")
        .update({ status: mappedStatus })
        .eq("id",         item.id)
        .eq("gateway_id", gateway.id)   // scoped to this gateway
        .select("id, thread_id, created_at")
        .single();

      if (updateError || !updated) {
        results.push({ id: item.id, ok: false, error: updateError?.message ?? "Not found" });
        continue;
      }

      // On delivery: update thread timestamp
      if (mappedStatus === "delivered" && updated.thread_id) {
        await admin
          .from("message_threads")
          .update({ last_message_at: new Date().toISOString() })
          .eq("id", updated.thread_id);
      }

      // Audit log
      await admin.from("audit_log").insert({
        action:        "sms_delivered",
        resource_type: "message",
        resource_id:   item.id,
        event_type:    "sms_delivered",
        metadata:      { message_id: item.id, gateway_id: gateway.id, status: mappedStatus },
        tenant_id:     gateway.tenant_id,
      });

      results.push({ id: item.id, ok: true });
    }

    return res.status(200).json({ results });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
