-- Step 1: Create whitelisted_numbers table
CREATE TABLE IF NOT EXISTS whitelisted_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  identifier TEXT NOT NULL,
  label TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Add comment
COMMENT ON TABLE whitelisted_numbers IS 'Alphanumeric identifiers for routing rules - can be phone numbers, brand names, or any text value';
COMMENT ON COLUMN whitelisted_numbers.identifier IS 'Alphanumeric identifier - can be phone number, brand name, or any text value for routing rules';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_whitelisted_numbers_tenant ON whitelisted_numbers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_whitelisted_numbers_identifier ON whitelisted_numbers(identifier);
CREATE INDEX IF NOT EXISTS idx_whitelisted_numbers_deleted ON whitelisted_numbers(deleted_at) WHERE deleted_at IS NULL;

-- Enable RLS
ALTER TABLE whitelisted_numbers ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view whitelisted numbers in their tenant"
  ON whitelisted_numbers FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can insert whitelisted numbers"
  ON whitelisted_numbers FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM user_profiles WHERE id = auth.uid() AND role IN ('tenant_admin', 'group_admin')));

CREATE POLICY "Admins can update whitelisted numbers"
  ON whitelisted_numbers FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM user_profiles WHERE id = auth.uid() AND role IN ('tenant_admin', 'group_admin')));

CREATE POLICY "Admins can delete whitelisted numbers"
  ON whitelisted_numbers FOR DELETE
  USING (tenant_id IN (SELECT tenant_id FROM user_profiles WHERE id = auth.uid() AND role IN ('tenant_admin', 'group_admin')));