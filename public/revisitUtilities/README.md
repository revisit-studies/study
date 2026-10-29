# Restoring a trial when returning with Previous

reVISit loads the existing provenance graph before mounting a stimulus or response block. The participant resumes the graph's current node. New interactions append to that graph, including after a page reload. Graphs remain scoped to the study, participant, trial identifier, and response location. Saving still happens on Next; this does not add continuous storage writes.

## React components

Use the managed `useTrrack` stimulus parameter and render its restored state with the exported hook:

```tsx
import { useStudyState } from '../../../store/hooks/useStudyState';

const trrack = useTrrack({ registry, initialState: { response: '' } });
const state = useStudyState({ trrack });
// Render state.response. Record edits with trrack.apply and publish answers with setAnswer.
```

The import path above is for a component in `src/public/<study>/assets/`. Adjust it to the component's directory. `useTrrack` imports the graph before subscriptions or initialization publications. `useStudyState` reads its current state and subscribes to later changes without recording a restoration interaction. The retained graph takes precedence over configured initial state. For legacy trials without a graph, use the answer-only overload to supply a saved-answer fallback to initialState, as the React Stroop example does. This starts a new history at the restored answer without inventing earlier interactions.

For an answer-only component, restore an existing response key:

```tsx
const [text, setText] = useStudyState({ responseId: 'response', initialState: '' });
// Render text and update it with setText. Continue publishing answers/validation with setAnswer.
```

A saved empty value is an answer, not a reason to use defaults. External editors may pass `onRestore(state)` to either overload to apply the initial state before interaction; the callback may return a cleanup function. Suppress editor change events while applying restored state. The callback is a mount-time initialization, not a replacement for the editor's ordinary editing logic.

A component with no state can call `useStatelessStudyComponent()` from the same module. This does not waive resuming an existing provenance graph. Registration states that the component implements restoration; it cannot prove that arbitrary custom code actually renders the returned state correctly. Test return-and-edit behavior.

## Websites, HTML, and Svelte

Use `revisit-communicate.js`. Call `beginRegistration` before initializing an asynchronous chart/editor that can publish default answers. After creating the chart/editor and its listeners, register restoration and explicitly finish registration:

```js
Revisit.beginRegistration();
const editor = await createEditor();
Revisit.onRestore(async ({ answers }) => {
  await editor.setValue(answers.response ?? '');
  Revisit.postAnswers({ response: editor.getValue() });
});
Revisit.completeRegistration();
```

The early call buffers initialization publications even across the document's load event. The latest study parameters, answers, and replay snapshot received during setup are delivered when their corresponding receive handlers register. Replay delivery does not publish participant data. Registering only after defaults have already been published cannot undo their effects on conditional host responses. Synchronous setup can register `onRestore` before publishing answers instead. For a managed graph:

```js
const trrack = Revisit.createTrrack({ initializeTrrack, registry, initialState });
Revisit.onRestore(({ answers, provenanceGraph }) => {
  render(trrack.getState());
  Revisit.postAnswers(answerFromState(trrack.getState()));
});
Revisit.completeRegistration();
```

`createTrrack` imports the retained graph automatically. `onRestore` may return a promise; reVISit waits for it before accepting initialization publications or edits. For answer-only websites, apply the scoped `answers` in `onRestore` and publish the restored answer. Call `completeRegistration` only after asynchronous dependencies and handlers are ready. Failures keep the host's saved history and expose Retry restoration. Do not use the replay-only `onProvenanceReceive` callback as an editable graph-restoration callback.

The version 1 handshake identifies the iframe document and restore request, reports capabilities when registration finishes, and acknowledges successful restoration. Messages from other windows or old requests are ignored. External website URLs remain unchanged; the host assigns the iframe identifier through the versioned handshake. Initialization messages with a different graph root cannot replace retained history while late registration finishes. Late registration upgrades the capability handshake without using a timeout. Older helpers and pages that never finish registration remain unknown; silence is not a failed capability check. Pages that do not begin registration retain legacy publication behavior. Existing legacy publications remain compatible, but a legacy component has no restoration guarantee until migrated. Uninstrumented third-party websites cannot be restored automatically.

Analysis replay remains read-only and uses its existing messages. Restoring an editable graph never replays recorded side effects or adds synthetic participant events.

## Study Designer warnings

Choose **Preview** on the study card to enter an explicit per-tab designer preview. The preview URL and its session marker are both required. Ordinary participant entry, study-wide development/data-collection flags, and build mode do not enable restoration diagnostics. Analysis never shows them.

A nonblocking warning appears immediately above a revisited React stimulus or iframe when component-owned saved data exists and restoration support is missing after registration settles. Websites must explicitly report unsupported capability; silent/pending helpers do not produce timeout warnings. A static stimulus with only surrounding host response data does not need registration. Warnings never include response content or change navigation, validation, or saved data.

Replay retains the earliest start, latest end, and window events from all visits, including wall-clock gaps between them. Missing legacy provenance falls back to saved answers. Failed or malformed provenance produces Retry restoration instead of overwriting the previous record.

## Existing examples

The React Stroop, map, brush, chat, gamepad, drawing, adaptive VLAT, and virtual chinrest examples use the shared restoration hook. HTML and Svelte dot counters demonstrate the website handshake. Components that previously read saved answers manually still need explicit registration; reading the `answers` or `provenanceState` props alone is not evidence of graph restoration.
