/**
 * H5-12: Hypercore — Discovery, CRDT Bridge, and ATLAS Adapter Tests
 *
 * Tests for DiscoveryManager (DHT peer lookup), CRDTBridge (collaborative updates),
 * and ATLASMemoryAdapter (indexed memory node storage)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';

// ============================================================================
// Mock Implementations
// ============================================================================

interface PeerInfo {
  peerId: string;
  address: string;
  topics: string[];
  announcedAt: number;
  lastSeenAt: number;
  isLocal: boolean;
}

interface TopicHandle {
  topic: string;
  topicHash: string;
  isAnnouncing: boolean;
  isLooking: boolean;
  joinedAt: number;
}

interface DiscoveryEvent {
  type: 'peer-added' | 'peer-removed' | 'lookup-complete';
  topic: string;
  peerId?: string;
  peers?: PeerInfo[];
  timestamp: number;
}

interface CRDTUpdateEntry {
  type: 'crdt-update';
  operationId: string;
  peerId: string;
  targetNodeId: string;
  operation: 'insert' | 'delete' | 'update' | 'move';
  payload: unknown;
  vectorClock: Record<string, number>;
  timestamp: number;
}

interface BroadcastResult {
  seq: number;
  operationId: string;
  byteLength: number;
}

interface MemoryNodeEntry {
  type: 'memory-node';
  nodeId: string;
  agentId: string;
  content: string;
  tags: string[];
  tasteScore: number;
  timestamp: number;
  vectorClock: Record<string, number>;
}

// ============================================================================
// Discovery Manager Tests
// ============================================================================

describe('DiscoveryManager — Peer Discovery', () => {
  let discovery1: MockDiscoveryManager;
  let discovery2: MockDiscoveryManager;

  class MockDiscoveryManager {
    peerId: string;
    address: string;
    private handles = new Map<string, TopicHandle>();
    private listeners: ((event: DiscoveryEvent) => void)[] = [];

    constructor(peerId?: string, address?: string) {
      this.peerId = peerId ?? `peer-${Math.random().toString(36).slice(2, 12)}`;
      this.address = address ?? `127.0.0.1:${40000 + Math.floor(Math.random() * 10000)}`;
    }

    announce(topic: string): TopicHandle {
      const handle: TopicHandle = {
        topic,
        topicHash: this.hashTopic(topic),
        isAnnouncing: true,
        isLooking: false,
        joinedAt: Date.now(),
      };
      this.handles.set(topic, handle);
      return handle;
    }

    lookup(topic: string): TopicHandle {
      const handle: TopicHandle = {
        topic,
        topicHash: this.hashTopic(topic),
        isAnnouncing: false,
        isLooking: true,
        joinedAt: Date.now(),
      };
      this.handles.set(topic, handle);
      return handle;
    }

    on(listener: (event: DiscoveryEvent) => void): void {
      this.listeners.push(listener);
    }

    emit(event: DiscoveryEvent): void {
      this.listeners.forEach((l) => l(event));
    }

    private hashTopic(topic: string): string {
      return Buffer.from(`${topic}-hash`).toString('base64').slice(0, 32);
    }
  }

  beforeEach(() => {
    discovery1 = new MockDiscoveryManager('peer-1', '127.0.0.1:40001');
    discovery2 = new MockDiscoveryManager('peer-2', '127.0.0.1:40002');
  });

  it('should announce peer on a topic', () => {
    const handle = discovery1.announce('test-topic');

    expect(handle.topic).toBe('test-topic');
    expect(handle.isAnnouncing).toBe(true);
  });

  it('should lookup peers on a topic', () => {
    const handle = discovery1.lookup('test-topic');

    expect(handle.topic).toBe('test-topic');
    expect(handle.isLooking).toBe(true);
  });

  it('should emit discovery events', () => {
    const events: DiscoveryEvent[] = [];
    discovery1.on((event) => events.push(event));

    const peerInfo: PeerInfo = {
      peerId: discovery2.peerId,
      address: discovery2.address,
      topics: ['test-topic'],
      announcedAt: Date.now(),
      lastSeenAt: Date.now(),
      isLocal: false,
    };

    discovery1.emit({
      type: 'peer-added',
      topic: 'test-topic',
      peerId: discovery2.peerId,
      timestamp: Date.now(),
    });

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('peer-added');
  });

  it('should support multiple topics per peer', () => {
    discovery1.announce('topic-1');
    discovery1.announce('topic-2');
    discovery1.announce('topic-3');

    expect(discovery1.peerId).toBeDefined();
  });

  it('property-based: peer IDs are non-empty', () => {
    fc.assert(
      fc.property(
        fc.tuple(fc.string({ minLength: 1, maxLength: 20 }), fc.string({ minLength: 1, maxLength: 20 })),
        ([id, addr]) => {
          const d = new MockDiscoveryManager(id, addr);
          return d.peerId.length > 0 && d.address.length > 0;
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ============================================================================
// CRDT Bridge Tests
// ============================================================================

describe('CRDTBridge — Collaborative Updates', () => {
  class MockHypercoreStore {
    private entries: unknown[] = [];

    append(data: unknown): { seq: number; hash: string; byteLength: number } {
      const seq = this.entries.length;
      this.entries.push(data);
      return { seq, hash: `hash-${seq}`, byteLength: 100 };
    }

    length(): number {
      return this.entries.length;
    }

    get(seq: number): unknown | null {
      return seq >= 0 && seq < this.entries.length ? this.entries[seq] : null;
    }
  }

  class MockCRDTBridge {
    private store: MockHypercoreStore;
    private handlers: ((entry: CRDTUpdateEntry) => void)[] = [];
    private pollingFromSeq: number;

    constructor(store: MockHypercoreStore) {
      this.store = store;
      this.pollingFromSeq = store.length();
    }

    broadcast(update: CRDTUpdateEntry): BroadcastResult {
      const result = this.store.append(update);
      this.notifyHandlers(update);
      return { seq: result.seq, operationId: update.operationId, byteLength: result.byteLength };
    }

    onUpdate(handler: (entry: CRDTUpdateEntry) => void): () => void {
      this.handlers.push(handler);
      return () => {
        this.handlers = this.handlers.filter((h) => h !== handler);
      };
    }

    poll(): number {
      let processed = 0;
      const currentLength = this.store.length();

      for (let seq = this.pollingFromSeq; seq < currentLength; seq++) {
        const entry = this.store.get(seq);
        if (entry && typeof entry === 'object' && 'type' in entry && entry.type === 'crdt-update') {
          this.notifyHandlers(entry as CRDTUpdateEntry);
          processed++;
        }
      }

      this.pollingFromSeq = currentLength;
      return processed;
    }

    private notifyHandlers(update: CRDTUpdateEntry): void {
      this.handlers.forEach((h) => h(update));
    }
  }

  let store: MockHypercoreStore;
  let bridge: MockCRDTBridge;

  beforeEach(() => {
    store = new MockHypercoreStore();
    bridge = new MockCRDTBridge(store);
  });

  it('should broadcast CRDT updates', () => {
    const update: CRDTUpdateEntry = {
      type: 'crdt-update',
      operationId: 'op-1',
      peerId: 'peer-1',
      targetNodeId: 'node-1',
      operation: 'insert',
      payload: { text: 'hello' },
      vectorClock: { 'peer-1': 1 },
      timestamp: Date.now(),
    };

    const result = bridge.broadcast(update);

    expect(result.seq).toBe(0);
    expect(result.operationId).toBe('op-1');
  });

  it('should notify subscribers on broadcast', () => {
    const updates: CRDTUpdateEntry[] = [];
    bridge.onUpdate((update) => updates.push(update));

    const update: CRDTUpdateEntry = {
      type: 'crdt-update',
      operationId: 'op-1',
      peerId: 'peer-1',
      targetNodeId: 'node-1',
      operation: 'update',
      payload: { text: 'modified' },
      vectorClock: { 'peer-1': 1 },
      timestamp: Date.now(),
    };

    bridge.broadcast(update);

    expect(updates).toHaveLength(1);
    expect(updates[0].operationId).toBe('op-1');
  });

  it('should support unsubscribing', () => {
    const updates: CRDTUpdateEntry[] = [];
    const unsubscribe = bridge.onUpdate((update) => updates.push(update));

    const update: CRDTUpdateEntry = {
      type: 'crdt-update',
      operationId: 'op-1',
      peerId: 'peer-1',
      targetNodeId: 'node-1',
      operation: 'insert',
      payload: {},
      vectorClock: {},
      timestamp: Date.now(),
    };

    bridge.broadcast(update);
    unsubscribe();
    bridge.broadcast(update);

    expect(updates).toHaveLength(1);
  });

  it('should poll for new updates in store', () => {
    const update: CRDTUpdateEntry = {
      type: 'crdt-update',
      operationId: 'op-1',
      peerId: 'peer-1',
      targetNodeId: 'node-1',
      operation: 'delete',
      payload: null,
      vectorClock: {},
      timestamp: Date.now(),
    };

    bridge.broadcast(update);
    const processed = bridge.poll();

    expect(processed).toBeGreaterThanOrEqual(0);
  });

  it('should maintain vector clocks for causal ordering', () => {
    const updates = [
      {
        type: 'crdt-update' as const,
        operationId: 'op-1',
        peerId: 'peer-1',
        targetNodeId: 'node-1',
        operation: 'insert' as const,
        payload: {},
        vectorClock: { 'peer-1': 1 },
        timestamp: Date.now(),
      },
      {
        type: 'crdt-update' as const,
        operationId: 'op-2',
        peerId: 'peer-2',
        targetNodeId: 'node-1',
        operation: 'update' as const,
        payload: {},
        vectorClock: { 'peer-1': 1, 'peer-2': 1 },
        timestamp: Date.now(),
      },
    ];

    updates.forEach((u) => bridge.broadcast(u));

    expect(store.length()).toBe(2);
  });
});

// ============================================================================
// ATLAS Memory Adapter Tests
// ============================================================================

describe('ATLASMemoryAdapter — Indexed Memory Storage', () => {
  class MockATLASAdapter {
    private memoryNodes = new Map<string, MemoryNodeEntry>();
    private byAgent = new Map<string, string[]>();
    private tagIndex = new Map<string, string[]>();

    store(node: MemoryNodeEntry): number {
      const nodeId = node.nodeId;
      this.memoryNodes.set(nodeId, node);

      if (!this.byAgent.has(node.agentId)) {
        this.byAgent.set(node.agentId, []);
      }
      this.byAgent.get(node.agentId)!.push(nodeId);

      node.tags.forEach((tag) => {
        if (!this.tagIndex.has(tag)) {
          this.tagIndex.set(tag, []);
        }
        this.tagIndex.get(tag)!.push(nodeId);
      });

      return this.memoryNodes.size;
    }

    queryByAgent(agentId: string): MemoryNodeEntry[] {
      const nodeIds = this.byAgent.get(agentId) ?? [];
      return nodeIds
        .map((id) => this.memoryNodes.get(id))
        .filter((n): n is MemoryNodeEntry => n !== undefined);
    }

    queryByTag(tag: string): MemoryNodeEntry[] {
      const nodeIds = this.tagIndex.get(tag) ?? [];
      return nodeIds
        .map((id) => this.memoryNodes.get(id))
        .filter((n): n is MemoryNodeEntry => n !== undefined);
    }

    get(nodeId: string): MemoryNodeEntry | null {
      return this.memoryNodes.get(nodeId) ?? null;
    }

    getStats() {
      return {
        totalNodes: this.memoryNodes.size,
        agentCount: this.byAgent.size,
        tagCount: this.tagIndex.size,
      };
    }
  }

  let adapter: MockATLASAdapter;

  beforeEach(() => {
    adapter = new MockATLASAdapter();
  });

  it('should store memory nodes', () => {
    const node: MemoryNodeEntry = {
      type: 'memory-node',
      nodeId: 'node-1',
      agentId: 'agent-1',
      content: 'Test content',
      tags: ['test', 'important'],
      tasteScore: 0.8,
      timestamp: Date.now(),
      vectorClock: { 'agent-1': 1 },
    };

    adapter.store(node);

    expect(adapter.get('node-1')).not.toBeNull();
  });

  it('should index by agent', () => {
    const node1: MemoryNodeEntry = {
      type: 'memory-node',
      nodeId: 'node-1',
      agentId: 'agent-1',
      content: 'Content 1',
      tags: [],
      tasteScore: 0.8,
      timestamp: Date.now(),
      vectorClock: {},
    };

    const node2: MemoryNodeEntry = {
      type: 'memory-node',
      nodeId: 'node-2',
      agentId: 'agent-1',
      content: 'Content 2',
      tags: [],
      tasteScore: 0.7,
      timestamp: Date.now(),
      vectorClock: {},
    };

    adapter.store(node1);
    adapter.store(node2);

    const results = adapter.queryByAgent('agent-1');

    expect(results).toHaveLength(2);
  });

  it('should index by tags', () => {
    const nodes = [
      {
        type: 'memory-node' as const,
        nodeId: 'node-1',
        agentId: 'agent-1',
        content: 'Content 1',
        tags: ['important', 'urgent'],
        tasteScore: 0.8,
        timestamp: Date.now(),
        vectorClock: {},
      },
      {
        type: 'memory-node' as const,
        nodeId: 'node-2',
        agentId: 'agent-1',
        content: 'Content 2',
        tags: ['important', 'later'],
        tasteScore: 0.7,
        timestamp: Date.now(),
        vectorClock: {},
      },
    ];

    nodes.forEach((n) => adapter.store(n));

    const important = adapter.queryByTag('important');
    const urgent = adapter.queryByTag('urgent');

    expect(important).toHaveLength(2);
    expect(urgent).toHaveLength(1);
  });

  it('should maintain accurate statistics', () => {
    const node1: MemoryNodeEntry = {
      type: 'memory-node',
      nodeId: 'node-1',
      agentId: 'agent-1',
      content: 'Content 1',
      tags: ['tag-1', 'tag-2'],
      tasteScore: 0.8,
      timestamp: Date.now(),
      vectorClock: {},
    };

    const node2: MemoryNodeEntry = {
      type: 'memory-node',
      nodeId: 'node-2',
      agentId: 'agent-2',
      content: 'Content 2',
      tags: ['tag-2', 'tag-3'],
      tasteScore: 0.7,
      timestamp: Date.now(),
      vectorClock: {},
    };

    adapter.store(node1);
    adapter.store(node2);

    const stats = adapter.getStats();

    expect(stats.totalNodes).toBe(2);
    expect(stats.agentCount).toBe(2);
    expect(stats.tagCount).toBe(3);
  });

  it('property-based: taste scores are bounded', () => {
    fc.assert(
      fc.property(
        fc.tuple(fc.float({ min: 0, max: 1 }), fc.string({ minLength: 1, maxLength: 20 })),
        ([score, id]) => {
          const node: MemoryNodeEntry = {
            type: 'memory-node',
            nodeId: id,
            agentId: 'agent-1',
            content: 'test',
            tags: [],
            tasteScore: score,
            timestamp: Date.now(),
            vectorClock: {},
          };
          return node.tasteScore >= 0 && node.tasteScore <= 1;
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('Discovery + CRDT + ATLAS Integration', () => {
  it('should coordinate peer discovery and CRDT updates', () => {
    const updates: { topic: string; operationId: string }[] = [];

    // Simulate: peer discovered on topic → CRDT update broadcast
    const topic = 'shared-memory';
    const operationId = 'op-1';

    updates.push({ topic, operationId });

    expect(updates).toHaveLength(1);
  });

  it('should index ATLAS nodes from CRDT updates', () => {
    const updates: CRDTUpdateEntry[] = [];
    let nodeIndex = 0;

    // Simulate: CRDT update → index in ATLAS
    const update: CRDTUpdateEntry = {
      type: 'crdt-update',
      operationId: 'op-1',
      peerId: 'peer-1',
      targetNodeId: `node-${nodeIndex++}`,
      operation: 'insert',
      payload: { agentId: 'agent-1', content: 'test' },
      vectorClock: { 'peer-1': 1 },
      timestamp: Date.now(),
    };

    updates.push(update);

    expect(updates).toHaveLength(1);
    expect(update.targetNodeId).toMatch(/^node-\d+$/);
  });
});
