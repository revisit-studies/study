# Trial-Level Response Form Architecture Plan

## Goal

Evaluate and plan a larger refactor from one Mantine form per `ResponseBlock` location to one Mantine form per trial/component. This is a potential later change after `codex/response-validation-cleanup` and the smaller trial-validation answer helper follow-up.

The intended benefit is to make the trial answer object a direct product of one form instead of reconstructing it from per-location snapshots.

## Current Shape

Today, each rendered response location owns its own Mantine form:

- `ResponseBlock` for `aboveStimulus`
- `ResponseBlock` for `belowStimulus`
- `ResponseBlock` for `sidebar`

Each block writes a plain snapshot into `trialValidation[identifier][location]`:

```ts
{
  valid: boolean,
  values: object,
  provenanceGraph?: TrrackedProvenance,
}
```

Other code then merges those snapshots for:

- response issue summaries
- feedback and correct-answer checks
- participant answer persistence

## Proposed End State

Create one trial-level response form that owns all response values for the current component. Individual `ResponseBlock` instances render filtered views of that shared form.

Conceptually:

```txt
TrialResponseFormProvider
  useAnswerField(allResponsesForTrial)
  values for all response locations
  validation for all response fields

  ResponseBlock aboveStimulus
    renders fields from shared form

  ResponseBlock belowStimulus
    renders fields from shared form

  ResponseBlock sidebar
    renders fields from shared form
```

The saved answer path could then read from one canonical form snapshot instead of merging three response-block snapshots.

## Potential Benefits

- One canonical `values` object for all responses in a trial.
- One validation call can evaluate all response fields.
- Less answer copying when saving.
- Less duplication between feedback checks, summaries, and persistence.
- Easier reasoning about cross-location response dependencies.
- A clearer future path for field-level validation summaries and submit behavior.

## Tradeoffs

This is a larger ownership change than the immediate follow-up plan.

The current per-location forms map naturally to the rendered UI structure and to per-location provenance. A trial-level form would need a new owner above all response blocks, likely in the component or trial controller layer.

Open questions:

- Where should the trial-level form provider live?
- How should per-location provenance graphs be preserved?
- Should `trialValidation` keep per-location validity, or become a trial-level response validation snapshot?
- How should stimulus validation continue to compose with response validation?
- How should analysis mode read saved provenance and historical values?
- How should hidden responses, reactive responses, matrix answers, ranking answers, and custom responses synchronize with one shared form?
- What happens if a response location is not mounted because of layout or sidebar state?

## Recommended Migration Strategy

Do not replace all per-location forms in one PR. Use staged changes.

### Stage 1: Stabilize Plain Snapshots

Complete the immediate follow-up plan:

- Add one shared helper for constructing the saved trial answer from `trialValidation`.
- Keep per-location forms.
- Keep behavior identical.

This creates a baseline for comparing old and new answer snapshots.

### Stage 2: Extract a Response Form Boundary

Introduce a hook or provider that can own the shared response form without changing rendering behavior yet.

Possible API:

```ts
function useTrialResponseForm({
  responses,
  currentStep,
  storedAnswer,
  customResponseValidators,
  customResponseLoadErrors,
}: UseTrialResponseFormOptions): UseTrialResponseFormResult;
```

It should own:

- `useAnswerField`
- initial values
- custom response validators
- custom response load errors
- reactive answer merging
- matrix answer merging
- ranking answer merging

At this stage, `ResponseBlock` can still receive the form through props or context and render only its location.

### Stage 3: Move Validation Publishing

Move the Mantine-to-`trialValidation` synchronization out of each `ResponseBlock`.

The publisher should write either:

- one trial-level response validation snapshot, or
- per-location snapshots derived from the same shared form

Prefer preserving the existing `trialValidation` shape at first to reduce migration risk.

### Stage 4: Replace Answer Save Source

Once one trial-level form snapshot exists, update the save path so `useNextStep` reads the canonical trial response answer rather than merging per-location snapshots.

This should happen only after tests prove the form snapshot and current merged answer are identical for representative studies.

### Stage 5: Simplify ResponseBlock

After the shared form and publishing boundary are stable, simplify `ResponseBlock` so it mostly handles rendering:

- filter responses by location
- render `ResponseSwitcher`
- render feedback alerts
- render local layout

Avoid mixing persistence, full-trial answer aggregation, and form ownership back into the component.

## Test Plan

Unit tests:

- Shared form initializes values for all response locations.
- Location-specific `ResponseBlock` renders only its assigned responses.
- Form values update correctly from each location.
- Hidden responses do not create visible errors but preserve expected answer behavior.
- Matrix, ranking, reactive, custom response, `withOther`, and `withDontKnow` cases keep current validation behavior.
- Trial-level answer snapshot matches the current `trialValidation` merged answer.

Integration tests:

- Participant can complete a study with responses above stimulus, below stimulus, and in sidebar.
- Correct-answer feedback reads answers from all locations.
- Next button blocks on unresolved required responses across all locations.
- Saved participant answer matches the pre-refactor shape.
- Analysis mode can replay/read saved answers.

Browser scenarios to request before merge:

- required short text
- checkbox and dropdown min/max
- matrix partial completion
- ranking response
- `Other`
- `I don't know`
- custom response validation
- feedback/check-answer training flow
- responses split across above, below, and sidebar

## Risk Assessment

This is a high-risk refactor because it changes the owner of response form state. It should be treated as an architectural migration, not a cleanup patch.

Highest-risk areas:

- provenance graph preservation
- answer persistence shape
- analysis/replay behavior
- side-channel state for matrix, ranking, and reactive responses
- correct-answer feedback and failed-training progression
- unmounted or hidden response locations

## Recommendation

Use the immediate follow-up PR to remove duplicated answer aggregation first. Then revisit the one-form architecture with current behavior pinned by tests.

The one-form architecture is probably the cleaner end state, but it should only proceed once the project has enough coverage to prove that saved answers, validation gating, feedback, and analysis mode remain unchanged.
