import { ReactNode } from 'react';
import {
  render, act, fireEvent, cleanup,
} from '@testing-library/react';
import {
  afterEach, describe, expect, test, vi,
} from 'vitest';
import { TextEditor } from './TextEditor';
import type { EditedText } from './types';

// ── mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../../../storage/storageEngineHooks', () => ({
  useStorageEngine: () => ({ storageEngine: undefined }),
}));

vi.mock('../../../store/hooks/useAsync', () => ({
  useAsync: () => ({ value: [], execute: vi.fn(), status: 'success' }),
}));

vi.mock('../../../store/hooks/useEvent', () => ({
  useEvent: (fn: (...args: unknown[]) => unknown) => fn,
}));

vi.mock('./TranscriptLine', () => ({
  TranscriptLine: ({
    text, onTextChange, deleteRowCallback, addRowCallback, setAnnotation, editTagCallback, createTagCallback, addRef, index,
  }: {
    text: string;
    onTextChange: (i: number, v: string) => void;
    deleteRowCallback: (i: number) => void;
    addRowCallback: (i: number, pos: number) => void;
    setAnnotation: (i: number, s: string) => void;
    editTagCallback: (oldTag: { id: string }, newTag: { id: string }) => void;
    createTagCallback: (t: { id: string; label: string; color: string }) => void;
    addRef: (i: number, ref: HTMLTextAreaElement) => void;
    index: number;
  }) => {
    // register a mock ref on mount to exercise addTextRefCallback
    const mockRef = { focus: () => {}, setSelectionRange: () => {} } as unknown as HTMLTextAreaElement;
    addRef(index, mockRef);
    return (
      <div data-testid="transcript-line">
        {text}
        <button type="button" data-testid="btn-change" onClick={() => onTextChange(index, 'changed')}>change</button>
        <button type="button" data-testid="btn-delete" onClick={() => deleteRowCallback(index)}>delete</button>
        <button type="button" data-testid="btn-add" onClick={() => addRowCallback(index, 0)}>add</button>
        <button type="button" data-testid="btn-annotate" onClick={() => setAnnotation(index, 'note')}>annotate</button>
        <button type="button" data-testid="btn-edit-tag" onClick={() => editTagCallback({ id: 'old' }, { id: 'new' })}>editTag</button>
        <button type="button" data-testid="btn-create-tag" onClick={() => createTagCallback({ id: 't1', label: 'T1', color: 'red' })}>createTag</button>
      </div>
    );
  },
}));

vi.mock('@mantine/core', () => ({
  Grid: Object.assign(
    ({ children }: { children: ReactNode }) => <div>{children}</div>,
    { Col: ({ children }: { children: ReactNode }) => <div>{children}</div> },
  ),
  Group: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Stack: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Text: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  Tooltip: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@tabler/icons-react', () => ({
  IconInfoCircle: () => null,
}));

// ── fixtures ──────────────────────────────────────────────────────────────────

const sampleLine: EditedText = {
  transcriptMappingStart: 0,
  transcriptMappingEnd: 0,
  text: 'Hello world',
  selectedTags: [],
  annotation: '',
};

// ── tests ─────────────────────────────────────────────────────────────────────

afterEach(() => { cleanup(); });

describe('TextEditor', () => {
  test('renders without crashing with empty transcript list', async () => {
    const { container } = await act(async () => render(
      <TextEditor
        currentShownTranscription={0}
        transcriptList={[]}
        setTranscriptList={vi.fn()}
        onClickLine={vi.fn()}
      />,
    ));
    expect(container).toBeDefined();
  });

  test('renders a TranscriptLine for each item in the list', async () => {
    const { getAllByTestId } = await act(async () => render(
      <TextEditor
        currentShownTranscription={0}
        transcriptList={[sampleLine, { ...sampleLine, text: 'Second line' }]}
        setTranscriptList={vi.fn()}
        onClickLine={vi.fn()}
      />,
    ));
    expect(getAllByTestId('transcript-line')).toHaveLength(2);
  });

  test('renders header labels', async () => {
    const { container } = await act(async () => render(
      <TextEditor
        currentShownTranscription={0}
        transcriptList={[sampleLine]}
        setTranscriptList={vi.fn()}
        onClickLine={vi.fn()}
      />,
    ));
    expect(container.textContent).toContain('Transcripts');
    expect(container.textContent).toContain('Text Tags');
    expect(container.textContent).toContain('Annotations');
  });

  test('shows text content of each transcript line', async () => {
    const { getByText } = await act(async () => render(
      <TextEditor
        currentShownTranscription={0}
        transcriptList={[{ ...sampleLine, text: 'Unique text content' }]}
        setTranscriptList={vi.fn()}
        onClickLine={vi.fn()}
      />,
    ));
    expect(getByText('Unique text content')).toBeDefined();
  });

  test('onTextChange callback updates transcript list', async () => {
    const setTranscriptList = vi.fn();
    const { getAllByTestId } = await act(async () => render(
      <TextEditor
        currentShownTranscription={0}
        transcriptList={[sampleLine]}
        setTranscriptList={setTranscriptList}
        onClickLine={vi.fn()}
      />,
    ));
    fireEvent.click(getAllByTestId('btn-change')[0]);
    expect(setTranscriptList).toHaveBeenCalled();
  });

  test('deleteRowCallback does nothing at index 0', async () => {
    const setTranscriptList = vi.fn();
    const { getAllByTestId } = await act(async () => render(
      <TextEditor
        currentShownTranscription={0}
        transcriptList={[sampleLine]}
        setTranscriptList={setTranscriptList}
        onClickLine={vi.fn()}
      />,
    ));
    fireEvent.click(getAllByTestId('btn-delete')[0]);
    // index 0 → early return in deleteRowCallback, setTranscriptList not called
    expect(setTranscriptList).not.toHaveBeenCalled();
  });

  test('deleteRowCallback merges rows when index > 0', async () => {
    const setTranscriptList = vi.fn();
    const secondLine: EditedText = {
      transcriptMappingStart: 0,
      transcriptMappingEnd: 1,
      text: ' world',
      selectedTags: [],
      annotation: '',
    };
    const { getAllByTestId } = await act(async () => render(
      <TextEditor
        currentShownTranscription={0}
        transcriptList={[sampleLine, secondLine]}
        setTranscriptList={setTranscriptList}
        onClickLine={vi.fn()}
      />,
    ));
    // Click delete on the second line (index 1)
    fireEvent.click(getAllByTestId('btn-delete')[1]);
    expect(setTranscriptList).toHaveBeenCalled();
  });

  test('addRowCallback splits row at position', async () => {
    vi.useFakeTimers();
    const setTranscriptList = vi.fn();
    const { getAllByTestId } = await act(async () => render(
      <TextEditor
        currentShownTranscription={0}
        transcriptList={[sampleLine]}
        setTranscriptList={setTranscriptList}
        onClickLine={vi.fn()}
      />,
    ));
    fireEvent.click(getAllByTestId('btn-add')[0]);
    expect(setTranscriptList).toHaveBeenCalled();
    vi.useRealTimers();
  });

  test('setAnnotation callback updates annotation in list', async () => {
    const setTranscriptList = vi.fn();
    const { getAllByTestId } = await act(async () => render(
      <TextEditor
        currentShownTranscription={0}
        transcriptList={[sampleLine]}
        setTranscriptList={setTranscriptList}
        onClickLine={vi.fn()}
      />,
    ));
    fireEvent.click(getAllByTestId('btn-annotate')[0]);
    expect(setTranscriptList).toHaveBeenCalled();
  });

  test('editTagCallback is callable', async () => {
    const { getAllByTestId } = await act(async () => render(
      <TextEditor
        currentShownTranscription={0}
        transcriptList={[sampleLine]}
        setTranscriptList={vi.fn()}
        onClickLine={vi.fn()}
      />,
    ));
    // editTagCallback with tags=[] falls through without crashing
    expect(() => fireEvent.click(getAllByTestId('btn-edit-tag')[0])).not.toThrow();
  });

  test('createTagCallback appends new tag', async () => {
    const { getAllByTestId } = await act(async () => render(
      <TextEditor
        currentShownTranscription={0}
        transcriptList={[sampleLine]}
        setTranscriptList={vi.fn()}
        onClickLine={vi.fn()}
      />,
    ));
    expect(() => fireEvent.click(getAllByTestId('btn-create-tag')[0])).not.toThrow();
  });
});
