-- Add timezone column to tenants for future per-organisation timezone support.
-- Not wired up yet — placeholder for when timezone becomes configurable.
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Europe/Oslo';
