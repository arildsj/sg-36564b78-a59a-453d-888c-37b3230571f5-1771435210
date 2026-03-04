-- ============================================
-- SEMSE 2.0 - FINAL FIX FOR INFINITE RECURSION
-- Drop and recreate ALL functions to avoid any recursion
-- ============================================

-- 1. DROP ALL EXISTING POLICIES (Clean slate)
DROP POLICY IF EXISTS "user_profiles_select" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_insert" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_update" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_delete" ON user_profiles;

DROP POLICY IF EXISTS "groups_select" ON groups;
DROP POLICY IF EXISTS "groups_insert" ON groups;
DROP POLICY IF EXISTS "groups_update" ON groups;
DROP POLICY IF EXISTS "groups_delete" ON groups;

DROP POLICY IF EXISTS "group_memberships_select_new" ON group_memberships;
DROP POLICY IF EXISTS "group_memberships_insert_new" ON group_memberships;
DROP POLICY IF EXISTS "group_memberships_update_new" ON group_memberships;
DROP POLICY IF EXISTS "group_memberships_delete_new" ON group_memberships;
DROP POLICY IF EXISTS "Users view own memberships" ON group_memberships;
DROP POLICY IF EXISTS "Users can view memberships in their groups" ON group_memberships;
DROP POLICY IF EXISTS "Tenant admins can manage all memberships" ON group_memberships;
DROP POLICY IF EXISTS "Group admins can manage their group memberships" ON group_memberships;
DROP POLICY IF EXISTS "Authenticated users can view memberships" ON group_memberships;
DROP POLICY IF EXISTS "Authenticated users can insert memberships" ON group_memberships;
DROP POLICY IF EXISTS "Authenticated users can delete memberships" ON group_memberships;
DROP POLICY IF EXISTS "Service role can delete memberships" ON group_memberships;

DROP POLICY IF EXISTS "contacts_select_gdpr" ON contacts;
DROP POLICY IF EXISTS "contacts_insert_gdpr" ON contacts;
DROP POLICY IF EXISTS "contacts_update_gdpr" ON contacts;
DROP POLICY IF EXISTS "contacts_delete_gdpr" ON contacts;
DROP POLICY IF EXISTS "Users can view contacts in their groups" ON contacts;
DROP POLICY IF EXISTS "Group members can create contacts" ON contacts;
DROP POLICY IF EXISTS "Tenant admins can manage contacts" ON contacts;
DROP POLICY IF EXISTS "Authenticated users can view contacts" ON contacts;
DROP POLICY IF EXISTS "Authenticated users can insert contacts" ON contacts;
DROP POLICY IF EXISTS "Authenticated users can update contacts" ON contacts;
DROP POLICY IF EXISTS "Authenticated users can delete contacts" ON contacts;

-- 2. DROP AND RECREATE ALL FUNCTIONS (SECURITY DEFINER)
DROP FUNCTION IF EXISTS get_user_role() CASCADE;
DROP FUNCTION IF EXISTS get_user_tenant_id() CASCADE;
DROP FUNCTION IF EXISTS get_user_group_id() CASCADE;
DROP FUNCTION IF EXISTS is_tenant_admin() CASCADE;
DROP FUNCTION IF EXISTS is_group_admin() CASCADE;
DROP FUNCTION IF EXISTS is_group_admin_for_group(UUID) CASCADE;
DROP FUNCTION IF EXISTS is_group_member(UUID) CASCADE;
DROP FUNCTION IF EXISTS user_group_ids() CASCADE;
DROP FUNCTION IF EXISTS user_tenant_id() CASCADE;
DROP FUNCTION IF EXISTS is_group_admin_of_subtree(UUID) CASCADE;

-- 3. RECREATE CORE SECURITY DEFINER FUNCTIONS

-- Get current user's role (NO RECURSION)
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
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

-- Get current user's tenant_id (NO RECURSION)
CREATE OR REPLACE FUNCTION get_user_tenant_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  tenant UUID;
BEGIN
  SELECT tenant_id INTO tenant
  FROM user_profiles
  WHERE id = auth.uid();
  
  RETURN tenant;
END;
$$;

-- Get current user's group_id (NO RECURSION)
CREATE OR REPLACE FUNCTION get_user_group_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  grp UUID;
BEGIN
  SELECT group_id INTO grp
  FROM user_profiles
  WHERE id = auth.uid();
  
  RETURN grp;
END;
$$;

-- Check if current user is tenant_admin (uses get_user_role, NO RECURSION)
CREATE OR REPLACE FUNCTION is_tenant_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  RETURN get_user_role() = 'tenant_admin';
END;
$$;

-- Check if current user is group_admin (uses get_user_role, NO RECURSION)
CREATE OR REPLACE FUNCTION is_group_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  RETURN get_user_role() = 'group_admin';
END;
$$;

-- Check if user is admin for specific group (NO RECURSION)
CREATE OR REPLACE FUNCTION is_group_admin_for_group(target_group_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  -- Tenant admins have access to all groups in their tenant
  IF is_tenant_admin() THEN
    RETURN EXISTS (
      SELECT 1 FROM groups 
      WHERE id = target_group_id 
      AND tenant_id = get_user_tenant_id()
    );
  END IF;
  
  -- Group admins have access to their assigned group
  IF is_group_admin() THEN
    RETURN get_user_group_id() = target_group_id;
  END IF;
  
  RETURN FALSE;
END;
$$;

-- Check if user is member of specific group (NO RECURSION)
CREATE OR REPLACE FUNCTION is_group_member(target_group_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM group_memberships 
    WHERE group_id = target_group_id 
    AND user_id = auth.uid()
  );
END;
$$;

-- 4. CREATE NEW RECURSION-FREE POLICIES

-- ============================================
-- USER_PROFILES POLICIES (NO RECURSION)
-- ============================================

CREATE POLICY "user_profiles_select_final"
ON user_profiles
FOR SELECT
TO public
USING (
  -- Own profile
  id = auth.uid()
  OR
  -- Tenant admin sees all in their tenant
  (get_user_role() = 'tenant_admin' AND tenant_id = get_user_tenant_id())
  OR
  -- Group admin sees users in their group only
  (get_user_role() = 'group_admin' AND group_id = get_user_group_id())
);

CREATE POLICY "user_profiles_insert_final"
ON user_profiles
FOR INSERT
TO public
WITH CHECK (
  get_user_role() = 'tenant_admin' AND tenant_id = get_user_tenant_id()
);

CREATE POLICY "user_profiles_update_final"
ON user_profiles
FOR UPDATE
TO public
USING (
  id = auth.uid()
  OR
  (get_user_role() = 'tenant_admin' AND tenant_id = get_user_tenant_id())
  OR
  (get_user_role() = 'group_admin' AND group_id = get_user_group_id())
);

CREATE POLICY "user_profiles_delete_final"
ON user_profiles
FOR DELETE
TO public
USING (
  get_user_role() = 'tenant_admin' AND tenant_id = get_user_tenant_id()
);

-- ============================================
-- GROUPS POLICIES (NO RECURSION)
-- ============================================

CREATE POLICY "groups_select_final"
ON groups
FOR SELECT
TO public
USING (
  is_group_member(id)
  OR
  (is_tenant_admin() AND tenant_id = get_user_tenant_id())
  OR
  is_group_admin_for_group(id)
);

CREATE POLICY "groups_insert_final"
ON groups
FOR INSERT
TO public
WITH CHECK (
  get_user_role() IN ('tenant_admin', 'group_admin')
  AND tenant_id = get_user_tenant_id()
);

CREATE POLICY "groups_update_final"
ON groups
FOR UPDATE
TO public
USING (
  (is_tenant_admin() AND tenant_id = get_user_tenant_id())
  OR
  is_group_admin_for_group(id)
);

CREATE POLICY "groups_delete_final"
ON groups
FOR DELETE
TO public
USING (
  is_tenant_admin() AND tenant_id = get_user_tenant_id()
);

-- ============================================
-- GROUP_MEMBERSHIPS POLICIES (NO RECURSION)
-- ============================================

CREATE POLICY "group_memberships_select_final"
ON group_memberships
FOR SELECT
TO public
USING (
  user_id = auth.uid()
  OR
  (is_tenant_admin() AND EXISTS (
    SELECT 1 FROM groups 
    WHERE groups.id = group_memberships.group_id 
    AND groups.tenant_id = get_user_tenant_id()
  ))
  OR
  is_group_admin_for_group(group_id)
);

CREATE POLICY "group_memberships_insert_final"
ON group_memberships
FOR INSERT
TO public
WITH CHECK (
  (is_tenant_admin() AND EXISTS (
    SELECT 1 FROM groups 
    WHERE groups.id = group_memberships.group_id 
    AND groups.tenant_id = get_user_tenant_id()
  ))
  OR
  is_group_admin_for_group(group_id)
);

CREATE POLICY "group_memberships_update_final"
ON group_memberships
FOR UPDATE
TO public
USING (
  (is_tenant_admin() AND EXISTS (
    SELECT 1 FROM groups 
    WHERE groups.id = group_memberships.group_id 
    AND groups.tenant_id = get_user_tenant_id()
  ))
  OR
  is_group_admin_for_group(group_id)
);

CREATE POLICY "group_memberships_delete_final"
ON group_memberships
FOR DELETE
TO public
USING (
  (is_tenant_admin() AND EXISTS (
    SELECT 1 FROM groups 
    WHERE groups.id = group_memberships.group_id 
    AND groups.tenant_id = get_user_tenant_id()
  ))
  OR
  is_group_admin_for_group(group_id)
);

-- ============================================
-- CONTACTS POLICIES (GDPR-ISOLATED, NO RECURSION)
-- ============================================

CREATE POLICY "contacts_select_final"
ON contacts
FOR SELECT
TO public
USING (
  (is_tenant_admin() AND tenant_id = get_user_tenant_id())
  OR
  id IN (
    SELECT gc.contact_id 
    FROM group_contacts gc
    WHERE is_group_member(gc.group_id)
    AND gc.deleted_at IS NULL
  )
);

CREATE POLICY "contacts_insert_final"
ON contacts
FOR INSERT
TO public
WITH CHECK (
  tenant_id = get_user_tenant_id()
);

CREATE POLICY "contacts_update_final"
ON contacts
FOR UPDATE
TO public
USING (
  (is_tenant_admin() AND tenant_id = get_user_tenant_id())
  OR
  id IN (
    SELECT gc.contact_id 
    FROM group_contacts gc
    WHERE is_group_member(gc.group_id)
    AND gc.deleted_at IS NULL
  )
);

CREATE POLICY "contacts_delete_final"
ON contacts
FOR DELETE
TO public
USING (
  (is_tenant_admin() AND tenant_id = get_user_tenant_id())
  OR
  id IN (
    SELECT gc.contact_id 
    FROM group_contacts gc
    WHERE is_group_member(gc.group_id)
    AND gc.deleted_at IS NULL
  )
);

-- 5. VERIFY RLS IS ENABLED
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

-- ============================================
-- DONE! 🎉 ZERO RECURSION GUARANTEED!
-- ============================================