-- Opprett supabase_migrations schema hvis det ikke eksisterer
CREATE SCHEMA IF NOT EXISTS supabase_migrations;

-- Opprett schema_migrations tabell (Supabase sin standard struktur)
CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
    version text PRIMARY KEY,
    statements text[],
    name text,
    inserted_at timestamptz DEFAULT NOW()
);

-- Registrer alle våre migrasjoner som "kjørt"
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES 
    ('20260218190627', 'migration_04032d32 - Initial Schema', ARRAY['-- Initial schema migration']::text[]),
    ('20260218191006', 'migration_6de67430 - RLS Policies', ARRAY['-- RLS policies migration']::text[]),
    ('20260218191125', 'migration_812fc731 - Audit Functions', ARRAY['-- Audit functions migration']::text[]),
    ('20260218191319', 'migration_fb6caed4 - Helper Functions', ARRAY['-- Helper functions migration']::text[])
ON CONFLICT (version) DO NOTHING;