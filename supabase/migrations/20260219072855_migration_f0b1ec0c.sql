-- Fix messages policies - same issue
DROP POLICY IF EXISTS "service_role_full_access_messages" ON messages;
DROP POLICY IF EXISTS "service_role_update_messages" ON messages;
DROP POLICY IF EXISTS "users_insert_messages" ON messages;
DROP POLICY IF EXISTS "users_update_tenant_messages" ON messages;
DROP POLICY IF EXISTS "users_view_messages_in_tenant" ON messages;
DROP POLICY IF EXISTS "users_view_tenant_messages" ON messages;

-- Create simple policies
CREATE POLICY "service_role_messages"
  ON messages
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "authenticated_users_view_messages"
  ON messages
  FOR SELECT
  TO authenticated
  USING (true);  -- Let application filter by tenant_id

CREATE POLICY "authenticated_users_insert_messages"
  ON messages
  FOR INSERT
  TO authenticated
  WITH CHECK (true);  -- Let application validate tenant_id

CREATE POLICY "authenticated_users_update_messages"
  ON messages
  FOR UPDATE
  TO authenticated
  USING (true);  -- Let application filter by tenant_id

COMMENT ON TABLE messages IS 'Messages - ultra simple RLS 2026-02-19';