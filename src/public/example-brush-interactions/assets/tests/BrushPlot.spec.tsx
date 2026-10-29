import { useCallback, useState } from 'react';
import type * as MantineHooks from '@mantine/hooks';
import type * as D3 from 'd3';
import { MantineProvider } from '@mantine/core';
import { initializeTrrack, Registry } from '@trrack/core';
import type { ConfigureTrrackOptions } from '@trrack/core';
import { act, cleanup, render } from '@testing-library/react';
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
test.each(['cleared', 'new'] as const)('mounting a %s axis brush does not record a participant move', async (kind) => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
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
    { id: 'a', date: '2015-01-02', value: '2', category: 'one' },
    { id: 'b', date: '2015-12-31', value: '8', category: 'two' },
  ]);
  vi.useFakeTimers();
  const view = render(<MantineProvider><BrushPlot parameters={params} answers={{}} setAnswer={vi.fn()} useTrrack={useTrrack as never} updateState={vi.fn()} /></MantineProvider>);
  await act(async () => { await Promise.resolve(); });
  expect(view.container.querySelector('#brushXRef .selection')).not.toBeNull();
  await act(async () => { await vi.advanceTimersByTimeAsync(150); });
  if (saved) {
    expect(getGraph()).toEqual(saved);
    expect(report).not.toHaveBeenCalled();
  } else {
    expect(Object.keys(getGraph().nodes)).toHaveLength(1);
  }
});
