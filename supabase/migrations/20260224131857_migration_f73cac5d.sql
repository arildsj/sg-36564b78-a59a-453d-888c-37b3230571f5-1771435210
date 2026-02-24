-- 1. Drop ALL policies on user_profiles (even if they don't exist, just to be safe)
DO $$ 
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'user_profiles'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_profiles', policy_record.policyname);
        RAISE NOTICE 'Dropped policy: %', policy_record.policyname;
    END LOOP;
END $$;

-- 2. Verify no policies exist
SELECT COUNT(*) as remaining_policies
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'user_profiles';

-- 3. Force PostgREST reload
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

-- 4. Add timestamp comment for tracking
COMMENT ON TABLE public.user_profiles IS 'User profiles table. RLS disabled. All permissions via application layer. Policies dropped and cache refreshed: 2026-02-24 13:18';