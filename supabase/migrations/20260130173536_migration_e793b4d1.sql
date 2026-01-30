-- Fix UPDATE policy for groups to allow bootstrapping during onboarding

DROP POLICY IF EXISTS "Admins can update groups" ON groups;

CREATE POLICY "Allow group updates during onboarding and by admins"
ON groups
FOR UPDATE
USING (
  -- Allow during bootstrapping (no users exist yet in this tenant)
  NOT EXISTS (
    SELECT 1 FROM users u WHERE u.tenant_id = groups.tenant_id
  )
  OR
  -- Or if user is authenticated and is tenant/group admin
  (
    tenant_id = user_tenant_id() 
    AND (is_tenant_admin() OR is_group_admin_for(id))
  )
);

COMMENT ON POLICY "Allow group updates during onboarding and by admins" ON groups IS 
'Allows updating groups during onboarding (when no users exist yet) or by tenant/group admins';