-- Add missing columns to gateways table
ALTER TABLE gateways 
ADD COLUMN IF NOT EXISTS base_url text,
ADD COLUMN IF NOT EXISTS is_default boolean DEFAULT false;