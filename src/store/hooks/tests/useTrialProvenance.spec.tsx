import {
  act, cleanup, fireEvent, render, screen, waitFor,
} from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { initializeTrrack, Registry } from '@trrack/core';
import {
  afterEach, beforeEach, expect, test, vi,
} from 'vitest';
import { TrialProvenanceBoundary, useTrialProvenance } from '../useTrialProvenance';
import { makeStoredAnswer } from '../../../tests/utils';
import type { StoreState } from '../../types';

const mocks = vi.hoisted(() => ({
  identifier: 'trial_0',
  isAnalysis: false,
  state: {} as StoreState,
  getProvenance: vi.fn(),
  dispatch: vi.fn(),
  restoreTrialProvenance: vi.fn((payload) => ({ type: 'restoreTrialProvenance', payload })),
}));
beforeEach(() => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
});

vi.mock('../../../routes/utils', () => ({ useCurrentIdentifier: () => mocks.identifier }));
vi.mock('../useIsAnalysis', () => ({ useIsAnalysis: () => mocks.isAnalysis }));
const storageEngine = { getProvenance: mocks.getProvenance };
vi.mock('../../../storage/storageEngineHooks', () => ({ useStorageEngine: () => ({ storageEngine }) }));
vi.mock('../../store', () => ({
  useStoreSelector: (selector: (state: StoreState) => unknown) => selector(mocks.state),
  useStoreDispatch: () => mocks.dispatch,
  useStoreActions: () => ({ restoreTrialProvenance: mocks.restoreTrialProvenance }),
}));

function Stimulus() {
  const provenance = useTrialProvenance('stimulus');
  return <div data-testid="stimulus">{provenance?.root ?? 'new trial'}</div>;
}
function mount() {
  return render(<MantineProvider forceColorScheme="light"><TrialProvenanceBoundary><Stimulus /></TrialProvenanceBoundary></MantineProvider>);
}
const graph = () => initializeTrrack({ registry: Registry.create(), initialState: { value: 'saved' } }).graph.backend;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.identifier = 'trial_0';
  mocks.isAnalysis = false;
  mocks.state = { participantId: 'participant', answers: { trial_0: makeStoredAnswer({ startTime: 10, endTime: 20 }) }, trialValidation: {} } as unknown as StoreState;
  mocks.getProvenance.mockResolvedValue(null);
});
afterEach(cleanup);

test('waits for persisted history before mounting any component', async () => {
  const saved = graph();
  let resolve!: (value: unknown) => void;
  mocks.getProvenance.mockReturnValue(new Promise((done) => { resolve = done; }));
  mount();
  expect(screen.queryByTestId('stimulus')).toBeNull();
  await act(async () => { resolve({ stimulus: saved }); });
  expect(screen.getByTestId('stimulus').textContent).toBe(saved.root);
  expect(mocks.getProvenance).toHaveBeenCalledWith('trial_0', 'participant', true);
  expect(mocks.restoreTrialProvenance.mock.lastCall?.[0].provenance.stimulus).toEqual(saved);
});

test('keeps same-session history instead of loading an older copy', async () => {
  const retained = graph();
  mocks.state.trialValidation = { trial_0: { provenanceGraph: { stimulus: retained } } } as unknown as StoreState['trialValidation'];
  mount();
  await waitFor(() => expect(screen.getByTestId('stimulus').textContent).toBe(retained.root));
  expect(mocks.getProvenance).not.toHaveBeenCalled();
});

test('failed reads preserve history and offer retry; missing legacy history initializes normally', async () => {
  mocks.getProvenance.mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce(null);
  mount();
  await waitFor(() => expect(screen.getByRole('alert')).not.toBeNull());
  expect(screen.queryByTestId('stimulus')).toBeNull();
  expect(mocks.restoreTrialProvenance).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Retry restoration' }));
  await waitFor(() => expect(screen.getByTestId('stimulus').textContent).toBe('new trial'));
});

test('rejects a malformed graph without publishing a replacement', async () => {
  mocks.getProvenance.mockResolvedValue({ stimulus: { root: 'gone', current: 'gone', nodes: {} } });
  mount();
  await waitFor(() => expect(screen.getByRole('alert')).not.toBeNull());
  expect(mocks.dispatch).not.toHaveBeenCalled();
});

test('ignores stale loading results after navigation', async () => {
  let resolve!: (value: unknown) => void;
  mocks.getProvenance.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
  const view = mount();
  mocks.identifier = 'other_1';
  view.rerender(<MantineProvider forceColorScheme="light"><TrialProvenanceBoundary><Stimulus /></TrialProvenanceBoundary></MantineProvider>);
  await waitFor(() => expect(screen.getByTestId('stimulus').textContent).toBe('new trial'));
  await act(async () => { resolve({ stimulus: graph() }); });
  expect(mocks.restoreTrialProvenance.mock.calls.map(([payload]) => payload.identifier)).toEqual(['other_1']);
});

test('analysis remains read-only and does not load editable history', () => {
  mocks.isAnalysis = true;
  mount();
  expect(screen.getByTestId('stimulus').textContent).toBe('new trial');
  expect(mocks.getProvenance).not.toHaveBeenCalled();
});
