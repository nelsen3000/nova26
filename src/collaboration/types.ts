// Real-time CRDT Collaboration Types — KIMI-R24-03

export interface CRDTDocument {
  id: string;
  type: 'code' | 'design' | 'prd' | 'taste-vault' | 'config';
  content: Uint8Array;  // CRDT-encoded state
  version: number;
  participants: string[];
  lastModified: string;
  conflictCount: number;
}

export interface SemanticCRDTNode {
  id: string;
  path: string;
  value: unknown;
  author: string;
  timestamp: string;
  semanticType: string;  // e.g. "function-body", "style-rule", "config-value"
  conflictResolution?: 'last-writer-wins' | 'semantic-merge' | 'manual';
}

export interface CRDTSession {
  documentId: string;
  userId: string;
  joinedAt: string;
  cursor?: { x: number; y: number };
  selection?: { start: number; end: number };
}

export interface CRDTChange {
  id: string;
  documentId: string;
  author: string;
  timestamp: string;
  operation: 'insert' | 'delete' | 'update';
  path: string;
  value?: unknown;
  previousValue?: unknown;
}

export interface ParallelUniverse {
  id: string;
  name: string;
  parentDocumentId: string;
  document: CRDTDocument;
  createdAt: string;
  createdBy: string;
}

export interface MergeResult {
  success: boolean;
  conflicts: number;
  autoResolved: number;
  manualRequired: string[];
}
