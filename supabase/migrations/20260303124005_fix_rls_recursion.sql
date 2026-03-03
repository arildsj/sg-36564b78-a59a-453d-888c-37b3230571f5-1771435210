-- ============================================
-- SEMSE 2.0 - FIX RLS RECURSION WITH SECURITY DEFINER FUNCTIONS
-- ============================================

-- ============================================
-- 1. CREATE HELPER FUNCTIONS (SECURITY DEFINER)
-- ============================================

-- Get current user's role (bypasses RLS)
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role
  FROM user_profiles
  WHERE id = auth.uid();
  
  RETURN COALESCE(user_role, 'member');
END;
$$;

-- Get current user's tenant_id (bypasses RLS)
CREATE OR REPLACE FUNCTION get_user_tenant_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_tenant UUID;
BEGIN
  SELECT tenant_id INTO user_tenant
  FROM user_profiles
  WHERE id = auth.uid();
  
  RETURN user_tenant;
END;
$$;

-- Check if current user is tenant_admin
CREATE OR REPLACE FUNCTION is_tenant_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM user_profiles
    WHERE id = auth.uid()
    AND role = 'tenant_admin'
  );
END;
$$;

-- Check if current user is group_admin for specific group
CREATE OR REPLACE FUNCTION is_group_admin_for_group(target_group_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM admin_group_permissions agp
    JOIN user_profiles up ON up.id = agp.user_id
    WHERE agp.user_id = auth.uid()
    AND agp.group_id = target_group_id
    AND up.role = 'group_admin'
  );
END;
$$;

-- Check if current user is member of specific group
CREATE OR REPLACE FUNCTION is_group_member(target_group_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM group_memberships
    WHERE user_id = auth.uid()
    AND group_id = target_group_id
  );
END;
$$;

-- ============================================
-- 2. DROP ALL EXISTING POLICIES
-- ============================================

-- user_profiles
DROP POLICY IF EXISTS "user_profiles_select" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_insert" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_update" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_delete" ON user_profiles;
DROP POLICY IF EXISTS "simple_select_policy" ON user_profiles;
DROP POLICY IF EXISTS "Users can view profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can manage profiles" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_select_policy" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_insert_policy" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_update_policy" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_delete_policy" ON user_profiles;

-- groups
DROP POLICY IF EXISTS "groups_select" ON groups;
DROP POLICY IF EXISTS "groups_insert" ON groups;
DROP POLICY IF EXISTS "groups_update" ON groups;
DROP POLICY IF EXISTS "groups_delete" ON groups;
DROP POLICY IF EXISTS "Users can view groups" ON groups;
DROP POLICY IF EXISTS "Admins can manage groups" ON groups;
DROP POLICY IF EXISTS "Users can view their groups" ON groups;
DROP POLICY IF EXISTS "Admins can create groups" ON groups;
DROP POLICY IF EXISTS "Admins can update groups" ON groups;
DROP POLICY IF EXISTS "Admins can delete groups" ON groups;

-- group_memberships
DROP POLICY IF EXISTS "group_memberships_select" ON group_memberships;
DROP POLICY IF EXISTS "group_memberships_insert" ON group_memberships;
DROP POLICY IF EXISTS "group_memberships_update" ON group_memberships;
DROP POLICY IF EXISTS "group_memberships_delete" ON group_memberships;
DROP POLICY IF EXISTS "Users can view memberships" ON group_memberships;
DROP POLICY IF EXISTS "Admins can manage memberships" ON group_memberships;
DROP POLICY IF EXISTS "Users can view their memberships" ON group_memberships;
DROP POLICY IF EXISTS "Admins can create memberships" ON group_memberships;
DROP POLICY IF EXISTS "Admins can update memberships" ON group_memberships;
DROP POLICY IF EXISTS "Admins can delete memberships" ON group_memberships;

-- contacts
DROP POLICY IF EXISTS "contacts_select" ON contacts;
DROP POLICY IF EXISTS "contacts_insert" ON contacts;
DROP POLICY IF EXISTS "contacts_update" ON contacts;
DROP POLICY IF EXISTS "contacts_delete" ON contacts;
DROP POLICY IF EXISTS "Users can view contacts" ON contacts;
DROP POLICY IF EXISTS "Users can manage contacts" ON contacts;
DROP POLICY IF EXISTS "Users can view contacts in their groups" ON contacts;
DROP POLICY IF EXISTS "Users can add contacts to their groups" ON contacts;
DROP POLICY IF EXISTS "Users can update contacts in their groups" ON contacts;
DROP POLICY IF EXISTS "Users can delete contacts in their groups" ON contacts;
DROP POLICY IF EXISTS "Admins can view all contacts" ON contacts;
DROP POLICY IF EXISTS "Tenant admins can manage contacts" ON contacts;

-- admin_group_permissions
DROP POLICY IF EXISTS "admin_group_permissions_select" ON admin_group_permissions;
DROP POLICY IF EXISTS "admin_group_permissions_insert" ON admin_group_permissions;
DROP POLICY IF EXISTS "admin_group_permissions_update" ON admin_group_permissions;
DROP POLICY IF EXISTS "admin_group_permissions_delete" ON admin_group_permissions;
DROP POLICY IF EXISTS "Users can view admin permissions" ON admin_group_permissions;
DROP POLICY IF EXISTS "Tenant admins can manage admin permissions" ON admin_group_permissions;

-- ============================================
-- 3. USER_PROFILES POLICIES (NO RECURSION)
-- ============================================

CREATE POLICY "user_profiles_select"
ON user_profiles
FOR SELECT
USING (
  -- Own profile
  id = auth.uid()
  OR
  -- tenant_admin sees all in tenant
  (is_tenant_admin() AND tenant_id = get_user_tenant_id())
  OR
  -- group_admin sees users in groups they manage
  EXISTS (
    SELECT 1 FROM admin_group_permissions agp
    JOIN group_memberships gm ON gm.group_id = agp.group_id
    WHERE agp.user_id = auth.uid()
    AND gm.user_id = user_profiles.id
  )
);

CREATE POLICY "user_profiles_insert"
ON user_profiles
FOR INSERT
WITH CHECK (
  is_tenant_admin() AND tenant_id = get_user_tenant_id()
);

CREATE POLICY "user_profiles_update"
ON user_profiles
FOR UPDATE
USING (
  id = auth.uid()
  OR
  (is_tenant_admin() AND tenant_id = get_user_tenant_id())
  OR
  EXISTS (
    SELECT 1 FROM admin_group_permissions agp
    JOIN group_memberships gm ON gm.group_id = agp.group_id
    WHERE agp.user_id = auth.uid()
    AND gm.user_id = user_profiles.id
  )
);

CREATE POLICY "user_profiles_delete"
ON user_profiles
FOR DELETE
USING (
  is_tenant_admin() AND tenant_id = get_user_tenant_id()
);

-- ============================================
-- 4. GROUPS POLICIES (NO RECURSION)
-- ============================================

CREATE POLICY "groups_select"
ON groups
FOR SELECT
USING (
  -- Member sees groups they belong to
  is_group_member(groups.id)
  OR
  -- tenant_admin sees all in tenant
  (is_tenant_admin() AND tenant_id = get_user_tenant_id())
  OR
  -- group_admin sees groups they manage
  is_group_admin_for_group(groups.id)
);

CREATE POLICY "groups_insert"
ON groups
FOR INSERT
WITH CHECK (
  (get_user_role() IN ('tenant_admin', 'group_admin'))
  AND tenant_id = get_user_tenant_id()
);

CREATE POLICY "groups_update"
ON groups
FOR UPDATE
USING (
  (is_tenant_admin() AND tenant_id = get_user_tenant_id())
  OR
  is_group_admin_for_group(groups.id)
);

CREATE POLICY "groups_delete"
ON groups
FOR DELETE
USING (
  is_tenant_admin() AND tenant_id = get_user_tenant_id()
);

-- ============================================
-- 5. GROUP_MEMBERSHIPS POLICIES (NO RECURSION)
-- ============================================

CREATE POLICY "group_memberships_select"
ON group_memberships
FOR SELECT
USING (
  user_id = auth.uid()
  OR
  (is_tenant_admin() AND tenant_id = get_user_tenant_id())
  OR
  is_group_admin_for_group(group_memberships.group_id)
);

CREATE POLICY "group_memberships_insert"
ON group_memberships
FOR INSERT
WITH CHECK (
  (is_tenant_admin() AND tenant_id = get_user_tenant_id())
  OR
  is_group_admin_for_group(group_memberships.group_id)
);

CREATE POLICY "group_memberships_update"
ON group_memberships
FOR UPDATE
USING (
  (is_tenant_admin() AND tenant_id = get_user_tenant_id())
  OR
  is_group_admin_for_group(group_memberships.group_id)
);

CREATE POLICY "group_memberships_delete"
ON group_memberships
FOR DELETE
USING (
  (is_tenant_admin() AND tenant_id = get_user_tenant_id())
  OR
  is_group_admin_for_group(group_memberships.group_id)
);

-- ============================================
-- 6. CONTACTS POLICIES (GDPR - NO INHERITANCE)
-- ============================================

CREATE POLICY "contacts_select"
ON contacts
FOR SELECT
USING (
  -- Member sees contacts in their groups
  is_group_member(contacts.group_id)
  OR
  -- tenant_admin sees all contacts in tenant
  (is_tenant_admin() AND tenant_id = get_user_tenant_id())
);

CREATE POLICY "contacts_insert"
ON contacts
FOR INSERT
WITH CHECK (
  is_group_member(contacts.group_id)
  AND tenant_id = get_user_tenant_id()
);

CREATE POLICY "contacts_update"
ON contacts
FOR UPDATE
USING (
  is_group_member(contacts.group_id)
);

CREATE POLICY "contacts_delete"
ON contacts
FOR DELETE
USING (
  is_group_member(contacts.group_id)
);

-- ============================================
-- 7. ADMIN_GROUP_PERMISSIONS POLICIES (NO RECURSION)
-- ============================================

CREATE POLICY "admin_group_permissions_select"
ON admin_group_permissions
FOR SELECT
USING (
  user_id = auth.uid()
  OR
  (is_tenant_admin() AND tenant_id = get_user_tenant_id())
);

CREATE POLICY "admin_group_permissions_insert"
ON admin_group_permissions
FOR INSERT
WITH CHECK (
  is_tenant_admin() AND tenant_id = get_user_tenant_id()
);

CREATE POLICY "admin_group_permissions_update"
ON admin_group_permissions
FOR UPDATE
USING (
  is_tenant_admin() AND tenant_id = get_user_tenant_id()
);

CREATE POLICY "admin_group_permissions_delete"
ON admin_group_permissions
FOR DELETE
USING (
  is_tenant_admin() AND tenant_id = get_user_tenant_id()
);

-- ============================================
-- 8. VERIFY RLS IS ENABLED
-- ============================================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_group_permissions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- DONE! 🎉 NO MORE RECURSION!
-- ============================================