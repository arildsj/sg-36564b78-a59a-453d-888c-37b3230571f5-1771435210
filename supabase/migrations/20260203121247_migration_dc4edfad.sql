-- Add campaign_id to messages table to link responses to bulk campaigns
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES bulk_campaigns(id) ON DELETE SET NULL;

-- Add source_group_id to bulk_campaigns to track which group sent the campaign
ALTER TABLE bulk_campaigns 
ADD COLUMN IF NOT EXISTS source_group_id uuid REFERENCES groups(id) ON DELETE SET NULL;

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_messages_campaign_id ON messages(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_source_group ON bulk_campaigns(source_group_id);

-- Add recipient status tracking columns to bulk_recipients
ALTER TABLE bulk_recipients 
ADD COLUMN IF NOT EXISTS responded_at timestamptz,
ADD COLUMN IF NOT EXISTS response_message_id uuid REFERENCES messages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_recipients_campaign_status ON bulk_recipients(campaign_id, status);