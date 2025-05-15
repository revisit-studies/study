import {
  ClusteringMode, ClusteringVariable, ColorScheme, EncodingType,
} from './Enums';

export interface TrrackState {
  answerNodes: string[];
  orderingNode: string | null;
  originHighlight: string | null;
  destinationHighlight: string | null;
  linkMarks: string[][];
}

export interface ClusterMark {
  option: string;
  origin: string;
  destination: string;
}

export interface Path {
  option: string;
  path: string;
}

export type ChartConfiguration = {
  showConfigurationPanel: boolean;

  encoding: EncodingType;
  colorScheme: ColorScheme;
  markContrast: number;
  isSnr: boolean;
  nMeans: number;
  nDevs: number;

  showTooltip: boolean;

  clusterMode: ClusteringMode;
  clusterVar: ClusteringVariable;

  paths?: Path[];
  linkMarks?: string[][];
  clusterMarks?: ClusterMark[];

  nodeOrderingDisabled?: boolean;
  highlightingDisabled?: boolean;
  destinationSelectionDisabled?: boolean;

  provenanceState?: TrrackState;
};

export type ExternalParameters = {
  dataset: string;
} & Partial<ChartConfiguration>;

export interface ChartSetters {
  setColorScheme: (value: ColorScheme) => void;
  setMarkContrast: (value: number) => void;
  setEncoding: (value: EncodingType) => void;
  setShowTooltip: (value: boolean) => void;
  setIsSnr: (value: boolean) => void;
  setClusterMode: (value: ClusteringMode) => void;
  setClusterVar: (value: ClusteringVariable) => void;
  setNMeans: (value: number) => void;
  setNDevs: (value: number) => void;
}

export type ConfigProps = ChartConfiguration & ChartSetters;

export interface Link {
  origin: string;
  destination: string;
  mean: number;
  std: number;
}
