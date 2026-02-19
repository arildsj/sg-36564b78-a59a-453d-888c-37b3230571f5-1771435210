-- ============================================================================
-- FIX: Enable RLS on whitelisted_numbers table
-- ============================================================================

-- Enable RLS
ALTER TABLE whitelisted_numbers ENABLE ROW LEVEL SECURITY;

-- Verify RLS is enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'whitelisted_numbers';