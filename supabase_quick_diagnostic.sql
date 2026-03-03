-- ============================================
-- SEMSE 2.0 - RASK DIAGNOSTIKK
-- Kjør denne og gi meg outputten
-- ============================================

-- 1. Finn alle RLS policies (viktigst!)
SELECT 
  '=== RLS POLICIES ===' AS info,
  tablename,
  policyname,
  cmd AS operation,
  qual AS using_expression,
  with_check AS check_expression
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('groups', 'contacts', 'group_memberships', 'user_profiles')
ORDER BY tablename, policyname;

-- 2. Sjekk om gateway_id kolonnen finnes
SELECT 
  '=== GROUPS COLUMNS ===' AS info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'groups'
AND column_name IN ('gateway_id', 'escalation_enabled', 'tenant_id', 'parent_id')
ORDER BY column_name;

-- 3. Få eksempeldata fra groups
SELECT 
  '=== GROUPS SAMPLE ===' AS info,
  id,
  name,
  tenant_id,
  gateway_id,
  parent_id
FROM groups
LIMIT 5;

-- 4. Få eksempeldata fra group_memberships
SELECT 
  '=== MEMBERSHIPS SAMPLE ===' AS info,
  id,
  user_id,
  group_id,
  tenant_id
FROM group_memberships
LIMIT 5;

-- ============================================
-- FERDIG! Send meg hele outputten
-- ============================================