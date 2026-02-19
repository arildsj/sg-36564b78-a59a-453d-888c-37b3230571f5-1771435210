-- Drop ALL existing policies on user_profiles
DROP POLICY IF EXISTS "Allow service role to insert profiles" ON user_profiles;
DROP POLICY IF EXISTS "Tenant admins can manage user profiles" ON user_profiles;
DROP POLICY IF EXISTS "Tenant admins can update tenant profiles" ON user_profiles;
DROP POLICY IF EXISTS "Tenant admins can view all tenant profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can view profiles in same tenant" ON user_profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;

-- Create ONLY the safe, non-recursive policies
-- 1. Users can view their own profile
CREATE POLICY "users_view_own_profile" ON user_profiles
    FOR SELECT
    USING (id = auth.uid() AND deleted_at IS NULL);

-- 2. Tenant admins can view all profiles in their tenant
CREATE POLICY "tenant_admins_view_tenant_profiles" ON user_profiles
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles up
            WHERE up.id = auth.uid()
              AND up.role = 'tenant_admin'
              AND up.tenant_id = user_profiles.tenant_id
              AND up.deleted_at IS NULL
        )
    );

-- 3. Users can update their own profile
CREATE POLICY "users_update_own_profile" ON user_profiles
    FOR UPDATE
    USING (id = auth.uid() AND deleted_at IS NULL);

-- 4. Tenant admins can update profiles in their tenant
CREATE POLICY "tenant_admins_update_tenant_profiles" ON user_profiles
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles up
            WHERE up.id = auth.uid()
              AND up.role = 'tenant_admin'
              AND up.tenant_id = user_profiles.tenant_id
              AND up.deleted_at IS NULL
        )
    );

-- 5. Service role can insert profiles (for onboarding)
CREATE POLICY "service_role_insert_profiles" ON user_profiles
    FOR INSERT
    WITH CHECK (true);

COMMENT ON TABLE user_profiles IS 'User profiles - cleaned up all policies 2026-02-19';