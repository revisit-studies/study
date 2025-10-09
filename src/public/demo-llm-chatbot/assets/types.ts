export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  display: boolean;
}

export interface ChatProvenanceState {
  messages: ChatMessage[];
  modalOpened: boolean;
}

type ChartType = 'violin-plot' | 'clustered-heatmap';
type ChartModality = 'tactile' | 'text';

export interface ChatInterfaceParams {
  chartType: ChartType;
  modality: ChartModality;
  testSystemPrompt?: string;
}
