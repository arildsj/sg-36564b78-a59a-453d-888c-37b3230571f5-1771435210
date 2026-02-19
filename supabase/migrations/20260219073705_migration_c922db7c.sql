-- Also disable RLS on messages to be safe
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;

-- Drop policies
DROP POLICY IF EXISTS "service_role_full_access_messages" ON messages;

COMMENT ON TABLE messages IS 'Messages - RLS disabled, security at application level. 2026-02-19';