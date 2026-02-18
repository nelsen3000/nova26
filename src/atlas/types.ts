// Kronos integration types for ATLAS memory system

export interface KronosEntry {
  project: string;
  taskId: string;
  agent: string;
  phase: number;
  content: string;
  tags: string[];
}

export interface KronosPointer {
  id: string;
  taskId: string;
  summary: string;
  relevanceScore: number;
  tokenCount: number;
}

export interface KronosSearchResult {
  pointers: KronosPointer[];
  totalTokensSaved: number;
}
