-- Existing deployments: store createdAt in UTC, matching revisit.sql.
-- Rows written so far hold the database's local time, so convert them once from
-- the current server timezone. The default is changed first, which blocks writes
-- until the conversion commits. Once the default is UTC, rerunning does nothing.
DO $$
BEGIN
  IF (
    SELECT pg_get_expr(d.adbin, d.adrelid)
    FROM pg_attrdef d
    JOIN pg_attribute a ON a.attrelid = d.adrelid AND a.attnum = d.adnum
    WHERE d.adrelid = 'public.revisit'::regclass AND a.attname = 'createdAt'
  ) = 'now()' THEN
    ALTER TABLE public.revisit ALTER COLUMN "createdAt" SET DEFAULT (now() AT TIME ZONE 'utc');
    UPDATE public.revisit
      SET "createdAt" = ("createdAt" AT TIME ZONE current_setting('TimeZone')) AT TIME ZONE 'utc'
      WHERE "createdAt" IS NOT NULL;
  END IF;
END $$;
