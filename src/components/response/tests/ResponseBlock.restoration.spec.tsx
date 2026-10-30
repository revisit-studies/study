import { initializeTrrack, Registry } from '@trrack/core';
import { MantineProvider } from '@mantine/core';
import { Provider } from 'react-redux';
import {
  cleanup, render, screen, waitFor,
} from '@testing-library/react';
import {
  afterEach, beforeEach, expect, test, vi,
} from 'vitest';
import { ResponseBlock } from '../ResponseBlock';
import { TrialProvenanceBoundary } from '../../../store/hooks/useTrialProvenance';
import { WindowEventsContext } from '../../../store/hooks/useWindowEvents';
import { studyStoreCreator, StudyStoreContext } from '../../../store/store';
import { makeStudyConfig, makeStoredAnswer } from '../../../tests/utils';
import type { IndividualComponent } from '../../../parser/types';
import type { Sequence, StoredProvenance } from '../../../store/types';

const { getProvenance } = vi.hoisted(() => ({ getProvenance: vi.fn() }));
const storageEngine = { getProvenance };
vi.mock('../../../storage/storageEngineHooks', () => ({ useStorageEngine: () => ({ storageEngine }) }));
vi.mock('../../../store/hooks/useIsAnalysis', () => ({ useIsAnalysis: () => false }));
vi.mock('../../../routes/utils', () => ({
  useCurrentIdentifier: () => 'trial_0',
  useCurrentComponent: () => 'trial',
  useCurrentStep: () => 0,
  useStudyId: () => 'test-study',
}));
vi.mock('react-router', () => ({ useParams: () => ({}), useNavigate: () => vi.fn(), useSearchParams: () => [new URLSearchParams()] }));
vi.mock('../../NextButton', () => ({ NextButton: () => null }));

beforeEach(() => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
});
afterEach(cleanup);

const component: IndividualComponent = {
  type: 'questionnaire',
  response: [
    {
      id: 'controller', type: 'radio', prompt: 'Show details?', options: ['yes', 'no'], location: 'sidebar',
    },
    {
      id: 'dependent',
      type: 'shortText',
      prompt: 'Details',
      visibleIf: { responseId: 'controller', comparison: 'equals', value: 'yes' },
    },
  ],
};
const sequence: Sequence = {
  id: 'root', orderPath: 'root', order: 'fixed', components: ['trial', 'review'], skip: [],
};
const formGraph = (form: Record<string, string>) => initializeTrrack({ registry: Registry.create(), initialState: { form, showResponseErrors: false, interactionSource: 'click' } }).graph.backend;

async function restore(provenance: Partial<StoredProvenance>, answer = { controller: 'yes', dependent: 'University' }) {
  getProvenance.mockResolvedValue(provenance);
  const status = makeStoredAnswer({
    identifier: 'trial_0', componentName: 'trial', startTime: 10, endTime: 20, answer,
  });
  const studyStore = await studyStoreCreator(
    'test-study',
    makeStudyConfig({ components: { trial: component, review: { type: 'questionnaire', previousButton: true, response: [] } } }),
    sequence,
    {
      userAgent: 'test', resolution: { width: 1000, height: 800 }, language: 'en', ip: null,
    },
    { trial_0: status },
    { dataCollectionEnabled: true, developmentModeEnabled: false, dataSharingEnabled: false },
    'participant',
    false,
    false,
  );
  render(
    <Provider store={studyStore.store}>
      <StudyStoreContext.Provider value={studyStore}>
        <MantineProvider>
          <WindowEventsContext.Provider value={{ current: [] }}>
            <TrialProvenanceBoundary>
              <ResponseBlock config={component} location="sidebar" status={status} />
              <ResponseBlock config={component} location="belowStimulus" status={status} />
            </TrialProvenanceBoundary>
          </WindowEventsContext.Provider>
        </MantineProvider>
      </StudyStoreContext.Provider>
    </Provider>,
  );
  await screen.findByRole('radio', { name: 'yes' });
  return studyStore;
}

test('restores conditional answers across response locations without changing either graph', async () => {
  const sidebar = formGraph({ controller: 'yes' });
  const belowStimulus = formGraph({ dependent: 'University' });
  const store = await restore({ sidebar, belowStimulus });
  await waitFor(() => expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('University'));
  expect(store.store.getState().trialValidation.trial_0.provenanceGraph).toMatchObject({ sidebar, belowStimulus });
});

test('retained controller state overrides older saved answers before conditional answers mount', async () => {
  const store = await restore({ sidebar: formGraph({ controller: 'yes' }), belowStimulus: formGraph({ dependent: 'University' }) }, { controller: 'no', dependent: '' });
  await waitFor(() => expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('University'));
  expect(store.store.getState().trialValidation.trial_0.sidebar.values).toEqual({ controller: 'yes' });
});

test('an empty retained form does not resurrect older conditional answers', async () => {
  const sidebar = formGraph({ controller: 'no' });
  const belowStimulus = formGraph({});
  const store = await restore({ sidebar, belowStimulus });
  expect(screen.queryByRole('textbox')).toBeNull();
  expect(store.store.getState().trialValidation.trial_0.belowStimulus.values).toEqual({});
  expect(store.store.getState().trialValidation.trial_0.provenanceGraph).toMatchObject({ sidebar, belowStimulus });
});

test('a legacy controller answer restores without adding interactions to the dependent graph', async () => {
  const belowStimulus = formGraph({ dependent: 'University' });
  const store = await restore({ belowStimulus });
  await waitFor(() => expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('University'));
  expect(store.store.getState().trialValidation.trial_0.belowStimulus.values).toEqual({ dependent: 'University' });
  expect(store.store.getState().trialValidation.trial_0.provenanceGraph.belowStimulus).toEqual(belowStimulus);
});
