import { useCallback, useState } from 'react';
import type * as MantineHooks from '@mantine/hooks';
import type * as D3 from 'd3';
import { MantineProvider } from '@mantine/core';
import { initializeTrrack, Registry } from '@trrack/core';
import type { ConfigureTrrackOptions } from '@trrack/core';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  afterEach, expect, test, vi,
} from 'vitest';
import { useManagedTrrack } from '../../../../store/hooks/useRevisitTrrack';
import type { TrrackedProvenance } from '../../../../store/types';
import { BrushPlot } from '../BrushPlot';
import type { BrushParams, BrushState } from '../types';

const mocks = vi.hoisted(() => ({ csv: vi.fn() }));
vi.mock('d3', async (original) => ({ ...await original<typeof D3>(), csv: mocks.csv }));
vi.mock('../Bar', () => ({ Bar: () => null }));
vi.mock('@mantine/hooks', async (original) => ({
  ...await original<typeof MantineHooks>(),
  useResizeObserver: () => {
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const ref = useCallback((element: Element | null) => {
      if (element) setDimensions({ width: 800, height: 500 });
    }, []);
    return [ref, dimensions];
  },
}));
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

const params: BrushParams = {
  brushType: 'Axis Selection', dataset: 'date-fixture', x: 'date', y: 'value', category: 'category', ids: 'id', dataType: 'date',
};
test.each([
  ['Axis Selection', 'cleared'], ['Axis Selection', 'new'],
  ['Slider Selection', 'cleared'], ['Slider Selection', 'new'],
] as const)('mounting %s in %s state preserves selection without recording a move', async (brushType, kind) => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  const parameters: BrushParams = { ...params, brushType, x: brushType === 'Axis Selection' ? 'date' : 'x', dataType: brushType === 'Axis Selection' ? 'date' : undefined };
  const registry = Registry.create();
  type State = { all: { brush: BrushState } };
  const clear = registry.register('brushClear', (state: State, brush: BrushState) => { state.all = { brush }; return state; });
  const first = initializeTrrack({ registry, initialState: { all: { brush: { hasBrush: true, x1: 110, x2: 700, y1: 15, y2: 430, ids: ['a'] } } } });
  await first.apply('Clear Brush', clear({ hasBrush: false, x1: 110, x2: 700, y1: 15, y2: 430, ids: [] }));
  const saved = kind === 'cleared' ? structuredClone(first.graph.backend) : undefined;
  const report = vi.fn();
  let getGraph!: () => TrrackedProvenance;
  function useTrrack<Value>(options: ConfigureTrrackOptions<Value, string>) {
    const trrack = useManagedTrrack(options, report, 'stimulus', saved);
    getGraph = () => trrack.graph.backend as TrrackedProvenance;
    return trrack;
  }
  mocks.csv.mockResolvedValue([
    { id: 'a', date: '2015-01-02', x: '1', value: '2', category: 'one' },
    { id: 'b', date: '2015-12-31', x: '5', value: '8', category: 'two' },
  ]);
  vi.useFakeTimers();
  const view = render(<MantineProvider><BrushPlot parameters={parameters} globalVariables={{}} registerGlobalStoreUpdater={vi.fn()} answers={{}} setAnswer={vi.fn()} useTrrack={useTrrack as never} updateState={vi.fn()} /></MantineProvider>);
  await act(async () => { await Promise.resolve(); });
  expect(view.container.querySelector(brushType === 'Axis Selection' ? '#brushXRef .selection' : '[role=slider]')).not.toBeNull();
  await act(async () => { await vi.advanceTimersByTimeAsync(150); });
  if (saved) {
    expect(getGraph()).toEqual(saved);
    expect(report).not.toHaveBeenCalled();
    expect((screen.getByRole('button', { name: 'Clear Selection' }) as HTMLButtonElement).disabled).toBe(true);
  } else {
    expect(Object.keys(getGraph().nodes)).toHaveLength(1);
  }
});


test('a cleared slider keeps the same controls after returning with its retained graph', async () => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  const parameters: BrushParams = { ...params, brushType: 'Slider Selection', x: 'x', dataType: undefined };
  let saved: TrrackedProvenance | undefined;
  let getGraph!: () => TrrackedProvenance;
  const report = vi.fn();
  function useTrrack<State>(options: ConfigureTrrackOptions<State, string>) {
    const trrack = useManagedTrrack(options, report, 'stimulus', saved);
    getGraph = () => trrack.graph.backend as TrrackedProvenance;
    return trrack;
  }
  mocks.csv.mockResolvedValue([{ id: 'a', x: '1', value: '2', category: 'one' }, { id: 'b', x: '5', value: '8', category: 'two' }]);
  vi.useFakeTimers();
  const mount = () => render(<MantineProvider><BrushPlot parameters={parameters} globalVariables={{}} registerGlobalStoreUpdater={vi.fn()} answers={{}} setAnswer={vi.fn()} useTrrack={useTrrack as never} updateState={vi.fn()} /></MantineProvider>);
  const first = mount();
  await act(async () => { await Promise.resolve(); });
  const clear = screen.getByRole('button', { name: 'Clear Selection' }) as HTMLButtonElement;
  expect(clear.disabled).toBe(false);
  fireEvent.click(clear);
  await act(async () => { await vi.advanceTimersByTimeAsync(150); });
  expect(clear.disabled).toBe(true);
  const values = [...first.container.querySelectorAll('[role=slider]')].map((element) => element.getAttribute('aria-valuenow'));
  saved = structuredClone(getGraph());
  first.unmount();
  const second = mount();
  await act(async () => { await Promise.resolve(); });
  expect((screen.getByRole('button', { name: 'Clear Selection' }) as HTMLButtonElement).disabled).toBe(true);
  expect([...second.container.querySelectorAll('[role=slider]')].map((element) => element.getAttribute('aria-valuenow'))).toEqual(values);
  expect(getGraph()).toEqual(saved);
});
