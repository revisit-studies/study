export interface TrrackState {
  answerNodes: string[];
  orderingNode: string | null;
  originHighlight: string | null;
  destinationHighlight: string | null;
  linkMarks: string[][] | null;
}

export interface clusterMark {
  option: string;
  origin: string;
  destination: string;
}

export interface path {
  option: string;
  path: string;
}

export interface ChartParams {
  showConfig?: boolean;

  encoding?: string;
  dataset?: string;

  isSnr?: boolean;

  nMeans?: number;
  nDevs?: number;

  markColor?: string;
  colorScale?: string;

  nodeOrderingDisabled?: boolean;
  highlightingDisabled?: boolean;
  destinationSelectionDisabled?: boolean;

  isClusterTask?: boolean;
  clusterMode?: string;
  clusterVar?: string;
  clusterMarks?: clusterMark[];

  isRangeTask?: boolean;

  paths?: path[];
  linkMarks?: string[][];

  showTooltip?: boolean;

  provenanceState?: TrrackState;
}

export interface link {
  origin: string;
  destination: string;
  mean: number;
  std: number;
}
