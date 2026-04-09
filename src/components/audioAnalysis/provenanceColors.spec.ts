import { describe, expect, test } from 'vitest';
import { TrrackedProvenance } from '../../store/types';
import {
  FORM_UPDATE_COLOR,
  ROOT_COLOR,
  ROOT_KEY,
  buildProvenanceLegendEntries,
  getColorForKey,
  getNodeColorKey,
  normalizeActionName,
} from './provenanceColors';

function createGraph(nodes: TrrackedProvenance['nodes'], root: string): TrrackedProvenance {
  return {
    current: root,
    root,
    nodes,
  } as TrrackedProvenance;
}

describe('provenanceColors', () => {
  test('normalizeActionName collapses punctuation and whitespace consistently', () => {
    expect(normalizeActionName('Zoom In')).toBe('zoom in');
    expect(normalizeActionName(' zoom-in ')).toBe('zoom in');
    expect(normalizeActionName('ZOOM   IN')).toBe('zoom in');
  });

  test('getNodeColorKey uses registry action type first', () => {
    const node = {
      id: 'n1',
      label: 'Different Label',
      createdOn: 1,
      artifacts: [],
      meta: { annotation: [], bookmark: [] },
      children: [],
      state: { type: 'checkpoint', val: {} },
      level: 1,
      event: 'SomeEvent',
      parent: 'root',
      sideEffects: {
        do: [{ type: 'Signal/SetZoom' }],
        undo: [],
      },
    } as TrrackedProvenance['nodes'][string];

    expect(getNodeColorKey(node)).toBe('signal setzoom');
  });

  test('getNodeColorKey falls back to event, then label, and handles root', () => {
    const eventNode = {
      id: 'n1',
      label: '',
      createdOn: 1,
      artifacts: [],
      meta: { annotation: [], bookmark: [] },
      children: [],
      state: { type: 'checkpoint', val: {} },
      level: 1,
      event: 'BrushMove',
      parent: 'root',
      sideEffects: { do: [], undo: [] },
    } as TrrackedProvenance['nodes'][string];
    expect(getNodeColorKey(eventNode)).toBe('brushmove');

    const labelNode = {
      id: 'n2',
      label: ' Zoom In ',
      createdOn: 2,
      artifacts: [],
      meta: { annotation: [], bookmark: [] },
      children: [],
      state: { type: 'checkpoint', val: {} },
      level: 1,
      event: '',
      parent: 'root',
      sideEffects: { do: [], undo: [] },
    } as TrrackedProvenance['nodes'][string];
    expect(getNodeColorKey(labelNode)).toBe('zoom in');

    const rootNode = {
      id: 'root',
      label: 'Root',
      createdOn: 0,
      artifacts: [],
      meta: { annotation: [], bookmark: [] },
      children: [],
      state: { type: 'checkpoint', val: {} },
      level: 0,
      event: 'Root',
    } as TrrackedProvenance['nodes'][string];
    expect(getNodeColorKey(rootNode)).toBe(ROOT_KEY);
  });

  test('getColorForKey is deterministic and root key always uses root color', () => {
    const key = 'signal setzoom';
    expect(getColorForKey(key)).toBe(getColorForKey(key));
    expect(getColorForKey(ROOT_KEY)).toBe(ROOT_COLOR);
    expect(getColorForKey('update')).toBe(FORM_UPDATE_COLOR);
    expect(getColorForKey('update form field')).toBe(FORM_UPDATE_COLOR);
  });

  test('different keys generally map to different colors', () => {
    expect(getColorForKey('action 2')).not.toBe(getColorForKey('action 3'));
  });

  test('buildProvenanceLegendEntries de-dupes by canonical key across locations', () => {
    const rootNode = {
      id: 'root',
      label: 'Root',
      createdOn: 0,
      artifacts: [],
      meta: { annotation: [], bookmark: [] },
      children: ['a1'],
      state: { type: 'checkpoint', val: {} },
      level: 0,
      event: 'Root',
    } as TrrackedProvenance['nodes'][string];
    const locationOneAction = {
      id: 'a1',
      label: 'Zoom In',
      createdOn: 1,
      artifacts: [],
      meta: { annotation: [], bookmark: [] },
      children: [],
      state: { type: 'checkpoint', val: {} },
      level: 1,
      event: 'signal',
      parent: 'root',
      sideEffects: { do: [{ type: 'Signal/SetZoom' }], undo: [] },
    } as TrrackedProvenance['nodes'][string];
    const locationTwoAction = {
      id: 'b1',
      label: ' zoom-in ',
      createdOn: 2,
      artifacts: [],
      meta: { annotation: [], bookmark: [] },
      children: [],
      state: { type: 'checkpoint', val: {} },
      level: 1,
      event: 'other',
      parent: 'root',
      sideEffects: { do: [{ type: 'Signal/SetZoom' }], undo: [] },
    } as TrrackedProvenance['nodes'][string];

    const graphA = createGraph({ root: rootNode, a1: locationOneAction }, 'root');
    const graphB = createGraph({ root: rootNode, b1: locationTwoAction }, 'root');

    const legendEntries = buildProvenanceLegendEntries([graphA, graphB]);
    expect(legendEntries.size).toBe(2);
    expect(legendEntries.get('signal setzoom')?.color).toBe(getColorForKey('signal setzoom'));
  });
});
