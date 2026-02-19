-- Also fix whitelisted_numbers - same issue
DROP POLICY IF EXISTS "service_role_full_access_whitelisted" ON whitelisted_numbers;
DROP POLICY IF EXISTS "tenant_admins_manage_whitelisted_numbers" ON whitelisted_numbers;
DROP POLICY IF EXISTS "users_view_whitelisted_in_tenant" ON whitelisted_numbers;
DROP POLICY IF EXISTS "users_view_whitelisted_numbers" ON whitelisted_numbers;

-- Create simple policies
CREATE POLICY "service_role_whitelisted"
  ON whitelisted_numbers
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "authenticated_users_view_whitelisted"
  ON whitelisted_numbers
  FOR SELECT
  TO authenticated
  USING (true);  -- Let application filter by tenant_id

COMMENT ON TABLE whitelisted_numbers IS 'Whitelisted numbers - ultra simple RLS 2026-02-19';