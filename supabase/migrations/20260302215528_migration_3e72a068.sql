-- 1. USER PROFILES: Rename phone_number -> phone
DO $$
BEGIN
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='phone_number') THEN
    ALTER TABLE user_profiles RENAME COLUMN phone_number TO phone;
  END IF;
END $$;

-- Legg til group_id hvis den mangler
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES groups(id) ON DELETE SET NULL;

-- 2. GROUPS: Rename parent_group_id -> parent_id
DO $$
BEGIN
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='groups' AND column_name='parent_group_id') THEN
    ALTER TABLE groups RENAME COLUMN parent_group_id TO parent_id;
  END IF;
END $$;

-- Legg til gateway_id hvis den mangler
ALTER TABLE groups ADD COLUMN IF NOT EXISTS gateway_id UUID REFERENCES sms_gateways(id) ON DELETE SET NULL;

-- 3. CONTACTS: Tilpass til Fasit
-- Legg til kolonner
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES groups(id) ON DELETE SET NULL;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS phone TEXT; 

-- Migrer data: first_name/last_name -> name
UPDATE contacts 
SET name = TRIM(BOTH FROM COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')) 
WHERE name IS NULL AND (first_name IS NOT NULL OR last_name IS NOT NULL);

-- Migrer data: Sjekk om phone finnes i annen tabell eller kolonne?
-- Hvis 'phone' kolonnen var ny (TEXT), og vi ikke hadde 'phone_number' i contacts...
-- Fasit sier 'phone'. Nåværende analyse sa 'phone' manglet.
-- Men kanskje den lå i 'contact_phones' eller lignende?
-- For nå, sikrer vi at kolonnen finnes.