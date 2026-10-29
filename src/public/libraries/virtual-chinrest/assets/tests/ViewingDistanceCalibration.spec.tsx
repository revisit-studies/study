import { useMemo } from 'react';
import {
  act, cleanup, fireEvent, render, screen,
} from '@testing-library/react';
import {
  afterEach, expect, test, vi,
} from 'vitest';
import { MantineProvider } from '@mantine/core';
import { initializeTrrack } from '@trrack/core';
import type { ConfigureTrrackOptions } from '@trrack/core';
import ViewingDistanceCalibration from '../ViewingDistanceCalibration';
import { makeStoredAnswer } from '../../../../../tests/utils';
import type { StoreState } from '../../../../../store/types';

const mocks = vi.hoisted(() => ({ raf: undefined as FrameRequestCallback | undefined }));
vi.mock('../../../../../store/hooks/useIsAnalysis', () => ({ useIsAnalysis: () => false }));
const currentAnswer = makeStoredAnswer({ trialOrder: '1', answer: {} });
const card = makeStoredAnswer({ componentName: '$virtual-chinrest.components.card-size', trialOrder: '0', answer: { pixelsPerMM: 5 } });
vi.mock('../../../../../store/hooks/useStoredAnswer', () => ({ useStoredAnswer: () => currentAnswer }));
vi.mock('../../../../../store/store', () => ({
  useStoreSelector: (selector: (state: Pick<StoreState, 'answers'>) => unknown) => selector({ answers: { card } }),
}));
function useTrrack<State>(options: ConfigureTrrackOptions<State, string>) {
  // Match the managed hook's once-per-mount initialization while using real Trrack subscriptions.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => initializeTrrack(options), []);
}
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test('each viewing-distance measurement starts from the reset position', async () => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => { mocks.raf = fn; return 1; });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  render(<MantineProvider><ViewingDistanceCalibration parameters={{ blindspotAngle: 13.5 }} answers={{}} setAnswer={vi.fn()} useTrrack={useTrrack as never} /></MantineProvider>);
  const ball = screen.getByTestId('blindspot-ball');
  expect(ball.style.left).toBe('740px');
  fireEvent.keyDown(window, { code: 'Space' });
  act(() => mocks.raf!(100));
  expect(ball.style.left).toBe('738px');
  await act(async () => { fireEvent.keyDown(window, { code: 'Space' }); });
  expect(screen.getByText(/Remaining measurements:/).textContent).toContain('4');
  expect(ball.style.left).toBe('740px');
  fireEvent.keyDown(window, { code: 'Space' });
  act(() => mocks.raf!(200));
  expect(ball.style.left).toBe('738px');
});
