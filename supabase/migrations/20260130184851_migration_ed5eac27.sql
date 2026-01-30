-- Drop existing policies
DROP POLICY IF EXISTS "Allow group creation during bootstrapping or by admins" ON groups;
DROP POLICY IF EXISTS "Allow group updates during bootstrapping or by admins" ON groups;

-- Allow INSERT during bootstrapping (no authenticated users yet) or by authenticated users
CREATE POLICY "Allow group creation during bootstrapping"
ON groups
FOR INSERT
WITH CHECK (
  -- Allow during bootstrapping: auth.uid is NULL AND no users exist in this tenant yet
  (
    auth.uid() IS NULL 
    AND NOT EXISTS (
      SELECT 1 FROM users 
      WHERE tenant_id = groups.tenant_id
    )
  )
  OR
  -- Allow by any authenticated user who belongs to the same tenant
  (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND tenant_id = groups.tenant_id
    )
  )
);

-- Allow UPDATE during bootstrapping or by authenticated users
CREATE POLICY "Allow group updates during bootstrapping"
ON groups
FOR UPDATE
USING (
  -- Allow during bootstrapping: auth.uid is NULL AND no users exist in this tenant yet
  (
    auth.uid() IS NULL 
    AND NOT EXISTS (
      SELECT 1 FROM users 
      WHERE tenant_id = groups.tenant_id
    )
  )
  OR
  -- Allow by any authenticated user who belongs to the same tenant
  (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND tenant_id = groups.tenant_id
    )
  )
)
WITH CHECK (
  (
    auth.uid() IS NULL 
    AND NOT EXISTS (
      SELECT 1 FROM users 
      WHERE tenant_id = groups.tenant_id
    )
  )
  OR
  (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND tenant_id = groups.tenant_id
    )
  )
);

COMMENT ON POLICY "Allow group creation during bootstrapping" ON groups IS 
'Allows creating groups during onboarding (when no users exist yet) or by authenticated tenant members';

COMMENT ON POLICY "Allow group updates during bootstrapping" ON groups IS 
'Allows updating groups during onboarding (when no users exist yet) or by authenticated tenant members';