-- Drop existing CHECK constraints that enforce E.164 format only
ALTER TABLE message_threads DROP CONSTRAINT IF EXISTS message_threads_contact_phone_check;

-- Add new constraint that allows both E.164 format AND alphanumeric sender IDs (1-11 chars)
-- E.164: +[1-9][0-9]{1,14}
-- Alphanumeric: [A-Za-z0-9]{1,11}
ALTER TABLE message_threads 
ADD CONSTRAINT message_threads_contact_phone_check 
CHECK (
  contact_phone ~ '^(\+[1-9]\d{1,14}|[A-Za-z0-9]{1,11})$'
);

-- Update contacts table to allow alphanumeric phone numbers
-- Note: contacts.phone_number doesn't have a CHECK constraint, but we should add one for consistency
ALTER TABLE contacts 
ADD CONSTRAINT contacts_phone_number_format_check 
CHECK (
  phone_number IS NULL OR 
  phone_number ~ '^(\+[1-9]\d{1,14}|[A-Za-z0-9]{1,11})$'
);