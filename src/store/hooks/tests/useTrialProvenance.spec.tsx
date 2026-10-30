import {
  act, cleanup, fireEvent, render, screen, waitFor,
} from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { initializeTrrack, Registry } from '@trrack/core';
import {
  afterEach, beforeEach, expect, test, vi,
} from 'vitest';
import { createGlobalStoreSubmission } from '../../globalStoreProvenance';
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
  setGlobalStoreSubmitting: vi.fn((payload) => ({ type: 'setGlobalStoreSubmitting', payload })),
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
  useStoreActions: () => ({ restoreTrialProvenance: mocks.restoreTrialProvenance, setGlobalStoreSubmitting: mocks.setGlobalStoreSubmitting }),
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

test('missing accepted source assets stop restoration instead of publishing a fresh graph', async () => {
  const saved = graph();
  const answer = makeStoredAnswer({
    identifier: 'trial_0', componentName: 'trial', trialOrder: '0', startTime: 10, endTime: 20,
  });
  const accepted = createGlobalStoreSubmission(undefined, { budget: { initialValue: 100 } }, answer, { budget: 70 }, [], { stimulus: saved });
  mocks.state.globalStoreGraph = accepted.graph;
  mocks.getProvenance.mockResolvedValue(null);
  mount();
  await waitFor(() => expect(screen.getByRole('alert')).not.toBeNull());
  expect(screen.queryByTestId('stimulus')).toBeNull();
  expect(mocks.restoreTrialProvenance).not.toHaveBeenCalled();
});

test('invalidated history is retained with an instruction to initialize from the replacement context', async () => {
  const saved = graph();
  const definitions = { budget: { initialValue: 100 } };
  const first = makeStoredAnswer({ identifier: 'first_0', trialOrder: '0', answer: { cost: 30 } });
  const later = makeStoredAnswer({ identifier: 'trial_0', trialOrder: '1', answer: { cost: 20 } });
  const a = createGlobalStoreSubmission(undefined, definitions, first, { budget: 70 }, [], {});
  const b = createGlobalStoreSubmission(a.graph, definitions, later, { budget: 50 }, [], { stimulus: saved });
  const revised = createGlobalStoreSubmission(b.graph, definitions, { ...first, answer: { cost: 10 } }, { budget: 90 }, [], {});
  mocks.state.globalStoreGraph = revised.graph;
  mocks.state.answers.trial_0 = makeStoredAnswer({ trialOrder: '1', endTime: -1 });
  mocks.getProvenance.mockResolvedValue({ stimulus: saved });
  mount();
  await waitFor(() => expect(mocks.restoreTrialProvenance).toHaveBeenCalled());
  expect(mocks.restoreTrialProvenance.mock.lastCall?.[0].provenance.stimulus).toMatchObject({
    root: saved.root, current: saved.root, resetToInitialState: true, nodes: saved.nodes,
  });
});

test('restores every form location from the accepted source nodes before mounting', async () => {
  const forms = initializeTrrack({ registry: Registry.create(), initialState: { form: { choice: 'accepted' } } });
  const saved = structuredClone(forms.graph.backend);
  const answer = makeStoredAnswer({ identifier: 'trial_0', trialOrder: '0', answer: { choice: 'accepted' } });
  const accepted = createGlobalStoreSubmission(undefined, { budget: { initialValue: 100 } }, answer, { budget: 70 }, [], { aboveStimulus: saved, sidebar: saved });
  forms.record({
    label: 'Unsubmitted edit', state: { form: { choice: 'draft' } }, eventType: 'edit', sideEffects: { do: [], undo: [] },
  });
  mocks.state.globalStoreGraph = accepted.graph;
  mocks.getProvenance.mockResolvedValue({ aboveStimulus: forms.graph.backend, sidebar: forms.graph.backend });
  mount();
  await waitFor(() => expect(mocks.restoreTrialProvenance).toHaveBeenCalled());
  expect(mocks.restoreTrialProvenance.mock.lastCall?.[0].responseValues).toEqual({
    aboveStimulus: { choice: 'accepted' }, sidebar: { choice: 'accepted' },
  });
});

test('invalidated forms do not seed response visibility from the old entry context', async () => {
  const saved = initializeTrrack({ registry: Registry.create(), initialState: { form: { choice: 'old' } } }).graph.backend;
  const definitions = { budget: { initialValue: 100 } };
  const first = makeStoredAnswer({ identifier: 'first_0', trialOrder: '0', answer: { cost: 30 } });
  const later = makeStoredAnswer({ identifier: 'trial_0', trialOrder: '1', answer: { choice: 'old' } });
  const a = createGlobalStoreSubmission(undefined, definitions, first, { budget: 70 }, [], {});
  const b = createGlobalStoreSubmission(a.graph, definitions, later, { budget: 50 }, [], { sidebar: saved });
  mocks.state.globalStoreGraph = createGlobalStoreSubmission(b.graph, definitions, { ...first, answer: { cost: 10 } }, { budget: 90 }, [], {}).graph;
  mocks.getProvenance.mockResolvedValue({ sidebar: saved });
  mount();
  await waitFor(() => expect(mocks.restoreTrialProvenance).toHaveBeenCalled());
  expect(mocks.restoreTrialProvenance.mock.lastCall?.[0].responseValues).toEqual({});
  expect(mocks.restoreTrialProvenance.mock.lastCall?.[0].provenance.sidebar.resetToInitialState).toBe(true);
});

test('navigation waits for the pending save before restoring the destination and releasing its lock', async () => {
  mocks.identifier = 'other_1';
  mocks.state.globalStoreSubmitting = true;
  mocks.state.globalStorePendingIdentifier = 'trial_0';
  mocks.state.globalStorePendingRevision = 0;
  mocks.state.globalStoreRevision = 0;
  const view = mount();
  expect(screen.getByLabelText('Finishing response save')).not.toBeNull();
  expect(screen.queryByTestId('stimulus')).toBeNull();
  expect(mocks.dispatch).not.toHaveBeenCalled();
  mocks.state.globalStoreRevision = 1;
  view.rerender(<MantineProvider forceColorScheme="light"><TrialProvenanceBoundary><Stimulus /></TrialProvenanceBoundary></MantineProvider>);
  await waitFor(() => expect(screen.getByTestId('stimulus')).not.toBeNull());
  expect(mocks.setGlobalStoreSubmitting).toHaveBeenCalledWith(false);
});

test('returning to the submitting trial does not restore it before the pending save finishes', async () => {
  const view = mount();
  await waitFor(() => expect(screen.getByTestId('stimulus')).toBeTruthy());
  mocks.state.globalStoreSubmitting = true;
  mocks.state.globalStorePendingIdentifier = 'trial_0';
  mocks.state.globalStorePendingRevision = 0;
  mocks.state.globalStoreRevision = 0;
  const draw = () => view.rerender(<MantineProvider forceColorScheme="light"><TrialProvenanceBoundary><Stimulus /></TrialProvenanceBoundary></MantineProvider>);
  draw();
  expect(screen.getByTestId('stimulus')).toBeTruthy();
  mocks.identifier = 'other_1';
  draw();
  mocks.identifier = 'trial_0';
  draw();
  expect(screen.getByLabelText('Finishing response save')).toBeTruthy();
  expect(screen.queryByTestId('stimulus')).toBeNull();
  mocks.state.globalStoreRevision = 1;
  draw();
  await waitFor(() => expect(screen.getByTestId('stimulus')).toBeTruthy());
});
