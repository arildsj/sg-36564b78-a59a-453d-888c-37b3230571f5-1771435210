-- Fix whitelisted_numbers policies to avoid recursion
-- Drop existing policies
DROP POLICY IF EXISTS "Users can view whitelisted numbers in tenant" ON whitelisted_numbers;
DROP POLICY IF EXISTS "Tenant admins can manage whitelisted numbers" ON whitelisted_numbers;

-- Create new non-recursive policies
CREATE POLICY "users_select_whitelisted_numbers"
ON whitelisted_numbers
FOR SELECT
TO public
USING (
    tenant_id IN (
        SELECT tenant_id 
        FROM user_profiles 
        WHERE id = auth.uid()
    )
);

CREATE POLICY "admins_manage_whitelisted_numbers"
ON whitelisted_numbers
FOR ALL
TO public
USING (
    tenant_id IN (
        SELECT tenant_id 
        FROM user_profiles 
        WHERE id = auth.uid() 
          AND role = 'tenant_admin'
    )
)
WITH CHECK (
    tenant_id IN (
        SELECT tenant_id 
        FROM user_profiles 
        WHERE id = auth.uid() 
          AND role = 'tenant_admin'
    )
);

-- Add comment to track the fix
COMMENT ON TABLE whitelisted_numbers IS 'Whitelisted numbers - fixed RLS recursion 2026-02-19';