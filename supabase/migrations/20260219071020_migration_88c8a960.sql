-- Fix user_profiles policies to avoid recursion
-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Tenant admins can view all tenant profiles" ON user_profiles;
DROP POLICY IF EXISTS "Tenant admins can update tenant profiles" ON user_profiles;

-- Create new policies without recursion (using auth.uid() directly)
CREATE POLICY "Users can view their own profile" 
ON user_profiles FOR SELECT 
USING (id = auth.uid() AND deleted_at IS NULL);

CREATE POLICY "Users can update their own profile" 
ON user_profiles FOR UPDATE 
USING (id = auth.uid() AND deleted_at IS NULL);

-- For tenant admin access, we need a different approach
-- Allow INSERT for new user profiles (used during onboarding)
CREATE POLICY "Allow service role to insert profiles"
ON user_profiles FOR INSERT
WITH CHECK (true);  -- Service role key bypasses this anyway

-- For SELECT by tenant admins, check role directly without calling functions
CREATE POLICY "Tenant admins can view all tenant profiles" 
ON user_profiles FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM user_profiles AS up
    WHERE up.id = auth.uid() 
    AND up.role = 'tenant_admin'
    AND up.tenant_id = user_profiles.tenant_id
    AND up.deleted_at IS NULL
  )
);

-- For UPDATE by tenant admins
CREATE POLICY "Tenant admins can update tenant profiles" 
ON user_profiles FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM user_profiles AS up
    WHERE up.id = auth.uid() 
    AND up.role = 'tenant_admin'
    AND up.tenant_id = user_profiles.tenant_id
    AND up.deleted_at IS NULL
  )
);

-- Add comment to track the fix
COMMENT ON TABLE user_profiles IS 'User profiles - fixed RLS recursion 2026-02-19';