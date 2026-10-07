-- Match the existing documented access model; see README.md before applying.
BEGIN;
CREATE TABLE public.revisit (
  "createdAt" timestamp DEFAULT now(),
  "studyId" varchar NOT NULL,
  "docId" varchar NOT NULL,
  data jsonb,
  PRIMARY KEY ("studyId", "docId")
);
ALTER TABLE public.revisit ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.revisit TO anon, authenticated, service_role;
CREATE POLICY allow_authenticated_read_write ON public.revisit FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
INSERT INTO storage.buckets (id, name, public) VALUES ('revisit', 'revisit', false);
CREATE POLICY revisit_storage_read_write ON storage.objects FOR ALL TO anon, authenticated, service_role USING (bucket_id = 'revisit') WITH CHECK (bucket_id = 'revisit');
COMMIT;
