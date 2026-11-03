-- Run only in an empty disposable PostgreSQL database using psql -v ON_ERROR_STOP=1.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
CREATE SCHEMA storage;
CREATE TABLE storage.buckets (id text PRIMARY KEY, name text, public boolean);
CREATE TABLE storage.objects (bucket_id text);
\ir ../revisit.sql
\ir ../admission-fence.sql
SET ROLE anon;
INSERT INTO public.revisit ("studyId", "docId", data) VALUES ('test', 'lock_participant-assignment',
  jsonb_build_object('token','live','expiresAt',extract(epoch FROM clock_timestamp())*1000+60000));
SELECT public.revisit_reserve_assignment('test','accepted','{"participantId":"accepted"}','live');
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM public.revisit WHERE "docId"='sequenceAssignment_accepted') THEN
    RAISE EXCEPTION 'Valid reservation was not committed';
  END IF;
  BEGIN
    PERFORM public.revisit_reserve_assignment('test','stale','{}','wrong');
    RAISE EXCEPTION 'Wrong token was accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Admission lease expired%' THEN RAISE; END IF;
  END;
END $$;
UPDATE public.revisit SET data = jsonb_build_object('token','live','expiresAt',0)
  WHERE "docId"='lock_participant-assignment';
DO $$ BEGIN
  BEGIN
    PERFORM public.revisit_reserve_assignment('test','expired','{}','live');
    RAISE EXCEPTION 'Expired token was accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Admission lease expired%' THEN RAISE; END IF;
  END;
  IF (SELECT count(*) FROM public.revisit WHERE "docId" LIKE 'sequenceAssignment_%') <> 1 THEN
    RAISE EXCEPTION 'Rejected reservations wrote assignments';
  END IF;
END $$;

RESET ROLE;
INSERT INTO public.revisit ("studyId", "docId", data) VALUES ('test','sequenceAssignment_source','{"rejected":true,"claimed":false}');
SET ROLE anon;
DO $$ BEGIN
  BEGIN
    PERFORM public.revisit_reserve_assignment('test','denied','{"claimedParticipantId":"source","sequenceIndex":0}','live');
    RAISE EXCEPTION 'Expired replacement was accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Admission lease expired%' THEN RAISE; END IF;
  END;
  IF EXISTS (SELECT FROM public.revisit WHERE "docId"='sequenceAssignment_source' AND data->>'claimed'='true') THEN
    RAISE EXCEPTION 'Denied reservation claimed its source';
  END IF;
END $$;
UPDATE public.revisit SET data = jsonb_build_object('token','live','expiresAt',extract(epoch FROM clock_timestamp())*1000+60000) WHERE "docId"='lock_participant-assignment';
SELECT public.revisit_reserve_assignment('test','replacement','{"claimedParticipantId":"source","sequenceIndex":0}','live');
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM public.revisit WHERE "docId"='sequenceAssignment_source' AND data->>'claimed'='true') THEN
    RAISE EXCEPTION 'Accepted replacement did not claim its source';
  END IF;
END $$;
