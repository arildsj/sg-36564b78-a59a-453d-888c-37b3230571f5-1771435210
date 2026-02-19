-- Update messages policies to use simpler approach
-- Drop existing policies
DROP POLICY IF EXISTS "users_view_messages_in_groups" ON messages;
DROP POLICY IF EXISTS "service_role_full_access_messages" ON messages;

-- Recreate with simpler logic (tenant_id check only, no group check for now)
CREATE POLICY "users_view_messages_in_tenant"
ON messages
FOR SELECT
TO authenticated
USING (
  tenant_id IN (
    SELECT tenant_id 
    FROM user_profiles 
    WHERE id = auth.uid()
  )
);

CREATE POLICY "service_role_full_access_messages"
ON messages
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

COMMENT ON TABLE messages IS 'Messages - simplified RLS without recursion 2026-02-19';