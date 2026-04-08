-- Add flat columns to routing_rules to match the service layer expectations.
-- The table previously only had conditions/action JSONB; the service code
-- reads/writes flat columns, so these were silently returning undefined.

ALTER TABLE routing_rules
  ADD COLUMN IF NOT EXISTS match_type text,
  ADD COLUMN IF NOT EXISTS match_value text,
  ADD COLUMN IF NOT EXISTS target_group_id uuid REFERENCES groups(id),
  ADD COLUMN IF NOT EXISTS gateway_id uuid,
  ADD COLUMN IF NOT EXISTS escalation_config jsonb;

-- Create escalation_events if it doesn't exist yet.
-- (Defined in database.types.ts but was never created in the live DB.)
CREATE TABLE IF NOT EXISTS escalation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid REFERENCES messages(id),
  escalation_level integer NOT NULL,
  escalated_to_group_id uuid REFERENCES groups(id),
  escalated_to_user_ids uuid[],
  method text NOT NULL, -- 'sms', 'push', 'voicecall'
  triggered_at timestamptz DEFAULT now(),
  tenant_id uuid NOT NULL
);
