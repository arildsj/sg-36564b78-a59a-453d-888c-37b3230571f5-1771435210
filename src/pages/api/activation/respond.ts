import { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { createAdminClient, getRequestUser, getUserProfile } from "@/lib/supabaseAdmin";
import { sendPushNotification } from "@/services/NotificationService";

const bodySchema = z.object({
  request_id: z.string().uuid(),
  response:   z.enum(["accepted", "rejected"]),
});

const REQUEST_EXPIRY_MINUTES = 10;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const user = await getRequestUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const profile = await getUserProfile(user.id).catch(() => null);
  if (!profile) return res.status(401).json({ error: "User profile not found" });

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0].message });
  }

  const { request_id, response } = parsed.data;
  const admin = createAdminClient();

  // ── Load the activation request ───────────────────────────────────────
  const { data: request, error: requestError } = await admin
    .from("activation_requests")
    .select("id, group_id, requester_id, requested_user_ids, status, created_at, tenant_id")
    .eq("id", request_id)
    .single();

  if (requestError || !request) {
    return res.status(404).json({ error: "Activation request not found" });
  }

  // ── Verify the caller was invited ─────────────────────────────────────
  if (!(request.requested_user_ids as string[]).includes(user.id)) {
    return res.status(403).json({ error: "You were not invited to respond to this request" });
  }

  // ── Check expiry ──────────────────────────────────────────────────────
  const createdAt  = new Date(request.created_at).getTime();
  const expiresAt  = createdAt + REQUEST_EXPIRY_MINUTES * 60 * 1000;
  const now        = Date.now();

  if (now > expiresAt) {
    await admin
      .from("activation_requests")
      .update({ status: "expired" })
      .eq("id", request_id)
      .eq("status", "pending");

    return res.status(410).json({ error: "This activation request has expired" });
  }

  if (request.status !== "pending") {
    return res.status(409).json({
      error: `Request is already ${request.status}`,
    });
  }

  // ── Load group ────────────────────────────────────────────────────────
  const { data: group, error: groupError } = await admin
    .from("groups")
    .select("id, name, min_active")
    .eq("id", request.group_id)
    .single();

  if (groupError || !group) {
    return res.status(500).json({ error: "Failed to load group" });
  }

  // ────────────────────────── ACCEPTED ──────────────────────────────────
  if (response === "accepted") {
    // Activate the responding user
    const { error: activateError } = await admin
      .from("group_memberships")
      .update({ is_active: true, last_active_at: new Date().toISOString() })
      .eq("group_id", request.group_id)
      .eq("user_id", user.id);

    if (activateError) {
      return res.status(500).json({ error: "Failed to activate user" });
    }

    // Mark request resolved
    await admin
      .from("activation_requests")
      .update({
        status:      "accepted",
        resolved_at: new Date().toISOString(),
        resolved_by: user.id,
      })
      .eq("id", request_id);

    await admin.from("audit_log").insert({
      user_id:       user.id,
      action:        "activation_confirmed",
      resource_type: "activation_requests",
      resource_id:   request_id,
      event_type:    "activation_confirmed",
      group_id:      request.group_id,
      target_user_id: user.id,
      metadata:      { group_name: group.name, request_id },
      tenant_id:     request.tenant_id,
    });

    // Re-check if requester A can now go off duty
    const { count: activeCount } = await admin
      .from("group_memberships")
      .select("*", { count: "exact", head: true })
      .eq("group_id", request.group_id)
      .eq("is_active", true);

    const newActive = activeCount ?? 0;

    if (newActive - 1 >= (group.min_active ?? 0)) {
      const { error: deactivateError } = await admin
        .from("group_memberships")
        .update({ is_active: false, last_active_at: new Date().toISOString() })
        .eq("group_id", request.group_id)
        .eq("user_id", request.requester_id);

      if (!deactivateError) {
        await admin.from("audit_log").insert({
          user_id:        user.id,
          action:         "deactivate",
          resource_type:  "group_memberships",
          resource_id:    request.group_id,
          event_type:     "deactivated",
          group_id:       request.group_id,
          target_user_id: request.requester_id,
          metadata:       { group_name: group.name, triggered_by_request_id: request_id },
          tenant_id:      request.tenant_id,
        });
      }
    }

    return res.status(200).json({
      accepted: true,
      message:  "You are now active. The requester has been deactivated if the minimum was met.",
    });
  }

  // ────────────────────────── REJECTED ──────────────────────────────────
  // Mark the request as rejected immediately so the requester sees feedback
  // via Realtime without delay.
  await admin
    .from("activation_requests")
    .update({
      status:      "rejected",
      resolved_at: new Date().toISOString(),
      resolved_by: user.id,
    })
    .eq("id", request_id);

  await admin.from("audit_log").insert({
    user_id:        user.id,
    action:         "activation_rejected",
    resource_type:  "activation_requests",
    resource_id:    request_id,
    event_type:     "activation_rejected",
    group_id:       request.group_id,
    target_user_id: request.requester_id,
    metadata:       { group_name: group.name, rejected_by: user.id, request_id },
    tenant_id:      request.tenant_id,
  });

  // Notify the requester
  await sendPushNotification(
    request.requester_id,
    `Forespørsel avslått — ${group.name}`,
    `${profile.full_name || profile.email || "En bruker"} avslo forespørselen. Du er fortsatt aktiv.`,
    { type: "activation_rejected", group_id: request.group_id }
  );

  return res.status(200).json({ accepted: false, message: "Rejection recorded." });
}
