// Hyperswarm Discovery — In-memory DHT simulation
// Sprint S2-04 | P2P Hypercore Protocol (Reel 1)

import { createHash } from 'crypto';
import type { DiscoveryConfig } from './types.js';

export interface PeerInfo {
  peerId: string;
  address: string;
  topics: string[];
  announcedAt: number;
  lastSeenAt: number;
  isLocal: boolean;
}

export interface TopicHandle {
  topic: string;
  topicHash: string;
  isAnnouncing: boolean;
  isLooking: boolean;
  joinedAt: number;
}

export interface DiscoveryEvent {
  type: 'peer-added' | 'peer-removed' | 'lookup-complete';
  topic: string;
  peerId?: string;
  peers?: PeerInfo[];
  timestamp: number;
}

type DiscoveryListener = (event: DiscoveryEvent) => void;

/**
 * Global in-process DHT simulation.
 * All DiscoveryManager instances share this DHT, simulating a network.
 */
const GLOBAL_DHT = new Map<string, Map<string, PeerInfo>>(); // topicHash → peerId → PeerInfo

function hashTopic(topic: string): string {
  return createHash('sha256').update(`hyperswarm-topic:${topic}`).digest('hex').slice(0, 32);
}

/**
 * DiscoveryManager — DHT-based peer discovery using topic-based lookup.
 * Simulates Hyperswarm's DHT semantics in-memory.
 */
export class DiscoveryManager {
  private peerId: string;
  private address: string;
  private handles = new Map<string, TopicHandle>(); // topic → handle
  private listeners: DiscoveryListener[] = [];
  private destroyed = false;

  constructor(peerId?: string, address?: string) {
    this.peerId = peerId ?? `peer-${createHash('sha256').update(String(Date.now() + Math.random())).digest('hex').slice(0, 12)}`;
    this.address = address ?? `127.0.0.1:${40000 + Math.floor(Math.random() * 10000)}`;
  }

  get id(): string {
    return this.peerId;
  }

  /**
   * Announce this peer on a topic so others can discover it.
   */
  announce(config: DiscoveryConfig | string): TopicHandle {
    const topic = typeof config === 'string' ? config : config.topic;
    const topicHash = hashTopic(topic);

    if (!GLOBAL_DHT.has(topicHash)) {
      GLOBAL_DHT.set(topicHash, new Map());
    }

    const peerInfo: PeerInfo = {
      peerId: this.peerId,
      address: this.address,
      topics: [topic],
      announcedAt: Date.now(),
      lastSeenAt: Date.now(),
      isLocal: true,
    };

    GLOBAL_DHT.get(topicHash)!.set(this.peerId, peerInfo);

    const handle: TopicHandle = {
      topic,
      topicHash,
      isAnnouncing: true,
      isLooking: typeof config === 'object' ? config.lookup : true,
      joinedAt: Date.now(),
    };

    this.handles.set(topic, handle);
    return handle;
  }

  /**
   * Lookup peers on a topic. Returns currently announced peers.
   */
  lookup(topic: string): PeerInfo[] {
    const topicHash = hashTopic(topic);
    const topicPeers = GLOBAL_DHT.get(topicHash);
    if (!topicPeers) return [];

    const peers = [...topicPeers.values()].filter(p => p.peerId !== this.peerId);

    this.emit({
      type: 'lookup-complete',
      topic,
      peers,
      timestamp: Date.now(),
    });

    return peers;
  }

  /**
   * Leave a topic (stop announcing/looking).
   */
  leave(topic: string): void {
    const topicHash = hashTopic(topic);
    GLOBAL_DHT.get(topicHash)?.delete(this.peerId);
    this.handles.delete(topic);

    this.emit({
      type: 'peer-removed',
      topic,
      peerId: this.peerId,
      timestamp: Date.now(),
    });
  }

  /**
   * Get all currently known peers across all topics.
   */
  getPeers(topic?: string): PeerInfo[] {
    if (topic) {
      const topicHash = hashTopic(topic);
      return [...(GLOBAL_DHT.get(topicHash)?.values() ?? [])].filter(
        p => p.peerId !== this.peerId,
      );
    }

    const all = new Map<string, PeerInfo>();
    for (const handle of this.handles.values()) {
      const topicPeers = GLOBAL_DHT.get(handle.topicHash);
      if (topicPeers) {
        for (const [id, peer] of topicPeers) {
          if (id !== this.peerId) all.set(id, peer);
        }
      }
    }
    return [...all.values()];
  }

  /**
   * Get active topic handles.
   */
  getTopics(): TopicHandle[] {
    return [...this.handles.values()];
  }

  /**
   * Subscribe to discovery events.
   */
  on(listener: DiscoveryListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * Destroy this manager — leave all topics.
   */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    for (const topic of this.handles.keys()) {
      this.leave(topic);
    }
    this.listeners = [];
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private emit(event: DiscoveryEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}

/**
 * Reset the global DHT (for testing isolation).
 */
export function resetGlobalDHT(): void {
  GLOBAL_DHT.clear();
}

/**
 * Get all peers on a topic from the global DHT (for testing/inspection).
 */
export function getDHTTopicPeers(topic: string): PeerInfo[] {
  const topicHash = hashTopic(topic);
  return [...(GLOBAL_DHT.get(topicHash)?.values() ?? [])];
}
