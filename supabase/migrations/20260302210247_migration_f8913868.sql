-- ============================================
-- FIX: TILLAT SERVICE_ROLE Å OPPRETTE GROUP_MEMBERSHIPS
-- ============================================

-- 1. SLETT EKSISTERENDE POLICY (for å unngå konflikt)
DROP POLICY IF EXISTS "Authenticated users can insert memberships" ON group_memberships;

-- 2. OPPRETT NY POLICY SOM TILLATER BÅDE AUTHENTICATED OG SERVICE_ROLE
CREATE POLICY "Authenticated users can insert memberships"
ON group_memberships
FOR INSERT
TO authenticated, service_role  -- ✅ TILLAT BÅDE AUTHENTICATED OG SERVICE_ROLE
WITH CHECK (true);

-- 3. VERIFISER AT POLICYEN ER OPPRETTET
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'group_memberships'
AND policyname = 'Authenticated users can insert memberships';