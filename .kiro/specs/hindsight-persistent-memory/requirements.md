# Requirements Document

## Introduction

Hindsight is a persistent memory system for NOVA26 agents that provides vector-indexed long-term recall with semantic search across workflows and sessions. It solves the "forgetfulness" problem in multi-session agent tasks by maintaining up to 50M tokens of agent memory with sub-50ms retrieval latency. Hindsight integrates with the existing ATLAS memory system, Taste Vault, Portfolio Learning, and Parallel Universes to provide a unified persistent memory layer that differentiates from append-only log approaches (Mem0/Letta) through semantic vector indexing and intelligent consolidation.

## Glossary

- **Hindsight_Engine**: The core persistent memory system that manages storage, indexing, retrieval, and consolidation of agent memories across sessions and workflows.
- **Memory_Fragment**: A discrete unit of agent memory containing content, vector embedding, metadata, timestamps, and provenance information.
- **Vector_Index**: A searchable index of memory embeddings that enables semantic similarity search across the memory corpus.
- **Memory_Store**: The storage backend abstraction that supports both local (SQLite with vector extensions) and cloud (Convex) persistence.
- **Consolidation_Pipeline**: The process that compacts, deduplicates, and summarizes memory fragments to maintain quality and stay within storage budgets.
- **Retrieval_Context**: The formatted memory context injected into agent prompts based on semantic relevance to the current task.
- **Agent_Session**: A single execution context for an agent within a workflow, bounded by start and completion of a task.
- **Memory_Namespace**: A scoped partition of memory that isolates memories by project, agent, or workflow context.
- **ATLAS_Bridge**: The integration layer that connects Hindsight with the existing ATLAS triple-write memory system (local files, Kronos, Convex).
- **Embedding_Provider**: The service that generates vector embeddings from text content for semantic indexing.

## Requirements

### Requirement 1: Memory Fragment Storage and Retrieval

**User Story:** As an agent, I want to store and retrieve memory fragments with vector embeddings, so that I can recall relevant past experiences during task execution.

#### Acceptance Criteria

1. WHEN an agent completes a task, THE Hindsight_Engine SHALL create a Memory_Fragment containing the task context, outcome, embedding vector, agent identifier, project identifier, and timestamp.
2. WHEN a Memory_Fragment is created, THE Memory_Store SHALL persist the fragment to the configured storage backend within 50ms.
3. WHEN an agent begins a new task, THE Hindsight_Engine SHALL retrieve the top-k most semantically relevant Memory_Fragments using cosine similarity against the Vector_Index.
4. THE Hindsight_Engine SHALL support storing up to 50 million tokens of memory content across all Memory_Namespaces.
5. WHEN a retrieval query is executed, THE Vector_Index SHALL return results ranked by a composite score combining semantic similarity, recency, and access frequency.
6. IF the configured storage backend is unavailable, THEN THE Hindsight_Engine SHALL fall back to an in-memory cache and queue writes for retry.

### Requirement 2: Dual Storage Backend Support

**User Story:** As a developer, I want Hindsight to support both local and cloud storage backends, so that the system works offline and scales in production.

#### Acceptance Criteria

1. THE Memory_Store SHALL support a local storage backend using SQLite with vector similarity search capabilities.
2. THE Memory_Store SHALL support a cloud storage backend using Convex for multi-device synchronization.
3. WHEN the local backend is selected, THE Memory_Store SHALL store all data in a single SQLite database file at a configurable path.
4. WHEN the cloud backend is selected, THE Memory_Store SHALL synchronize Memory_Fragments to Convex tables with proper indexing.
5. WHEN switching between backends, THE Memory_Store SHALL provide an export/import mechanism that preserves all Memory_Fragment data and embeddings.
6. THE Memory_Store SHALL serialize Memory_Fragment objects to JSON for export and deserialize JSON back to Memory_Fragment objects for import.

### Requirement 3: Semantic Vector Indexing

**User Story:** As an agent, I want memories indexed by semantic meaning, so that I can find relevant past experiences even when exact keywords differ.

#### Acceptance Criteria

1. WHEN a Memory_Fragment is stored, THE Vector_Index SHALL compute and store an embedding vector using the configured Embedding_Provider.
2. WHEN a semantic search is performed, THE Vector_Index SHALL return Memory_Fragments with cosine similarity above a configurable threshold (default 0.7).
3. THE Vector_Index SHALL support filtering search results by Memory_Namespace, agent identifier, project identifier, and time range.
4. WHEN the memory corpus exceeds 10 million tokens, THE Vector_Index SHALL maintain query response times below 100ms through approximate nearest neighbor indexing.
5. THE Hindsight_Engine SHALL provide a pretty-printer that formats Memory_Fragment objects into human-readable text representations.
6. FOR ALL valid Memory_Fragment objects, serializing to JSON then deserializing back SHALL produce an equivalent Memory_Fragment object (round-trip property).

### Requirement 4: Memory Consolidation and Compaction

**User Story:** As a system operator, I want memories automatically consolidated and compacted, so that storage remains efficient and retrieval quality improves over time.

#### Acceptance Criteria

1. WHEN the Consolidation_Pipeline runs, THE Hindsight_Engine SHALL identify and merge semantically duplicate Memory_Fragments (cosine similarity above 0.95) into a single consolidated fragment.
2. WHEN Memory_Fragments are consolidated, THE Consolidation_Pipeline SHALL preserve the highest-relevance metadata and combine provenance information from all source fragments.
3. WHEN the total memory size exceeds a configurable threshold, THE Consolidation_Pipeline SHALL summarize low-relevance Memory_Fragments into compressed summaries.
4. THE Consolidation_Pipeline SHALL apply a forgetting curve that decays relevance scores of unaccessed Memory_Fragments over time, using an exponential decay function.
5. WHEN a Memory_Fragment relevance score falls below a configurable deletion threshold, THE Consolidation_Pipeline SHALL archive the fragment rather than permanently deleting the fragment.
6. WHEN consolidation completes, THE Consolidation_Pipeline SHALL report the number of fragments merged, compressed, and archived.

### Requirement 5: ATLAS Bridge Integration

**User Story:** As a system architect, I want Hindsight to integrate with the existing ATLAS triple-write memory system, so that all memory subsystems share a unified persistence layer.

#### Acceptance Criteria

1. WHEN ATLAS logs a build event, THE ATLAS_Bridge SHALL create a corresponding Memory_Fragment in the Hindsight_Engine with the build context, agent, and outcome.
2. WHEN the Hindsight_Engine retrieves memories for an agent, THE ATLAS_Bridge SHALL include relevant ATLAS Kronos entries in the retrieval results.
3. THE ATLAS_Bridge SHALL map ATLAS CodeNode semantic tags to Hindsight Memory_Namespace tags for cross-system querying.
4. WHEN ATLAS performs a retrospective analysis, THE ATLAS_Bridge SHALL feed the retrospective insights into the Hindsight_Engine as semantic Memory_Fragments.
5. IF ATLAS Kronos is unavailable, THEN THE ATLAS_Bridge SHALL continue operating using only local Hindsight storage.

### Requirement 6: Taste Vault Integration

**User Story:** As a creative agent, I want my style patterns persisted through Hindsight, so that the Taste Vault never loses context across sessions.

#### Acceptance Criteria

1. WHEN a Taste Vault pattern is learned, THE Hindsight_Engine SHALL store a corresponding Memory_Fragment with the pattern content, type, confidence, and user identifier.
2. WHEN the Taste Vault retrieves relevant patterns, THE Hindsight_Engine SHALL supplement results with semantically similar Memory_Fragments from past sessions.
3. WHEN a Taste Vault pattern is reinforced, THE Hindsight_Engine SHALL boost the relevance score of the corresponding Memory_Fragment.
4. WHEN a Taste Vault conflict is detected, THE Hindsight_Engine SHALL store the conflict resolution as a procedural Memory_Fragment for future reference.

### Requirement 7: Multi-Agent and Cross-Workflow Memory

**User Story:** As the SUN orchestrator, I want agents to share relevant memories across workflows, so that lessons learned by one agent benefit others working on related tasks.

#### Acceptance Criteria

1. WHEN an agent stores a Memory_Fragment, THE Hindsight_Engine SHALL tag the fragment with the agent identifier and workflow context.
2. WHEN retrieving memories, THE Hindsight_Engine SHALL include cross-agent Memory_Fragments from the same project that exceed a relevance threshold.
3. WHEN the Parallel Universes system creates a branch, THE Hindsight_Engine SHALL fork the relevant Memory_Namespace so each branch maintains independent memory state.
4. WHEN parallel branches merge, THE Hindsight_Engine SHALL reconcile Memory_Fragments from both branches, preferring fragments with higher relevance scores for duplicates.
5. THE Hindsight_Engine SHALL enforce Memory_Namespace isolation so that memories from one project do not leak into unrelated project retrievals.

### Requirement 8: Memory Retrieval Context Formatting

**User Story:** As an agent, I want retrieved memories formatted as structured context in my prompt, so that I can effectively use past experiences during task execution.

#### Acceptance Criteria

1. WHEN memories are retrieved for an agent, THE Hindsight_Engine SHALL format the Retrieval_Context as a structured prompt prefix with memory type labels, confidence indicators, and source attribution.
2. THE Retrieval_Context formatter SHALL enforce a configurable token budget (default 1200 tokens) and prioritize higher-relevance memories when truncating.
3. WHEN formatting episodic memories, THE Retrieval_Context SHALL include the date, project, agent, and outcome of the original experience.
4. WHEN formatting procedural memories, THE Retrieval_Context SHALL include the trigger pattern and ordered steps.
5. WHEN formatting semantic memories, THE Retrieval_Context SHALL include the confidence level and supporting evidence count.

### Requirement 9: Configuration and Observability

**User Story:** As a developer, I want to configure Hindsight behavior and monitor its performance, so that I can tune the system for optimal agent performance.

#### Acceptance Criteria

1. THE Hindsight_Engine SHALL accept a configuration object specifying storage backend, embedding provider, consolidation schedule, retrieval budget, and forgetting curve parameters.
2. THE Hindsight_Engine SHALL validate the configuration object against a schema and reject invalid configurations with descriptive error messages.
3. WHEN a retrieval operation completes, THE Hindsight_Engine SHALL emit metrics including query latency, number of results, total tokens used, and cache hit rate.
4. THE Hindsight_Engine SHALL expose a health check endpoint that reports storage backend status, index size, total memory fragments, and last consolidation timestamp.
5. WHEN the Hindsight_Engine starts, THE Hindsight_Engine SHALL log the active configuration and storage backend status.
