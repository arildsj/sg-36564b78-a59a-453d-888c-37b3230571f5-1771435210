-- Add reply_window_hours column to bulk_campaigns table
ALTER TABLE bulk_campaigns 
ADD COLUMN reply_window_hours integer NOT NULL DEFAULT 6
CHECK (reply_window_hours IN (6, 12, 18, 24, 30, 36, 42, 48));

-- Add comment
COMMENT ON COLUMN bulk_campaigns.reply_window_hours IS 'Number of hours replies should be linked to this campaign (6-48 hours in 6-hour increments)';