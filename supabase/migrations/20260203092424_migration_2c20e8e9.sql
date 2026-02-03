-- Add is_fallback column to groups table
ALTER TABLE groups ADD COLUMN IF NOT EXISTS is_fallback BOOLEAN DEFAULT FALSE;

-- Create unique constraint to ensure only one fallback group per tenant
CREATE UNIQUE INDEX IF NOT EXISTS groups_tenant_fallback_unique 
ON groups (tenant_id) 
WHERE is_fallback = TRUE;