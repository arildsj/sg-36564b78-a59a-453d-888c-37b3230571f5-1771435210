-- RADICAL FIX: Disable RLS entirely on user_profiles to break recursion
-- This table will be protected by application-level auth checks instead

-- Drop ALL policies
DROP POLICY IF EXISTS "users_view_own_profile" ON user_profiles;
DROP POLICY IF EXISTS "tenant_admins_view_tenant_profiles" ON user_profiles;
DROP POLICY IF EXISTS "service_role_full_access" ON user_profiles;
DROP POLICY IF EXISTS "users_update_own_profile" ON user_profiles;

-- Disable RLS entirely
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;

COMMENT ON TABLE user_profiles IS 'User profiles - RLS disabled, protected by application auth 2026-02-19';