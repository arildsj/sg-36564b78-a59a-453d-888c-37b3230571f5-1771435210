-- STEP 1: DROP ALL POLICIES ON user_profiles
DROP POLICY IF EXISTS "Service role has full access to user_profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
DROP POLICY IF EXISTS "insert_own_profile" ON user_profiles;
DROP POLICY IF EXISTS "update_own_profile" ON user_profiles;
DROP POLICY IF EXISTS "users_update_own_profile" ON user_profiles;
DROP POLICY IF EXISTS "users_view_same_tenant_profiles" ON user_profiles;
DROP POLICY IF EXISTS "view_own_profile" ON user_profiles;

-- STEP 2: DISABLE RLS ON user_profiles
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;

-- STEP 3: Add comment explaining why
COMMENT ON TABLE user_profiles IS 'User profiles - RLS completely disabled. All security enforced at application level via permissionService.ts. Never enable RLS on this table due to recursion issues. 2026-02-19';