-- Test 2: Add more columns one by one
DROP VIEW IF EXISTS group_admin_view;

CREATE VIEW group_admin_view AS
SELECT 
  id,
  tenant_id,
  name,
  kind,
  parent_group_id,  -- Testing this one specifically
  description,
  path,
  depth
FROM groups
WHERE deleted_at IS NULL;

GRANT SELECT ON group_admin_view TO authenticated, service_role;

SELECT 'View with parent_group_id created!' as status;