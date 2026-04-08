import { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { createAdminClient, getRequestUser, getUserProfile } from "@/lib/supabaseAdmin";
import { sendGroupNotification } from "@/services/NotificationService";

const bodySchema = z.object({
  group_id:           z.string().uuid(),
  requested_user_ids: z.array(z.string().uuid()).min(1).max(20),
  message:            z.string().max(500).optional(),
});

const REQUEST_EXPIRY_MINUTES = 10;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // ── Auth ──────────────────────────────────────────────────────────────
  const user = await getRequestUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const profile = await getUserProfile(user.id).catch(() => null);
  if (!profile) return res.status(401).json({ error: "User profile not found" });

  // ── Validate body ─────────────────────────────────────────────────────
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0].message });
  }

  const { group_id, requested_user_ids, message } = parsed.data;
  const admin = createAdminClient();

  // ── Load group ────────────────────────────────────────────────────────
  const { data: group, error: groupError } = await admin
    .from("groups")
    .select("id, name, min_active")
    .eq("id", group_id)
    .single();

  if (groupError || !group) {
    return res.status(404).json({ error: "Group not found" });
  }

  // ── Count currently active members ───────────────────────────────────
  const { count: activeCount, error: countError } = await admin
    .from("group_members")
    .select("*", { count: "exact", head: true })
    .eq("group_id", group_id)
    .eq("is_active", true);

  if (countError) {
    return res.status(500).json({ error: "Failed to check active member count" });
  }

  const current = activeCount ?? 0;

  // ── Expire any stale pending requests for this requester in this group ─
  const expiredBefore = new Date(
    Date.now() - REQUEST_EXPIRY_MINUTES * 60 * 1000
  ).toISOString();

  await admin
    .from("activation_requests")
    .update({ status: "expired" })
    .eq("group_id", group_id)
    .eq("requester_id", user.id)
    .eq("status", "pending")
    .lt("created_at", expiredBefore);

  // ── If enough members are active, allow immediate deactivation ────────
  if (current > (group.min_active ?? 0)) {
    const { error: deactivateError } = await admin
      .from("group_members")
      .update({ is_active: false })
      .eq("group_id", group_id)
      .eq("user_id", user.id);

    if (deactivateError) {
      return res.status(500).json({ error: "Failed to deactivate user" });
    }

    await admin.from("audit_log").insert({
      user_id:      user.id,
      action:       "deactivate",
      resource_type: "group_members",
      resource_id:   group_id,
      event_type:   "deactivated",
      group_id,
      metadata:     { group_name: group.name, immediate: true },
      tenant_id:    profile.tenant_id,
    });

    return res.status(200).json({
      deactivated: true,
      message:     "Deactivated immediately — enough active members remain",
    });
  }

  // ── Not enough buffer — create a handover request ─────────────────────
  const { data: requestRecord, error: insertError } = await admin
    .from("activation_requests")
    .insert({
      group_id,
      requester_id:       user.id,
      requested_user_ids,
      message:            message ?? null,
      status:             "pending",
      tenant_id:          profile.tenant_id,
    })
    .select("id")
    .single();

  if (insertError || !requestRecord) {
    return res.status(500).json({ error: "Failed to create activation request" });
  }

  await admin.from("audit_log").insert({
    user_id:      user.id,
    action:       "activation_request",
    resource_type: "activation_requests",
    resource_id:   requestRecord.id,
    event_type:   "activation_requested",
    group_id,
    metadata:     {
      group_name:         group.name,
      requested_user_ids,
      message:            message ?? null,
      expires_in_minutes: REQUEST_EXPIRY_MINUTES,
    },
    tenant_id:    profile.tenant_id,
  });

  // ── Notify the requested users ─────────────────────────────────────────
  const notifyTitle = `Forespørsel om vaktoverlapp — ${group.name}`;
  const notifyBody  = message
    ? `${profile.full_name}: ${message}`
    : `${profile.full_name} ber om at noen overtar vakten i ${group.name}.`;

  await sendGroupNotification(requested_user_ids, notifyTitle, notifyBody, {
    type:       "activation_request",
    request_id: requestRecord.id,
    group_id,
  });

  return res.status(201).json({
    request_id: requestRecord.id,
    deactivated: false,
    message: "Handover request created. Notified requested users.",
  });
}
