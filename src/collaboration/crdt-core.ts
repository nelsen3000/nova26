// Real-time CRDT Collaboration — Core
// Analogy: The Shared Dream Stage
// KIMI-R24-03 | Feb 2026

export type NodeType = 'text' | 'code' | 'diagram' | 'config' | 'agent-output';
export type OperationType = 'insert' | 'delete' | 'update' | 'move' | 'fork';
export type ConflictResolutionStrategy = 'last-write-wins' | 'semantic-merge' | 'taste-vault' | 'manual';

export interface VectorClock {
  [peerId: string]: number;
}

export interface CRDTOperation {
  id: string;
  peerId: string;
  type: OperationType;
  targetNodeId: string;
  timestamp: number;
  vectorClock: VectorClock;
  payload: unknown;
  tasteScore?: number;
}

export interface SemanticCRDTNode {
  id: string;
  type: NodeType;
  content: string;
  vectorClock: VectorClock;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  parentId?: string;
  children: string[];
  semanticTags: string[];
  tasteScore: number;
  pendingOps: CRDTOperation[];
  conflictMarkers: ConflictMarker[];
}

export interface ConflictMarker {
  id: string;
  nodeId: string;
  ops: CRDTOperation[];
  strategy: ConflictResolutionStrategy;
  resolvedAt?: number;
  resolution?: string;
}

export interface CRDTDocument {
  id: string;
  name: string;
  nodes: Map<string, SemanticCRDTNode>;
  peers: Set<string>;
  history: CRDTOperation[];
  forks: Map<string, CRDTDocument>;
  createdAt: number;
  updatedAt: number;
}

export interface CollaborationSession {
  id: string;
  documentId: string;
  peers: string[];
  joinedAt: Record<string, number>;
  leftAt: Record<string, number>;
  isActive: boolean;
}

export interface ApplyChangeResult {
  applied: boolean;
  conflictsDetected: number;
  conflictsResolved: number;
  newNodeState?: SemanticCRDTNode;
}

export interface ForkResult {
  forkId: string;
  forkDocument: CRDTDocument;
  divergePointOp: string;
}

export class RealTimeCRDTOrchestrator {
  private documents = new Map<string, CRDTDocument>();
  private sessions = new Map<string, CollaborationSession>();
  private localPeerId: string;
  private conflictResolver: ConflictResolver;

  constructor(peerId: string, conflictResolver?: ConflictResolver) {
    this.localPeerId = peerId;
    this.conflictResolver = conflictResolver ?? new DefaultConflictResolver();
  }

  createDocument(name: string): CRDTDocument {
    const doc: CRDTDocument = {
      id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      nodes: new Map(),
      peers: new Set([this.localPeerId]),
      history: [],
      forks: new Map(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.documents.set(doc.id, doc);
    return doc;
  }

  joinSession(documentId: string, peerId: string): CollaborationSession {
    const doc = this.documents.get(documentId);
    if (!doc) throw new Error(`Document ${documentId} not found`);

    doc.peers.add(peerId);
    const sessionId = `sess-${documentId}-${Date.now()}`;
    const session: CollaborationSession = {
      id: sessionId,
      documentId,
      peers: [...doc.peers],
      joinedAt: { [peerId]: Date.now() },
      leftAt: {},
      isActive: true,
    };
    this.sessions.set(sessionId, session);
    return session;
  }

  leaveSession(sessionId: string, peerId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.leftAt[peerId] = Date.now();
    const doc = this.documents.get(session.documentId);
    if (doc) doc.peers.delete(peerId);
    if ([...doc?.peers ?? []].length === 0) {
      session.isActive = false;
    }
  }

  applyChange(documentId: string, op: CRDTOperation): ApplyChangeResult {
    const doc = this.documents.get(documentId);
    if (!doc) throw new Error(`Document ${documentId} not found`);

    doc.updatedAt = Date.now();
    doc.history.push(op);

    let node = doc.nodes.get(op.targetNodeId);
    let conflictsDetected = 0;
    let conflictsResolved = 0;

    switch (op.type) {
      case 'insert': {
        if (!node) {
          node = this.createNode(op.targetNodeId, op.payload as Partial<SemanticCRDTNode>, op.peerId, op.vectorClock);
          doc.nodes.set(op.targetNodeId, node);
        }
        break;
      }
      case 'update': {
        if (!node) return { applied: false, conflictsDetected: 0, conflictsResolved: 0 };

        // Check for concurrent edits (vector clock comparison)
        const isConcurrent = this.isConcurrentOp(node.vectorClock, op.vectorClock);
        if (isConcurrent) {
          conflictsDetected++;
          const resolution = this.conflictResolver.resolve(node, op);
          if (resolution) {
            node.content = resolution;
            node.vectorClock = mergeVectorClocks(node.vectorClock, op.vectorClock);
            conflictsResolved++;
          } else {
            const marker: ConflictMarker = {
              id: `conflict-${op.id}`,
              nodeId: op.targetNodeId,
              ops: [op],
              strategy: 'semantic-merge',
            };
            node.conflictMarkers.push(marker);
          }
        } else {
          const payload = op.payload as { content?: string; tags?: string[] };
          if (payload.content !== undefined) node.content = payload.content;
          if (payload.tags) node.semanticTags = payload.tags;
          node.vectorClock = mergeVectorClocks(node.vectorClock, op.vectorClock);
          node.updatedAt = Date.now();
        }
        break;
      }
      case 'delete': {
        if (node) {
          doc.nodes.delete(op.targetNodeId);
        }
        break;
      }
      case 'move': {
        if (node) {
          const { newParentId } = op.payload as { newParentId: string };
          node.parentId = newParentId;
          node.updatedAt = Date.now();
        }
        break;
      }
    }

    return {
      applied: true,
      conflictsDetected,
      conflictsResolved,
      newNodeState: doc.nodes.get(op.targetNodeId),
    };
  }

  resolveConflict(
    documentId: string,
    conflictId: string,
    resolution: string,
  ): boolean {
    const doc = this.documents.get(documentId);
    if (!doc) return false;

    for (const node of doc.nodes.values()) {
      const marker = node.conflictMarkers.find(m => m.id === conflictId);
      if (marker) {
        marker.resolution = resolution;
        marker.resolvedAt = Date.now();
        node.content = resolution;
        node.conflictMarkers = node.conflictMarkers.filter(m => m.id !== conflictId);
        return true;
      }
    }
    return false;
  }

  forkParallelUniverse(documentId: string, label: string): ForkResult {
    const doc = this.documents.get(documentId);
    if (!doc) throw new Error(`Document ${documentId} not found`);

    const forkId = `fork-${label}-${Date.now()}`;
    const forkDoc: CRDTDocument = {
      id: forkId,
      name: `${doc.name} [fork: ${label}]`,
      nodes: new Map([...doc.nodes].map(([id, node]) => [id, { ...node, pendingOps: [], conflictMarkers: [] }])),
      peers: new Set([this.localPeerId]),
      history: [...doc.history],
      forks: new Map(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    doc.forks.set(forkId, forkDoc);
    this.documents.set(forkId, forkDoc);

    const lastOp = doc.history[doc.history.length - 1];
    return { forkId, forkDocument: forkDoc, divergePointOp: lastOp?.id ?? 'start' };
  }

  getDocument(documentId: string): CRDTDocument | undefined {
    return this.documents.get(documentId);
  }

  getSession(sessionId: string): CollaborationSession | undefined {
    return this.sessions.get(sessionId);
  }

  getConflicts(documentId: string): ConflictMarker[] {
    const doc = this.documents.get(documentId);
    if (!doc) return [];
    const conflicts: ConflictMarker[] = [];
    for (const node of doc.nodes.values()) {
      conflicts.push(...node.conflictMarkers);
    }
    return conflicts;
  }

  private createNode(
    id: string,
    payload: Partial<SemanticCRDTNode>,
    createdBy: string,
    vectorClock: VectorClock,
  ): SemanticCRDTNode {
    return {
      id,
      type: (payload.type ?? 'text') as NodeType,
      content: (payload.content as string) ?? '',
      vectorClock,
      createdBy,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      parentId: payload.parentId,
      children: [],
      semanticTags: payload.semanticTags ?? [],
      tasteScore: payload.tasteScore ?? 0.5,
      pendingOps: [],
      conflictMarkers: [],
    };
  }

  private isConcurrentOp(nodeVC: VectorClock, opVC: VectorClock): boolean {
    // Concurrent if neither dominates the other
    const nodeDominates = Object.entries(nodeVC).every(([peer, ts]) => (opVC[peer] ?? 0) <= ts);
    const opDominates = Object.entries(opVC).every(([peer, ts]) => (nodeVC[peer] ?? 0) <= ts);
    return !nodeDominates && !opDominates;
  }
}

export interface ConflictResolver {
  resolve(node: SemanticCRDTNode, op: CRDTOperation): string | null;
}

export class DefaultConflictResolver implements ConflictResolver {
  resolve(node: SemanticCRDTNode, op: CRDTOperation): string | null {
    // Last-write-wins: higher vector clock timestamp wins
    const nodeTotal = Object.values(node.vectorClock).reduce((s, v) => s + v, 0);
    const opTotal = Object.values(op.vectorClock).reduce((s, v) => s + v, 0);
    if (opTotal > nodeTotal) {
      const payload = op.payload as { content?: string };
      return payload.content ?? null;
    }
    return node.content;
  }
}

function mergeVectorClocks(a: VectorClock, b: VectorClock): VectorClock {
  const merged: VectorClock = { ...a };
  for (const [peer, ts] of Object.entries(b)) {
    merged[peer] = Math.max(merged[peer] ?? 0, ts);
  }
  return merged;
}
