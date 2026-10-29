import { StrictMode } from 'react';
import {
  act, cleanup, render, waitFor,
} from '@testing-library/react';
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import { GlobalConfigParser } from '../GlobalConfigParser';
import { AppThemeProvider } from '../components/AppThemeProvider';
import { StorageEngineProvider } from '../storage/storageEngineHooks';
import { initializeStorageEngine, selectStudyStorageEngine } from '../storage/initialize';
import { parseGlobalConfig } from '../parser/parser';
import { getStudyConfig } from '../utils/fetchConfig';
import { getStaticAssetByPath } from '../utils/getStaticAsset';
import { encryptIndex } from '../utils/encryptDecryptIndex';
import {
  makeGlobalConfig, makeStorageEngine, makeStoredAnswer, makeStudyConfig,
} from './utils';
import type { ParsedConfig, StudyConfig } from '../parser/types';
import type { Sequence } from '../store/types';

vi.hoisted(() => {
  window.matchMedia = vi.fn(() => ({
    matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
});

vi.mock('react-vega', () => ({ Vega: () => null }));
vi.mock('vega-embed', () => ({ default: vi.fn() }));
vi.mock('../analysis/individualStudy/StudyAnalysisTabs', () => ({ StudyAnalysisTabs: () => null }));
vi.mock('../components/ConfigSwitcher', () => ({ ConfigSwitcher: () => null }));

vi.mock('../storage/initialize', () => ({
  initializeStorageEngine: vi.fn(),
  selectStudyStorageEngine: vi.fn(),
}));

vi.mock('../parser/parser', () => ({ parseGlobalConfig: vi.fn(), parseStudyConfig: vi.fn() }));
vi.mock('../utils/fetchConfig', () => ({
  getStudyConfig: vi.fn(),
  fetchStudyConfigs: vi.fn(),
  resolveConfigKey: (id: string) => (id === 'test-study' ? id : null),
}));
vi.mock('../utils/getStaticAsset', () => ({ getStaticAssetByPath: vi.fn(), getJsonAssetByPath: vi.fn() }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  return { promise: new Promise<T>((res) => { resolve = res; }), resolve };
}

const config: ParsedConfig<StudyConfig> = {
  ...makeStudyConfig({
    uiConfig: { withSidebar: true },
    components: {
      intro: {
        type: 'markdown', path: 'intro.md', instruction: 'Sidebar instructions', response: [],
      },
    },
    sequence: { order: 'fixed', components: ['intro'] },
  }),
  errors: [],
  warnings: [],
};
const sequence: Sequence = {
  order: 'fixed', orderPath: 'root', components: ['intro', 'end'], skip: [],
};

function mountStudy() {
  return render(
    <StrictMode>
      <AppThemeProvider>
        <StorageEngineProvider><GlobalConfigParser /></StorageEngineProvider>
      </AppThemeProvider>
    </StrictMode>,
  );
}

describe('config-first study startup', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    })));
    vi.stubGlobal('ResizeObserver', class {
      observe() { /* No layout observation in jsdom. */ }

      unobserve() { /* No layout observation in jsdom. */ }

      disconnect() { /* No layout observation in jsdom. */ }
    });
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}')));
    window.history.replaceState(null, '', '/test-study');
    vi.mocked(parseGlobalConfig).mockResolvedValue(makeGlobalConfig({
      configsList: ['test-study'], configs: { 'test-study': { path: 'test-study/config.json' } },
    }));
    vi.mocked(getStudyConfig).mockResolvedValue(config);
    vi.mocked(getStaticAssetByPath).mockResolvedValue('# First stimulus');
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    window.history.replaceState(null, '', '/');
  });

  test('loads the real first stimulus and sidebar before connection and storage selection finish', async () => {
    const connection = deferred<ReturnType<typeof makeStorageEngine>>();
    const selection = deferred<ReturnType<typeof makeStorageEngine>>();
    const initialization = deferred<void>();
    const engine = makeStorageEngine({
      initializeStudyDb: vi.fn(() => initialization.promise),
    });
    vi.mocked(initializeStorageEngine).mockReturnValue(connection.promise);
    vi.mocked(selectStudyStorageEngine).mockReturnValue(selection.promise);
    vi.mocked(getStudyConfig).mockResolvedValue({
      ...config,
      components: {
        intro: {
          type: 'markdown',
          path: 'intro.md',
          instruction: 'Sidebar instructions',
          response: [{
            id: 'choice', type: 'buttons', prompt: 'Choose', options: [{ label: 'Alpha', value: 'a', key: 'a' }],
          }],
        },
      },
    });
    const view = mountStudy();

    await waitFor(() => expect(view.getByRole('heading', { name: 'First stimulus', hidden: true })).toBeDefined());
    expect(view.getByText('Sidebar instructions')).toBeDefined();
    const option = view.getByRole('radio', { name: /Alpha/, hidden: true });
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    });
    expect(option.getAttribute('aria-checked')).toBe('false');
    expect(view.getByTestId('study-interface').hasAttribute('inert')).toBe(true);
    expect(engine.initializeStudyDb).not.toHaveBeenCalled();
    await act(async () => connection.resolve(engine));
    await waitFor(() => expect(selectStudyStorageEngine).toHaveBeenCalled());
    expect(engine.initializeStudyDb).not.toHaveBeenCalled();
    expect(view.getByTestId('study-interface').hasAttribute('inert')).toBe(true);
    await act(async () => selection.resolve(engine));
    await waitFor(() => expect(engine.initializeStudyDb).toHaveBeenCalledTimes(1));
    expect(view.getByTestId('study-interface').hasAttribute('inert')).toBe(true);
  });

  test('ignores an old initialization while storage is being selected for a changed URL', async () => {
    const initialization = deferred<void>();
    const reselection = deferred<ReturnType<typeof makeStorageEngine>>();
    const engine = makeStorageEngine({
      initializeStudyDb: vi.fn(() => initialization.promise),
      saveConfig: vi.fn().mockResolvedValue(undefined),
    });
    vi.mocked(initializeStorageEngine).mockResolvedValue(engine);
    vi.mocked(selectStudyStorageEngine).mockResolvedValue(engine);
    const view = mountStudy();
    await waitFor(() => expect(engine.initializeStudyDb).toHaveBeenCalledTimes(1));
    const selections = vi.mocked(selectStudyStorageEngine).mock.calls.length;
    vi.mocked(selectStudyStorageEngine).mockReturnValue(reselection.promise);
    await act(async () => {
      window.history.pushState(null, '', '/test-study?source=changed');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await waitFor(() => expect(selectStudyStorageEngine).toHaveBeenCalledTimes(selections + 1));
    await act(async () => initialization.resolve());
    expect(engine.saveConfig).not.toHaveBeenCalled();
    expect(view.getByTestId('study-interface').hasAttribute('inert')).toBe(true);
  });

  test('does not republish participant progress while storage is being reselected', async () => {
    const currentConfig = { ...config, sequence: { order: 'fixed' as const, components: ['intro', 'intro'] } };
    const participantSequence = { ...sequence, components: ['intro', 'intro', 'end'] };
    const reselection = deferred<ReturnType<typeof makeStorageEngine>>();
    const engine = makeStorageEngine({
      saveConfig: vi.fn().mockResolvedValue(undefined),
      getOrCreateSequenceArray: vi.fn().mockResolvedValue([participantSequence]),
      getModes: vi.fn().mockResolvedValue({ developmentModeEnabled: false, dataSharingEnabled: false, dataCollectionEnabled: true }),
      initializeParticipantSession: vi.fn().mockResolvedValue({
        participantId: 'p1',
        participantConfigHash: 'saved',
        sequence: participantSequence,
        metadata: {
          language: 'en', userAgent: 'test', resolution: {}, ip: '',
        },
        answers: {
          intro_0: makeStoredAnswer({
            identifier: 'intro_0', componentName: 'intro', trialOrder: '0', endTime: 100,
          }),
          intro_1: makeStoredAnswer({
            identifier: 'intro_1', componentName: 'intro', trialOrder: '1', endTime: -1,
          }),
        },
      }),
      getAllConfigsFromHash: vi.fn().mockResolvedValue({ saved: currentConfig }),
      getParticipantCompletionStatus: vi.fn().mockResolvedValue(false),
      updateProgressData: vi.fn().mockResolvedValue(undefined),
    });
    vi.mocked(getStudyConfig).mockResolvedValue(currentConfig);
    vi.mocked(initializeStorageEngine).mockResolvedValue(engine);
    vi.mocked(selectStudyStorageEngine).mockResolvedValue(engine);
    const path = `/test-study/${encryptIndex(1)}`;
    window.history.replaceState(null, '', path);
    const view = mountStudy();
    await waitFor(() => expect(view.queryByTestId('study-loading-barrier')).toBeNull());
    await waitFor(() => expect(engine.updateProgressData).toHaveBeenCalledTimes(1));
    const selections = vi.mocked(selectStudyStorageEngine).mock.calls.length;
    vi.mocked(selectStudyStorageEngine).mockReturnValue(reselection.promise);
    await act(async () => {
      window.history.pushState(null, '', `${path}?source=changed`);
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await waitFor(() => expect(selectStudyStorageEngine).toHaveBeenCalledTimes(selections + 1));
    expect(view.getByTestId('study-interface').hasAttribute('inert')).toBe(true);
    expect(engine.updateProgressData).toHaveBeenCalledTimes(1);
  });

  test.each(['older-config', 'dynamic', 'invalid-dynamic'])('keeps the startup layout for a %s deep link, then validates restored state', async (kind) => {
    const participant = deferred<Awaited<ReturnType<ReturnType<typeof makeStorageEngine>['initializeParticipantSession']>>>();
    const engine = makeStorageEngine({
      saveConfig: vi.fn().mockResolvedValue(undefined),
      getOrCreateSequenceArray: vi.fn().mockResolvedValue([sequence]),
      getModes: vi.fn().mockResolvedValue({ developmentModeEnabled: false, dataSharingEnabled: false, dataCollectionEnabled: false }),
      initializeParticipantSession: vi.fn(() => participant.promise),
    });
    const dynamic = kind !== 'older-config';
    const restoredConfig = dynamic ? {
      ...config,
      sequence: { order: 'fixed' as const, components: [{ id: 'adaptive', order: 'dynamic' as const, functionPath: 'unused.ts' }] },
    } : config;
    const restoredSequence: Sequence = dynamic
      ? { ...sequence, components: ['adaptive', 'end'] }
      : { ...sequence, components: ['intro', 'intro', 'intro', 'end'] };
    const identifier = dynamic ? 'adaptive_0_intro_1' : 'intro_2';
    engine.getAllConfigsFromHash = vi.fn().mockResolvedValue({ saved: restoredConfig });
    vi.mocked(initializeStorageEngine).mockResolvedValue(engine);
    vi.mocked(selectStudyStorageEngine).mockResolvedValue(engine);
    window.history.replaceState(null, '', `/test-study/${encryptIndex(dynamic ? 0 : 2)}${dynamic ? `/${encryptIndex(kind === 'invalid-dynamic' ? 999 : 1)}` : ''}`);
    const view = mountStudy();
    await waitFor(() => expect(engine.initializeParticipantSession).toHaveBeenCalled());
    expect(view.container.querySelector('.mantine-AppShell-root')).not.toBeNull();
    expect(view.getByTestId('study-interface').hasAttribute('inert')).toBe(true);
    expect(view.queryByText('404')).toBeNull();
    await act(async () => participant.resolve({
      participantId: 'p1',
      participantConfigHash: 'saved',
      sequence: restoredSequence,
      metadata: {
        language: 'en', userAgent: 'test', resolution: {}, ip: '',
      },
      answers: {
        [identifier]: makeStoredAnswer({
          identifier, componentName: 'intro', trialOrder: dynamic ? '0_1' : '2', endTime: -1,
        }),
      },
      searchParams: {},
      rejected: false,
      participantTags: [],
      stage: 'test',
      createdTime: 0,
      participantIndex: 0,
    }));
    await waitFor(() => expect(view.queryByTestId('study-loading-barrier')).toBeNull());
    if (kind === 'invalid-dynamic') {
      expect(view.getByText('404')).toBeDefined();
      expect(view.container.querySelector('.mantine-AppShell-root')).toBeNull();
    } else {
      await waitFor(() => expect(view.getByRole('heading', { name: 'First stimulus' })).toBeDefined());
    }
  });
});
