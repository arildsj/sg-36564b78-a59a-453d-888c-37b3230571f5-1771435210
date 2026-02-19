-- Drop ALL existing policies on messages
DROP POLICY IF EXISTS "System can update message status" ON messages;
DROP POLICY IF EXISTS "Tenant isolation for messages" ON messages;
DROP POLICY IF EXISTS "Users can insert messages" ON messages;
DROP POLICY IF EXISTS "Users can send messages from their groups" ON messages;
DROP POLICY IF EXISTS "Users can update messages" ON messages;
DROP POLICY IF EXISTS "Users can view tenant messages" ON messages;

-- Create ONLY safe, non-recursive policies
-- 1. Users can view messages in their tenant
CREATE POLICY "users_view_tenant_messages" ON messages
    FOR SELECT
    USING (
        tenant_id IN (
            SELECT up.tenant_id 
            FROM user_profiles up 
            WHERE up.id = auth.uid() AND up.deleted_at IS NULL
        )
    );

-- 2. Users can insert messages
CREATE POLICY "users_insert_messages" ON messages
    FOR INSERT
    WITH CHECK (
        tenant_id IN (
            SELECT up.tenant_id 
            FROM user_profiles up 
            WHERE up.id = auth.uid() AND up.deleted_at IS NULL
        )
    );

-- 3. Users can update messages in their tenant
CREATE POLICY "users_update_tenant_messages" ON messages
    FOR UPDATE
    USING (
        tenant_id IN (
            SELECT up.tenant_id 
            FROM user_profiles up 
            WHERE up.id = auth.uid() AND up.deleted_at IS NULL
        )
    );

-- 4. System (service role) can update any message
CREATE POLICY "service_role_update_messages" ON messages
    FOR UPDATE
    USING (true);

COMMENT ON TABLE messages IS 'Messages - cleaned up all policies 2026-02-19';