import { NextApiRequest, NextApiResponse } from "next";
import { createAdminClient } from "@/lib/supabaseAdmin";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Verify CRON_SECRET so only Vercel Cron (or authorised callers) can trigger this
  const authHeader = req.headers.authorization;
  const secret = process.env.CRON_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const admin = createAdminClient();

  // Find all pending activation requests older than 10 minutes
  const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  const { data: expired, error: fetchError } = await admin
    .from("activation_requests")
    .select("id, group_id, tenant_id")
    .eq("status", "pending")
    .lt("created_at", cutoff);

  if (fetchError) {
    console.error("[expire-activations] Failed to fetch expired requests:", fetchError);
    return res.status(500).json({ error: "Failed to fetch expired requests" });
  }

  if (!expired || expired.length === 0) {
    return res.status(200).json({ expired: 0 });
  }

  const expiredIds = expired.map((r) => r.id);

  // Mark them all expired in one update
  const { error: updateError } = await admin
    .from("activation_requests")
    .update({ status: "expired", resolved_at: new Date().toISOString() })
    .in("id", expiredIds);

  if (updateError) {
    console.error("[expire-activations] Failed to expire requests:", updateError);
    return res.status(500).json({ error: "Failed to update expired requests" });
  }

  // Write one audit_log row per expired request
  const auditRows = expired.map((r) => ({
    user_id:       null as string | null,
    action:        "expire_activation_request",
    resource_type: "activation_request",
    resource_id:   r.id,
    event_type:    "activation_expired",
    group_id:      r.group_id ?? null,
    tenant_id:     r.tenant_id ?? null,
    metadata:      { reason: "pending_timeout_10min", cutoff },
  }));

  const { error: auditError } = await admin.from("audit_log").insert(auditRows);
  if (auditError) {
    // Non-fatal — the expiries are already committed
    console.error("[expire-activations] Failed to write audit log:", auditError);
  }

  console.log(`[expire-activations] Expired ${expired.length} activation request(s)`);
  return res.status(200).json({ expired: expired.length, ids: expiredIds });
}
