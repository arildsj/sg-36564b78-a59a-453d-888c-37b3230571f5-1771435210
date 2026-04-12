-- routing_rules: message type ('conversation' | 'alert')
ALTER TABLE routing_rules
  ADD COLUMN IF NOT EXISTS message_type text NOT NULL DEFAULT 'conversation'
    CHECK (message_type IN ('conversation', 'alert'));

-- messages: acknowledgment tracking
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS acknowledged_at timestamptz,
  ADD COLUMN IF NOT EXISTS acknowledged_by uuid REFERENCES user_profiles(id);
