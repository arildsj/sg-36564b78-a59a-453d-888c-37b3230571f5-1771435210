-- STEP 4: DISABLE RLS ON messages (already done, but verify)
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;

-- STEP 5: DROP ALL POLICIES ON messages
DROP POLICY IF EXISTS "Authenticated users can insert messages" ON messages;
DROP POLICY IF EXISTS "Authenticated users can update messages" ON messages;
DROP POLICY IF EXISTS "Authenticated users can view messages" ON messages;
DROP POLICY IF EXISTS "authenticated_users_insert_messages" ON messages;
DROP POLICY IF EXISTS "authenticated_users_update_messages" ON messages;
DROP POLICY IF EXISTS "authenticated_users_view_messages" ON messages;
DROP POLICY IF EXISTS "authenticated_view_messages" ON messages;
DROP POLICY IF EXISTS "service_role_all_messages" ON messages;
DROP POLICY IF EXISTS "service_role_messages" ON messages;

-- Add comment
COMMENT ON TABLE messages IS 'Messages - RLS completely disabled. All security enforced at application level via permissionService.ts using tenant_id and resolved_group_id checks. 2026-02-19';