-- Step 2: Add new constraint - one thread per phone number
ALTER TABLE message_threads ADD CONSTRAINT message_threads_unique_contact 
UNIQUE (tenant_id, contact_phone);