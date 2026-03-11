import { renderToStaticMarkup } from 'react-dom/server';
import {
  describe, expect, it, vi,
} from 'vitest';
import { AnalysisFooter } from './AnalysisFooter';

const mockStorageEngine = {
  getAllParticipantIds: vi.fn(async () => ['p1', 'p2']),
};

vi.mock('../../storage/storageEngineHooks', () => ({
  useStorageEngine: () => ({ storageEngine: mockStorageEngine }),
}));

vi.mock('../../store/hooks/useAsync', () => ({
  useAsync: () => ({ value: ['p1', 'p2'], status: 'success' }),
}));

vi.mock('../../routes/utils', () => ({
  useCurrentIdentifier: () => 'trial-1',
}));

vi.mock('react-router', () => ({
  useParams: () => ({ studyId: 'study-a' }),
}));

vi.mock('../../store/store', () => ({
  useStoreDispatch: () => vi.fn(),
  useStoreActions: () => ({ saveAnalysisState: (payload: unknown) => payload }),
}));

vi.mock('../../analysis/individualStudy/thinkAloud/ThinkAloudFooter', () => ({
  ThinkAloudFooter: ({ visibleParticipants, currentTrial }: { visibleParticipants: string[]; currentTrial: string }) => <div>{`footer-${visibleParticipants.length}-${currentTrial}`}</div>,
}));

describe('AnalysisFooter', () => {
  it('renders footer with participant list and identifier', () => {
    const html = renderToStaticMarkup(<AnalysisFooter setHasAudio={vi.fn()} />);
    expect(html).toContain('footer-2-trial-1');
  });
});
