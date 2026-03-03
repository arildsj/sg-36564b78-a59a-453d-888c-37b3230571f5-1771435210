-- FIX: Simplify user_profiles RLS policy to avoid nested subquery issues

-- Drop old policies
DROP POLICY IF EXISTS "Tenant admins can manage users" ON user_profiles;
DROP POLICY IF EXISTS "Tenant admins can view all users in tenant" ON user_profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;

-- Create new simplified policies using helper functions
CREATE POLICY "Users can view own profile"
ON user_profiles
FOR SELECT
USING (id = auth.uid());

CREATE POLICY "Tenant admins can view all users"
ON user_profiles
FOR SELECT
USING (
  tenant_id = user_tenant_id() 
  AND is_tenant_admin()
);

CREATE POLICY "Tenant admins can manage users"
ON user_profiles
FOR ALL
USING (
  tenant_id = user_tenant_id() 
  AND is_tenant_admin()
);