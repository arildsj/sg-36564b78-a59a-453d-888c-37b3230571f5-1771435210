DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'campaign_recipients' AND column_name = 'phone_number') THEN
    ALTER TABLE public.campaign_recipients RENAME COLUMN phone_number TO phone;
  END IF;
END $$;