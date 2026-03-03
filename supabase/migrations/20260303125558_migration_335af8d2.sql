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

-- Get current user's group_id (bypasses RLS)
CREATE OR REPLACE FUNCTION get_user_group_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_group UUID;
BEGIN
  SELECT group_id INTO user_group
  FROM user_profiles
  WHERE id = auth.uid();
  
  RETURN user_group;
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

-- Check if current user is group_admin
CREATE OR REPLACE FUNCTION is_group_admin()
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
    AND role = 'group_admin'
  );
END;
$$;

-- Check if current user is group_admin for specific group (including subtree)
CREATE OR REPLACE FUNCTION is_group_admin_for_group(target_group_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_admin_group UUID;
BEGIN
  -- Get user's group_id if they are group_admin
  SELECT up.group_id INTO user_admin_group
  FROM user_profiles up
  WHERE up.id = auth.uid()
  AND up.role = 'group_admin';
  
  IF user_admin_group IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check if target_group is in subtree of user's admin group
  RETURN EXISTS (
    SELECT 1
    FROM groups
    WHERE id = target_group_id
    AND (
      id = user_admin_group
      OR user_admin_group = ANY(path)
    )
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
DROP POLICY IF EXISTS "simple_select_policy" ON user_profiles;
DROP POLICY IF EXISTS "simple_insert_policy" ON user_profiles;
DROP POLICY IF EXISTS "simple_update_policy" ON user_profiles;
DROP POLICY IF EXISTS "simple_delete_policy" ON user_profiles;

-- groups
DROP POLICY IF EXISTS "groups_select_policy" ON groups;
DROP POLICY IF EXISTS "groups_insert_policy" ON groups;
DROP POLICY IF EXISTS "groups_update_policy" ON groups;
DROP POLICY IF EXISTS "groups_delete_policy" ON groups;

-- group_memberships (keep existing, add new)
-- contacts (keep existing authenticated policies, add new)

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
  -- group_admin sees users in their subtree
  (is_group_admin() AND EXISTS (
    SELECT 1 FROM group_memberships gm
    WHERE gm.user_id = user_profiles.id
    AND is_group_admin_for_group(gm.group_id)
  ))
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
  (is_group_admin() AND EXISTS (
    SELECT 1 FROM group_memberships gm
    WHERE gm.user_id = user_profiles.id
    AND is_group_admin_for_group(gm.group_id)
  ))
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
  -- group_admin sees their subtree
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

DROP POLICY IF EXISTS "group_memberships_select_new" ON group_memberships;
DROP POLICY IF EXISTS "group_memberships_insert_new" ON group_memberships;
DROP POLICY IF EXISTS "group_memberships_update_new" ON group_memberships;
DROP POLICY IF EXISTS "group_memberships_delete_new" ON group_memberships;

CREATE POLICY "group_memberships_select_new"
ON group_memberships
FOR SELECT
USING (
  user_id = auth.uid()
  OR
  (is_tenant_admin() AND EXISTS (
    SELECT 1 FROM groups WHERE groups.id = group_memberships.group_id AND groups.tenant_id = get_user_tenant_id()
  ))
  OR
  is_group_admin_for_group(group_memberships.group_id)
);

CREATE POLICY "group_memberships_insert_new"
ON group_memberships
FOR INSERT
WITH CHECK (
  (is_tenant_admin() AND EXISTS (
    SELECT 1 FROM groups WHERE groups.id = group_memberships.group_id AND groups.tenant_id = get_user_tenant_id()
  ))
  OR
  is_group_admin_for_group(group_memberships.group_id)
);

CREATE POLICY "group_memberships_update_new"
ON group_memberships
FOR UPDATE
USING (
  (is_tenant_admin() AND EXISTS (
    SELECT 1 FROM groups WHERE groups.id = group_memberships.group_id AND groups.tenant_id = get_user_tenant_id()
  ))
  OR
  is_group_admin_for_group(group_memberships.group_id)
);

CREATE POLICY "group_memberships_delete_new"
ON group_memberships
FOR DELETE
USING (
  (is_tenant_admin() AND EXISTS (
    SELECT 1 FROM groups WHERE groups.id = group_memberships.group_id AND groups.tenant_id = get_user_tenant_id()
  ))
  OR
  is_group_admin_for_group(group_memberships.group_id)
);

-- ============================================
-- 6. CONTACTS POLICIES (GDPR - NO INHERITANCE)
-- ============================================

DROP POLICY IF EXISTS "contacts_select_gdpr" ON contacts;
DROP POLICY IF EXISTS "contacts_insert_gdpr" ON contacts;
DROP POLICY IF EXISTS "contacts_update_gdpr" ON contacts;
DROP POLICY IF EXISTS "contacts_delete_gdpr" ON contacts;

CREATE POLICY "contacts_select_gdpr"
ON contacts
FOR SELECT
USING (
  -- Member sees contacts in their groups (via group_contacts)
  (tenant_id = get_user_tenant_id() AND (
    is_tenant_admin()
    OR
    id IN (
      SELECT gc.contact_id
      FROM group_contacts gc
      WHERE is_group_member(gc.group_id)
      AND gc.deleted_at IS NULL
    )
  ))
);

CREATE POLICY "contacts_insert_gdpr"
ON contacts
FOR INSERT
WITH CHECK (
  tenant_id = get_user_tenant_id()
);

CREATE POLICY "contacts_update_gdpr"
ON contacts
FOR UPDATE
USING (
  tenant_id = get_user_tenant_id() AND (
    is_tenant_admin()
    OR
    id IN (
      SELECT gc.contact_id
      FROM group_contacts gc
      WHERE is_group_member(gc.group_id)
      AND gc.deleted_at IS NULL
    )
  )
);

CREATE POLICY "contacts_delete_gdpr"
ON contacts
FOR DELETE
USING (
  tenant_id = get_user_tenant_id() AND (
    is_tenant_admin()
    OR
    id IN (
      SELECT gc.contact_id
      FROM group_contacts gc
      WHERE is_group_member(gc.group_id)
      AND gc.deleted_at IS NULL
    )
  )
);

-- ============================================
-- 7. VERIFY RLS IS ENABLED
-- ============================================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

-- ============================================
-- DONE! 🎉 NO MORE RECURSION!
-- ============================================