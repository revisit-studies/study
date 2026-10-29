import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { initializeTrrack, Registry } from '@trrack/core';
import { MantineProvider } from '@mantine/core';
import { Provider } from 'react-redux';
import {
  act, cleanup, fireEvent, render, screen, waitFor,
} from '@testing-library/react';
import {
  afterEach, beforeEach, expect, test, vi,
} from 'vitest';
import { IframeController } from '../IframeController';
import { ResponseBlock } from '../../components/response/ResponseBlock';
import { TrialProvenanceBoundary } from '../../store/hooks/useTrialProvenance';
import { WindowEventsContext } from '../../store/hooks/useWindowEvents';
import { studyStoreCreator, StudyStoreContext } from '../../store/store';
import { makeStudyConfig, makeStoredAnswer } from '../../tests/utils';
import type { WebsiteComponent } from '../../parser/types';
import type { Sequence, StoredProvenance } from '../../store/types';

const { getProvenance, preview } = vi.hoisted(() => ({ getProvenance: vi.fn(), preview: { enabled: false } }));
vi.mock('../../store/hooks/useDesignerPreview', () => ({ useDesignerPreview: () => preview.enabled }));
const storageEngine = { getProvenance };
vi.mock('../../utils/getStaticAsset', () => ({ getStaticAssetByPath: vi.fn().mockResolvedValue('<html></html>') }));
vi.mock('../../storage/storageEngineHooks', () => ({ useStorageEngine: () => ({ storageEngine }) }));
vi.mock('../../store/hooks/useIsAnalysis', () => ({ useIsAnalysis: () => false }));
vi.mock('../../routes/utils', () => ({
  useCurrentIdentifier: () => 'trial_0',
  useCurrentComponent: () => 'trial',
  useCurrentStep: () => 0,
  useStudyId: () => 'test-study',
}));
vi.mock('react-router', () => ({ useParams: () => ({}), useNavigate: () => vi.fn(), useSearchParams: () => [new URLSearchParams()] }));
vi.mock('../../components/NextButton', () => ({ NextButton: () => null }));

beforeEach(() => {
  preview.enabled = false;
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const component: WebsiteComponent = {
  type: 'website',
  path: 'trial.html',
  response: [
    {
      id: 'controller', type: 'reactive', prompt: 'Show details?', location: 'sidebar',
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

async function restore(provenance: Partial<StoredProvenance>, answer = { controller: 'yes', dependent: 'University' }, config: WebsiteComponent = component) {
  getProvenance.mockResolvedValue(provenance);
  const status = makeStoredAnswer({
    identifier: 'trial_0', componentName: 'trial', startTime: 10, endTime: 20, answer,
  });
  const studyStore = await studyStoreCreator(
    'test-study',
    makeStudyConfig({ components: { trial: config, review: { type: 'questionnaire', previousButton: true, response: [] } } }),
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
              <IframeController currentConfig={config} answers={{ trial_0: status }} />
              <ResponseBlock config={config} location="sidebar" status={status} />
              <ResponseBlock config={config} location="belowStimulus" status={status} />
            </TrialProvenanceBoundary>
          </WindowEventsContext.Provider>
        </MantineProvider>
      </StudyStoreContext.Provider>
    </Provider>,
  );
  await screen.findByText('yes');
  return studyStore;
}

function connectWebsite(iframe: HTMLIFrameElement) {
  const listeners: Record<string, (event: unknown) => void> = {};
  const frameId = new URL(iframe.src).searchParams.get('id');
  const parent = { postMessage: (data: unknown) => window.dispatchEvent(new MessageEvent('message', { source: iframe.contentWindow, data })) };
  const helperWindow = { parent, location: { search: `?id=${frameId}` }, addEventListener: (tag: string, fn: (event: unknown) => void) => { listeners[tag] = fn; } };
  vi.spyOn(iframe.contentWindow!, 'postMessage').mockImplementation((data: unknown) => { listeners.message?.({ source: parent, data }); });
  runInNewContext(readFileSync('public/revisitUtilities/revisit-communicate.js', 'utf8'), {
    window: helperWindow, URLSearchParams, structuredClone, crypto: { randomUUID: () => 'document' }, Date, console,
  });
  const api = (helperWindow as unknown as { Revisit: {
    beginRegistration: () => void;
    postAnswers: (values: unknown) => void;
    onDataReceive: (callback: (data: unknown) => void) => void;
    onRestore: (cb: (state: { answers: { controller: string } }) => void) => void;
    completeRegistration: () => void;
  } }).Revisit;
  return { api, listeners };
}

test('late website restoration preserves dependent answers and history across asynchronous initialization', async () => {
  const sidebar = formGraph({ controller: 'yes' });
  const belowStimulus = formGraph({ dependent: 'University' });
  const store = await restore({ sidebar, belowStimulus });
  const iframe = document.querySelector('iframe')!;
  fireEvent.load(iframe);
  await waitFor(() => expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('University'));
  const { api, listeners } = connectWebsite(iframe);
  // Opt in before an asynchronous editor can publish its default, including after load.
  act(() => {
    api.beginRegistration();
    listeners.load?.({});
    api.postAnswers({ controller: 'no' });
  });
  await act(async () => { await Promise.resolve(); });
  expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('University');
  // Register as documented after the editor/listeners are ready, and apply the saved answer.
  await act(async () => {
    api.onRestore(({ answers }) => api.postAnswers({ controller: answers.controller }));
    api.completeRegistration();
  });
  await waitFor(() => expect(screen.getByRole('textbox')).toBeTruthy());
  expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('University');
  expect(store.store.getState().trialValidation.trial_0.provenanceGraph.belowStimulus).toEqual(belowStimulus);
});

test('delivers configured parameters to a handler registered after asynchronous setup', async () => {
  await restore({}, undefined, { ...component, parameters: { taskId: 'configured-task' } });
  const iframe = document.querySelector('iframe')!;
  fireEvent.load(iframe);
  const { api, listeners } = connectWebsite(iframe);
  act(() => { api.beginRegistration(); listeners.load?.({}); });
  await act(async () => { await Promise.resolve(); });
  const receive = vi.fn();
  await act(async () => {
    api.onDataReceive(receive);
    api.onRestore(() => {});
    api.completeRegistration();
  });
  expect(receive).toHaveBeenCalledWith({ taskId: 'configured-task' });
});

test('warns in Preview when a website has saved reactive answers and reports unsupported restoration', async () => {
  preview.enabled = true;
  await restore({});
  const iframe = document.querySelector('iframe')!;
  fireEvent.load(iframe);
  const messages = vi.spyOn(iframe.contentWindow!, 'postMessage');
  const iframeId = new URL(iframe.src).searchParams.get('id');
  const send = (type: string, message: unknown) => act(() => {
    window.dispatchEvent(new MessageEvent('message', {
      source: iframe.contentWindow,
      data: { type: `@REVISIT_COMMS/${type}`, iframeId, message },
    }));
  });
  send('WINDOW_READY', { protocolVersion: 1, documentId: 'document' });
  const resume = messages.mock.calls.map(([data]) => data).find((data) => data.type === '@REVISIT_COMMS/RESUME');
  send('RESTORATION_CAPABILITY', { protocolVersion: 1, requestId: resume.message.requestId, supported: false });
  expect(screen.getByRole('alert').textContent).toContain('has not registered state restoration');
});
