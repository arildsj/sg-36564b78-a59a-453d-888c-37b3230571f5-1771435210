-- Drop ALL existing policies on whitelisted_numbers
DROP POLICY IF EXISTS "admins_manage_whitelisted_numbers" ON whitelisted_numbers;
DROP POLICY IF EXISTS "users_select_whitelisted_numbers" ON whitelisted_numbers;

-- Create ONLY safe, non-recursive policies
-- 1. Users can view whitelisted numbers in their tenant
CREATE POLICY "users_view_whitelisted_numbers" ON whitelisted_numbers
    FOR SELECT
    USING (
        tenant_id IN (
            SELECT up.tenant_id 
            FROM user_profiles up 
            WHERE up.id = auth.uid() AND up.deleted_at IS NULL
        )
    );

-- 2. Tenant admins can manage whitelisted numbers
CREATE POLICY "tenant_admins_manage_whitelisted_numbers" ON whitelisted_numbers
    FOR ALL
    USING (
        tenant_id IN (
            SELECT up.tenant_id 
            FROM user_profiles up 
            WHERE up.id = auth.uid() 
              AND up.role = 'tenant_admin'
              AND up.deleted_at IS NULL
        )
    )
    WITH CHECK (
        tenant_id IN (
            SELECT up.tenant_id 
            FROM user_profiles up 
            WHERE up.id = auth.uid() 
              AND up.role = 'tenant_admin'
              AND up.deleted_at IS NULL
        )
    );

COMMENT ON TABLE whitelisted_numbers IS 'Whitelisted numbers - cleaned up all policies 2026-02-19';