-- Test 1: Super simple view with only 3 columns
DROP VIEW IF EXISTS group_admin_view;

CREATE VIEW group_admin_view AS
SELECT 
  id,
  tenant_id,
  name
FROM groups
WHERE deleted_at IS NULL;

GRANT SELECT ON group_admin_view TO authenticated, service_role;

SELECT 'Simple view created!' as status;