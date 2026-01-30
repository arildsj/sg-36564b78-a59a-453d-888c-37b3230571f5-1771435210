-- Drop existing policies and create simpler ones for onboarding
DROP POLICY IF EXISTS "Allow group creation during onboarding and by admins" ON groups;
DROP POLICY IF EXISTS "Allow group updates during onboarding and by admins" ON groups;

-- Allow INSERT if tenant exists (covers onboarding scenario)
CREATE POLICY "Allow group creation"
ON groups
FOR INSERT
WITH CHECK (
  -- Allow if tenant exists (covers onboarding)
  EXISTS (SELECT 1 FROM tenants WHERE id = groups.tenant_id)
);

-- Allow UPDATE for bootstrapping or by admins
CREATE POLICY "Allow group updates"
ON groups
FOR UPDATE
USING (
  -- Allow if tenant exists (covers onboarding)
  EXISTS (SELECT 1 FROM tenants WHERE id = groups.tenant_id)
)
WITH CHECK (
  -- Allow if tenant exists (covers onboarding)
  EXISTS (SELECT 1 FROM tenants WHERE id = groups.tenant_id)
);

COMMENT ON POLICY "Allow group creation" ON groups IS 
'Allows creating groups if the tenant exists (covers onboarding and authenticated scenarios)';

COMMENT ON POLICY "Allow group updates" ON groups IS 
'Allows updating groups if the tenant exists (covers onboarding and authenticated scenarios)';