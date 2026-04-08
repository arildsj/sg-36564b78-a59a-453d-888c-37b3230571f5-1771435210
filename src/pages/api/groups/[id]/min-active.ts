import { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { createAdminClient, getRequestUser, getUserProfile } from "@/lib/supabaseAdmin";

const bodySchema = z.object({
  min_active: z.number().int().min(0),
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

  const group_id = req.query.id as string;
  if (!group_id) return res.status(400).json({ error: "Missing group id" });

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0].message });
  }

  const { min_active: newMinActive } = parsed.data;
  const admin = createAdminClient();

  // group_admin must have permission for this group
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

  // ── Load current group data ───────────────────────────────────────────
  const { data: group, error: groupError } = await admin
    .from("groups")
    .select("id, name, min_active")
    .eq("id", group_id)
    .single();

  if (groupError || !group) {
    return res.status(404).json({ error: "Group not found" });
  }

  // ── Count total group members ─────────────────────────────────────────
  const { count: memberCount, error: memberCountError } = await admin
    .from("group_members")
    .select("*", { count: "exact", head: true })
    .eq("group_id", group_id);

  if (memberCountError) {
    return res.status(500).json({ error: "Failed to count group members" });
  }

  const total = memberCount ?? 0;

  if (newMinActive > total) {
    return res.status(422).json({
      error: `min_active (${newMinActive}) cannot exceed current member count (${total})`,
      member_count: total,
      requested:    newMinActive,
    });
  }

  const oldMinActive = group.min_active ?? 0;

  // ── Apply the change ──────────────────────────────────────────────────
  const { error: updateError } = await admin
    .from("groups")
    .update({ min_active: newMinActive })
    .eq("id", group_id);

  if (updateError) {
    return res.status(500).json({ error: "Failed to update min_active" });
  }

  // ── Audit log ─────────────────────────────────────────────────────────
  await admin.from("audit_log").insert({
    user_id:       user.id,
    action:        "min_active_changed",
    resource_type: "groups",
    resource_id:   group_id,
    event_type:    "min_active_changed",
    group_id,
    metadata: {
      group_name: group.name,
      old_value:  oldMinActive,
      new_value:  newMinActive,
    },
    tenant_id: profile.tenant_id,
  });

  return res.status(200).json({
    group_id,
    min_active: newMinActive,
    previous:   oldMinActive,
  });
}
