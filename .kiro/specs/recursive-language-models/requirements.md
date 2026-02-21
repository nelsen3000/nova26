# Requirements Document

## Introduction

Recursive Language Models (RLMs) introduce a dedicated "reader" model that compresses and prioritizes context history before it reaches the main agent brain. Instead of stuffing full conversation history into prompts, the reader model distills only the most relevant information, doubling efficiency on long tasks without token bloat. This integrates with NOVA26's existing AgentLoop, ATLAS memory, CRDT collaboration, Taste Vault, and Model Database systems.

## Glossary

- **Reader_Model**: A smaller, cheaper LLM dedicated to compressing and prioritizing context history before passing it to the main agent model
- **Main_Model**: The primary LLM that receives compressed context from the Reader_Model and produces the agent's output
- **RLM_Pipeline**: The end-to-end pipeline that routes context through the Reader_Model before the Main_Model processes it
- **Context_Window**: The compressed representation of conversation history produced by the Reader_Model
- **Compression_Ratio**: The ratio of original token count to compressed token count after Reader_Model processing
- **Relevance_Score**: A numeric score (0.0–1.0) assigned by the Reader_Model to each context segment indicating its importance to the current task
- **Drift_Score**: A numeric measure of how much the Reader_Model's compression quality has degraded over time, used for auditing
- **AgentLoop**: The existing ReAct inner loop (src/agent-loop) that orchestrates multi-turn agent reasoning with tool use
- **ATLAS**: The meta-learner agent and memory system (src/atlas) that stores build logs, patterns, and learning insights
- **Model_Database**: The existing model registry (src/model-db) that manages model entries, capabilities, and selection
- **Taste_Vault**: The system that stores style patterns and preferences for agents
- **CRDT_Engine**: The collaboration engine (src/collaboration) that manages real-time collaborative editing sessions

## Requirements

### Requirement 1: Reader Model Context Compression

**User Story:** As an agent developer, I want a reader model to compress conversation history, so that the main model receives only the most relevant context without token bloat.

#### Acceptance Criteria

1. WHEN the AgentLoop prepares context for a new turn, THE RLM_Pipeline SHALL pass the full conversation history through the Reader_Model before sending it to the Main_Model
2. WHEN the Reader_Model processes conversation history, THE RLM_Pipeline SHALL produce a Context_Window that contains a Relevance_Score for each retained segment
3. WHEN the Reader_Model compresses context, THE RLM_Pipeline SHALL achieve a Compression_Ratio of at least 2:1 on conversations exceeding 10,000 tokens
4. WHEN the compressed Context_Window is produced, THE RLM_Pipeline SHALL preserve all segments with a Relevance_Score above 0.7
5. IF the Reader_Model fails or times out, THEN THE RLM_Pipeline SHALL fall back to the existing uncompressed context path and log the failure

### Requirement 2: Reader Model Configuration and Selection

**User Story:** As a system administrator, I want to configure which model serves as the reader, so that I can optimize cost and performance independently from the main agent model.

#### Acceptance Criteria

1. THE Model_Database SHALL support a "context-compression" capability tag for models suitable as Reader_Models
2. WHEN a Reader_Model is configured, THE RLM_Pipeline SHALL accept any model registered in the Model_Database that has the "context-compression" capability
3. WHEN no Reader_Model is explicitly configured, THE RLM_Pipeline SHALL select the cheapest available model with the "context-compression" capability from the Model_Database
4. WHEN the Reader_Model configuration changes at runtime, THE RLM_Pipeline SHALL apply the new model starting from the next AgentLoop turn without requiring a restart
5. THE RLM_Pipeline SHALL expose a configuration interface that accepts reader model ID, compression threshold, and maximum output token budget

### Requirement 3: AgentLoop Integration

**User Story:** As an agent developer, I want the RLM pipeline to integrate seamlessly with the existing AgentLoop, so that all 21 planetary agents benefit from compressed context without code changes to individual agents.

#### Acceptance Criteria

1. WHEN the AgentLoop executes a turn, THE RLM_Pipeline SHALL intercept the context assembly step and inject compressed context transparently
2. WHEN an agent runs with RLM enabled, THE AgentLoop SHALL track both original token count and compressed token count in the AgentLoopResult
3. WHEN RLM is disabled for a specific agent, THE AgentLoop SHALL bypass the RLM_Pipeline and use the existing context path unchanged
4. THE RLM_Pipeline SHALL operate within the AgentLoop's existing token budget, counting only the compressed token size against the budget

### Requirement 4: ATLAS Infinite Memory Integration

**User Story:** As the ATLAS meta-learner, I want compressed context summaries stored alongside build logs, so that agents like Jupiter can handle epic-length contexts without token bloat while enhancing portfolio learning.

#### Acceptance Criteria

1. WHEN the RLM_Pipeline compresses context for an agent turn, THE ATLAS system SHALL store the compressed Context_Window as a retrievable memory entry
2. WHEN ATLAS retrieves historical context for a new task, THE RLM_Pipeline SHALL re-compress the retrieved entries to fit the current token budget
3. WHEN portfolio learning queries span multiple projects, THE RLM_Pipeline SHALL compress cross-project context into a single Context_Window that fits within the agent's token budget

### Requirement 5: CRDT Collaboration Integration

**User Story:** As a collaborative user, I want compressed context shared across editing sessions, so that real-time collaboration remains efficient even with long shared histories.

#### Acceptance Criteria

1. WHEN a CRDT collaborative session generates context updates, THE RLM_Pipeline SHALL compress the session history before broadcasting to participants
2. WHEN a new participant joins a collaborative session, THE RLM_Pipeline SHALL provide a compressed Context_Window summarizing the session history up to the join point
3. IF the compressed context diverges between participants, THEN THE CRDT_Engine SHALL reconcile using the most recent compression as the authoritative version

### Requirement 6: Taste Vault Style Pattern Compression

**User Story:** As an agent, I want compressed style pattern history from the Taste Vault, so that style preferences are applied efficiently without consuming excessive context tokens.

#### Acceptance Criteria

1. WHEN the Taste_Vault provides style patterns to an agent, THE RLM_Pipeline SHALL compress the pattern history to retain only the most relevant style directives for the current task
2. WHEN compressed style patterns are applied, THE Main_Model SHALL produce output consistent with the original uncompressed style directives

### Requirement 7: Compression Quality Auditing

**User Story:** As a system operator, I want to audit compression quality over time, so that I can detect and correct drift before it degrades agent performance.

#### Acceptance Criteria

1. THE RLM_Pipeline SHALL compute a Drift_Score after each compression by comparing a sample of compressed outputs against their uncompressed originals
2. WHEN the Drift_Score exceeds a configurable threshold, THE RLM_Pipeline SHALL emit a warning event that the Wellbeing system can consume
3. WHEN auditing is triggered, THE RLM_Pipeline SHALL log the Compression_Ratio, Relevance_Score distribution, and Drift_Score for the audited turn
4. THE RLM_Pipeline SHALL expose an audit history endpoint that returns compression metrics for the last 100 turns

### Requirement 8: Performance and Efficiency

**User Story:** As a system architect, I want the RLM pipeline to deliver measurable efficiency gains, so that the system processes long tasks faster and cheaper.

#### Acceptance Criteria

1. WHEN the RLM_Pipeline is active, THE AgentLoop SHALL complete long tasks (exceeding 20,000 total tokens) with at least 12% fewer total tokens consumed compared to the uncompressed path
2. WHEN the Reader_Model processes context, THE RLM_Pipeline SHALL complete compression within 2 seconds for contexts up to 50,000 tokens
3. THE RLM_Pipeline SHALL add no more than 15% latency overhead per AgentLoop turn compared to the uncompressed path

### Requirement 9: Serialization and Persistence

**User Story:** As a developer, I want compressed context windows to be serializable, so that they can be stored, transmitted, and restored across sessions.

#### Acceptance Criteria

1. THE RLM_Pipeline SHALL serialize Context_Window objects to JSON for storage and transmission
2. THE RLM_Pipeline SHALL deserialize JSON back into Context_Window objects that are equivalent to the originals
3. WHEN a Context_Window is serialized then deserialized, THE RLM_Pipeline SHALL produce an object that, when used for agent context, yields identical behavior to the original Context_Window
