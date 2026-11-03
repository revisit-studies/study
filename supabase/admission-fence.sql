-- Apply before deploying clients that use fenced admission. SECURITY INVOKER
-- preserves the revisit table's existing RLS and grants.
CREATE OR REPLACE FUNCTION public.revisit_reserve_assignment(
  p_study_id text, p_participant_id text, p_assignment jsonb,
  p_token text, p_created_at timestamp DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE lease jsonb;
  source_id text := p_assignment->>'claimedParticipantId';
BEGIN
  SELECT data INTO lease FROM public.revisit
    WHERE "studyId" = p_study_id AND "docId" = 'lock_participant-assignment'
    FOR UPDATE;
  IF lease IS NULL OR lease->>'token' IS DISTINCT FROM p_token
    OR COALESCE((lease->>'expiresAt')::numeric, 0) <= extract(epoch FROM clock_timestamp()) * 1000 THEN
    RAISE EXCEPTION 'Admission lease expired; reload and try again';
  END IF;
  -- The lock row stays locked until this assignment is committed. A competing
  -- lease acquisition cannot pass between ownership validation and reservation.
  IF source_id IS NOT NULL THEN
    UPDATE public.revisit SET data = data || jsonb_build_object(
      'claimed', true, 'sequenceIndex', p_assignment->'sequenceIndex')
      WHERE "studyId" = p_study_id AND "docId" = 'sequenceAssignment_' || source_id
        AND data->>'rejected' = 'true' AND data->>'claimed' = 'false';
    IF NOT FOUND THEN RAISE EXCEPTION 'Reusable assignment is no longer available'; END IF;
  END IF;
  INSERT INTO public.revisit ("studyId", "docId", data, "createdAt")
    VALUES (p_study_id, 'sequenceAssignment_' || p_participant_id, p_assignment,
      COALESCE(p_created_at, timezone('utc', clock_timestamp())))
    ON CONFLICT ("studyId", "docId") DO UPDATE SET data = EXCLUDED.data,
      "createdAt" = COALESCE(p_created_at, revisit."createdAt");
END;
$$;
REVOKE ALL ON FUNCTION public.revisit_reserve_assignment(text,text,jsonb,text,timestamp) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revisit_reserve_assignment(text,text,jsonb,text,timestamp) TO anon, authenticated, service_role;
