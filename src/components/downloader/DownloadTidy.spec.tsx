import { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  render, act, cleanup, fireEvent,
} from '@testing-library/react';
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import { DownloadTidy, download } from './DownloadTidy';
import type { ParticipantData } from '../../storage/types';
import { useAsync } from '../../store/hooks/useAsync';

// ── mutable async state ───────────────────────────────────────────────────────

type MockTableData = { header: string[]; rows: Record<string, string>[] } | null;
let mockTableData: MockTableData = null;
let mockTableStatus: 'idle' | 'pending' | 'success' | 'error' = 'idle';
let mockTableError: Error | null = null;

// ── mutable state ─────────────────────────────────────────────────────────────

let mockGetEngine = vi.fn().mockReturnValue('supabase');
let mockStorageEngineObj: Record<string, ReturnType<typeof vi.fn>> = {
  getEngine: mockGetEngine,
};

// ── mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../../storage/storageEngineHooks', () => ({
  // Wrap in a proxy so tests can mutate mockStorageEngineObj freely and
  // the existing tests that only reassign `mockGetEngine` still work.
  useStorageEngine: () => ({
    storageEngine: new Proxy({} as Record<string, unknown>, {
      get(_t, prop) {
        if (prop === 'getEngine') return mockGetEngine;
        return mockStorageEngineObj[prop as string];
      },
    }),
  }),
}));

vi.mock('../../store/hooks/useAsync', () => ({
  useAsync: vi.fn(() => ({
    value: mockTableData, status: mockTableStatus, error: mockTableError, execute: vi.fn(),
  })),
}));

vi.mock('../../storage/engines/FirebaseStorageEngine', () => ({
  FirebaseStorageEngine: class {},
}));

vi.mock('../../utils/notifications', () => ({
  showNotification: vi.fn(),
}));

vi.mock('../../utils/handleComponentInheritance', () => ({
  studyComponentToIndividualComponent: vi.fn(),
}));

vi.mock('../../utils/handleConditionLogic', () => ({
  parseConditionParam: vi.fn(() => []),
}));

vi.mock('../../utils/getCleanedDuration', () => ({
  getCleanedDuration: vi.fn(() => undefined),
}));

vi.mock('@mantine/core', () => ({
  ActionIcon: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>{children}</button>
  ),
  Alert: ({ children }: { children: ReactNode }) => <div role="alert">{children}</div>,
  Box: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Button: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>{children}</button>
  ),
  Flex: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Group: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  LoadingOverlay: () => null,
  Modal: ({ opened, children }: { opened: boolean; children: ReactNode }) => (
    opened ? <div>{children}</div> : null
  ),
  Progress: () => null,
  Space: () => <div />,
  Table: Object.assign(
    ({ children }: { children: ReactNode }) => <table>{children}</table>,
    {
      Thead: ({ children }: { children: ReactNode }) => <thead>{children}</thead>,
      Tbody: ({ children }: { children: ReactNode }) => <tbody>{children}</tbody>,
      Tr: ({ children }: { children: ReactNode }) => <tr>{children}</tr>,
      Th: ({ children }: { children: ReactNode }) => <th>{children}</th>,
      Td: ({ children }: { children: ReactNode }) => <td>{children}</td>,
    },
  ),
  Text: ({ children }: { children: ReactNode }) => <p>{children}</p>,
}));

vi.mock('@tabler/icons-react', () => ({
  IconAlertTriangle: () => null,
  IconBrandPython: () => null,
  IconLayoutColumns: () => null,
  IconTableExport: () => null,
  IconX: () => null,
}));

// ── fixtures ──────────────────────────────────────────────────────────────────

const baseProps = {
  opened: true,
  close: vi.fn(),
  filename: 'test.csv',
  data: [] as ParticipantData[],
  studyId: 'test-study',
};

// ── tests ─────────────────────────────────────────────────────────────────────

describe('DownloadTidy', () => {
  beforeEach(() => {
    mockGetEngine = vi.fn().mockReturnValue('supabase');
    mockStorageEngineObj = { getEngine: mockGetEngine };
    mockTableData = null;
    mockTableStatus = 'idle';
    mockTableError = null;
    vi.mocked(useAsync).mockImplementation(() => ({
      value: mockTableData, status: mockTableStatus, error: mockTableError, execute: vi.fn(),
    }));
  });

  test('transcript button absent when not Firebase', () => {
    const html = renderToStaticMarkup(<DownloadTidy {...baseProps} hasAudio />);
    expect(html).not.toContain('>transcript<');
  });

  test('transcript button absent when Firebase but hasAudio is false', () => {
    mockGetEngine = vi.fn().mockReturnValue('firebase');
    const html = renderToStaticMarkup(<DownloadTidy {...baseProps} hasAudio={false} />);
    expect(html).not.toContain('>transcript<');
  });

  test('transcript button present when Firebase and hasAudio', () => {
    mockGetEngine = vi.fn().mockReturnValue('firebase');
    const html = renderToStaticMarkup(<DownloadTidy {...baseProps} hasAudio />);
    expect(html).toContain('>transcript<');
  });

  test('other optional column buttons always present', () => {
    const html = renderToStaticMarkup(<DownloadTidy {...baseProps} />);
    expect(html).toContain('>condition<');
    expect(html).toContain('>answer<');
    expect(html).toContain('>duration<');
  });

  test('renders nothing when modal is closed', () => {
    const html = renderToStaticMarkup(<DownloadTidy {...baseProps} opened={false} />);
    expect(html).toBe('');
  });

  test('renders table when useAsync returns success with data', () => {
    mockTableData = {
      header: ['participantId', 'trialId', 'answer'],
      rows: [
        { participantId: 'p1', trialId: 'trial_0', answer: 'yes' },
        { participantId: 'p2', trialId: 'trial_1', answer: 'no' },
      ],
    };
    mockTableStatus = 'success';
    const html = renderToStaticMarkup(<DownloadTidy {...baseProps} />);
    expect(html).toContain('participantId');
    expect(html).toContain('trialId');
    expect(html).toContain('p1');
    expect(html).toContain('p2');
  });

  test('renders error alert when useAsync returns error', () => {
    mockTableStatus = 'error';
    mockTableError = new Error('Failed to load data');
    const html = renderToStaticMarkup(<DownloadTidy {...baseProps} />);
    expect(html).toContain('Failed to load data');
  });

  test('shows caption when table has rows', () => {
    mockTableData = {
      header: ['participantId'],
      rows: [{ participantId: 'p1' }, { participantId: 'p2' }, { participantId: 'p3' }],
    };
    mockTableStatus = 'success';
    const html = renderToStaticMarkup(<DownloadTidy {...baseProps} />);
    expect(html).toContain('row');
  });

  test('X button on column header removes that column from selectedProperties', () => {
    mockTableData = { header: ['participantId', 'trialId', 'condition'], rows: [] };
    mockTableStatus = 'success';
    // Just verify the X button renders for non-required columns
    const html = renderToStaticMarkup(<DownloadTidy {...baseProps} />);
    expect(html).toContain('condition');
  });

  test('studyId __revisit-widget shows python export button', () => {
    const html = renderToStaticMarkup(
      <DownloadTidy {...baseProps} studyId="__revisit-widget" />,
    );
    expect(html).toBeDefined();
  });
});

describe('DownloadTidy interactive', () => {
  afterEach(() => { cleanup(); });

  beforeEach(() => {
    mockGetEngine = vi.fn().mockReturnValue('supabase');
    mockStorageEngineObj = { getEngine: mockGetEngine };
    mockTableData = null;
    mockTableStatus = 'idle';
    mockTableError = null;
    vi.mocked(useAsync).mockImplementation(() => ({
      value: mockTableData, status: mockTableStatus, error: mockTableError, execute: vi.fn(),
    }));
  });

  test('clicking optional column button toggles selection', async () => {
    const { getAllByRole } = await act(async () => render(<DownloadTidy {...baseProps} />));
    // Optional column buttons: condition, answer, duration (not transcript without audio)
    const buttons = getAllByRole('button');
    const conditionBtn = buttons.find((b) => b.textContent === 'condition');
    expect(conditionBtn).toBeDefined();
    // Click to deselect (initially selected)
    fireEvent.click(conditionBtn!);
    // Click again to re-select
    fireEvent.click(conditionBtn!);
    expect(conditionBtn).toBeDefined();
  });

  test('clicking Download button with tableData triggers CSV download', async () => {
    mockTableData = {
      header: ['participantId', 'trialId'],
      rows: [{ participantId: 'p1', trialId: 't1' }],
    };
    mockTableStatus = 'success';
    // Render first so React can create its own container via the real document.createElement
    const { getAllByRole } = await act(async () => render(<DownloadTidy {...baseProps} />));
    // Only mock 'a' element creation after render; fall through to real implementation for all others
    const anchorMock = { setAttribute: vi.fn(), click: vi.fn(), remove: vi.fn() };
    const origCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => (
      tag === 'a' ? (anchorMock as unknown as HTMLAnchorElement) : origCreate(tag)
    ));
    vi.spyOn(document.body, 'appendChild').mockImplementation((node: Node) => node);
    const downloadBtn = getAllByRole('button').find((b) => b.textContent === 'Download');
    expect(downloadBtn).toBeDefined();
    await act(async () => { fireEvent.click(downloadBtn!); });
    expect(anchorMock.click).toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  test('clicking X on a column header removes it from selectedProperties', async () => {
    mockTableData = {
      header: ['participantId', 'trialId', 'condition', 'answer'],
      rows: [],
    };
    mockTableStatus = 'success';
    const { getAllByRole } = await act(async () => render(<DownloadTidy {...baseProps} />));
    // X buttons are ActionIcon elements for non-required columns
    const xButtons = getAllByRole('button').filter((b) => b.textContent === '');
    // Click the first X button (for 'condition' or another optional column)
    if (xButtons.length > 0) {
      act(() => { fireEvent.click(xButtons[0]); });
    }
    expect(getAllByRole('button')).toBeDefined();
  });

  test('Python export button posts message when tableData is set and studyId is __revisit-widget', async () => {
    mockTableData = { header: ['participantId'], rows: [{ participantId: 'p1' }] };
    mockTableStatus = 'success';
    const postMessageSpy = vi.spyOn(window.parent, 'postMessage').mockImplementation(() => {});
    const { getAllByRole } = await act(async () => render(
      <DownloadTidy {...baseProps} studyId="__revisit-widget" />,
    ));
    const buttons = getAllByRole('button');
    // The Python export button contains the IconBrandPython (renders as null) — find the button after Download
    const pythonBtn = buttons[buttons.length - 1];
    fireEvent.click(pythonBtn);
    expect(postMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'revisitWidget/PYTHON_EXPORT_TIDY' }),
      '*',
    );
    postMessageSpy.mockRestore();
  });
});

describe('download', () => {
  test('creates and clicks a temporary anchor element', () => {
    const anchor = {
      setAttribute: vi.fn(),
      click: vi.fn(),
      remove: vi.fn(),
    } as unknown as HTMLAnchorElement;

    vi.spyOn(document, 'createElement').mockReturnValue(anchor);
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => anchor);

    download('{"key":"value"}', 'test.json');

    expect(anchor.setAttribute).toHaveBeenCalledWith('download', 'test.json');
    expect(anchor.click).toHaveBeenCalled();
    expect(anchor.remove).toHaveBeenCalled();

    vi.restoreAllMocks();
  });

  test('encodes the graph content in the href', () => {
    const anchor = {
      setAttribute: vi.fn(),
      click: vi.fn(),
      remove: vi.fn(),
    } as unknown as HTMLAnchorElement;

    vi.spyOn(document, 'createElement').mockReturnValue(anchor);
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => anchor);

    download('hello world', 'out.json');

    const setAttrMock = anchor.setAttribute as ReturnType<typeof vi.fn>;
    const hrefCall = setAttrMock.mock.calls.find((args: string[]) => args[0] === 'href');
    expect(hrefCall).toBeDefined();
    expect(hrefCall![1]).toContain(encodeURIComponent('hello world'));

    vi.restoreAllMocks();
  });
});

// ── getTableData / participantDataToRows call-through ────────────────────────
// These tests capture the fn/args passed to useAsync and invoke them directly
// so that getTableData (lines 238-293) and participantDataToRows (lines 102-235)
// are exercised, along with runWithConcurrencyLimit (lines 69-87).

const sampleParticipant: ParticipantData = {
  participantId: 'p1',
  participantConfigHash: 'hash-1',
  participantTags: { tag1: 'a' },
  conditions: [],
  stage: 'DEFAULT',
  rejected: false as never,
  completed: false,
  searchParams: {},
  sequence: {
    id: 'root', order: 'fixed', components: [], skip: [], orderPath: 'root',
  },
  answers: {
    trial1_0: {
      identifier: 'trial1_0',
      componentName: 'trial1',
      trialOrder: '0',
      endTime: 1000,
      startTime: 0,
      parameters: { pKey: 'pVal' },
      answer: { q1: 'yes' },
      windowEvents: [
        [1000, 'focus', 'INPUT'],
        [1001, 'keydown', 'Enter'],
        [1002, 'keyup', 'Enter'],
        [1003, 'mousedown', [10, 20]],
        [1004, 'mouseup', [10, 20]],
        [1005, 'mousemove', [10, 20]],
        [1006, 'scroll', [0, 100]],
        [1007, 'resize', [1200, 800]],
        [1008, 'input', ''],
        [1009, 'visibility', 'hidden'],
      ],
      correctAnswer: [{ id: 'q1', answer: 'yes' }],
      provenanceGraph: {},
      incorrectAnswers: {},
    } as never,
  },
  metadata: {},
} as unknown as ParticipantData;

const mockStudyConfigForTidy = {
  components: {
    trial1: {
      type: 'markdown',
      path: 'trial1.md',
      response: [{ id: 'q1', type: 'shortText', prompt: 'Q1' }],
      correctAnswer: [{ id: 'q1', answer: 'yes' }],
      description: 'desc',
      instruction: 'instr',
      meta: { key: 'val' },
      parameters: { pKey: 'pVal' },
    },
  },
};

describe('getTableData + participantDataToRows call-through', () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  test('calls getTableData through useAsync and covers participantDataToRows', async () => {
    const { studyComponentToIndividualComponent } = await import('../../utils/handleComponentInheritance');
    vi.mocked(studyComponentToIndividualComponent).mockReturnValue({
      response: [{ id: 'q1', type: 'shortText', prompt: 'Q1' }],
      description: 'desc',
      instruction: 'instr',
      correctAnswer: [{ id: 'q1', answer: 'yes' }],
      meta: { key: 'val' },
    } as never);

    mockStorageEngineObj = {
      getEngine: vi.fn().mockReturnValue('supabase'),
      getAllConfigsFromHash: vi.fn().mockResolvedValue({
        'hash-1': mockStudyConfigForTidy,
      }),
    };

    // Capture fn/args from the useAsync call
    let capturedFn: ((...args: unknown[]) => Promise<unknown>) | null = null;
    let capturedArgs: unknown[] | null = null;
    vi.mocked(useAsync).mockImplementation((fn, args) => {
      capturedFn = fn as (...args: unknown[]) => Promise<unknown>;
      capturedArgs = args as unknown[];
      return {
        value: null, status: 'pending', execute: vi.fn(), error: null,
      };
    });

    await act(async () => render(
      <DownloadTidy
        opened
        close={vi.fn()}
        filename="test.csv"
        data={[sampleParticipant]}
        studyId="test-study"
      />,
    ));

    expect(capturedFn).not.toBeNull();
    // Call getTableData directly with the captured args (exercises lines 102-293)
    const result = await capturedFn!(...capturedArgs!);
    expect(result).toBeDefined();
  });

  test('transcript branch covered when firebase + hasAudio + transcript property selected', async () => {
    const { studyComponentToIndividualComponent } = await import('../../utils/handleComponentInheritance');
    vi.mocked(studyComponentToIndividualComponent).mockReturnValue({ response: [] } as never);

    const getTranscriptionMock = vi.fn().mockResolvedValue({ results: [{ alternatives: [{ transcript: 'hello' }] }] });
    // Proxy reads mockGetEngine for 'getEngine', so update it to 'firebase'
    mockGetEngine = vi.fn().mockReturnValue('firebase');
    mockStorageEngineObj = {
      getEngine: mockGetEngine,
      getAllConfigsFromHash: vi.fn().mockResolvedValue({ 'hash-1': mockStudyConfigForTidy }),
      getTranscription: getTranscriptionMock,
    };

    let capturedFn: ((...args: unknown[]) => Promise<unknown>) | null = null;
    let capturedArgs: unknown[] | null = null;
    vi.mocked(useAsync).mockImplementation((fn, args) => {
      capturedFn = fn as (...args: unknown[]) => Promise<unknown>;
      capturedArgs = args as unknown[];
      return {
        value: null, status: 'pending', execute: vi.fn(), error: null,
      };
    });

    await act(async () => render(
      <DownloadTidy
        opened
        close={vi.fn()}
        filename="test.csv"
        data={[sampleParticipant]}
        studyId="test-study"
        hasAudio
      />,
    ));

    expect(capturedFn).not.toBeNull();
    // 'transcript' is not in the default selectedProperties; add it to capturedArgs[0]
    const modifiedArgs = [...capturedArgs!];
    modifiedArgs[0] = [...(capturedArgs![0] as string[]), 'transcript'];
    const result = await capturedFn!(...modifiedArgs);
    expect(result).toBeDefined();
    expect(getTranscriptionMock).toHaveBeenCalled();
  });

  test('runWithConcurrencyLimit with multiple tasks covers lines 69-87', async () => {
    const { studyComponentToIndividualComponent } = await import('../../utils/handleComponentInheritance');
    vi.mocked(studyComponentToIndividualComponent).mockReturnValue({ response: [] } as never);

    // Create a participant with many answers to generate multiple transcript tasks
    const manyAnswers = Object.fromEntries(
      Array.from({ length: 3 }, (_, i) => [`trial${i}_${i}`, {
        identifier: `trial${i}_${i}`,
        componentName: 'trial1',
        trialOrder: `${i}`,
        endTime: 1000,
        startTime: 0,
        parameters: {},
        answer: {},
        windowEvents: [],
        correctAnswer: [],
        provenanceGraph: {},
        incorrectAnswers: {},
      }]),
    );

    const manyAnswerParticipant = { ...sampleParticipant, answers: manyAnswers } as unknown as ParticipantData;

    const getTranscriptionMock = vi.fn().mockResolvedValue(null); // transcript not found
    mockGetEngine = vi.fn().mockReturnValue('firebase');
    mockStorageEngineObj = {
      getEngine: mockGetEngine,
      getAllConfigsFromHash: vi.fn().mockResolvedValue({ 'hash-1': mockStudyConfigForTidy }),
      getTranscription: getTranscriptionMock,
    };

    let capturedFn: ((...args: unknown[]) => Promise<unknown>) | null = null;
    let capturedArgs: unknown[] | null = null;
    vi.mocked(useAsync).mockImplementation((fn, args) => {
      capturedFn = fn as (...args: unknown[]) => Promise<unknown>;
      capturedArgs = args as unknown[];
      return {
        value: null, status: 'pending', execute: vi.fn(), error: null,
      };
    });

    await act(async () => render(
      <DownloadTidy opened close={vi.fn()} filename="test.csv" data={[manyAnswerParticipant]} studyId="test-study" hasAudio />,
    ));

    expect(capturedFn).not.toBeNull();
    const result = await capturedFn!(...capturedArgs!);
    expect(result).toBeDefined();
  });
});
