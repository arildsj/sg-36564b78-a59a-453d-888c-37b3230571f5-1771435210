-- ============================================
-- SEMSE 2.0 - DIAGNOSTISK DATABASE ANALYSE
-- Kjør dette i Supabase SQL Editor
-- Kopier HELE outputten og lim inn i chat
-- ============================================

-- 1. TABELLSTRUKTUR MED KOLONNER
SELECT 
  '=== TABLE STRUCTURE ===' AS section,
  t.table_name,
  c.column_name,
  c.data_type,
  c.is_nullable,
  c.column_default,
  CASE 
    WHEN pk.column_name IS NOT NULL THEN 'PRIMARY KEY'
    ELSE ''
  END AS key_type
FROM information_schema.tables t
JOIN information_schema.columns c ON c.table_name = t.table_name
LEFT JOIN (
  SELECT ku.table_name, ku.column_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage ku 
    ON tc.constraint_name = ku.constraint_name
  WHERE tc.constraint_type = 'PRIMARY KEY'
) pk ON pk.table_name = c.table_name AND pk.column_name = c.column_name
WHERE t.table_schema = 'public'
AND t.table_type = 'BASE TABLE'
AND t.table_name IN (
  'tenants', 
  'user_profiles', 
  'sms_gateways', 
  'groups', 
  'group_memberships', 
  'contacts',
  'messages',
  'routing_rules',
  'on_duty_state'
)
ORDER BY t.table_name, c.ordinal_position;

-- 2. FOREIGN KEY RELATIONSHIPS
SELECT 
  '=== FOREIGN KEYS ===' AS section,
  tc.table_name AS from_table,
  kcu.column_name AS from_column,
  ccu.table_name AS to_table,
  ccu.column_name AS to_column,
  rc.delete_rule AS on_delete
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints AS rc
  ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;

-- 3. INDEXES
SELECT 
  '=== INDEXES ===' AS section,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN (
  'tenants', 
  'user_profiles', 
  'sms_gateways', 
  'groups', 
  'group_memberships', 
  'contacts',
  'messages',
  'routing_rules'
)
ORDER BY tablename, indexname;

-- 4. RLS POLICIES
SELECT 
  '=== RLS POLICIES ===' AS section,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd AS operation,
  qual AS using_clause,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN (
  'user_profiles', 
  'groups', 
  'group_memberships', 
  'contacts',
  'messages'
)
ORDER BY tablename, policyname;

-- 5. CHECK CONSTRAINTS
SELECT 
  '=== CHECK CONSTRAINTS ===' AS section,
  tc.table_name,
  tc.constraint_name,
  cc.check_clause
FROM information_schema.table_constraints tc
JOIN information_schema.check_constraints cc
  ON tc.constraint_name = cc.constraint_name
WHERE tc.table_schema = 'public'
AND tc.constraint_type = 'CHECK'
ORDER BY tc.table_name;

-- 6. SAMPLE DATA - TENANTS
SELECT 
  '=== SAMPLE: TENANTS ===' AS section,
  id,
  name,
  created_at
FROM tenants
ORDER BY created_at DESC
LIMIT 5;

-- 7. SAMPLE DATA - GATEWAYS (UTEN PROVIDER)
SELECT 
  '=== SAMPLE: GATEWAYS ===' AS section,
  id,
  name,
  tenant_id,
  gateway_description,
  is_active,
  gw_phone
FROM sms_gateways
ORDER BY created_at DESC
LIMIT 5;

-- 8. SAMPLE DATA - GROUPS (med gateway relasjon)
SELECT 
  '=== SAMPLE: GROUPS ===' AS section,
  g.id,
  g.name,
  g.kind,
  g.parent_id,
  g.tenant_id,
  g.gateway_id,
  sg.name AS gateway_name,
  g.escalation_enabled
FROM groups g
LEFT JOIN sms_gateways sg ON sg.id = g.gateway_id
ORDER BY g.created_at DESC
LIMIT 10;

-- 9. SAMPLE DATA - GROUP MEMBERSHIPS
SELECT 
  '=== SAMPLE: GROUP_MEMBERSHIPS ===' AS section,
  gm.id,
  gm.user_id,
  gm.group_id,
  gm.tenant_id,
  g.name AS group_name,
  up.email AS user_email,
  up.role AS user_role
FROM group_memberships gm
JOIN groups g ON g.id = gm.group_id
LEFT JOIN user_profiles up ON up.id = gm.user_id
ORDER BY gm.created_at DESC
LIMIT 10;

-- 10. SAMPLE DATA - USER PROFILES
SELECT 
  '=== SAMPLE: USER_PROFILES ===' AS section,
  id,
  email,
  role,
  tenant_id,
  full_name,
  created_at
FROM user_profiles
ORDER BY created_at DESC
LIMIT 10;

-- 11. SAMPLE DATA - CONTACTS
SELECT 
  '=== SAMPLE: CONTACTS ===' AS section,
  c.id,
  c.name,
  c.phone,
  c.group_id,
  c.tenant_id,
  g.name AS group_name,
  g.gateway_id
FROM contacts c
JOIN groups g ON g.id = c.group_id
ORDER BY c.created_at DESC
LIMIT 10;

-- 12. GATEWAY-GROUP HIERARCHY
SELECT 
  '=== GATEWAY-GROUP HIERARCHY ===' AS section,
  sg.name AS gateway_name,
  sg.id AS gateway_id,
  COUNT(DISTINCT g.id) AS total_groups,
  COUNT(DISTINCT CASE WHEN g.parent_id IS NULL THEN g.id END) AS top_level_groups,
  COUNT(DISTINCT CASE WHEN g.parent_id IS NOT NULL THEN g.id END) AS sub_groups
FROM sms_gateways sg
LEFT JOIN groups g ON g.gateway_id = sg.id
GROUP BY sg.id, sg.name
ORDER BY sg.name;

-- 13. USER ROLE DISTRIBUTION
SELECT 
  '=== USER ROLE DISTRIBUTION ===' AS section,
  role,
  COUNT(*) AS user_count
FROM user_profiles
GROUP BY role
ORDER BY user_count DESC;

-- 14. RLS ENABLED CHECK
SELECT 
  '=== RLS STATUS ===' AS section,
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN (
  'tenants', 
  'user_profiles', 
  'sms_gateways', 
  'groups', 
  'group_memberships', 
  'contacts',
  'messages'
)
ORDER BY tablename;

-- ============================================
-- FERDIG! Kopier ALT output og lim inn i chat
-- ============================================