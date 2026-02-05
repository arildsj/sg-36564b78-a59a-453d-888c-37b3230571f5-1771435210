-- Add 'contacts' as a valid import_type for csv_import_jobs
ALTER TABLE csv_import_jobs DROP CONSTRAINT IF EXISTS csv_import_jobs_import_type_check;

ALTER TABLE csv_import_jobs ADD CONSTRAINT csv_import_jobs_import_type_check 
  CHECK (import_type IN ('users', 'whitelisted_numbers', 'whitelist_links', 'contacts'));