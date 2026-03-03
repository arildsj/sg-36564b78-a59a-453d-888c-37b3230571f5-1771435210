-- ============================================
-- FJERN ALLE GAMLE POLICIES OG LAG NYE ENKLE
-- Dette fikser infinite recursion problemet
-- ============================================

-- 1. FJERN ALLE EKSISTERENDE POLICIES PÅ GROUPS
DROP POLICY IF EXISTS "Admins create groups" ON groups;
DROP POLICY IF EXISTS "Admins delete groups" ON groups;
DROP POLICY IF EXISTS "Admins update groups" ON groups;
DROP POLICY IF EXISTS "Authenticated users can delete groups" ON groups;
DROP POLICY IF EXISTS "Authenticated users can insert groups" ON groups;
DROP POLICY IF EXISTS "Authenticated users can update groups" ON groups;
DROP POLICY IF EXISTS "Authenticated users can view groups" ON groups;
DROP POLICY IF EXISTS "Group admins can update their groups" ON groups;
DROP POLICY IF EXISTS "Tenant admins can manage groups" ON groups;
DROP POLICY IF EXISTS "Users can view groups they belong to" ON groups;
DROP POLICY IF EXISTS "Users view their groups" ON groups;
DROP POLICY IF EXISTS "Users can view groups" ON groups;
DROP POLICY IF EXISTS "Admins can manage groups" ON groups;

-- 2. LAG 4 ENKLE POLICIES UTEN RECURSION

-- SELECT: Brukere ser grupper de er medlem av
CREATE POLICY "groups_select_policy"
ON groups
FOR SELECT
TO public
USING (
  -- Medlemskap gir tilgang (ingen recursion)
  id IN (
    SELECT group_id 
    FROM group_memberships 
    WHERE user_id = auth.uid()
  )
  OR
  -- Tenant admins ser alt i sin tenant
  EXISTS (
    SELECT 1
    FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'tenant_admin'
    AND user_profiles.tenant_id = groups.tenant_id
  )
);

-- INSERT: Kun admins kan opprette grupper
CREATE POLICY "groups_insert_policy"
ON groups
FOR INSERT
TO public
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role IN ('tenant_admin', 'group_admin')
    AND user_profiles.tenant_id = groups.tenant_id
  )
);

-- UPDATE: Kun admins kan oppdatere grupper
CREATE POLICY "groups_update_policy"
ON groups
FOR UPDATE
TO public
USING (
  EXISTS (
    SELECT 1
    FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role IN ('tenant_admin', 'group_admin')
    AND user_profiles.tenant_id = groups.tenant_id
  )
);

-- DELETE: Kun admins kan slette grupper
CREATE POLICY "groups_delete_policy"
ON groups
FOR DELETE
TO public
USING (
  EXISTS (
    SELECT 1
    FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role IN ('tenant_admin', 'group_admin')
    AND user_profiles.tenant_id = groups.tenant_id
  )
);

-- 3. VERIFISER AT RLS ER AKTIVERT
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

-- ============================================
-- FERDIG! 🎉
-- Nå er det kun 4 policies, ingen recursion
-- ============================================