# Requirements Document

## Introduction

This document specifies the requirements for integrating Hypercore Protocol into Nova26 as a distributed P2P data backbone (Reel 1). Hypercore provides append-only immutable logs with cryptographic signing, P2P replication via Hyperswarm/DHT, and lightweight storage. The integration targets four primary areas: ATLAS hierarchical memory persistence, real-time CRDT collaboration, Eternal Engine Rust core state management, and offline-first data resilience. This is the foundational layer (Reel 1) that establishes the core Hypercore infrastructure upon which future features (global wisdom sharing, advanced swarm workflows) will build.

## Glossary

- **Hypercore**: An append-only log data structure with cryptographic signing and verification, from the Holepunch/Dat ecosystem (MIT-licensed)
- **Corestore**: A management layer that handles multiple Hypercore instances, providing namespaced storage and key derivation
- **Hyperdrive**: A P2P file system built on top of Hypercore, used for distributing file-based data across peers
- **Hyperswarm**: A distributed networking stack using DHT (Distributed Hash Table) for peer discovery and hole-punching for NAT traversal
- **Append_Only_Log**: An immutable data structure where entries can only be added to the end, never modified or deleted
- **CRDT**: Conflict-free Replicated Data Type, a data structure that can be merged across distributed nodes without coordination
- **NanoClaw**: An isolation wrapper within the Eternal Engine Rust binary that sandboxes modules for safe execution
- **Eternal_Engine**: The planned <8MB Rust binary core of Nova26 (ZeroClaw + TinyClaw) for persistent, fault-tolerant agent state
- **Ralph_Loop**: The core orchestration engine of Nova26 that picks tasks, loads agents, calls LLMs, and validates outputs
- **ATLAS_Memory**: The hierarchical memory system (R23-03) used by Nova26 agents to store and retrieve learned patterns and insights
- **Peer**: A node in the P2P network that can both produce and consume Hypercore data
- **Replication_Stream**: A bidirectional data channel between two peers used to synchronize Hypercore logs
- **Discovery_Key**: A hash derived from a Hypercore's public key, used for peer discovery without revealing the actual key
- **HypercoreManager**: The central TypeScript service that initializes, manages, and exposes Hypercore/Corestore instances to Nova26 subsystems
- **RustHypercoreBridge**: The Rust-side module within the Eternal Engine that provides native Hypercore operations via FFI or WASM bindings

## Requirements

### Requirement 1: Hypercore Storage Initialization and Lifecycle

**User Story:** As a Nova26 system operator, I want the Hypercore storage layer to initialize reliably and manage its lifecycle, so that all subsystems have a stable append-only log foundation available on startup.

#### Acceptance Criteria

1. WHEN Nova26 starts, THE HypercoreManager SHALL initialize a Corestore instance at a configurable storage path
2. WHEN the Corestore initializes successfully, THE HypercoreManager SHALL emit a ready event with the storage metadata
3. IF the configured storage path is inaccessible, THEN THE HypercoreManager SHALL return a descriptive error including the path and the underlying OS error
4. WHEN Nova26 shuts down, THE HypercoreManager SHALL close all open Hypercore instances and flush pending writes before releasing resources
5. WHEN a subsystem requests a named Hypercore log, THE HypercoreManager SHALL return an existing instance or create a new one within the Corestore namespace
6. THE HypercoreManager SHALL expose the total number of managed Hypercore instances and their combined byte size via a status query

### Requirement 2: Append-Only Log Operations

**User Story:** As a Nova26 agent (e.g., ATLAS, PLUTO, SATURN), I want to append entries to and read entries from Hypercore logs, so that I can persist immutable records of insights, reflections, and state changes.

#### Acceptance Criteria

1. WHEN an agent appends a valid entry to a Hypercore log, THE Append_Only_Log SHALL assign a monotonically increasing sequence number and return it to the caller
2. WHEN an agent reads an entry by sequence number, THE Append_Only_Log SHALL return the exact bytes that were originally appended at that position
3. WHEN an agent requests a range of entries, THE Append_Only_Log SHALL return all entries within the specified start and end sequence numbers in order
4. IF an agent attempts to read a sequence number beyond the current log length, THEN THE Append_Only_Log SHALL return an out-of-range error with the current length
5. THE Append_Only_Log SHALL verify the cryptographic signature of each entry on read, confirming data integrity
6. WHEN an entry is appended, THE Append_Only_Log SHALL serialize the entry payload using a binary encoding format and THE Append_Only_Log SHALL deserialize it back to an equivalent object on read (round-trip property)

### Requirement 3: ATLAS Memory Integration

**User Story:** As the ATLAS agent, I want to store memory nodes in Hypercore logs, so that learned patterns and insights are persisted immutably across sessions and can be replicated to peers.

#### Acceptance Criteria

1. WHEN ATLAS stores a memory node, THE HypercoreManager SHALL append a serialized MemoryNode to the designated ATLAS Hypercore log
2. WHEN ATLAS queries memory nodes by time range, THE HypercoreManager SHALL return all MemoryNode entries whose timestamps fall within the specified range
3. WHEN ATLAS queries memory nodes by agent source, THE HypercoreManager SHALL return all MemoryNode entries attributed to the specified agent identifier
4. THE HypercoreManager SHALL maintain an in-memory index of MemoryNode metadata (timestamp, agent source, category) for query performance
5. WHEN the in-memory index is rebuilt from a Hypercore log, THE HypercoreManager SHALL produce an index identical to one built incrementally during appends (index consistency property)
6. IF a MemoryNode payload exceeds 1MB, THEN THE HypercoreManager SHALL reject the append and return a payload-too-large error

### Requirement 4: P2P Replication and Peer Discovery

**User Story:** As a Nova26 user running multiple instances, I want Hypercore logs to replicate between peers automatically, so that agent memory and state stay synchronized across devices.

#### Acceptance Criteria

1. WHEN replication is enabled, THE HypercoreManager SHALL join the Hyperswarm network using the Discovery_Key of each shared Hypercore log
2. WHEN a remote peer is discovered for a shared log, THE HypercoreManager SHALL establish a Replication_Stream and begin bidirectional synchronization
3. WHEN a Replication_Stream completes synchronization, THE Append_Only_Log on the receiving peer SHALL contain all entries from the sending peer in the same sequence order
4. IF a Replication_Stream is interrupted, THEN THE HypercoreManager SHALL resume replication from the last confirmed sequence number on reconnection
5. WHEN replication is disabled, THE HypercoreManager SHALL leave the Hyperswarm network and close all active Replication_Streams gracefully
6. THE HypercoreManager SHALL expose the count of active peers and replication progress (local length vs. remote length) per Hypercore log via a status query

### Requirement 5: CRDT Collaboration Bridge

**User Story:** As a Nova26 user collaborating in real-time, I want CRDT state changes to propagate via Hypercore replication, so that multiple users or parallel agent universes can sync changes offline and resolve conflicts.

#### Acceptance Criteria

1. WHEN a local CRDT state update occurs, THE HypercoreManager SHALL append the CRDT update payload to a designated collaboration Hypercore log
2. WHEN a CRDT update is received from a remote peer via replication, THE HypercoreManager SHALL emit a crdt-update event containing the deserialized update payload
3. WHEN multiple CRDT updates are appended concurrently by different peers, THE Append_Only_Log SHALL preserve each update as a separate entry without data loss
4. THE HypercoreManager SHALL maintain causal ordering metadata alongside each CRDT update entry to support conflict resolution
5. IF a CRDT update payload fails deserialization, THEN THE HypercoreManager SHALL log the error with the entry sequence number and skip the entry without halting replication

### Requirement 6: Rust Eternal Engine Bridge

**User Story:** As the Eternal Engine runtime, I want native Rust bindings to Hypercore operations, so that the <8MB binary can persist and replicate agent state without depending on the Node.js layer.

#### Acceptance Criteria

1. THE RustHypercoreBridge SHALL expose append, read, and length operations for Hypercore logs via a Rust FFI interface
2. WHEN the RustHypercoreBridge appends an entry, THE entry SHALL be readable from both the Rust FFI interface and the TypeScript HypercoreManager accessing the same storage
3. THE RustHypercoreBridge SHALL add no more than 2MB to the compiled Eternal Engine binary size
4. WHEN a NanoClaw isolation boundary wraps a Hypercore module, THE RustHypercoreBridge SHALL restrict that module to only its designated Hypercore logs
5. IF the Rust FFI call encounters a storage I/O error, THEN THE RustHypercoreBridge SHALL return a structured error code and message to the calling Rust context

### Requirement 7: Offline-First Resilience and Recovery

**User Story:** As a Nova26 user working offline, I want Hypercore data to persist locally and sync automatically when connectivity returns, so that I never lose agent work due to network interruptions.

#### Acceptance Criteria

1. WHEN the network is unavailable, THE HypercoreManager SHALL continue to accept append and read operations against local Hypercore storage
2. WHEN network connectivity is restored, THE HypercoreManager SHALL automatically rejoin the Hyperswarm network and resume replication of all shared logs
3. WHEN replication resumes after an offline period, THE Append_Only_Log SHALL synchronize only the entries appended since the last successful replication point (incremental sync)
4. THE HypercoreManager SHALL persist replication state (last synced sequence numbers per peer) to local storage so that recovery after a crash resumes from the correct position
5. IF local storage becomes corrupted, THEN THE HypercoreManager SHALL detect the corruption via cryptographic verification and report the affected log and sequence range

### Requirement 8: Observability and Audit Logging

**User Story:** As a Nova26 system operator, I want auditable logs of all Hypercore operations, so that I can monitor system health, debug replication issues, and satisfy observability requirements (R18-05).

#### Acceptance Criteria

1. WHEN any Hypercore operation (append, read, replicate, error) occurs, THE HypercoreManager SHALL emit a structured log event with operation type, log identifier, sequence number, and timestamp
2. WHEN a replication event occurs, THE HypercoreManager SHALL include peer identifier, direction (send/receive), and byte count in the log event
3. THE HypercoreManager SHALL expose aggregate metrics (total appends, total reads, replication bytes transferred, error count) via a metrics query
4. WHEN the error count for a specific Hypercore log exceeds a configurable threshold within a time window, THE HypercoreManager SHALL emit a health-warning event

### Requirement 9: Security and Access Control

**User Story:** As a Nova26 user, I want Hypercore data to be cryptographically secured and access-controlled, so that only authorized peers can read or replicate my agent data.

#### Acceptance Criteria

1. THE HypercoreManager SHALL generate and store a unique Ed25519 key pair for each Hypercore log at creation time
2. WHEN a peer requests replication of a Hypercore log, THE HypercoreManager SHALL verify the peer possesses the correct Discovery_Key before establishing a Replication_Stream
3. WHEN a new Hypercore log is created, THE HypercoreManager SHALL default to read-write access for the local peer and read-only access for remote peers
4. IF an unauthorized peer attempts to write to a read-only replicated log, THEN THE HypercoreManager SHALL reject the write and log a security event
5. THE HypercoreManager SHALL store private keys in a platform-appropriate secure storage location, separate from the Hypercore data files
