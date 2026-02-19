// Real-time CRDT Orchestrator — KIMI-R24-03

import type {
  CRDTDocument,
  CRDTSession,
  CRDTChange,
  ParallelUniverse,
  MergeResult,
} from './types.js';

export class RealTimeCRDTOrchestrator {
  private documents: Map<string, CRDTDocument> = new Map();
  private sessions: Map<string, CRDTSession[]> = new Map();
  private universes: Map<string, ParallelUniverse> = new Map();
  private changes: Map<string, CRDTChange[]> = new Map();

  /**
   * Join a collaborative session
   */
  async joinSession(documentId: string, userId: string): Promise<CRDTDocument> {
    let doc = this.documents.get(documentId);
    
    if (!doc) {
      throw new Error(`Document not found: ${documentId}`);
    }

    // Add user to participants
    if (!doc.participants.includes(userId)) {
      doc.participants.push(userId);
      doc.lastModified = new Date().toISOString();
    }

    // Track session
    const sessionList = this.sessions.get(documentId) ?? [];
    sessionList.push({
      documentId,
      userId,
      joinedAt: new Date().toISOString(),
    });
    this.sessions.set(documentId, sessionList);

    return doc;
  }

  /**
   * Apply a change to the document
   */
  async applyChange(documentId: string, change: Uint8Array): Promise<void> {
    const doc = this.documents.get(documentId);
    if (!doc) {
      throw new Error(`Document not found: ${documentId}`);
    }

    // Merge CRDT change (mock implementation)
    const merged = this.mergeCrdtState(doc.content, change);
    doc.content = merged;
    doc.version++;
    doc.lastModified = new Date().toISOString();

    // Track change
    const changeList = this.changes.get(documentId) ?? [];
    changeList.push({
      id: `change-${Date.now()}`,
      documentId,
      author: 'unknown', // Would extract from change
      timestamp: new Date().toISOString(),
      operation: 'update',
      path: '/',
    });
    this.changes.set(documentId, changeList);
  }

  /**
   * Resolve a conflict manually
   */
  async resolveConflict(
    documentId: string,
    nodeId: string,
    resolution: unknown
  ): Promise<void> {
    const doc = this.documents.get(documentId);
    if (!doc) {
      throw new Error(`Document not found: ${documentId}`);
    }

    // Apply resolution (mock)
    console.log(`Resolved conflict in ${documentId} at ${nodeId}:`, resolution);
    doc.conflictCount = Math.max(0, doc.conflictCount - 1);
    doc.lastModified = new Date().toISOString();
  }

  /**
   * Fork a parallel universe (experimental branch)
   */
  async forkParallelUniverse(documentId: string, name: string): Promise<string> {
    const parent = this.documents.get(documentId);
    if (!parent) {
      throw new Error(`Document not found: ${documentId}`);
    }

    const universeId = `universe-${Date.now()}`;
    const universe: ParallelUniverse = {
      id: universeId,
      name,
      parentDocumentId: documentId,
      document: {
        ...parent,
        id: universeId,
        version: 1,
        participants: [],
      },
      createdAt: new Date().toISOString(),
      createdBy: 'system',
    };

    this.universes.set(universeId, universe);
    return universeId;
  }

  /**
   * Merge a parallel universe back to parent
   */
  async mergeUniverse(sourceId: string, targetId: string): Promise<MergeResult> {
    const source = this.universes.get(sourceId) || this.documents.get(sourceId);
    const target = this.documents.get(targetId);

    if (!source || !target) {
      throw new Error('Source or target not found');
    }

    // Mock merge with conflict detection
    const conflicts = Math.floor(Math.random() * 5);
    const autoResolved = Math.floor(conflicts / 2);

    return {
      success: conflicts === 0,
      conflicts,
      autoResolved,
      manualRequired: conflicts > autoResolved ? [`conflict-${Date.now()}`] : [],
    };
  }

  /**
   * Get participants in a document
   */
  async getParticipants(documentId: string): Promise<string[]> {
    const doc = this.documents.get(documentId);
    return doc?.participants ?? [];
  }

  /**
   * Create a new document
   */
  createDocument(type: CRDTDocument['type']): CRDTDocument {
    const doc: CRDTDocument = {
      id: `doc-${Date.now()}`,
      type,
      content: new Uint8Array(),
      version: 1,
      participants: [],
      lastModified: new Date().toISOString(),
      conflictCount: 0,
    };
    this.documents.set(doc.id, doc);
    return doc;
  }

  /**
   * Get document
   */
  getDocument(id: string): CRDTDocument | undefined {
    return this.documents.get(id);
  }

  /**
   * Get all changes for a document
   */
  getChanges(documentId: string): CRDTChange[] {
    return this.changes.get(documentId) ?? [];
  }

  private mergeCrdtState(current: Uint8Array, change: Uint8Array): Uint8Array {
    // Mock CRDT merge - in production would use Yjs/Automerge
    const merged = new Uint8Array(current.length + change.length);
    merged.set(current);
    merged.set(change, current.length);
    return merged;
  }
}

export function createCRDTOrchestrator(): RealTimeCRDTOrchestrator {
  return new RealTimeCRDTOrchestrator();
}
