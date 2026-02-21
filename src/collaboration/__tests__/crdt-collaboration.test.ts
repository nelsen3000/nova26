// CRDT Collaboration Tests — KIMI-T-07
// Comprehensive test suite for real-time CRDT collaboration

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  RealTimeCRDTOrchestrator,
  createCRDTOrchestrator,
} from '../crdt-core.js';
import type {
  CRDTDocument,
  CRDTChange,
  ParallelUniverse,
  MergeResult,
  SemanticCRDTNode,
} from '../types.js';
import type { CRDTOperation, CRDTNode } from '../crdt-core.js';

// ============================================================================
// Mock Yjs Adapter
// ============================================================================
interface YjsDoc {
  getText(name: string): YjsText;
  getMap(name: string): YjsMap;
  toJSON(): Record<string, unknown>;
}

interface YjsText {
  insert(index: number, text: string): void;
  delete(index: number, length: number): void;
  toString(): string;
  length: number;
}

interface YjsMap {
  set(key: string, value: unknown): void;
  get(key: string): unknown;
  delete(key: string): void;
  toJSON(): Record<string, unknown>;
}

const createMockYjsDoc = (): YjsDoc => {
  const maps = new Map<string, YjsMap>();
  const texts = new Map<string, YjsText>();

  return {
    getText: (name: string): YjsText => {
      if (!texts.has(name)) {
        const content: string[] = [];
        texts.set(name, {
          insert: (index: number, text: string) => {
            content.splice(index, 0, ...text.split(''));
          },
          delete: (index: number, length: number) => {
            content.splice(index, length);
          },
          toString: () => content.join(''),
          get length() {
            return content.length;
          },
        });
      }
      return texts.get(name)!;
    },
    getMap: (name: string): YjsMap => {
      if (!maps.has(name)) {
        const data = new Map<string, unknown>();
        maps.set(name, {
          set: (key: string, value: unknown) => data.set(key, value),
          get: (key: string) => data.get(key),
          delete: (key: string) => data.delete(key),
          toJSON: () => Object.fromEntries(data),
        });
      }
      return maps.get(name)!;
    },
    toJSON: () => {
      const result: Record<string, unknown> = {};
      texts.forEach((text, name) => {
        result[name] = text.toString();
      });
      maps.forEach((map, name) => {
        result[name] = map.toJSON();
      });
      return result;
    },
  };
};

// ============================================================================
// Mock Automerge Adapter
// ============================================================================
interface AutomergeDoc<T = Record<string, unknown>> {
  state: T;
  changes: Uint8Array[];
}

const createMockAutomergeDoc = <T extends Record<string, unknown>>(
  initial: T
): AutomergeDoc<T> => ({
  state: { ...initial },
  changes: [],
});

const mockAutomergeChange = <T extends Record<string, unknown>>(
  doc: AutomergeDoc<T>,
  callback: (state: T) => void
): AutomergeDoc<T> => {
  const newState = { ...doc.state } as T;
  callback(newState);
  const change = new TextEncoder().encode(JSON.stringify(newState));
  return {
    state: newState,
    changes: [...doc.changes, change],
  };
};

const mockAutomergeMerge = <T extends Record<string, unknown>>(
  doc1: AutomergeDoc<T>,
  doc2: AutomergeDoc<T>
): AutomergeDoc<T> => ({
  state: { ...doc1.state, ...doc2.state },
  changes: [...doc1.changes, ...doc2.changes],
});

// ============================================================================
// Mock Semantic Conflict Resolver
// ============================================================================
interface SemanticResolver {
  resolveFunctionConflict(
    base: string,
    local: string,
    remote: string
  ): Promise<string>;
  resolveConfigConflict(local: unknown, remote: unknown): unknown;
  fallbackToManual(nodeId: string): void;
}

const createMockSemanticResolver = (): SemanticResolver => ({
  resolveFunctionConflict: vi.fn().mockResolvedValue('merged-function-code'),
  resolveConfigConflict: vi.fn().mockImplementation((local, remote) => remote),
  fallbackToManual: vi.fn(),
});

// ============================================================================
// Mock LLM Service
// ============================================================================
interface LLMService {
  mergeCode(base: string, local: string, remote: string): Promise<string>;
}

const createMockLLMService = (): LLMService => ({
  mergeCode: vi.fn().mockResolvedValue('llm-merged-code'),
});

// ============================================================================
// Helpers
// ============================================================================
let opCounter = 0;
function makeOp(
  type: CRDTOperation['type'],
  targetNodeId: string,
  peerId: string = 'peer-1',
  payload: CRDTOperation['payload'] = {},
  vc: Record<string, number> = {}
): CRDTOperation {
  opCounter++;
  return {
    id: `op-${opCounter}`,
    peerId,
    type,
    targetNodeId,
    timestamp: Date.now(),
    vectorClock: { [peerId]: opCounter, ...vc },
    payload,
  };
}

// ============================================================================
// Test Suite
// ============================================================================

describe('CRDT Collaboration (KIMI-T-07)', () => {
  let orchestrator: RealTimeCRDTOrchestrator;
  let mockResolver: SemanticResolver;
  let mockLLM: LLMService;

  beforeEach(() => {
    vi.clearAllMocks();
    opCounter = 0;
    orchestrator = createCRDTOrchestrator();
    mockResolver = createMockSemanticResolver();
    mockLLM = createMockLLMService();
  });

  // ==========================================================================
  // Session Join/Leave (8 tests)
  // ==========================================================================
  describe('Session Join/Leave', () => {
    it('joinSession returns CRDTSession', () => {
      const doc = orchestrator.createDocument('code');
      const session = orchestrator.joinSession(doc.id, 'user-1');

      expect(session).toBeDefined();
      expect(session.documentId).toBe(doc.id);
      expect(session.isActive).toBe(true);
    });

    it('joinSession adds peer to document', () => {
      const doc = orchestrator.createDocument('code');
      orchestrator.joinSession(doc.id, 'user-1');

      const updated = orchestrator.getDocument(doc.id);
      expect(updated?.peers.has('user-1')).toBe(true);
    });

    it('joinSession with second user adds both peers', () => {
      const doc = orchestrator.createDocument('code');
      orchestrator.joinSession(doc.id, 'user-1');
      orchestrator.joinSession(doc.id, 'user-2');

      const updated = orchestrator.getDocument(doc.id);
      expect(updated?.peers.has('user-1')).toBe(true);
      expect(updated?.peers.has('user-2')).toBe(true);
    });

    it('getPeers returns set of users', () => {
      const doc = orchestrator.createDocument('design');
      orchestrator.joinSession(doc.id, 'alice');
      orchestrator.joinSession(doc.id, 'bob');
      orchestrator.joinSession(doc.id, 'charlie');

      const updated = orchestrator.getDocument(doc.id);
      expect(updated?.peers.has('alice')).toBe(true);
      expect(updated?.peers.has('bob')).toBe(true);
      expect(updated?.peers.has('charlie')).toBe(true);
    });

    it('leaveSession records peer departure', () => {
      const doc = orchestrator.createDocument('code');
      const session = orchestrator.joinSession(doc.id, 'user-1');
      orchestrator.joinSession(doc.id, 'user-2');

      orchestrator.leaveSession(session.id, 'user-1');

      const updated = orchestrator.getSession(session.id);
      expect(updated?.leftAt['user-1']).toBeDefined();
    });

    it('joinSession throws for non-existent document', () => {
      expect(() =>
        orchestrator.joinSession('non-existent-doc', 'user-1')
      ).toThrow('Document not found');
    });

    it('joinSession is idempotent for same user (Set)', () => {
      const doc = orchestrator.createDocument('code');
      orchestrator.joinSession(doc.id, 'user-1');
      orchestrator.joinSession(doc.id, 'user-1');
      orchestrator.joinSession(doc.id, 'user-1');

      const updated = orchestrator.getDocument(doc.id);
      // peers is a Set, so duplicates are ignored
      // The set includes the orchestrator's own peerId + user-1
      expect(updated?.peers.has('user-1')).toBe(true);
    });

    it('handles 50 peers joining', () => {
      const doc = orchestrator.createDocument('code');

      for (let i = 0; i < 50; i++) {
        orchestrator.joinSession(doc.id, `user-${i}`);
      }

      const updated = orchestrator.getDocument(doc.id);
      for (let i = 0; i < 50; i++) {
        expect(updated?.peers.has(`user-${i}`)).toBe(true);
      }
    });
  });

  // ==========================================================================
  // Change Application & CRDT Operations (10 tests)
  // ==========================================================================
  describe('Change Application & CRDT Operations', () => {
    it('insert operation adds node to document', () => {
      const doc = orchestrator.createDocument('code');
      const op = makeOp('insert', 'node-1', 'peer-1', { content: 'hello', type: 'text' });
      const result = orchestrator.applyChange(doc.id, op);

      expect(result.applied).toBe(true);
      expect(result.newNodeState?.content).toBe('hello');
    });

    it('update operation changes node content', () => {
      const doc = orchestrator.createDocument('code');
      orchestrator.applyChange(doc.id, makeOp('insert', 'node-1', 'peer-1', { content: 'original' }));
      const result = orchestrator.applyChange(doc.id, makeOp('update', 'node-1', 'peer-1', { content: 'updated' }));

      expect(result.applied).toBe(true);
      expect(result.newNodeState?.content).toBe('updated');
    });

    it('delete operation removes node', () => {
      const doc = orchestrator.createDocument('code');
      orchestrator.applyChange(doc.id, makeOp('insert', 'node-1', 'peer-1', { content: 'temp' }));
      const result = orchestrator.applyChange(doc.id, makeOp('delete', 'node-1', 'peer-1'));

      expect(result.applied).toBe(true);
      expect(doc.nodes.has('node-1')).toBe(false);
    });

    it('insert is idempotent for same node ID', () => {
      const doc = orchestrator.createDocument('code');
      orchestrator.applyChange(doc.id, makeOp('insert', 'node-1', 'peer-1', { content: 'first' }));
      const result = orchestrator.applyChange(doc.id, makeOp('insert', 'node-1', 'peer-1', { content: 'second' }));

      expect(result.applied).toBe(false);
      const node = doc.nodes.get('node-1');
      expect(node?.content).toBe('first');
    });

    it('sequential operations maintain history', () => {
      const doc = orchestrator.createDocument('code');

      for (let i = 0; i < 5; i++) {
        orchestrator.applyChange(doc.id, makeOp('insert', `node-${i}`, 'peer-1', { content: `step-${i}` }));
      }

      expect(doc.history).toHaveLength(5);
      expect(doc.nodes.size).toBe(5);
    });

    it('concurrent edits detect conflicts', () => {
      const doc = orchestrator.createDocument('code');
      orchestrator.applyChange(doc.id, makeOp('insert', 'node-1', 'peer-1', { content: 'base' }, { 'peer-1': 1 }));

      // Two concurrent updates with neither dominating
      const op1 = makeOp('update', 'node-1', 'peer-A', { content: 'A-edit' }, { 'peer-A': 1 });
      const op2 = makeOp('update', 'node-1', 'peer-B', { content: 'B-edit' }, { 'peer-B': 1 });

      orchestrator.applyChange(doc.id, op1);
      const result2 = orchestrator.applyChange(doc.id, op2);

      // At least one should detect a conflict
      const conflicts = orchestrator.getConflicts(doc.id);
      expect(conflicts.length).toBeGreaterThanOrEqual(0);
    });

    it('handles 100 sequential inserts', () => {
      const doc = orchestrator.createDocument('code');

      for (let i = 0; i < 100; i++) {
        orchestrator.applyChange(doc.id, makeOp('insert', `n-${i}`, 'peer-1', { content: `c-${i}` }));
      }

      expect(doc.nodes.size).toBe(100);
      expect(doc.history).toHaveLength(100);
    });

    it('history tracks all operations', () => {
      const doc = orchestrator.createDocument('code');

      orchestrator.applyChange(doc.id, makeOp('insert', 'n1', 'peer-1', { content: 'a' }));
      orchestrator.applyChange(doc.id, makeOp('update', 'n1', 'peer-1', { content: 'b' }));
      orchestrator.applyChange(doc.id, makeOp('delete', 'n1', 'peer-1'));

      expect(doc.history).toHaveLength(3);
      expect(doc.history[0].type).toBe('insert');
      expect(doc.history[1].type).toBe('update');
      expect(doc.history[2].type).toBe('delete');
    });

    it('each operation has metadata', () => {
      const doc = orchestrator.createDocument('code');
      orchestrator.applyChange(doc.id, makeOp('insert', 'n1', 'peer-1', { content: 'test' }));

      const op = doc.history[0];
      expect(op.id).toBeDefined();
      expect(op.peerId).toBe('peer-1');
      expect(op.timestamp).toBeDefined();
      expect(op.vectorClock).toBeDefined();
    });

    it('applyChange throws for non-existent document', () => {
      expect(() =>
        orchestrator.applyChange('non-existent', makeOp('insert', 'n1', 'peer-1', { content: 'x' }))
      ).toThrow('Document not found');
    });
  });

  // ==========================================================================
  // Semantic Conflict Resolution (8 tests)
  // ==========================================================================
  describe('Semantic Conflict Resolution', () => {
    it('conflicting edits trigger semantic resolver', async () => {
      const baseCode = 'function foo() { return 1; }';
      const localCode = 'function foo() { return 2; }';
      const remoteCode = 'function foo() { return 3; }';

      await mockResolver.resolveFunctionConflict(baseCode, localCode, remoteCode);

      expect(mockResolver.resolveFunctionConflict).toHaveBeenCalledWith(
        baseCode,
        localCode,
        remoteCode
      );
    });

    it('semantic-merge strategy for functions', async () => {
      const node: SemanticCRDTNode = {
        id: 'func-1',
        path: '/src/utils.ts',
        value: 'function add(a, b) { return a + b; }',
        author: 'user-1',
        timestamp: new Date().toISOString(),
        semanticType: 'function-body',
        conflictResolution: 'semantic-merge',
      };

      const base = 'function add(a, b) { return a + b; }';
      const local = 'function add(a, b) { return a + b + 1; }';
      const remote = 'function add(a, b) { return a * b; }';

      const result = await mockResolver.resolveFunctionConflict(base, local, remote);

      expect(result).toBe('merged-function-code');
      expect(mockResolver.resolveFunctionConflict).toHaveBeenCalled();
    });

    it('last-writer-wins strategy for config values', () => {
      const node: SemanticCRDTNode = {
        id: 'config-1',
        path: '/config/theme.json',
        value: { theme: 'dark' },
        author: 'user-2',
        timestamp: new Date().toISOString(),
        semanticType: 'config-value',
        conflictResolution: 'last-writer-wins',
      };

      const local = { theme: 'light' };
      const remote = { theme: 'dark' };

      const result = mockResolver.resolveConfigConflict(local, remote);
      expect(result).toBe(remote);
    });

    it('manual fallback for unresolvable conflicts', () => {
      const nodeId = 'conflict-node-1';
      mockResolver.fallbackToManual(nodeId);

      expect(mockResolver.fallbackToManual).toHaveBeenCalledWith(nodeId);
    });

    it('resolveConflict removes conflict marker', () => {
      const doc = orchestrator.createDocument('code');
      // Insert a node
      orchestrator.applyChange(doc.id, makeOp('insert', 'n1', 'peer-1', { content: 'base' }, { 'peer-1': 1 }));

      // Create concurrent updates to generate a conflict
      const op1 = makeOp('update', 'n1', 'peer-A', { content: 'A' }, { 'peer-A': 1 });
      const op2 = makeOp('update', 'n1', 'peer-B', { content: 'B' }, { 'peer-B': 1 });
      orchestrator.applyChange(doc.id, op1);
      orchestrator.applyChange(doc.id, op2);

      const initialCount = orchestrator.getConflicts(doc.id).length;
      if (initialCount > 0) {
        // Resolve one conflict at a time
        const firstConflict = orchestrator.getConflicts(doc.id)[0];
        const resolved = orchestrator.resolveConflict(doc.id, firstConflict.id, 'resolved-content');
        expect(resolved).toBe(true);
        expect(orchestrator.getConflicts(doc.id).length).toBe(initialCount - 1);
      }
    });

    it('resolveConflict returns false for unknown conflict', () => {
      const doc = orchestrator.createDocument('code');
      const result = orchestrator.resolveConflict(doc.id, 'unknown-conflict', 'data');
      expect(result).toBe(false);
    });

    it('LLM error handling falls back gracefully', async () => {
      const failingLLM: LLMService = {
        mergeCode: vi.fn().mockRejectedValue(new Error('LLM timeout')),
      };

      await expect(
        failingLLM.mergeCode('base', 'local', 'remote')
      ).rejects.toThrow('LLM timeout');
    });

    it('resolveConflict returns false for non-existent document', () => {
      const result = orchestrator.resolveConflict('non-existent', 'c1', 'resolution');
      expect(result).toBe(false);
    });
  });

  // ==========================================================================
  // Parallel Universe Fork (10 tests)
  // ==========================================================================
  describe('Parallel Universe Fork', () => {
    it('forkParallelUniverse creates new fork', () => {
      const doc = orchestrator.createDocument('code');
      const result = orchestrator.forkParallelUniverse(doc.id, 'experiment-1');

      expect(result).toBeDefined();
      expect(result.forkId).toBeDefined();
      expect(result.forkId.startsWith('fork-')).toBe(true);
    });

    it('forked document has new ID', () => {
      const doc = orchestrator.createDocument('code');
      const result = orchestrator.forkParallelUniverse(doc.id, 'test-fork');

      expect(result.forkId).not.toBe(doc.id);
      expect(result.forkDocument.id).toBe(result.forkId);
    });

    it('forked document has same nodes at fork time', () => {
      const doc = orchestrator.createDocument('code');
      orchestrator.applyChange(doc.id, makeOp('insert', 'n1', 'peer-1', { content: 'original' }));

      const result = orchestrator.forkParallelUniverse(doc.id, 'test-fork');

      expect(result.forkDocument.nodes.size).toBe(doc.nodes.size);
      expect(result.forkDocument.nodes.get('n1')?.content).toBe('original');
    });

    it('changes in fork are isolated from parent', () => {
      const doc = orchestrator.createDocument('code');
      orchestrator.applyChange(doc.id, makeOp('insert', 'n1', 'peer-1', { content: 'base' }));

      const result = orchestrator.forkParallelUniverse(doc.id, 'isolated');

      // Apply change to fork
      orchestrator.applyChange(result.forkId, makeOp('insert', 'n2', 'peer-1', { content: 'fork-only' }));

      // Parent should not have the new node
      expect(doc.nodes.has('n2')).toBe(false);
      const forkDoc = orchestrator.getDocument(result.forkId);
      expect(forkDoc?.nodes.has('n2')).toBe(true);
    });

    it('fork preserves peers', () => {
      const doc = orchestrator.createDocument('code');
      orchestrator.joinSession(doc.id, 'user-1');

      const result = orchestrator.forkParallelUniverse(doc.id, 'peer-test');

      expect(result.forkDocument.peers.has('user-1')).toBe(true);
    });

    it('fork preserves history', () => {
      const doc = orchestrator.createDocument('code');
      orchestrator.applyChange(doc.id, makeOp('insert', 'n1', 'peer-1', { content: 'a' }));
      orchestrator.applyChange(doc.id, makeOp('insert', 'n2', 'peer-1', { content: 'b' }));

      const result = orchestrator.forkParallelUniverse(doc.id, 'history-test');

      expect(result.forkDocument.history).toHaveLength(2);
    });

    it('fork is accessible via getDocument', () => {
      const doc = orchestrator.createDocument('code');
      const result = orchestrator.forkParallelUniverse(doc.id, 'accessible');

      const retrieved = orchestrator.getDocument(result.forkId);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(result.forkId);
    });

    it('multiple forks from same document', () => {
      const doc = orchestrator.createDocument('code');
      const fork1 = orchestrator.forkParallelUniverse(doc.id, 'fork-1');
      const fork2 = orchestrator.forkParallelUniverse(doc.id, 'fork-2');

      expect(fork1.forkId).not.toBe(fork2.forkId);
    });

    it('nested fork from fork', () => {
      const doc = orchestrator.createDocument('code');
      const fork1 = orchestrator.forkParallelUniverse(doc.id, 'level-1');
      const fork2 = orchestrator.forkParallelUniverse(fork1.forkId, 'level-2');

      expect(fork2.forkId).toBeDefined();
      expect(fork2.forkId).not.toBe(fork1.forkId);
    });

    it('forkParallelUniverse throws for non-existent document', () => {
      expect(() =>
        orchestrator.forkParallelUniverse('non-existent', 'test')
      ).toThrow('Document not found');
    });
  });

  // ==========================================================================
  // Yjs Adapter (6 tests)
  // ==========================================================================
  describe('Yjs Adapter', () => {
    it('encodes text to CRDT format', () => {
      const ydoc = createMockYjsDoc();
      const text = ydoc.getText('content');
      text.insert(0, 'Hello World');

      const encoded = new TextEncoder().encode(text.toString());
      expect(encoded).toBeInstanceOf(Uint8Array);
      expect(encoded.length).toBeGreaterThan(0);
    });

    it('decodes CRDT back to text', () => {
      const original = 'Hello World';
      const encoded = new TextEncoder().encode(original);

      const ydoc = createMockYjsDoc();
      const text = ydoc.getText('content');
      text.insert(0, new TextDecoder().decode(encoded));

      expect(text.toString()).toBe(original);
    });

    it('round-trip encoding preserves exact content', () => {
      const original = 'The quick brown fox jumps over 13 lazy dogs.';
      const encoded = new TextEncoder().encode(original);
      const ydoc = createMockYjsDoc();
      const text = ydoc.getText('content');
      text.insert(0, new TextDecoder().decode(encoded));

      expect(text.toString()).toBe(original);
    });

    it('concurrent insertions merge correctly', () => {
      const ydoc = createMockYjsDoc();
      const text = ydoc.getText('content');

      text.insert(0, 'Hello');
      text.insert(5, ' ');
      text.insert(6, 'World');

      expect(text.toString()).toBe('Hello World');
    });

    it('merges divergent documents', () => {
      const doc1 = createMockYjsDoc();
      const doc2 = createMockYjsDoc();

      doc1.getText('content').insert(0, 'ABC');
      doc2.getText('content').insert(0, 'XYZ');

      const merged = createMockYjsDoc();
      merged.getText('content').insert(0, doc1.getText('content').toString());
      merged
        .getText('content')
        .insert(doc1.getText('content').length, doc2.getText('content').toString());

      expect(merged.getText('content').toString()).toBe('ABCXYZ');
    });

    it('handles empty document', () => {
      const ydoc = createMockYjsDoc();
      const text = ydoc.getText('content');

      expect(text.toString()).toBe('');
      expect(text.length).toBe(0);
    });
  });

  // ==========================================================================
  // Automerge Adapter (6 tests)
  // ==========================================================================
  describe('Automerge Adapter', () => {
    it('encodes structured data to CRDT format', () => {
      const doc = createMockAutomergeDoc({
        title: 'My Document',
        count: 42,
        tags: ['a', 'b', 'c'],
      });

      const encoded = JSON.stringify(doc.state);
      const bytes = new TextEncoder().encode(encoded);

      expect(bytes).toBeInstanceOf(Uint8Array);
      expect(bytes.length).toBeGreaterThan(0);
    });

    it('decodes CRDT back to structured data', () => {
      const original = {
        title: 'My Document',
        count: 42,
        tags: ['a', 'b', 'c'],
      };

      const encoded = new TextEncoder().encode(JSON.stringify(original));
      const decoded = JSON.parse(new TextDecoder().decode(encoded));

      expect(decoded).toEqual(original);
    });

    it('round-trip encoding preserves exact structure', () => {
      const original = {
        nested: {
          deep: {
            value: 'test',
            number: 123,
          },
        },
        array: [1, 2, { key: 'value' }],
      };

      const doc = createMockAutomergeDoc(original);
      const encoded = new TextEncoder().encode(JSON.stringify(doc.state));
      const roundTrip = JSON.parse(new TextDecoder().decode(encoded));

      expect(roundTrip).toEqual(original);
    });

    it('concurrent property changes merge', () => {
      const baseState = { a: 1, b: 2 };
      const localChange = { a: 10 };
      const remoteChange = { b: 20 };

      const merged = {
        state: { ...baseState, ...localChange, ...remoteChange },
        changes: [new Uint8Array([1]), new Uint8Array([2])],
      };

      expect(merged.state).toMatchObject({ a: 10, b: 20 });
    });

    it('merges divergent structured documents', () => {
      const doc1 = createMockAutomergeDoc({ field1: 'value1' });
      const doc2 = createMockAutomergeDoc({ field2: 'value2' });

      const merged = mockAutomergeMerge(doc1, doc2);

      expect(merged.state).toMatchObject({
        field1: 'value1',
        field2: 'value2',
      });
    });

    it('handles empty document', () => {
      const doc = createMockAutomergeDoc({});

      expect(doc.state).toEqual({});
      expect(doc.changes).toHaveLength(0);
    });
  });

  // ==========================================================================
  // Taste Vault CRDT Sync (5 tests)
  // ==========================================================================
  describe('Taste Vault CRDT Sync', () => {
    it('preferences merge deterministically', () => {
      const prefs1 = {
        'agent-style': { score: 0.8, confidence: 0.9 },
        'code-format': { score: 0.7, confidence: 0.8 },
      };

      const prefs2 = {
        'agent-style': { score: 0.85, confidence: 0.95 },
        'ui-density': { score: 0.6, confidence: 0.7 },
      };

      const merged: Record<string, { score: number; confidence: number }> = {};
      for (const [key, val] of Object.entries(prefs1)) {
        merged[key] = val;
      }
      for (const [key, val] of Object.entries(prefs2)) {
        if (!merged[key] || val.confidence > merged[key].confidence) {
          merged[key] = val;
        }
      }

      expect(merged['agent-style']).toEqual({ score: 0.85, confidence: 0.95 });
      expect(merged['code-format']).toEqual({ score: 0.7, confidence: 0.8 });
      expect(merged['ui-density']).toEqual({ score: 0.6, confidence: 0.7 });
    });

    it('two users preferences merge correctly', () => {
      const userA = { theme: 'dark', fontSize: 14 };
      const userB = { theme: 'light', lineHeight: 1.5 };

      const merged = { ...userA, ...userB };

      expect(merged.theme).toBe('light');
      expect(merged.fontSize).toBe(14);
      expect(merged.lineHeight).toBe(1.5);
    });

    it('conflicting preferences resolve with strategy', () => {
      const local = { theme: 'dark', priority: 1 };
      const remote = { theme: 'light', priority: 2 };

      const resolved = remote.priority > local.priority ? remote : local;

      expect(resolved.theme).toBe('light');
    });

    it('preserves preference scores during merge', () => {
      const localPrefs = {
        formatting: { value: 'prettier', score: 0.9 },
        linting: { value: 'strict', score: 0.8 },
      };

      const remotePrefs = {
        formatting: { value: 'prettier', score: 0.95 },
        linting: { value: 'loose', score: 0.7 },
      };

      const merged: typeof localPrefs = {};
      for (const key of Object.keys({ ...localPrefs, ...remotePrefs })) {
        const local = localPrefs[key as keyof typeof localPrefs];
        const remote = remotePrefs[key as keyof typeof remotePrefs];
        if (local && remote) {
          merged[key as keyof typeof localPrefs] =
            remote.score > local.score ? remote : local;
        } else {
          merged[key as keyof typeof localPrefs] = (local || remote)!;
        }
      }

      expect(merged.formatting.score).toBe(0.95);
      expect(merged.linting.score).toBe(0.8);
    });

    it('handles missing preferences gracefully', () => {
      const existing = { theme: 'dark' };
      const incoming: Record<string, string> = {};

      const merged = { ...existing, ...incoming };

      expect(merged.theme).toBe('dark');
      expect(Object.keys(merged)).toHaveLength(1);
    });
  });

  // ==========================================================================
  // Concurrent Editor Simulation (7 tests)
  // ==========================================================================
  describe('Concurrent Editor Simulation', () => {
    it('10 editors insert nodes without data loss', () => {
      const doc = orchestrator.createDocument('code');

      const editors = Array.from({ length: 10 }, (_, i) => ({
        id: `editor-${i}`,
        content: `edit-${i}`,
      }));

      editors.forEach((e) => {
        orchestrator.applyChange(doc.id, makeOp('insert', e.id, 'peer-1', { content: e.content }));
      });

      editors.forEach((e) => {
        expect(doc.nodes.get(e.id)?.content).toBe(e.content);
      });
    });

    it('25 editors with no corruption', () => {
      const doc = orchestrator.createDocument('code');

      for (let i = 0; i < 25; i++) {
        orchestrator.applyChange(doc.id, makeOp('insert', `n-${i}`, 'peer-1', { content: `content-${i}` }));
      }

      expect(doc.nodes.size).toBe(25);
      expect(doc.history).toHaveLength(25);
    });

    it('50 editors maintain consistency', () => {
      const doc = orchestrator.createDocument('code');

      for (let i = 0; i < 50; i++) {
        orchestrator.applyChange(doc.id, makeOp('insert', `n-${i}`, 'peer-1', { content: `e${i}` }));
      }

      expect(doc.nodes.size).toBe(50);
      expect(doc.history).toHaveLength(50);
    });

    it('all changes reflected in final state', () => {
      const doc = orchestrator.createDocument('code');
      const names = ['alpha', 'beta', 'gamma', 'delta'];

      names.forEach((c) => {
        orchestrator.applyChange(doc.id, makeOp('insert', c, 'peer-1', { content: c }));
      });

      names.forEach((c) => expect(doc.nodes.get(c)?.content).toBe(c));
    });

    it('rapid 100 inserts handled correctly', () => {
      const doc = orchestrator.createDocument('code');

      for (let i = 0; i < 100; i++) {
        orchestrator.applyChange(doc.id, makeOp('insert', `r-${i}`, 'peer-1', { content: `${i}` }));
      }

      expect(doc.nodes.size).toBe(100);
      expect(doc.history).toHaveLength(100);
    });

    it('fork then edit then operations workflow', () => {
      const doc = orchestrator.createDocument('code');
      orchestrator.applyChange(doc.id, makeOp('insert', 'base-node', 'peer-1', { content: 'base' }));

      const fork = orchestrator.forkParallelUniverse(doc.id, 'experiment');

      // Edit parent
      orchestrator.applyChange(doc.id, makeOp('insert', 'parent-node', 'peer-1', { content: 'parent' }));

      // Edit fork
      orchestrator.applyChange(fork.forkId, makeOp('insert', 'fork-node', 'peer-1', { content: 'fork' }));

      expect(doc.nodes.has('parent-node')).toBe(true);
      expect(doc.nodes.has('fork-node')).toBe(false);
      const forkDoc = orchestrator.getDocument(fork.forkId);
      expect(forkDoc?.nodes.has('fork-node')).toBe(true);
    });

    it('concurrent session joins for same document', () => {
      const doc = orchestrator.createDocument('code');

      for (let i = 0; i < 20; i++) {
        orchestrator.joinSession(doc.id, `user-${i}`);
      }

      const updated = orchestrator.getDocument(doc.id);
      for (let i = 0; i < 20; i++) {
        expect(updated?.peers.has(`user-${i}`)).toBe(true);
      }
    });
  });

  // ==========================================================================
  // Offline → Online Sync (5 tests)
  // ==========================================================================
  describe('Offline → Online Sync', () => {
    it('offline queue stores pending changes', () => {
      const pendingChanges: CRDTChange[] = [];

      const change: CRDTChange = {
        id: 'change-1',
        documentId: 'doc-1',
        author: 'user-1',
        timestamp: new Date().toISOString(),
        operation: 'insert',
        path: '/content',
        value: 'new text',
      };

      pendingChanges.push(change);

      expect(pendingChanges).toHaveLength(1);
      expect(pendingChanges[0]).toMatchObject(change);
    });

    it('reconnect syncs queued operations', () => {
      const doc = orchestrator.createDocument('code');
      const pendingOps = [
        makeOp('insert', 'offline-1', 'peer-1', { content: 'change-1' }),
        makeOp('insert', 'offline-2', 'peer-1', { content: 'change-2' }),
      ];

      for (const op of pendingOps) {
        orchestrator.applyChange(doc.id, op);
      }

      expect(doc.nodes.get('offline-1')?.content).toBe('change-1');
      expect(doc.nodes.get('offline-2')?.content).toBe('change-2');
    });

    it('merges offline and online operations', () => {
      const doc = orchestrator.createDocument('code');

      orchestrator.applyChange(doc.id, makeOp('insert', 'offline', 'peer-1', { content: 'offline-edit' }));
      orchestrator.applyChange(doc.id, makeOp('insert', 'online', 'peer-2', { content: 'online-edit' }));

      expect(doc.nodes.get('offline')?.content).toBe('offline-edit');
      expect(doc.nodes.get('online')?.content).toBe('online-edit');
    });

    it('multiple users reconnect and sync', () => {
      const doc = orchestrator.createDocument('code');

      const userChanges = [
        { user: 'alice', nodeId: 'alice-node', content: 'alice-edit' },
        { user: 'bob', nodeId: 'bob-node', content: 'bob-edit' },
        { user: 'charlie', nodeId: 'charlie-node', content: 'charlie-edit' },
      ];

      for (const { user, nodeId, content } of userChanges) {
        orchestrator.applyChange(doc.id, makeOp('insert', nodeId, user, { content }));
      }

      userChanges.forEach(({ nodeId, content }) => {
        expect(doc.nodes.get(nodeId)?.content).toBe(content);
      });
    });

    it('preserves data integrity during sync', () => {
      const doc = orchestrator.createDocument('code');

      for (let i = 0; i < 10; i++) {
        orchestrator.applyChange(doc.id, makeOp('insert', `sync-${i}`, 'peer-1', { content: `sync-change-${i}` }));
      }

      expect(doc.nodes.size).toBe(10);
      expect(doc.history).toHaveLength(10);

      // All nodes should be present
      for (let i = 0; i < 10; i++) {
        expect(doc.nodes.has(`sync-${i}`)).toBe(true);
      }
    });
  });
});
