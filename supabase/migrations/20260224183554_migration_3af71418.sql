-- Step 1: Drop CHECK constraint
ALTER TABLE whitelisted_numbers DROP CONSTRAINT IF EXISTS whitelisted_numbers_e164_check;

-- Step 2: Rename column phone_number to identifier
ALTER TABLE whitelisted_numbers RENAME COLUMN phone_number TO identifier;

-- Step 3: Add comment for clarity
COMMENT ON COLUMN whitelisted_numbers.identifier IS 'Alphanumeric identifier - can be phone number, brand name, or any text value for routing rules';