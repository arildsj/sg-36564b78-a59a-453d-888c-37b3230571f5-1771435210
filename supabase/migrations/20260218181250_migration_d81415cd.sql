-- OPPRETT group_admin_view med RIKTIGE tabellnavn

DROP VIEW IF EXISTS public.group_admin_view CASCADE;

CREATE OR REPLACE VIEW public.group_admin_view AS
SELECT 
  g.id,
  g.name,
  g.kind,
  g.description,
  g.parent_id AS parent_group_id,
  parent_g.name AS parent_name,
  g.gateway_id,
  gw.name AS gateway_name,
  COALESCE(g.gateway_id, parent_g.gateway_id) AS effective_gateway_id,
  CASE 
    WHEN g.gateway_id IS NULL AND parent_g.gateway_id IS NOT NULL THEN true
    ELSE false
  END AS is_gateway_inherited,
  g.tenant_id,
  g.created_at,
  g.updated_at,
  COUNT(DISTINCT gm.user_id) FILTER (WHERE u.status = 'active') AS active_members,
  COUNT(DISTINCT gm.user_id) AS total_members
FROM groups g
LEFT JOIN groups parent_g ON g.parent_id = parent_g.id
LEFT JOIN gateways gw ON g.gateway_id = gw.id
LEFT JOIN group_memberships gm ON g.id = gm.group_id
LEFT JOIN users u ON gm.user_id = u.id
GROUP BY 
  g.id, 
  g.name, 
  g.kind, 
  g.description, 
  g.parent_id,
  parent_g.name,
  g.gateway_id,
  gw.name,
  parent_g.gateway_id,
  g.tenant_id,
  g.created_at,
  g.updated_at;

-- Grant tilgang
GRANT SELECT ON public.group_admin_view TO authenticated;

-- Verifiser
SELECT 
  'group_admin_view created successfully' AS status,
  COUNT(*) AS row_count
FROM public.group_admin_view;