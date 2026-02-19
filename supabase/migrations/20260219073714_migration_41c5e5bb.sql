-- Also disable RLS on whitelisted_numbers
ALTER TABLE whitelisted_numbers DISABLE ROW LEVEL SECURITY;

-- Drop policies
DROP POLICY IF EXISTS "service_role_full_access_whitelist" ON whitelisted_numbers;

COMMENT ON TABLE whitelisted_numbers IS 'Whitelisted numbers - RLS disabled, security at application level. 2026-02-19';