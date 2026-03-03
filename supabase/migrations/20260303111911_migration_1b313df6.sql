-- ============================================
-- FJERN ALLE GAMLE POLICIES OG LAG NYE ENKLE
-- ============================================

-- 1. Slett ALLE gamle policies
DROP POLICY IF EXISTS "Tenant admins can view all users" ON user_profiles;
DROP POLICY IF EXISTS "tenant_admin_can_create_users" ON user_profiles;
DROP POLICY IF EXISTS "tenant_admin_can_delete_users" ON user_profiles;
DROP POLICY IF EXISTS "tenant_admin_can_update_users" ON user_profiles;
DROP POLICY IF EXISTS "tenant_admin_sees_all_in_tenant" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_modify_policy" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_select_policy" ON user_profiles;

-- 2. Lag ÉN ENKEL SELECT policy
CREATE POLICY "simple_select_policy"
ON user_profiles
FOR SELECT
USING (
  -- tenant_admin ser ALT i sin tenant
  EXISTS (
    SELECT 1 FROM user_profiles admin
    WHERE admin.id = auth.uid()
    AND admin.role = 'tenant_admin'
    AND admin.tenant_id = user_profiles.tenant_id
  )
  OR
  -- group_admin ser brukere i sin gruppe
  EXISTS (
    SELECT 1 FROM user_profiles admin
    JOIN group_memberships gm ON gm.user_id = user_profiles.id
    WHERE admin.id = auth.uid()
    AND admin.role = 'group_admin'
    AND gm.group_id = admin.group_id
  )
  OR
  -- Alle ser seg selv
  id = auth.uid()
);

-- 3. Lag ÉN ENKEL INSERT policy
CREATE POLICY "simple_insert_policy"
ON user_profiles
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_profiles admin
    WHERE admin.id = auth.uid()
    AND admin.role = 'tenant_admin'
    AND admin.tenant_id = user_profiles.tenant_id
  )
);

-- 4. Lag ÉN ENKEL UPDATE policy
CREATE POLICY "simple_update_policy"
ON user_profiles
FOR UPDATE
USING (
  -- tenant_admin kan oppdatere alle i sin tenant
  EXISTS (
    SELECT 1 FROM user_profiles admin
    WHERE admin.id = auth.uid()
    AND admin.role = 'tenant_admin'
    AND admin.tenant_id = user_profiles.tenant_id
  )
  OR
  -- Alle kan oppdatere seg selv
  id = auth.uid()
);

-- 5. Lag ÉN ENKEL DELETE policy
CREATE POLICY "simple_delete_policy"
ON user_profiles
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM user_profiles admin
    WHERE admin.id = auth.uid()
    AND admin.role = 'tenant_admin'
    AND admin.tenant_id = user_profiles.tenant_id
  )
);

-- 6. Sørg for at RLS er aktivert
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;