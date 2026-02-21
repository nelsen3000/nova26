# Requirements Document

## Introduction

This document specifies the requirements for implementing A2A (Agent-to-Agent) and MCP (Model Context Protocol) communication standards for decentralized agent coordination in Nova26. A2A enables direct peer-to-peer communication between agents ("WebRTC for AI"), while MCP standardizes how agents access tools, resources, and context. Together, these protocols enable Nova26's 21 Planetary Agents to form decentralized swarms, coordinate CRDT-based collaboration, and operate within the existing Ralph Loop orchestrator and Eternal Engine infrastructure — without requiring a central controller for every interaction.

The integration builds on existing modules: `src/mcp/` (MCP client/server), `src/acp/` (Agent Client Protocol), `src/agents/protocol.ts` (message bus), `src/swarm/` (swarm orchestrator), and the P2P Hypercore layer (`src/hypercore/`). The goal is to unify these into a standards-compliant A2A+MCP layer that supports both local (same-process) and remote (cross-device) agent communication, with peer discovery via Hyperswarm/DHT.

## Glossary

- **A2A_Protocol**: The Agent-to-Agent communication protocol enabling direct, decentralized message exchange between agents without a central controller.
- **MCP_Server**: A Model Context Protocol server that exposes tools, resources, and prompts to agents via a standardized JSON-RPC interface.
- **MCP_Client**: A Model Context Protocol client that connects to MCP servers to discover and invoke tools, read resources, and use prompts.
- **Agent_Card**: A JSON descriptor published by each agent that advertises its identity, capabilities, supported protocols, and endpoint information for discovery.
- **Agent_Registry**: A service that maintains a directory of known Agent_Cards, supporting both local (in-memory) and distributed (Hyperswarm/DHT) discovery.
- **A2A_Envelope**: A standardized message wrapper containing sender, recipient, correlation ID, message type, payload, and routing metadata for A2A communication.
- **A2A_Channel**: A bidirectional communication link between two agents, supporting request-response and streaming message patterns.
- **A2A_Router**: The component responsible for routing A2A_Envelopes to the correct agent based on agent ID, capability matching, or broadcast rules.
- **Capability_Descriptor**: A structured declaration of a specific function an agent can perform, including input/output schemas and invocation metadata.
- **Task_Negotiation**: The A2A process by which agents propose, accept, or reject task assignments through structured message exchange.
- **Swarm_Coordinator**: A decentralized coordination layer that uses A2A messaging to enable groups of agents to self-organize around complex tasks.
- **CRDT_Sync_Channel**: An A2A_Channel specialized for propagating CRDT state updates between agents or agent instances across devices.
- **Ralph_Loop**: The core orchestration engine of Nova26 that picks, dispatches, validates, and completes tasks across agents.
- **Eternal_Engine**: The planned Rust binary core of Nova26 for persistent, fault-tolerant agent state.
- **Hyperswarm_Discovery**: The DHT-based peer discovery mechanism from the P2P Hypercore layer used for finding remote agents.
- **Planetary_Agent**: One of Nova26's 21 specialized AI agents (SUN through ANDROMEDA) that perform specific roles in the system.
- **Agent_Tier**: The hierarchical level (L0-L3) of a Planetary Agent, determining its communication privileges and coordination scope.

## Requirements

### Requirement 1: Agent Card Publication and Discovery

**User Story:** As a Planetary Agent, I want to publish an Agent Card describing my capabilities and discover other agents' cards, so that agents can find and communicate with each other without hardcoded routing.

#### Acceptance Criteria

1. WHEN a Planetary Agent registers with the Agent_Registry, THE Agent_Registry SHALL store the Agent_Card containing the agent's identifier, name, version, tier level, supported protocols, capability list, and endpoint information.
2. WHEN an agent queries the Agent_Registry by capability, THE Agent_Registry SHALL return all Agent_Cards whose Capability_Descriptors match the requested capability.
3. WHEN an agent queries the Agent_Registry by agent identifier, THE Agent_Registry SHALL return the matching Agent_Card or a not-found error.
4. WHEN an Agent_Card is registered, THE Agent_Registry SHALL validate that the card contains all required fields (identifier, name, version, tier, capabilities) before accepting it.
5. IF an Agent_Card with a duplicate identifier is registered, THEN THE Agent_Registry SHALL update the existing card with the new information and increment a revision counter.
6. THE Agent_Registry SHALL serialize Agent_Cards to JSON format and deserialize them back without data loss (round-trip property).
7. WHEN Hyperswarm_Discovery is enabled, THE Agent_Registry SHALL announce registered Agent_Cards to the DHT network and discover remote Agent_Cards from peers.
8. WHEN a remote Agent_Card is discovered via Hyperswarm, THE Agent_Registry SHALL merge it into the local registry and mark it with a "remote" origin flag.

### Requirement 2: A2A Envelope and Message Format

**User Story:** As a developer, I want a standardized message envelope for agent-to-agent communication, so that all inter-agent messages have consistent structure, routing, and traceability.

#### Acceptance Criteria

1. THE A2A_Envelope SHALL contain the following fields: a unique message identifier, sender agent identifier, recipient agent identifier (or broadcast marker), correlation identifier for threading, message type, timestamp, and a payload field.
2. WHEN an A2A_Envelope is created, THE A2A_Protocol SHALL assign a unique message identifier and set the timestamp to the current time.
3. THE A2A_Protocol SHALL serialize A2A_Envelopes to JSON format and deserialize them back to equivalent objects (round-trip property).
4. WHEN an A2A_Envelope references a correlation identifier, THE A2A_Protocol SHALL use it to associate the message with an existing conversation thread.
5. THE A2A_Envelope SHALL support the following message types: "request", "response", "notification", "task-proposal", "task-accept", "task-reject", "stream-start", "stream-data", "stream-end", and "error".

### Requirement 3: A2A Channel Establishment and Lifecycle

**User Story:** As a Planetary Agent, I want to establish direct communication channels with other agents, so that I can exchange messages without routing through a central controller.

#### Acceptance Criteria

1. WHEN an agent requests a channel to another agent, THE A2A_Router SHALL create an A2A_Channel instance with a unique channel identifier and "connecting" status.
2. WHEN both agents acknowledge the channel, THE A2A_Channel SHALL transition to "open" status and allow bidirectional message exchange.
3. WHEN either agent closes the channel, THE A2A_Channel SHALL transition to "closed" status and release associated resources.
4. WHILE an A2A_Channel is in "open" status, THE A2A_Channel SHALL deliver messages from sender to recipient with ordering preserved within the channel.
5. IF a message delivery fails on an open channel, THEN THE A2A_Channel SHALL retry delivery up to 3 times with exponential backoff before emitting a delivery failure event.
6. THE A2A_Channel SHALL support both local (same-process, in-memory) and remote (cross-device, WebSocket or Hyperswarm stream) transport modes.
7. IF the underlying transport for a remote channel disconnects, THEN THE A2A_Channel SHALL transition to "reconnecting" status and attempt to re-establish the connection.

### Requirement 4: A2A Message Routing

**User Story:** As a developer, I want messages to be routed to the correct agent based on identifier or capability, so that agents can communicate without knowing each other's internal implementation.

#### Acceptance Criteria

1. WHEN an A2A_Envelope with a specific recipient identifier is sent, THE A2A_Router SHALL deliver the envelope to the agent matching that identifier.
2. WHEN an A2A_Envelope with a broadcast marker is sent, THE A2A_Router SHALL deliver the envelope to all registered agents.
3. WHEN an A2A_Envelope targets a capability rather than a specific agent, THE A2A_Router SHALL query the Agent_Registry and deliver the envelope to the first agent matching that capability.
4. IF the target agent is not found in the local Agent_Registry, THEN THE A2A_Router SHALL check remote Agent_Cards discovered via Hyperswarm before returning a routing error.
5. THE A2A_Router SHALL enforce tier-based routing rules: L0 agents can communicate with all tiers, L1 agents can communicate with L0 and L1, L2 agents can communicate with L0-L2, and L3 agents can communicate with all tiers.
6. WHEN a message is routed, THE A2A_Router SHALL emit a routing event containing the envelope identifier, source agent, target agent, and routing decision (local, remote, or broadcast).

### Requirement 5: MCP Tool Registry and Exposure

**User Story:** As a Planetary Agent, I want to expose my tools via MCP and discover tools from other agents, so that agents can invoke each other's capabilities through a standardized interface.

#### Acceptance Criteria

1. WHEN a Planetary Agent registers tools with the MCP_Server, THE MCP_Server SHALL add each tool to the tool registry with its name, description, input schema, output schema, and source agent identifier.
2. WHEN an MCP_Client requests the tool list, THE MCP_Server SHALL return all registered tools from all agents.
3. WHEN an MCP_Client invokes a tool, THE MCP_Server SHALL route the invocation to the source agent that registered the tool and return the result.
4. IF a tool invocation fails, THEN THE MCP_Server SHALL return a structured error response containing the error code, message, and the source agent identifier.
5. WHEN a Planetary Agent registers tools, THE MCP_Server SHALL validate that each tool has a unique name within the registry and reject duplicates with a descriptive error.
6. THE MCP_Server SHALL support tool namespacing using the pattern "agentName.toolName" to prevent naming collisions across agents.

### Requirement 6: MCP Resource and Context Sharing

**User Story:** As a Planetary Agent, I want to share resources and context with other agents via MCP, so that agents can access shared data like taste vault entries, studio rules, and memory nodes through a uniform interface.

#### Acceptance Criteria

1. WHEN a Planetary Agent registers a resource with the MCP_Server, THE MCP_Server SHALL store the resource with its URI, name, MIME type, and a content loader function.
2. WHEN an MCP_Client reads a resource by URI, THE MCP_Server SHALL invoke the content loader and return the content with the correct MIME type.
3. IF a requested resource URI does not exist, THEN THE MCP_Server SHALL return a resource-not-found error with the requested URI.
4. WHEN a Planetary Agent registers a prompt template with the MCP_Server, THE MCP_Server SHALL store the template with its name, description, argument definitions, and template body.
5. WHEN an MCP_Client requests a prompt with arguments, THE MCP_Server SHALL substitute the arguments into the template and return the rendered prompt.

### Requirement 7: Task Negotiation via A2A

**User Story:** As a Planetary Agent, I want to propose tasks to other agents and receive acceptance or rejection, so that agents can self-organize work distribution without central assignment.

#### Acceptance Criteria

1. WHEN an agent sends a "task-proposal" A2A_Envelope to another agent, THE A2A_Protocol SHALL include the task description, required capabilities, estimated complexity, and a deadline for response.
2. WHEN a receiving agent accepts a task proposal, THE A2A_Protocol SHALL send a "task-accept" response with the accepting agent's identifier and an estimated completion time.
3. WHEN a receiving agent rejects a task proposal, THE A2A_Protocol SHALL send a "task-reject" response with a reason code and optional alternative agent suggestion.
4. IF no response is received within the proposal deadline, THEN THE A2A_Protocol SHALL mark the proposal as "timed-out" and notify the proposing agent.
5. WHEN a task is accepted, THE A2A_Protocol SHALL create a correlation thread linking the proposal, acceptance, and all subsequent messages related to that task.

### Requirement 8: Decentralized Swarm Coordination

**User Story:** As a developer, I want agents to form decentralized swarms using A2A messaging, so that groups of agents can self-organize around complex tasks without a single orchestrator bottleneck.

#### Acceptance Criteria

1. WHEN the Ralph_Loop identifies a task suitable for swarm execution, THE Swarm_Coordinator SHALL broadcast a "task-proposal" to agents matching the required capabilities.
2. WHEN multiple agents accept a swarm task, THE Swarm_Coordinator SHALL assign sub-tasks based on each agent's declared capabilities and current load.
3. WHILE a swarm is active, THE Swarm_Coordinator SHALL maintain a shared task state accessible to all participating agents via A2A messaging.
4. WHEN a swarm participant completes its sub-task, THE Swarm_Coordinator SHALL collect the result and update the shared task state.
5. IF a swarm participant fails, THEN THE Swarm_Coordinator SHALL reassign the sub-task to another capable agent or escalate to the Ralph_Loop.
6. WHEN all sub-tasks in a swarm are completed, THE Swarm_Coordinator SHALL aggregate results and report the final outcome to the Ralph_Loop.

### Requirement 9: CRDT Collaboration via A2A Channels

**User Story:** As a developer, I want CRDT state changes to propagate between agents via A2A channels, so that multiple agents or agent instances can collaborate on shared state without a central server.

#### Acceptance Criteria

1. WHEN a local CRDT state update occurs, THE CRDT_Sync_Channel SHALL broadcast the update to all connected agents via A2A messaging.
2. WHEN a CRDT update is received from a remote agent, THE CRDT_Sync_Channel SHALL apply the update to the local CRDT state.
3. WHEN multiple CRDT updates arrive concurrently from different agents, THE CRDT_Sync_Channel SHALL apply all updates without data loss, relying on CRDT merge semantics for conflict resolution.
4. THE CRDT_Sync_Channel SHALL include a vector clock in each update message to maintain causal ordering.
5. IF a CRDT update fails deserialization, THEN THE CRDT_Sync_Channel SHALL log the error with the source agent identifier and skip the update without halting synchronization.

### Requirement 10: Sandbox-Aware Communication

**User Story:** As a developer, I want A2A communication to respect sandbox boundaries, so that agents running in the Ultra-Sandbox can communicate securely without bypassing isolation.

#### Acceptance Criteria

1. WHEN an agent inside a sandbox sends an A2A message, THE A2A_Router SHALL verify that the target agent is within the same sandbox or on the sandbox's allowed communication list.
2. IF an agent attempts to send a message outside its sandbox boundary without authorization, THEN THE A2A_Router SHALL reject the message and emit a security event.
3. WHEN a sandboxed agent registers with the Agent_Registry, THE Agent_Registry SHALL tag the Agent_Card with the sandbox identifier.
4. THE A2A_Router SHALL enforce that sandbox-tagged agents can only discover other agents within the same sandbox unless explicitly granted cross-sandbox access.

### Requirement 11: Planetary Agent Tier Communication Rules

**User Story:** As a developer, I want communication between agents to respect the planetary tier hierarchy (L0-L3), so that coordination follows the established authority structure.

#### Acceptance Criteria

1. THE A2A_Router SHALL assign each Planetary Agent a tier level: L0 (SUN — orchestrator), L1 (MERCURY, EARTH, JUPITER — strategic), L2 (VENUS, MARS, PLUTO, SATURN, TITAN — operational), L3 (remaining agents — specialist).
2. WHEN an L2 or L3 agent sends a "task-proposal" to an L0 or L1 agent, THE A2A_Router SHALL require the proposal to include an escalation justification field.
3. WHEN an L0 agent broadcasts a directive, THE A2A_Router SHALL deliver it to all agents regardless of tier.
4. THE A2A_Router SHALL log all cross-tier communications with the source tier, target tier, and message type for audit purposes.

### Requirement 12: Observability and Audit

**User Story:** As a developer, I want structured telemetry from all A2A and MCP operations, so that I can monitor agent communication, debug routing issues, and audit message flows.

#### Acceptance Criteria

1. WHEN an A2A_Envelope is sent or received, THE A2A_Protocol SHALL emit a structured log event containing the envelope identifier, sender, recipient, message type, and timestamp.
2. WHEN an MCP tool is invoked, THE MCP_Server SHALL emit a structured log event containing the tool name, source agent, duration, and success status.
3. WHEN a routing decision is made, THE A2A_Router SHALL emit an event containing the routing path (local, remote, broadcast), latency, and outcome.
4. THE A2A_Protocol SHALL expose aggregate metrics: total messages sent, total messages received, messages by type, average routing latency, and error count.
5. THE MCP_Server SHALL expose aggregate metrics: total tool invocations, invocations by tool, average invocation duration, and error count.

### Requirement 13: A2A/MCP Message Serialization

**User Story:** As a developer, I want all A2A and MCP messages to be reliably serializable, so that they can be persisted, transferred across processes, and replayed for debugging.

#### Acceptance Criteria

1. THE A2A_Protocol SHALL serialize A2A_Envelopes to JSON format for storage and transfer.
2. THE A2A_Protocol SHALL deserialize JSON-formatted A2A_Envelopes back into valid envelope objects.
3. FOR ALL valid A2A_Envelope objects, serializing then deserializing SHALL produce an equivalent A2A_Envelope object (round-trip property).
4. THE MCP_Server SHALL serialize MCP tool invocation records (tool name, arguments, result, duration) to JSON format.
5. FOR ALL valid MCP tool invocation records, serializing then deserializing SHALL produce an equivalent record (round-trip property).
6. WHEN serializing messages, THE A2A_Protocol SHALL include a schema version field to support future format migrations.
7. IF a message with an unknown schema version is encountered during deserialization, THEN THE A2A_Protocol SHALL return a descriptive error indicating the version mismatch.
