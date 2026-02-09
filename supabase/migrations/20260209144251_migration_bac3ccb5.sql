-- Recreate group_admin_view with ONLY columns that actually exist
DROP VIEW IF EXISTS group_admin_view CASCADE;

CREATE VIEW group_admin_view AS
SELECT 
  g.id,
  g.tenant_id,
  g.name,
  g.kind,
  g.parent_id,
  p.name as parent_name,
  g.gateway_id,
  get_group_gateway(g.id) as effective_gateway_id,
  gw.name as gateway_name,
  CASE 
    WHEN g.gateway_id IS NULL AND get_group_gateway(g.id) IS NOT NULL THEN true
    ELSE false
  END as is_gateway_inherited,
  COUNT(DISTINCT gm.user_id) as total_members,
  COUNT(DISTINCT CASE WHEN u.status = 'active' THEN gm.user_id END) as active_members,
  g.created_at,
  g.updated_at
FROM groups g
LEFT JOIN groups p ON g.parent_id = p.id
LEFT JOIN group_memberships gm ON g.id = gm.group_id
LEFT JOIN users u ON gm.user_id = u.id
LEFT JOIN gateways gw ON get_group_gateway(g.id) = gw.id
GROUP BY g.id, g.tenant_id, g.name, g.kind, g.parent_id, p.name, g.gateway_id, gw.name, g.created_at, g.updated_at;

COMMENT ON VIEW group_admin_view IS 'Enriched group information with effective gateway (inherited or direct) for admin UI.';