# Implementation Plan: Hindsight Persistent Memory

## Overview

Implement the Hindsight persistent memory system as a new `src/hindsight/` module, integrating with existing ATLAS, Taste Vault, and memory infrastructure. Uses TypeScript with SQLite (sqlite-vec) for local storage and Convex for cloud storage. Tests use Vitest + fast-check.

## Tasks

- [x] 1. Set up core types, configuration, and project structure
  - [x] 1.1 Create `src/hindsight/types.ts` with MemoryFragment, MemoryFragmentInput, HindsightConfig, FragmentFilter, ScoredFragment, RetrievalContext, ConsolidationReport, HealthStatus, and all supporting interfaces
    - Define Zod schemas for HindsightConfig validation (HindsightConfigSchema)
    - Define MemoryFragment serialization/deserialization helpers (toJSON, fromJSON)
    - Define MemoryFragmentInput-to-MemoryFragment factory function (auto-generates id, timestamps, namespace)
    - _Requirements: 1.1, 2.6, 3.6, 9.1, 9.2_
  - [x]* 1.2 Write property test for JSON serialization round-trip
    - **Property 4: JSON serialization round-trip**
    - Generate random valid MemoryFragment objects, serialize to JSON, deserialize, assert deep equality
    - **Validates: Requirements 2.6, 3.6**
  - [x]* 1.3 Write property test for invalid config rejection
    - Generate random invalid config objects (missing fields, wrong types, out-of-range values), assert Zod validation rejects with descriptive errors
    - _Requirements: 9.2_

- [x] 2. Implement StorageAdapter interface and SQLiteAdapter
  - [x] 2.1 Create `src/hindsight/storage-adapter.ts` with the StorageAdapter interface
    - Define write, read, bulkWrite, bulkRead, delete, query, count, searchByVector, exportAll, importAll, isAvailable, getStats methods
    - _Requirements: 2.1, 2.2_
  - [x] 2.2 Create `src/hindsight/sqlite-adapter.ts` implementing StorageAdapter with SQLite + sqlite-vec
    - Initialize SQLite database with WAL mode at configurable path
    - Create fragments table and fragment_vectors virtual table (sqlite-vec)
    - Implement all StorageAdapter methods using better-sqlite3
    - Implement vector search using sqlite-vec ANN queries
    - Implement embedding serialization using Float32Array buffers (matching existing pattern in src/memory/agent-memory.ts)
    - _Requirements: 2.1, 2.3, 3.1, 3.2, 3.3_
  - [x]* 2.3 Write property test for export/import round-trip
    - **Property 3: Export/import round-trip across backends**
    - Generate random fragments, store via SQLiteAdapter, exportAll, importAll into fresh adapter, verify equivalence
    - **Validates: Requirements 2.5**
  - [x]* 2.4 Write property test for search filter correctness
    - **Property 5: Search filter correctness**
    - Generate random fragments with varied namespaces/agents/projects/timestamps, store them, search with various filters, verify all results match filter criteria
    - **Validates: Requirements 3.2, 3.3**

- [x] 3. Checkpoint — Ensure all tests pass
  - ✅ All tests pass

- [x] 4. Implement VectorIndex and retrieval scoring
  - [x] 4.1 Create `src/hindsight/vector-index.ts` implementing the VectorIndex interface
    - Wrap sqlite-vec operations for index, search, remove, rebuild
    - Implement composite scoring: similarity × recency × access frequency
    - Support configurable similarity threshold filtering
    - _Requirements: 1.3, 1.5, 3.1, 3.2, 3.4_
  - [x]* 4.2 Write property test for retrieval ranking correctness
    - **Property 2: Retrieval ranking correctness**
    - Generate random fragments with varied embeddings/recency/access counts, store them, retrieve with a query, verify results are sorted by composite score descending
    - **Validates: Requirements 1.3, 1.5**

- [x] 5. Implement HindsightEngine core
  - [x] 5.1 Create `src/hindsight/engine.ts` with the HindsightEngine class
    - Implement store(): compute embedding, create fragment, write to adapter, update index
    - Implement retrieve(): compute query embedding, search index, read fragments, format context
    - Implement search(): delegate to adapter.searchByVector with filters
    - Implement initialize(): validate config, open storage, build index
    - Implement shutdown(): flush pending writes, close storage
    - Implement healthCheck(): return storage status, index size, fragment count, last consolidation
    - Implement fallback to in-memory cache when storage is unavailable
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 1.6, 9.1, 9.3, 9.4, 9.5_
  - [x]* 5.2 Write property test for fragment creation completeness
    - **Property 1: Fragment creation completeness**
    - Generate random task completion inputs, call store(), verify resulting fragment has all required fields and agent ID in tags
    - **Validates: Requirements 1.1, 7.1**

- [x] 6. Implement ConsolidationPipeline
  - [x] 6.1 Create `src/hindsight/consolidation.ts` with the ConsolidationPipeline class
    - Implement deduplication: find fragments with cosine similarity > 0.95, merge into one
    - Implement merge logic: preserve highest relevance, combine provenance
    - Implement forgetting curve: exponential decay R × exp(-D × T) for unaccessed, unpinned fragments
    - Implement archival: set isArchived=true for fragments below deletion threshold (not permanent delete)
    - Implement compression: summarize low-relevance fragments when total size exceeds threshold
    - Return ConsolidationReport with accurate counts
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_
  - [x]* 6.2 Write property test for forgetting curve exponential decay
    - **Property 9: Forgetting curve exponential decay**
    - Generate random (relevance, decayRate, daysSinceAccess, isPinned) tuples, verify decay formula
    - **Validates: Requirements 4.4**
  - [x]* 6.3 Write property test for deduplication merges similar fragments
    - **Property 7: Deduplication merges similar fragments**
    - Generate fragment sets with known near-duplicate clusters, run consolidation, verify cluster count reduced
    - **Validates: Requirements 4.1**
  - [x]* 6.4 Write property test for merge preserves highest relevance
    - **Property 8: Merge preserves highest relevance and combines provenance**
    - Generate groups of fragments to merge, verify result has max relevance and all source IDs
    - **Validates: Requirements 4.2**
  - [x]* 6.5 Write property test for below-threshold archived not deleted
    - **Property 10: Below-threshold fragments archived not deleted**
    - Generate fragments with low relevance, run consolidation, verify isArchived=true and fragment still retrievable by ID
    - **Validates: Requirements 4.5**
  - [x]* 6.6 Write property test for consolidation report accuracy
    - **Property 11: Consolidation report accuracy**
    - Run consolidation on random fragment sets, compare report counts to actual before/after state differences
    - **Validates: Requirements 4.6**

- [x] 7. Checkpoint — Ensure all tests pass
  - ✅ All tests pass

- [x] 8. Implement RetrievalFormatter and pretty-printer
  - [x] 8.1 Create `src/hindsight/formatter.ts` with RetrievalFormatter and prettyPrint functions
    - Implement format(): build structured prompt prefix with type labels, confidence, source attribution
    - Implement token budget enforcement: estimate tokens, prioritize by relevance, truncate
    - Implement type-specific formatting: episodic (date, project, agent, outcome), procedural (trigger, steps), semantic (confidence, evidence count)
    - Implement prettyPrint(): human-readable single-fragment representation
    - _Requirements: 3.5, 8.1, 8.2, 8.3, 8.4, 8.5_
  - [x]* 8.2 Write property test for token budget enforcement
    - **Property 19: Token budget enforcement and priority**
    - Generate large sets of scored fragments, format with small budget, verify output within budget and highest-relevance memories included
    - **Validates: Requirements 8.2**
  - [x]* 8.3 Write property test for type-specific formatting completeness
    - **Property 20: Type-specific formatting completeness**
    - Generate random episodic/procedural/semantic fragments, format each, verify type-specific fields present in output
    - **Validates: Requirements 8.1, 8.3, 8.4, 8.5**
  - [x]* 8.4 Write property test for pretty-printer key fields
    - **Property 6: Pretty-printer contains key fields**
    - Generate random fragments, pretty-print, verify output contains type, content substring, agent ID, project ID
    - **Validates: Requirements 3.5**

- [x] 9. Implement ATLASBridge
  - [x] 9.1 Create `src/hindsight/atlas-bridge.ts` with the ATLASBridge class
    - Implement onBuildLogged(): convert BuildLog to MemoryFragmentInput, call engine.store()
    - Implement onRetrospectiveComplete(): create semantic fragments from insight strings
    - Implement mapSemanticTags(): convert ATLAS CodeNode semantic tags to Hindsight namespace tags
    - Implement enrichRetrieval(): query Kronos for additional context (best-effort, graceful fallback)
    - _Requirements: 5.1, 5.3, 5.4, 5.5_
  - [x]* 9.2 Write property test for bridge fragment creation
    - **Property 12: Bridge fragment creation correctness**
    - Generate random BuildLog and insight strings, verify created fragments have correct sourceType and content
    - **Validates: Requirements 5.1, 5.4**
  - [x]* 9.3 Write property test for ATLAS tag mapping determinism
    - **Property 13: ATLAS tag mapping determinism**
    - Generate random tag sets, call mapping twice, verify identical output and non-empty result
    - **Validates: Requirements 5.3**

- [x] 10. Implement TasteVaultBridge
  - [x] 10.1 Create `src/hindsight/taste-vault-bridge.ts` with the TasteVaultBridge class
    - Implement onPatternLearned(): convert GraphNode to MemoryFragmentInput with pattern content, type, confidence in extra
    - Implement onPatternReinforced(): boost relevance score of corresponding fragment
    - Implement onConflictResolved(): create procedural fragment with conflict resolution details
    - Implement supplementRetrieval(): search Hindsight for semantically similar fragments to supplement Taste Vault results
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  - [x]* 10.2 Write property test for Taste Vault bridge fragment creation
    - **Property 14: Taste Vault bridge fragment creation**
    - Generate random GraphNodes and conflict resolutions, verify fragment content, extra.confidence, and type='procedural' for conflicts
    - **Validates: Requirements 6.1, 6.4**
  - [x]* 10.3 Write property test for reinforcement boosts relevance
    - **Property 15: Taste Vault reinforcement boosts relevance**
    - Create fragments with various relevance scores, reinforce, verify relevance strictly increased (up to 1.0)
    - **Validates: Requirements 6.3**

- [x] 11. Implement namespace management and ParallelUniverseBridge
  - [x] 11.1 Create `src/hindsight/namespace-manager.ts` with namespace fork, merge, and isolation logic
    - Implement forkNamespace(): copy all fragments from source namespace to target namespace with new IDs
    - Implement mergeNamespaces(): reconcile fragments, prefer higher relevance for duplicates (by sourceId)
    - Implement cross-agent retrieval: include fragments from other agents in same project above threshold
    - _Requirements: 7.2, 7.3, 7.4, 7.5_
  - [x] 11.2 Create `src/hindsight/parallel-universe-bridge.ts` with ParallelUniverseBridge class
    - Implement onBranchCreated(): delegate to namespace manager forkNamespace
    - Implement onBranchMerged(): delegate to namespace manager mergeNamespaces
    - _Requirements: 7.3, 7.4_
  - [x]* 11.3 Write property test for namespace isolation
    - **Property 17: Namespace isolation**
    - Store fragments in namespace A, retrieve from namespace B, verify zero results from A. Fork A to C, write to C, verify A unchanged.
    - **Validates: Requirements 7.3, 7.5**
  - [x]* 11.4 Write property test for branch merge reconciliation
    - **Property 18: Branch merge reconciliation**
    - Create two branches with overlapping sourceIds but different relevance, merge, verify higher-relevance kept and no duplicate sourceIds
    - **Validates: Requirements 7.4**
  - [x]* 11.5 Write property test for cross-agent retrieval
    - **Property 16: Cross-agent retrieval inclusion**
    - Store fragments from multiple agents in same project, retrieve for one agent with cross-agent enabled, verify other agents' high-relevance fragments included
    - **Validates: Requirements 7.2**

- [x] 12. Checkpoint — Ensure all tests pass
  - ✅ All tests pass

- [x] 13. Implement ConvexAdapter and schema extension
  - [x] 13.1 Add Hindsight tables to `convex/schema.ts`
    - Add hindsightFragments and hindsightConsolidations tables with indexes as defined in design
    - _Requirements: 2.2, 2.4_
  - [x] 13.2 Create `convex/hindsight.ts` with Convex mutations and queries
    - Implement storeFragment, getFragment, queryFragments, searchByVector, deleteFragment mutations/queries
    - _Requirements: 2.2, 2.4_
  - [x] 13.3 Create `src/hindsight/convex-adapter.ts` implementing StorageAdapter for Convex
    - Implement all StorageAdapter methods using the Convex client
    - Handle Convex unavailability gracefully (isAvailable check)
    - _Requirements: 2.2, 2.4_

- [x] 14. Wire everything together and create public API
  - [x] 14.1 Create `src/hindsight/index.ts` as the public module entry point
    - Export HindsightEngine, types, adapters, bridges, and factory function
    - Implement createHindsightEngine() factory that wires all components together from config
    - _Requirements: 9.1, 9.5_
  - [x] 14.2 Integrate ATLASBridge with existing KronosAtlas in `src/atlas/index.ts`
    - Add optional Hindsight hook to KronosAtlas.logBuild() that calls ATLASBridge.onBuildLogged()
    - Add optional Hindsight hook to KronosRetrospective for feeding insights
    - _Requirements: 5.1, 5.4_
  - [x] 14.3 Integrate TasteVaultBridge with existing TasteVault in `src/taste-vault/taste-vault.ts`
    - Add optional Hindsight hook to TasteVault.learn() that calls TasteVaultBridge.onPatternLearned()
    - Add optional Hindsight hook to TasteVault.reinforce() that calls TasteVaultBridge.onPatternReinforced()
    - _Requirements: 6.1, 6.3_

- [x] 15. Final checkpoint — Ensure all tests pass
  - ✅ All 15 tasks complete
  - ✅ TypeScript compiles with 0 errors
  - ✅ All 122 tests pass

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties using fast-check (min 100 iterations each)
- Unit tests validate specific examples and edge cases
- The SQLiteAdapter uses sqlite-vec for ANN search, matching the project's existing better-sqlite3 usage pattern
- The ConvexAdapter reuses the project's existing Convex client patterns from src/atlas/convex-client.ts
