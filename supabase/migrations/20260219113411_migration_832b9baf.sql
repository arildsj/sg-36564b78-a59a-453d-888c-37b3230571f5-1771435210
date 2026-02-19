-- ============================================================================
-- STEP 1: Simplify ALL RLS policies to basic authentication
-- No tenant checks, no function calls - pure auth.uid() checks only
-- All business logic moves to application code
-- ============================================================================

-- ============================================================================
-- 1. USER_PROFILES - Users can only see/edit their own profile
-- ============================================================================
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;

CREATE POLICY "Users can view own profile" 
ON user_profiles FOR SELECT 
TO authenticated 
USING (id = auth.uid());

CREATE POLICY "Users can update own profile" 
ON user_profiles FOR UPDATE 
TO authenticated 
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- ============================================================================
-- 2. MESSAGES - Basic authenticated access (tenant/group checks in app code)
-- ============================================================================
DROP POLICY IF EXISTS "Authenticated users can view messages" ON messages;
DROP POLICY IF EXISTS "Authenticated users can insert messages" ON messages;
DROP POLICY IF EXISTS "Authenticated users can update messages" ON messages;

CREATE POLICY "Authenticated users can view messages" 
ON messages FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can insert messages" 
ON messages FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update messages" 
ON messages FOR UPDATE 
TO authenticated 
USING (true)
WITH CHECK (true);

-- ============================================================================
-- 3. CONTACTS - Basic authenticated access
-- ============================================================================
DROP POLICY IF EXISTS "Authenticated users can view contacts" ON contacts;
DROP POLICY IF EXISTS "Authenticated users can insert contacts" ON contacts;
DROP POLICY IF EXISTS "Authenticated users can update contacts" ON contacts;
DROP POLICY IF EXISTS "Authenticated users can delete contacts" ON contacts;

CREATE POLICY "Authenticated users can view contacts" 
ON contacts FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can insert contacts" 
ON contacts FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update contacts" 
ON contacts FOR UPDATE 
TO authenticated 
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can delete contacts" 
ON contacts FOR DELETE 
TO authenticated 
USING (true);

-- ============================================================================
-- 4. GROUPS - Basic authenticated access
-- ============================================================================
DROP POLICY IF EXISTS "Authenticated users can view groups" ON groups;
DROP POLICY IF EXISTS "Authenticated users can insert groups" ON groups;
DROP POLICY IF EXISTS "Authenticated users can update groups" ON groups;
DROP POLICY IF EXISTS "Authenticated users can delete groups" ON groups;

CREATE POLICY "Authenticated users can view groups" 
ON groups FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can insert groups" 
ON groups FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update groups" 
ON groups FOR UPDATE 
TO authenticated 
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can delete groups" 
ON groups FOR DELETE 
TO authenticated 
USING (true);

-- ============================================================================
-- 5. GROUP_MEMBERSHIPS - Basic authenticated access
-- ============================================================================
DROP POLICY IF EXISTS "Authenticated users can view memberships" ON group_memberships;
DROP POLICY IF EXISTS "Authenticated users can insert memberships" ON group_memberships;
DROP POLICY IF EXISTS "Authenticated users can delete memberships" ON group_memberships;

CREATE POLICY "Authenticated users can view memberships" 
ON group_memberships FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can insert memberships" 
ON group_memberships FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Authenticated users can delete memberships" 
ON group_memberships FOR DELETE 
TO authenticated 
USING (true);

-- ============================================================================
-- 6. GATEWAYS - Basic authenticated access
-- ============================================================================
DROP POLICY IF EXISTS "Authenticated users can view gateways" ON gateways;
DROP POLICY IF EXISTS "Authenticated users can insert gateways" ON gateways;
DROP POLICY IF EXISTS "Authenticated users can update gateways" ON gateways;

CREATE POLICY "Authenticated users can view gateways" 
ON gateways FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can insert gateways" 
ON gateways FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update gateways" 
ON gateways FOR UPDATE 
TO authenticated 
USING (true)
WITH CHECK (true);

-- ============================================================================
-- 7. WHITELISTED_NUMBERS - Basic authenticated access
-- ============================================================================
DROP POLICY IF EXISTS "Authenticated users can view whitelisted" ON whitelisted_numbers;
DROP POLICY IF EXISTS "Authenticated users can insert whitelisted" ON whitelisted_numbers;
DROP POLICY IF EXISTS "Authenticated users can delete whitelisted" ON whitelisted_numbers;

CREATE POLICY "Authenticated users can view whitelisted" 
ON whitelisted_numbers FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can insert whitelisted" 
ON whitelisted_numbers FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Authenticated users can delete whitelisted" 
ON whitelisted_numbers FOR DELETE 
TO authenticated 
USING (true);

-- ============================================================================
-- 8. ROUTING_RULES - Basic authenticated access
-- ============================================================================
DROP POLICY IF EXISTS "Authenticated users can view rules" ON routing_rules;
DROP POLICY IF EXISTS "Authenticated users can insert rules" ON routing_rules;
DROP POLICY IF EXISTS "Authenticated users can update rules" ON routing_rules;
DROP POLICY IF EXISTS "Authenticated users can delete rules" ON routing_rules;

CREATE POLICY "Authenticated users can view rules" 
ON routing_rules FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can insert rules" 
ON routing_rules FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update rules" 
ON routing_rules FOR UPDATE 
TO authenticated 
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can delete rules" 
ON routing_rules FOR DELETE 
TO authenticated 
USING (true);

-- ============================================================================
-- Reload PostgREST schema cache
-- ============================================================================
NOTIFY pgrst, 'reload schema';

SELECT 'All RLS policies simplified to basic authentication!' AS status;