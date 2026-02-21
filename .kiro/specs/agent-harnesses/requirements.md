# Requirements Document

## Introduction

The Agent Harness layer provides durable infrastructure that wraps Nova26's 21 Planetary Agents for long-running tasks. It is not the agent brain — it is the "rig" that keeps agents running across sessions by handling persistence of agent state, tool call management, human-in-loop checkpoints, planning/decomposition, and sub-agent spawning. The harness integrates with the Ralph Loop orchestrator, the Eternal Engine (Rust core), the Observability system, and the Autonomy Slider to make agents production-ready for eternal workflows, Dream Mode, and overnight evolution without crashes or data loss.

## Glossary

- **Agent_Harness**: A durable wrapper around a Planetary Agent that manages its lifecycle, state persistence, tool calls, human-in-loop checkpoints, and sub-agent spawning across sessions.
- **Harness_Manager**: The central registry and lifecycle coordinator for all active Agent Harness instances.
- **Harness_State**: A serializable snapshot of an Agent Harness including task progress, scratchpad contents, tool execution history, and checkpoint data.
- **Checkpoint**: A named, restorable point in a harness execution that captures the full Harness_State for fault recovery or human review.
- **Human_In_Loop_Gate**: A configurable pause point where the harness suspends execution and waits for human approval before continuing.
- **Sub_Agent**: A child Agent Harness spawned by a parent harness to handle a decomposed sub-task, with results flowing back to the parent.
- **Eternal_Engine_Bridge**: The TypeScript-to-Rust FFI interface that persists Harness_State to the Eternal Engine's fault-tolerant storage.
- **Ralph_Loop**: The core orchestration engine that picks, dispatches, validates, and completes tasks across agents.
- **Autonomy_Slider**: The configurable autonomy level (1-5) that controls how much independence an agent has during execution.
- **Observability_Emitter**: The component that emits structured telemetry events from harness operations for monitoring and debugging.
- **Tool_Call_Manager**: The sub-component of Agent_Harness responsible for executing, retrying, and recording tool invocations.
- **Execution_Plan**: A structured decomposition of a long-running task into ordered steps with dependencies, produced by the harness planning phase.

## Requirements

### Requirement 1: Harness Lifecycle Management

**User Story:** As a developer, I want to create, start, pause, resume, and stop agent harnesses, so that I can manage long-running agent tasks across sessions.

#### Acceptance Criteria

1. WHEN a new harness is requested for a Planetary Agent, THE Harness_Manager SHALL create an Agent_Harness instance with a unique identifier, the agent name, and an initial "created" status.
2. WHEN an Agent_Harness is started, THE Agent_Harness SHALL transition from "created" or "paused" status to "running" and begin executing the assigned task.
3. WHEN an Agent_Harness is paused, THE Agent_Harness SHALL persist the current Harness_State and transition to "paused" status.
4. WHEN a paused Agent_Harness is resumed, THE Agent_Harness SHALL restore the persisted Harness_State and transition to "running" status.
5. WHEN an Agent_Harness is stopped, THE Agent_Harness SHALL persist final state, release resources, and transition to "completed" or "failed" status.
6. THE Harness_Manager SHALL track all active Agent_Harness instances and provide a listing of harnesses with their current status.
7. IF an Agent_Harness receives an invalid state transition request, THEN THE Harness_Manager SHALL reject the request and return a descriptive error.

### Requirement 2: State Persistence via Eternal Engine

**User Story:** As a developer, I want agent harness state to be durably persisted through the Eternal Engine, so that agents survive crashes and can resume across sessions.

#### Acceptance Criteria

1. WHEN an Agent_Harness reaches a checkpoint, THE Eternal_Engine_Bridge SHALL serialize the Harness_State and persist it to the Eternal Engine storage.
2. WHEN a previously persisted Agent_Harness is resumed, THE Eternal_Engine_Bridge SHALL deserialize the Harness_State from Eternal Engine storage and restore the Agent_Harness to its saved state.
3. THE Eternal_Engine_Bridge SHALL serialize Harness_State to a binary format and deserialize it back without data loss (round-trip property).
4. IF the Eternal Engine is unavailable, THEN THE Eternal_Engine_Bridge SHALL fall back to the local SQLite checkpoint system and log a warning via the Observability_Emitter.
5. WHEN Harness_State is persisted, THE Eternal_Engine_Bridge SHALL include a version identifier so that future schema migrations can detect and upgrade older state formats.

### Requirement 3: Tool Call Management

**User Story:** As a developer, I want the harness to manage tool calls with retries, timeouts, and recording, so that tool execution is reliable and auditable during long-running tasks.

#### Acceptance Criteria

1. WHEN an agent requests a tool call, THE Tool_Call_Manager SHALL validate the call against the agent's permitted tool set before execution.
2. WHEN a tool call succeeds, THE Tool_Call_Manager SHALL record the call name, arguments, result, and duration in the Harness_State.
3. IF a tool call fails with a transient error, THEN THE Tool_Call_Manager SHALL retry the call with exponential backoff up to a configurable maximum of 3 retries.
4. IF a tool call exceeds its configured timeout, THEN THE Tool_Call_Manager SHALL cancel the call and record a timeout error in the Harness_State.
5. IF a tool call fails after all retries are exhausted, THEN THE Tool_Call_Manager SHALL record the failure and emit an error event via the Observability_Emitter.
6. THE Tool_Call_Manager SHALL enforce a configurable per-harness budget limit on total tool calls to prevent runaway execution.

### Requirement 4: Human-in-Loop Checkpoints

**User Story:** As a developer, I want to configure checkpoints where the harness pauses for human approval, so that I can maintain oversight of agent decisions during critical operations.

#### Acceptance Criteria

1. WHEN the Autonomy_Slider is set to level 1 or 2, THE Agent_Harness SHALL insert a Human_In_Loop_Gate before each task execution step.
2. WHEN the Autonomy_Slider is set to level 3, THE Agent_Harness SHALL insert a Human_In_Loop_Gate only before steps marked as "critical" in the Execution_Plan.
3. WHEN the Autonomy_Slider is set to level 4 or 5, THE Agent_Harness SHALL skip Human_In_Loop_Gates and execute autonomously.
4. WHEN a Human_In_Loop_Gate is reached, THE Agent_Harness SHALL persist the current Harness_State, emit a "waiting_for_human" event via the Observability_Emitter, and suspend execution.
5. WHEN a human approves a pending Human_In_Loop_Gate, THE Agent_Harness SHALL resume execution from the persisted state.
6. WHEN a human rejects a pending Human_In_Loop_Gate, THE Agent_Harness SHALL record the rejection reason and transition to "paused" status for replanning.

### Requirement 5: Planning and Task Decomposition

**User Story:** As a developer, I want the harness to decompose long-running tasks into an execution plan with ordered steps, so that complex work is tractable and progress is trackable.

#### Acceptance Criteria

1. WHEN a long-running task is assigned to an Agent_Harness, THE Agent_Harness SHALL produce an Execution_Plan containing ordered steps with dependencies.
2. THE Execution_Plan SHALL include for each step: a unique step identifier, a description, the assigned agent, dependency step identifiers, and a criticality flag.
3. WHEN a step in the Execution_Plan completes, THE Agent_Harness SHALL update the step status and evaluate which dependent steps become ready.
4. IF a step in the Execution_Plan fails, THEN THE Agent_Harness SHALL mark dependent steps as blocked and emit a "step_failed" event via the Observability_Emitter.
5. WHEN all steps in the Execution_Plan are completed, THE Agent_Harness SHALL transition to "completed" status and emit a "plan_completed" event.

### Requirement 6: Sub-Agent Spawning

**User Story:** As a developer, I want a harness to spawn child harnesses for sub-tasks, so that complex work can be delegated to specialized agents while the parent tracks overall progress.

#### Acceptance Criteria

1. WHEN a step in the Execution_Plan requires a different Planetary Agent, THE Agent_Harness SHALL spawn a Sub_Agent harness for that step.
2. THE parent Agent_Harness SHALL track all spawned Sub_Agent harnesses and their statuses.
3. WHEN a Sub_Agent completes, THE parent Agent_Harness SHALL receive the Sub_Agent output and incorporate it into the parent Execution_Plan.
4. IF a Sub_Agent fails, THEN THE parent Agent_Harness SHALL apply the Ralph Loop retry protocol (1 retry with error context) before marking the step as failed.
5. THE Harness_Manager SHALL enforce a configurable maximum depth of 3 levels for nested Sub_Agent spawning to prevent unbounded recursion.

### Requirement 7: Ralph Loop Integration

**User Story:** As a developer, I want the harness layer to integrate with the Ralph Loop orchestrator, so that eternal workflows, Dream Mode, and overnight evolution run durably.

#### Acceptance Criteria

1. WHEN the Ralph Loop dispatches a task to an agent, THE Harness_Manager SHALL wrap the agent execution in an Agent_Harness if the task is marked as long-running.
2. WHEN an Agent_Harness completes a task, THE Harness_Manager SHALL report the result back to the Ralph Loop in the standard task output format.
3. WHILE Dream Mode is active, THE Agent_Harness SHALL auto-checkpoint at configurable intervals (default 5 minutes) to protect against session loss.
4. WHILE overnight evolution is active, THE Agent_Harness SHALL persist state to the Eternal Engine at each phase boundary and resume from the last checkpoint on process restart.
5. THE Agent_Harness SHALL respect the current Autonomy_Slider level when determining checkpoint frequency and human-in-loop gate placement.

### Requirement 8: Observability Integration

**User Story:** As a developer, I want structured telemetry from harness operations, so that I can monitor, debug, and analyze long-running agent tasks.

#### Acceptance Criteria

1. WHEN an Agent_Harness transitions state, THE Observability_Emitter SHALL emit a structured event containing the harness identifier, previous status, new status, and timestamp.
2. WHEN a tool call is executed, THE Observability_Emitter SHALL emit an event containing the tool name, duration, success status, and harness identifier.
3. WHEN a Human_In_Loop_Gate is reached or resolved, THE Observability_Emitter SHALL emit an event containing the gate identifier, action taken, and wait duration.
4. WHEN a Sub_Agent is spawned or completes, THE Observability_Emitter SHALL emit an event containing the parent harness identifier, sub-agent identifier, and outcome.
5. THE Observability_Emitter SHALL format all events using the existing Nova26 tracer interface from the observability module.

### Requirement 9: Harness State Serialization

**User Story:** As a developer, I want harness state to be serializable and deserializable, so that it can be persisted, transferred, and restored reliably.

#### Acceptance Criteria

1. THE Agent_Harness SHALL serialize Harness_State to JSON format for storage and transfer.
2. THE Agent_Harness SHALL deserialize JSON-formatted Harness_State back into a valid Harness_State object.
3. FOR ALL valid Harness_State objects, serializing then deserializing SHALL produce an equivalent Harness_State object (round-trip property).
4. WHEN serializing Harness_State, THE Agent_Harness SHALL include a schema version field to support future migrations.
5. IF a Harness_State with an unknown schema version is encountered during deserialization, THEN THE Agent_Harness SHALL return a descriptive error indicating the version mismatch.

### Requirement 10: Performance and Overhead

**User Story:** As a developer, I want the harness layer to add minimal overhead, so that agent execution performance is not significantly degraded.

#### Acceptance Criteria

1. THE Agent_Harness SHALL add less than 50 milliseconds of overhead per task step for state management operations (excluding persistence I/O).
2. THE Agent_Harness SHALL use incremental state updates rather than full state snapshots when persisting to reduce I/O overhead.
3. WHEN the harness layer is disabled, THE Ralph_Loop SHALL execute tasks using the existing direct agent execution path with zero additional overhead.
