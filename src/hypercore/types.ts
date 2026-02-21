// Hypercore Protocol — Core Types
// Sprint S2-01 | P2P Hypercore Protocol (Reel 1)

import { z } from 'zod';

// ─── Entry Types ─────────────────────────────────────────────────────────────

export const MemoryNodeEntrySchema = z.object({
  type: z.literal('memory-node'),
  nodeId: z.string(),
  agentId: z.string(),
  content: z.string(),
  tags: z.array(z.string()).default([]),
  tasteScore: z.number().min(0).max(1).default(0.5),
  timestamp: z.number(),
  vectorClock: z.record(z.number()).default({}),
});
export type MemoryNodeEntry = z.infer<typeof MemoryNodeEntrySchema>;

export const CRDTUpdateEntrySchema = z.object({
  type: z.literal('crdt-update'),
  operationId: z.string(),
  peerId: z.string(),
  targetNodeId: z.string(),
  operation: z.enum(['insert', 'delete', 'update', 'move']),
  payload: z.unknown(),
  vectorClock: z.record(z.number()),
  timestamp: z.number(),
});
export type CRDTUpdateEntry = z.infer<typeof CRDTUpdateEntrySchema>;

export const HypercoreLogEventSchema = z.object({
  eventType: z.enum(['append', 'replicate', 'error', 'health-warning', 'ready', 'crdt-update']),
  logName: z.string(),
  seq: z.number().optional(),
  peerId: z.string().optional(),
  direction: z.enum(['send', 'receive']).optional(),
  bytes: z.number().optional(),
  errorCode: z.string().optional(),
  message: z.string().optional(),
  timestamp: z.number(),
});
export type HypercoreLogEvent = z.infer<typeof HypercoreLogEventSchema>;

export const StorageMetadataSchema = z.object({
  storagePath: z.string(),
  logCount: z.number(),
  totalBytes: z.number(),
  initializedAt: z.number(),
  replicationEnabled: z.boolean(),
});
export type StorageMetadata = z.infer<typeof StorageMetadataSchema>;

export const ManagerStatusSchema = z.object({
  ready: z.boolean(),
  logCount: z.number(),
  replicationEnabled: z.boolean(),
  peerCount: z.number(),
  errorCount: z.number(),
  uptimeMs: z.number(),
});
export type ManagerStatus = z.infer<typeof ManagerStatusSchema>;

export const ReplicationStatusSchema = z.object({
  enabled: z.boolean(),
  peerCount: z.number(),
  peers: z.array(z.object({
    peerId: z.string(),
    connectedAt: z.number(),
    bytesReceived: z.number(),
    bytesSent: z.number(),
    logsReplicated: z.array(z.string()),
  })),
  bytesTotal: z.number(),
});
export type ReplicationStatus = z.infer<typeof ReplicationStatusSchema>;

export const HypercoreErrorSchema = z.object({
  code: z.enum([
    'STORAGE_INACCESSIBLE',
    'OUT_OF_RANGE',
    'PAYLOAD_TOO_LARGE',
    'DESERIALIZATION_FAILED',
    'UNAUTHORIZED',
    'SIGNATURE_VERIFICATION_FAILED',
    'PEER_TIMEOUT',
    'UNKNOWN',
  ]),
  message: z.string(),
  logName: z.string().optional(),
  seq: z.number().optional(),
  cause: z.string().optional(),
});
export type HypercoreError = z.infer<typeof HypercoreErrorSchema>;

// ─── Sprint-level Types ───────────────────────────────────────────────────────

export type HypercoreEntryType = 'memory-node' | 'crdt-update' | 'raw';

export const HypercoreEntrySchema = z.object({
  seq: z.number(),
  hash: z.string(),
  timestamp: z.number(),
  byteLength: z.number(),
  data: z.unknown(),
});
export type HypercoreEntry = z.infer<typeof HypercoreEntrySchema>;

export const ReplicationPeerSchema = z.object({
  peerId: z.string(),
  address: z.string(),
  connectedAt: z.number(),
  bytesReceived: z.number(),
  bytesSent: z.number(),
  logsReplicated: z.array(z.string()),
  isActive: z.boolean(),
});
export type ReplicationPeer = z.infer<typeof ReplicationPeerSchema>;

export const DiscoveryConfigSchema = z.object({
  topic: z.string(),
  lookup: z.boolean().default(true),
  announce: z.boolean().default(true),
  port: z.number().optional(),
  bootstrap: z.array(z.string()).default([]),
});
export type DiscoveryConfig = z.infer<typeof DiscoveryConfigSchema>;

export const HypercoreMetadataSchema = z.object({
  name: z.string(),
  publicKey: z.string(),
  length: z.number(),
  byteLength: z.number(),
  writable: z.boolean(),
  createdAt: z.number(),
  updatedAt: z.number(),
});
export type HypercoreMetadata = z.infer<typeof HypercoreMetadataSchema>;

export const HypercoreStoreConfigSchema = z.object({
  storagePath: z.string().default('.nova/hypercore'),
  maxPayloadBytes: z.number().default(1_048_576),
  replicationEnabled: z.boolean().default(false),
  healthWarningThreshold: z.number().default(10),
  healthWarningWindowMs: z.number().default(60_000),
});
export type HypercoreStoreConfig = z.infer<typeof HypercoreStoreConfigSchema>;
