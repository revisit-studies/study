import { MantineProvider } from '@mantine/core';
import type * as MantineHooks from '@mantine/hooks';
import { brushSelection } from 'd3';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { useCallback, useState } from 'react';
import {
  afterEach, beforeEach, expect, test, vi,
} from 'vitest';
import { Scatter } from '../Scatter';
import type { BrushNames, BrushState } from '../types';

vi.mock('@mantine/hooks', async (original) => ({
  ...await original<typeof MantineHooks>(),
  useResizeObserver: () => {
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const ref = useCallback((element: Element | null) => {
      if (element) setDimensions({ width: 530, height: 500 });
    }, []);
    return [ref, dimensions];
  },
}));

beforeEach(() => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const saved: BrushState = {
  hasBrush: true, x1: 130, y1: 80, x2: 240, y2: 180, ids: ['a'],
};
const data = [{ id: 'a', x: 1, y: 2, category: 'one' }, { id: 'b', x: 5, y: 8, category: 'two' }];

function mount(brushType: BrushNames) {
  const onBrush = vi.fn();
  const onFilter = vi.fn();
  const draw = (state: BrushState) => (
    <MantineProvider>
      <Scatter
        setFilteredTable={onFilter}
        setBrushedSpace={onBrush}
        brushState={state}
        brushType={brushType}
        params={{ brushType, dataset: 'unused', x: 'x', y: 'y', category: 'category', ids: 'id' }}
        data={data}
        brushedPoints={state.ids}
      />
    </MantineProvider>
  );
  const view = render(draw(saved));
  const svg = view.container.querySelector('svg')!;
  return { ...view, svg, onBrush, showState: (state: BrushState) => view.rerender(draw(state)) };
}

test.each(['Rectangular Selection', 'Axis Selection'] as const)('restores %s bounds and handles without publishing an interaction', (brushType) => {
  const { svg, onBrush } = mount(brushType);
  if (brushType === 'Rectangular Selection') {
    expect(brushSelection(svg)).toEqual([[saved.x1, saved.y1], [saved.x2, saved.y2]]);
  } else {
    expect(brushSelection(svg.querySelector('#brushXRef')!)).toEqual([saved.x1, saved.x2]);
    expect(brushSelection(svg.querySelector('#brushYRef')!)).toEqual([saved.y1, saved.y2]);
  }
  svg.querySelectorAll<SVGElement>('.selection, .handle').forEach((element) => {
    expect(element.style.display).not.toBe('none');
  });
  expect(onBrush).not.toHaveBeenCalled();
});

test('a restored rectangular selection can still be moved by the participant', () => {
  const { svg, onBrush } = mount('Rectangular Selection');
  const selection = svg.querySelector('.selection')!;
  const eventWindow = svg.ownerDocument.defaultView!;
  const mouse = (type: string, target: Element | Window, clientX: number, clientY: number) => {
    const event = new MouseEvent(type, { bubbles: true, clientX, clientY, buttons: 1 });
    // jsdom's constructor rejects the Vitest Window proxy; D3 needs its view during a drag.
    Object.defineProperty(event, 'view', { value: eventWindow });
    fireEvent(target, event);
  };
  mouse('mousedown', selection, 170, 120);
  mouse('mousemove', eventWindow, 180, 130);
  mouse('mouseup', eventWindow, 180, 130);
  expect(brushSelection(svg)).toEqual([[140, 90], [250, 190]]);
  expect(onBrush).toHaveBeenCalledWith([[140, 90], [250, 190]], expect.any(Function), expect.any(Function), 'drag');
});

test('greys out every point when an active brush selects no rows', () => {
  const { svg, showState } = mount('Axis Selection');
  showState({ ...saved, ids: [] });

  const circles = [...svg.querySelectorAll('circle')];
  expect(circles).toHaveLength(data.length);
  circles.forEach((circle) => {
    expect(circle.getAttribute('fill')).toBe('lightgray');
    expect(circle.getAttribute('opacity')).toBe('0.3');
  });

  showState({ ...saved, hasBrush: false, ids: [] });
  expect([...svg.querySelectorAll('circle')].every((circle) => circle.getAttribute('opacity') === '1')).toBe(true);
});


test('later rectangular snapshots update and clear the visible selection without publishing interactions', () => {
  const { svg, onBrush, showState } = mount('Rectangular Selection');
  showState({ ...saved, x1: 150, y1: 90, x2: 260, y2: 190 });
  expect(brushSelection(svg)).toEqual([[150, 90], [260, 190]]);
  showState({ ...saved, hasBrush: false, ids: [] });
  expect(brushSelection(svg)).toBeNull();
  expect((svg.querySelector('.selection') as SVGElement).style.display).toBe('none');
  expect(onBrush).not.toHaveBeenCalled();
});
