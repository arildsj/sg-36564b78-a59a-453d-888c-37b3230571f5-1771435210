-- ── Fix: enable Realtime for all subscribed tables ───────────────────────────
-- Problem: group_memberships and message_threads were missing from the
-- supabase_realtime publication, so Realtime events were never delivered.
-- activation_requests and messages were already in the publication but
-- had REPLICA IDENTITY DEFAULT, meaning UPDATE/DELETE payloads were
-- missing non-PK columns.
--
-- Already confirmed in live DB: messages and activation_requests were present.
-- This migration documents what was applied directly.

-- Add missing tables to Realtime publication
ALTER PUBLICATION supabase_realtime
  ADD TABLE group_memberships, message_threads;

-- Full replica identity so payload.new/old includes all columns on UPDATE/DELETE
ALTER TABLE activation_requests  REPLICA IDENTITY FULL;
ALTER TABLE group_memberships    REPLICA IDENTITY FULL;
ALTER TABLE messages             REPLICA IDENTITY FULL;
ALTER TABLE message_threads      REPLICA IDENTITY FULL;
