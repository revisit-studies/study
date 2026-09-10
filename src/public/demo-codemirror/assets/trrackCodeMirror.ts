/**
 * Provenance recording and replay for a CodeMirror 6 editor.
 *
 * Nothing in this module touches React. It exposes a CodeMirror extension that
 * reports what a participant did, a Trrack registry describing how those
 * reports fold into a state, and a pair of functions for driving an editor from
 * a recorded state during replay. A host framework only has to mount an
 * `EditorView`, forward entries into Trrack, and call `replayTo` when an
 * analyst seeks to a different provenance node.
 */
import {
  Annotation, Compartment, EditorState, Extension, Transaction,
} from '@codemirror/state';
import { EditorView, ViewUpdate } from '@codemirror/view';
import { Registry } from '@trrack/core';

/** Where the caret is, as character offsets into the document. */
export interface SelectionSnapshot {
  /**
   * One entry per selection range. A range whose `anchor` and `head` are equal
   * is a plain caret; otherwise text is selected, and the order tells you which
   * end was dragged from.
   */
  ranges: { anchor: number; head: number }[];
  /** Index of the primary range within `ranges`. */
  main: number;
}

/**
 * One recorded input event.
 *
 * `key` entries come from the keyboard, so keys that move the caret or do
 * nothing at all — arrows, Escape, a failed Ctrl-Z — are recorded too.
 * `edit` entries come from the document, so a paste, a drag, or an undo is
 * recorded even though no key produced it. `selection` entries cover caret
 * moves and selections that changed nothing else, including mouse ones.
 *
 * A typed character therefore produces a `key` entry and an `edit` entry;
 * an arrow key produces a `key` entry and a `selection` entry.
 */
export interface InputEntry {
  kind: 'key' | 'edit' | 'selection';
  /** Milliseconds since recording started, per the `now` option. */
  at: number;
  /**
   * Caret and selection at the moment the entry was recorded. Key entries are
   * observed before CodeMirror acts on the key, so their snapshot is where the
   * caret was when the key went down; the `selection` entry that usually
   * follows carries where it landed.
   */
  selection: SelectionSnapshot;
  /** Key entries: the key name with its modifiers, e.g. `Ctrl-z` or `ArrowLeft`. */
  key?: string;
  /** Edit entries: CodeMirror's user-event annotation, e.g. `input.type`. */
  userEvent?: string;
  /** Edit entries: document offset the change starts at. */
  from?: number;
  /** Edit entries: the text that was inserted; empty for a pure deletion. */
  inserted?: string;
  /** Edit entries: how many characters were removed. */
  removed?: number;
}

/** The editor state a replay can be driven from. */
export interface CodeProvenanceState {
  code: string;
  selection: SelectionSnapshot;
  inputLog: InputEntry[];
}

/** A caret at the very start of an empty selection. */
export const EMPTY_SELECTION: SelectionSnapshot = { ranges: [{ anchor: 0, head: 0 }], main: 0 };

/**
 * Marks transactions this module dispatched itself, so replaying a recorded
 * state never records that state as fresh participant input.
 */
const replayed = Annotation.define<boolean>();

/** Lets `setReplayMode` swap the editor between editable and locked. */
const editableCompartment = new Compartment();

/** Bare modifier presses repeat while held, so they are dropped as noise. */
const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta']);

/** `Ctrl-z`, `Shift-ArrowLeft`, `a`. Shift is implicit for printable characters. */
export function describeKey(event: KeyboardEvent) {
  const parts: string[] = [];
  if (event.ctrlKey) parts.push('Ctrl');
  if (event.metaKey) parts.push('Meta');
  if (event.altKey) parts.push('Alt');
  if (event.shiftKey && event.key.length > 1) parts.push('Shift');
  parts.push(event.key);
  return parts.join('-');
}

export const snapshotSelection = (state: EditorState): SelectionSnapshot => ({
  ranges: state.selection.ranges.map((range) => ({ anchor: range.anchor, head: range.head })),
  main: state.selection.mainIndex,
});

export const formatSelection = ({ ranges, main }: SelectionSnapshot) => {
  const primary = ranges[main] ?? ranges[0];
  if (!primary) {
    return 'caret @?';
  }
  const base = primary.anchor === primary.head
    ? `caret @${primary.head}`
    : `sel ${primary.anchor}→${primary.head}`;
  return ranges.length > 1 ? `${base} +${ranges.length - 1} more` : base;
};

const quote = (value: string) => JSON.stringify(value);

/** One-line rendering of an entry, for a log panel or a Trrack node label. */
export function formatEntry(entry: InputEntry) {
  const where = formatSelection(entry.selection);
  if (entry.kind === 'key') {
    return `${entry.at}ms  key ${entry.key}  ${where}`;
  }
  if (entry.kind === 'selection') {
    return `${entry.at}ms  ${where}`;
  }
  const inserted = entry.inserted ? ` +${quote(entry.inserted)}` : '';
  const removed = entry.removed ? ` -${entry.removed}` : '';
  return `${entry.at}ms  ${entry.userEvent} @${entry.from}${inserted}${removed}  ${where}`;
}

/** Short label for the provenance node an entry produces. */
export function entryLabel(entry: InputEntry) {
  if (entry.kind === 'key') {
    return `Key ${entry.key}`;
  }
  if (entry.kind === 'selection') {
    return `Select ${formatSelection(entry.selection)}`;
  }
  return `Edit ${entry.userEvent}`;
}

/**
 * The edit entries a document-changing update produced, one per change range.
 * Exported so it can be exercised without mounting a view.
 */
export function editEntries(update: ViewUpdate, at: number): InputEntry[] {
  const userEvent = update.transactions
    .map((transaction) => transaction.annotation(Transaction.userEvent))
    .find(Boolean) ?? 'unknown';
  const selection = snapshotSelection(update.state);
  const entries: InputEntry[] = [];
  update.changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
    entries.push({
      kind: 'edit',
      at,
      selection,
      userEvent,
      from: fromA,
      inserted: inserted.toString(),
      removed: toA - fromA,
    });
  });
  return entries;
}

export interface RecorderOptions {
  /** Called once per recorded entry, in the order the participant produced them. */
  onEntry: (entry: InputEntry) => void;
  /** Milliseconds elapsed, however the host wants to measure it. */
  now: () => number;
}

/**
 * A CodeMirror extension that reports every key press, document change, and
 * selection change to `onEntry`.
 *
 * Keys are observed with `domEventObservers` rather than `domEventHandlers`:
 * handlers stop at the first one returning true, and a keymap placed ahead of
 * this extension would swallow every bound key (arrows, Home/End, Ctrl-Z)
 * before it was ever seen. Observers always run.
 */
export function trrackCodeMirror({ onEntry, now }: RecorderOptions): Extension {
  return [
    EditorView.domEventObservers({
      keydown: (event, view) => {
        if (MODIFIER_KEYS.has(event.key)) {
          return;
        }
        onEntry({
          kind: 'key',
          at: now(),
          key: describeKey(event),
          selection: snapshotSelection(view.state),
        });
      },
    }),
    EditorView.updateListener.of((update) => {
      // Replay drives the editor through the same transactions a participant
      // would, so skip anything this module dispatched itself.
      if (update.transactions.some((transaction) => transaction.annotation(replayed))) {
        return;
      }
      const at = now();
      if (update.docChanged) {
        editEntries(update, at).forEach(onEntry);
      } else if (update.selectionSet) {
        onEntry({ kind: 'selection', at, selection: snapshotSelection(update.state) });
      }
    }),
  ];
}

/** Include this where the editor should be lockable by `setReplayMode`. */
export const replayableEditor = (): Extension => editableCompartment.of(EditorView.editable.of(true));

/**
 * Locks or unlocks the editor. Replay locks it so an analyst scrubbing through
 * a session cannot type into the participant's document.
 */
export function setReplayMode(view: EditorView, replaying: boolean) {
  view.dispatch({
    effects: editableCompartment.reconfigure(EditorView.editable.of(!replaying)),
    annotations: replayed.of(true),
  });
}

/** Clamps a recorded offset to a document that may be shorter. */
const clamp = (offset: number, length: number) => Math.max(0, Math.min(offset, length));

/**
 * Drives the editor to a recorded state: the document as it stood, and the
 * caret or selection as it stood. Dispatched as one transaction marked as
 * replayed, so the recorder ignores it.
 */
export function replayTo(view: EditorView, state: CodeProvenanceState) {
  const current = view.state.doc.toString();
  const length = state.code.length;
  const ranges = (state.selection.ranges.length > 0 ? state.selection.ranges : EMPTY_SELECTION.ranges)
    .map(({ anchor, head }) => ({ anchor: clamp(anchor, length), head: clamp(head, length) }));

  view.dispatch({
    changes: current === state.code
      ? undefined
      : { from: 0, to: current.length, insert: state.code },
    selection: {
      anchor: ranges[state.selection.main]?.anchor ?? ranges[0].anchor,
      head: ranges[state.selection.main]?.head ?? ranges[0].head,
    },
    annotations: replayed.of(true),
    scrollIntoView: true,
  });
}

/**
 * Trrack wiring for the entries above.
 *
 * Returns a registry already carrying a `record` action, which a host can add
 * its own actions to. The state parameter is generic so a task can widen
 * `CodeProvenanceState` with whatever else it needs to replay.
 */
export function createCodeProvenance<State extends CodeProvenanceState>() {
  const registry = Registry.create();

  const recordAction = registry.register<'record', 'undoRecord', { entries: InputEntry[]; code?: string }>(
    'record',
    (state: State, payload) => {
      state.inputLog.push(...payload.entries);
      const latest = payload.entries.at(-1);
      if (latest) {
        state.selection = latest.selection;
      }
      if (payload.code !== undefined) {
        state.code = payload.code;
      }
      return state;
    },
  );

  return { registry, recordAction };
}
