-- ============================================================================
-- CRITICAL FIX: Disable RLS on audit_log to prevent recursion
-- Audit logs should only be written by SECURITY DEFINER functions anyway
-- ============================================================================

-- Drop all policies on audit_log
DROP POLICY IF EXISTS "Tenant admins can view audit log" ON audit_log;

-- Disable RLS entirely on audit_log
ALTER TABLE audit_log DISABLE ROW LEVEL SECURITY;

-- Verify
SELECT 
  relname AS table_name,
  relrowsecurity AS rls_enabled
FROM pg_class
WHERE relname = 'audit_log'
  AND relnamespace = 'public'::regnamespace;