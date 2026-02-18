import { supabase } from "@/integrations/supabase/client";

export type AuditLogEntry = {
  id: string;
  created_at: string;
  tenant_id: string;
  actor_user_id: string | null;
  action_type: string;
  entity_type: string;
  entity_id: string | null;
  metadata: any;
  ip_address: string | null;
  user_agent: string | null;
  user_email?: string; // Joined field
};

export const auditService = {
  async getAuditLogs(limit = 50): Promise<AuditLogEntry[]> {
    const { data, error } = await supabase
      .from("audit_log")
      .select(`
        *,
        user:user_profiles(email)
      `)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Error fetching audit logs:", error);
      throw error;
    }

    return (data || []).map((log: any) => ({
      ...log,
      user_email: log.user?.email || "System/Unknown"
    })) as AuditLogEntry[];
  },

  async logAction(entry: {
    action: string;
    entity_type: string;
    entity_id: string | null;
    details: any;
  }) {
    try {
      const { data: user } = await supabase.auth.getUser();
      
      let tenant_id = null;
      if (user.user) {
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('tenant_id')
            .eq('id', user.user.id)
            .single();
          tenant_id = profile?.tenant_id;
      }

      if (!tenant_id) {
        console.warn("Could not determine tenant_id for audit log");
        return; 
      }

      const { error } = await supabase.from("audit_log").insert({
        tenant_id,
        scope: "tenant",
        actor_user_id: user.user?.id,
        action_type: entry.action,
        entity_type: entry.entity_type,
        entity_id: entry.entity_id,
        metadata: entry.details,
      });

      if (error) {
        console.error("Failed to log audit action:", error);
      }
    } catch (err) {
      console.error("Error in logAction:", err);
    }
  }
};