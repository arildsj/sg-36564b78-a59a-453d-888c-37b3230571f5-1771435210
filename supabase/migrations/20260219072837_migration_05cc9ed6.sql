-- NUCLEAR OPTION: Drop ALL policies on user_profiles by name
DROP POLICY IF EXISTS "service_role_insert_profiles" ON user_profiles;
DROP POLICY IF EXISTS "tenant_admins_update_tenant_profiles" ON user_profiles;
DROP POLICY IF EXISTS "tenant_admins_view_all_tenant_profiles" ON user_profiles;
DROP POLICY IF EXISTS "tenant_admins_view_tenant_profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can view profiles in same tenant" ON user_profiles;
DROP POLICY IF EXISTS "users_view_own_profile" ON user_profiles;
DROP POLICY IF EXISTS "Allow service role to manage all user profiles" ON user_profiles;

-- Create ULTRA SIMPLE policies with ZERO subqueries
CREATE POLICY "users_view_own_profile_simple"
  ON user_profiles
  FOR SELECT
  TO public
  USING (id = auth.uid());

CREATE POLICY "service_role_full_access"
  ON user_profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Re-enable RLS (it should already be disabled, but make sure)
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE user_profiles IS 'User profiles - ultra simple RLS without any subqueries 2026-02-19';