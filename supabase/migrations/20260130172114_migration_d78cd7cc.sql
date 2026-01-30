-- Fix RLS policy for groups to allow bootstrapping during onboarding

-- Drop the existing restrictive INSERT policy
DROP POLICY IF EXISTS "Tenant admins can insert groups" ON groups;

-- Create new policy that allows:
-- 1. Bootstrapping (no users exist in tenant yet) - for onboarding
-- 2. Tenant admins (normal operation)
CREATE POLICY "Allow group creation during onboarding and by admins"
ON groups
FOR INSERT
TO public
WITH CHECK (
  -- Allow if no users exist for this tenant yet (bootstrapping/onboarding)
  (NOT EXISTS (
    SELECT 1 FROM users u WHERE u.tenant_id = groups.tenant_id
  ))
  OR
  -- Allow if user is a tenant admin (normal operation)
  ((tenant_id = user_tenant_id()) AND is_tenant_admin())
);

COMMENT ON POLICY "Allow group creation during onboarding and by admins" ON groups IS 
'Allows creating groups during onboarding (when no users exist yet) or by tenant admins';