-- STEP 1: Remove ALL policies from tables with RLS disabled
-- This eliminates the recursion problem

-- messages table - RLS disabled, remove all policies
DROP POLICY IF EXISTS "Users can view messages in their tenant groups" ON messages;
DROP POLICY IF EXISTS "Users can insert messages to their tenant groups" ON messages;
DROP POLICY IF EXISTS "Users can update messages in their tenant groups" ON messages;

-- whitelisted_numbers table - RLS disabled, remove conflicting policies  
DROP POLICY IF EXISTS "Authenticated users can view whitelisted" ON whitelisted_numbers;
DROP POLICY IF EXISTS "Authenticated users can insert whitelisted" ON whitelisted_numbers;
DROP POLICY IF EXISTS "Authenticated users can delete whitelisted" ON whitelisted_numbers;
DROP POLICY IF EXISTS "select_whitelisted_numbers" ON whitelisted_numbers;
DROP POLICY IF EXISTS "service_role_all_whitelisted" ON whitelisted_numbers;

-- user_profiles - already has RLS disabled and no policies (good!)

-- audit_log - RLS disabled, no policies (good!)
-- escalation_events - RLS disabled, no policies (good!)
-- notification_preferences - RLS disabled, no policies (good!)
-- notification_queue - RLS disabled, no policies (good!)