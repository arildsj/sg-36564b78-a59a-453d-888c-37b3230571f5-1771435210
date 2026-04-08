import { supabase } from "@/integrations/supabase/client";

// Actual audit_log columns (database.types.ts is outdated — do not trust it):
// id, user_id, action, resource_type, resource_id, old_data, new_data,
// ip_address, user_agent, created_at, tenant_id,
// event_type, group_id, target_user_id, metadata  ← added in Part 1 migration

export type AuditEventType =
  | "activated"
  | "deactivated"
  | "activation_requested"
  | "activation_confirmed"
  | "activation_rejected"
  | "activation_expired"
  | "admin_override"
  | "min_active_changed"
  | "rule_changed"
  | "rule_matched";

export type AuditLogEntry = {
  id:             string;
  created_at:     string;
  tenant_id:      string | null;
  // actor
  user_id:        string | null;
  actor_name?:    string;           // joined from user_profiles
  // legacy action fields
  action:         string;
  resource_type:  string;
  resource_id:    string | null;
  old_data:       Record<string, unknown> | null;
  new_data:       Record<string, unknown> | null;
  // Part-1 event fields
  event_type:     string | null;
  group_id:       string | null;
  group_name?:    string;           // joined from groups
  target_user_id: string | null;
  target_name?:   string;           // joined from user_profiles
  metadata:       Record<string, unknown> | null;
};

export type AuditLogFilter = {
  group_id?:   string;
  user_id?:    string;
  event_type?: string;
};

// CRITICAL: Cast to any to bypass "Type instantiation is excessively deep" errors
const db = supabase as any;

export const auditService = {
  async getAuditLogs(
    limit = 50,
    filter: AuditLogFilter = {}
  ): Promise<AuditLogEntry[]> {
    let query = db
      .from("audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (filter.group_id)   query = query.eq("group_id", filter.group_id);
    if (filter.user_id)    query = query.eq("user_id",  filter.user_id);
    if (filter.event_type) query = query.eq("event_type", filter.event_type);

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching audit logs:", error);
      throw error;
    }

    if (!data || data.length === 0) return [];

    // Enrich with actor and target names
    const userIds = [
      ...new Set([
        ...data.map((l: any) => l.user_id).filter(Boolean),
        ...data.map((l: any) => l.target_user_id).filter(Boolean),
      ])
    ] as string[];

    const groupIds = [
      ...new Set(data.map((l: any) => l.group_id).filter(Boolean))
    ] as string[];

    const [profilesResult, groupsResult] = await Promise.all([
      userIds.length > 0
        ? db.from("user_profiles").select("id, full_name, email").in("id", userIds)
        : { data: [], error: null },
      groupIds.length > 0
        ? db.from("groups").select("id, name").in("id", groupIds)
        : { data: [], error: null },
    ]);

    const profileMap = new Map(
      (profilesResult.data || []).map((p: any) => [p.id, p.full_name || p.email || p.id])
    );
    const groupMap = new Map(
      (groupsResult.data || []).map((g: any) => [g.id, g.name])
    );

    return data.map((log: any) => ({
      ...log,
      actor_name:  profileMap.get(log.user_id) ?? "System",
      target_name: log.target_user_id ? (profileMap.get(log.target_user_id) ?? log.target_user_id) : null,
      group_name:  log.group_id ? (groupMap.get(log.group_id) ?? log.group_id) : null,
    })) as AuditLogEntry[];
  },

  /**
   * Log a Part-1 structured event.
   * Uses actual DB column names: user_id, action, resource_type, etc.
   */
  async logEvent(entry: {
    event_type:     AuditEventType;
    group_id?:      string | null;
    target_user_id?: string | null;
    metadata?:      Record<string, unknown>;
    resource_type?: string;
    resource_id?:   string | null;
  }) {
    try {
      const { data: authData } = await supabase.auth.getUser();

      let tenant_id: string | null = null;
      if (authData.user) {
        const { data: profile } = await db
          .from("user_profiles")
          .select("tenant_id")
          .eq("id", authData.user.id)
          .single();
        tenant_id = profile?.tenant_id ?? null;
      }

      const { error } = await db.from("audit_log").insert({
        user_id:        authData.user?.id ?? null,
        action:         entry.event_type,
        resource_type:  entry.resource_type ?? "system",
        resource_id:    entry.resource_id   ?? null,
        event_type:     entry.event_type,
        group_id:       entry.group_id       ?? null,
        target_user_id: entry.target_user_id ?? null,
        metadata:       entry.metadata       ?? null,
        tenant_id,
      });

      if (error) console.error("[auditService] Failed to log event:", error);
    } catch (err) {
      console.error("[auditService] Error in logEvent:", err);
    }
  },

  /**
   * Legacy logAction — kept for backward compatibility.
   * Now writes to correct actual DB columns.
   */
  async logAction(entry: {
    action:      string;
    entity_type: string;
    entity_id:   string | null;
    details:     Record<string, unknown>;
  }) {
    try {
      const { data: authData } = await supabase.auth.getUser();

      let tenant_id: string | null = null;
      if (authData.user) {
        const { data: profile } = await db
          .from("user_profiles")
          .select("tenant_id")
          .eq("id", authData.user.id)
          .single();
        tenant_id = profile?.tenant_id ?? null;
      }

      if (!tenant_id) {
        console.warn("[auditService] Could not determine tenant_id for audit log");
        return;
      }

      const { error } = await db.from("audit_log").insert({
        tenant_id,
        user_id:       authData.user?.id ?? null,
        action:        entry.action,
        resource_type: entry.entity_type,
        resource_id:   entry.entity_id,
        old_data:      entry.details,
      });

      if (error) console.error("[auditService] Failed to log action:", error);
    } catch (err) {
      console.error("[auditService] Error in logAction:", err);
    }
  },
};
