// @vitest-environment jsdom

import { render, waitFor } from '@testing-library/react';
import {
  beforeEach, describe, expect, test, vi,
} from 'vitest';
import { IframeController } from '../IframeController';
import type { WebsiteComponent } from '../../parser/types';

const mockDispatch = vi.fn();
const mockSetReactiveAnswers = vi.fn((payload) => ({ type: 'setReactiveAnswers', payload }));
const mockUpdateResponseBlockValidation = vi.fn((payload) => ({ type: 'updateResponseBlockValidation', payload }));

vi.mock('react-redux', () => ({
  useDispatch: () => vi.fn(),
}));

vi.mock('../../routes/utils', () => ({
  useCurrentComponent: () => 'countDots',
  useCurrentIdentifier: () => 'countDots_0',
}));

vi.mock('../../store/hooks/useIsAnalysis', () => ({
  useIsAnalysis: () => true,
}));

vi.mock('../../store/store', () => ({
  useStoreActions: () => ({
    setReactiveAnswers: mockSetReactiveAnswers,
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
