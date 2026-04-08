import { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { createAdminClient, getRequestUser, getUserProfile } from "@/lib/supabaseAdmin";

const bodySchema = z.object({
  group_id:       z.string().uuid(),
  target_user_id: z.string().uuid(),
  set_active:     z.boolean(),
  reason:         z.string().max(500).optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // ── Auth — group_admin or tenant_admin only ───────────────────────────
  const user = await getRequestUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const profile = await getUserProfile(user.id).catch(() => null);
  if (!profile) return res.status(401).json({ error: "User profile not found" });

  if (!["tenant_admin", "group_admin"].includes(profile.role)) {
    return res.status(403).json({ error: "Requires group_admin or tenant_admin role" });
  }

  // group_admin must administer this specific group
  const admin = createAdminClient();

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0].message });
  }

  const { group_id, target_user_id, set_active, reason } = parsed.data;

  if (profile.role === "group_admin") {
    const { data: perm, error: permError } = await admin
      .from("admin_group_permissions")
      .select("id")
      .eq("user_id", user.id)
      .eq("group_id", group_id)
      .maybeSingle();

    if (permError || !perm) {
      return res.status(403).json({ error: "You are not an admin of this group" });
    }
  }

  // ── Load group ────────────────────────────────────────────────────────
  const { data: group, error: groupError } = await admin
    .from("groups")
    .select("id, name, min_active")
    .eq("id", group_id)
    .single();

  if (groupError || !group) {
    return res.status(404).json({ error: "Group not found" });
  }

  // ── Safety check when deactivating ───────────────────────────────────
  if (!set_active) {
    const { count: activeCount, error: countError } = await admin
      .from("group_members")
      .select("*", { count: "exact", head: true })
      .eq("group_id", group_id)
      .eq("is_active", true);

    if (countError) {
      return res.status(500).json({ error: "Failed to check active member count" });
    }

    const current = activeCount ?? 0;

    if (current - 1 < (group.min_active ?? 0)) {
      return res.status(422).json({
        error: `Cannot deactivate: active count would drop below min_active (${group.min_active}). ` +
               `Lower min_active for this group first.`,
        current_active: current,
        min_active:     group.min_active,
      });
    }
  }

  // ── Apply the change ──────────────────────────────────────────────────
  const { error: upsertError } = await admin
    .from("group_members")
    .upsert(
      { group_id, user_id: target_user_id, is_active: set_active },
      { onConflict: "group_id,user_id" }
    );

  if (upsertError) {
    return res.status(500).json({ error: "Failed to update group member status" });
  }

  // ── Audit log ─────────────────────────────────────────────────────────
  await admin.from("audit_log").insert({
    user_id:        user.id,
    action:         "admin_override",
    resource_type:  "group_members",
    resource_id:    group_id,
    event_type:     "admin_override",
    group_id,
    target_user_id,
    metadata: {
      group_name:   group.name,
      set_active,
      admin_id:     user.id,
      reason:       reason ?? null,
    },
    tenant_id: profile.tenant_id,
  });

  return res.status(200).json({
    updated:    true,
    group_id,
    user_id:    target_user_id,
    is_active:  set_active,
  });
}
