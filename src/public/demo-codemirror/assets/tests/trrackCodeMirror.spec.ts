import { describe, expect, test } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import {
  CodeProvenanceState,
  InputEntry,
  createCodeProvenance,
  describeKey,
  entryLabel,
  formatEntry,
  formatSelection,
  replayTo,
  replayableEditor,
  setReplayMode,
  snapshotSelection,
  trrackCodeMirror,
} from '../trrackCodeMirror';

const DOC = 'const a = 1;\nconst b = 2;\n';

/** Mounts a recording editor and collects everything it reports. */
function mountRecorder(doc = DOC) {
  const entries: InputEntry[] = [];
  let clock = 0;
  const parent = document.createElement('div');
  document.body.appendChild(parent);

  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc,
      extensions: [
        replayableEditor(),
        trrackCodeMirror({
          onEntry: (entry) => entries.push(entry),
          now: () => {
            clock += 1;
            return clock;
          },
        }),
      ],
    }),
  });

  return {
    view,
    entries,
    cleanup: () => {
      view.destroy();
      parent.remove();
    },
  };
}

const keydown = (view: EditorView, init: KeyboardEventInit) => {
  view.contentDOM.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ...init }));
};

describe('describeKey', () => {
  test('spells out modifiers, and leaves shift implicit for printable keys', () => {
    expect(describeKey(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }))).toBe('Ctrl-z');
    expect(describeKey(new KeyboardEvent('keydown', { key: 'ArrowLeft', shiftKey: true }))).toBe('Shift-ArrowLeft');
    expect(describeKey(new KeyboardEvent('keydown', { key: 'A', shiftKey: true }))).toBe('A');
    expect(describeKey(new KeyboardEvent('keydown', { key: 's', metaKey: true, altKey: true }))).toBe('Meta-Alt-s');
  });
});

describe('formatSelection', () => {
  test('distinguishes a caret from a selection, and reports extra ranges', () => {
    expect(formatSelection({ ranges: [{ anchor: 5, head: 5 }], main: 0 })).toBe('caret @5');
    expect(formatSelection({ ranges: [{ anchor: 9, head: 3 }], main: 0 })).toBe('sel 9→3');
    expect(formatSelection({
      ranges: [{ anchor: 0, head: 1 }, { anchor: 4, head: 5 }],
      main: 1,
    })).toBe('sel 4→5 +1 more');
  });
});

describe('recording', () => {
  test('records a key press with the caret as it stood before the key acted', () => {
    const { view, entries, cleanup } = mountRecorder();
    view.dispatch({ selection: { anchor: 4 } });
    entries.length = 0;

    keydown(view, { key: 'ArrowRight' });

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ kind: 'key', key: 'ArrowRight' });
    expect(entries[0].selection).toEqual({ ranges: [{ anchor: 4, head: 4 }], main: 0 });
    cleanup();
  });

  test('drops bare modifier presses, which repeat while held', () => {
    const { view, entries, cleanup } = mountRecorder();
    keydown(view, { key: 'Shift', shiftKey: true });
    keydown(view, { key: 'Control', ctrlKey: true });

    expect(entries).toHaveLength(0);
    cleanup();
  });

  test('records a document change with its user event, offset, and text', () => {
    const { view, entries, cleanup } = mountRecorder();

    view.dispatch({ changes: { from: 10, to: 11, insert: '42' }, userEvent: 'input.type' });

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      kind: 'edit', userEvent: 'input.type', from: 10, inserted: '42', removed: 1,
    });
    cleanup();
  });

  test('falls back to "unknown" when a change carries no user event', () => {
    const { view, entries, cleanup } = mountRecorder();

    view.dispatch({ changes: { from: 0, to: 0, insert: 'x' } });

    expect(entries[0]).toMatchObject({ kind: 'edit', userEvent: 'unknown' });
    cleanup();
  });

  test('records a selection change that left the document alone', () => {
    const { view, entries, cleanup } = mountRecorder();

    view.dispatch({ selection: { anchor: 2, head: 7 } });

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ kind: 'selection' });
    expect(entries[0].selection).toEqual({ ranges: [{ anchor: 2, head: 7 }], main: 0 });
    cleanup();
  });

  test('reports one edit entry per change range in a multi-range transaction', () => {
    const { view, entries, cleanup } = mountRecorder();

    view.dispatch({
      changes: [{ from: 0, to: 5, insert: 'let' }, { from: 13, to: 18, insert: 'let' }],
      userEvent: 'input.type',
    });

    expect(entries).toHaveLength(2);
    expect(entries.map((entry) => entry.from)).toEqual([0, 13]);
    cleanup();
  });
});

describe('replay', () => {
  test('replayTo restores the document and the selection without recording them', () => {
    const { view, entries, cleanup } = mountRecorder('');
    const state: CodeProvenanceState = {
      code: DOC,
      selection: { ranges: [{ anchor: 6, head: 12 }], main: 0 },
      inputLog: [],
    };

    replayTo(view, state);

    expect(view.state.doc.toString()).toBe(DOC);
    expect(snapshotSelection(view.state)).toEqual(state.selection);
    expect(entries).toHaveLength(0);
    cleanup();
  });

  test('replayTo clamps offsets recorded against a longer document', () => {
    const { view, cleanup } = mountRecorder(DOC);

    replayTo(view, {
      code: 'ab',
      selection: { ranges: [{ anchor: 99, head: 99 }], main: 0 },
      inputLog: [],
    });

    expect(view.state.doc.toString()).toBe('ab');
    expect(snapshotSelection(view.state)).toEqual({ ranges: [{ anchor: 2, head: 2 }], main: 0 });
    cleanup();
  });

  test('setReplayMode locks the editor and unlocks it again, silently', () => {
    const { view, entries, cleanup } = mountRecorder();

    setReplayMode(view, true);
    expect(view.state.facet(EditorView.editable)).toBe(false);

    setReplayMode(view, false);
    expect(view.state.facet(EditorView.editable)).toBe(true);

    expect(entries).toHaveLength(0);
    cleanup();
  });
});

describe('trrack wiring', () => {
  test('record folds entries into the log, the caret, and the document', () => {
    const { registry, recordAction } = createCodeProvenance<CodeProvenanceState>();
    const initial: CodeProvenanceState = {
      code: '',
      selection: { ranges: [{ anchor: 0, head: 0 }], main: 0 },
      inputLog: [],
    };
    const entry: InputEntry = {
      kind: 'edit',
      at: 5,
      selection: { ranges: [{ anchor: 3, head: 3 }], main: 0 },
      userEvent: 'input.type',
      from: 0,
      inserted: 'abc',
      removed: 0,
    };

    // Exercise the reducer the registry holds, without a live Trrack instance.
    const reducer = registry.get('record').func as unknown as (
      state: CodeProvenanceState,
      payload: { entries: InputEntry[]; code?: string },
    ) => CodeProvenanceState;
    const next = reducer(structuredClone(initial), { entries: [entry], code: 'abc' });

    expect(next.code).toBe('abc');
    expect(next.inputLog).toHaveLength(1);
    expect(next.selection).toEqual(entry.selection);
    expect(recordAction).toBeTypeOf('function');
  });
});

describe('labels', () => {
  test('entryLabel and formatEntry describe each kind', () => {
    const selection = { ranges: [{ anchor: 4, head: 4 }], main: 0 };
    const key: InputEntry = {
      kind: 'key', at: 12, key: 'ArrowDown', selection,
    };
    const edit: InputEntry = {
      kind: 'edit', at: 20, selection, userEvent: 'input.type', from: 4, inserted: 'x', removed: 2,
    };
    const select: InputEntry = { kind: 'selection', at: 30, selection };

    expect(entryLabel(key)).toBe('Key ArrowDown');
    expect(entryLabel(edit)).toBe('Edit input.type');
    expect(entryLabel(select)).toBe('Select caret @4');

    expect(formatEntry(key)).toBe('12ms  key ArrowDown  caret @4');
    expect(formatEntry(edit)).toBe('20ms  input.type @4 +"x" -2  caret @4');
    expect(formatEntry(select)).toBe('30ms  caret @4');
  });
});
