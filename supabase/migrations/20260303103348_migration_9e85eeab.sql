-- ENABLE RLS ON user_profiles
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Policy 1: Users can view own profile
CREATE POLICY "Users can view own profile"
ON user_profiles
FOR SELECT
USING (id = auth.uid());

-- Policy 2: Tenant admins can view all users in their tenant
CREATE POLICY "Tenant admins can view all users in tenant"
ON user_profiles
FOR SELECT
USING (
  tenant_id IN (
    SELECT tenant_id FROM user_profiles WHERE id = auth.uid()
  )
  AND
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'tenant_admin'
  )
);

-- Policy 3: Tenant admins can manage users in their tenant
CREATE POLICY "Tenant admins can manage users"
ON user_profiles
FOR ALL
USING (
  tenant_id IN (
    SELECT tenant_id FROM user_profiles WHERE id = auth.uid()
  )
  AND
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'tenant_admin'
  )
);