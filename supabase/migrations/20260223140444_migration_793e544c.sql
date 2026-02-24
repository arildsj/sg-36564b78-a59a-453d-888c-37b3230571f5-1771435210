-- Enable RLS and create policies for messages table
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Policy 1: Users can view messages in their tenant's groups
CREATE POLICY "Users can view messages in their tenant groups" 
ON messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM group_memberships gm
    INNER JOIN user_profiles up ON up.id = gm.user_id
    WHERE gm.group_id = messages.resolved_group_id
    AND up.id = auth.uid()
  )
);

-- Policy 2: Users can insert messages to their tenant's groups
CREATE POLICY "Users can insert messages to their tenant groups" 
ON messages FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM group_memberships gm
    INNER JOIN user_profiles up ON up.id = gm.user_id
    WHERE gm.group_id = messages.resolved_group_id
    AND up.id = auth.uid()
  )
);

-- Policy 3: Users can update messages in their tenant's groups
CREATE POLICY "Users can update messages in their tenant groups" 
ON messages FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM group_memberships gm
    INNER JOIN user_profiles up ON up.id = gm.user_id
    WHERE gm.group_id = messages.resolved_group_id
    AND up.id = auth.uid()
  )
);