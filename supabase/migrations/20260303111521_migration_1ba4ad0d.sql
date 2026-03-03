-- ============================================
-- ENKEL OG RIKTIG RLS FOR user_profiles
-- ============================================

-- Fjern alle eksisterende policies
DROP POLICY IF EXISTS "tenant_admin_full_access" ON user_profiles;
DROP POLICY IF EXISTS "Tenant admins can view all users in tenant" ON user_profiles;
DROP POLICY IF EXISTS "Tenant admins can manage users" ON user_profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "group_admin_group_access" ON user_profiles;

-- ============================================
-- SELECT POLICY
-- ============================================
CREATE POLICY "user_profiles_select_policy"
ON user_profiles
FOR SELECT
USING (
  -- 1. Alle ser sin egen profil
  id = auth.uid()
  OR
  -- 2. tenant_admin ser alle i sin tenant
  EXISTS (
    SELECT 1 
    FROM user_profiles up
    WHERE up.id = auth.uid()
    AND up.role = 'tenant_admin'
    AND up.tenant_id = user_profiles.tenant_id
  )
  OR
  -- 3. group_admin ser brukere i sin gruppe
  EXISTS (
    SELECT 1
    FROM user_profiles up
    INNER JOIN group_memberships gm ON gm.user_id = user_profiles.id
    WHERE up.id = auth.uid()
    AND up.role = 'group_admin'
    AND gm.group_id = up.group_id
  )
);

-- ============================================
-- INSERT/UPDATE/DELETE POLICY
-- ============================================
CREATE POLICY "user_profiles_modify_policy"
ON user_profiles
FOR ALL
USING (
  -- Kun tenant_admin kan endre brukere
  EXISTS (
    SELECT 1
    FROM user_profiles up
    WHERE up.id = auth.uid()
    AND up.role = 'tenant_admin'
    AND up.tenant_id = user_profiles.tenant_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM user_profiles up
    WHERE up.id = auth.uid()
    AND up.role = 'tenant_admin'
    AND up.tenant_id = user_profiles.tenant_id
  )
);

-- ============================================
-- AKTIVER RLS
-- ============================================
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;