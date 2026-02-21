# SONNET 4.6 — Sprint 2: "The Eternal Architect"
## February 21–23, 2026 (48 Hours)

> **Provider**: Anthropic (terminal)
> **Sprint 1 Status**: COMPLETE (S1–S21, all 21 tasks delivered)
> **Sprint 2 Focus**: Eternal Data Reel features — P2P Hypercore Protocol + Hypervisor Hypercore + A2A/MCP Protocols
> **Duration**: 48 hours (4 waves × 12 hours)
> **Project folder**: `/Users/jonathannelsen/nova26/kiro/nova26`
> **Spec files**: `.kiro/specs/p2p-hypercore-protocol/`, `.kiro/specs/hypervisor-hypercore/`, `.kiro/specs/a2a-mcp-protocols/`

---

## SPRINT 1 RECAP (All Complete)

S1–S6: Next.js wiring, Tailwind, ConvexProvider, Auth, Middleware, Bridge
S7–S12: Dashboard layout, overview, builds, agents, settings, activity feed
S13–S16: Landing CTA, responsive, polish, search (Cmd+K)
S17–S21: TypeScript QA, security audit, smoke test, hardening, accessibility

---

## SPRINT 2 RULES

- TypeScript strict, ESM `.js` imports, vitest, no `any`, mock all I/O
- All new code in `src/` (not `app/` or `convex/`)
- Follow Kiro spec task lists exactly — each task references requirements
- Property-based tests use `fast-check` (already in dependencies)
- Run `tsc --noEmit` after each task — must be 0 errors
- Commit after each task: `feat(S2-XX): <description>`

---

## WAVE 1 (Hours 0–12): P2P Hypercore Protocol — Foundation

> Spec: `.kiro/specs/p2p-hypercore-protocol/tasks.md`
> Target: Tasks 1–5 (types, schemas, core store, replication, discovery)

### Task S2-01: Hypercore Types + Schemas
Read `.kiro/specs/p2p-hypercore-protocol/tasks.md` Task 1 (all sub-tasks).
Create `src/hypercore/types.ts` and `src/hypercore/schemas.ts`.
All interfaces from the design doc: HypercoreEntry, HypercoreStore, ReplicationPeer, DiscoveryConfig, HypercoreMetadata.
Zod schemas for all types. Property tests for serialization round trips.

### Task S2-02: Hypercore Append-Only Store
Read `.kiro/specs/p2p-hypercore-protocol/tasks.md` Task 2 (all sub-tasks).
Create `src/hypercore/store.ts` — append-only log with cryptographic hashing.
`append()`, `get()`, `length()`, `createReadStream()`.
Immutability enforcement — no update/delete.
Property tests: append-only invariant, hash chain integrity, sequential indexing.

### Task S2-03: Hypercore Replication Protocol
Read `.kiro/specs/p2p-hypercore-protocol/tasks.md` Task 3 (all sub-tasks).
Create `src/hypercore/replication.ts` — peer-to-peer replication.
`ReplicationManager`: `addPeer()`, `removePeer()`, `sync()`, `getReplicationState()`.
Merkle tree verification for data integrity during sync.
Property tests: replication convergence, data integrity across peers.

### Task S2-04: Hyperswarm Discovery
Read `.kiro/specs/p2p-hypercore-protocol/tasks.md` Task 4 (all sub-tasks).
Create `src/hypercore/discovery.ts` — DHT-based peer discovery.
`DiscoveryManager`: `announce()`, `lookup()`, `leave()`, `getPeers()`.
Topic-based discovery using Hyperswarm DHT.
Unit tests for discovery lifecycle.

### Task S2-05: Hypercore Checkpoint
Run `tsc --noEmit` — must be 0 errors.
Run all hypercore tests — must pass.
Commit: `feat(S2-05): P2P Hypercore foundation — store, replication, discovery`

---

## WAVE 2 (Hours 12–24): P2P Hypercore Protocol — Advanced + Hypervisor Start

> Spec: `.kiro/specs/p2p-hypercore-protocol/tasks.md` Tasks 6–9
> Spec: `.kiro/specs/hypervisor-hypercore/tasks.md` Tasks 1–3

### Task S2-06: Corestore Multi-Log Management
Read `.kiro/specs/p2p-hypercore-protocol/tasks.md` Task 6.
Create `src/hypercore/corestore.ts` — manages multiple Hypercore logs.
`Corestore`: `get(name)`, `list()`, `replicate()`, `close()`.
Namespace isolation between different data types.

### Task S2-07: Hypercore CRDT Integration
Read `.kiro/specs/p2p-hypercore-protocol/tasks.md` Task 7.
Bridge between Hypercore append-only logs and existing CRDT engine (`src/collaboration/crdt-engine.ts`).
Create `src/hypercore/crdt-bridge.ts`.
CRDT operations stored as Hypercore entries, replicated via Hypercore protocol.
Property tests: CRDT convergence over Hypercore replication.

### Task S2-08: Hypercore Agent Memory Integration
Read `.kiro/specs/p2p-hypercore-protocol/tasks.md` Task 8.
Bridge between Hypercore and existing memory system (`src/memory/`).
Create `src/hypercore/memory-bridge.ts`.
Agent memory nodes stored as immutable Hypercore entries.
Cross-device memory sync via replication.

### Task S2-09: Hypercore Observability + Index
Read `.kiro/specs/p2p-hypercore-protocol/tasks.md` Tasks 9–10.
Create `src/hypercore/observability.ts` — metrics for replication, storage, peers.
Create `src/hypercore/index.ts` — public API exports + factory function.

### Task S2-10: Hypervisor Types + Schemas
Read `.kiro/specs/hypervisor-hypercore/tasks.md` Task 1 (all sub-tasks).
Create `src/hypervisor/types.ts` and `src/hypervisor/schemas.ts`.
MicroVM, SandboxConfig, IsolationLevel, ResourceLimits interfaces.
Zod schemas. Property tests for serialization.

### Task S2-11: Hypervisor Sandbox Manager
Read `.kiro/specs/hypervisor-hypercore/tasks.md` Task 2 (all sub-tasks).
Create `src/hypervisor/sandbox-manager.ts`.
`SandboxManager`: `create()`, `destroy()`, `list()`, `getStatus()`.
Resource limits enforcement (CPU, memory, network).
Lifecycle: creating → running → paused → stopped → destroyed.

### Task S2-12: Wave 2 Checkpoint
Run `tsc --noEmit` — 0 errors.
Run all hypercore + hypervisor tests — must pass.
Commit: `feat(S2-12): Hypercore advanced features + Hypervisor foundation`

---

## WAVE 3 (Hours 24–36): Hypervisor Completion + A2A Foundation

> Spec: `.kiro/specs/hypervisor-hypercore/tasks.md` Tasks 3–8
> Spec: `.kiro/specs/a2a-mcp-protocols/tasks.md` Tasks 1–2

### Task S2-13: Hypervisor Process Isolation
Read `.kiro/specs/hypervisor-hypercore/tasks.md` Task 3.
Create `src/hypervisor/process-isolation.ts`.
Process-level isolation for agent execution.
Communication channels between sandbox and host.

### Task S2-14: Hypervisor Network Policies
Read `.kiro/specs/hypervisor-hypercore/tasks.md` Task 4.
Create `src/hypervisor/network-policy.ts`.
Network access control per sandbox.
Allow/deny rules, rate limiting, domain filtering.

### Task S2-15: Hypervisor Resource Monitor
Read `.kiro/specs/hypervisor-hypercore/tasks.md` Task 5.
Create `src/hypervisor/resource-monitor.ts`.
Real-time resource usage tracking per sandbox.
Alerts on threshold breach. Kill runaway processes.

### Task S2-16: Hypervisor Hypercore Storage Bridge
Read `.kiro/specs/hypervisor-hypercore/tasks.md` Task 6.
Create `src/hypervisor/hypercore-bridge.ts`.
Each sandbox gets its own Hypercore store via Corestore.
Isolated append-only logs per sandbox.

### Task S2-17: Hypervisor Observability + Index
Read `.kiro/specs/hypervisor-hypercore/tasks.md` Tasks 7–8.
Create `src/hypervisor/observability.ts` and `src/hypervisor/index.ts`.
Metrics, public API, factory function.

### Task S2-18: A2A Types + Schemas
Read `.kiro/specs/a2a-mcp-protocols/tasks.md` Task 1 (all sub-tasks).
Create `src/a2a/types.ts` — AgentCard, A2AEnvelope, A2AMessageType, AgentTier, CapabilityDescriptor.
Create `src/a2a/schemas.ts` — Zod schemas for all types.
Create `src/a2a/tier-config.ts` — default tier assignments for all 21 agents.
Property tests: schema validation, serialization round trips, message type validation.

### Task S2-19: A2A EnvelopeFactory + AgentRegistry
Read `.kiro/specs/a2a-mcp-protocols/tasks.md` Task 2 (all sub-tasks).
Create `src/a2a/envelope.ts` — EnvelopeFactory with unique IDs, timestamps, convenience methods.
Create `src/a2a/registry.ts` — AgentRegistry with register, lookup, capability search, revision tracking.
Property tests: envelope uniqueness, correlation threading, registration/retrieval, duplicate updates.

### Task S2-20: Wave 3 Checkpoint
Run `tsc --noEmit` — 0 errors.
Run all tests — must pass.
Commit: `feat(S2-20): Hypervisor complete + A2A foundation`

---

## WAVE 4 (Hours 36–48): A2A Router, Channels, MCP Bridge

> Spec: `.kiro/specs/a2a-mcp-protocols/tasks.md` Tasks 4–7

### Task S2-21: A2A Router with Tier + Sandbox Enforcement
Read `.kiro/specs/a2a-mcp-protocols/tasks.md` Task 4 (all sub-tasks).
Create `src/a2a/router.ts` — A2ARouter.
Direct routing, broadcast, capability-based routing.
Tier enforcement (L0-L3 rules), sandbox enforcement.
Routing events emitted to observability.
Property tests: direct routing, broadcast, capability routing, tier enforcement, sandbox enforcement.

### Task S2-22: A2A Channel + ChannelManager
Read `.kiro/specs/a2a-mcp-protocols/tasks.md` Task 5 (all sub-tasks).
Create `src/a2a/channel.ts` — A2AChannel + ChannelManager.
LocalChannel (in-memory), state machine (connecting → open → closed → reconnecting).
Message ordering, retry with exponential backoff.
Property tests: state machine validity, message ordering, retry behavior.

### Task S2-23: MCP Integration Bridge
Read `.kiro/specs/a2a-mcp-protocols/tasks.md` Task 7 (all sub-tasks).
Create `src/a2a/mcp-bridge.ts` — wraps existing `src/mcp/` server.
Tool registration with "agentName.toolName" namespacing.
Tool invocation routing, resource registration/read, prompt template substitution.
Property tests: tool registration, invocation routing, name uniqueness, resource round trip, prompt substitution.

### Task S2-24: A2A Observability + Public API
Read `.kiro/specs/a2a-mcp-protocols/tasks.md` Tasks 12–13.
Create `src/a2a/observability.ts` — structured telemetry, metrics.
Create `src/a2a/index.ts` — public API exports + `createA2ALayer()` factory.
Wire all components together.
Property tests: metrics accuracy.

### Task S2-25: Final Checkpoint
Run `tsc --noEmit` — 0 errors.
Run ALL tests — must pass.
Commit: `feat(S2-25): A2A/MCP protocols complete — router, channels, MCP bridge, observability`

---

## TASK COUNT SUMMARY

| Wave | Hours | Tasks | Focus |
|------|-------|-------|-------|
| Wave 1 | 0–12 | S2-01 → S2-05 | P2P Hypercore foundation |
| Wave 2 | 12–24 | S2-06 → S2-12 | Hypercore advanced + Hypervisor start |
| Wave 3 | 24–36 | S2-13 → S2-20 | Hypervisor complete + A2A foundation |
| Wave 4 | 36–48 | S2-21 → S2-25 | A2A Router, Channels, MCP Bridge |
| **TOTAL** | **48h** | **25 tasks** | **3 Eternal Data Reel features** |

---

*Sprint 2 created by Kiro (Opus 4.6) — February 21, 2026*
