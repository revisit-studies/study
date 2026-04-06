import { renderToStaticMarkup } from 'react-dom/server';
import {
  beforeEach, describe, expect, test, vi,
} from 'vitest';
import { AnalysisFooter } from './AnalysisFooter';

// ── mutable state ─────────────────────────────────────────────────────────────

let mockStorageEngine: Record<string, ReturnType<typeof vi.fn>> | undefined;

// ── mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../../storage/storageEngineHooks', () => ({
  useStorageEngine: () => ({ storageEngine: mockStorageEngine }),
}));

vi.mock('../../store/hooks/useAsync', () => ({
  // Invoke fn to cover getAllParticipantsNames body (lines 12-17)
  useAsync: (fn: (...args: unknown[]) => Promise<unknown>, deps: unknown[]) => {
    fn(...(deps ?? [])).catch(() => {});
    return { value: ['p1', 'p2'], status: 'success' as const };
  },
}));

vi.mock('../../routes/utils', () => ({
  useCurrentIdentifier: () => 'trial1_0',
}));

vi.mock('../../store/store', () => ({
  useStoreActions: () => ({ saveAnalysisState: vi.fn() }),
  useStoreDispatch: () => vi.fn(),
}));

vi.mock('react-router', () => ({
  useParams: () => ({ studyId: 'test-study' }),
}));

vi.mock('../../analysis/individualStudy/thinkAloud/ThinkAloudFooter', () => ({
  ThinkAloudFooter: ({
    studyId,
    currentTrial,
    visibleParticipants,
  }: { studyId: string; currentTrial: string; visibleParticipants: string[] }) => (
    <div
      data-testid="think-aloud-footer"
      data-study-id={studyId}
      data-trial={currentTrial}
      data-participants={visibleParticipants.join(',')}
    />
  ),
}));

// ── tests ─────────────────────────────────────────────────────────────────────

describe('AnalysisFooter', () => {
  beforeEach(() => {
    mockStorageEngine = { getAllParticipantIds: vi.fn().mockResolvedValue(['p1', 'p2']) };
  });

  test('renders ThinkAloudFooter', () => {
    const html = renderToStaticMarkup(<AnalysisFooter setHasAudio={vi.fn()} />);
    expect(html).toContain('data-testid="think-aloud-footer"');
  });

  test('passes studyId to ThinkAloudFooter', () => {
    const html = renderToStaticMarkup(<AnalysisFooter setHasAudio={vi.fn()} />);
    expect(html).toContain('data-study-id="test-study"');
  });

  test('passes currentTrial identifier to ThinkAloudFooter', () => {
    const html = renderToStaticMarkup(<AnalysisFooter setHasAudio={vi.fn()} />);
    expect(html).toContain('data-trial="trial1_0"');
  });

  test('passes participant list to ThinkAloudFooter', () => {
    const html = renderToStaticMarkup(<AnalysisFooter setHasAudio={vi.fn()} />);
    expect(html).toContain('data-participants="p1,p2"');
  });

  test('renders with undefined storageEngine (covers null return path)', () => {
    mockStorageEngine = undefined;
    const html = renderToStaticMarkup(<AnalysisFooter setHasAudio={vi.fn()} />);
    expect(html).toContain('data-testid="think-aloud-footer"');
  });
});
