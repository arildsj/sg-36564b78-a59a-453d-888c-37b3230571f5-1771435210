-- ================================================
-- UNIFIED SENDING MODEL - BASERT PÅ FAKTISK SKJEMA
-- ================================================

-- 1) Legg til campaign_type kolonne (NYT!)
ALTER TABLE public.bulk_campaigns
  ADD COLUMN IF NOT EXISTS campaign_type text;

-- 2) Legg til sent_immediately kolonne (NYT!)
ALTER TABLE public.bulk_campaigns
  ADD COLUMN IF NOT EXISTS sent_immediately boolean;

-- 3) Backfill campaign_type basert på scheduled_at og total_recipients
UPDATE public.bulk_campaigns
SET campaign_type = CASE
  WHEN scheduled_at IS NOT NULL AND scheduled_at > NOW() THEN 'scheduled'
  WHEN COALESCE(total_recipients, 0) <= 1 THEN 'single'
  ELSE 'bulk'
END
WHERE campaign_type IS NULL;

-- 4) Backfill sent_immediately
UPDATE public.bulk_campaigns
SET sent_immediately = (scheduled_at IS NULL)
WHERE sent_immediately IS NULL;

-- 5) Sett default og NOT NULL
ALTER TABLE public.bulk_campaigns
  ALTER COLUMN campaign_type SET DEFAULT 'bulk';

ALTER TABLE public.bulk_campaigns
  ALTER COLUMN campaign_type SET NOT NULL;

ALTER TABLE public.bulk_campaigns
  ALTER COLUMN sent_immediately SET DEFAULT true;

ALTER TABLE public.bulk_campaigns
  ALTER COLUMN sent_immediately SET NOT NULL;

-- 6) Drop gamle constraints
ALTER TABLE public.bulk_campaigns
  DROP CONSTRAINT IF EXISTS bulk_campaigns_status_check;

ALTER TABLE public.bulk_campaigns
  DROP CONSTRAINT IF EXISTS bulk_campaigns_campaign_type_check;

-- 7) Legg til nye constraints
-- STATUS: draft, scheduled, sending, completed, failed (INGEN PARTIAL!)
ALTER TABLE public.bulk_campaigns
  ADD CONSTRAINT bulk_campaigns_status_check
  CHECK (status = ANY (ARRAY['draft'::text, 'scheduled'::text, 'sending'::text, 'completed'::text, 'failed'::text]));

-- CAMPAIGN_TYPE: single, bulk, scheduled
ALTER TABLE public.bulk_campaigns
  ADD CONSTRAINT bulk_campaigns_campaign_type_check
  CHECK (campaign_type = ANY (ARRAY['single'::text, 'bulk'::text, 'scheduled'::text]));

-- 8) Legg til index for raskere søk
CREATE INDEX IF NOT EXISTS idx_bulk_campaigns_type_status 
  ON public.bulk_campaigns(campaign_type, status, created_at DESC);

-- 9) Legg til kommentarer for dokumentasjon
COMMENT ON COLUMN public.bulk_campaigns.campaign_type IS 
  'Campaign type: single (1 recipient), bulk (2+ recipients), scheduled (future send)';

COMMENT ON COLUMN public.bulk_campaigns.sent_immediately IS 
  'True if campaign was sent immediately without scheduling';

-- 10) Vis resultat for verifisering
SELECT 
  campaign_type,
  status,
  COUNT(*) as count,
  MIN(created_at) as first_campaign,
  MAX(created_at) as last_campaign
FROM public.bulk_campaigns
GROUP BY campaign_type, status
ORDER BY campaign_type, status;