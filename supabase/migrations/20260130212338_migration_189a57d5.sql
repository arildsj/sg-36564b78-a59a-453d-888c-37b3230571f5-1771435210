-- Create message_threads table
CREATE TABLE IF NOT EXISTS message_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  gateway_id UUID NOT NULL REFERENCES gateways(id) ON DELETE CASCADE,
  contact_phone TEXT NOT NULL,
  resolved_group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  is_resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT message_threads_contact_phone_check CHECK (contact_phone ~ '^\+[1-9]\d{1,14}$'),
  CONSTRAINT message_threads_resolved_at_check CHECK (
    (is_resolved = false AND resolved_at IS NULL) OR
    (is_resolved = true AND resolved_at IS NOT NULL)
  )
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_message_threads_tenant_id ON message_threads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_message_threads_gateway_id ON message_threads(gateway_id);
CREATE INDEX IF NOT EXISTS idx_message_threads_resolved_group_id ON message_threads(resolved_group_id);
CREATE INDEX IF NOT EXISTS idx_message_threads_contact_phone ON message_threads(contact_phone);
CREATE INDEX IF NOT EXISTS idx_message_threads_last_message_at ON message_threads(tenant_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_threads_is_resolved ON message_threads(tenant_id, is_resolved);

-- Unique constraint: one thread per contact+group combination
CREATE UNIQUE INDEX IF NOT EXISTS idx_message_threads_unique_contact_group 
ON message_threads(tenant_id, contact_phone, resolved_group_id) 
WHERE is_resolved = false;

-- Add thread_id to messages table
ALTER TABLE messages ADD COLUMN IF NOT EXISTS thread_id UUID REFERENCES message_threads(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON messages(thread_id);

-- Add is_fallback to messages table (for tracking fallback classification)
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_fallback BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_messages_is_fallback ON messages(tenant_id, is_fallback) WHERE is_fallback = true;

-- Function to update thread's last_message_at timestamp
CREATE OR REPLACE FUNCTION update_thread_last_message_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE message_threads
  SET last_message_at = NEW.created_at,
      updated_at = NOW()
  WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically update thread timestamp when message is inserted
DROP TRIGGER IF EXISTS trigger_update_thread_last_message_at ON messages;
CREATE TRIGGER trigger_update_thread_last_message_at
  AFTER INSERT ON messages
  FOR EACH ROW
  WHEN (NEW.thread_id IS NOT NULL)
  EXECUTE FUNCTION update_thread_last_message_at();

-- RLS Policies for message_threads
ALTER TABLE message_threads ENABLE ROW LEVEL SECURITY;

-- Tenant isolation
CREATE POLICY "message_threads_tenant_isolation" ON message_threads
  USING (tenant_id IN (
    SELECT tenant_id FROM users WHERE auth_user_id = auth.uid()
  ));

-- Users can view threads for groups they belong to
CREATE POLICY "message_threads_select_policy" ON message_threads
  FOR SELECT
  USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE auth_user_id = auth.uid())
    AND (
      -- User is member of the resolved group
      resolved_group_id IN (
        SELECT group_id FROM group_memberships 
        WHERE user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
      )
      OR
      -- User is tenant admin
      EXISTS (
        SELECT 1 FROM users 
        WHERE auth_user_id = auth.uid() 
        AND role = 'tenant_admin'
        AND tenant_id = message_threads.tenant_id
      )
    )
  );

-- Users can insert threads (will be created by inbound-message function mostly)
CREATE POLICY "message_threads_insert_policy" ON message_threads
  FOR INSERT
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM users WHERE auth_user_id = auth.uid())
  );

-- Users can update threads they have access to
CREATE POLICY "message_threads_update_policy" ON message_threads
  FOR UPDATE
  USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE auth_user_id = auth.uid())
    AND (
      resolved_group_id IN (
        SELECT group_id FROM group_memberships 
        WHERE user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
      )
      OR
      EXISTS (
        SELECT 1 FROM users 
        WHERE auth_user_id = auth.uid() 
        AND role = 'tenant_admin'
        AND tenant_id = message_threads.tenant_id
      )
    )
  );

-- Comment for documentation
COMMENT ON TABLE message_threads IS 'Conversation threads grouping related messages between a contact and a group';
COMMENT ON COLUMN message_threads.contact_phone IS 'Contact phone number in E.164 format';
COMMENT ON COLUMN message_threads.resolved_group_id IS 'The operational group this thread is assigned to';
COMMENT ON COLUMN message_threads.is_resolved IS 'Whether this conversation has been resolved/closed';
COMMENT ON COLUMN message_threads.last_message_at IS 'Timestamp of the most recent message in this thread';