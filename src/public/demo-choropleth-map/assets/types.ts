import type { GeometryCollection, Objects } from 'topojson-specification';

export interface USObjectData extends Objects {
  states: GeometryCollection<{ name: string }>;
}

export type MapState = {
  selectedStates: string[];
  hoveredState: string;
};

export type MapParameters = {
  /** CSV file name (without extension) to load from ./data/ */
  dataset: string;
  /** CSV column to use for color encoding. */
  valueField: string;
  /** Legend label. Defaults to the valueField name. */
  legendTitle?: string;
  /** Explicit [min, max] for the color scale domain. Derived from data when omitted. */
  domain?: [number, number];
};

export type CsvRow = Record<string, string | undefined>;

export type SvgSelection = d3.Selection<SVGSVGElement, unknown, null, undefined>;
