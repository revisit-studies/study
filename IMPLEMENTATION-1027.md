# Issue 1027 implementation checklist

## Resume and delivery state

- Worktree: `/Users/jwilburn/.codex/worktrees/global-store-1027/revisit-study`
- Branch: `codex/global-store-1027`
- Base: PR #1529 exact head `cf9d36a721d9a200f489d68cd91fed0ccbf21435` (`codex/resume-trial-provenance`, based on `dev`). This remains an intentional dependency. The original implementation started at `5dd02666` and was reconciled with the updated head on October 28, 2026.
- Approved specification: https://github.com/revisit-studies/study/issues/1027 (Specified).
- Independent review and repair are complete: six confirmed issues fixed, original bridge coverage restored, full units/lint/build pass. Final browser run passed all 24 cases: 17 feature cases and seven existing restoration checks. See the review section below for the latest evidence.
- Delivery in progress: the user authorized reconciliation, fresh validation, commit, push, and a draft PR on October 28, 2026. No merge or deployment is authorized. See the delivery checkpoint below for current validation and publication state.
- Original checkout was clean on `codex/study-embedded-color-mode` at `3b63bf27` at the prior checkpoint; that is historical evidence, not a current checkout assertion.
- No new dependencies; package manifest, lockfile, environment, and GlobalConfig schema are unchanged.

## Required order and completed work

- [x] Read repository instructions and implement skill, inspect issue/comments and #1529, create attached isolated worktree.
- [x] **First: test studies.** Add budget, primitive-operation, and async/error/timeout studies; register in Tests tab; document expected journeys.
- [x] **Second: browser regressions.** Add observable participant tests before application logic. Delegate initial Chromium run and establish red config-schema failure for unsupported `globalVariables`.
- [x] **Then: application logic.** Implement parser/types/schemas, evaluator, runtime snapshots, submission, persistence, Previous, provenance, replay, exports, and stimulus APIs.
- [x] Add focused regressions before fixing confirmed implementation defects; preserve useful existing assertions.
- [x] Run focused units, full unit suite, typecheck, lint, schema generation, build, and delegated Chromium against stable source.
- [x] Review complete diff and affected consumers; fix confirmed issues; perform a fresh follow-up pass.
- [x] Finish final delegated 16-case Chromium rerun after the session-switch save fix and record result.
- [x] Report validation, inherited failure, intentional #1529 dependency, and uncommitted/unpushed delivery state.

## Acceptance coverage

The checked items indicate implemented behavior backed by the listed local tests/code review. Live cloud-service and real recording-capture validation remain limitations below.

- [x] AC01: required `initialValue`, inferred primitives, finite numbers, stable types, inclusive numeric bounds, actionable config paths. Parser/evaluator units.
- [x] AC02: participant/study isolation, initial copies, returning saved state/config; canonical config and assigned factors preserved. Browser isolation/new-participant cases; common storage/config paths.
- [x] AC03: numeric budget subtraction using `response.onSubmit`. Budget browser journey.
- [x] AC04: set/add/subtract/multiply/divide/append/prepend/and/or/toggle; atomic type/constraint/unknown-key/division failures. Evaluator units and operations browser cases.
- [x] AC05: resolved declaration order then action-array order across all response placements and randomized display. Operation fixture and units.
- [x] AC06: aggregate 60+50 overspend rejected at budget100; exact100 accepted. Browser assertion of visible error, unchanged persisted answers/store, and successful retry.
- [x] AC07: empty optional, conditional-hidden, and Don't Know skipped; zero/false retained; global constraints remain mandatory for failed-training progression. Effective-answer/evaluator coverage and browser cases; shared transaction always evaluates store constraints.
- [x] AC08: typed numeric `{{store.key}}` references; malformed/unknown/non-numeric references rejected; normal text interpolation. Parser/template/evaluator units and browser budget displays/bounds.
- [x] AC09: entry-state reads in React, cooperating HTML bridge, plain/templated sites, dynamic functions, instructions/help/templates, validation, visibility/skips. Browser mixed journey; shared template/condition paths. External cooperating pages use the same bridge and are not fetched/recompiled.
- [x] AC10: sync/async partial updater results; immutable snapshots; missing keys unchanged; invalid results/rejections/timeouts prevent accepted changes. Evaluator/protocol units and async browser cases.
- [x] AC11: form/stimulus same-key conflict rejected; disjoint updates combine; one registration with cleanup and correlated requests. Protocol and browser conflict coverage.
- [x] AC12: shared Next/Enter/programmatic gates, synchronous busy lock, source/document/request checks, stale result checks before/after save. Async browser and protocol/storage unit coverage.
- [x] AC13: no normal global updates during edits, Check Answer, Previous, restoration, replay, or timeout/no-data progression. Shared submission ownership, timeout/browser replay/Previous assertions.
- [x] AC14: local write failure leaves accepted state unchanged; queued cloud retries reuse accepted snapshots; session changes cannot accept an old result into a new participant. Storage fault/retry/session regression units and callback failure browser test.
- [x] AC15: skip/dynamic/visibility evaluate accepted current path, excluding invalidated later answers. Complete revised dynamic/funded-branch browser journey.
- [x] AC16: 100 ->70 ->50; unchanged revisit retains50; revised A10 ->90; revised B15 ->75. Browser and provenance units.
- [x] AC17: warning cancellation preserves old progress; Previous alone does not invalidate. Browser persisted-state assertions.
- [x] AC18: Next ->reload ->Previous restores forms and React/HTML stimulus, repeated/dynamic/skip boundaries. New browser cases plus all seven existing restoration cases.
- [x] AC19: participant-wide global provenance retains original/revised values, answers, source-node references, replacement links, and no-op boundaries. No separate visit ledger. Provenance/history units and browser replay.
- [x] AC20: later answers/drafts excluded from active progress; static assignment preserved; dynamic trials regenerated; historical graphs/media retained; newer recovery revision wins even with fewer answers. Projection/recovery/media/export units and browser branch/reload.
- [x] AC21: shared base storage contract applies to local/Firebase/Supabase; local accepted snapshot, provenance upload queue, recovery, retry/finalization, and collection-disabled behavior. Shared-storage fault tests plus existing backend suites; live cloud backends not exercised.
- [x] AC22: finalized participant reopens at end card, earlier routes cannot edit/submit. Browser and storage tests.
- [x] AC23: original/revised read-only replay; participant JSON projection, retained provenance/assets, optional tidy before/after/operations. Browser replay and history/export units.
- [x] AC24: legacy studies/provenance remain usable; missing accepted assets fail before fresh publication; absent history is never rebuilt through callbacks. Existing restoration/HTML/dynamic suites and unit coverage.

## Implementation map

- Config: `src/parser/globalStore.ts`, `types.ts`, parser integration, generated StudyConfig/LibraryConfig schemas.
- Canonical update rules: `src/utils/globalStore.ts`; condition/visibility/correctness helpers and typed template context.
- History: `src/store/globalStoreProvenance.ts`, `globalStoreHistory.ts`, `globalStoreProjection.ts`. Current values/revision/head and answer entry cache are projections of provenance.
- Submission: `useNextStep.ts`; frozen entry/context snapshots, validation/training/timing/asset gates, 10-second updater timeout, busy/stale checks, durable local acceptance, then branch evaluation/navigation.
- Previous/restoration: `usePreviousStep.ts`, `useTrialProvenance.tsx`, reducers. Active source-node anchors loaded before components mount. Invalidated trials record a fresh initial state in the retained graph; old branches remain available.
- Storage: `StorageEngine.saveGlobalStoreSubmission`, revision-specific local graph keys, strict accepted participant cache, serialized queued provenance uploads, revision-aware recovery, local finalized flag. Session identity checked across awaited local-save steps.
- APIs: React stimulus `store`/`registerGlobalStoreUpdater`; bridge `Revisit.onGlobalStoreReceive`/`registerGlobalStoreUpdater`; host validates source, iframe, document and request. Early listeners receive only actual store snapshots; late listeners receive the latest snapshot.
- Media: per-entry versioned asset keys retained in accepted answer snapshots; recorder lifetime, replay readers, transcripts, and bulk exports follow those keys. Legacy filenames unchanged.
- Analysis: combined global/trial provenance, submission history selector, selected historical answers for timing/media, typed entry-state scoring, optional tidy fields, original/inactive assets in downloads.
- Fixtures/docs: `public/test-global-store/README.md`, three study configs/assets, `src/public/test-global-store/assets/`, `tests/global-store*.ts`.

## Historical validation evidence (October 23; before reconciliation)

All results below through the final review checkpoint describe the prior local implementation. Fresh reconciliation results are recorded separately at the end.

### Initial implementation validation evidence (before independent review)

### Test-first evidence

- Initial delegated Chromium red run, before app logic: main budget journey failed config validation because `globalVariables` was an unknown root property.
- Core parser/evaluator/provenance unit imports initially failed before their implementation.
- Final bridge regression failed because a listener was called with fabricated `{}` before host delivery; after fix it passes, including cached late subscription and unsubscribe behavior.
- Final session-switch regression failed because a pending submission resolved and replaced the new participant data; after snapshot capture/session checks it rejects and leaves the new session untouched.

### Passing checks

- `corepack yarn unittest run` -> **197 files, 3,621 passed, 1 skipped**. Log `/tmp/revisit-1027-final-unit.log`. This complete run preceded the final bridge/session regressions.
- Follow-up focused units after those fixes: `corepack yarn unittest run src/storage/tests/globalStoreSubmission.spec.ts src/store/hooks/tests/useNextStep.spec.ts src/store/hooks/tests/useNextStep.spec.tsx src/tests/revisit-communicate.spec.ts` -> **4 files, 65 passed**. Log `/tmp/revisit-1027-final-session.log`. Includes two new tests beyond the complete run. The bridge test subsequently moved into `src/tests/` so it is not shipped as a public asset; its isolated unit, lint, and typecheck checks pass at that location.
- `corepack yarn typecheck` -> passed after final session fix. Log `/tmp/revisit-1027-final-typecheck.log`.
- `corepack yarn lint` -> passed. Final edited-source follow-up lint also passed.
- `corepack yarn generate-schemas` -> passed; only intended StudyConfig/LibraryConfig schemas changed.
- `corepack yarn build` -> passed again after the final boundary fix (6.79 seconds). Existing Vite chunk warnings remain.
- `git diff --check` and bridge JavaScript syntax check -> passed.

### Delegated Chromium

Agent `/root/global_store_chromium` ran Chromium locally (no reliance on PR checks, no `yarn test`).

Stable broader run:

```sh
PW_TEST_PORT=8147 corepack yarn playwright test tests/global-store.spec.ts tests/global-store-history.spec.ts tests/trial-provenance-restoration.spec.ts tests/demo-dynamic.spec.ts tests/demo-html.spec.ts tests/test-skip-logic.spec.ts --project=chromium --workers=1
```

**34 passed, 1 inherited failure (4.1 minutes)**. All 16 new feature tests, all 7 restoration tests, both dynamic tests, HTML journey, and eight other skip scenarios passed. A prior development-server hot reload caused a hook crash; the stable rerun passed that case.

- After the final bridge correction, focused full mixed-budget journey plus existing HTML/Previous: **2 passed (12 seconds)**.
- After the final session-switch save correction, both feature suites: **16 passed (1.2 minutes)** on stable final source.

### Inherited failure and limitations

- Existing `tests/test-skip-logic.spec.ts` all-correct case navigates correctly but `participantTags` is `[]` instead of `testBlockId`/`targetBlock` (line213). Reproduced unchanged on base SHA `5dd02666a5ab676485f7f17d9804f10158f53ca6` in `/tmp/revisit-1027-base-4k56y7`, port8148, with the single case. Preserved artifact: `/tmp/revisit-1027-base-4k56y7/test-results/test-skip-logic-evaluates-the-all-correct-skip-path-chromium/error-context.md`.
- Suggested separate repair: derive current block IDs directly in ComponentController's tagging effect instead of consuming stale `blockForStep` immediately after setting it. Do not mix this inherited defect into #1027.
- Firebase/Supabase network behavior is covered through common storage logic and existing mocked backend suites; no live cloud project/outage test was run. Recording retention is covered through recorder/replay/export units, not real microphone/camera capture in Chromium.
- No remote CI run, push, PR, commit, approval, or merge.


## Independent adversarial review and repair (2026-10-23)

User requested the full implementation be independently reviewed, then confirmed issues reproduced and fixed. Reviewer `/root/adversarial_review` used gpt-6.1-sol/high with a fresh self-contained handoff, reviewing all tracked/untracked work against base `5dd02666` and the live approved issue/comments. No review feedback posted externally.

- [x] Restore the seven original bridge tests accidentally removed during the previous checkpoint. They pass alongside the new listener regression.
- [x] Confirm/fix late HTML updater registration deadlock. Red host regression showed iframe inert after same-document WINDOW_READY; readiness now remains intact while capability registration updates. HTML fixture/browser history case exercises re-registration after restoration.
- [x] Confirm/fix undefined updater result accepted as a no-op. Red evaluator regression; explicit patch input now rejects undefined through the canonical object validator.
- [x] Confirm/fix textual undeclared store references. Red parser regression; validate actual Handlebars paths in resolved config fields, including inheritance. Loaded assets preserve invalid template text with an actionable compilation error instead of silently deleting it. Quoted literal strings are not mistaken for references.
- [x] Confirm/fix dynamic global skip ignored during iteration advancement. Delegated red Chromium case reached Dynamic purchase2/budget20 instead of end. Successful skip now takes precedence over the next iteration route; accepted deduction is persisted first.
- [x] Confirm/fix unary toggle requiring a scalar operand. Red array/object regressions; use the canonical answered/Don't Know predicates, requiring a primitive only for operations that consume an operand. Shared pure predicates moved into responseValue.ts to avoid importing stimulus modules into parser/evaluator initialization.
- [x] Confirm/fix invalidated contextual initial state. React/helper and real managed HTML bridge regressions demonstrated old70 instead of replacement90. A transient reset instruction is consumed during managed initialization, recording the fresh initial state as a retained-graph branch before publication. Old root/nodes remain available; ordinary revisits restore the accepted node. Boundary/form initialization and initial publication handle the fresh execution explicitly. Browser fixture now exposes tracked entry budget and verifies original70/revised90.
- [x] Complete independent follow-up verification of these fixes (same reviewer). Final follow-up reports no remaining findings in repaired scope.
- [x] Complete final full units/lint/build and delegated Chromium on stable final source.

Evidence logs: `/tmp/revisit-1027-review-red.log` (late registration/undefined); `/tmp/revisit-1027-review-more-red.log` (toggle/text); `/tmp/revisit-1027-reset-red.log` (React/HTML contextual initialization); `/tmp/revisit-1027-review-all-focused.log` (8 files/135 passing after repairs); `/tmp/revisit-1027-review-typecheck.log` (passed). Dynamic red browser snapshot showed the incorrect next iteration and is recorded by the delegated agent; subsequent Playwright runs may replace test-results.

Original Check Answer persistence was investigated as a lead, but revisited training controls are disabled by the existing attempt/correctness lifecycle; no additional finding was established. All six final reviewer findings were confirmed; none was rejected. The separate inherited skip block-tag failure remains outside this implementation.


### Final review validation checkpoint

- Complete Vitest run after the six main repairs and restoring old bridge tests: **198 files, 3,638 passed, 1 skipped** (`/tmp/revisit-1027-review-full-unit.log`, 42.03 seconds).
- The reviewer caught one remaining edge of textual-reference validation: `{{store.budget.value}}` incorrectly checked only `budget`. Parser/runtime assertions reproduced both failures, then full-path checking repaired them. **54/54 parser/template tests pass**; same independent reviewer verified the final change and reported no remaining findings.
- Full `yarn lint` passed; final touched-file lint passed after the last template correction.
- Final `yarn build` (including typecheck) passed after the last source change (`/tmp/revisit-1027-review-final-build.log`, 5.62 seconds). No new dependencies or config-schema shape changes during review.
- Delegated stable Chromium: **24 passed (3.1 minutes)**, comprising all17 feature cases and all7 existing restoration cases. Command: `PW_TEST_PORT=8147 corepack yarn playwright test tests/global-store.spec.ts tests/global-store-history.spec.ts tests/trial-provenance-restoration.spec.ts --project=chromium --workers=1`. Includes the previously red dynamic skip and stronger contextual-state/history/updater-registration assertions. No failures in this final run.
- `git diff --check` and bridge JavaScript syntax check pass. Original checkout remains clean at3b63bf27. Changes in this worktree remain uncommitted/unpushed; no PR or external review comment was created.


## Delivery checkpoint (October 28, 2026)

- Reconciled the original uncommitted implementation with PR #1529 at `ed9673a6a12de33b1fac9862443ed24ac5bae8f0`. Preserved a Git stash safety snapshot of the original tracked and untracked work.
- Retained upstream late website delivery, dynamic trial identity, cross-location form restoration, stage allocation controls, and rejected-participant completion locking.
- Adapted the global-store analysis guard to the new dynamic component state; restored accepted form source nodes before seeding response visibility, and excluded invalidated forms from the old context.
- Added two focused restoration regressions and updated new upstream stimulus tests for the global-store props and hooks.
- Fresh full unit run: **213 files passed; 3,873 tests passed, 1 skipped** (`/tmp/revisit-1027-reconcile-final-units.log`).
- Fresh typecheck, full lint, schema generation, production build, diff whitespace, and bridge JavaScript syntax checks passed. Logs: `/tmp/revisit-1027-reconcile-typecheck.log`, `/tmp/revisit-1027-reconcile-final-lint.log`, `/tmp/revisit-1027-reconcile-schemas.log`, `/tmp/revisit-1027-reconcile-build.log`. Existing build chunk/browser compatibility warnings remain.
- Delegated Chromium feature/restoration run: **23 passed, 1 initial navigation abort** (`net::ERR_ABORTED` before the study loaded). The failed history case passed unchanged on isolated retry (**1 passed**); all 24 requested cases have passed. Logs: `/tmp/revisit-1027-reconcile-chromium.log`, `/tmp/revisit-1027-reconcile-chromium-retry.log`.
- Additional delegated dynamic/HTML/skip regression run: **12 passed** (`/tmp/revisit-1027-reconcile-chromium-regressions.log`), including the previously inherited all-correct block-tag case. There are no remaining failures from that historical checkpoint in the suites rerun today.
- Live cloud backends and real microphone/camera capture were not tested. The earlier independent review remains historical; this reconciliation used a local self-review and delegated browser validation.
- Publication: this validated checkpoint is prepared for the authorized feature commit, push, and stacked draft PR. The remote PR and Git history are authoritative for delivery status; no merge or deployment is authorized.


### Follow-up rebase

Rebased onto #1529 at `cf9d36a721d9a200f489d68cd91fed0ccbf21435`. The added gamepad restoration test receives the global-store stimulus props. Focused gamepad tests (2) and typecheck passed; the earlier full-suite results above were not rerun for this small upstream update.


## Adversarial findings repair

- Recovery reconstructs pending global and retained trial provenance uploads from the accepted local graph, including inactive trials. It also republishes the recovered participant snapshot before completion, without requiring a manual retry. No separate durable queue or repeated updater execution is introduced.
- A completed local save publishes its accepted snapshot to the owning participant store even if browser navigation changed. Destination restoration waits for acceptance; a captured submission revision keeps the navigation lock from being released while saving.
- Earlier-edit confirmation rechecks the participant, completion, revision, effective answers, updater identity, response validity, and asset readiness before persistence.
- Added 11 regression cases across storage, submission, and restoration boundaries. Core failures and the navigation-lock follow-up were reproduced before their fixes. The original independent recovery reproduction also passes with the repair.
- Focused validation: 26 tests passed. Complete validation: 214 files, 3,885 tests passed, 1 skipped. Full lint and production build (including typecheck) passed. Delegated Chromium final-source validation: **24 passed** (`/tmp/revisit-1536-fixes-chromium-final.log`), covering all 17 global-store cases and all 7 existing restoration cases.
- These changes are authorized for commit and push to PR #1536; no merge or deployment is authorized. Live cloud outage and real recording capture remain untested.
