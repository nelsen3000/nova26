# Implementation Plan: A2A/MCP Protocols for Decentralized Agent Coordination

## Overview

Incremental implementation of the `src/a2a/` module, building from core types and schemas outward to routing, channels, swarm coordination, and observability. Each task builds on previous ones. The existing `src/mcp/` and `src/acp/` modules are wrapped, not replaced.

## Tasks

- [x] 1. Set up module structure, types, and schemas
  - [x] 1.1 Create `src/a2a/types.ts` with AgentCard, A2AEnvelope, A2AMessageType, AgentTier, CapabilityDescriptor, AgentEndpoint, ChannelStatus, RoutingResult, TaskProposal, CRDTSyncMessage, and A2ALogEvent interfaces
    - Define all TypeScript types matching the design document interfaces
    - _Requirements: 2.1, 2.5_
  - [x] 1.2 Create `src/a2a/schemas.ts` with Zod validation schemas for all types
    - AgentCardSchema, A2AEnvelopeSchema, A2AMessageTypeSchema, TaskProposalPayloadSchema, CRDTSyncMessageSchema, A2ALogEventSchema, RoutingResultSchema
    - Export inferred types from schemas
    - _Requirements: 1.4, 2.5, 13.6_
  - [x] 1.3 Create `src/a2a/tier-config.ts` with default tier assignments and tier routing rules
    - DEFAULT_TIER_ASSIGNMENTS mapping all 21 agents to L0-L3
    - DEFAULT_TIER_RULES with allowed target tiers and escalation requirements
    - _Requirements: 11.1, 4.5_
  - [x]* 1.4 Write property tests for schema validation and serialization round trips
    - **Property 4: Agent Card serialization round trip**
    - **Property 7: A2A Envelope serialization round trip**
    - **Property 9: Message type validation**
    - **Validates: Requirements 1.6, 2.3, 2.5, 13.3**
    - **Implemented in `src/a2a/__tests__/a2a-pbt.test.ts` (12 tests).**

- [x] 2. Implement EnvelopeFactory and AgentRegistry
  - [x] 2.1 Create `src/a2a/envelope.ts` with EnvelopeFactory
    - createEnvelope() assigns unique ID (uuid or nanoid), sets timestamp, validates via Zod schema
    - createRequest(), createResponse(), createNotification(), createTaskProposal() convenience methods
    - _Requirements: 2.1, 2.2, 2.4_
  - [x]* 2.2 Write property tests for envelope creation
    - **Property 6: A2A Envelope structure and uniqueness**
    - **Property 8: Correlation threading**
    - **Validates: Requirements 2.1, 2.2, 2.4, 13.6**
    - **Covered in a2a-pbt.test.ts.**
  - [x] 2.3 Create `src/a2a/registry.ts` with AgentRegistry implementation
    - In-memory Map<string, AgentCard> storage
    - register() validates card via Zod, handles duplicate ID updates with revision increment
    - getById(), findByCapability(), findByTier(), listAll(), getLocalCards(), getRemoteCards()
    - mergeRemoteCard() sets origin to "remote"
    - serialize()/deserialize() for JSON persistence
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.8_
  - [x]* 2.4 Write property tests for AgentRegistry
    - **Property 1: Agent Card registration and retrieval**
    - **Property 2: Agent Card validation rejects incomplete cards**
    - **Property 3: Duplicate Agent Card updates revision**
    - **Property 5: Remote Agent Card merge preserves origin**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.8**
    - **Covered in a2a-pbt.test.ts.**

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement A2ARouter with tier and sandbox enforcement
  - [x] 4.1 Create `src/a2a/router.ts` with A2ARouter implementation
    - send() resolves target via AgentRegistry, checks tier rules, checks sandbox rules, delivers via handler map
    - Direct routing (by agent ID), broadcast routing (to all), capability routing (via registry lookup)
    - Tier enforcement using DEFAULT_TIER_RULES — reject violations, require escalation justification for L2/L3 → L0/L1
    - Sandbox enforcement — check sandboxId match or cross-sandbox allow list
    - onReceive() registers per-agent message handlers
    - Emits routing events via A2AObservability
    - _Requirements: 4.1, 4.2, 4.3, 4.5, 10.1, 10.2, 11.2, 11.3_
  - [ ]* 4.2 Write property tests for A2ARouter
    - **Property 13: Direct message routing**
    - **Property 14: Broadcast delivery**
    - **Property 15: Capability-based routing**
    - **Property 16: Tier-based routing enforcement**
    - **Property 17: Routing event emission**
    - **Property 29: Sandbox routing enforcement**
    - **Property 30: Sandbox discovery filtering**
    - **Property 31: Cross-tier audit logging**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.5, 4.6, 10.1, 10.2, 10.3, 10.4, 11.2, 11.3, 11.4, 12.3**

- [x] 5. Implement A2AChannel and ChannelManager
  - [x] 5.1 Create `src/a2a/channel.ts` with A2AChannel and ChannelManager
    - LocalChannel — in-memory, zero-copy message passing between agents in the same process
    - Channel state machine: connecting → open → closed, with reconnecting state for remote channels
    - Message ordering guarantee within a channel
    - Retry logic: up to 3 retries with exponential backoff on delivery failure
    - ChannelManager: openChannel(), getChannel(), listChannels(), closeAll()
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_
  - [ ]* 5.2 Write property tests for A2AChannel
    - **Property 10: Channel state machine validity**
    - **Property 11: Channel message ordering**
    - **Property 12: Channel retry on failure**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

- [x] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement MCP integration layer
  - [x] 7.1 Create MCP tool registration and invocation bridge in `src/a2a/mcp-bridge.ts`
    - Wraps existing `src/mcp/server.ts` MCPServer and `src/mcp/registry.ts` MCPRegistry
    - registerAgentTools() — registers tools with "agentName.toolName" namespacing, validates uniqueness
    - invokeTool() — routes to source agent's handler, returns result or structured error
    - listAllTools() — returns tools from all agents
    - registerResource(), readResource() — wraps MCP resource operations
    - registerPrompt(), getPrompt() — wraps MCP prompt operations with argument substitution
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 6.1, 6.2, 6.4, 6.5_
  - [ ]* 7.2 Write property tests for MCP integration
    - **Property 18: MCP tool registration and listing**
    - **Property 19: MCP tool invocation routing**
    - **Property 20: MCP tool name uniqueness**
    - **Property 21: MCP resource registration and read round trip**
    - **Property 22: MCP prompt template substitution**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.5, 5.6, 6.1, 6.2, 6.4, 6.5**
  - [ ]* 7.3 Write unit tests for MCP error cases
    - Resource-not-found error (6.3)
    - Tool invocation error response structure (5.4)
    - _Requirements: 5.4, 6.3_

- [x] 8. Implement TaskNegotiator
  - [x] 8.1 Create `src/a2a/task-negotiator.ts` with TaskNegotiator implementation
    - propose() — creates task-proposal envelope with description, capabilities, complexity, deadline; sends via A2ARouter
    - accept() — sends task-accept response with agent ID and estimated completion time
    - reject() — sends task-reject response with reason and optional alternative
    - Timeout handling — marks proposals as timed-out after deadline
    - Correlation thread — all messages for a negotiation share a correlationId
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_
  - [ ]* 8.2 Write property tests for TaskNegotiator
    - **Property 23: Task negotiation message structure**
    - **Property 24: Task acceptance creates correlation thread**
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.5**
  - [ ]* 8.3 Write unit test for proposal timeout
    - Test that proposals are marked timed-out after deadline
    - _Requirements: 7.4_

- [x] 9. Implement SwarmCoordinator
  - [x] 9.1 Create `src/a2a/swarm-coordinator.ts` with SwarmCoordinator implementation
    - createSwarm() — broadcasts task-proposal to capable agents via A2ARouter, collects acceptances
    - Sub-task assignment based on agent capabilities
    - Shared state maintained via SwarmSession object, accessible to all participants
    - completeSubTask() — updates shared state, checks if all sub-tasks done
    - failSubTask() — reassigns to another capable agent or escalates to Ralph Loop
    - Swarm lifecycle: recruiting → active → completing → completed/failed
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_
  - [x]* 9.2 Write property tests for SwarmCoordinator
    - **Property 25: Swarm broadcast to capable agents**
    - **Property 26: Swarm sub-task assignment and state consistency**
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.6**
    - **Property 25 covered in a2a-pbt.test.ts.**
  - [ ]* 9.3 Write unit test for swarm participant failure
    - Test reassignment on failure and escalation when no capable agent available
    - _Requirements: 8.5_

- [x] 10. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Implement CRDTSyncChannel
  - [x] 11.1 Create `src/a2a/crdt-sync.ts` with CRDTSyncChannel implementation
    - broadcast() — wraps CRDT update in A2A envelope with "stream-data" type, includes vector clock, sends to all connected agents
    - onUpdate() — handler for incoming CRDT updates, applies to local state
    - Vector clock management — increment on send, merge on receive
    - Deserialization error handling — log and skip malformed updates
    - Integrates with existing `src/collaboration/crdt-engine.ts`
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_
  - [ ]* 11.2 Write property tests for CRDTSyncChannel
    - **Property 27: CRDT update broadcast and apply round trip**
    - **Property 28: CRDT concurrent update confluence**
    - **Validates: Requirements 9.1, 9.2, 9.3, 9.4**
  - [ ]* 11.3 Write unit test for CRDT deserialization failure
    - Test that malformed updates are logged and skipped
    - _Requirements: 9.5_

- [x] 12. Implement A2AObservability
  - [x] 12.1 Create `src/a2a/observability.ts` with A2AObservability implementation
    - emit() — stores structured log events (A2ALogEvent)
    - getMetrics() — returns A2AMetrics with message counts, routing latency, tool invocation stats
    - getRecentEvents() — returns last N events
    - resetMetrics() — clears counters
    - Integrates with existing Nova26 tracer interface from `src/observability/tracer.ts`
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_
  - [ ]* 12.2 Write property tests for observability
    - **Property 32: A2A message metrics accuracy**
    - **Property 33: MCP tool invocation metrics accuracy**
    - **Property 34: MCP invocation record serialization round trip**
    - **Validates: Requirements 12.1, 12.2, 12.4, 12.5, 13.4, 13.5**

- [x] 13. Wire everything together and create public API
  - [x] 13.1 Create `src/a2a/index.ts` with public API exports
    - Export all types, schemas, and component classes
    - Create `createA2ALayer()` factory function that initializes AgentRegistry, A2ARouter, ChannelManager, TaskNegotiator, SwarmCoordinator, CRDTSyncChannel, A2AObservability, and MCPBridge
    - Wire A2ARouter to use AgentRegistry for lookups and A2AObservability for events
    - Wire SwarmCoordinator to use A2ARouter for messaging
    - Wire CRDTSyncChannel to use A2ARouter for broadcasting
    - _Requirements: all_
  - [x] 13.2 Add Hyperswarm discovery integration to AgentRegistry
    - enableHyperswarmDiscovery() — uses HypercoreManager from `src/hypercore/` to announce/discover Agent_Cards via DHT
    - disableHyperswarmDiscovery() — leaves Hyperswarm network
    - Remote card merge on discovery
    - _Requirements: 1.7, 1.8, 4.4_
  - [ ]* 13.3 Write unit tests for Hyperswarm discovery integration
    - Test remote card discovery and merge
    - Test fallback to remote registry on routing failure
    - _Requirements: 1.7, 1.8, 4.4_

- [x] 14. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The existing `src/mcp/` and `src/acp/` modules are wrapped, not modified
- fast-check is used for all property-based tests (already in project dependencies)
