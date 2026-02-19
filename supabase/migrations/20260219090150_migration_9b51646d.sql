-- ============================================================================
-- FIX: Create CORRECT RLS policies for user_profiles (using 'id' column)
-- ============================================================================

-- Drop any existing policies first
DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Service role has full access to user_profiles" ON user_profiles;

-- Policy 1: Users can view their own profile (NO RECURSION - uses auth.uid() directly)
CREATE POLICY "Users can view their own profile"
  ON user_profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Policy 2: Users can update their own profile (NO RECURSION)
CREATE POLICY "Users can update their own profile"
  ON user_profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Policy 3: Service role has full access (for backend operations)
CREATE POLICY "Service role has full access to user_profiles"
  ON user_profiles
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Verify policies were created
SELECT 
  polname AS policy_name,
  polcmd AS command,
  polpermissive AS permissive
FROM pg_policy
WHERE polrelid = 'public.user_profiles'::regclass
ORDER BY polname;