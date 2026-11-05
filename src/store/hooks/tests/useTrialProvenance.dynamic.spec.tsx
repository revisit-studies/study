import { MantineProvider } from '@mantine/core';
import { initializeTrrack, Registry } from '@trrack/core';
import {
  cleanup, render, screen, waitFor,
} from '@testing-library/react';
import {
  afterEach, expect, test, vi,
} from 'vitest';
import { TrialProvenanceBoundary, useTrialProvenance } from '../useTrialProvenance';
import { makeStudyConfig, makeStoredAnswer } from '../../../tests/utils';
import type { StoredProvenance, StoreState } from '../../types';

const mocks = vi.hoisted(() => ({
  state: {} as StoreState,
  getProvenance: vi.fn(),
  dispatch: vi.fn(),
  restore: vi.fn((payload: { identifier: string; provenance: StoredProvenance }) => ({ type: 'restore', payload })),
  push: vi.fn(),
  flat: ['myFunc', 'end'],
  navigate: vi.fn(),
}));
vi.mock('react-router', () => ({
  useParams: () => ({ studyId: 'study', index: '0', funcIndex: '0' }),
  useNavigate: () => mocks.navigate,
}));
vi.mock('../../../utils/encryptDecryptIndex', () => ({ decryptIndex: Number, encryptIndex: String }));
vi.mock('../useIsAnalysis', () => ({ useIsAnalysis: () => false }));
const storageEngine = { getProvenance: mocks.getProvenance };
vi.mock('../../../storage/storageEngineHooks', () => ({ useStorageEngine: () => ({ storageEngine }) }));
vi.mock('../../store', () => ({
  useStoreSelector: (selector: (state: StoreState) => unknown) => selector(mocks.state),
  useStoreActions: () => ({ restoreTrialProvenance: mocks.restore, pushToFuncSequence: mocks.push }),
  useStoreDispatch: () => mocks.dispatch,
  useFlatSequence: () => mocks.flat,
}));
const config = makeStudyConfig({ components: { CompA: { type: 'markdown', path: 'test.md', response: [] } } });
vi.mock('../useStudyConfig', () => ({ useStudyConfig: () => config }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test('restores the retained graph after a dynamic trial resolves its saved identity', async () => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  const saved = initializeTrrack({ registry: Registry.create(), initialState: { value: 'saved' } }).graph.backend;
  const identifier = 'myFunc_0_CompA_0';
  mocks.state = {
    participantId: 'participant',
    answers: {
      [identifier]: makeStoredAnswer({
        componentName: 'CompA', identifier, startTime: 10, endTime: 20,
      }),
    },
    trialValidation: { [identifier]: { provenanceGraph: { stimulus: saved } } },
    sequence: config.sequence,
  } as unknown as StoreState;
  function Child() {
    const graph = useTrialProvenance('stimulus');
    return <div data-testid="root">{graph?.root ?? 'new trial'}</div>;
  }
  render(<MantineProvider><TrialProvenanceBoundary><Child /></TrialProvenanceBoundary></MantineProvider>);
  await waitFor(() => expect(mocks.restore.mock.calls.some(([payload]) => payload.identifier === identifier)).toBe(true));
  const payload = mocks.restore.mock.calls.filter(([value]) => value.identifier === identifier).at(-1)![0];
  expect(payload.provenance.stimulus).toEqual(saved);
  expect(screen.getByTestId('root').textContent).toBe(saved.root);
  expect(mocks.getProvenance).not.toHaveBeenCalled();
});
