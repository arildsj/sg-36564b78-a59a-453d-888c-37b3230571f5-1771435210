-- Create UNIQUE constraint to prevent future duplicates
ALTER TABLE message_threads
ADD CONSTRAINT message_threads_unique_contact_group 
UNIQUE (tenant_id, contact_phone, resolved_group_id);