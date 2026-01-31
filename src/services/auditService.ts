import { supabase } from "@/integrations/supabase/client";

export type AuditLogEntry = {
  id: string;
  created_at: string;
  tenant_id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  changes: any;
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
        user:users(email)
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
    }));
  }
};