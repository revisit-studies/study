-- Atomically reserve a participant's sequence and creation indexes in one provider call.
-- Existing deployments can apply this migration without rewriting allocator or assignment rows;
-- the client retains its bounded compare-and-swap fallback until the function is installed.
create or replace function public.allocate_sequence_assignment(
  p_study_id text,
  p_participant_id text,
  p_assignment jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  assignment_doc_id text := 'sequenceAssignment_' || p_participant_id;
  allocator_data jsonb;
  existing_assignment jsonb;
  existing_created_at timestamptz;
  reusable_doc_id text;
  reusable_assignment jsonb;
  reusable_created_at timestamptz;
  sequence_index bigint;
  creation_index bigint;
  next_sequence_index bigint;
  next_creation_index bigint;
  total_assignments bigint;
  claimed_assignments bigint;
  reusable_timestamp_ms double precision;
begin
  -- Bound lock contention instead of allowing participant startup to wait indefinitely.
  set local lock_timeout = '5s';
  perform pg_advisory_xact_lock(hashtextextended(p_study_id, 0));

  select data, "createdAt"
    into existing_assignment, existing_created_at
    from public.revisit
   where "studyId" = p_study_id
     and "docId" = assignment_doc_id;

  if found then
    if existing_assignment ? 'sequenceIndex'
       and existing_assignment ? 'creationIndex' then
      return jsonb_build_object(
        'sequenceIndex', (existing_assignment->>'sequenceIndex')::bigint,
        'creationIndex', (existing_assignment->>'creationIndex')::bigint
      );
    end if;

    -- Lazy compatibility for assignments written before allocator metadata existed.
    select count(*)
      into sequence_index
      from public.revisit
     where "studyId" = p_study_id
       and "docId" like 'sequenceAssignment\_%' escape '\'
       and (data->>'rejected')::boolean = false
       and (
         case
           when coalesce((data->>'withServerTimestamp')::boolean, false)
             then extract(epoch from "createdAt") * 1000
           else (data->>'timestamp')::double precision
         end
       ) < (
         case
           when coalesce((existing_assignment->>'withServerTimestamp')::boolean, false)
             then extract(epoch from existing_created_at) * 1000
           else (existing_assignment->>'timestamp')::double precision
         end
       );

    select count(*)
      into creation_index
      from public.revisit
     where "studyId" = p_study_id
       and "docId" like 'sequenceAssignment\_%' escape '\'
       and "createdAt" < existing_created_at;

    return jsonb_build_object(
      'sequenceIndex', sequence_index,
      'creationIndex', creation_index
    );
  end if;

  select data
    into allocator_data
    from public.revisit
   where "studyId" = p_study_id
     and "docId" = 'sequenceAllocator'
   for update;

  if not found then
    -- Lazy allocator initialization is aggregate-only and runs under the same study lock.
    select count(*),
           count(*) filter (where (data->>'claimed')::boolean = true)
      into total_assignments, claimed_assignments
      from public.revisit
     where "studyId" = p_study_id
       and "docId" like 'sequenceAssignment\_%' escape '\';

    allocator_data := jsonb_build_object(
      'nextSequenceIndex', total_assignments - claimed_assignments,
      'nextCreationIndex', total_assignments,
      'version', 0
    );
  end if;

  select "docId", data, "createdAt"
    into reusable_doc_id, reusable_assignment, reusable_created_at
    from public.revisit
   where "studyId" = p_study_id
     and "docId" like 'sequenceAssignment\_%' escape '\'
     and (data->>'rejected')::boolean = true
     and (data->>'claimed')::boolean = false
   order by (
     case
       when coalesce((data->>'withServerTimestamp')::boolean, false)
         then extract(epoch from "createdAt") * 1000
       else (data->>'timestamp')::double precision
     end
   ), "createdAt"
   limit 1
   for update;

  next_sequence_index := (allocator_data->>'nextSequenceIndex')::bigint;
  next_creation_index := (allocator_data->>'nextCreationIndex')::bigint;
  creation_index := next_creation_index;

  if reusable_doc_id is not null then
    reusable_timestamp_ms := case
      when coalesce((reusable_assignment->>'withServerTimestamp')::boolean, false)
        then extract(epoch from reusable_created_at) * 1000
      else (reusable_assignment->>'timestamp')::double precision
    end;
    sequence_index := coalesce(
      (reusable_assignment->>'reusableSequenceIndex')::bigint,
      (reusable_assignment->>'sequenceIndex')::bigint
    );
    if sequence_index is null then
      -- Lazy compatibility for rejected assignments written before stable indexes.
      select count(*)
        into sequence_index
        from public.revisit
       where "studyId" = p_study_id
         and "docId" like 'sequenceAssignment\_%' escape '\'
         and (data->>'rejected')::boolean = false
         and (
           case
             when coalesce((data->>'withServerTimestamp')::boolean, false)
               then extract(epoch from "createdAt") * 1000
             else (data->>'timestamp')::double precision
           end
         ) < reusable_timestamp_ms;
    end if;

    update public.revisit
       set data = reusable_assignment || jsonb_build_object(
         'claimed', true,
         'sequenceIndex', sequence_index
       )
     where "studyId" = p_study_id
       and "docId" = reusable_doc_id;
  else
    sequence_index := next_sequence_index;
    next_sequence_index := next_sequence_index + 1;
  end if;

  insert into public.revisit ("studyId", "docId", data)
  values (
    p_study_id,
    assignment_doc_id,
    jsonb_strip_nulls(p_assignment || jsonb_build_object(
      'timestamp', case
        when reusable_doc_id is null then p_assignment->'timestamp'
        else to_jsonb(reusable_timestamp_ms)
      end,
      'withServerTimestamp', reusable_doc_id is null,
      'claimedParticipantId', case
        when reusable_doc_id is null then null
        else to_jsonb(replace(reusable_doc_id, 'sequenceAssignment_', ''))
      end,
      'sequenceIndex', sequence_index,
      'creationIndex', creation_index
    ))
  );

  allocator_data := jsonb_build_object(
    'nextSequenceIndex', next_sequence_index,
    'nextCreationIndex', next_creation_index + 1,
    'version', coalesce((allocator_data->>'version')::bigint, 0) + 1
  );
  insert into public.revisit ("studyId", "docId", data)
  values (p_study_id, 'sequenceAllocator', allocator_data)
  on conflict ("studyId", "docId")
  do update set data = excluded.data;

  return jsonb_build_object(
    'sequenceIndex', sequence_index,
    'creationIndex', creation_index
  );
end;
$$;

revoke all on function public.allocate_sequence_assignment(text, text, jsonb) from public;
grant execute on function public.allocate_sequence_assignment(text, text, jsonb)
  to anon, authenticated, service_role;
