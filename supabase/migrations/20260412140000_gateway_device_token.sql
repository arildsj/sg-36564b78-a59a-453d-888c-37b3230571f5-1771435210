-- sms_gateways: device_token for FairGateway Android app registration
ALTER TABLE sms_gateways
  ADD COLUMN IF NOT EXISTS device_token text;
