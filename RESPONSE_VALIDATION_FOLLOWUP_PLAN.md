# Response Validation Follow-Up Plan

## Goal

Reduce the remaining duplication around response answer snapshots without changing the current per-location Mantine form architecture. This follow-up PR should target `codex/response-validation-cleanup`, not `dev`.

The immediate problem is that multiple code paths rebuild the same trial answer object from `trialValidation[identifier]`:

- Response issue summaries in `ResponseBlock.tsx`
- Correct-answer feedback checks in `ResponseBlock.tsx`
- Final answer persistence in `useNextStep.ts`

Those paths should agree on exactly which response values are considered the current answer for a trial.

## Non-Goals

- Do not replace per-location Mantine forms.
- Do not change validation semantics.
- Do not move stimulus validation into response validation.
- Do not change saved answer shape.
- Do not introduce new dependencies.

## Current Shape

Each `ResponseBlock` owns a Mantine form for one response location:

- `aboveStimulus`
- `belowStimulus`
- `sidebar`

Each block publishes a plain validation snapshot into `trialValidation[identifier][location]`. Later, other code merges those snapshots to get the answer object for the whole trial.

That snapshot boundary is the right place for a small cleanup. Mantine remains local UI state, and `trialValidation` remains global coordination and persistence state.

## Proposed Change

Add one shared helper for constructing the trial response answer from a trial validation entry.

Suggested location:

```txt
src/components/response/trialValidationAnswers.ts
```

Suggested API:

```ts
export function collectResponseValuesFromTrialValidation(
  validationForStep?: Partial<Record<ResponseBlockLocation | 'stimulus', ValidationStatus>>,
): StoredAnswer['answer'];
```

Behavior:

- Return `{}` when no validation exists.
- Merge only entries that have a `values` property.
- Preserve the current overwrite behavior when multiple locations contain the same response id.
- Ignore non-validation fields such as `provenanceGraph`.
- Keep `stimulus.values` behavior consistent with the current reducer, even if it is usually `{}`.

## Call Sites

Replace the local helper in `ResponseBlock.tsx` for:

- `combinedLiveValues`
- `checkAnswerProvideFeedback`

Replace the duplicate reducer in `useNextStep.ts` for:

- `answer` construction before saving participant data

Do not alter the analysis-mode collection from `analysisProvState` unless a separate duplicate path is found and covered.

## Tests

Add sibling unit tests near the helper:

```txt
src/components/response/tests/trialValidationAnswers.spec.ts
```

Cover:

- Missing validation returns an empty object.
- Above, below, and sidebar values merge into one answer object.
- Entries without `values` are ignored.
- Existing overwrite behavior is preserved when the same key appears in multiple locations.
- A `stimulus` validation entry with empty values does not affect response answers.

Update existing tests only where imports move:

- `src/components/response/tests/ResponseBlock.spec.tsx`
- `src/store/hooks/tests/useNextStep.spec.ts`

## Verification

Run:

```bash
yarn unittest --run src/components/response/tests src/store/hooks/tests/useNextStep.spec.ts
yarn typecheck
yarn lint
yarn build
```

Do not run `yarn test` directly. If browser confidence is needed, describe the Playwright scenarios for a human to run.

## Review Checklist

- The saved answer object is unchanged for existing tests.
- Feedback checks read the same answer object as persistence.
- Required, optional, custom, matrix, ranking, `withOther`, and `withDontKnow` validation behavior is unchanged.
- No Mantine form object is stored in Redux or `trialValidation`.
- The PR diff stays focused on one helper, call-site replacement, and tests.
