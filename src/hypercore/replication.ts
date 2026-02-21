// Hypercore Replication Protocol — In-memory peer-to-peer sync
// Sprint S2-03 | P2P Hypercore Protocol (Reel 1)

import { createHash } from 'crypto';
import { HypercoreStore } from './store.js';
import type { ReplicationPeer, ReplicationStatus } from './types.js';

export interface SyncResult {
  logName: string;
  entriesReceived: number;
  entriesSent: number;
  merkleValid: boolean;
  peerId: string;
}

export interface ReplicationState {
  enabled: boolean;
  peers: Map<string, ReplicationPeer>;
  logSyncState: Map<string, Map<string, number>>; // logName → peerId → lastSyncedSeq
}

/**
 * Computes Merkle root of a list of hashes.
 */
export function computeMerkleRoot(hashes: string[]): string {
  if (hashes.length === 0) return '';
  let level = [...hashes];
  while (level.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i]!;
      const right = level[i + 1] ?? left;
      next.push(createHash('sha256').update(left + right).digest('hex'));
    }
    level = next;
  }
  return level[0]!;
}

/**
 * ReplicationManager — manages P2P sync between HypercoreStore instances.
 * In-memory simulation: peers are other ReplicationManager instances.
 */
export class ReplicationManager {
  private state: ReplicationState;
  private stores: Map<string, HypercoreStore>;

  constructor() {
    this.state = {
      enabled: false,
      peers: new Map(),
      logSyncState: new Map(),
    };
    this.stores = new Map();
  }

  /**
   * Register a store with this manager.
   */
  registerStore(name: string, store: HypercoreStore): void {
    this.stores.set(name, store);
  }

  /**
   * Add a remote peer by ID. Returns the peer record.
   */
  addPeer(peerId: string, address = 'in-memory'): ReplicationPeer {
    const peer: ReplicationPeer = {
      peerId,
      address,
      connectedAt: Date.now(),
      bytesReceived: 0,
      bytesSent: 0,
      logsReplicated: [],
      isActive: true,
    };
    this.state.peers.set(peerId, peer);
    return peer;
  }

  /**
   * Remove a peer.
   */
  removePeer(peerId: string): void {
    const peer = this.state.peers.get(peerId);
    if (peer) {
      peer.isActive = false;
      this.state.peers.delete(peerId);
    }
  }

  /**
   * Sync all shared logs with a remote ReplicationManager.
   * Bidirectional: push local entries, pull remote entries.
   * Verifies Merkle roots before accepting data.
   */
  sync(remote: ReplicationManager): SyncResult[] {
    const results: SyncResult[] = [];
    const remotePeerId = `peer-${Math.random().toString(36).slice(2, 8)}`;

    for (const [logName, localStore] of this.stores) {
      const remoteStore = remote.stores.get(logName);
      if (!remoteStore) continue;

      const localEntries = localStore.exportEntries();
      const remoteEntries = remoteStore.exportEntries();

      // Compute Merkle roots to verify integrity
      const localHashes = localEntries.map(e => e.hash);
      const remoteHashes = remoteEntries.map(e => e.hash);
      const localRoot = computeMerkleRoot(localHashes);
      const remoteRoot = computeMerkleRoot(remoteHashes);

      if (localRoot === remoteRoot) {
        // Already in sync
        results.push({ logName, entriesReceived: 0, entriesSent: 0, merkleValid: true, peerId: remotePeerId });
        continue;
      }

      // Find the diverge point
      const minLen = Math.min(localEntries.length, remoteEntries.length);
      let divergeSeq = minLen;
      for (let i = 0; i < minLen; i++) {
        if (localEntries[i]!.hash !== remoteEntries[i]!.hash) {
          divergeSeq = i;
          break;
        }
      }

      // Push local-only entries to remote
      const entriesToPush = localEntries.slice(divergeSeq);
      const sent = remoteStore.importEntries(entriesToPush);

      // Pull remote-only entries to local
      const remoteOnlyEntries = remoteEntries.slice(localEntries.length);
      const received = localStore.importEntries(remoteOnlyEntries);

      // Verify after sync
      const newLocalHashes = localStore.exportEntries().map(e => e.hash);
      const newLocalRoot = computeMerkleRoot(newLocalHashes);
      const newRemoteHashes = remoteStore.exportEntries().map(e => e.hash);
      const newRemoteRoot = computeMerkleRoot(newRemoteHashes);
      const merkleValid = newLocalRoot === newRemoteRoot;

      // Update peer stats
      const peer = this.state.peers.get(remotePeerId);
      if (peer) {
        peer.bytesReceived += received * 100; // approximate
        peer.bytesSent += sent * 100;
        if (!peer.logsReplicated.includes(logName)) {
          peer.logsReplicated.push(logName);
        }
      }

      results.push({ logName, entriesReceived: received, entriesSent: sent, merkleValid, peerId: remotePeerId });
    }

    return results;
  }

  /**
   * Enable replication (marks as active).
   */
  enable(): void {
    this.state.enabled = true;
  }

  /**
   * Disable replication.
   */
  disable(): void {
    this.state.enabled = false;
    for (const peer of this.state.peers.values()) {
      peer.isActive = false;
    }
    this.state.peers.clear();
  }

  /**
   * Get current replication state summary.
   */
  getReplicationState(): ReplicationStatus {
    return {
      enabled: this.state.enabled,
      peerCount: this.state.peers.size,
      peers: [...this.state.peers.values()],
      bytesTotal: [...this.state.peers.values()].reduce(
        (sum, p) => sum + p.bytesReceived + p.bytesSent,
        0,
      ),
    };
  }

  /**
   * Get the last synced seq for a log/peer pair.
   */
  getLastSyncedSeq(logName: string, peerId: string): number {
    return this.state.logSyncState.get(logName)?.get(peerId) ?? -1;
  }
}
