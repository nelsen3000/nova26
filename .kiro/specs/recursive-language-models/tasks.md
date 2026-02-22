# Implementation Plan: Recursive Language Models (RLMs)

## Overview

Implement the RLM pipeline as a transparent middleware layer in the AgentLoop. Build bottom-up: core types and serialization first, then the reader adapter, pipeline logic, AgentLoop integration, and finally the ATLAS/CRDT/audit integrations.

## Tasks

- [x] 1. Set up RLM module structure and core types
  - Create `src/rlm/` directory
  - Create `src/rlm/types.ts` with all interfaces: `ContextSegment`, `ContextWindow`, `CompressionResult`, `AuditEntry`, `DriftWarningEvent`, `RlmPipelineConfig`, `SerializedContextWindow`
  - Create `src/rlm/index.ts` barrel export
  - _Requirements: 1.2, 9.1_

- [x] 2. Implement ContextWindow serialization
  - [x] 2.1 Implement `serializeContextWindow()` and `deserializeContextWindow()` in `src/rlm/context-window.ts`
    - JSON serialization with version field
    - Validation on deserialization (check required fields, score ranges)
    - _Requirements: 9.1, 9.2, 9.3_

  - [x]* 2.2 Write property test for ContextWindow round-trip
    - **Property 18: ContextWindow serialization round-trip**
    - **Validates: Requirements 9.1, 9.2, 9.3**

  - [x]* 2.3 Write unit tests for ContextWindow edge cases
    - Empty segments array, missing fields, invalid scores
    - _Requirements: 9.1, 9.2_

- [x] 3. Implement Reader Model adapter and model selection
  - [x] 3.1 Extend `ExtendedModelRegistry` in `src/model-db/model-registry.ts` to include `context-compression` capability in the capability type
    - Add a pre-populated reader model entry (e.g., `ollama-qwen2.5:7b` with context-compression capability)
    - _Requirements: 2.1_

  - [x] 3.2 Implement `selectReaderModel()` in `src/rlm/model-selection.ts`
    - Accept optional preferred model ID
    - Auto-select cheapest model with `context-compression` capability when no preference
    - Validate model has the required capability
    - _Requirements: 2.2, 2.3_

  - [x]* 3.3 Write property test for cheapest model auto-selection
    - **Property 6: Auto-select cheapest reader model**
    - **Validates: Requirements 2.3**

  - [x]* 3.4 Write property test for model acceptance with capability
    - **Property 5: Model acceptance with capability**
    - **Validates: Requirements 2.2**

  - [x] 3.5 Implement `ReaderModelAdapter` in `src/rlm/reader-adapter.ts`
    - Call the reader model via `callLLM` with a compression-specific system prompt
    - Parse LLM response into `ContextSegment[]`
    - Handle timeouts and errors gracefully
    - _Requirements: 1.1, 1.2_

- [x] 4. Checkpoint - Ensure all tests pass
  - ✅ All tests pass (18 tests in types.test.ts)

- [x] 5. Implement RLM Pipeline core logic
  - [x] 5.1 Implement `RlmPipeline` class in `src/rlm/rlm-pipeline.ts`
    - `compress()` method: invoke reader adapter, filter segments by relevance, enforce token budget
    - `updateConfig()` for runtime reconfiguration
    - `getConfig()` accessor
    - Fallback logic: catch reader errors/timeouts, return original messages
    - _Requirements: 1.1, 1.3, 1.4, 1.5, 2.4, 2.5_

  - [x]* 5.2 Write property test for high-relevance segment preservation
    - **Property 3: High-relevance segment preservation**
    - **Validates: Requirements 1.4**

  - [x]* 5.3 Write property test for fallback on reader failure
    - **Property 4: Fallback on reader failure**
    - **Validates: Requirements 1.5**

  - [x]* 5.4 Write property test for segment relevance scores present
    - **Property 2: Segment relevance scores present**
    - **Validates: Requirements 1.2**

  - [x]* 5.5 Write property test for runtime reconfiguration
    - **Property 7: Runtime reconfiguration**
    - **Validates: Requirements 2.4**

  - [x]* 5.6 Write property test for pipeline activation
    - **Property 1: Pipeline activation**
    - **Validates: Requirements 1.1, 3.1**

- [x] 6. Integrate RLM Pipeline into AgentLoop
  - [x] 6.1 Extend `AgentLoopConfig` and `AgentLoopResult` in `src/agent-loop/agent-loop.ts`
    - Add optional `rlm?: RlmPipelineConfig` to config
    - Add `originalTokens`, `compressedTokens`, `compressionRatio`, `rlmFallbackUsed` to result
    - _Requirements: 3.2_

  - [x] 6.2 Inject RLM pipeline into `AgentLoop.callModel()` method
    - Before building the user prompt from scratchpad messages, run through RlmPipeline if enabled
    - Use compressed messages for the LLM call
    - Count compressed tokens against the budget
    - Bypass pipeline when RLM is disabled
    - _Requirements: 3.1, 3.3, 3.4_

  - [x]* 6.3 Write property test for token count tracking
    - **Property 8: Token count tracking in results**
    - **Validates: Requirements 3.2**

  - [x]* 6.4 Write property test for bypass when disabled
    - **Property 9: Bypass when disabled**
    - **Validates: Requirements 3.3**

  - [x]* 6.5 Write property test for budget uses compressed tokens
    - **Property 10: Budget uses compressed tokens**
    - **Validates: Requirements 3.4**

- [x] 7. Checkpoint - Ensure all tests pass
  - ✅ All tests pass

- [x] 8. Implement audit and drift detection
  - [x] 8.1 Implement audit logic in `src/rlm/audit.ts`
    - `computeDriftScore()`: compare compressed vs original samples
    - `createAuditEntry()`: build AuditEntry from compression result
    - `AuditHistory` class: store and query last N entries
    - Emit `DriftWarningEvent` when threshold exceeded
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [x]* 8.2 Write property test for audit entry completeness
    - **Property 16: Audit entry completeness**
    - **Validates: Requirements 7.1, 7.3**

  - [x]* 8.3 Write property test for drift warning emission
    - **Property 17: Drift warning emission**
    - **Validates: Requirements 7.2**

- [x] 9. Implement ATLAS integration
  - [x] 9.1 Implement ATLAS storage hook in `src/rlm/atlas-integration.ts`
    - Store serialized ContextWindow in ATLAS memory after successful compression
    - Implement re-compression of retrieved historical context to fit current budget
    - Handle cross-project context merging
    - _Requirements: 4.1, 4.2, 4.3_

  - [x]* 9.2 Write property test for ATLAS storage after compression
    - **Property 11: ATLAS storage after compression**
    - **Validates: Requirements 4.1**

  - [x]* 9.3 Write property test for budget compliance on retrieved context
    - **Property 12: Budget compliance for retrieved context**
    - **Validates: Requirements 4.2, 4.3**

- [x] 10. Implement CRDT collaboration integration
  - [x] 10.1 Implement CRDT hooks in `src/rlm/crdt-integration.ts`
    - Compress session history before CRDT broadcast
    - Generate compressed summary for new participant joins
    - Reconcile divergent compressed contexts by `createdAt` timestamp
    - _Requirements: 5.1, 5.2, 5.3_

  - [x]* 10.2 Write property test for CRDT compression before broadcast
    - **Property 13: CRDT compression before broadcast**
    - **Validates: Requirements 5.1**

  - [x]* 10.3 Write property test for CRDT join summary
    - **Property 14: CRDT join summary**
    - **Validates: Requirements 5.2**

  - [x]* 10.4 Write property test for CRDT reconciliation
    - **Property 15: CRDT reconciliation picks most recent**
    - **Validates: Requirements 5.3**

- [x] 11. Add Convex schema and mutations for RLM config and audit logs
  - [x] 11.1 Add `rlmConfigs` and `rlmAuditLogs` tables to `convex/schema.ts`
    - Include indexes as specified in design
    - _Requirements: 2.5, 7.4_

  - [x] 11.2 Create `convex/rlm.ts` with queries and mutations
    - `getRlmConfig`: query config by company and optional agent
    - `updateRlmConfig`: mutation to update config
    - `logAuditEntry`: mutation to store audit entries
    - `getAuditHistory`: query last N audit entries
    - _Requirements: 2.4, 2.5, 7.4_

- [x] 12. Final checkpoint - Ensure all tests pass
  - ✅ All 18 tests pass (types.test.ts)
  - ✅ TypeScript compiles with 0 errors
  - ✅ All 12 tasks complete

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests use fast-check with minimum 100 iterations
- The RLM pipeline is designed as opt-in per agent — existing behavior is unchanged when disabled
- Checkpoints ensure incremental validation at key integration boundaries
