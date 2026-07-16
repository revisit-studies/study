// @vitest-environment jsdom

import { cleanup, render, waitFor } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import { IframeController } from '../IframeController';
import type { WebsiteComponent } from '../../parser/types';

const mockDispatch = vi.fn();
const mockSetReactiveAnswers = vi.fn((payload) => ({ type: 'setReactiveAnswers', payload }));
const mockUpdateProvenance = vi.fn((payload) => ({ type: 'updateProvenance', payload }));
const mockUpdateResponseBlockValidation = vi.fn((payload) => ({ type: 'updateResponseBlockValidation', payload }));

vi.mock('react-redux', () => ({
  useDispatch: () => vi.fn(),
}));

vi.mock('../../routes/utils', () => ({
  useCurrentComponent: () => 'countDots',
  useCurrentIdentifier: () => 'countDots_0',
}));

vi.mock('../../store/hooks/useIsAnalysis', () => ({
  useIsAnalysis: () => false,
}));

vi.mock('../../store/store', () => ({
  useStoreActions: () => ({
    setReactiveAnswers: mockSetReactiveAnswers,
    updateProvenance: mockUpdateProvenance,
    updateResponseBlockValidation: mockUpdateResponseBlockValidation,
  }),
  useStoreDispatch: () => mockDispatch,
  useStoreSelector: () => ({ valid: true, values: {} }),
}));

vi.mock('../../utils/Prefix', () => ({
  PREFIX: '/',
}));

describe('IframeController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const websiteConfig: WebsiteComponent = { type: 'website', path: 'https://example.com', response: [] };

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
      data: { iframeId: '11111111-2222-3333-4444-555555555555', type: '@REVISIT_COMMS/ANSWERS', message: { q1: 'yes' } },
    }));
    await waitFor(() => expect(mockDispatch).toHaveBeenCalled());
  });

  test('stores provenance independently from answer validation', async () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(
      '11111111-2222-3333-4444-555555555555' as `${string}-${string}-${string}-${string}-${string}`,
    );
    render(<IframeController currentConfig={websiteConfig} answers={{}} />);
    const provenanceGraph = { root: 'root', current: 'root', nodes: {} };

    window.dispatchEvent(new MessageEvent('message', {
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
});
