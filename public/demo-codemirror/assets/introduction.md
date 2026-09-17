# Code Editor with CodeMirror

This example project shows how to embed a modern code editor in a reVISit study.
The stimulus mounts a [CodeMirror 6](https://codemirror.net/) editor and reports the participant's work back to reVISit.

The recording and replay logic lives in a standalone CodeMirror extension, `trrackCodeMirror.ts`, which does not use React at all.
It exposes an extension that reports what a participant did, a Trrack registry describing how those reports fold into a state, and a `replayTo` function that drives an editor from a recorded state.
The React component only mounts an `EditorView`, forwards entries into Trrack, and calls `replayTo` when an analyst seeks to a different provenance node — so the same extension can be reused by any host.

In each trial you are given a short JavaScript function that has a bug in it.
A comment above the function describes what it is supposed to do.

1. Edit the function in the code editor until you think it is correct.
2. Press **Run tests** to check it against a handful of example inputs.
3. Passing and failing cases are listed under the editor and in the sidebar.

You can move on once you have run the tests at least once, so a stubborn bug will not trap you.
Use **Reset code** to go back to the original version.

## What gets recorded

Every individual key press is recorded, not just the resulting document changes:

* **Key entries** come from the keyboard, so keys that move the caret or do nothing at all — arrows, `Escape`, a `Ctrl-Z` with nothing to undo — are captured along with the ones that type characters. Each entry carries the key name, its modifiers, and a timestamp relative to when the editor appeared.
* **Edit entries** come from the document, so a paste, a drag, or an undo is captured even though no key produced it. Each entry carries CodeMirror's own user-event annotation (`input.type`, `delete.backward`, `undo`, …), the offset the change starts at, the inserted text, and how many characters were removed.
* **Selection entries** cover caret moves and selections that changed nothing else, whether they came from the keyboard or the mouse.

Every entry — of any kind — also carries the caret and selection state as character offsets: one `anchor`/`head` pair per selection range, plus which range is the primary one. A collapsed range is a plain caret, and the order of `anchor` and `head` tells you which end of a selection was dragged. Key entries are observed before CodeMirror acts on the key, so their snapshot is where the caret was when the key went down; the selection entry that follows carries where it landed.

A typed character therefore produces a key entry and an edit entry; an arrow key produces a key entry and a selection entry. The running log is shown live under the editor.

Your final code, the results of your last test run, how many times you ran the tests, and the total event count are saved as reactive responses.

## Replay

Every entry becomes its own node in the trial's provenance graph. When an analyst scrubs through a recorded session, the editor is driven back to the state at the node they land on: the document as it stood, the caret or selection as it stood, the input log up to that point, and the test results from their most recent run. Replay transactions are marked so the recorder ignores them, and the editor is locked while replay is active so an analyst cannot type into a participant's document.

## Relevant files:
 * [The Config](https://github.com/revisit-studies/study/blob/main/public/demo-codemirror/config.json)
 * [The React Stimulus](https://github.com/revisit-studies/study/blob/main/src/public/demo-codemirror/assets/CodeEditorTask.tsx)
 * [The CodeMirror Extension](https://github.com/revisit-studies/study/blob/main/src/public/demo-codemirror/assets/trrackCodeMirror.ts)

## Relevant documentation:
 * [Designing a React Stimulus](https://revisit.dev/docs/designing-studies/react-stimulus/)
 * [Provenance Tracking](https://revisit.dev/docs/designing-studies/provenance-tracking/)
