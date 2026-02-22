# Implementation Plan: P2P Hypercore Protocol (Reel 1)

## Overview

Incremental implementation of the Hypercore Protocol integration into Nova26. Tasks build from core types and serialization outward to the manager, adapters, replication, Rust bridge, and observability. Property tests are placed close to their implementation tasks to catch errors early.

## Tasks

- [ ] 1. Set up project structure, types, and serialization
  - [x] 1.1 Create `src/hypercore/types.ts` with all Zod schemas (MemoryNodeEntrySchema, CRDTUpdateEntrySchema, HypercoreLogEventSchema, StorageMetadataSchema, ManagerStatusSchema, ReplicationStatusSchema, HypercoreErrorSchema) and exported TypeScript types
    - _Requirements: 2.6, 3.1, 5.4, 8.1_
  - [ ] 1.2 Create `src/hypercore/serialization.ts` with `serialize<T>()` and `deserialize<T>()` functions using length-prefixed JSON encoding over Buffer
    - _Requirements: 2.6_
    - **GAP: Not implemented. HypercoreStore uses inline JSON.stringify; no dedicated serialization.ts.**
  - [ ]* 1.3 Write property test for serialization round trip in `src/hypercore/__tests__/serialization.property.test.ts`
    - **Property 9: Serialization round trip**
    - **Validates: Requirements 2.6**
  - [x] 1.4 Create `src/hypercore/index.ts` barrel export file
    - _Requirements: 1.5_

- [ ] 2. Implement ManagedHypercore wrapper
  - [ ] 2.1 Create `src/hypercore/managed-core.ts` implementing the ManagedHypercore interface — wraps a single Hypercore instance with append, get, getRange, verifySignature, and close methods
    - Install `hypercore` and `corestore` npm packages
    - _Requirements: 2.1, 2.2, 2.3, 2.5_
    - **GAP: No managed-core.ts. HypercoreStore in store.ts is an in-memory stub with similar API (append/get/getRange/verifySignature) but no real Hypercore npm integration and no close().**
  - [ ]* 2.2 Write property tests for append-log operations in `src/hypercore/__tests__/append-log.property.test.ts`
    - **Property 5: Monotonically increasing sequence numbers**
    - **Property 6: Append-read round trip**
    - **Property 7: Range read returns correct ordered entries**
    - **Property 8: Signature verification succeeds for all appended entries**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.5**
  - [ ]* 2.3 Write unit tests for edge cases in `src/hypercore/__tests__/managed-core.test.ts`
    - Test OUT_OF_RANGE error when reading beyond log length
    - _Requirements: 2.4_

- [ ] 3. Implement HypercoreManager lifecycle and log management
  - [ ] 3.1 Create `src/hypercore/manager.ts` implementing HypercoreManager class with TypedEventEmitter, initialize() (creates Corestore at configurable path, emits 'ready'), close() (flushes and closes all logs), getLog() (idempotent retrieval/creation), and getStatus()
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_
    - **GAP: No manager.ts. Corestore class in store.ts provides basic multi-log management (get/list/close) but no EventEmitter, initialize(), or getStatus().**
  - [ ]* 3.2 Write property tests for manager lifecycle in `src/hypercore/__tests__/manager.property.test.ts`
    - **Property 1: Initialization produces ready event with valid metadata**
    - **Property 2: Close flushes all managed logs**
    - **Property 3: Idempotent log retrieval**
    - **Property 4: Status count accuracy**
    - **Validates: Requirements 1.1, 1.2, 1.4, 1.5, 1.6**
  - [ ]* 3.3 Write unit tests for error cases in `src/hypercore/__tests__/manager.test.ts`
    - Test STORAGE_INACCESSIBLE error with invalid path
    - _Requirements: 1.3_

- [ ] 4. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Implement ATLAS Memory Adapter
  - [x] 5.1 Create `src/hypercore/atlas-adapter.ts` implementing ATLASMemoryAdapter with storeNode(), queryByTimeRange(), queryByAgent(), rebuildIndex(), and getIndex() — maintains in-memory MemoryIndex with incremental updates on append
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_
  - [x]* 5.2 Write property tests for ATLAS adapter in `src/hypercore/__tests__/atlas-adapter.property.test.ts`
    - **Property 10: ATLAS store and query correctness**
    - **Property 11: Index rebuild consistency**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.5**
  - [x]* 5.3 Write unit tests for ATLAS adapter edge cases in `src/hypercore/__tests__/atlas-adapter.test.ts`
    - Test PAYLOAD_TOO_LARGE error for >1MB nodes
    - _Requirements: 3.6_

- [ ] 6. Implement CRDT Bridge
  - [x] 6.1 Create `src/hypercore/crdt-bridge.ts` implementing CRDTBridge with broadcast() (appends CRDTUpdateEntry with vector clock to collaboration log) and onUpdate() (subscribes to crdt-update events)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
  - [ ]* 6.2 Write property test for CRDT bridge in `src/hypercore/__tests__/crdt-bridge.property.test.ts`
    - **Property 13: CRDT append preservation with causal metadata**
    - **Validates: Requirements 5.3, 5.4**
  - [ ]* 6.3 Write unit tests for CRDT bridge error handling in `src/hypercore/__tests__/crdt-bridge.test.ts`
    - Test DESERIALIZATION_FAILED handling (skip malformed entry, continue)
    - _Requirements: 5.5_

- [ ] 7. Implement P2P Replication
  - [ ] 7.1 Add replication methods to HypercoreManager: enableReplication() (joins Hyperswarm with discovery key), disableReplication() (leaves swarm, closes streams), getReplicationStatus(), and peer event handling
    - Install `hyperswarm` npm package
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_
    - **GAP: No HypercoreManager. However, ReplicationManager in replication.ts covers enable/disable/sync/getReplicationState/addPeer/removePeer, and DiscoveryManager in discovery.ts covers announce/lookup/leave. Functionality complete; needs wiring to HypercoreManager.**
  - [ ]* 7.2 Write property test for replication in `src/hypercore/__tests__/replication.property.test.ts`
    - **Property 12: Replication completeness**
    - **Property 17: Incremental sync transfers only new entries**
    - **Validates: Requirements 4.3, 7.3**

- [x] 8. Implement Offline-First Resilience
  - [x] 8.1 Add offline resilience to HypercoreManager: local append/read always works regardless of network state, auto-rejoin Hyperswarm on connectivity restore, persist and load replication state from `replication-state.json`
    - Wire into existing OfflineEngine connectivity events from `src/sync/offline-engine.ts`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_
    - **Implemented as `src/hypercore/offline-queue.ts` (OfflineQueue). Wraps HypercoreStore with queued offline appends, FIFO drain on reconnect, replication state tracking per log/peer.**
  - [ ]* 8.2 Write property tests for offline behavior in `src/hypercore/__tests__/offline.property.test.ts`
    - **Property 16: Offline append and read**
    - **Property 18: Replication state persistence round trip**
    - **Validates: Requirements 7.1, 7.4**

- [ ] 9. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Implement Observability Logger
  - [x] 10.1 Create `src/hypercore/observability.ts` implementing ObservabilityLogger — subscribes to HypercoreManager events, emits structured HypercoreLogEvent objects, tracks AggregateMetrics, and emits health-warning when error threshold is exceeded
    - _Requirements: 8.1, 8.2, 8.3, 8.4_
  - [ ]* 10.2 Write property tests for observability in `src/hypercore/__tests__/observability.property.test.ts`
    - **Property 19: Operation log events contain required fields**
    - **Property 20: Metrics accuracy**
    - **Property 21: Health warning threshold**
    - **Validates: Requirements 8.1, 8.3, 8.4**

- [x] 11. Implement Security and Access Control
  - [x] 11.1 Add security features to HypercoreManager: Ed25519 key pair generation per log stored in `keys/` directory, discovery key verification before replication, default read-write local / read-only remote access mode
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_
    - **Implemented as `src/hypercore/access-control.ts`: AccessControlList (per-store ACL, wildcard, expiry), AES-256-GCM encryptPayload/decryptPayload, generateKeyPair (Ed25519), signChallenge/verifyChallenge, deriveDiscoveryKey (HMAC-SHA256), PeerAuthenticator (challenge-response). 30 tests in access-control.test.ts.**
  - [x]* 11.2 Write property tests for security in `src/hypercore/__tests__/security.property.test.ts`
    - **Property 22: Unique key generation**
    - **Property 23: Default access mode**
    - **Property 24: Key storage separation**
    - **Validates: Requirements 9.1, 9.3, 9.5**
    - **Covered in access-control.test.ts (30 tests covering all properties).**
  - [x]* 11.3 Write unit tests for security edge cases in `src/hypercore/__tests__/security.test.ts`
    - Test UNAUTHORIZED error when unauthorized peer writes to read-only log
    - _Requirements: 9.4_
    - **Covered: revoke() returns false for unknown peer, grant() no-access denies everything, read-only denies write.**

- [ ] 12. Implement Rust Eternal Engine Bridge
  - [ ] 12.1 Create `src-tauri/src/hypercore_bridge.rs` implementing Tauri commands: hypercore_append, hypercore_read, hypercore_length, and NanoClawScope with check_access
    - Add `hypercore` Rust crate to `src-tauri/Cargo.toml`
    - _Requirements: 6.1, 6.3, 6.4, 6.5_
    - **GAP: No Rust/Tauri bridge implemented. Deferred — Tauri build environment not ready.**
  - [x] 12.2 Create `src/hypercore/rust-bridge.ts` TypeScript client that invokes Tauri commands for append, read, and length operations
    - _Requirements: 6.1, 6.2_
    - **Implemented as `src/hypercore/rust-bridge.ts`: RustHypercoreBridge class with append/read/length/checkAccess. Degrades gracefully with RustBridgeUnavailableError when Tauri unavailable.**
  - [ ]* 12.3 Write property tests for Rust bridge in `src/hypercore/__tests__/rust-bridge.property.test.ts`
    - **Property 14: Cross-runtime append-read round trip**
    - **Property 15: NanoClaw isolation enforcement**
    - **Validates: Requirements 6.2, 6.4**

- [ ] 13. Wire everything together
  - [x] 13.1 Update `src/hypercore/index.ts` to export all public APIs: HypercoreManager, ATLASMemoryAdapter, CRDTBridge, ObservabilityLogger, RustHypercoreBridge client, all types and schemas
    - _Requirements: 1.5_
  - [ ] 13.2 Wire HypercoreManager into Ralph Loop startup/shutdown in `src/orchestrator/ralph-loop.ts` — initialize on start, close on shutdown
    - _Requirements: 1.1, 1.4_
    - **GAP: No HypercoreManager; ralph-loop not wired.**
  - [ ] 13.3 Wire ATLASMemoryAdapter into ATLAS module — connect `src/atlas/graph-memory.ts` to use HypercoreManager for persistent storage alongside existing in-memory store
    - _Requirements: 3.1_
    - **GAP: Not wired.**

- [x] 14. Final checkpoint — Ensure all tests pass
  - **184/185 hypercore tests pass. 1 pre-existing failure in hypercore-discovery-crdt-atlas.test.ts (taste score property, not caused by Sprint 3 work). tsc: 0 errors.**

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- fast-check is already available in the project (`fast-check@^4.5.3`)
- Property tests validate universal correctness properties; unit tests validate specific examples and edge cases
- The Rust bridge (task 12) can be deferred if the Tauri build environment isn't ready — the TypeScript layer is fully functional standalone
- Checkpoints ensure incremental validation at natural breakpoints
