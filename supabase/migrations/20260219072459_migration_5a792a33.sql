-- Update whitelisted_numbers policies to use simpler approach
-- Drop existing policies
DROP POLICY IF EXISTS "users_view_whitelisted_in_tenant" ON whitelisted_numbers;
DROP POLICY IF EXISTS "service_role_full_access_whitelisted" ON whitelisted_numbers;

-- Recreate with simpler logic
CREATE POLICY "users_view_whitelisted_in_tenant"
ON whitelisted_numbers
FOR SELECT
TO authenticated
USING (
  tenant_id IN (
    SELECT tenant_id 
    FROM user_profiles 
    WHERE id = auth.uid()
  )
);

CREATE POLICY "service_role_full_access_whitelisted"
ON whitelisted_numbers
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

COMMENT ON TABLE whitelisted_numbers IS 'Whitelisted numbers - simplified RLS without recursion 2026-02-19';