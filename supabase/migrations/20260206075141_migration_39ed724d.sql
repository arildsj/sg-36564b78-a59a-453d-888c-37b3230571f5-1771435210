-- Add target_group_id column to bulk_campaigns table
ALTER TABLE bulk_campaigns
ADD COLUMN target_group_id uuid REFERENCES groups(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX idx_campaigns_target_group ON bulk_campaigns(target_group_id);

-- Add comment
COMMENT ON COLUMN bulk_campaigns.target_group_id IS 'Target operational group for campaign messages';