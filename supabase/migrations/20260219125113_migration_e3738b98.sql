-- Create whitelisted_numbers table
CREATE TABLE IF NOT EXISTS whitelisted_numbers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone_number TEXT NOT NULL,
  name TEXT,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(phone_number, tenant_id)
);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_whitelisted_numbers_tenant ON whitelisted_numbers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_whitelisted_numbers_phone ON whitelisted_numbers(phone_number);

-- Add comment
COMMENT ON TABLE whitelisted_numbers IS 'Stores whitelisted phone numbers per tenant. RLS disabled - application level security via permissionService.ts. 2026-02-19';

-- Disable RLS (application-level security only)
ALTER TABLE whitelisted_numbers DISABLE ROW LEVEL SECURITY;