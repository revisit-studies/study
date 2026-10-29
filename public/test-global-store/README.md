# Global store regression studies

These fixtures exercise issue #1027 through ordinary participant entry in the **Tests** tab. They depend on the global-store implementation and PR #1529's restoration contract. Previous is enabled on trial components; finalization locks the session.

## Budget and Previous

Start at 100. Submit form costs 10 above, 15 below, and 5 in the sidebar: 70. Select the React item costing 20 and enter confidence: 50. Spend 10 in plain HTML: 40; spend 10 in templated HTML: 30. On the repeated form submit 5, 0, 0: 25. Submit two dynamic costs of 5: 20 then 15. The low-budget branch appears. Review permits Previous before final submission.

Return to the first form and change its total cost to 10. Canceling the warning preserves accepted progress; confirming starts a replacement active path at 90. Repeating the remaining purchases produces 35 and selects the funded branch. Original answers remain in combined provenance.

For the focused restoration regression, stop after the React submission at 50, reload, and press Previous. The selection and confidence must restore, with entry budget 70. Submit unchanged: 50. Return to the first form, revise its total to 10, confirm, then select React cost 15: 75.

## Primitive Operations

The operation study uses one distinct store key per operation, with initial number 12, string `mid`, or boolean true and default operands 3, `X`, or false. Expected results: number set 3, add 15, subtract 9, multiply 36, divide 4; string set `X`, append `midX`, prepend `Xmid`; boolean set false, and false, or true, toggle false. A custom scalar boolean response intentionally submits booleans, not checkbox arrays.

Optional empty, conditionally hidden, and Don't Know costs must not spend budget. Response display order is randomized, while action evaluation follows declared config order.

## Async and Timeout

The React updater waits briefly. Reject update produces a recoverable error; turning it off allows retry. Submit purchase exercises programmatic advancement through the same validation as Next. The timed page proposes a default spend of 25 but its no-data timeout must not apply it.

## Config and stimulus API

Declare participant-local primitive values in the Study Config. `initialValue` is required and determines the type for the whole session. Numbers must stay finite; numeric `min`/`max` constraints apply to the combined result of a submission.

```json
{
  "globalVariables": {
    "budget": { "initialValue": 100, "min": 0 },
    "label": { "initialValue": "" },
    "eligible": { "initialValue": true }
  }
}
```

Attach actions to a response. Its effective submitted answer is the operand:

```json
{
  "id": "cost", "type": "numerical", "prompt": "Cost",
  "min": 0, "max": "{{store.budget}}",
  "onSubmit": [{ "variable": "budget", "operation": "subtract" }]
}
```

All primitives support `set`; numbers support `add`, `subtract`, `multiply`, `divide`; strings support `append`, `prepend`; booleans support `and`, `or`, `toggle`. Toggle is unary and may be attached to an answered checkbox or structured custom response; empty/unanswered responses still do not trigger it. Actions run in resolved config response order, then action-array order, regardless of displayed question order or placement. Empty optional answers, conditionally hidden fields, and Don't Know operands are skipped; zero and false are retained. Types are never silently coerced. Division by zero, invalid types, unknown variables, non-finite results, or final constraint violations reject the entire proposal.

`{{store.key}}` interpolates values in ordinary templates. An exact reference in a numerical constraint preserves the numeric type. The framework resolves these against the committed state at trial entry. A global visibility condition is `"visibleIf": { "globalVariable": "eligible", "comparison": "equals", "value": true }`. A block skip is `{ "check": "globalVariable", "variable": "budget", "comparison": "lessThan", "value": 20, "to": "lowBudget" }`. These use the existing comparison operators. Dynamic functions receive `store` alongside their existing arguments.

A React stimulus receives `store` and `registerGlobalStoreUpdater`:

```tsx
useEffect(() => registerGlobalStoreUpdater(({ store, answers }) => ({
  budget: (store.budget as number) - selectedCost,
})), [registerGlobalStoreUpdater, selectedCost]);
```

The callback may return a plain partial object or a Promise of that object. Omitted keys are unchanged; `{}` is a no-op. The store and answers arguments are immutable submission snapshots. Register one handler per mounted stimulus, and return its cleanup from the effect. Host form actions and the stimulus may update different keys; writing the same key rejects the submission. Rejected, timed-out, removed, or stale handlers cannot commit. Built-in Next, Enter, key mappings, and `useNextStep()` all use the same validation and submission path.

A website using `revisitUtilities/revisit-communicate.js` uses the same contract:

```js
Revisit.onGlobalStoreReceive((store) => renderBudget(store.budget));
const unregister = Revisit.registerGlobalStoreUpdater(({ store, answers }) => ({
  budget: store.budget - selectedCost,
}));
```

Store delivery uses the existing bridge; it does not reload the iframe. The framework validates the active iframe/document/request before accepting a result. A handler has ten seconds to settle before the participant can retry.

## Previous, saving, and analysis

Normal Next commits only after validation, the updater, and a durable local save succeed. Cloud writes are queued; retries upload the accepted snapshot without repeating operations or callbacks. Check Answer, rendering, field edits, Previous, restoration, replay, and timeout/no-data progression do not run global update actions. Collection-disabled studies retain the same local behavior without uploading data.

Previous restores that trial's committed entry values and accepted stimulus/form state. An unchanged resubmission preserves later answers and does not spend twice. Changing an earlier submission asks for confirmation; cancel preserves the active path. Confirm clears all later active answers and drafts, preserves randomized assignment, and regenerates dynamic trials. Original branches and assets remain in provenance. For an invalidated tracked component, the framework records a new initial state calculated from the replacement entry values and parameters while retaining the old graph branches. Ordinary Previous restoration still selects the accepted state. Once finalized, an earlier URL or reopening the study displays the end card.

Active answer rows cache their entry values for grading and summary views; these are projections, and historical reconstruction uses provenance. Current values, the accepted provenance head, and a recovery revision are projections in participant JSON. Versioned recording keys prevent a revised trial from overwriting media referenced by earlier accepted submissions. Those keys are retained in the provenance answer snapshots and followed by replay and media exports. The participant-wide `__globalStore` provenance asset records accepted submissions, before/after states, operations, replacement relationships, complete submitted-answer fallback, and accepted stimulus/form node references. It also records submissions with no global change. No separate visit table exists. Provenance downloads include retained inactive-trial assets and the global graph. Tidy exports offer `globalStoreBefore`, `globalStoreAfter`, and `globalStoreOperations` for active submissions. Replay's Submission history selector restores original or revised paths without executing study code.

Legacy studies and provenance need no migration. Missing pre-feature history is not reconstructed by rerunning callbacks. Arrays, objects, expression evaluation, finalized-session reopening, and concurrent-tab/device editing are outside this feature.

Review regressions also cover a global skip to the end during a dynamic iteration, tracked React entry values after revision (70 before, 90 after), and HTML updater re-registration after restoration. The HTML fixture includes a Re-register store updater control for exercising this lifecycle.
