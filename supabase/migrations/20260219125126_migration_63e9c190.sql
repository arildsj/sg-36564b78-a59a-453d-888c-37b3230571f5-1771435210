-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to whitelisted_numbers
DROP TRIGGER IF EXISTS update_whitelisted_numbers_updated_at ON whitelisted_numbers;
CREATE TRIGGER update_whitelisted_numbers_updated_at
  BEFORE UPDATE ON whitelisted_numbers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();