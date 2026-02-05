-- Add subject_line for bulk campaign identification in inbox
ALTER TABLE bulk_campaigns 
ADD COLUMN IF NOT EXISTS subject_line text,
ADD COLUMN IF NOT EXISTS bulk_code varchar(2),
ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- Simple index without predicate (faster than filtering at query time)
CREATE INDEX IF NOT EXISTS idx_campaigns_bulk_code ON bulk_campaigns(bulk_code, tenant_id);

-- Index for fast expiry lookups
CREATE INDEX IF NOT EXISTS idx_campaigns_expires_at ON bulk_campaigns(expires_at) WHERE expires_at IS NOT NULL;

-- Comments
COMMENT ON COLUMN bulk_campaigns.subject_line IS 'Subject/topic of bulk campaign, shown in conversation list';
COMMENT ON COLUMN bulk_campaigns.bulk_code IS '2-digit code for recipients to reference in replies (future feature)';
COMMENT ON COLUMN bulk_campaigns.expires_at IS 'Campaign expiry for automatic response matching (default: created_at + 6 hours)';