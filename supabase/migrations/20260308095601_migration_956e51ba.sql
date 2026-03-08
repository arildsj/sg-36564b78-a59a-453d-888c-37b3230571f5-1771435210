DO $$
BEGIN
  -- 1. Sync table name with CSV
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'bulk_recipients') THEN
    ALTER TABLE public.bulk_recipients RENAME TO campaign_recipients;
  END IF;

  -- 2. Sync sms_gateways columns with CSV
  IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'sms_gateways' AND column_name = 'phone_number') THEN
    ALTER TABLE public.sms_gateways RENAME COLUMN phone_number TO gw_phone;
  END IF;
  
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'sms_gateways' AND column_name = 'is_active') THEN
    ALTER TABLE public.sms_gateways ADD COLUMN is_active boolean DEFAULT true;
  END IF;

  -- 3. Ensure contacts uses 'phone' as per CSV
  IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'phone_number') THEN
    ALTER TABLE public.contacts RENAME COLUMN phone_number TO phone;
  END IF;
END $$;