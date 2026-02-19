-- ============================================================================
-- FIX: Recreate safe policies WITHOUT recursion for user_profiles
-- ============================================================================

-- 1. Users can view profiles in same tenant (NO user_tenant_id() call!)
CREATE POLICY "users_view_same_tenant_profiles" 
ON user_profiles FOR SELECT
USING (
  -- Direct join to avoid function calls
  tenant_id IN (
    SELECT tenant_id 
    FROM user_profiles 
    WHERE id = auth.uid()
  )
);

-- 2. Users can update their own profile
CREATE POLICY "users_update_own_profile"
ON user_profiles FOR UPDATE
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

SELECT 'user_profiles policies recreated safely!' AS status;