import { NextApiRequest, NextApiResponse } from "next";
import { createAdminClient } from "@/lib/supabaseAdmin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Vercel cron auth
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`)
    return res.status(401).json({ error: "Unauthorized" });

  const admin = createAdminClient() as any;

  const { data: groups } = await admin
    .from("groups")
    .select("id, tenant_id, name, escalation_timeout_minutes")
    .eq("escalation_enabled", true);

  if (!groups?.length)
    return res.status(200).json({ escalated: 0, reason: "no escalation groups" });

  let totalEscalated = 0;

  for (const group of groups) {
    const threshold = new Date(
      Date.now() - group.escalation_timeout_minutes * 60_000
    ).toISOString();

    const { data: messages } = await admin
      .from("messages")
      .select("id, tenant_id")
      .eq("group_id", group.id)
      .eq("direction", "inbound")
      .is("acknowledged_at", null)
      .lt("created_at", threshold);

    if (!messages?.length) continue;

    const msgIds = messages.map((m: any) => m.id);

    const { data: existing } = await admin
      .from("escalation_events")
      .select("message_id")
      .in("message_id", msgIds);

    const alreadyDone = new Set((existing || []).map((e: any) => e.message_id));

    for (const msg of messages) {
      if (alreadyDone.has(msg.id)) continue;

      const { error: insErr } = await admin.from("escalation_events").insert({
        message_id:            msg.id,
        escalation_level:      1,
        escalated_to_group_id: group.id,
        method:                "cron",
        tenant_id:             msg.tenant_id,
        triggered_at:          new Date().toISOString(),
      });

      if (!insErr) totalEscalated++;
    }
  }

  return res.status(200).json({ escalated: totalEscalated });
}
