-- Extend messages.status CHECK constraint to include 'replied'.
-- The previous constraint silently rejected status='replied' updates
-- in messageService.sendMessage() and resolveThread() because no
-- .select() was chained — errors were swallowed.
ALTER TABLE messages DROP CONSTRAINT messages_status_check;
ALTER TABLE messages ADD CONSTRAINT messages_status_check
  CHECK (status = ANY (ARRAY['pending','sent','delivered','failed','received','replied']));
