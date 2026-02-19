-- Final VIEW with ALL columns
DROP VIEW IF EXISTS group_admin_view;

CREATE VIEW group_admin_view AS
SELECT 
  id,
  tenant_id,
  name,
  kind,
  parent_group_id,
  description,
  path,
  depth,
  escalation_enabled,
  escalation_timeout_minutes,
  min_on_duty_count,
  created_at,
  updated_at,
  deleted_at,
  -- Count active members in this group
  (SELECT COUNT(*) 
   FROM group_memberships gm
   WHERE gm.group_id = groups.id 
   AND gm.deleted_at IS NULL
  ) AS member_count,
  -- Get parent group name
  (SELECT pg.name 
   FROM groups pg 
   WHERE pg.id = groups.parent_group_id
  ) AS parent_name
FROM groups
WHERE deleted_at IS NULL;

-- Grant access to authenticated users
GRANT SELECT ON group_admin_view TO authenticated, service_role;

-- Force PostgREST schema reload
NOTIFY pgrst, 'reload schema';

-- Success message
SELECT 'group_admin_view created with ALL columns!' as status;