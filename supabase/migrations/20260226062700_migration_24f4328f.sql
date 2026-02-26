-- Rename gateways table to sms_gateways
ALTER TABLE IF EXISTS gateways RENAME TO sms_gateways;

-- Verify the rename
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'sms_gateways';