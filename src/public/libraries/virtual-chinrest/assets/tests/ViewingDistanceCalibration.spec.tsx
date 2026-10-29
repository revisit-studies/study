import {
  act, cleanup, fireEvent, render, screen,
} from '@testing-library/react';
import {
  afterEach, beforeEach, expect, test, vi,
} from 'vitest';
import { MantineProvider } from '@mantine/core';
import type { ConfigureTrrackOptions } from '@trrack/core';
import ViewingDistanceCalibration from '../ViewingDistanceCalibration';
import { makeStoredAnswer } from '../../../../../tests/utils';
import { useManagedTrrack } from '../../../../../store/hooks/useRevisitTrrack';
import type { TrrackedProvenance, StoreState } from '../../../../../store/types';

const mocks = vi.hoisted(() => ({ raf: undefined as FrameRequestCallback | undefined }));
vi.mock('../../../../../store/hooks/useIsAnalysis', () => ({ useIsAnalysis: () => false }));
const currentAnswer = makeStoredAnswer({ trialOrder: '1', answer: {} });
const card = makeStoredAnswer({ componentName: '$virtual-chinrest.components.card-size', trialOrder: '0', answer: { pixelsPerMM: 5 } });
vi.mock('../../../../../store/hooks/useStoredAnswer', () => ({ useStoredAnswer: () => currentAnswer }));
vi.mock('../../../../../store/store', () => ({
  useStoreSelector: (selector: (state: Pick<StoreState, 'answers'>) => unknown) => selector({ answers: { card } }),
}));
function mount(provenance?: TrrackedProvenance) {
  const report = vi.fn();
  let getGraph!: () => TrrackedProvenance;
  function useTrrack<State>(options: ConfigureTrrackOptions<State, string>) {
    const trrack = useManagedTrrack(options, report, 'stimulus', provenance);
    getGraph = () => trrack.graph.backend as TrrackedProvenance;
    return trrack;
  }
  const view = render(<MantineProvider><ViewingDistanceCalibration parameters={{ blindspotAngle: 13.5 }} store={{}} registerGlobalStoreUpdater={vi.fn()} answers={{}} setAnswer={vi.fn()} useTrrack={useTrrack as never} /></MantineProvider>);
  return { ...view, report, getGraph: () => getGraph() };
}
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
beforeEach(() => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => { mocks.raf = fn; return 1; });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});

test('each viewing-distance measurement starts from the reset position', async () => {
  mount();
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


test('returning to a partially completed calibration keeps the next measurement at its start position', async () => {
  const first = mount();
  fireEvent.keyDown(window, { code: 'Space' });
  act(() => mocks.raf!(100));
  await act(async () => { fireEvent.keyDown(window, { code: 'Space' }); });
  expect(screen.getByTestId('blindspot-ball').style.left).toBe('740px');
  const saved = structuredClone(first.getGraph());
  first.unmount();
  const second = mount(saved);
  expect(screen.getByText(/Remaining measurements:/).textContent).toContain('4');
  expect(screen.getByTestId('blindspot-ball').style.left).toBe('740px');
  expect(second.getGraph()).toEqual(saved);
  expect(second.report).not.toHaveBeenCalled();
  fireEvent.keyDown(window, { code: 'Space' });
  act(() => mocks.raf!(200));
  expect(screen.getByTestId('blindspot-ball').style.left).toBe('738px');
});
