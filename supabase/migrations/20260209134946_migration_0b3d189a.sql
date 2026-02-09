-- Recreate group_admin_view with correct column names (without on_duty if it doesn't exist)
DROP VIEW IF EXISTS group_admin_view CASCADE;

CREATE OR REPLACE VIEW group_admin_view AS
SELECT 
  g.id,
  g.name,
  g.kind,
  g.parent_id,
  g.tenant_id,
  g.description,
  g.gateway_id,
  g.created_at,
  g.updated_at,
  gw.name AS gateway_name,
  gw.phone_number AS gateway_phone,
  get_group_gateway(g.id) AS effective_gateway_id,
  CASE 
    WHEN g.gateway_id IS NULL AND get_group_gateway(g.id) IS NOT NULL THEN true
    ELSE false
  END AS is_gateway_inherited,
  (SELECT COUNT(*) 
   FROM group_memberships gm 
   WHERE gm.group_id = g.id) AS total_members,
  (SELECT COUNT(*) 
   FROM group_memberships gm 
   JOIN users u ON gm.user_id = u.id 
   WHERE gm.group_id = g.id AND u.status = 'active') AS active_members
FROM groups g
LEFT JOIN gateways gw ON g.gateway_id = gw.id;

COMMENT ON VIEW group_admin_view IS 'Enriched group information with effective gateway (inherited or direct) for admin UI.';