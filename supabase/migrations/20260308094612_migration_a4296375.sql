DO $$
BEGIN
  -- 1. sms_gateways skal ha gw_phone (ikke phone_number)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sms_gateways' AND column_name = 'phone_number') THEN
    ALTER TABLE sms_gateways RENAME COLUMN phone_number TO gw_phone;
  END IF;
  
  -- 2. campaign_recipients skal ha phone (ikke phone_number)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaign_recipients' AND column_name = 'phone_number') THEN
    ALTER TABLE campaign_recipients RENAME COLUMN phone_number TO phone;
  END IF;

  -- 3. bulk_campaigns skal ha created_by (ikke created_by_user_id)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bulk_campaigns' AND column_name = 'created_by_user_id') THEN
    ALTER TABLE bulk_campaigns RENAME COLUMN created_by_user_id TO created_by;
  END IF;

  -- 4. user_profiles skal ha phone (ikke phone_number)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'phone_number') THEN
    ALTER TABLE user_profiles RENAME COLUMN phone_number TO phone;
  END IF;
END $$;