-- ============================================================================
-- FIX: Clean up whitelisted_numbers policies
-- ============================================================================

-- Drop duplicate/conflicting policies
DROP POLICY IF EXISTS "authenticated_view_whitelist" ON whitelisted_numbers;
DROP POLICY IF EXISTS "authenticated_users_view_whitelisted" ON whitelisted_numbers;
DROP POLICY IF EXISTS "service_role_whitelisted" ON whitelisted_numbers;

-- Create clean, simple policies
CREATE POLICY "select_whitelisted_numbers"
  ON whitelisted_numbers
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "service_role_all_whitelisted"
  ON whitelisted_numbers
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Verify
SELECT 
  polname AS policy_name,
  polcmd AS command,
  polroles::regrole[] AS roles
FROM pg_policy
WHERE polrelid = 'public.whitelisted_numbers'::regclass
ORDER BY polname;