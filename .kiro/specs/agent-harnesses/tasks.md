# Implementation Plan: Agent Harnesses

## Overview

Implement the Agent Harness layer as a new `src/harness/` module that wraps existing AgentLoop execution for long-running tasks. The implementation builds incrementally: core types and state machine first, then persistence, tool management, planning, sub-agents, and finally Ralph Loop integration.

## Tasks

- [ ] 1. Set up harness module structure and core types
  - Create `src/harness/` directory
  - Create `src/harness/types.ts` with all interfaces: `HarnessState`, `HarnessStatus`, `HarnessResult`, `HarnessOptions`, `HarnessInfo`, `ExecutionPlan`, `ExecutionStep`, `ToolCallRecord`, `SubAgentResult`, `AgentLoopSnapshot`
  - Create `src/harness/index.ts` barrel export
  - Include `schemaVersion: number` in `HarnessState` for migration support
  - _Requirements: 1.1, 9.4_

- [ ] 2. Implement AgentHarness state machine and lifecycle
  - [ ] 2.1 Implement `src/harness/agent-harness.ts` with the `AgentHarness` class
    - Implement state machine: `created → running → paused → running → completed/failed`
    - Implement `start()`, `pause()`, `resume()`, `stop()` methods with state transition validation
    - Reject invalid transitions with descriptive errors (e.g., starting a completed harness)
    - Implement `getState()` returning a serializable `HarnessState` snapshot
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.7_

  - [ ]* 2.2 Write property test for state machine validity
    - **Property 1: Harness state machine validity**
    - **Validates: Requirements 1.2, 1.5, 1.7**

  - [ ]* 2.3 Write property test for pause/resume round-trip
    - **Property 2: Pause/resume round-trip preserves state**
    - **Validates: Requirements 1.3, 1.4**

- [ ] 3. Implement HarnessManager registry
  - [ ] 3.1 Implement `src/harness/harness-manager.ts` with the `HarnessManager` class
    - Implement `create()` generating unique harness IDs
    - Implement `get()`, `list()`, `stop()`, `resumeFromCheckpoint()`
    - Track all active harness instances in an in-memory map
    - Export singleton via `getHarnessManager()`
    - _Requirements: 1.1, 1.6_

  - [ ]* 3.2 Write property test for harness creation invariants
    - **Property 3: Harness creation invariants**
    - **Validates: Requirements 1.1, 1.6**

- [ ] 4. Implement HarnessState serialization
  - [ ] 4.1 Implement `src/harness/harness-serializer.ts`
    - Implement `serialize(state: HarnessState): string` producing JSON with schemaVersion
    - Implement `deserialize(json: string): HarnessState` with version validation
    - Return descriptive error for unknown schema versions
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [ ]* 4.2 Write property test for JSON serialization round-trip
    - **Property 4: JSON serialization round-trip**
    - **Validates: Requirements 9.3, 9.4**

- [ ] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Implement EternalEngineBridge persistence
  - [ ] 6.1 Implement `src/harness/eternal-engine-bridge.ts`
    - Implement `EternalEngineBridge` with `persist()`, `restore()`, `delete()`, `isAvailable()`
    - Primary path: Rust FFI via `src-tauri/` (stub for now, returns unavailable)
    - Fallback path: use existing `src/persistence/checkpoint-system.ts` SQLite storage
    - Log warning via ObservabilityEmitter when falling back
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ]* 6.2 Write property test for Eternal Engine persistence round-trip
    - **Property 5: Eternal Engine persistence round-trip**
    - **Validates: Requirements 2.3**

  - [ ]* 6.3 Write unit test for SQLite fallback when Eternal Engine unavailable
    - Test that when `isAvailable()` returns false, persist/restore uses SQLite
    - Test that a warning event is emitted
    - _Requirements: 2.4_

- [ ] 7. Implement ToolCallManager
  - [ ] 7.1 Implement `src/harness/tool-call-manager.ts`
    - Implement `execute()` with permission checking against agent's tool set
    - Implement exponential backoff retry (configurable max retries, default 3)
    - Implement timeout handling (cancel and record timeout error)
    - Implement per-harness budget limit enforcement
    - Record all calls (name, arguments, result, duration, retryCount) in history
    - Emit error events via ObservabilityEmitter on final failure
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [ ]* 7.2 Write property test for tool call permission enforcement
    - **Property 6: Tool call permission enforcement**
    - **Validates: Requirements 3.1**

  - [ ]* 7.3 Write property test for tool call retry with exponential backoff
    - **Property 8: Tool call retry with exponential backoff**
    - **Validates: Requirements 3.3**

  - [ ]* 7.4 Write property test for tool call budget enforcement
    - **Property 9: Tool call budget enforcement**
    - **Validates: Requirements 3.6**

- [ ] 8. Implement HumanInLoopGate
  - [ ] 8.1 Implement `src/harness/human-in-loop-gate.ts`
    - Implement `HumanInLoopGate` class with `approve()`, `reject(reason)`, `isPending()`
    - Implement gate placement logic based on autonomy level (1-2: all steps, 3: critical only, 4-5: none)
    - On gate reached: persist state, emit "waiting_for_human" event, suspend
    - On approve: resume from persisted state
    - On reject: record reason, transition harness to "paused"
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [ ]* 8.2 Write property test for autonomy-level gate placement
    - **Property 10: Autonomy-level gate placement**
    - **Validates: Requirements 4.1, 4.2, 4.3**

  - [ ]* 8.3 Write property test for gate suspend behavior
    - **Property 11: Human-in-loop gate suspend behavior**
    - **Validates: Requirements 4.4, 4.5, 4.6**

- [ ] 9. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Implement ExecutionPlan and dependency resolution
  - [ ] 10.1 Implement `src/harness/execution-plan.ts`
    - Implement `createPlan(task: Task): ExecutionPlan` producing ordered steps with dependencies
    - Each step includes: unique ID, description, assigned agent, dependency IDs, criticality flag
    - Implement `completeStep(stepId)` updating status and evaluating dependent step readiness
    - Implement `failStep(stepId)` marking transitive dependents as blocked
    - Implement `isComplete()` checking if all steps are completed
    - Emit "step_failed" and "plan_completed" events via ObservabilityEmitter
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ]* 10.2 Write property test for execution plan step structure
    - **Property 12: Execution plan step structure**
    - **Validates: Requirements 5.1, 5.2**

  - [ ]* 10.3 Write property test for dependency resolution correctness
    - **Property 13: Dependency resolution correctness**
    - **Validates: Requirements 5.3, 5.4**

  - [ ]* 10.4 Write property test for plan completion triggers harness completion
    - **Property 14: Plan completion triggers harness completion**
    - **Validates: Requirements 5.5**

- [ ] 11. Implement Sub-Agent spawning
  - [ ] 11.1 Implement sub-agent logic in `src/harness/agent-harness.ts`
    - When a step requires a different agent, spawn a Sub_Agent harness via HarnessManager
    - Track spawned sub-agents and their statuses in parent state
    - On sub-agent completion: incorporate output into parent plan step
    - On sub-agent failure: retry once with error context, then mark step failed
    - Enforce max depth (default 3) via HarnessManager
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]* 11.2 Write property test for sub-agent spawning and tracking
    - **Property 15: Sub-agent spawning and tracking**
    - **Validates: Requirements 6.1, 6.2**

  - [ ]* 11.3 Write property test for sub-agent depth enforcement
    - **Property 18: Sub-agent depth enforcement**
    - **Validates: Requirements 6.5**

- [ ] 12. Implement ObservabilityEmitter
  - [ ] 12.1 Implement `src/harness/observability-emitter.ts`
    - Implement `emitStateTransition()`, `emitToolCall()`, `emitHumanGate()`, `emitSubAgent()`, `emitCheckpoint()`
    - Use existing `NovaTracer` from `src/observability/tracer.ts` for Langfuse integration
    - Use existing `EventStore` from `src/orchestrator/event-store.ts` for JSONL logging
    - All events include harness ID, timestamp, and type-specific required fields
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [ ]* 12.2 Write property test for observability event completeness
    - **Property 19: Observability event completeness**
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.4**

- [ ] 13. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 14. Integrate with Ralph Loop
  - [ ] 14.1 Wire harness into `src/orchestrator/ralph-loop.ts`
    - Add `harnessEnabled?: boolean` option to `RalphLoopOptions`
    - In `processTask()`, check if task is long-running; if so, delegate to HarnessManager
    - On harness completion, convert `HarnessResult` to standard task output format
    - Add Dream Mode auto-checkpoint interval (default 5 min) when `dreamModeEnabled` is true
    - Add overnight evolution persistence at phase boundaries when `overnightEvolutionEnabled` is true
    - Respect current autonomy level for checkpoint frequency and gate placement
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [ ]* 14.2 Write property test for Ralph Loop long-running task wrapping
    - **Property 20: Ralph Loop integration — long-running task wrapping**
    - **Validates: Requirements 7.1, 7.2**

- [ ] 15. Add Convex schema and dashboard mutations
  - [ ] 15.1 Add `agentHarnesses` table to `convex/schema.ts`
    - Add table definition with indexes: `by_harness_id`, `by_status`, `by_agent`, `by_parent`
    - _Requirements: 1.6, 8.1_

  - [ ] 15.2 Add harness mutations to Convex
    - Create `convex/harnesses.ts` with `createHarness`, `updateHarnessStatus`, `listHarnesses`, `getHarness` functions
    - Wire into the Convex bridge for dashboard visibility
    - _Requirements: 1.6, 8.1_

- [ ] 16. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties using `fast-check`
- Unit tests validate specific examples and edge cases
- The Eternal Engine Rust FFI is stubbed initially — the bridge falls back to SQLite until the Rust core is ready
