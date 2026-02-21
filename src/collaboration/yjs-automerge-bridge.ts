// Yjs/Automerge Bridge — Compatibility layer for existing CRDT libraries
// KIMI-R24-03 | Feb 2026

import type { CRDTOperation, VectorClock } from './crdt-core.js';

// Yjs-compatible change format
export interface YjsChange {
  clientID: number;
  clock: number;
  content: unknown;
  length: number;
  origin?: string;
}

// Automerge-compatible patch format
export interface AutomergePatch {
  action: 'put' | 'del' | 'inc' | 'insert' | 'splice';
  path: Array<string | number>;
  value?: unknown;
  n?: number;
}

export function yjsChangeToCRDTOp(
  change: YjsChange,
  peerId: string,
  targetNodeId: string,
  vectorClock: VectorClock,
): CRDTOperation {
  return {
    id: `yjs-${peerId}-${change.clock}`,
    peerId,
    type: change.length > 0 ? 'insert' : 'delete',
    targetNodeId,
    timestamp: Date.now(),
    vectorClock: { ...vectorClock, [peerId]: change.clock },
    payload: { content: String(change.content), length: change.length },
  };
}

export function automergePatchToCRDTOp(
  patch: AutomergePatch,
  peerId: string,
  vectorClock: VectorClock,
): CRDTOperation {
  const targetNodeId = patch.path[0]?.toString() ?? 'root';
  const type: CRDTOperation['type'] =
    patch.action === 'del' ? 'delete' :
    patch.action === 'put' || patch.action === 'insert' || patch.action === 'splice' ? 'insert' : 'update';

  return {
    id: `automerge-${peerId}-${Date.now()}`,
    peerId,
    type,
    targetNodeId,
    timestamp: Date.now(),
    vectorClock,
    payload: { value: patch.value, path: patch.path },
  };
}

export function crdtOpToYjsChange(op: CRDTOperation): YjsChange {
  const clock = op.vectorClock[op.peerId] ?? 0;
  const payload = op.payload as { content?: string; length?: number };
  return {
    clientID: hashPeerId(op.peerId),
    clock,
    content: payload.content ?? '',
    length: payload.length ?? (payload.content?.length ?? 0),
    origin: op.peerId,
  };
}

export function crdtOpToAutomergePatch(op: CRDTOperation): AutomergePatch {
  const payload = op.payload as { content?: string; value?: unknown };
  return {
    action: op.type === 'delete' ? 'del' : op.type === 'insert' ? 'insert' : 'put',
    path: [op.targetNodeId],
    value: payload.content ?? payload.value,
  };
}

function hashPeerId(peerId: string): number {
  let h = 0;
  for (const c of peerId) h = (h * 31 + c.charCodeAt(0)) & 0x7fffffff;
  return h;
}

// Simple in-memory sync protocol simulator
export class SyncProtocol {
  private pendingOps = new Map<string, CRDTOperation[]>(); // peerId → pending ops

  enqueue(peerId: string, op: CRDTOperation): void {
    if (!this.pendingOps.has(peerId)) this.pendingOps.set(peerId, []);
    this.pendingOps.get(peerId)!.push(op);
  }

  dequeue(peerId: string): CRDTOperation[] {
    const ops = this.pendingOps.get(peerId) ?? [];
    this.pendingOps.delete(peerId);
    return ops;
  }

  broadcast(fromPeerId: string, op: CRDTOperation, allPeers: string[]): void {
    for (const peer of allPeers) {
      if (peer === fromPeerId) continue;
      this.enqueue(peer, op);
    }
  }

  getPendingCount(peerId: string): number {
    return this.pendingOps.get(peerId)?.length ?? 0;
  }
}
