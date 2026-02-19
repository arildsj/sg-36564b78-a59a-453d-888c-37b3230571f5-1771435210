-- ============================================================================
-- EMERGENCY FIX: Drop ALL policies and create SIMPLE ones
-- ============================================================================

-- Drop all existing policies on user_profiles
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can delete own profile" ON user_profiles;

-- Drop all existing policies on messages
DROP POLICY IF EXISTS "Users view messages in their tenant" ON messages;
DROP POLICY IF EXISTS "Users insert messages in their tenant" ON messages;
DROP POLICY IF EXISTS "Users update messages in their tenant" ON messages;
DROP POLICY IF EXISTS "Users delete messages in their tenant" ON messages;

-- Create SIMPLEST possible policies using ONLY auth.uid()
-- NO function calls, NO joins, NO subqueries!

-- user_profiles: Direct auth.uid() match
CREATE POLICY "view_own_profile" ON user_profiles
  FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "insert_own_profile" ON user_profiles
  FOR INSERT
  WITH CHECK (id = auth.uid());

CREATE POLICY "update_own_profile" ON user_profiles
  FOR UPDATE
  USING (id = auth.uid());

-- messages: Allow service_role full access, users can see all for now
CREATE POLICY "service_role_all_messages" ON messages
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "authenticated_view_messages" ON messages
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- whitelisted_numbers: Allow authenticated users to view
CREATE POLICY "authenticated_view_whitelist" ON whitelisted_numbers
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Reload schema
NOTIFY pgrst, 'reload schema';

SELECT 'All policies recreated with NO recursion!' AS status;