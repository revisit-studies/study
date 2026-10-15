import {
  DrawingScene, LegacyDrawingSnapshot, LegacyShape,
} from '../types';
import { toDrawingScene } from '../legacy';

export function legacyStroke(overrides: Partial<LegacyShape> = {}): LegacyShape {
  return {
    id: 'shape:test',
    typeName: 'shape',
    type: 'draw',
    parentId: 'page:page',
    index: 'a1',
    x: 198,
    y: 81.2,
    rotation: 0,
    opacity: 1,
    props: {
      color: 'red',
      size: 'm',
      scale: 1,
      isPen: false,
      isComplete: true,
      segments: [{ type: 'free', points: [{ x: 0, y: 0, z: 0.5 }, { x: 10, y: 20, z: 0.6 }] }],
    },
    ...overrides,
  };
}

export function legacySnapshot(store: Record<string, unknown>): LegacyDrawingSnapshot {
  return {
    document: { store },
    session: { currentPageId: 'page:page', pageStates: [{ pageId: 'page:page', camera: { x: 12, y: -5, z: 2 } }] },
  };
}

export function sceneWithStroke(id: string = 'shape:test'): DrawingScene {
  return toDrawingScene(legacySnapshot({ stroke: legacyStroke({ id }) }));
}
