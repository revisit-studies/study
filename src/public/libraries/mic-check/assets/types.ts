export interface BrushState {
    hasBrush: boolean;
    x1: number;
    x2: number;
    y1: number;
    y2: number;
    xCol: string;
    yCol: string;
    id: number;
    type?: 'scatter' | 'beeswarm' | 'histogram' | 'violin'
  }

export type SelectionType = 'drag' | 'handle' | 'clear' | 'click' | null

export type BrushNames = 'Rectangular Selection' | 'Axis Selection' | 'Slider Selection' | 'Paintbrush Selection'

export interface BrushParams {
  brushType: BrushNames;
  dataset: string;
  x: string;
  y: string;
  category: string;
  ids: string;
  dataType?: 'date';
  year?: number | undefined;
  columns?: string[];
  catColumns?: string[];
  brushState?: Record<number, BrushState>;
  hideCat?: boolean;
}
