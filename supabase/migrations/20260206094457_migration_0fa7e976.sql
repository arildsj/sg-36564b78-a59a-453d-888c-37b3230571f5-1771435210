-- Add sent_thread_id column to bulk_recipients table
ALTER TABLE bulk_recipients 
ADD COLUMN sent_thread_id uuid REFERENCES message_threads(id) ON DELETE SET NULL;

-- Add index for performance
CREATE INDEX idx_recipients_thread ON bulk_recipients(sent_thread_id);

-- Add comment
COMMENT ON COLUMN bulk_recipients.sent_thread_id IS 'The message thread created for this bulk campaign recipient';