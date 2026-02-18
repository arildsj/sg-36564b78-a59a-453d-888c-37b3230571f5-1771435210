-- Add 'sender' as allowed rule_type in routing_rules table
ALTER TABLE routing_rules DROP CONSTRAINT routing_rules_rule_type_check;
ALTER TABLE routing_rules ADD CONSTRAINT routing_rules_rule_type_check 
  CHECK (rule_type IN ('prefix', 'keyword', 'sender', 'fallback'));