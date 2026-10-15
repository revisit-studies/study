import type { ComponentProps } from 'react';
import type { Excalidraw, restoreElements } from '@excalidraw/excalidraw';

export type DrawingElement = NonNullable<Parameters<typeof restoreElements>[0]>[number];
export type DrawingChangeHandler = NonNullable<ComponentProps<typeof Excalidraw>['onChange']>;
export type DrawingAppState = Parameters<DrawingChangeHandler>[1];
export type DrawingFiles = Parameters<DrawingChangeHandler>[2];
export type DrawingAPI = Parameters<NonNullable<ComponentProps<typeof Excalidraw>['excalidrawAPI']>>[0];
export type DrawingTool = 'pen' | 'eraser';
export type PenSize = 'm' | 'l' | 'xl';

export interface DrawingScene {
  format: 'excalidraw';
  elements: readonly DrawingElement[];
  appState: Pick<DrawingAppState, 'scrollX' | 'scrollY' | 'zoom' | 'viewBackgroundColor'>;
  files: DrawingFiles;
}

export interface DrawingState {
  state: DrawingScene | null;
  tool: DrawingTool;
  color: string;
  penSize: string;
}
export interface DrawingParameters {
  responseId?: string;
  height?: number;
  initialColor?: string;
  initialPenSize?: PenSize;
  initialDrawing?: DrawingScene;
  requireDrawing?: boolean;
}

export const DRAWING_COLORS: Record<string, string> = {
  red: '#ff6b6b',
  green: '#51cf66',
  blue: '#339af0',
  orange: '#ff922b',
  grey: '#adb5bd',
  black: '#3b3b3b',
  violet: '#845ef7',
};
// Excalidraw's freehand renderer multiplies strokeWidth by 4.25.
export const DRAWING_WIDTHS: Record<string, number> = {
  m: 4.5 / 4.25, l: 6 / 4.25, xl: 11 / 4.25,
};

export function emptyDrawing(): DrawingScene {
  return {
    format: 'excalidraw',
    elements: [],
    files: {},
    appState: {
      scrollX: 0, scrollY: 0, zoom: { value: 1 as DrawingAppState['zoom']['value'] }, viewBackgroundColor: '#ffffff',
    },
  };
}

export function hasDrawing(scene: DrawingScene): boolean {
  return scene.elements.some((element) => !element.isDeleted);
}
