-- Step 1: Drop existing constraint
ALTER TABLE message_threads DROP CONSTRAINT IF EXISTS message_threads_unique_contact_group;