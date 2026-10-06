-- Match the access model in the reVISit Supabase setup guide.
-- These shared permissions do not isolate studies or participants.
BEGIN;

CREATE TABLE IF NOT EXISTS public.revisit (
  "createdAt" timestamp DEFAULT now(),
  "studyId" varchar NOT NULL,
  "docId" varchar NOT NULL,
  data jsonb,
  PRIMARY KEY ("studyId", "docId")
);

ALTER TABLE public.revisit ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.revisit TO anon, authenticated, service_role;

INSERT INTO storage.buckets (id, name, public)
VALUES ('revisit', 'revisit', false)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'revisit'
      AND policyname = 'allow_authenticated_read_write'
  ) THEN
    CREATE POLICY allow_authenticated_read_write ON public.revisit
      FOR ALL TO anon, authenticated, service_role
      USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'revisit_read_write'
  ) THEN
    CREATE POLICY revisit_read_write ON storage.objects
      FOR ALL TO anon, authenticated, service_role
      USING (bucket_id = 'revisit') WITH CHECK (bucket_id = 'revisit');
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';
COMMIT;
