# Sequence assignment allocation

Participant startup reserves a sequence assignment atomically before participant data is
persisted. If the later participant-data write fails, retrying startup returns the already
committed assignment instead of consuming another sequence or creation index.

## Provider operation bounds

### Firebase

For an initialized allocator, a fresh or returning participant performs:

1. One query limited to the oldest unclaimed rejected assignment.
2. One Firestore transaction, bounded to five attempts, that rechecks the participant,
   allocator, and candidate assignment before committing the claim, assignment, and counters.

The Firebase Web SDK cannot read a query through a transaction, so the bounded candidate
query must precede the transaction. The transaction re-reads that one candidate document to
prevent double claims. Allocator initialization adds two aggregate counts and one transaction
retry only when a legacy study has no allocator document. Legacy assignments without stable
indexes add bounded aggregate counts.

Rejected-slot ordering is explicit by ascending `timestamp`. Deploy
`firestore.indexes.json` to each Firebase project used by ReVISit before releasing this path.

### Supabase

After applying `supabase/migrations/20260730000000_allocate_sequence_assignment.sql`, fresh,
existing, rejected-reuse, and contended allocations each use one
`allocate_sequence_assignment` RPC. The database function holds a study-scoped transaction
lock, caps lock waiting at five seconds, selects at most one reusable row, and commits the
allocator, claim, and participant assignment together. Existing pre-allocator rows are
derived lazily with aggregate counts inside that same operation.

The client retains the bounded compare-and-swap allocator as a compatibility fallback when
the RPC has not yet been installed. The fallback caps conflicts at ten attempts.

## Trace evidence and limitations

Provider-operation Vitest coverage records the permitted query, transaction, retry, and RPC
counts for fresh, existing, rejected-reuse, and conflict paths. Concurrent-start coverage
checks unique indexes and single-claim rejected-slot behavior for Firebase, Supabase, and
LocalStorage.

Live before/after HAR capture was not possible in the development environment because it has
no authenticated Firebase and Supabase study credentials. The tests therefore verify SDK
operation boundaries rather than claiming network timing improvements. A production trace
should confirm the Firebase bounded query plus transaction and the single Supabase RPC after
the migration and Firestore index are deployed.
