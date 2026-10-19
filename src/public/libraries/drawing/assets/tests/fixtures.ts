import { DrawingScene, emptyDrawing } from '../types';

export function sceneWithStroke(id: string = 'stroke:test'): DrawingScene {
  return {
    ...emptyDrawing(),
    elements: [{
      id,
      type: 'freedraw',
      x: 100,
      y: 100,
      width: 10,
      height: 20,
      points: [[0, 0], [10, 20]],
      pressures: [],
      simulatePressure: true,
      lastCommittedPoint: [10, 20],
      strokeColor: '#ff6b6b',
      strokeWidth: 4.5 / 4.25,
      backgroundColor: 'transparent',
      fillStyle: 'solid',
      strokeStyle: 'solid',
      roughness: 0,
      opacity: 100,
      angle: 0 as DrawingScene['elements'][number]['angle'],
      seed: 1,
      version: 1,
      versionNonce: 0,
      roundness: null,
      index: null,
      isDeleted: false,
      groupIds: [],
      frameId: null,
      boundElements: null,
      updated: 0,
      link: null,
      locked: false,
    }],
  };
}
