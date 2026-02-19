-- CRITICAL FIX: Remove ALL policies that reference user_profiles in their own checks
-- This causes infinite recursion!

-- Drop problematic policies
DROP POLICY IF EXISTS "tenant_admins_view_tenant_profiles" ON user_profiles;
DROP POLICY IF EXISTS "tenant_admins_update_tenant_profiles" ON user_profiles;

-- Create SIMPLE policies that don't cause recursion
-- Users can view their own profile (no recursion - direct check)
-- Already exists: users_view_own_profile

-- Tenant admins can view ALL profiles in tenant
-- PROBLEM: Can't check if user is tenant_admin without querying user_profiles!
-- SOLUTION: Store tenant_admin role in JWT claims OR use simpler approach

-- For now: Let's use a SECURITY DEFINER function to safely check admin status
CREATE OR REPLACE FUNCTION is_tenant_admin_safe()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM user_profiles 
    WHERE id = auth.uid() 
      AND role = 'tenant_admin'
      AND deleted_at IS NULL
  );
$$;

-- Now create policies using the safe function
CREATE POLICY "tenant_admins_view_all_tenant_profiles"
ON user_profiles
FOR SELECT
TO public
USING (
  -- Either viewing own profile OR user is tenant_admin in same tenant
  (id = auth.uid() AND deleted_at IS NULL)
  OR
  (is_tenant_admin_safe() AND tenant_id IN (
    SELECT tenant_id FROM user_profiles WHERE id = auth.uid() AND deleted_at IS NULL
  ))
);

CREATE POLICY "tenant_admins_update_tenant_profiles"
ON user_profiles
FOR UPDATE
TO public
USING (
  -- Either updating own profile OR user is tenant_admin in same tenant
  (id = auth.uid() AND deleted_at IS NULL)
  OR
  (is_tenant_admin_safe() AND tenant_id IN (
    SELECT tenant_id FROM user_profiles WHERE id = auth.uid() AND deleted_at IS NULL
  ))
);

COMMENT ON TABLE user_profiles IS 'User profiles - fixed recursion with SECURITY DEFINER function 2026-02-19';