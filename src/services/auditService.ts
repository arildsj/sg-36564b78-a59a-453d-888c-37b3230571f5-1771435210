import { supabase } from "@/integrations/supabase/client";

export type AuditLogEntry = {
  id: string;
  timestamp: string;
  user_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  details: any;
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
      .order("timestamp", { ascending: false })
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