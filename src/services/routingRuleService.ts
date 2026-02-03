import { supabase } from "@/integrations/supabase/client";

export type RoutingRule = {
  id: string;
  gateway_id: string;
  target_group_id: string;
  priority: number;
  rule_type: "prefix" | "keyword" | "fallback";
  pattern: string | null;
  is_active: boolean;
  gateway?: {
    id: string;
    name: string;
  };
  target_group?: {
    id: string;
    name: string;
  };
};

export const routingRuleService = {
  async getRoutingRules() {
    const { data, error } = await supabase
      .from("routing_rules")
      .select(`
        *,
        gateway:gateways(id, name),
        target_group:groups(id, name)
      `)
      .order("priority", { ascending: false });

    if (error) throw error;
    return (data || []) as RoutingRule[];
  },

  async getRoutingRulesByGateway(gatewayId: string) {
    const { data, error } = await supabase
      .from("routing_rules")
      .select(`
        *,
        target_group:groups(id, name)
      `)
      .eq("gateway_id", gatewayId)
      .eq("is_active", true)
      .order("priority", { ascending: false });

    if (error) throw error;
    return (data || []) as RoutingRule[];
  },

  async createRoutingRule(rule: {
    gateway_id: string;
    target_group_id: string;
    priority: number;
    rule_type: "prefix" | "keyword" | "fallback";
    pattern?: string;
    is_active?: boolean;
  }) {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session?.user) throw new Error("Not authenticated");

    const { data: user } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("auth_user_id", session.session.user.id)
      .single();

    if (!user) throw new Error("User not found");

    const { data, error } = await supabase
      .from("routing_rules")
      .insert({
        tenant_id: user.tenant_id,
        gateway_id: rule.gateway_id,
        target_group_id: rule.target_group_id,
        priority: rule.priority,
        rule_type: rule.rule_type,
        pattern: rule.pattern || null,
        is_active: rule.is_active ?? true,
      })
      .select()
      .single();

    if (error) throw error;
    return data as RoutingRule;
  },

  async updateRoutingRule(id: string, updates: Partial<RoutingRule>) {
    const { data, error } = await supabase
      .from("routing_rules")
      .update({
        target_group_id: updates.target_group_id,
        priority: updates.priority,
        rule_type: updates.rule_type,
        pattern: updates.pattern,
        is_active: updates.is_active,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data as RoutingRule;
  },

  async deleteRoutingRule(id: string) {
    const { error } = await supabase.from("routing_rules").delete().eq("id", id);

    if (error) throw error;
  },

  async toggleRoutingRule(id: string, isActive: boolean) {
    const { error } = await supabase
      .from("routing_rules")
      .update({ is_active: isActive })
      .eq("id", id);

    if (error) throw error;
  },

  async resolveTargetGroup(
    content: string,
    gatewayId: string,
    tenantId: string
  ): Promise<string | null> {
    // 1. Get all active rules for this gateway sorted by priority
    const { data: rules } = await supabase
      .from("routing_rules")
      .select("*")
      .eq("gateway_id", gatewayId)
      .eq("is_active", true)
      .order("priority", { ascending: false });

    if (rules && rules.length > 0) {
      // 2. Evaluate rules
      for (const rule of rules) {
        if (rule.rule_type === "fallback") {
          return rule.target_group_id;
        }

        if (rule.rule_type === "prefix" && rule.pattern) {
          if (content.toUpperCase().startsWith(rule.pattern.toUpperCase())) {
            return rule.target_group_id;
          }
        }

        if (rule.rule_type === "keyword" && rule.pattern) {
          if (content.toUpperCase().includes(rule.pattern.toUpperCase())) {
            return rule.target_group_id;
          }
        }
      }
    }

    // 3. If no rules matched, look for a group marked as fallback (is_fallback = true)
    const { data: fallbackGroup } = await supabase
      .from("groups")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("is_fallback", true)
      .maybeSingle();

    if (fallbackGroup) {
      return fallbackGroup.id;
    }

    // 4. If no fallback group set, look for any operational group
    const { data: anyGroup } = await supabase
      .from("groups")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("kind", "operational")
      .limit(1)
      .maybeSingle();

    return anyGroup?.id || null;
  },
};