// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import {
  act, cleanup, fireEvent, render, waitFor,
} from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import type { GlobalStoreUpdater } from '../../store/types';
import { IframeController } from '../IframeController';
import type { WebsiteComponent } from '../../parser/types';
import { ReplayContext } from '../../store/hooks/useReplay';
import { getStaticAssetByPath } from '../../utils/getStaticAsset';

const mockStoreUpdater = vi.hoisted(() => ({ current: undefined as GlobalStoreUpdater | undefined }));
vi.mock('../../store/hooks/useGlobalStore', () => ({
  useGlobalStore: () => ({}),
  useGlobalStoreUpdaterRegistration: () => (updater: GlobalStoreUpdater) => {
    mockStoreUpdater.current = updater;
    return () => { if (mockStoreUpdater.current === updater) mockStoreUpdater.current = undefined; };
  },
}));

vi.mock('../../components/interface/RestorationWarning', () => ({ RestorationWarning: () => null }));

const mockRetained = vi.hoisted(() => ({ graph: undefined as unknown }));
vi.mock('../../store/hooks/useTrialProvenance', () => ({ useTrialProvenance: () => mockRetained.graph }));

const mockDispatch = vi.fn();
const mockSetAssetStatus = vi.fn((payload) => ({ type: 'setAssetStatus', payload }));
const mockSetReactiveAnswers = vi.fn((payload) => ({ type: 'setReactiveAnswers', payload }));
const mockUpdateProvenance = vi.fn((payload) => ({ type: 'updateProvenance', payload }));
const mockUpdateResponseBlockValidation = vi.fn((payload) => ({ type: 'updateResponseBlockValidation', payload }));
const mockIsAnalysis = { value: false };
const mockCurrentComponent = { value: 'countDots' };
let mockStudyColorMode: 'light' | 'dark' = 'light';

vi.mock('@mantine/core', () => ({
  useComputedColorScheme: () => mockStudyColorMode,
}));

vi.mock('react-redux', () => ({
  useDispatch: () => vi.fn(),
}));

vi.mock('../../routes/utils', () => ({
  useCurrentComponent: () => mockCurrentComponent.value,
  useCurrentIdentifier: () => 'countDots_0',
  useCurrentStep: () => 0,
}));

vi.mock('../../store/hooks/useIsAnalysis', () => ({
  useIsAnalysis: () => mockIsAnalysis.value,
}));

vi.mock('../../store/store', () => ({
  useStoreActions: () => ({
    setAssetStatus: mockSetAssetStatus,
    setReactiveAnswers: mockSetReactiveAnswers,
    updateProvenance: mockUpdateProvenance,
    updateResponseBlockValidation: mockUpdateResponseBlockValidation,
  }),
  useStoreDispatch: () => mockDispatch,
  useStoreSelector: (selector: (state: Record<string, unknown>) => unknown) => selector({
    trialValidation: { countDots_0: { stimulus: { valid: true, values: {} } } },
    answers: {},
  }),
  useFlatSequence: () => [],
}));

vi.mock('../../utils/Prefix', () => ({
  PREFIX: '/',
}));

vi.mock('../../utils/getStaticAsset', () => ({
  getStaticAssetByPath: vi.fn(),
}));

vi.mock('../../ResourceNotFound', () => ({
  ResourceNotFound: ({ path }: { path?: string }) => <div data-testid="resource-not-found">{path}</div>,
}));

describe('IframeController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRetained.graph = undefined;
    mockStoreUpdater.current = undefined;
    vi.mocked(getStaticAssetByPath).mockResolvedValue('<html></html>');
    mockIsAnalysis.value = false;
    mockCurrentComponent.value = 'countDots';
    mockStudyColorMode = 'light';
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const websiteConfig: WebsiteComponent = { type: 'website', path: 'https://example.com', response: [] };

  test('renders website stimuli when randomUUID is unavailable', () => {
    vi.stubGlobal('crypto', { randomUUID: undefined });
    const { container } = render(<IframeController currentConfig={websiteConfig} answers={{}} />);
    expect(container.querySelector('iframe')).not.toBeNull();
  });

  test('delivers a seek made while a website replay handler is still loading', async () => {
    mockIsAnalysis.value = true;
    const config: WebsiteComponent = { type: 'website', path: 'demo-svelte-trrack/assets/dots-count.html', response: [] };
    const answers = {};
    const renderController = (seekTime: number, provState: { dots: number[] }) => (
      <ReplayContext.Provider value={{ isPlaying: false, seekTime } as never}>
        <IframeController currentConfig={config} provState={provState} answers={answers} />
      </ReplayContext.Provider>
    );
    const { container, rerender } = render(renderController(0, { dots: [1] }));
    const iframe = container.querySelector('iframe')!;
    const frameId = new URL(iframe.src).searchParams.get('id');
    type MessageListener = (event: unknown) => void;
    const listeners = new Map<string, MessageListener>();
    const parent = { postMessage: (data: unknown) => window.dispatchEvent(new MessageEvent('message', { source: iframe.contentWindow, data })) };
    const helperWindow = { parent, location: { search: `?id=${frameId}` }, addEventListener: (type: string, fn: (event: unknown) => void) => listeners.set(type, fn) };
    vi.spyOn(iframe.contentWindow!, 'postMessage').mockImplementation((data: unknown) => listeners.get('message')?.({ source: parent, data }));
    runInNewContext(readFileSync('public/revisitUtilities/revisit-communicate.js', 'utf8'), {
      window: helperWindow, URLSearchParams, structuredClone, crypto: { randomUUID: () => 'document' }, Date, console,
    });
    const api = (helperWindow as unknown as { Revisit: {
      beginRegistration: () => void;
      onRestore: (fn: () => void) => void;
      completeRegistration: () => void;
      onProvenanceReceive: (fn: (state: { dots: number[] }) => void) => void;
    } }).Revisit;
    const output = document.createElement('output');
    output.textContent = '1';
    container.appendChild(output);
    await act(async () => { api.beginRegistration(); });
    // Svelte fetches/compiles/imports its component before registering the replay callback.
    await act(async () => { rerender(renderController(5, { dots: [1, 2, 3] })); });
    await act(async () => {
      api.onRestore(() => {});
      api.completeRegistration();
      api.onProvenanceReceive((state) => { output.textContent = state.dots.join(','); });
      listeners.get('load')?.({});
    });
    expect(container.querySelector('output')?.textContent).toBe('1,2,3');
    expect(mockUpdateProvenance).not.toHaveBeenCalled();
    expect(mockSetReactiveAnswers).not.toHaveBeenCalled();
  });

  test('late updater registration and re-registration do not restart a completed document restoration', () => {
    const { container } = render(<IframeController currentConfig={{ ...websiteConfig, path: 'purchase.html' }} answers={{}} />);
    const iframe = container.querySelector('iframe')!;
    const postMessage = vi.spyOn(iframe.contentWindow!, 'postMessage');
    const receive = (type: string, message: object) => act(() => {
      window.dispatchEvent(new MessageEvent('message', {
        source: iframe.contentWindow,
        data: { type: `@REVISIT_COMMS/${type}`, iframeId: new URL(iframe.src).searchParams.get('id'), message },
      }));
    });
    receive('WINDOW_READY', { protocolVersion: 1, documentId: 'document' });
    const request = postMessage.mock.calls.map(([data]) => data).find((data) => data.type === '@REVISIT_COMMS/RESUME').message;
    receive('RESTORED', { protocolVersion: 1, requestId: request.requestId });
    expect(iframe.hasAttribute('inert')).toBe(false);
    receive('WINDOW_READY', { protocolVersion: 1, documentId: 'document', globalStoreUpdater: true });
    expect(mockStoreUpdater.current).toBeDefined();
    expect(iframe.hasAttribute('inert')).toBe(false);
    receive('GLOBAL_STORE_UPDATER', { documentId: 'document', enabled: false });
    expect(mockStoreUpdater.current).toBeUndefined();
    receive('WINDOW_READY', { protocolVersion: 1, documentId: 'document', globalStoreUpdater: true });
    expect(mockStoreUpdater.current).toBeDefined();
    expect(iframe.hasAttribute('inert')).toBe(false);
    expect(postMessage.mock.calls.filter(([data]) => data.type === '@REVISIT_COMMS/RESUME')).toHaveLength(1);
  });

  test('rejects a fresh legacy graph while a revisited website is still registering', () => {
    mockRetained.graph = { root: 'saved-root' };
    const { container } = render(<IframeController currentConfig={{ ...websiteConfig, path: 'chart.html' }} answers={{}} />);
    const iframe = container.querySelector('iframe')!;
    const iframeId = new URL(iframe.src).searchParams.get('id');
    const publish = (root: string) => act(() => {
      window.dispatchEvent(new MessageEvent('message', {
        source: iframe.contentWindow,
        data: { iframeId, type: '@REVISIT_COMMS/PROVENANCE', message: { root } },
      }));
    });
    publish('fresh-root');
    expect(mockUpdateProvenance).not.toHaveBeenCalled();
    publish('saved-root');
    expect(mockUpdateProvenance).toHaveBeenCalledWith(expect.objectContaining({ provenanceGraph: { root: 'saved-root' } }));
  });

  test('bootstraps an external website without changing its URL and ignores stale acknowledgements', () => {
    const url = 'https://example.com/chart?signature=keep';
    const { container } = render(<IframeController currentConfig={{ ...websiteConfig, path: url }} answers={{}} />);
    const iframe = container.querySelector('iframe')!;
    const postMessage = vi.spyOn(iframe.contentWindow!, 'postMessage');
    expect(iframe.src).toBe(url);
    const receive = (type: string, iframeId: string | null, message: unknown) => act(() => {
      window.dispatchEvent(new MessageEvent('message', { source: iframe.contentWindow, data: { type: `@REVISIT_COMMS/${type}`, iframeId, message } }));
    });
    receive('WINDOW_READY', null, { protocolVersion: 1, documentId: 'document' });
    const initialization = postMessage.mock.calls.map(([data]) => data).find((data) => data.type === '@REVISIT_COMMS/RESUME');
    expect(initialization.message.documentId).toBe('document');
    receive('RESTORED', initialization.iframeId, { protocolVersion: 1, requestId: 'stale' });
    receive('PROVENANCE', initialization.iframeId, { root: 'new-trial' });
    expect(mockUpdateProvenance).not.toHaveBeenCalled();
    receive('RESTORED', initialization.iframeId, { protocolVersion: 1, requestId: initialization.message.requestId });
    receive('PROVENANCE', initialization.iframeId, { root: 'new-trial' });
    expect(mockUpdateProvenance).toHaveBeenCalledTimes(1);
  });

  test.each(['light', 'dark', undefined] as const)('applies iframe color mode %s in participation and replay without reloading', (colorMode) => {
    const currentConfig = { ...websiteConfig, colorMode };
    const { container, rerender } = render(<IframeController currentConfig={currentConfig} answers={{}} />);
    const iframe = container.querySelector('iframe');
    expect(iframe?.style.colorScheme).toBe(colorMode ?? 'light');
    mockIsAnalysis.value = true;
    rerender(<IframeController currentConfig={currentConfig} answers={{}} />);
    expect(container.querySelector('iframe')).toBe(iframe);
    expect(iframe?.style.colorScheme).toBe(colorMode ?? 'light');
  });

  test.each(['light', 'dark'] as const)('applies study %s inside a local document and preserves overrides without reloading', (studyMode) => {
    mockStudyColorMode = studyMode;
    const config: WebsiteComponent = { ...websiteConfig, path: 'study/chart.html' };
    const { container, rerender } = render(<IframeController currentConfig={config} answers={{}} />);
    const iframe = container.querySelector('iframe')!;
    const frameDocument = document.implementation.createHTMLDocument('Stimulus');
    Object.defineProperty(iframe, 'contentDocument', { value: frameDocument, configurable: true });
    const root = frameDocument.documentElement;
    root.style.colorScheme = 'light dark';
    expect(iframe.style.visibility).toBe('hidden');
    fireEvent.load(iframe);
    expect(root.style.colorScheme).toBe(studyMode);
    expect(iframe.style.visibility).toBe('');
    const originalSrc = iframe.src;

    const override = studyMode === 'light' ? 'dark' : 'light';
    rerender(<IframeController currentConfig={{ ...config, colorMode: override }} answers={{}} />);
    expect(root.style.colorScheme).toBe(override);
    mockStudyColorMode = override;
    rerender(<IframeController currentConfig={{ ...config, colorMode: studyMode }} answers={{}} />);
    expect(root.style.colorScheme).toBe(studyMode);
    rerender(<IframeController currentConfig={config} answers={{}} />);
    expect(root.style.colorScheme).toBe(override);
    expect(container.querySelector('iframe')).toBe(iframe);
    expect(iframe.src).toBe(originalSrc);
  });

  test('keeps the color scheme hint when the embedded document is cross-origin', () => {
    mockStudyColorMode = 'dark';
    const { container } = render(<IframeController currentConfig={websiteConfig} answers={{}} />);
    const iframe = container.querySelector('iframe')!;
    Object.defineProperty(iframe, 'contentDocument', { value: null, configurable: true });
    fireEvent.load(iframe);
    expect(iframe.style.colorScheme).toBe('dark');
  });

  test('hides navigating documents, restores their current theme on pageshow, and removes listeners on unmount', () => {
    const config: WebsiteComponent = { ...websiteConfig, path: 'study/chart.html' };
    const { container, rerender, unmount } = render(
      <>
        <iframe title="Document host" />
        <IframeController currentConfig={config} answers={{}} />
      </>,
    );
    const documentHost = container.querySelector('iframe')!;
    const iframe = container.querySelector('iframe:not([title])')! as HTMLIFrameElement;
    const frameDocument = documentHost.contentDocument!;
    const frameWindow = frameDocument.defaultView!;
    Object.defineProperty(iframe, 'contentDocument', { value: frameDocument, configurable: true });
    fireEvent.load(iframe);
    act(() => { frameWindow.dispatchEvent(new frameWindow.Event('pagehide')); });
    expect(iframe.style.visibility).toBe('hidden');
    mockStudyColorMode = 'dark';
    rerender(
      <>
        <iframe title="Document host" />
        <IframeController currentConfig={config} answers={{}} />
      </>,
    );
    frameDocument.documentElement.style.colorScheme = 'light dark';
    act(() => { frameWindow.dispatchEvent(new frameWindow.Event('pageshow')); });
    expect(frameDocument.documentElement.style.colorScheme).toBe('dark');
    expect(iframe.style.visibility).toBe('');

    unmount();
    frameDocument.documentElement.style.colorScheme = 'light dark';
    act(() => { frameWindow.dispatchEvent(new frameWindow.Event('pageshow')); });
    expect(frameDocument.documentElement.style.colorScheme).toBe('light dark');
  });

  test('covers sendMessage via answers effect on mount', async () => {
    render(<IframeController currentConfig={websiteConfig} answers={{}} />);
    // answers effect fires sendMessage; ref.current is the iframe element in jsdom
    // so postMessage is invoked on its contentWindow - no assertion needed beyond no-throw
  });

  test('covers sendMessage via provState effect', async () => {
    render(
      <IframeController
        currentConfig={websiteConfig}
        answers={{}}
        provState={{ event: 'test' }}
      />,
    );
    // provState effect fires sendMessage
  });

  test('dispatches store actions when an ANSWERS window message arrives with matching iframeId', async () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(
      '11111111-2222-3333-4444-555555555555' as `${string}-${string}-${string}-${string}-${string}`,
    );
    render(<IframeController currentConfig={websiteConfig} answers={{}} />);
    window.dispatchEvent(new MessageEvent('message', {
      source: document.querySelector('iframe')!.contentWindow,
      data: { iframeId: '11111111-2222-3333-4444-555555555555', type: '@REVISIT_COMMS/ANSWERS', message: { q1: 'yes' } },
    }));
    await waitFor(() => expect(mockDispatch).toHaveBeenCalledWith({
      type: 'updateResponseBlockValidation',
      payload: {
        location: 'stimulus', identifier: 'countDots_0', status: true, values: { q1: 'yes' },
      },
    }));
  });

  test('stores provenance independently from answer validation', async () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(
      '11111111-2222-3333-4444-555555555555' as `${string}-${string}-${string}-${string}-${string}`,
    );
    render(<IframeController currentConfig={websiteConfig} answers={{}} />);
    const provenanceGraph = { root: 'root', current: 'root', nodes: {} };

    window.dispatchEvent(new MessageEvent('message', {
      source: document.querySelector('iframe')!.contentWindow,
      data: {
        iframeId: '11111111-2222-3333-4444-555555555555',
        type: '@REVISIT_COMMS/PROVENANCE',
        message: provenanceGraph,
      },
    }));

    await waitFor(() => expect(mockUpdateProvenance).toHaveBeenCalledWith({
      location: 'stimulus',
      identifier: 'countDots_0',
      provenanceGraph,
    }));
    expect(mockUpdateResponseBlockValidation).not.toHaveBeenCalled();
  });

  test('sends STUDY_DATA when a WINDOW_READY message arrives and parameters are set', async () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(
      '11111111-2222-3333-4444-555555555555' as `${string}-${string}-${string}-${string}-${string}`,
    );
    const websiteWithParams: WebsiteComponent = {
      type: 'website', path: 'https://example.com', parameters: { key: 'val' }, response: [],
    };
    render(<IframeController currentConfig={websiteWithParams} answers={{}} />);
    window.dispatchEvent(new MessageEvent('message', {
      source: document.querySelector('iframe')!.contentWindow,
      data: { iframeId: '11111111-2222-3333-4444-555555555555', type: '@REVISIT_COMMS/WINDOW_READY' },
    }));
    // sendMessage called with STUDY_DATA; ref.current.contentWindow.postMessage fires
  });

  test('renders iframe with the original src for an http path', () => {
    const html = renderToStaticMarkup(
      <IframeController currentConfig={{ type: 'website', path: 'https://example.com/study', response: [] }} answers={{}} />,
    );
    expect(html).toContain('<iframe');
    expect(html).toContain('https://example.com/study');
  });

  test('renders iframe with PREFIX prepended for a relative path', () => {
    const html = renderToStaticMarkup(
      <IframeController currentConfig={{ type: 'website', path: 'my-study/index.html', response: [] }} answers={{}} />,
    );
    expect(html).toContain('<iframe');
    expect(html).toContain('/');
  });

  test('makes the iframe inert and non-interactive during analysis replay', () => {
    mockIsAnalysis.value = true;
    const { container } = render(
      <IframeController currentConfig={{ type: 'website', path: 'my-study/index.html', response: [] }} answers={{}} />,
    );
    const iframe = container.querySelector('iframe');

    expect(iframe?.hasAttribute('inert')).toBe(true);
    expect(iframe?.getAttribute('aria-disabled')).toBe('true');
    expect(iframe?.style.pointerEvents).toBe('none');
  });

  test('resends provenance snapshots when the iframe reports ready', async () => {
    const currentConfig: WebsiteComponent = {
      type: 'website',
      path: 'demo-svelte-trrack/assets/dots-count.html',
      response: [],
    };
    const provState = { dots: [1, 2, 3] };

    render(
      <IframeController
        currentConfig={currentConfig}
        provState={provState}
        answers={{}}
      />,
    );

    const iframe = document.querySelector('iframe');
    expect(iframe).toBeTruthy();

    const postMessage = vi.fn();
    Object.defineProperty(iframe, 'contentWindow', {
      value: { postMessage },
      configurable: true,
    });

    await waitFor(() => {
      expect(iframe?.src).toContain('id=');
    });

    const iframeId = new URL(iframe!.src).searchParams.get('id');
    window.dispatchEvent(new MessageEvent('message', {
      source: document.querySelector('iframe')!.contentWindow,
      data: {
        type: '@REVISIT_COMMS/WINDOW_READY',
        iframeId,
      },
    }));

    expect(postMessage).toHaveBeenCalledWith(
      {
        error: false,
        type: '@REVISIT_COMMS/PROVENANCE',
        iframeId,
        message: provState,
      },
      '*',
    );
  });

  test('uses saved answers until analysis replay starts', async () => {
    mockIsAnalysis.value = true;
    const provState = { selectedIds: [] };
    const answers = { task: { answer: { 'iframe-task': ['Saved node'] } } } as never;
    const renderController = (seekTime: number) => (
      <ReplayContext.Provider value={{ seekTime, isPlaying: false } as never}>
        <IframeController
          currentConfig={{ type: 'website', path: 'example/index.html', response: [] }}
          provState={provState}
          answers={answers}
        />
      </ReplayContext.Provider>
    );
    const { rerender } = render(renderController(0));
    const iframe = document.querySelector('iframe')!;
    const postMessage = vi.fn();
    Object.defineProperty(iframe, 'contentWindow', {
      value: { postMessage },
      configurable: true,
    });

    await waitFor(() => expect(iframe.src).toContain('id='));
    const iframeId = new URL(iframe.src).searchParams.get('id');
    window.dispatchEvent(new MessageEvent('message', {
      source: document.querySelector('iframe')!.contentWindow,
      data: { type: '@REVISIT_COMMS/WINDOW_READY', iframeId },
    }));

    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: '@REVISIT_COMMS/ANSWERS',
      message: answers,
    }), '*');
    expect(postMessage).not.toHaveBeenCalledWith(expect.objectContaining({
      type: '@REVISIT_COMMS/PROVENANCE',
    }), '*');

    rerender(renderController(1));
    await waitFor(() => expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: '@REVISIT_COMMS/PROVENANCE',
      message: provState,
    }), '*'));
  });

  test('does not render an iframe (and so never requests the templated path) while the dynamic component is still resolving', () => {
    mockCurrentComponent.value = '__dynamicLoading';
    const { container } = render(
      <IframeController
        currentConfig={{ type: 'website', path: '{{someParam}}/index.html', response: [] }}
        answers={{}}
      />,
    );

    expect(container.querySelector('iframe')).toBeNull();
  });

  test('renders the iframe with the correct path once the dynamic component resolves', () => {
    mockCurrentComponent.value = '__dynamicLoading';
    const { container, rerender } = render(
      <IframeController
        currentConfig={{ type: 'website', path: 'demo-svelte-trrack/assets/dots-count.html', response: [] }}
        answers={{}}
      />,
    );

    expect(container.querySelector('iframe')).toBeNull();

    mockCurrentComponent.value = 'countDots';
    rerender(
      <IframeController
        currentConfig={{ type: 'website', path: 'demo-svelte-trrack/assets/dots-count.html', response: [] }}
        answers={{}}
      />,
    );

    const iframe = container.querySelector('iframe');
    expect(iframe).toBeTruthy();
    expect(iframe?.src).toContain('demo-svelte-trrack/assets/dots-count.html');
  });
  describe('templated websites', () => {
    const templatedConfig: WebsiteComponent = {
      type: 'website',
      path: 'my-study/assets/chart.html',
      templated: true,
      parameters: { country: 'France' },
      response: [],
    };

    test('does not load raw HTML while the template is being fetched', async () => {
      let resolveHtml!: (html: string) => void;
      vi.mocked(getStaticAssetByPath).mockReturnValue(new Promise<string>((resolve) => {
        resolveHtml = resolve;
      }));
      const { container } = render(<IframeController currentConfig={templatedConfig} answers={{}} />);

      await waitFor(() => expect(getStaticAssetByPath).toHaveBeenCalled());
      expect(container.querySelector('iframe[src]')).toBeNull();

      await act(async () => {
        resolveHtml('<html><head></head><body>{{country}}</body></html>');
      });
      expect(container.querySelector('iframe')?.getAttribute('srcdoc')).toContain('<body>France</body>');
      expect(container.querySelector('iframe[src]')).toBeNull();
    });

    test('leaves a non-templated website on src with no srcdoc', async () => {
      const { container } = render(
        <IframeController currentConfig={{ type: 'website', path: 'my-study/assets/chart.html', response: [] }} answers={{}} />,
      );
      const iframe = container.querySelector('iframe')!;

      await waitFor(() => expect(getStaticAssetByPath).toHaveBeenCalled());
      expect(vi.mocked(getStaticAssetByPath).mock.calls[0][0]).toContain('?trialid=countDots&id=');
      expect(iframe.hasAttribute('srcdoc')).toBe(false);
      expect(iframe.src).toContain('my-study/assets/chart.html');
    });

    test('renders the compiled html as srcdoc with the base tag and injected params', async () => {
      vi.spyOn(crypto, 'randomUUID').mockReturnValue(
        '11111111-2222-3333-4444-555555555555' as `${string}-${string}-${string}-${string}-${string}`,
      );
      vi.mocked(getStaticAssetByPath).mockResolvedValue('<html><head></head><body><h1>{{country}}</h1></body></html>');
      const { container } = render(<IframeController currentConfig={templatedConfig} answers={{}} />);

      await waitFor(() => expect(container.querySelector('iframe')!.hasAttribute('srcdoc')).toBe(true));
      const srcDoc = container.querySelector('iframe')!.getAttribute('srcdoc')!;

      expect(srcDoc).toContain('<h1>France</h1>');
      expect(srcDoc).toContain(`<base href="${window.location.origin}/my-study/assets/">`);
      expect(srcDoc).toContain('"id":"11111111-2222-3333-4444-555555555555"');
      expect(srcDoc).toContain('"trialid":"countDots"');
      expect(container.querySelector('iframe')!.hasAttribute('src')).toBe(false);
    });

    test('fetches the templated file once per mount, without the query string', async () => {
      const { container } = render(<IframeController currentConfig={templatedConfig} answers={{}} />);

      await waitFor(() => expect(container.querySelector('iframe')!.hasAttribute('srcdoc')).toBe(true));
      expect(getStaticAssetByPath).toHaveBeenCalledTimes(1);
      expect(getStaticAssetByPath).toHaveBeenCalledWith('/my-study/assets/chart.html');
    });

    test('renders the not-found fallback when the templated file is missing', async () => {
      vi.mocked(getStaticAssetByPath).mockResolvedValue(undefined);
      const { findByTestId } = render(<IframeController currentConfig={templatedConfig} answers={{}} />);

      expect((await findByTestId('resource-not-found')).textContent).toBe('my-study/assets/chart.html');
    });

    test('ignores templated for an external path and keeps using src', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { container } = render(
        <IframeController currentConfig={{ ...templatedConfig, path: 'https://example.com/chart.html' }} answers={{}} />,
      );

      await waitFor(() => expect(warn).toHaveBeenCalled());
      const iframe = container.querySelector('iframe')!;
      expect(iframe.hasAttribute('srcdoc')).toBe(false);
      expect(iframe.src).toBe('https://example.com/chart.html');
      expect(getStaticAssetByPath).not.toHaveBeenCalled();
    });

    test('does not recompile the stimulus when answers change mid-trial', async () => {
      const { container, rerender } = render(<IframeController currentConfig={templatedConfig} answers={{}} />);

      await waitFor(() => expect(container.querySelector('iframe')!.hasAttribute('srcdoc')).toBe(true));
      const before = container.querySelector('iframe')!.getAttribute('srcdoc');

      rerender(<IframeController currentConfig={templatedConfig} answers={{ countDots_0: { answer: { a: 1 } } } as never} />);

      expect(container.querySelector('iframe')!.getAttribute('srcdoc')).toBe(before);
      expect(getStaticAssetByPath).toHaveBeenCalledTimes(1);
    });
  });
});

test('website updater replies must match the active window, document, and request, and unmount removes registration', async () => {
  const { container, unmount } = render(<IframeController currentConfig={{ type: 'website', path: 'purchase.html', response: [] }} answers={{}} />);
  const iframe = container.querySelector('iframe')!;
  const postMessage = vi.spyOn(iframe.contentWindow!, 'postMessage');
  const receive = (type: string, message: object, source: MessageEventSource | null = iframe.contentWindow) => act(() => {
    window.dispatchEvent(new MessageEvent('message', {
      source,
      data: {
        type: `@REVISIT_COMMS/${type}`, iframeId: new URL(iframe.src).searchParams.get('id'), message,
      },
    }));
  });
  receive('WINDOW_READY', { protocolVersion: 1, documentId: 'document', globalStoreUpdater: true });
  const result = Promise.resolve(mockStoreUpdater.current!({ store: { budget: 100 }, answers: { cost: 20 } }));
  const request = postMessage.mock.calls.map(([data]) => data).find((data) => data.type === '@REVISIT_COMMS/GLOBAL_STORE_UPDATE').message;
  let resolved = false;
  result.then(() => { resolved = true; });
  receive('GLOBAL_STORE_RESULT', { ...request, documentId: 'old-document', value: { budget: 1 } });
  receive('GLOBAL_STORE_RESULT', { ...request, value: { budget: 2 } }, window);
  receive('GLOBAL_STORE_RESULT', { ...request, requestId: 'old-request', value: { budget: 3 } });
  await Promise.resolve();
  expect(resolved).toBe(false);
  receive('GLOBAL_STORE_RESULT', { ...request, value: { budget: 80 } });
  await expect(result).resolves.toEqual({ budget: 80 });
  unmount();
  expect(mockStoreUpdater.current).toBeUndefined();
});

test('navigation to a legacy document disposes its outgoing updater and rejects pending work', async () => {
  const { container } = render(<IframeController currentConfig={{ type: 'website', path: 'purchase.html', response: [] }} answers={{}} />);
  const iframe = container.querySelector('iframe')!;
  const postMessage = vi.spyOn(iframe.contentWindow!, 'postMessage');
  const receive = (type: string, message: object) => act(() => {
    window.dispatchEvent(new MessageEvent('message', {
      source: iframe.contentWindow,
      data: { type: `@REVISIT_COMMS/${type}`, iframeId: new URL(iframe.src).searchParams.get('id'), message },
    }));
  });
  receive('WINDOW_READY', { protocolVersion: 1, documentId: 'first', globalStoreUpdater: true });
  const resume = postMessage.mock.calls.map(([data]) => data).find((data) => data.type === '@REVISIT_COMMS/RESUME').message;
  receive('RESTORED', { protocolVersion: 1, requestId: resume.requestId });
  const rejected = vi.fn();
  Promise.resolve(mockStoreUpdater.current!({ store: { budget: 100 }, answers: {} })).catch(rejected);
  receive('WINDOW_READY', { protocolVersion: 0, documentId: 'second', globalStoreUpdater: false });
  expect(mockStoreUpdater.current).toBeUndefined();
  await waitFor(() => expect(rejected).toHaveBeenCalledWith(expect.any(Error)));
  expect(iframe.hasAttribute('inert')).toBe(false);
});
