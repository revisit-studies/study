export interface TrrackState {
  answerNodes: string[];
  orderingNode: string | null;
  originHighlight: string | null;
  destinationHighlight: string | null;
}

export interface ChartParams {
  showConfig?: boolean;
  encoding: string;
  dataset: string;
  isSnr: boolean;
  nMeans: number;
  nDevs: number;
  colorScale: string;
  clusterMode?: string;
  clusterVar?: string;
  showTooltip?: boolean;
  provenanceState: TrrackState;
}

export interface link {
  origin: string;
  destination: string;
  mean: number;
  std: number;
}
