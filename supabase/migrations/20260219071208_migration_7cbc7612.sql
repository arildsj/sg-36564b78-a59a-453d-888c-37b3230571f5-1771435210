-- Fix messages policies with correct column name (resolved_group_id)
-- Drop existing policies first
DROP POLICY IF EXISTS "Users can view messages in their groups" ON messages;
DROP POLICY IF EXISTS "Users can insert messages" ON messages;
DROP POLICY IF EXISTS "Users can update messages" ON messages;
DROP POLICY IF EXISTS "Tenant isolation for messages" ON messages;

-- Create new policies without recursion
-- Policy 1: Tenant isolation (most important - check tenant_id directly)
CREATE POLICY "Tenant isolation for messages"
ON messages
FOR ALL
USING (
  tenant_id IN (
    SELECT tenant_id 
    FROM user_profiles 
    WHERE id = auth.uid()
  )
);

-- Policy 2: Users can view messages in their tenant
CREATE POLICY "Users can view tenant messages"
ON messages
FOR SELECT
USING (
  tenant_id IN (
    SELECT tenant_id 
    FROM user_profiles 
    WHERE id = auth.uid()
  )
);

-- Policy 3: Users can insert messages
CREATE POLICY "Users can insert messages"
ON messages
FOR INSERT
WITH CHECK (
  tenant_id IN (
    SELECT tenant_id 
    FROM user_profiles 
    WHERE id = auth.uid()
  )
);

-- Policy 4: Users can update messages in their tenant
CREATE POLICY "Users can update messages"
ON messages
FOR UPDATE
USING (
  tenant_id IN (
    SELECT tenant_id 
    FROM user_profiles 
    WHERE id = auth.uid()
  )
);

-- Add comment to track the fix
COMMENT ON TABLE messages IS 'Messages - fixed RLS recursion with correct column names 2026-02-19';