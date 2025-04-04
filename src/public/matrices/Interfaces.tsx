export interface TrrackState {
  answerNodes: string[];
  highlightedNodes?: string[];
  highlightNodes?: string[];
  sortingNode?: string;
  originHighlight?: string | null;
  destinationHighlight?: string | null;
}

export interface ChartParams {
  dataset: string;
  isSnr: boolean;
  nMeans: number;
  colorScale: string;
  provenanceState: TrrackState;
}

export interface link {
  origin: string;
  destination: string;
  mean: number;
  std: number;
}
