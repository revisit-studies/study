export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  display: boolean;
}

export interface ChatProvenanceState {
  messages: ChatMessage[];
}
