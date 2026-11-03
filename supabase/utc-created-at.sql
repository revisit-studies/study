-- Existing deployments: store new createdAt values in UTC, matching revisit.sql.
-- Safe to rerun. Rows written before this change keep their original values.
ALTER TABLE public.revisit ALTER COLUMN "createdAt" SET DEFAULT (now() AT TIME ZONE 'utc');
