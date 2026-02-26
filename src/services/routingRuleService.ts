import { supabase } from "@/integrations/supabase/client";

// CRITICAL FIX: Cast supabase to any to completely bypass "Type instantiation is excessively deep" errors
const db = supabase as any;

export type RoutingRule = {
  id: string;
  name: string;
  gateway_id: string;
  target_group_id: string;
  match_type: "fallback" | "prefix" | "keyword";
  match_value?: string;
  priority: number;
  is_active: boolean;
  tenant_id: string;
  created_at: string;
};

export const routingRuleService = {
  async getRules(): Promise<RoutingRule[]> {
    const { data, error } = await db
      .from("routing_rules")
      .select(`
        *,
        groups(name),
        sms_gateways(name)
      `)
      .order("priority", { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async createRule(rule: Partial<RoutingRule>) {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error("Not authenticated");

    const { data: profile } = await db
      .from("user_profiles")
      .select("tenant_id")
      .eq("id", user.user.id)
      .single();

    if (!profile) throw new Error("User profile not found");

    const { error } = await db
      .from("routing_rules")
      .insert({
        ...rule,
        tenant_id: profile.tenant_id
      });

    if (error) throw error;
  },

  async updateRule(id: string, updates: Partial<RoutingRule>) {
    const { error } = await db
      .from("routing_rules")
      .update(updates)
      .eq("id", id);

    if (error) throw error;
  },

  async deleteRule(id: string) {
    const { error } = await db
      .from("routing_rules")
      .delete()
      .eq("id", id);

    if (error) throw error;
  },

  async reorderRules(orderedIds: string[]) {
    // Determine priority based on index
    const updates = orderedIds.map((id, index) => ({
      id,
      priority: index
    }));

    const { error } = await db
      .from("routing_rules")
      .upsert(updates);

    if (error) throw error;
  },

  /**
   * Determine target group for an incoming message content
   */
  async resolveRoute(content: string, tenantId: string): Promise<string | null> {
    const { data: rules } = await db
      .from("routing_rules")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .order("priority", { ascending: true });

    if (!rules) return null;

    for (const rule of rules) {
      if (rule.match_type === "keyword" && rule.match_value) {
        if (content.toLowerCase().includes(rule.match_value.toLowerCase())) {
          return rule.target_group_id;
        }
      } else if (rule.match_type === "prefix" && rule.match_value) {
        if (content.toLowerCase().startsWith(rule.match_value.toLowerCase())) {
          return rule.target_group_id;
        }
      } else if (rule.match_type === "fallback") {
        return rule.target_group_id;
      }
    }

    // Default: find any operational group
    const { data: anyGroup } = await db
      .from("groups")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("kind", "operational")
      .limit(1)
      .maybeSingle();

    return anyGroup?.id || null;
  },
};