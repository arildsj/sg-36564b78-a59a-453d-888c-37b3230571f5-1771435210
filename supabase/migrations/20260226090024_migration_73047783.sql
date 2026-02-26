ALTER TABLE sms_gateways 
ADD COLUMN base_url text;

COMMENT ON COLUMN sms_gateways.base_url IS 'Gateway API endpoint URL';