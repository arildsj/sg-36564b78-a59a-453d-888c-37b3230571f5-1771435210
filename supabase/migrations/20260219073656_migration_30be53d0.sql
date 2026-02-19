-- FINAL SOLUTION: Completely disable RLS on user_profiles
-- Drop ALL policies first
DROP POLICY IF EXISTS "service_role_full_access" ON user_profiles;
DROP POLICY IF EXISTS "users_view_own_profile_simple" ON user_profiles;

-- Disable RLS entirely
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;

-- Add comment explaining why
COMMENT ON TABLE user_profiles IS 'User profiles - RLS completely disabled due to recursion issues. Security enforced at application level via auth.uid() checks in queries. 2026-02-19';