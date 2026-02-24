import { Registry, StateChangeFunction } from '@trrack/core';
import type { MapState } from './types';

export const initialState: MapState = {
  selectedStates: [],
  hoveredState: '',
};

export const registry = Registry.create<'select' | 'hover'>();

export const selectStateAction = registry.register(
  'select',
  ((state, payload) => {
    state.selectedStates = payload;
  }) as StateChangeFunction<MapState, string[]>,
  {
    eventType: 'select',
    label: 'select-state',
  },
);

export const hoverStateAction = registry.register(
  'hover',
  ((state, payload) => {
    state.hoveredState = payload;
  }) as StateChangeFunction<MapState, string>,
  {
    eventType: 'hover',
    label: 'hover-state',
  },
);
