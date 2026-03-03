-- ============================================
-- SEMSE 2.0 - COMPLETE RLS POLICIES FIX
-- Based on CSV schema fasit
-- ============================================

-- ============================================
-- 1. DROP ALL EXISTING POLICIES
-- ============================================

-- user_profiles
DROP POLICY IF EXISTS "simple_select_policy" ON user_profiles;
DROP POLICY IF EXISTS "Users can view profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can manage profiles" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_select_policy" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_insert_policy" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_update_policy" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_delete_policy" ON user_profiles;

-- groups
DROP POLICY IF EXISTS "Users can view groups" ON groups;
DROP POLICY IF EXISTS "Admins can manage groups" ON groups;
DROP POLICY IF EXISTS "Users can view their groups" ON groups;
DROP POLICY IF EXISTS "Admins can create groups" ON groups;
DROP POLICY IF EXISTS "Admins can update groups" ON groups;
DROP POLICY IF EXISTS "Admins can delete groups" ON groups;

-- group_memberships
DROP POLICY IF EXISTS "Users can view memberships" ON group_memberships;
DROP POLICY IF EXISTS "Admins can manage memberships" ON group_memberships;
DROP POLICY IF EXISTS "Users can view their memberships" ON group_memberships;
DROP POLICY IF EXISTS "Admins can create memberships" ON group_memberships;
DROP POLICY IF EXISTS "Admins can update memberships" ON group_memberships;
DROP POLICY IF EXISTS "Admins can delete memberships" ON group_memberships;

-- contacts
DROP POLICY IF EXISTS "Users can view contacts" ON contacts;
DROP POLICY IF EXISTS "Users can manage contacts" ON contacts;
DROP POLICY IF EXISTS "Users can view contacts in their groups" ON contacts;
DROP POLICY IF EXISTS "Users can add contacts to their groups" ON contacts;
DROP POLICY IF EXISTS "Users can update contacts in their groups" ON contacts;
DROP POLICY IF EXISTS "Users can delete contacts in their groups" ON contacts;
DROP POLICY IF EXISTS "Admins can view all contacts" ON contacts;
DROP POLICY IF EXISTS "Tenant admins can manage contacts" ON contacts;

-- admin_group_permissions
DROP POLICY IF EXISTS "Users can view admin permissions" ON admin_group_permissions;
DROP POLICY IF EXISTS "Tenant admins can manage admin permissions" ON admin_group_permissions;

-- ============================================
-- 2. USER_PROFILES POLICIES
-- ============================================

-- SELECT: Own profile + tenant_admin sees all in tenant + group_admin sees users in their admin groups
CREATE POLICY "user_profiles_select"
ON user_profiles
FOR SELECT
USING (
  -- Own profile
  id = auth.uid()
  OR
  -- tenant_admin sees all in tenant
  EXISTS (
    SELECT 1 FROM user_profiles admin
    WHERE admin.id = auth.uid()
    AND admin.role = 'tenant_admin'
    AND admin.tenant_id = user_profiles.tenant_id
  )
  OR
  -- group_admin sees users in groups they manage
  EXISTS (
    SELECT 1 FROM admin_group_permissions agp
    JOIN group_memberships gm ON gm.group_id = agp.group_id
    WHERE agp.user_id = auth.uid()
    AND gm.user_id = user_profiles.id
  )
);

-- INSERT: Only tenant_admin can create users
CREATE POLICY "user_profiles_insert"
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

-- UPDATE: Own profile + tenant_admin + group_admin for their managed users
CREATE POLICY "user_profiles_update"
ON user_profiles
FOR UPDATE
USING (
  id = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM user_profiles admin
    WHERE admin.id = auth.uid()
    AND admin.role = 'tenant_admin'
    AND admin.tenant_id = user_profiles.tenant_id
  )
  OR
  EXISTS (
    SELECT 1 FROM admin_group_permissions agp
    JOIN group_memberships gm ON gm.group_id = agp.group_id
    WHERE agp.user_id = auth.uid()
    AND gm.user_id = user_profiles.id
  )
);

-- DELETE: Only tenant_admin can delete users
CREATE POLICY "user_profiles_delete"
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

-- ============================================
-- 3. GROUPS POLICIES
-- ============================================

-- SELECT: Member via group_memberships + tenant_admin sees all + group_admin sees managed groups
CREATE POLICY "groups_select"
ON groups
FOR SELECT
USING (
  -- Member sees groups they belong to
  EXISTS (
    SELECT 1 FROM group_memberships gm
    WHERE gm.group_id = groups.id
    AND gm.user_id = auth.uid()
  )
  OR
  -- tenant_admin sees all in tenant
  EXISTS (
    SELECT 1 FROM user_profiles admin
    WHERE admin.id = auth.uid()
    AND admin.role = 'tenant_admin'
    AND admin.tenant_id = groups.tenant_id
  )
  OR
  -- group_admin sees groups they manage
  EXISTS (
    SELECT 1 FROM admin_group_permissions agp
    WHERE agp.user_id = auth.uid()
    AND agp.group_id = groups.id
  )
);

-- INSERT: Only tenant_admin and group_admin can create groups
CREATE POLICY "groups_insert"
ON groups
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_profiles admin
    WHERE admin.id = auth.uid()
    AND admin.role IN ('tenant_admin', 'group_admin')
    AND admin.tenant_id = groups.tenant_id
  )
);

-- UPDATE: tenant_admin or group_admin for managed groups
CREATE POLICY "groups_update"
ON groups
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM user_profiles admin
    WHERE admin.id = auth.uid()
    AND admin.role = 'tenant_admin'
    AND admin.tenant_id = groups.tenant_id
  )
  OR
  EXISTS (
    SELECT 1 FROM admin_group_permissions agp
    WHERE agp.user_id = auth.uid()
    AND agp.group_id = groups.id
  )
);

-- DELETE: Only tenant_admin can delete groups
CREATE POLICY "groups_delete"
ON groups
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM user_profiles admin
    WHERE admin.id = auth.uid()
    AND admin.role = 'tenant_admin'
    AND admin.tenant_id = groups.tenant_id
  )
);

-- ============================================
-- 4. GROUP_MEMBERSHIPS POLICIES
-- ============================================

-- SELECT: Own memberships + tenant_admin + group_admin for managed groups
CREATE POLICY "group_memberships_select"
ON group_memberships
FOR SELECT
USING (
  user_id = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM user_profiles admin
    WHERE admin.id = auth.uid()
    AND admin.role = 'tenant_admin'
    AND admin.tenant_id = group_memberships.tenant_id
  )
  OR
  EXISTS (
    SELECT 1 FROM admin_group_permissions agp
    WHERE agp.user_id = auth.uid()
    AND agp.group_id = group_memberships.group_id
  )
);

-- INSERT: tenant_admin + group_admin for managed groups
CREATE POLICY "group_memberships_insert"
ON group_memberships
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_profiles admin
    WHERE admin.id = auth.uid()
    AND admin.role = 'tenant_admin'
    AND admin.tenant_id = group_memberships.tenant_id
  )
  OR
  EXISTS (
    SELECT 1 FROM admin_group_permissions agp
    WHERE agp.user_id = auth.uid()
    AND agp.group_id = group_memberships.group_id
  )
);

-- UPDATE: tenant_admin + group_admin for managed groups
CREATE POLICY "group_memberships_update"
ON group_memberships
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM user_profiles admin
    WHERE admin.id = auth.uid()
    AND admin.role = 'tenant_admin'
    AND admin.tenant_id = group_memberships.tenant_id
  )
  OR
  EXISTS (
    SELECT 1 FROM admin_group_permissions agp
    WHERE agp.user_id = auth.uid()
    AND agp.group_id = group_memberships.group_id
  )
);

-- DELETE: tenant_admin + group_admin for managed groups
CREATE POLICY "group_memberships_delete"
ON group_memberships
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM user_profiles admin
    WHERE admin.id = auth.uid()
    AND admin.role = 'tenant_admin'
    AND admin.tenant_id = group_memberships.tenant_id
  )
  OR
  EXISTS (
    SELECT 1 FROM admin_group_permissions agp
    WHERE agp.user_id = auth.uid()
    AND agp.group_id = group_memberships.group_id
  )
);

-- ============================================
-- 5. CONTACTS POLICIES (GDPR - NO INHERITANCE)
-- ============================================

-- SELECT: Only contacts in groups you are member of + tenant_admin sees all
CREATE POLICY "contacts_select"
ON contacts
FOR SELECT
USING (
  -- Member sees contacts in their groups
  EXISTS (
    SELECT 1 FROM group_memberships gm
    WHERE gm.group_id = contacts.group_id
    AND gm.user_id = auth.uid()
  )
  OR
  -- tenant_admin sees all contacts in tenant
  EXISTS (
    SELECT 1 FROM user_profiles admin
    WHERE admin.id = auth.uid()
    AND admin.role = 'tenant_admin'
    AND admin.tenant_id = contacts.tenant_id
  )
);

-- INSERT: Only in groups you are member of
CREATE POLICY "contacts_insert"
ON contacts
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM group_memberships gm
    WHERE gm.group_id = contacts.group_id
    AND gm.user_id = auth.uid()
  )
  AND
  EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid()
    AND up.tenant_id = contacts.tenant_id
  )
);

-- UPDATE: Only in groups you are member of
CREATE POLICY "contacts_update"
ON contacts
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM group_memberships gm
    WHERE gm.group_id = contacts.group_id
    AND gm.user_id = auth.uid()
  )
);

-- DELETE: Only in groups you are member of
CREATE POLICY "contacts_delete"
ON contacts
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM group_memberships gm
    WHERE gm.group_id = contacts.group_id
    AND gm.user_id = auth.uid()
  )
);

-- ============================================
-- 6. ADMIN_GROUP_PERMISSIONS POLICIES
-- ============================================

-- SELECT: Own permissions + tenant_admin sees all
CREATE POLICY "admin_group_permissions_select"
ON admin_group_permissions
FOR SELECT
USING (
  user_id = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM user_profiles admin
    WHERE admin.id = auth.uid()
    AND admin.role = 'tenant_admin'
    AND admin.tenant_id = admin_group_permissions.tenant_id
  )
);

-- INSERT: Only tenant_admin can grant admin permissions
CREATE POLICY "admin_group_permissions_insert"
ON admin_group_permissions
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_profiles admin
    WHERE admin.id = auth.uid()
    AND admin.role = 'tenant_admin'
    AND admin.tenant_id = admin_group_permissions.tenant_id
  )
);

-- UPDATE: Only tenant_admin can modify admin permissions
CREATE POLICY "admin_group_permissions_update"
ON admin_group_permissions
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM user_profiles admin
    WHERE admin.id = auth.uid()
    AND admin.role = 'tenant_admin'
    AND admin.tenant_id = admin_group_permissions.tenant_id
  )
);

-- DELETE: Only tenant_admin can revoke admin permissions
CREATE POLICY "admin_group_permissions_delete"
ON admin_group_permissions
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM user_profiles admin
    WHERE admin.id = auth.uid()
    AND admin.role = 'tenant_admin'
    AND admin.tenant_id = admin_group_permissions.tenant_id
  )
);

-- ============================================
-- 7. VERIFY RLS IS ENABLED
-- ============================================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_group_permissions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- DONE! 🎉
-- ============================================