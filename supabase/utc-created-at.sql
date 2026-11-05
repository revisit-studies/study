-- Existing deployments: store createdAt in UTC, matching revisit.sql.
-- Rows written so far hold local time in the timezone of the sessions that wrote
-- them (PostgREST's), which can differ from this session's, so pass it explicitly:
--   psql -v source_timezone=America/Denver ... < utc-created-at.sql
-- The table is locked until the conversion commits. Once the default is UTC,
-- rerunning does nothing.
BEGIN;
-- Lock before checking the default, so concurrent runs cannot both convert.
LOCK TABLE public.revisit IN ACCESS EXCLUSIVE MODE;
SELECT set_config('revisit.source_timezone', :'source_timezone', true);
DO $$
DECLARE
  source_timezone text := current_setting('revisit.source_timezone');
BEGIN
  -- Reject an unknown timezone name before changing anything.
  PERFORM now() AT TIME ZONE source_timezone;
  IF (
    SELECT pg_get_expr(d.adbin, d.adrelid)
    FROM pg_attrdef d
    JOIN pg_attribute a ON a.attrelid = d.adrelid AND a.attnum = d.adnum
    WHERE d.adrelid = 'public.revisit'::regclass AND a.attname = 'createdAt'
  ) = 'now()' THEN
    ALTER TABLE public.revisit ALTER COLUMN "createdAt" SET DEFAULT (now() AT TIME ZONE 'utc');
    UPDATE public.revisit
      SET "createdAt" = ("createdAt" AT TIME ZONE source_timezone) AT TIME ZONE 'utc'
      WHERE "createdAt" IS NOT NULL;
  END IF;
END $$;
COMMIT;
