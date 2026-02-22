// P2P Hypercore Protocol — Public API
// Sprint S2-01..S2-09 | Reel 1

export * from './types.js';
export { HypercoreStore, Corestore, HypercoreOutOfRangeError, HypercorePayloadTooLargeError } from './store.js';
export type { AppendResult, RangeResult } from './store.js';
export { ReplicationManager, computeMerkleRoot } from './replication.js';
export type { SyncResult, ReplicationState } from './replication.js';
export { DiscoveryManager, resetGlobalDHT, getDHTTopicPeers } from './discovery.js';
export type { PeerInfo, TopicHandle, DiscoveryEvent } from './discovery.js';
export { ATLASMemoryAdapter } from './atlas-adapter.js';
export type { MemoryIndex, TimeRangeQuery, AgentQuery, IndexRebuildResult } from './atlas-adapter.js';
export { CRDTBridge } from './crdt-bridge.js';
export type { BroadcastResult } from './crdt-bridge.js';
export { ObservabilityLogger } from './observability.js';
export type { AggregateMetrics, HealthStatus } from './observability.js';
export { OfflineQueue } from './offline-queue.js';
export type { QueuedOperation, DrainResult, ReplicationState as OfflineReplicationState, OfflineQueueStats } from './offline-queue.js';
export {
  AccessControlList,
  generateEncryptionKey,
  encryptPayload,
  decryptPayload,
  generateKeyPair,
  signChallenge,
  verifyChallenge,
  deriveDiscoveryKey,
  PeerAuthenticator,
} from './access-control.js';
export type { AccessMode, AccessPolicy, AccessCheckResult, KeyPair, PeerCredential, EncryptedPayload } from './access-control.js';
export { RustHypercoreBridge, RustBridgeUnavailableError, RustBridgeOperationError } from './rust-bridge.js';
export type { RustAppendResult, RustReadResult, RustBridgeStatus } from './rust-bridge.js';
