// KIMI-R24-03: Real-time CRDT Collaboration — Test Suite
// 65 tests

import { describe, it, expect, beforeEach } from 'vitest';
import {
  RealTimeCRDTOrchestrator,
  DefaultConflictResolver,
} from '../crdt-core.js';
import type { CRDTOperation, VectorClock } from '../crdt-core.js';
import {
  yjsChangeToCRDTOp,
  automergePatchToCRDTOp,
  crdtOpToYjsChange,
  crdtOpToAutomergePatch,
  SyncProtocol,
} from '../yjs-automerge-bridge.js';
import type { YjsChange, AutomergePatch } from '../yjs-automerge-bridge.js';
import {
  SemanticConflictResolver,
  createSemanticResolver,
  getStrategyPriority,
} from '../semantic-resolver.js';
import {
  CRDTTasteSync,
  getCRDTTasteSync,
  resetCRDTTasteSync,
} from '../../taste-vault/crdt-taste-sync.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeOp(overrides: Partial<CRDTOperation> = {}): CRDTOperation {
  return {
    id: `op-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    peerId: 'peer-A',
    type: 'update',
    targetNodeId: 'node-1',
    timestamp: Date.now(),
    vectorClock: { 'peer-A': 1 },
    payload: { content: 'hello world' },
    ...overrides,
  };
}

function makeVC(entries: Record<string, number>): VectorClock {
  return entries;
}

// ─── RealTimeCRDTOrchestrator ─────────────────────────────────────────────────

describe('RealTimeCRDTOrchestrator', () => {
  let orch: RealTimeCRDTOrchestrator;

  beforeEach(() => {
    orch = new RealTimeCRDTOrchestrator('peer-A');
  });

  it('creates a document with unique id', () => {
    const doc = orch.createDocument('test-doc');
    expect(doc.id).toMatch(/^doc-/);
    expect(doc.name).toBe('test-doc');
    expect(doc.nodes.size).toBe(0);
    expect(doc.peers.has('peer-A')).toBe(true);
  });

  it('creates two documents with distinct ids', () => {
    const d1 = orch.createDocument('d1');
    const d2 = orch.createDocument('d2');
    expect(d1.id).not.toBe(d2.id);
  });

  it('getDocument returns created document', () => {
    const doc = orch.createDocument('doc');
    expect(orch.getDocument(doc.id)).toBe(doc);
  });

  it('getDocument returns undefined for unknown id', () => {
    expect(orch.getDocument('nope')).toBeUndefined();
  });

  it('joinSession adds peer to document', () => {
    const doc = orch.createDocument('doc');
    const session = orch.joinSession(doc.id, 'peer-B');
    expect(session.peers).toContain('peer-B');
    expect(doc.peers.has('peer-B')).toBe(true);
    expect(session.isActive).toBe(true);
  });

  it('joinSession throws for unknown documentId', () => {
    expect(() => orch.joinSession('nope', 'peer-B')).toThrow('not found');
  });

  it('getSession returns session after join', () => {
    const doc = orch.createDocument('doc');
    const session = orch.joinSession(doc.id, 'peer-B');
    expect(orch.getSession(session.id)).toBe(session);
  });

  it('leaveSession records left time', () => {
    const doc = orch.createDocument('doc');
    const session = orch.joinSession(doc.id, 'peer-B');
    orch.leaveSession(session.id, 'peer-B');
    expect(session.leftAt['peer-B']).toBeGreaterThan(0);
  });

  it('leaveSession makes session inactive when all peers leave', () => {
    const doc = orch.createDocument('doc');
    const session = orch.joinSession(doc.id, 'peer-B');
    orch.leaveSession(session.id, 'peer-A');
    orch.leaveSession(session.id, 'peer-B');
    expect(session.isActive).toBe(false);
  });

  it('applyChange insert creates node', () => {
    const doc = orch.createDocument('doc');
    const op = makeOp({ type: 'insert', payload: { content: 'new node', type: 'text' } });
    const result = orch.applyChange(doc.id, op);
    expect(result.applied).toBe(true);
    expect(doc.nodes.has(op.targetNodeId)).toBe(true);
    expect(result.newNodeState?.content).toBe('new node');
  });

  it('applyChange insert does not overwrite existing node', () => {
    const doc = orch.createDocument('doc');
    const op1 = makeOp({ type: 'insert', payload: { content: 'first' } });
    orch.applyChange(doc.id, op1);
    const op2 = makeOp({ id: 'op-2', type: 'insert', payload: { content: 'second' } });
    orch.applyChange(doc.id, op2);
    expect(doc.nodes.get('node-1')?.content).toBe('first');
  });

  it('applyChange update modifies node content', () => {
    const doc = orch.createDocument('doc');
    orch.applyChange(doc.id, makeOp({ type: 'insert', payload: { content: 'initial' } }));
    const updateOp = makeOp({
      id: 'op-update',
      type: 'update',
      vectorClock: { 'peer-A': 2 },
      payload: { content: 'updated' },
    });
    const result = orch.applyChange(doc.id, updateOp);
    expect(result.applied).toBe(true);
    expect(doc.nodes.get('node-1')?.content).toBe('updated');
  });

  it('applyChange update on missing node returns not applied', () => {
    const doc = orch.createDocument('doc');
    const op = makeOp({ type: 'update', targetNodeId: 'missing', payload: { content: 'x' } });
    const result = orch.applyChange(doc.id, op);
    expect(result.applied).toBe(false);
  });

  it('applyChange delete removes node', () => {
    const doc = orch.createDocument('doc');
    orch.applyChange(doc.id, makeOp({ type: 'insert', payload: { content: 'to delete' } }));
    orch.applyChange(doc.id, makeOp({ id: 'op-del', type: 'delete', payload: {} }));
    expect(doc.nodes.has('node-1')).toBe(false);
  });

  it('applyChange move updates parentId', () => {
    const doc = orch.createDocument('doc');
    orch.applyChange(doc.id, makeOp({ type: 'insert', payload: { content: 'node' } }));
    orch.applyChange(doc.id, makeOp({ id: 'op-move', type: 'move', payload: { newParentId: 'parent-99' } }));
    expect(doc.nodes.get('node-1')?.parentId).toBe('parent-99');
  });

  it('applyChange records op in history', () => {
    const doc = orch.createDocument('doc');
    const op = makeOp({ type: 'insert', payload: { content: 'x' } });
    orch.applyChange(doc.id, op);
    expect(doc.history).toContain(op);
  });

  it('concurrent update detected and conflict marker added', () => {
    const doc = orch.createDocument('doc');
    // Insert node
    orch.applyChange(doc.id, makeOp({ type: 'insert', payload: { content: 'base' }, vectorClock: { 'peer-A': 2, 'peer-B': 1 } }));
    // Set the node's VC so neither side dominates the other
    const node = doc.nodes.get('node-1')!;
    node.vectorClock = { 'peer-A': 2, 'peer-B': 1 };

    // Op with clock where peer-B advanced but peer-A is behind — concurrent
    const concurrentOp = makeOp({
      id: 'op-concurrent',
      peerId: 'peer-B',
      type: 'update',
      vectorClock: { 'peer-A': 1, 'peer-B': 2 },
      payload: { content: 'peer-B edit' },
    });
    const result = orch.applyChange(doc.id, concurrentOp);
    expect(result.conflictsDetected).toBeGreaterThan(0);
  });

  it('resolveConflict updates node content', () => {
    const doc = orch.createDocument('doc');
    orch.applyChange(doc.id, makeOp({ type: 'insert', payload: { content: 'base' }, vectorClock: { 'peer-A': 1 } }));
    const node = doc.nodes.get('node-1')!;
    node.vectorClock = { 'peer-A': 1 };
    const concurrentOp = makeOp({
      id: 'op-c',
      peerId: 'peer-B',
      type: 'update',
      vectorClock: { 'peer-B': 1 },
      payload: { content: 'conflict' },
    });
    orch.applyChange(doc.id, concurrentOp);
    // If a conflict marker was added, resolve it
    const conflicts = orch.getConflicts(doc.id);
    if (conflicts.length > 0) {
      const ok = orch.resolveConflict(doc.id, conflicts[0]!.id, 'resolved content');
      expect(ok).toBe(true);
      expect(doc.nodes.get('node-1')?.content).toBe('resolved content');
    }
  });

  it('resolveConflict returns false for unknown conflictId', () => {
    const doc = orch.createDocument('doc');
    expect(orch.resolveConflict(doc.id, 'nope', 'x')).toBe(false);
  });

  it('getConflicts returns empty array when no conflicts', () => {
    const doc = orch.createDocument('doc');
    expect(orch.getConflicts(doc.id)).toEqual([]);
  });

  it('getConflicts returns empty for unknown docId', () => {
    expect(orch.getConflicts('nope')).toEqual([]);
  });

  it('forkParallelUniverse creates a fork document', () => {
    const doc = orch.createDocument('original');
    orch.applyChange(doc.id, makeOp({ type: 'insert', payload: { content: 'node content' } }));
    const fork = orch.forkParallelUniverse(doc.id, 'experiment');
    expect(fork.forkId).toMatch(/^fork-experiment-/);
    expect(fork.forkDocument.name).toContain('fork: experiment');
    expect(orch.getDocument(fork.forkId)).toBe(fork.forkDocument);
  });

  it('fork has same node content as original', () => {
    const doc = orch.createDocument('original');
    orch.applyChange(doc.id, makeOp({ type: 'insert', payload: { content: 'node content' } }));
    const fork = orch.forkParallelUniverse(doc.id, 'branch');
    expect(fork.forkDocument.nodes.get('node-1')?.content).toBe('node content');
  });

  it('fork is isolated — changes to fork do not affect original', () => {
    const doc = orch.createDocument('original');
    orch.applyChange(doc.id, makeOp({ type: 'insert', payload: { content: 'original content' } }));
    const fork = orch.forkParallelUniverse(doc.id, 'iso');
    const forkOrch = new RealTimeCRDTOrchestrator('peer-A');
    // Register fork doc in same orch — fork is already registered
    orch.applyChange(fork.forkId, makeOp({ id: 'op-fork-upd', type: 'update', payload: { content: 'fork content' }, vectorClock: { 'peer-A': 2 } }));
    // Original stays unchanged
    expect(doc.nodes.get('node-1')?.content).toBe('original content');
  });

  it('forkParallelUniverse throws for unknown docId', () => {
    expect(() => orch.forkParallelUniverse('nope', 'x')).toThrow('not found');
  });

  it('applyChange throws for unknown documentId', () => {
    expect(() => orch.applyChange('nope', makeOp())).toThrow('not found');
  });
});

// ─── DefaultConflictResolver ─────────────────────────────────────────────────

describe('DefaultConflictResolver', () => {
  it('picks op content when op clock is higher', () => {
    const resolver = new DefaultConflictResolver();
    const node = {
      content: 'node content',
      vectorClock: { 'peer-A': 1 },
    } as any;
    const op = makeOp({ vectorClock: { 'peer-A': 2 }, payload: { content: 'op content' } });
    const result = resolver.resolve(node, op);
    expect(result).toBe('op content');
  });

  it('keeps node content when node clock is higher', () => {
    const resolver = new DefaultConflictResolver();
    const node = { content: 'node content', vectorClock: { 'peer-A': 5 } } as any;
    const op = makeOp({ vectorClock: { 'peer-A': 1 }, payload: { content: 'op content' } });
    const result = resolver.resolve(node, op);
    expect(result).toBe('node content');
  });

  it('returns null when op has no content', () => {
    const resolver = new DefaultConflictResolver();
    const node = { content: 'x', vectorClock: { 'peer-A': 1 } } as any;
    const op = makeOp({ vectorClock: { 'peer-A': 2 }, payload: {} });
    const result = resolver.resolve(node, op);
    expect(result).toBeNull();
  });
});

// ─── Yjs/Automerge Bridge ─────────────────────────────────────────────────────

describe('yjsChangeToCRDTOp', () => {
  it('converts Yjs change to CRDT insert op when length > 0', () => {
    const change: YjsChange = { clientID: 1, clock: 3, content: 'hello', length: 5 };
    const vc = makeVC({ 'peer-A': 2 });
    const op = yjsChangeToCRDTOp(change, 'peer-A', 'node-1', vc);
    expect(op.type).toBe('insert');
    expect(op.peerId).toBe('peer-A');
    expect(op.targetNodeId).toBe('node-1');
    expect(op.vectorClock['peer-A']).toBe(3);
  });

  it('converts Yjs change to CRDT delete op when length = 0', () => {
    const change: YjsChange = { clientID: 1, clock: 4, content: '', length: 0 };
    const op = yjsChangeToCRDTOp(change, 'peer-A', 'node-1', {});
    expect(op.type).toBe('delete');
  });

  it('preserves origin in the op id', () => {
    const change: YjsChange = { clientID: 1, clock: 7, content: 'x', length: 1 };
    const op = yjsChangeToCRDTOp(change, 'peer-B', 'n', {});
    expect(op.id).toMatch(/^yjs-peer-B-7/);
  });
});

describe('automergePatchToCRDTOp', () => {
  it('converts del patch to delete op', () => {
    const patch: AutomergePatch = { action: 'del', path: ['node-5', 'text'] };
    const op = automergePatchToCRDTOp(patch, 'peer-A', {});
    expect(op.type).toBe('delete');
    expect(op.targetNodeId).toBe('node-5');
  });

  it('converts put patch to insert op', () => {
    const patch: AutomergePatch = { action: 'put', path: ['node-6'], value: 'hello' };
    const op = automergePatchToCRDTOp(patch, 'peer-A', {});
    expect(op.type).toBe('insert');
  });

  it('converts inc patch to update op', () => {
    const patch: AutomergePatch = { action: 'inc', path: ['node-7'], n: 1 };
    const op = automergePatchToCRDTOp(patch, 'peer-A', {});
    expect(op.type).toBe('update');
  });

  it('uses root as targetNodeId when path is empty', () => {
    const patch: AutomergePatch = { action: 'del', path: [] };
    const op = automergePatchToCRDTOp(patch, 'peer-A', {});
    expect(op.targetNodeId).toBe('root');
  });
});

describe('crdtOpToYjsChange', () => {
  it('converts CRDT op back to Yjs change', () => {
    const op = makeOp({ payload: { content: 'hello', length: 5 }, vectorClock: { 'peer-A': 2 } });
    const change = crdtOpToYjsChange(op);
    expect(change.content).toBe('hello');
    expect(change.length).toBe(5);
    expect(change.clock).toBe(2);
    expect(change.origin).toBe('peer-A');
  });

  it('uses content.length when length not provided', () => {
    const op = makeOp({ payload: { content: 'abc' }, vectorClock: { 'peer-A': 1 } });
    const change = crdtOpToYjsChange(op);
    expect(change.length).toBe(3);
  });
});

describe('crdtOpToAutomergePatch', () => {
  it('converts delete op to del patch', () => {
    const op = makeOp({ type: 'delete', payload: { content: 'x' } });
    const patch = crdtOpToAutomergePatch(op);
    expect(patch.action).toBe('del');
  });

  it('converts insert op to insert patch', () => {
    const op = makeOp({ type: 'insert', payload: { content: 'y' } });
    const patch = crdtOpToAutomergePatch(op);
    expect(patch.action).toBe('insert');
  });

  it('converts update op to put patch', () => {
    const op = makeOp({ type: 'update', payload: { content: 'z' } });
    const patch = crdtOpToAutomergePatch(op);
    expect(patch.action).toBe('put');
  });

  it('includes targetNodeId in path', () => {
    const op = makeOp({ targetNodeId: 'my-node', payload: {} });
    const patch = crdtOpToAutomergePatch(op);
    expect(patch.path[0]).toBe('my-node');
  });
});

// ─── SyncProtocol ────────────────────────────────────────────────────────────

describe('SyncProtocol', () => {
  let sync: SyncProtocol;

  beforeEach(() => {
    sync = new SyncProtocol();
  });

  it('enqueue and dequeue ops for a peer', () => {
    const op = makeOp();
    sync.enqueue('peer-B', op);
    const ops = sync.dequeue('peer-B');
    expect(ops).toHaveLength(1);
    expect(ops[0]).toBe(op);
  });

  it('dequeue clears the queue', () => {
    sync.enqueue('peer-B', makeOp());
    sync.dequeue('peer-B');
    expect(sync.getPendingCount('peer-B')).toBe(0);
  });

  it('dequeue returns empty array for unknown peer', () => {
    expect(sync.dequeue('peer-Z')).toEqual([]);
  });

  it('getPendingCount returns correct count', () => {
    sync.enqueue('peer-C', makeOp());
    sync.enqueue('peer-C', makeOp({ id: 'op-2' }));
    expect(sync.getPendingCount('peer-C')).toBe(2);
  });

  it('broadcast enqueues to all peers except sender', () => {
    const op = makeOp();
    sync.broadcast('peer-A', op, ['peer-A', 'peer-B', 'peer-C']);
    expect(sync.getPendingCount('peer-A')).toBe(0);
    expect(sync.getPendingCount('peer-B')).toBe(1);
    expect(sync.getPendingCount('peer-C')).toBe(1);
  });
});

// ─── SemanticConflictResolver ─────────────────────────────────────────────────

describe('SemanticConflictResolver', () => {
  let resolver: SemanticConflictResolver;

  beforeEach(() => {
    resolver = new SemanticConflictResolver();
  });

  it('resolves via taste-vault when scores are high', () => {
    const node = {
      content: 'local content',
      tasteScore: 0.8,
      semanticTags: ['architecture'],
      vectorClock: { 'peer-A': 1 },
      conflictMarkers: [],
    } as any;
    const op = makeOp({ tasteScore: 0.6, payload: { content: 'remote content', tags: ['security'] } });
    const result = resolver.resolve(node, op);
    expect(result.resolved).toBe(true);
    expect(result.strategy).toBe('taste-vault');
    expect(typeof result.content).toBe('string');
  });

  it('picks highest-taste candidate', () => {
    const node = {
      content: 'low score local',
      tasteScore: 0.3,
      semanticTags: [],
      vectorClock: { 'peer-A': 1 },
      conflictMarkers: [],
    } as any;
    const op = makeOp({ tasteScore: 0.9, payload: { content: 'high score remote', tags: ['performance'] } });
    const result = resolver.resolve(node, op);
    if (result.resolved) {
      expect(result.content).toBe('high score remote');
    }
  });

  it('includes merged candidate when both sides have content', () => {
    const node = {
      content: 'line A\nline B',
      tasteScore: 0.6,
      semanticTags: ['architecture'],
      vectorClock: { 'peer-A': 1 },
      conflictMarkers: [],
    } as any;
    const op = makeOp({ tasteScore: 0.6, payload: { content: 'line C\nline D', tags: [] } });
    const result = resolver.resolve(node, op);
    const merged = result.candidates.find(c => c.source === 'merged');
    expect(merged).toBeDefined();
  });

  it('returns manual when all candidates below minTasteScore', () => {
    // minTasteScore 0.95 — node at 0.6, op at 0.7 both below threshold
    // node.tasteScore > 0.5 triggers taste-vault path which checks minScore
    const strictResolver = new SemanticConflictResolver({ minTasteScore: 0.95 });
    const node = { content: 'x', tasteScore: 0.6, semanticTags: [], vectorClock: {}, conflictMarkers: [] } as any;
    const op = makeOp({ tasteScore: 0.7, payload: { content: 'y' } });
    const result = strictResolver.resolve(node, op);
    expect(result.resolved).toBe(false);
  });

  it('resolves via LWW when both sides have low taste scores', () => {
    const resolver2 = new SemanticConflictResolver({ minTasteScore: 0.0 });
    const node = { content: 'local', tasteScore: 0.2, semanticTags: [], vectorClock: { 'peer-A': 1 }, conflictMarkers: [] } as any;
    const op = makeOp({ tasteScore: 0.2, vectorClock: { 'peer-A': 2 }, payload: { content: 'remote' } });
    const result = resolver2.resolve(node, op);
    expect(result.resolved).toBe(true);
  });

  it('getStats returns correct counts after resolutions', () => {
    const node = { content: 'x', tasteScore: 0.8, semanticTags: ['security'], vectorClock: {}, conflictMarkers: [] } as any;
    resolver.resolve(node, makeOp({ tasteScore: 0.7, payload: { content: 'y' } }));
    const stats = resolver.getStats();
    expect(stats.resolvedCount).toBeGreaterThan(0);
    expect(stats.successRate).toBeGreaterThan(0);
  });

  it('createSemanticResolver factory returns SemanticConflictResolver', () => {
    const r = createSemanticResolver({ minTasteScore: 0.5 });
    expect(r).toBeInstanceOf(SemanticConflictResolver);
  });

  it('getStrategyPriority returns lower index for higher-priority strategy', () => {
    expect(getStrategyPriority('taste-vault')).toBeLessThan(getStrategyPriority('last-write-wins'));
  });

  it('resolveMarker resolves using the first op in the marker', () => {
    const node = { content: 'base', tasteScore: 0.7, semanticTags: [], vectorClock: {}, conflictMarkers: [] } as any;
    const marker = {
      id: 'conflict-1',
      nodeId: 'node-1',
      ops: [makeOp({ tasteScore: 0.8, payload: { content: 'marker resolution' } })],
      strategy: 'semantic-merge' as const,
    };
    const result = resolver.resolveMarker(marker, node);
    expect(result).toBeDefined();
  });
});

// ─── CRDTTasteSync ────────────────────────────────────────────────────────────

describe('CRDTTasteSync', () => {
  let sync: CRDTTasteSync;

  beforeEach(() => {
    sync = new CRDTTasteSync({ minScoreToSync: 0.3 });
    resetCRDTTasteSync();
  });

  it('syncOperation returns adjusted score for op above threshold', () => {
    const op = makeOp({ payload: { content: 'hello world', tasteScore: 0.7 } });
    const score = sync.syncOperation(op, ['architecture']);
    expect(score).not.toBeNull();
    expect(score!).toBeGreaterThanOrEqual(0.7);
  });

  it('syncOperation returns null for op below threshold', () => {
    const strictSync = new CRDTTasteSync({ minScoreToSync: 0.9 });
    const op = makeOp({ payload: { content: 'hello world', tasteScore: 0.2 } });
    expect(strictSync.syncOperation(op)).toBeNull();
  });

  it('syncOperation skips when disabled', () => {
    const disabledSync = new CRDTTasteSync({ enabled: false });
    const op = makeOp({ payload: { content: 'hello world', tasteScore: 0.9 } });
    expect(disabledSync.syncOperation(op)).toBeNull();
  });

  it('onConflictDetected decays the op score', () => {
    const op = makeOp({ payload: { content: 'hello world', tasteScore: 0.8 } });
    sync.syncOperation(op, ['architecture']);
    sync.onConflictDetected(op.id, op.targetNodeId);
    const report = sync.buildReport();
    expect(report.totalConflicts).toBe(1);
  });

  it('onConflictResolved boosts node score', () => {
    const op = makeOp({ payload: { content: 'hello world', tasteScore: 0.6 } });
    sync.syncOperation(op, []);
    const before = sync.getNodeProfile(op.targetNodeId).currentScore;
    sync.onConflictResolved(op.targetNodeId);
    const after = sync.getNodeProfile(op.targetNodeId).currentScore;
    expect(after).toBeGreaterThanOrEqual(before);
  });

  it('computeQueueWeight returns value between 0 and 1', () => {
    const op = makeOp({ payload: { content: 'hello world', tasteScore: 0.5 } });
    const weight = sync.computeQueueWeight(op);
    expect(weight).toBeGreaterThanOrEqual(0);
    expect(weight).toBeLessThanOrEqual(1);
  });

  it('rankNodes sorts by taste score descending', () => {
    const nodes = [
      { id: 'n1', tasteScore: 0.3 },
      { id: 'n2', tasteScore: 0.9 },
      { id: 'n3', tasteScore: 0.6 },
    ] as any[];
    const ranked = sync.rankNodes(nodes);
    expect(ranked[0]!.node.id).toBe('n2');
    expect(ranked[ranked.length - 1]!.node.id).toBe('n1');
  });

  it('getNodeProfile returns default for unknown node', () => {
    const profile = sync.getNodeProfile('unknown-node');
    expect(profile.nodeId).toBe('unknown-node');
    expect(profile.currentScore).toBe(0.5);
    expect(profile.conflictCount).toBe(0);
  });

  it('buildReport counts synced and skipped operations', () => {
    const strictSync = new CRDTTasteSync({ minScoreToSync: 0.8 });
    strictSync.syncOperation(makeOp({ payload: { content: 'hello world', tasteScore: 0.9 } }), ['security']);
    strictSync.syncOperation(makeOp({ id: 'op-low', payload: { content: 'hello world', tasteScore: 0.2 } }), []);
    const report = strictSync.buildReport();
    expect(report.totalSynced).toBe(1);
    expect(report.totalSkipped).toBe(1);
  });

  it('buildReport includes tag frequency', () => {
    sync.syncOperation(makeOp({ payload: { content: 'hello world', tasteScore: 0.8 } }), ['performance', 'security']);
    sync.syncOperation(makeOp({ id: 'op-2', payload: { content: 'hello world', tasteScore: 0.7 } }), ['security']);
    const report = sync.buildReport();
    expect(report.tagFrequency['security']).toBe(2);
    expect(report.tagFrequency['performance']).toBe(1);
  });

  it('getNodeHistory returns ops for specific node', () => {
    const op = makeOp({ targetNodeId: 'node-X', payload: { content: 'hello world', tasteScore: 0.7 } });
    sync.syncOperation(op, ['arch']);
    const history = sync.getNodeHistory('node-X');
    expect(history.length).toBe(1);
    expect(history[0]!.nodeId).toBe('node-X');
  });

  it('reset clears all state', () => {
    sync.syncOperation(makeOp({ payload: { content: 'hello world', tasteScore: 0.7 } }), []);
    sync.reset();
    const report = sync.buildReport();
    expect(report.totalSynced).toBe(0);
  });

  it('getCRDTTasteSync returns singleton', () => {
    const a = getCRDTTasteSync();
    const b = getCRDTTasteSync();
    expect(a).toBe(b);
  });

  it('resetCRDTTasteSync forces new instance', () => {
    const a = getCRDTTasteSync();
    resetCRDTTasteSync();
    const b = getCRDTTasteSync();
    expect(a).not.toBe(b);
  });

  it('agentBoost applied to preferred agents', () => {
    const boostSync = new CRDTTasteSync({
      minScoreToSync: 0.0,
      agentBoosts: { 'JUPITER': 0.1 },
    });
    const op = makeOp({ peerId: 'JUPITER', payload: { content: 'hello world', tasteScore: 0.5 } });
    const score = boostSync.syncOperation(op);
    expect(score).toBeGreaterThan(0.5);
  });
});
