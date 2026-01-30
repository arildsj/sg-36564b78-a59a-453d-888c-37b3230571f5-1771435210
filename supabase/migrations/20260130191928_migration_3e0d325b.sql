-- Add a bootstrapping policy for gateways (similar to groups)
-- Allow gateway creation during tenant setup when user is first admin
CREATE POLICY "Allow gateway creation during bootstrapping" 
ON gateways 
FOR INSERT 
WITH CHECK (
  -- Allow if this is during bootstrapping (no gateways exist for this tenant yet)
  (NOT EXISTS (
    SELECT 1 FROM gateways g WHERE g.tenant_id = gateways.tenant_id
  ))
  OR
  -- Or if user is tenant admin
  ((tenant_id = user_tenant_id()) AND is_tenant_admin())
);