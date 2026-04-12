/**
 * Shared routing utilities used by /api/simulate, /api/mobile/push,
 * and (in copied form) the inbound-message Edge Function.
 *
 * The Edge Function cannot import from src/lib, so it maintains its own
 * copy of these functions inside supabase/functions/inbound-message/index.ts.
 */

export function matchesRule(rule: any, from_number: string, content: string): boolean {
  if (rule.match_type === "sender" && rule.match_value)
    return rule.match_value.trim().toLowerCase() === from_number.trim().toLowerCase();
  if (rule.match_type === "keyword" && rule.match_value)
    return content.toLowerCase().includes(rule.match_value.trim().toLowerCase());
  if (rule.match_type === "prefix" && rule.match_value)
    return content.toLowerCase().startsWith(rule.match_value.trim().toLowerCase());
  if (rule.match_type === "fallback")
    return true;
  return false;
}

/**
 * Evaluates active routing rules for a tenant and returns the matched
 * group ID, or falls back to contactGroupId → gatewayFallbackGroupId.
 *
 * @param db          Supabase admin client (any-cast)
 * @param tenantId    Tenant to scope the rules query
 * @param from_number Sender phone/alphanumeric ID
 * @param content     Message body
 * @param contactGroupId        Group already associated with the contact
 * @param gatewayFallbackGroupId First group linked to the gateway
 */
export async function resolveGroupByRules(
  db: any,
  tenantId: string,
  from_number: string,
  content: string,
  contactGroupId: string | null,
  gatewayFallbackGroupId: string | null
): Promise<string | null> {
  const { data: rules } = await db
    .from("routing_rules")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("priority", { ascending: true });

  if (rules && rules.length > 0) {
    for (const rule of rules) {
      if (matchesRule(rule, from_number, content)) {
        return rule.target_group_id;
      }
    }
  }

  return contactGroupId || gatewayFallbackGroupId;
}
