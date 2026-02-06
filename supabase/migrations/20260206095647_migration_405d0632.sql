-- Add parent_message_id column to messages table
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS parent_message_id UUID REFERENCES messages(id) ON DELETE SET NULL;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_messages_parent_message_id ON messages(parent_message_id);

-- Add comment
COMMENT ON COLUMN messages.parent_message_id IS 'Reference to the parent message (for bulk campaign responses)';