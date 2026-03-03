-- ============================================
-- ENKEL RLS FOR user_profiles
-- tenant_admin og group_admin ser ALT i sin tenant
-- ============================================

-- 1. FJERN ALLE EKSISTERENDE POLICIES
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Tenant admins can view all users in tenant" ON user_profiles;
DROP POLICY IF EXISTS "Tenant admins can manage users" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;

-- 2. ENABLE RLS (må være på)
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- 3. ENKEL SELECT POLICY
CREATE POLICY "tenant_admin_sees_all_in_tenant"
ON user_profiles
FOR SELECT
USING (
  -- Vanlig bruker ser kun seg selv
  id = auth.uid()
  OR
  -- tenant_admin eller group_admin ser ALT i sin tenant
  EXISTS (
    SELECT 1 
    FROM user_profiles AS admin
    WHERE admin.id = auth.uid()
    AND admin.role IN ('tenant_admin', 'group_admin')
    AND admin.tenant_id = user_profiles.tenant_id
  )
);

-- 4. ENKEL INSERT POLICY (kun tenant_admin)
CREATE POLICY "tenant_admin_can_create_users"
ON user_profiles
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM user_profiles
    WHERE id = auth.uid()
    AND role = 'tenant_admin'
    AND tenant_id = user_profiles.tenant_id
  )
);

-- 5. ENKEL UPDATE POLICY
CREATE POLICY "tenant_admin_can_update_users"
ON user_profiles
FOR UPDATE
USING (
  -- Egen profil
  id = auth.uid()
  OR
  -- tenant_admin kan oppdatere alle i sin tenant
  EXISTS (
    SELECT 1 
    FROM user_profiles AS admin
    WHERE admin.id = auth.uid()
    AND admin.role = 'tenant_admin'
    AND admin.tenant_id = user_profiles.tenant_id
  )
);

-- 6. ENKEL DELETE POLICY (kun tenant_admin)
CREATE POLICY "tenant_admin_can_delete_users"
ON user_profiles
FOR DELETE
USING (
  EXISTS (
    SELECT 1 
    FROM user_profiles
    WHERE id = auth.uid()
    AND role = 'tenant_admin'
  )
);