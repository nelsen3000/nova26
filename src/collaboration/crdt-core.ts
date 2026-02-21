// Real-time CRDT Orchestrator — KIMI-R24-03
// Implements operational-transform CRDT with vector clock conflict detection.

import { randomUUID } from 'node:crypto';

// ─── Core Types ───────────────────────────────────────────────────────────────

export type VectorClock = Record<string, number>;

export interface CRDTOperation {
  id: string;
  peerId: string;
  type: 'insert' | 'update' | 'delete' | 'move';
  targetNodeId: string;
  timestamp: number;
  vectorClock: VectorClock;
  payload: {
    content?: string;
    type?: string;
    newParentId?: string;
    [key: string]: unknown;
  };
}

export interface CRDTNode {
  id: string;
  content: string;
  type: string;
  parentId?: string;
  vectorClock: VectorClock;
  hasConflict?: boolean;
}

export interface CRDTDocument {
  id: string;
  name: string;
  nodes: Map<string, CRDTNode>;
  peers: Set<string>;
  vectorClock: VectorClock;
  history: CRDTOperation[];
}

export interface CRDTSession {
  id: string;
  documentId: string;
  peers: string[];
  isActive: boolean;
  joinedAt: number;
  leftAt: Record<string, number>;
}

export interface ConflictMarker {
  id: string;
  nodeId: string;
  op: CRDTOperation;
}

export interface ForkResult {
  forkId: string;
  forkDocument: CRDTDocument;
}

export interface ApplyResult {
  applied: boolean;
  newNodeState?: CRDTNode;
  conflictsDetected: number;
}

// ─── Vector Clock Helpers ─────────────────────────────────────────────────────

/**
 * Returns true if VC `a` dominates (happens-after) VC `b`.
 * a dominates b iff for all keys: a[k] >= b[k] and for some key: a[k] > b[k].
 */
function vcDominates(a: VectorClock, b: VectorClock): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let strictlyGreater = false;
  for (const k of keys) {
    const av = a[k] ?? 0;
    const bv = b[k] ?? 0;
    if (av < bv) return false;
    if (av > bv) strictlyGreater = true;
  }
  return strictlyGreater;
}

/**
 * Returns true if the two VCs are concurrent (neither dominates the other).
 */
function isConcurrentOp(nodeVC: VectorClock, opVC: VectorClock): boolean {
  return !vcDominates(nodeVC, opVC) && !vcDominates(opVC, nodeVC);
}

/**
 * Total sum of all VC values (used for LWW tie-breaking).
 */
function vcSum(vc: VectorClock): number {
  return Object.values(vc).reduce((s, v) => s + v, 0);
}

// ─── DefaultConflictResolver ──────────────────────────────────────────────────

/**
 * LWW resolver: compares total VC sums. Op wins if its sum is higher.
 * Returns null if op has no content.
 */
export class DefaultConflictResolver {
  resolve(node: { content: string; vectorClock: VectorClock }, op: CRDTOperation): string | null {
    if (op.payload.content === undefined) return null;
    const opSum = vcSum(op.vectorClock);
    const nodeSum = vcSum(node.vectorClock);
    return opSum > nodeSum ? (op.payload.content as string) : node.content;
  }
}

// ─── RealTimeCRDTOrchestrator ─────────────────────────────────────────────────

/**
 * RealTimeCRDTOrchestrator — manages collaborative documents with CRDT operations.
 * Tracks sessions, applies changes with conflict detection, and supports forking.
 */
export class RealTimeCRDTOrchestrator {
  private peerId: string;
  private documents = new Map<string, CRDTDocument>();
  private sessions = new Map<string, CRDTSession>();
  private conflicts = new Map<string, ConflictMarker[]>(); // docId → markers

  private conflictResolver: DefaultConflictResolver;

  constructor(peerId: string) {
    this.peerId = peerId;
    this.conflictResolver = new DefaultConflictResolver();
  }

  /**
   * Create a new collaborative document.
   */
  createDocument(name: string): CRDTDocument {
    const id = `doc-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const doc: CRDTDocument = {
      id,
      name,
      nodes: new Map(),
      peers: new Set([this.peerId]),
      vectorClock: {},
      history: [],
    };
    this.documents.set(id, doc);
    this.conflicts.set(id, []);
    return doc;
  }

  /**
   * Get a document by ID. Returns undefined if not found.
   */
  getDocument(id: string): CRDTDocument | undefined {
    return this.documents.get(id);
  }

  /**
   * Join a collaborative session on a document.
   * Throws if document not found.
   */
  joinSession(docId: string, peerId: string): CRDTSession {
    const doc = this.documents.get(docId);
    if (!doc) throw new Error(`Document not found: ${docId}`);

    // Add peer to document
    doc.peers.add(peerId);

    const sessionId = `session-${Date.now()}-${randomUUID().slice(0, 6)}`;
    const session: CRDTSession = {
      id: sessionId,
      documentId: docId,
      peers: [...doc.peers],
      isActive: true,
      joinedAt: Date.now(),
      leftAt: {},
    };
    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * Get a session by ID.
   */
  getSession(sessionId: string): CRDTSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Record a peer leaving a session. When all peers have left, deactivates session.
   */
  leaveSession(sessionId: string, peerId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.leftAt[peerId] = Date.now();

    // Deactivate when all peers have left
    const allLeft = session.peers.every(p => session.leftAt[p] !== undefined);
    if (allLeft) session.isActive = false;
  }

  /**
   * Apply a CRDT operation to a document.
   * Throws if document not found.
   * Returns ApplyResult with applied flag, new node state, and conflict count.
   */
  applyChange(docId: string, op: CRDTOperation): ApplyResult {
    const doc = this.documents.get(docId);
    if (!doc) throw new Error(`Document not found: ${docId}`);

    doc.history.push(op);
    let conflictsDetected = 0;

    switch (op.type) {
      case 'insert': {
        // Idempotent — do not overwrite existing node
        if (doc.nodes.has(op.targetNodeId)) {
          return { applied: false, conflictsDetected: 0 };
        }
        const newNode: CRDTNode = {
          id: op.targetNodeId,
          content: (op.payload.content as string) ?? '',
          type: (op.payload.type as string) ?? 'text',
          vectorClock: { ...op.vectorClock },
        };
        doc.nodes.set(op.targetNodeId, newNode);
        return { applied: true, newNodeState: newNode, conflictsDetected: 0 };
      }

      case 'update': {
        const node = doc.nodes.get(op.targetNodeId);
        if (!node) return { applied: false, conflictsDetected: 0 };

        if (isConcurrentOp(node.vectorClock, op.vectorClock)) {
          // Concurrent — record conflict, apply op's content tentatively
          const marker: ConflictMarker = {
            id: `conflict-${Date.now()}-${randomUUID().slice(0, 6)}`,
            nodeId: op.targetNodeId,
            op,
          };
          const docConflicts = this.conflicts.get(docId) ?? [];
          docConflicts.push(marker);
          this.conflicts.set(docId, docConflicts);
          node.hasConflict = true;
          conflictsDetected = 1;
          // Still apply the content (LWW)
          const resolved = this.conflictResolver.resolve(node, op);
          if (resolved !== null) node.content = resolved;
          node.vectorClock = { ...op.vectorClock };
          return { applied: true, newNodeState: { ...node }, conflictsDetected };
        }

        // Non-concurrent — apply if op dominates
        if (op.payload.content !== undefined) {
          node.content = op.payload.content as string;
        }
        node.vectorClock = { ...op.vectorClock };
        return { applied: true, newNodeState: { ...node }, conflictsDetected: 0 };
      }

      case 'delete': {
        const deleted = doc.nodes.delete(op.targetNodeId);
        return { applied: deleted, conflictsDetected: 0 };
      }

      case 'move': {
        const node = doc.nodes.get(op.targetNodeId);
        if (!node) return { applied: false, conflictsDetected: 0 };
        node.parentId = op.payload.newParentId as string | undefined;
        node.vectorClock = { ...op.vectorClock };
        return { applied: true, newNodeState: { ...node }, conflictsDetected: 0 };
      }

      default:
        return { applied: false, conflictsDetected: 0 };
    }
  }

  /**
   * Get all conflict markers for a document.
   */
  getConflicts(docId: string): ConflictMarker[] {
    return this.conflicts.get(docId) ?? [];
  }

  /**
   * Resolve a conflict by setting the node content and removing the marker.
   */
  resolveConflict(docId: string, conflictId: string, content: string): boolean {
    const doc = this.documents.get(docId);
    if (!doc) return false;

    const docConflicts = this.conflicts.get(docId) ?? [];
    const idx = docConflicts.findIndex(c => c.id === conflictId);
    if (idx === -1) return false;

    const marker = docConflicts[idx]!;
    const node = doc.nodes.get(marker.nodeId);
    if (node) {
      node.content = content;
      node.hasConflict = false;
    }
    docConflicts.splice(idx, 1);
    this.conflicts.set(docId, docConflicts);
    return true;
  }

  /**
   * Fork a document into a new parallel universe.
   * The fork is a deep copy of the original's nodes.
   */
  forkParallelUniverse(docId: string, label: string): ForkResult {
    const doc = this.documents.get(docId);
    if (!doc) throw new Error(`Document not found: ${docId}`);

    const forkId = `fork-${label}-${Date.now()}`;
    const forkNodes = new Map<string, CRDTNode>();
    for (const [k, node] of doc.nodes) {
      forkNodes.set(k, { ...node, vectorClock: { ...node.vectorClock } });
    }

    const forkDocument: CRDTDocument = {
      id: forkId,
      name: `fork: ${label} (${doc.name})`,
      nodes: forkNodes,
      peers: new Set([...doc.peers]),
      vectorClock: { ...doc.vectorClock },
      history: [...doc.history],
    };

    this.documents.set(forkId, forkDocument);
    this.conflicts.set(forkId, []);
    return { forkId, forkDocument };
  }
}

/**
 * Factory function to create a RealTimeCRDTOrchestrator instance
 */
export function createCRDTOrchestrator(peerId: string = 'local-peer'): RealTimeCRDTOrchestrator {
  return new RealTimeCRDTOrchestrator(peerId);
}
