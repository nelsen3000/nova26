# GROK-R13: Nova26 Frontier Research Prompt

> Assigned to: Grok
> Round: R13 (post-R12)
> Date issued: 2026-02-18
> Status: Active

---

## Context Brief

Nova26 is a 21-agent AI-powered IDE built with TypeScript, Ollama, and Convex. The 21 agents
are named after celestial bodies (MARS, VENUS, MERCURY, JUPITER, SATURN, PLUTO, ATLAS, etc.)
and operate through a core execution engine called the Ralph Loop (`src/orchestrator/ralph-loop.ts`),
which drives a Generator -> Reflector -> Curator cycle (ACE) for iterative quality improvement.

**Current state of the build:**
- R1-R12 covered: tool use, inner loops, Taste Vault, Global Wisdom Pipeline, ACE specs,
  Rehearsal Stage, Self-Improvement Protocol, Real-Time Collaboration, Security/Privacy,
  Ollama Model Strategy, Plugin Ecosystem, Team/Enterprise, CI/CD Integration, Advanced
  Analytics, Onboarding & Education, Error Recovery, Performance Optimization, Testing at
  Scale, Accessibility/i18n, Long-Term Architecture, Multi-Modal Vision, Voice Interface,
  Code Quality Benchmarks, Knowledge Graph Visualization, Autonomous Project Generation,
  Context7 Integration, Superpowers/Skills Framework, Retention Mechanics, Revenue/Pricing,
  and Developer Relations/Community.
- Kimi has built: inner loop, Taste Vault + Global Wisdom, ACE + Rehearsal + Self-Improvement,
  similarity engine, Convex real-time, security, model routing, analytics. Polish sprint in
  progress; integrations sprint queued.
- Kiro extracted 79 patterns from BistroLens into `.nova/bistrolens-knowledge/`. Also ran
  a quality audit and extracted Nova26 patterns.
- 1226+ tests passing, 0 TypeScript errors.
- Premium pricing: $299/month. Local-first with Ollama.

**R13 mission:** Grok has covered the full technical and business surface of Nova26 across
12 rounds. R13 shifts to genuinely frontier territory — the five topics below are things
that do not yet exist at production quality anywhere in the AI IDE landscape as of early
2026. They are not incremental improvements; they are architectural bets on what separates
a next-generation AI IDE from everything that exists today. A developer reading these specs
in 2027 should recognize them as the moment Nova26 chose to go further than the obvious path.

**Your style:** Open each deliverable with a tight, concrete analogy that makes the
architecture click in one paragraph. Then go deep — TypeScript interfaces, method
signatures, file structures, ASCII flow diagrams, integration points with the existing
Nova26 codebase. Every spec must be independently useful: a developer or researcher picking
up any single deliverable should be able to understand it, implement it, or extend it
without reading R1-R12. Vague strategy documents are not acceptable — specific, actionable
outputs only.

---

## Deliverables

Label each section clearly: GROK-R13-01, GROK-R13-02, etc.

---

### GROK-R13-01: Agent-to-Agent Communication Protocol

**The ask:** Nova26's Ralph Loop currently orchestrates 21 agents sequentially — JUPITER
plans, MARS codes, VENUS reviews, PLUTO tests, in a deterministic chain. This works for
well-understood tasks. But a complex build is not a deterministic chain: it is a negotiation
between competing priorities, incomplete information, and domain expertise that no single
agent fully possesses. The next evolutionary step is not a faster sequential loop — it is
a protocol that lets agents communicate, delegate, negotiate, and form ad-hoc sub-teams
in real time, the way a skilled engineering team does on a hard problem. Think of it as
the difference between a relay race (current Ralph Loop) and a jazz ensemble: each player
has a role, but they listen to each other, respond to what they hear, and the result is
something none of them could have produced alone.

Produce a complete, ready-to-code specification covering:

1. **The big-picture analogy.** One paragraph. Sequential orchestration is like a factory
   assembly line — efficient for identical tasks, brittle for novel ones. Agent-to-agent
   communication is like what other coordination model used by professionals who must
   respond dynamically to information that arrives mid-task? The key insight is that
   expertise is distributed across the 21 agents (MARS knows implementation, VENUS knows
   design, PLUTO knows test coverage) and the information needed to make good decisions
   arrives asynchronously — so the coordination protocol must be asynchronous too. The
   analogy should capture why sequential orchestration is a special case of a more general
   collaboration model, not the model itself.

2. **Message passing protocol.** Design the typed message system between agents:

   ```typescript
   type AgentMessageType =
     | 'REQUEST_HELP'        // agent asks another for domain expertise
     | 'SHARE_FINDING'       // agent broadcasts a discovery to relevant peers
     | 'FLAG_CONCERN'        // agent raises a blocking issue for another to resolve
     | 'DELEGATE_SUBTASK'    // agent hands off a bounded piece of work
     | 'ACKNOWLEDGE'         // agent confirms receipt and will respond
     | 'RESPONSE'            // agent replies to a REQUEST_HELP or DELEGATE_SUBTASK
     | 'VETO'                // agent blocks a proposed action (requires justification)
     | 'ENDORSE'             // agent signals agreement with a proposed action
     | 'NEGOTIATE'           // agent proposes a compromise between two approaches
     | 'ESCALATE';           // agent requests human or JUPITER arbitration

   interface AgentMessage {
     id: string;                         // UUID
     type: AgentMessageType;
     from: AgentName;
     to: AgentName | 'BROADCAST';       // broadcast goes to all relevant agents
     subject: string;                   // brief topic: 'auth error handling approach'
     body: string;                      // the actual content
     replyToId?: string;                // for threading (RESPONSE, ACKNOWLEDGE, etc.)
     taskId: string;                    // the Ralph Loop task this message relates to
     priority: 'low' | 'medium' | 'high' | 'urgent';
     requiresResponse: boolean;
     responseDeadlineMs?: number;       // how long the sender will wait before escalating
     metadata?: Record<string, unknown>;
     sentAt: string;                    // ISO timestamp
     deliveredAt?: string;
     readAt?: string;
   }

   interface AgentMessageBus {
     send(message: Omit<AgentMessage, 'id' | 'sentAt'>): Promise<AgentMessage>;
     subscribe(agentName: AgentName, handler: (msg: AgentMessage) => Promise<void>): Unsubscribe;
     getThread(rootMessageId: string): Promise<AgentMessage[]>;
     getInbox(agentName: AgentName, since?: string): Promise<AgentMessage[]>;
     markRead(messageId: string, agentName: AgentName): Promise<void>;
     broadcastToRoles(role: AgentRole, message: Omit<AgentMessage, 'id' | 'sentAt' | 'to'>): Promise<AgentMessage[]>;
   }

   type AgentRole =
     | 'IMPLEMENTOR'    // MARS, MERCURY — write code
     | 'REVIEWER'       // VENUS, EARTH — evaluate quality
     | 'PLANNER'        // JUPITER, SATURN — decompose and schedule
     | 'TESTER'         // PLUTO, MIMAS — validate and test
     | 'ARCHIVIST'      // ATLAS, GANYMEDE — store and retrieve knowledge
     | 'ORCHESTRATOR';  // SUN — system-level coordination
   ```

   Specify:
   - How is the message bus implemented? (In-process event emitter for single-machine; Convex
     mutations for distributed/team mode. Design a `MessageBusAdapter` interface that abstracts
     both.)
   - Where does the message bus live in the file structure? (`src/agents/message-bus.ts`)
   - How do agents subscribe to messages during a Ralph Loop execution? (Each agent's
     `AgentLoop` instance subscribes on task start and unsubscribes on task completion.)
   - How are BROADCAST messages filtered? (Each agent declares its `interests: AgentMessageType[]`
     and the bus only delivers messages whose type intersects with the recipient's interests.)

3. **Negotiation protocol.** Design the structured disagreement resolution system:

   When two agents produce conflicting recommendations (MARS wants to use a `Map` for O(1)
   lookup; VENUS wants to use a plain object for JSON-serializability), the system must
   resolve the conflict without human intervention unless it genuinely cannot.

   ```typescript
   interface NegotiationProposal {
     id: string;
     initiatorAgent: AgentName;
     respondentAgent: AgentName;
     topic: string;                       // 'data structure choice for cache'
     initiatorPosition: string;           // MARS: 'use Map — O(1) lookup, typed keys'
     respondentPosition?: string;         // VENUS: 'use Record — JSON-serializable, simpler'
     criteria: NegotiationCriterion[];    // what dimensions matter for this decision
     status: 'open' | 'resolved' | 'escalated';
     resolution?: NegotiationResolution;
     taskId: string;
     openedAt: string;
     resolvedAt?: string;
   }

   interface NegotiationCriterion {
     name: string;                        // 'performance', 'serialization', 'type safety'
     weight: number;                      // 0-1, how much this criterion matters
     initiatorScore: number;              // 0-10, how well initiator's position satisfies this
     respondentScore: number;
   }

   interface NegotiationResolution {
     type: 'initiator-wins' | 'respondent-wins' | 'compromise' | 'escalated-to-human';
     chosenApproach: string;
     rationale: string;                   // why this resolution was reached
     resolvedBy: AgentName | 'JUPITER' | 'HUMAN';
     weightedScore: {
       initiator: number;
       respondent: number;
     };
   }

   interface NegotiationEngine {
     open(proposal: Omit<NegotiationProposal, 'id' | 'status' | 'openedAt'>): Promise<NegotiationProposal>;
     respond(proposalId: string, respondentPosition: string, scores: Record<string, number>): Promise<NegotiationProposal>;
     resolve(proposalId: string): Promise<NegotiationResolution>;
     escalate(proposalId: string, reason: string): Promise<void>;
     getOpenNegotiations(taskId: string): Promise<NegotiationProposal[]>;
   }
   ```

   Specify:
   - How does the `NegotiationEngine` resolve a conflict automatically? (Compute weighted
     criterion scores for each position; the position with the higher total weighted score
     wins. If scores are within 0.1 of each other, JUPITER arbitrates.)
   - How does JUPITER arbitrate? (JUPITER receives both positions + criterion scores as a
     structured prompt and returns a `NegotiationResolution` using its structured output
     schema.)
   - When does the system escalate to a human? (Score difference < 0.05 after JUPITER
     arbitration, OR when a VETO message is sent by an agent with `authority: 'blocking'`.)
   - What agents have VETO authority and on what topics? (PLUTO can veto any action that
     removes test coverage below a threshold; SATURN can veto any action that violates
     the project's architecture constraints.)

4. **Shared blackboard pattern.** Design the shared state board all agents read and write:

   The blackboard is the collective working memory of the agent team during a build. It is
   not the Taste Vault (long-term memory) — it is the whiteboard on the wall during a
   sprint: visible to everyone, updated in real time, erased when the task is done.

   ```typescript
   interface BlackboardEntry {
     id: string;
     key: string;                         // e.g., 'current-auth-approach', 'failing-tests'
     value: unknown;                      // the actual content
     author: AgentName;
     taskId: string;
     confidence: number;                  // 0-1: how certain is the author
     scope: 'task' | 'phase' | 'build';  // how long this entry is relevant
     tags: string[];                      // for filtering: ['auth', 'architecture', 'decision']
     supersedes?: string;                 // id of a prior entry this replaces
     writtenAt: string;
     expiresAt?: string;
   }

   interface SharedBlackboard {
     write(entry: Omit<BlackboardEntry, 'id' | 'writtenAt'>): Promise<BlackboardEntry>;
     read(key: string, taskId?: string): Promise<BlackboardEntry | null>;
     readAll(taskId: string, tags?: string[]): Promise<BlackboardEntry[]>;
     supersede(oldEntryId: string, newEntry: Omit<BlackboardEntry, 'id' | 'writtenAt'>): Promise<BlackboardEntry>;
     subscribe(taskId: string, handler: (entry: BlackboardEntry) => void): Unsubscribe;
     snapshot(taskId: string): Promise<Record<string, BlackboardEntry>>;
     clear(taskId: string, scope: BlackboardEntry['scope']): Promise<void>;
   }
   ```

   Specify:
   - Where is the blackboard stored during a build? (In-memory Map keyed by taskId for
     local builds; Convex real-time table for team/distributed builds.)
   - How do agents discover relevant blackboard entries? (The `AgentLoop` passes a filtered
     blackboard snapshot to the agent's prompt context — entries tagged with the agent's
     domain are injected automatically.)
   - How is the blackboard integrated with `prompt-builder.ts`? (A new `BlackboardContext`
     section is injected after Taste Vault context and before the tool list. Cap at 500
     tokens. Ranked by confidence score descending.)
   - Show the `BlackboardContext` prompt injection format:
     ```
     ## Shared Team Context (from other agents)
     [HIGH CONFIDENCE] MARS wrote: current-auth-approach = "JWT with refresh tokens, stored
       in httpOnly cookies. VENUS approved." (confidence: 0.95)
     [MEDIUM] PLUTO wrote: failing-tests = ["auth.test.ts:47", "session.test.ts:12"]
       (confidence: 0.80)
     ```

5. **Emergent sub-teams.** Design the spontaneous team formation system:

   ```typescript
   interface SubTeam {
     id: string;
     name: string;                        // e.g., 'auth-hardening-squad'
     members: AgentName[];
     coordinator: AgentName;              // leads the sub-team (often JUPITER or SATURN)
     purpose: string;                     // what problem this sub-team is solving
     taskId: string;                      // parent Ralph Loop task
     subtasks: SubTeamTask[];
     status: 'forming' | 'active' | 'completed' | 'disbanded';
     formedAt: string;
     disbandedAt?: string;
     outcome?: string;                    // what the sub-team produced
   }

   interface SubTeamTask {
     id: string;
     assignedTo: AgentName;
     description: string;
     status: 'pending' | 'active' | 'done';
     output?: string;
   }

   interface SubTeamCoordinator {
     propose(purpose: string, suggestedMembers: AgentName[], taskId: string): Promise<SubTeam>;
     accept(subTeamId: string, agentName: AgentName): Promise<void>;
     decline(subTeamId: string, agentName: AgentName, reason: string): Promise<void>;
     dissolve(subTeamId: string, outcome: string): Promise<void>;
     getActiveSubTeams(taskId: string): Promise<SubTeam[]>;
   }
   ```

   Specify:
   - When does the system spontaneously propose a sub-team? (Trigger conditions: three or
     more agents have exchanged FLAG_CONCERN messages on the same topic within 5 minutes;
     OR a DELEGATE_SUBTASK creates more than 3 dependent sub-tasks; OR JUPITER's task
     complexity estimate exceeds a threshold.)
   - What is the minimum viable sub-team? (2 agents: one coordinator, one implementor.)
   - How does sub-team output feed back into the main Ralph Loop? (Sub-team dissolves by
     calling `dissolve(outcome)`, which writes the outcome to the blackboard and sends
     a SHARE_FINDING to all agents in the parent task.)
   - How does this avoid infinite sub-team nesting? (Sub-teams cannot spawn sub-sub-teams.
     Maximum nesting depth is 1.)

6. **Integration with the Ralph Loop.** Specify where the protocol plugs into existing code:

   - `src/orchestrator/ralph-loop.ts`: Add a `messageBus` and `blackboard` to the Ralph
     Loop context, initialized on build start and torn down on build completion.
   - `src/agent-loop/agent-loop.ts`: Each `AgentLoop` receives the `messageBus` and
     `blackboard` in its constructor. The main ReAct loop checks the inbox before each
     tool call iteration (non-blocking: if inbox is empty, continue immediately).
   - New `RalphLoopOptions` fields:
     ```typescript
     // New in R13:
     agentProtocolEnabled?: boolean;        // default false until feature-flagged
     agentProtocolConfig?: AgentProtocolConfig;

     interface AgentProtocolConfig {
       messageBusMode: 'in-process' | 'convex';
       negotiationEnabled: boolean;
       blackboardEnabled: boolean;
       subTeamsEnabled: boolean;
       maxNegotiationRoundsPerTask: number; // default 3; prevents infinite debate loops
       inboxCheckIntervalMs: number;        // default 500ms
       vetoAgents: Partial<Record<AgentName, string[]>>; // agent → topics they can veto
     }
     ```

7. **File structure.** Specify:
   - `src/agents/message-bus.ts` — `AgentMessageBus` interface + in-process implementation
   - `src/agents/message-bus-convex.ts` — Convex-backed implementation for team mode
   - `src/agents/negotiation-engine.ts` — `NegotiationEngine` implementation
   - `src/agents/blackboard.ts` — `SharedBlackboard` interface + in-memory implementation
   - `src/agents/blackboard-convex.ts` — Convex-backed blackboard for team mode
   - `src/agents/sub-team-coordinator.ts` — `SubTeamCoordinator` implementation
   - `src/agents/agent-protocol-types.ts` — all TypeScript interfaces from this spec
   - `src/agents/index.ts` — unified export + Ralph Loop integration helpers
   - `src/agents/agent-protocol.test.ts` — unit tests for message routing, negotiation
     resolution, blackboard reads/writes, sub-team lifecycle

8. **Open questions for the build team.** List 3-5 questions addressing: how to prevent
   message storms when many agents broadcast simultaneously; how the inbox-check interval
   interacts with the ACE iteration limit; how sub-team formation is tested without a real
   multi-agent runtime; and whether the Convex message bus implementation introduces
   latency that degrades the inner loop below acceptable thresholds.

---

### GROK-R13-02: Predictive Task Decomposition with Learning

**The ask:** Nova26's current task decomposition model is reactive: the user writes a PRD,
JUPITER reads it, and decomposes it into tasks by reasoning from scratch. Every new PRD
starts from zero. This is like asking a senior architect to estimate a new project without
letting them look at the last twenty they delivered. The accumulated evidence is there —
in the Taste Vault, in the build history, in the 79 BistroLens patterns — but the
decomposition step ignores it entirely. Predictive decomposition changes the model from
blank-slate reasoning to evidence-based prediction: when a user describes a new project,
the system asks "what does our history say this will look like?" before JUPITER reasons
about it. The analogy: JUPITER with predictive decomposition is like a seasoned project
manager who walks into an estimation meeting with a pre-filled spreadsheet based on every
similar project they have delivered — the reasoning still happens, but the prior is
informed, not empty.

Produce a complete, ready-to-code specification covering:

1. **The big-picture analogy.** One paragraph. Reactive task decomposition is like what
   other professional domain where experts start from scratch every time despite having
   solved nearly identical problems before? The key insight is that most software projects
   are not novel — they are instances of recognizable archetypes (SaaS CRUD app, REST API,
   CLI tool, data pipeline) with well-understood task structures that vary predictably based
   on a small number of parameters (auth required? multi-tenant? real-time updates?). The
   analogy should capture why the value of learning decompositions is not just speed — it is
   the reduction of JUPITER's reasoning errors on the parts of the problem that are not novel.

2. **Core TypeScript interfaces.** Define the full predictive decomposition type system:

   ```typescript
   interface TaskTemplate {
     id: string;
     name: string;                          // 'next-js-saas-with-auth'
     description: string;
     archetypeId: string;                   // links to ProjectArchetype
     version: string;                       // semver; templates evolve
     tasks: TemplateTask[];
     parameters: TemplateParameter[];       // what varies between instances
     applicabilitySignals: string[];        // keywords/phrases that suggest this template applies
     averageTaskCount: number;              // mean tasks per instance
     averageBuildDurationMs: number;
     successRate: number;                   // 0-1: fraction of builds using this template that passed ACE
     usageCount: number;                    // how many builds have been derived from this template
     lastUpdated: string;
     source: 'core' | 'community' | 'learned'; // where this template came from
   }

   interface TemplateTask {
     id: string;
     title: string;
     descriptionTemplate: string;           // can reference {{parameters}} with mustache-style syntax
     agent: AgentName;
     phase: string;
     estimatedDurationMs: number;
     dependsOn: string[];                   // other TemplateTask ids
     optional: boolean;                     // some tasks only appear if a parameter is set
     condition?: string;                    // e.g., 'parameters.authRequired === true'
     tasteVaultRelevance: string[];         // Taste Vault pattern categories this task learns from
   }

   interface TemplateParameter {
     name: string;                          // 'authRequired', 'multiTenant', 'realtimeUpdates'
     type: 'boolean' | 'string' | 'enum';
     description: string;
     defaultValue: unknown;
     options?: string[];                    // for enum types
     impact: 'adds-tasks' | 'modifies-tasks' | 'changes-agent' | 'cosmetic';
   }

   interface ProjectArchetype {
     id: string;
     name: string;                          // 'next-js-saas', 'rest-api', 'cli-tool', 'data-pipeline'
     description: string;
     templates: TaskTemplate[];
     signals: string[];                     // phrases that identify this archetype
     confidence: number;                    // 0-1: how reliable archetype detection is
   }

   interface DecompositionPrediction {
     id: string;
     prdId: string;
     archetypeId: string;
     archetypeConfidence: number;           // 0-1
     templateId: string;
     templateVersion: string;
     detectedParameters: Record<string, unknown>;
     predictedTasks: PredictedTask[];
     estimatedTotalDurationMs: number;
     estimatedComplexity: 'low' | 'medium' | 'high' | 'very-high';
     bestAgentAssignments: Record<string, AgentName>; // templateTask.id → agent
     similarPastBuilds: SimilarBuild[];
     predictionConfidence: number;          // 0-1: overall confidence in this prediction
     generatedAt: string;
     jupiterRefinementRequired: boolean;    // true if confidence < threshold
   }

   interface PredictedTask {
     templateTaskId: string;
     title: string;
     description: string;                  // parameters substituted in
     agent: AgentName;
     phase: string;
     estimatedDurationMs: number;
     dependsOn: string[];
     confidenceOverride?: number;          // if JUPITER adjusts this specific task
   }

   interface SimilarBuild {
     buildId: string;
     prdSimilarity: number;               // 0-1: cosine similarity with nomic-embed-text
     taskCount: number;
     successRate: number;
     buildDurationMs: number;
     keyDifferences: string[];            // what was different about this build
   }
   ```

3. **`PredictiveDecomposer` engine.** Design the core prediction engine:

   ```typescript
   interface PredictiveDecomposer {
     predict(prd: string, projectContext: ProjectContext): Promise<DecompositionPrediction>;
     refine(predictionId: string, jupiterFeedback: JupiterFeedback): Promise<DecompositionPrediction>;
     learn(buildId: string, actualTasks: Task[], outcome: BuildOutcome): Promise<void>;
     getTemplates(archetypeId?: string): Promise<TaskTemplate[]>;
     suggestArchetype(prd: string): Promise<ArchetypeSuggestion[]>;
   }

   interface ProjectContext {
     packageJson?: Record<string, unknown>; // parsed package.json if available
     existingFiles?: string[];              // file paths in the project
     teamSize?: number;
     deadline?: string;
     tasteVaultSummary?: string;            // top patterns from user's vault
   }

   interface JupiterFeedback {
     tasksToAdd: Omit<PredictedTask, 'templateTaskId'>[];
     tasksToRemove: string[];              // templateTaskIds to drop
     tasksToModify: Array<{ templateTaskId: string; changes: Partial<PredictedTask> }>;
     parameterCorrections: Record<string, unknown>;
     confidenceAssessment: number;         // JUPITER's confidence in the overall plan
   }

   interface BuildOutcome {
     success: boolean;
     actualDurationMs: number;
     testPassRate: number;
     aceScore: number;
     tasksAdded: number;                   // tasks JUPITER added that were not predicted
     tasksRemoved: number;                 // tasks JUPITER removed from the prediction
     parameterAccuracy: number;            // 0-1: how many detected parameters were correct
   }

   interface ArchetypeSuggestion {
     archetypeId: string;
     archetypeName: string;
     confidence: number;
     matchingSignals: string[];
   }
   ```

4. **Learning loop.** Design how the system improves with each build:

   The `learn()` method is called after every build completes. It compares the
   `DecompositionPrediction` against the actual `Task[]` that JUPITER produced and the
   `BuildOutcome`. From this comparison, it updates three things:

   - **Template accuracy:** If JUPITER consistently adds or removes the same tasks from a
     template's predictions, the template's `TemplateTask[]` is updated to match.
   - **Parameter detection:** If a parameter was incorrectly detected, the
     `applicabilitySignals` for that parameter are updated (add the missed signal; reduce
     weight of the false-positive signal).
   - **Duration estimates:** Exponential moving average: `newEstimate = 0.7 * oldEstimate
     + 0.3 * actualDuration`. Updates `TemplateTask.estimatedDurationMs`.

   Show the `DecompositionLearning` data model:
   ```typescript
   interface DecompositionLearning {
     id: string;
     buildId: string;
     predictionId: string;
     templateId: string;
     parameterAccuracy: number;
     taskAccuracy: number;                 // fraction of predicted tasks that matched actual
     durationError: number;               // (predicted - actual) / actual, signed
     tasksAddedByJupiter: string[];        // task titles JUPITER added
     tasksRemovedByJupiter: string[];
     parameterErrors: Array<{ parameter: string; predicted: unknown; actual: unknown }>;
     recordedAt: string;
   }
   ```

   Specify:
   - Where is the learning data stored? (Convex `decompositionLearnings` table + local
     `.nova/decomposition-cache/` for offline mode.)
   - How many builds does the system need before predictions are reliable? (Cold start:
     use core templates. After 5 builds of the same archetype: begin blending learned
     adjustments. After 20 builds: predictions should exceed 80% task accuracy for common
     archetypes.)
   - How do Global Wisdom contributions work here? (If a premium user's template
     improvements improve prediction accuracy across 10+ other users' builds, those
     improvements are promoted to the core template via the Global Wisdom Pipeline.
     Same promotion logic as Taste Vault patterns.)

5. **Embedding-based PRD matching.** Design how `nomic-embed-text` powers similarity search:

   ```
   PRD received
     → strip boilerplate (headers, formatting)
     → embed with nomic-embed-text via Ollama: POST /api/embeddings
     → query .nova/build-index/ for top-5 most similar past PRD embeddings (cosine similarity)
     → retrieve associated DecompositionPredictions for those builds
     → blend: weighted average of their task structures (weight by similarity score)
     → return as SimilarBuild[] in DecompositionPrediction
   ```

   Specify:
   - Where is the build embedding index stored? (`.nova/build-index/` — flat files with
     `.npy`-compatible float32 vectors, indexed by buildId. For team mode: Convex vector
     store or a local FAISS index synced to Convex.)
   - How is the index updated? (`learn()` embeds the new PRD and appends to the index
     after each build.)
   - What is the embedding model and dimension? (`nomic-embed-text` via Ollama, 768
     dimensions. Cosine similarity for retrieval.)
   - Show the `BuildEmbeddingIndex` interface:
     ```typescript
     interface BuildEmbeddingIndex {
       add(buildId: string, prdText: string): Promise<void>;
       search(prdText: string, topK: number): Promise<Array<{ buildId: string; similarity: number }>>;
       delete(buildId: string): Promise<void>;
       size(): Promise<number>;
     }
     ```

6. **Integration with JUPITER and the Ralph Loop.** Specify where prediction plugs in:

   The prediction runs before JUPITER's decomposition step. JUPITER receives the prediction
   as structured context and is instructed to refine rather than generate from scratch:

   ```
   User submits PRD
     → PredictiveDecomposer.predict(prd, context)
     → If predictionConfidence >= 0.75: inject prediction into JUPITER's system prompt
       as "Predicted Task Plan (refine, do not ignore)"
     → If predictionConfidence < 0.75: inject as "Suggested Task Plan (treat as weak prior)"
     → JUPITER reasons over the prediction + PRD → returns refined Task[]
     → Ralph Loop executes refined Task[]
     → On completion: PredictiveDecomposer.learn(buildId, actualTasks, outcome)
   ```

   New `RalphLoopOptions` fields:
   ```typescript
   // New in R13:
   predictiveDecompositionEnabled?: boolean;
   predictiveDecompositionConfig?: PredictiveDecompositionConfig;

   interface PredictiveDecompositionConfig {
     confidenceThreshold: number;          // below this, treat as weak prior (default 0.75)
     minBuildsForLearning: number;         // default 5 before blending learned adjustments
     embeddingModel: string;              // default 'nomic-embed-text'
     indexPath: string;                   // default '.nova/build-index'
     globalWisdomEnabled: boolean;        // contribute to cross-user template improvement
     learningEnabled: boolean;            // default true; set false to freeze templates
   }
   ```

7. **File structure.** Specify:
   - `src/decomposition/decomposition-types.ts` — all interfaces from this spec
   - `src/decomposition/predictive-decomposer.ts` — `PredictiveDecomposer` implementation
   - `src/decomposition/archetype-detector.ts` — PRD → archetype classification
   - `src/decomposition/build-embedding-index.ts` — embedding index (local + Convex adapters)
   - `src/decomposition/template-registry.ts` — template storage, versioning, lookup
   - `src/decomposition/decomposition-learner.ts` — `learn()` logic, template update algorithm
   - `src/decomposition/templates/next-js-saas.ts` — core template: Next.js SaaS
   - `src/decomposition/templates/rest-api.ts` — core template: REST API
   - `src/decomposition/templates/cli-tool.ts` — core template: CLI tool
   - `src/decomposition/templates/data-pipeline.ts` — core template: data pipeline
   - `src/decomposition/index.ts` — unified export
   - `src/decomposition/predictive-decomposer.test.ts` — tests for archetype detection,
     parameter extraction, similarity matching, and learning loop convergence

8. **Open questions for the build team.** List 3-5 questions addressing: how to avoid
   template lock-in when a user's projects systematically diverge from archetypes; how
   to handle PRDs that span multiple archetypes (e.g., a SaaS with a CLI companion tool);
   whether the nomic-embed-text embedding index performs acceptably at 500+ builds without
   FAISS or ANN indexing; and how JUPITER communicates back to the prediction system when
   it makes a refinement that differs significantly from the prediction.

---

### GROK-R13-03: Code Understanding & Semantic Search

**The ask:** Nova26's agents currently understand code the way a grep command does —
they can find text, but they cannot understand what it means. Ask Nova26 to "find where
we handle authentication errors" and the agent will search for the string "authentication
error", miss the function called `handleAuthFailure`, and return incomplete results. This
is the difference between a librarian who searches by keyword and one who has read every
book. Semantic code search changes this: the agent encodes the user's intent as a vector,
compares it against an index of every function, class, and file in the codebase (also
encoded as vectors), and retrieves the most semantically relevant results regardless of
naming. Beyond search, a deep code index enables impact analysis ("what breaks if I change
this interface?") and dependency mapping ("what calls this function?"). The analogy:
semantic code understanding is like giving the agents a fully-indexed, cross-referenced
library catalogue versus a pile of loose pages — the content is the same, but the ability
to navigate it is orders of magnitude better.

Produce a complete, ready-to-code specification covering:

1. **The big-picture analogy.** One paragraph. A codebase without a semantic index is like
   what other large information corpus where the content is present but navigation is
   blocked by surface-level structure? The key insight is that code has two layers of
   meaning: the lexical layer (what tokens are present) and the semantic layer (what
   the code does and why). Text search operates at the lexical layer and fails when
   naming conventions are inconsistent or domain terminology varies. The analogy should
   capture why the semantic layer is the correct level of abstraction for developer intent.

2. **Core TypeScript interfaces.** Define the semantic code index type system:

   ```typescript
   interface CodeUnit {
     id: string;                            // stable UUID; stable across renames if content is same
     type: 'function' | 'class' | 'interface' | 'type' | 'variable' | 'module' | 'export';
     name: string;
     filePath: string;
     startLine: number;
     endLine: number;
     signature?: string;                    // for functions/methods: the full signature
     docComment?: string;                   // JSDoc or TSDoc if present
     body: string;                          // the full source text of this unit
     embedding: number[];                   // nomic-embed-text vector (768 dims)
     language: 'typescript' | 'javascript' | 'json' | 'markdown';
     exports: boolean;
     complexity: number;                    // cyclomatic complexity estimate
     lastModified: string;
     tags: string[];                        // inferred: ['auth', 'error-handling', 'async']
   }

   interface SemanticSearchResult {
     unit: CodeUnit;
     similarity: number;                    // 0-1: cosine similarity to query
     matchReason: string;                   // human-readable: 'semantically matches "auth error handling"'
     snippetHighlight: string;              // the most relevant lines from unit.body
   }

   interface ImpactAnalysis {
     targetUnitId: string;
     targetUnit: CodeUnit;
     directCallers: CodeUnit[];             // units that directly call/use the target
     indirectCallers: CodeUnit[];           // units that call callers (depth 2+)
     affectedTests: string[];               // test file paths that cover the target
     affectedTypes: CodeUnit[];             // interfaces/types that reference the target
     riskLevel: 'low' | 'medium' | 'high'; // function of caller count + test coverage
     estimatedChangedFiles: number;
     changeGuidance: string;               // 'update these interfaces first, then callers'
   }

   interface DependencyGraph {
     nodes: DependencyNode[];
     edges: DependencyEdge[];
     entryPoints: string[];                 // file paths that are entry points
     cycles: string[][];                    // arrays of file paths forming cycles
     orphans: string[];                     // files with no imports and no importers
   }

   interface DependencyNode {
     id: string;
     filePath: string;
     type: 'source' | 'test' | 'config' | 'declaration';
     unitCount: number;
     importCount: number;
     exportCount: number;
     complexity: number;
   }

   interface DependencyEdge {
     from: string;                          // DependencyNode.id
     to: string;
     type: 'import' | 'dynamic-import' | 'require' | 're-export';
     symbols: string[];                     // specific exported names imported
   }
   ```

3. **`CodeIndex` — the core engine.** Design the semantic indexing and search system:

   ```typescript
   interface CodeIndex {
     build(projectRoot: string, options?: IndexBuildOptions): AsyncGenerator<IndexProgress>;
     update(changedFiles: string[]): Promise<void>;
     search(query: string, options?: SemanticSearchOptions): Promise<SemanticSearchResult[]>;
     lookupByPath(filePath: string): Promise<CodeUnit[]>;
     lookupByName(name: string, type?: CodeUnit['type']): Promise<CodeUnit[]>;
     analyzeImpact(unitId: string, changeType: ChangeType): Promise<ImpactAnalysis>;
     getDependencyGraph(scope?: string[]): Promise<DependencyGraph>;
     getStats(): CodeIndexStats;
     clear(): Promise<void>;
   }

   interface IndexBuildOptions {
     include: string[];                     // glob patterns: ['src/**/*.ts', '!**/*.test.ts']
     exclude: string[];
     maxFileSizeBytes: number;              // skip files above this size (default 500KB)
     embeddingModel: string;               // default 'nomic-embed-text'
     concurrency: number;                  // parallel embedding requests (default 4)
     incrementalUpdate: boolean;           // skip files unchanged since last index
   }

   interface SemanticSearchOptions {
     topK: number;                          // default 5
     minSimilarity: number;                // default 0.6; below this, results are noise
     types?: CodeUnit['type'][];           // filter by code unit type
     files?: string[];                     // limit search to specific files
     tags?: string[];                      // filter by inferred tags
   }

   type ChangeType = 'signature-change' | 'rename' | 'delete' | 'body-change' | 'move';

   interface IndexProgress {
     phase: 'parsing' | 'embedding' | 'indexing' | 'done';
     filesProcessed: number;
     filesTotal: number;
     unitsIndexed: number;
     currentFile: string;
     estimatedRemainingMs: number;
   }

   interface CodeIndexStats {
     totalFiles: number;
     totalUnits: number;
     indexSizeBytes: number;
     lastBuilt: string;
     lastUpdated: string;
     embeddingModel: string;
   }
   ```

4. **Parser design.** Specify how TypeScript/JavaScript source is parsed into `CodeUnit[]`:

   Use the TypeScript Compiler API (`typescript` npm package) for parsing — not regex, not
   heuristics. This is the only approach that correctly handles complex TypeScript:

   ```
   File read → ts.createSourceFile() → walk AST →
     for each FunctionDeclaration, ClassDeclaration, InterfaceDeclaration,
     TypeAliasDeclaration, VariableDeclaration with export:
       extract: name, signature, docComment, body text, start/end lines
       infer tags: look for domain keywords in name + doc + body
         ('auth', 'error', 'session', 'db', 'api', 'cache', etc.)
   → return CodeUnit[] for this file
   ```

   Specify the tag inference approach:
   ```typescript
   const TAG_SIGNALS: Record<string, string[]> = {
     'auth': ['auth', 'login', 'logout', 'session', 'token', 'credential', 'password'],
     'error-handling': ['error', 'catch', 'throw', 'exception', 'fail', 'reject'],
     'database': ['db', 'query', 'insert', 'update', 'delete', 'schema', 'migration'],
     'api': ['fetch', 'request', 'response', 'endpoint', 'route', 'handler'],
     'cache': ['cache', 'memoize', 'store', 'ttl', 'invalidate'],
     'async': ['async', 'await', 'promise', 'observable', 'stream'],
   };

   function inferTags(unit: Omit<CodeUnit, 'tags' | 'embedding'>): string[]
   ```

5. **Embedding pipeline.** Design the nomic-embed-text integration:

   Each `CodeUnit` is embedded by concatenating:
   ```
   [TYPE: function] [NAME: handleAuthFailure]
   [SIGNATURE: async handleAuthFailure(error: AuthError, ctx: RequestContext): Promise<void>]
   [DOC: Handles authentication failures. Logs the error, clears the session, and redirects.]
   [BODY: first 200 tokens of body]
   [TAGS: auth, error-handling, async]
   ```

   This composite representation gives the embedding model enough context to distinguish
   semantically similar but differently-named functions from each other.

   Specify:
   - Embedding request format: `POST http://localhost:11434/api/embeddings` with
     `{ model: 'nomic-embed-text', prompt: compositeText }`
   - How are embeddings stored? (`.nova/code-index/embeddings.bin` — packed float32 binary
     for fast memory-mapped access; metadata in `.nova/code-index/units.json`)
   - How are embeddings updated incrementally? (On file save: re-parse only the changed
     file, re-embed only the modified `CodeUnit`s, update the index in place.)
   - How is cosine similarity computed? (Pure TypeScript dot-product + magnitude, no BLAS
     dependency. For large codebases (>10K units), use a flat index scan — acceptable at
     this scale. At >50K units, recommend FAISS via WASM or an Ollama embedding server
     with vector search.)

6. **Integration with agents.** Design how agents query the semantic index:

   Agents get a `search_code` tool in their ToolRegistry:

   ```typescript
   interface SearchCodeToolParams {
     query: string;               // natural language: 'where do we handle auth errors'
     topK?: number;              // default 5
     fileFilter?: string[];      // limit to specific paths
     typeFilter?: string[];      // 'function', 'class', etc.
   }

   // Tool result returned to agent:
   // """
   // Semantic code search results for: "where do we handle auth errors"
   //
   // 1. handleAuthFailure (src/auth/error-handler.ts:42) — similarity: 0.91
   //    async handleAuthFailure(error: AuthError, ctx: RequestContext): Promise<void>
   //    [Tags: auth, error-handling, async]
   //    Relevant lines: 42-55
   //
   // 2. onAuthError (src/middleware/auth.ts:118) — similarity: 0.84
   //    ...
   // """
   ```

   Agents also get an `analyze_impact` tool:
   ```typescript
   interface AnalyzeImpactToolParams {
     unitName: string;            // function/interface name
     filePath?: string;           // disambiguate if multiple units share the name
     changeType: ChangeType;
   }
   ```

   Specify:
   - Where are these tools registered? (`src/tools/code-index/search-code-tool.ts`,
     `src/tools/code-index/analyze-impact-tool.ts`)
   - When is the index built? (On project open: `nova26 index` command; also triggered
     automatically when a build starts if the index is absent or >24h stale.)
   - How does the index interact with the blackboard? (After a significant code change,
     the agent writes to the blackboard: `code-index-stale: true`. The next agent that
     reads a stale blackboard entry triggers an incremental index update before querying.)

7. **File structure.** Specify:
   - `src/code-index/code-index-types.ts` — all interfaces from this spec
   - `src/code-index/code-index.ts` — `CodeIndex` implementation
   - `src/code-index/ts-parser.ts` — TypeScript AST parser → `CodeUnit[]`
   - `src/code-index/tag-inferrer.ts` — `TAG_SIGNALS` map, `inferTags()` function
   - `src/code-index/embedding-pipeline.ts` — nomic-embed-text integration, batch embedding
   - `src/code-index/index-storage.ts` — binary storage, metadata JSON, incremental update
   - `src/code-index/dependency-graph-builder.ts` — import/export graph extraction
   - `src/tools/code-index/search-code-tool.ts` — ToolRegistry entry
   - `src/tools/code-index/analyze-impact-tool.ts` — ToolRegistry entry
   - `src/code-index/index.ts` — unified export + CLI command registration
   - `src/code-index/code-index.test.ts` — tests for parsing, embedding, search accuracy,
     impact analysis, incremental update

8. **Open questions for the build team.** List 3-5 questions addressing: how to handle
   generated files (Prisma client, Convex generated types) in the index without polluting
   search results; how the index interacts with the Language Server Protocol if a future
   Nova26 version adds an LSP layer; whether nomic-embed-text produces stable embeddings
   across Ollama version upgrades (re-indexing cost); and how to measure semantic search
   recall to validate that it outperforms grep for developer intent queries.

---

### GROK-R13-04: Adaptive Agent Personality & Communication Style

**The ask:** Every Nova26 agent currently communicates the same way, regardless of who
is on the other end. MARS gives a senior TypeScript engineer the same explanation it gives
a developer who is one month into their first job. This is not intelligence — it is
indifference. The best human collaborators adapt: they read the room, they match the
technical level of the conversation, they know when to give a one-line answer and when
to draw a diagram. Adaptive personality is not about making agents seem human — it is about
making them effective communicators, because effective communication is what converts agent
output into shipped software. The analogy: an agent without personality adaptation is like
a textbook — it contains the right information, but it delivers it the same way to every
reader, regardless of whether they are a PhD or a first-year student. The best agents are
more like great tutors: they contain the same knowledge, but they adjust the delivery to
the person in front of them.

Produce a complete, ready-to-code specification covering:

1. **The big-picture analogy.** One paragraph. Communication style adaptation in AI agents
   is like what other professional skill that requires continuous calibration to an
   audience's needs? The key insight is that the same information can be either clarifying
   or overwhelming depending entirely on how it is delivered — and delivering information
   that cannot be acted upon is equivalent to not delivering it at all. The analogy should
   capture why adaptation is not cosmetic (adjusting tone) but functional (adjusting the
   entire information model to match what the recipient can absorb and apply).

2. **Personality dimensions.** Define the full personality model:

   ```typescript
   interface PersonalityProfile {
     userId: string;
     agentOverrides: Partial<Record<AgentName, AgentPersonality>>;  // per-agent tuning
     defaultPersonality: AgentPersonality;
     detectionConfidence: number;           // 0-1: how confident the system is in this profile
     lastUpdated: string;
     buildCount: number;                    // how many builds have informed this profile
     feedbackCount: number;                 // how many explicit feedback signals
   }

   interface AgentPersonality {
     verbosity: VerbosityLevel;
     formality: FormalityLevel;
     explanationDepth: ExplanationDepth;
     emojiUsage: 'none' | 'minimal' | 'moderate' | 'heavy';
     humorTolerance: 'none' | 'dry' | 'occasional' | 'frequent';
     technicalDensity: TechnicalDensity;
     preferredOutputFormat: 'prose' | 'bullets' | 'code-first' | 'mixed';
     examplesPreference: 'always' | 'when-helpful' | 'rarely';
     progressUpdates: 'silent' | 'minimal' | 'detailed';
   }

   type VerbosityLevel = 'minimal' | 'concise' | 'standard' | 'detailed' | 'exhaustive';
   type FormalityLevel = 'casual' | 'professional' | 'academic';
   type ExplanationDepth = 'result-only' | 'brief-rationale' | 'full-explanation' | 'tutorial';
   type TechnicalDensity = 'plain-english' | 'intermediate' | 'expert' | 'terse-expert';

   interface CommunicationStyle {
     systemPromptAddendum: string;          // injected into agent's system prompt
     outputFormatInstruction: string;       // how to structure the response
     exampleInstruction: string;            // whether/how to include examples
     lengthGuidance: string;               // 'respond in 1-3 sentences' or 'be thorough'
   }
   ```

3. **Dimension defaults per agent.** Define the baseline personality for each class of agent:

   | Agent | Default Verbosity | Default Formality | Default Depth | Rationale |
   |---|---|---|---|---|
   | MARS | concise | professional | result-only | Code output speaks for itself |
   | VENUS | standard | professional | brief-rationale | Design decisions need brief justification |
   | MERCURY | concise | casual | result-only | Utility agent; just get things done |
   | JUPITER | detailed | professional | full-explanation | Plans require thorough justification |
   | SATURN | standard | academic | full-explanation | Architecture decisions need rigor |
   | PLUTO | concise | professional | brief-rationale | Test results are self-evident |
   | ATLAS | minimal | professional | result-only | Storage agent; output is data, not prose |
   | SUN | standard | casual | brief-rationale | Orchestrator should feel accessible |

   Specify the remaining 13 agents following the same rationale-driven approach.

4. **Detection engine.** Design how the system infers user preferences from behavior:

   ```typescript
   interface AdaptationEngine {
     infer(signal: AdaptationSignal): Promise<PersonalityUpdate>;
     apply(agentName: AgentName, profile: PersonalityProfile): CommunicationStyle;
     reset(userId: string, agentName?: AgentName): Promise<void>;
     getProfile(userId: string): Promise<PersonalityProfile>;
     updateExplicit(userId: string, preferences: Partial<AgentPersonality>): Promise<PersonalityProfile>;
   }

   type AdaptationSignal =
     | { type: 'response-truncated'; agentName: AgentName; responseLength: number }
     // User cut off reading — output was too long
     | { type: 'follow-up-simplify'; agentName: AgentName; followUpText: string }
     // User said "can you explain that more simply?"
     | { type: 'follow-up-detail'; agentName: AgentName; followUpText: string }
     // User said "give me more detail" or "explain why"
     | { type: 'positive-feedback'; agentName: AgentName; feedbackText: string }
     // User explicitly expressed satisfaction with a response
     | { type: 'negative-feedback'; agentName: AgentName; feedbackText: string }
     // User explicitly expressed dissatisfaction
     | { type: 'response-reused'; agentName: AgentName }
     // User copied the response directly — it was well-formatted
     | { type: 'response-edited'; agentName: AgentName; editRatio: number }
     // User heavily edited the response (high editRatio = output needed significant rework)
     | { type: 'explicit-preference'; preference: Partial<AgentPersonality> };
     // User ran `nova26 config personality` command

   interface PersonalityUpdate {
     dimension: keyof AgentPersonality;
     oldValue: unknown;
     newValue: unknown;
     confidence: number;
     reason: string;
   }
   ```

   Specify the inference rules — show concrete examples:
   - If `response-truncated` occurs 3+ times in 10 builds: lower `verbosity` by one level.
   - If `follow-up-simplify` occurs 2+ times: lower `technicalDensity` by one level,
     raise `explanationDepth` to `full-explanation`.
   - If `response-edited` with `editRatio > 0.5` occurs 3+ times: infer that the user
     prefers a different `preferredOutputFormat` (try the next format in the rotation:
     prose → bullets → code-first → mixed).
   - If `positive-feedback` contains words like "concise", "brief", "perfect length":
     lock the current `verbosity` (increase its weight in the weighted average).
   - If the user sets an `explicit-preference`: that dimension is pinned and will not be
     updated by implicit signals until the user explicitly resets it.

5. **Prompt injection.** Design how personality feeds into `prompt-builder.ts`:

   ```typescript
   // In prompt-builder.ts, after Taste Vault context injection:
   function buildPersonalityAddendum(style: CommunicationStyle): string {
     return `
   ## Communication Style
   ${style.systemPromptAddendum}
   ${style.outputFormatInstruction}
   ${style.exampleInstruction}
   ${style.lengthGuidance}
   `.trim();
   }
   ```

   Show concrete `CommunicationStyle` objects for three personality profiles:

   **Expert / Terse (senior developer with 10+ years experience):**
   ```
   systemPromptAddendum: "The user is a senior TypeScript engineer. Omit basic explanations.
     Use precise technical terminology without definition. Skip the 'why' unless it is
     non-obvious. Lead with the result, not the approach."
   outputFormatInstruction: "Prefer code blocks over prose. If prose is required, use
     bullet points. No more than 150 words of prose per response."
   exampleInstruction: "Only include examples if the concept is genuinely novel."
   lengthGuidance: "Be terse. One correct answer beats three options with qualifications."
   ```

   **Standard / Balanced (intermediate developer):**
   ```
   systemPromptAddendum: "Provide brief rationale for non-obvious decisions. Use technical
     terms but define acronyms on first use. Balance code examples with explanation."
   outputFormatInstruction: "Use a mix of prose and code blocks. Structure multi-step
     responses with numbered steps."
   exampleInstruction: "Include a short example for any new API or pattern."
   lengthGuidance: "Be thorough but not exhaustive. Aim for 200-400 words for complex topics."
   ```

   **Beginner / Tutorial (developer new to the tech stack):**
   ```
   systemPromptAddendum: "Assume limited familiarity with TypeScript and the Nova26 stack.
     Explain the 'why' before the 'how'. Use analogies for abstract concepts. Avoid jargon;
     define technical terms when they are unavoidable."
   outputFormatInstruction: "Use numbered steps for any multi-step process. Use headers to
     organize longer responses. Code blocks must be complete and runnable."
   exampleInstruction: "Always include a concrete example, even for straightforward concepts."
   lengthGuidance: "Be thorough. Brevity is not valuable if it creates confusion."
   ```

6. **Taste Vault integration.** Design how communication preferences are stored:

   Communication preferences are first-class Taste Vault nodes, alongside code quality
   patterns. This means they benefit from the same similarity matching, Global Wisdom
   promotion, and cross-project persistence:

   ```typescript
   interface CommunicationPreferencePattern {
     type: 'communication-preference';
     agentName: AgentName;
     dimension: keyof AgentPersonality;
     preferredValue: unknown;
     evidenceCount: number;              // how many signals contributed to this preference
     confidence: number;
     lastReinforced: string;
   }
   ```

   Specify:
   - How does Global Wisdom use communication preferences? (Communication preferences are
     NOT promoted to Global Wisdom — they are inherently personal, not team-wide. This is
     a deliberate privacy boundary: how someone prefers to receive information should not
     inform how other users receive information.)
   - What is the privacy model? (Communication preferences are local-only by default. In
     team mode, a team administrator can set team-wide defaults, which individual members
     can override. No individual preference data leaves the local machine.)
   - How does the system prevent over-adaptation? (Each dimension has a `stability`
     counter. After 3 consistent signals in the same direction, the dimension is considered
     stable and requires 2 counter-signals to shift in the opposite direction. This prevents
     a single bad build from reversing a well-established preference.)

7. **The ethics boundary.** Define explicitly what adaptation is and is not:

   **Adaptation is:**
   - Adjusting verbosity, format, technical density, and explanation depth
   - Responding to explicit user preferences
   - Improving signal-to-noise ratio for the individual user

   **Adaptation is not:**
   - Omitting information the user needs but has not asked for (e.g., a security warning
     must be communicated regardless of verbosity preference)
   - Adjusting the factual content of responses based on inferred user beliefs
   - Creating the impression of a relationship that does not exist (the agent does not
     "remember" the user between sessions in a personal way — it applies a profile)
   - Adapting based on inferred demographic characteristics (only build behavior signals,
     never demographic inference)

   These constraints must be enforced at the `AdaptationEngine` level, not just as
   guidelines. Show the `SafetyOverrides` interface:
   ```typescript
   interface SafetyOverrides {
     alwaysInclude: string[];            // categories of information always communicated
     neverOmit: ('security-warnings' | 'data-loss-warnings' | 'breaking-changes')[];
     demoographicAdaptationBlocked: true; // compile-time constant; not configurable
   }
   ```

8. **File structure.** Specify:
   - `src/personality/personality-types.ts` — all interfaces from this spec
   - `src/personality/adaptation-engine.ts` — `AdaptationEngine` implementation
   - `src/personality/signal-processor.ts` — maps `AdaptationSignal` → `PersonalityUpdate`
   - `src/personality/style-builder.ts` — `AgentPersonality` → `CommunicationStyle`
   - `src/personality/personality-store.ts` — local storage + Convex sync adapter
   - `src/personality/default-personalities.ts` — baseline `AgentPersonality` for all 21 agents
   - `src/personality/safety-overrides.ts` — `SafetyOverrides` constants and enforcement
   - `src/personality/index.ts` — unified export + prompt-builder.ts integration point
   - New `RalphLoopOptions` fields:
     ```typescript
     // New in R13:
     adaptivePersonalityEnabled?: boolean;
     adaptivePersonalityConfig?: AdaptivePersonalityConfig;

     interface AdaptivePersonalityConfig {
       detectionEnabled: boolean;          // infer preferences from signals (default true)
       globalWisdomContribution: false;    // always false; privacy non-negotiable
       explicitPreferenceCommand: boolean; // expose `nova26 config personality` (default true)
       stabilityThreshold: number;         // signals before dimension is considered stable (default 3)
     }
     ```
   - `src/personality/personality.test.ts` — tests for signal processing, style generation,
     safety override enforcement, and preference stability

9. **Open questions for the build team.** List 3-5 questions addressing: how to handle
   conflicting signals within a single build (user asked for more detail early, then seemed
   frustrated by long responses later); how to communicate to the user what personality
   profile the system has inferred without being creepy about it; whether per-agent
   personality overrides create inconsistency that confuses users who expect coherent
   cross-agent behavior; and how to test personality adaptation in CI without human raters.

---

### GROK-R13-05: Offline-First Architecture & Edge Computing

**The ask:** Nova26's local-first promise is its most powerful differentiator and its most
demanding engineering challenge. "Local-first" is not just a marketing claim — it is a
specific architectural commitment: the system must work fully and correctly with zero
internet connectivity, and connectivity must be treated as an enhancement rather than a
requirement. Today, Nova26's Convex dependency means that losing internet is losing
functionality. The offline-first architecture described here inverts this: Convex is the
sync layer, not the source of truth. The source of truth is always local. The analogy:
the current architecture is like a city that gets its water from a central reservoir —
efficient, but a broken pipe leaves everyone without water. The offline-first architecture
is like a city where every building has a full cistern and the reservoir is used only to
keep cisterns topped off — the pipe can break and daily life continues uninterrupted.

Produce a complete, ready-to-code specification covering:

1. **The big-picture analogy.** One paragraph. Designing an offline-first system is like
   designing what other resilient infrastructure where the failure case (no connectivity)
   must be the normal case rather than the exception? The key insight is that optimizing
   for connectivity as the normal case and offline as the exception produces a fundamentally
   different architecture than optimizing for offline as the primary mode and connectivity
   as an enhancement. The right analogy should capture why the architectural choices made
   when offline is primary produce a more resilient system even when connectivity is
   available — not just when it is absent.

2. **Offline Taste Vault.** Design the fully local Taste Vault:

   The Taste Vault must provide 100% of its core functionality with zero Convex connection.
   Global Wisdom (cross-user pattern aggregation) is the only feature that requires
   connectivity, and it degrades gracefully to "local vault only" when offline.

   ```typescript
   interface OfflineStore<T> {
     get(id: string): Promise<T | null>;
     getAll(filter?: Partial<T>): Promise<T[]>;
     put(id: string, value: T): Promise<void>;
     delete(id: string): Promise<void>;
     query(index: string, value: unknown): Promise<T[]>;
     transaction(ops: StoreOperation<T>[]): Promise<void>;
     getChangesSince(timestamp: string): Promise<OfflineChange<T>[]>;
     getLastSyncTimestamp(): Promise<string | null>;
   }

   interface OfflineChange<T> {
     id: string;
     type: 'put' | 'delete';
     value?: T;
     timestamp: string;
     vectorClock: VectorClock;
   }

   interface VectorClock {
     [nodeId: string]: number;            // nodeId = local device ID
   }

   type StoreOperation<T> =
     | { op: 'put'; id: string; value: T }
     | { op: 'delete'; id: string }
     | { op: 'conditional-put'; id: string; value: T; ifVersion: string };
   ```

   Specify:
   - What is the local storage backend? (SQLite via `better-sqlite3` for structured data;
     flat files for embeddings and large blobs. SQLite provides ACID transactions, which
     are critical for the Taste Vault's integrity guarantees.)
   - How does the `OfflineStore` map to the existing Convex tables? (One `OfflineStore`
     per Convex table: `patterns`, `builds`, `tasks`, `learnings`, `executions`. Each
     local store is the authoritative source; Convex is the sync target.)
   - How does the offline Taste Vault handle similarity search? (Local nomic-embed-text
     via Ollama, same as the online case. The embedding index lives in
     `.nova/code-index/` and is fully local. Zero cloud dependency for semantic search.)

3. **Sync engine.** Design the reconnection sync protocol:

   ```typescript
   interface SyncEngine {
     sync(tables: SyncableTable[]): Promise<SyncResult>;
     push(table: SyncableTable, changes: OfflineChange<unknown>[]): Promise<PushResult>;
     pull(table: SyncableTable, since: string): Promise<PullResult>;
     getStatus(): ConnectivityState;
     onConnectivityChange(handler: (state: ConnectivityState) => void): Unsubscribe;
     getPendingChanges(): Promise<Record<string, number>>;  // table → pending change count
   }

   type SyncableTable = 'patterns' | 'builds' | 'tasks' | 'learnings';

   interface SyncResult {
     tablesSync: Record<SyncableTable, TableSyncResult>;
     durationMs: number;
     conflictsResolved: number;
     conflictsEscalated: number;
     networkError?: string;
   }

   interface TableSyncResult {
     pushed: number;
     pulled: number;
     conflicts: ConflictRecord[];
     status: 'success' | 'partial' | 'failed';
   }

   interface PushResult {
     accepted: number;
     rejected: number;
     conflicts: ConflictRecord[];
   }

   interface PullResult {
     records: OfflineChange<unknown>[];
     serverTimestamp: string;
   }

   interface ConnectivityState {
     online: boolean;
     convexReachable: boolean;
     ollamaReachable: boolean;
     lastSuccessfulSync?: string;        // ISO timestamp
     pendingChanges: number;             // total offline changes not yet synced
     syncInProgress: boolean;
   }
   ```

4. **Conflict resolution.** Design the CRDT-based merge strategy:

   The core question: if the user modified a pattern offline, and Global Wisdom updated
   the same pattern while offline, which version wins when reconnecting?

   Nova26's answer: a hybrid strategy that uses the type of data to determine the merge
   approach.

   ```typescript
   type MergeStrategy =
     | 'last-write-wins'         // for scalar fields: timestamps decide
     | 'union-merge'             // for sets/arrays: combine all unique elements
     | 'local-wins'              // for user-authored content: local is authoritative
     | 'remote-wins'             // for Global Wisdom: remote is authoritative
     | 'manual-resolution';      // neither wins; present both to user

   interface ConflictRecord {
     id: string;
     table: SyncableTable;
     recordId: string;
     localVersion: OfflineChange<unknown>;
     remoteVersion: OfflineChange<unknown>;
     strategyApplied: MergeStrategy;
     resolution?: unknown;               // the merged result if auto-resolved
     requiresUserInput: boolean;
     createdAt: string;
   }

   interface ConflictResolver {
     resolve(conflict: ConflictRecord): Promise<unknown>;
     getStrategy(table: SyncableTable, field: string): MergeStrategy;
     escalateToUser(conflictId: string): Promise<void>;
   }
   ```

   Define the merge strategy per table and field type:

   | Table | Field | Strategy | Rationale |
   |---|---|---|---|
   | `patterns` | `content` | `local-wins` | User's own pattern text is authoritative |
   | `patterns` | `qualityScore` | `last-write-wins` | Quality is computed, not authored |
   | `patterns` | `tags` | `union-merge` | More tags = more findable; never remove |
   | `builds` | any | `local-wins` | Build history is immutable; local is canonical |
   | `learnings` | `insight` | `local-wins` | User-specific learning; remote irrelevant |
   | `learnings` | `globalPromotion` | `remote-wins` | Promotion decision belongs to Global Wisdom |
   | `tasks` | `output` | `local-wins` | Task output is produced locally |

   Specify:
   - How are CRDTs used? (Nova26 uses a simplified CRDT approach: vector clocks for
     ordering, union-merge for sets, last-write-wins for scalars with explicit `local-wins`
     and `remote-wins` overrides per field. Full CRDT libraries like `yjs` or `automerge`
     are not used — the data model is simple enough that a bespoke implementation is
     smaller and more auditable.)
   - When is `manual-resolution` triggered? (When `local-wins` and `remote-wins` conflict
     on the same field AND both were modified within the same 30-minute window. Show the
     CLI prompt: `nova26 sync --resolve` opens an interactive conflict resolution session.)

5. **Progressive enhancement model.** Design the feature availability matrix:

   | Feature | Offline | Convex Online | Full Connectivity |
   |---|---|---|---|
   | Run builds | Full | Full | Full |
   | Taste Vault (local) | Full | Full | Full |
   | ACE loop | Full | Full | Full |
   | Semantic code search | Full (local index) | Full | Full |
   | Skills execution | Full | Full | Full |
   | Global Wisdom reads | Cached only | Full | Full |
   | Global Wisdom writes (pending) | Queued locally | Full | Full |
   | Weekly Studio Report | Local estimate | Full (Convex data) | Full |
   | Real-time collaboration | Unavailable | Full | Full |
   | Agent-to-agent protocol | In-process only | Full | Full |
   | Context7 doc fetch | Disk cache only | Disk cache only | Full (live fetch) |
   | Plugin marketplace | Installed only | Full | Full |

   Specify:
   - How does the CLI communicate current connectivity state to the user?
     (`nova26 status` shows: `Connectivity: OFFLINE | Convex: UNREACHABLE | Ollama: OK |
     Pending sync: 14 changes`.)
   - How does the UI surface degraded features? (In any output that relies on a degraded
     feature, the agent adds a note: `[Note: Global Wisdom is offline. This recommendation
     is based on your local vault only. It will improve when connectivity is restored.]`)
   - How does the system detect connectivity? (Ping Convex every 30 seconds via a
     lightweight `HEAD` request to the Convex deployment URL. Ping Ollama via `GET
     http://localhost:11434/api/tags`. Cached result for 10 seconds to avoid overhead.)

6. **Edge computing model.** Design the zero-cloud-dependency mode:

   In edge mode, all Nova26 features run on local hardware with no cloud dependencies
   at all — not even Convex. This mode is for maximum privacy (air-gapped environments,
   classified projects) and maximum performance (no network latency anywhere in the loop).

   ```typescript
   interface EdgeModeConfig {
     enabled: boolean;
     ollamaHost: string;              // default 'http://localhost:11434'
     localStoragePath: string;        // default '~/.nova26/'
     disableConvex: boolean;          // if true, no Convex calls at any point
     disableContext7: boolean;        // if true, no external doc fetches
     disableGlobalWisdom: boolean;    // if true, no cross-user aggregation
     disableAnalytics: boolean;       // if true, no telemetry at all
     auditLog: boolean;               // if true, log all agent actions locally for compliance
   }
   ```

   Specify:
   - What features are unavailable in edge mode? (Real-time collaboration, Global Wisdom,
     Context7 live docs, Skills Marketplace browsing, Studio Report emails. Everything
     else works fully.)
   - How is edge mode activated? (`nova26 config set edgeMode true` or environment variable
     `NOVA26_EDGE_MODE=1`. Edge mode config is stored in `~/.nova26/config.json`, not the
     project directory, so it persists across projects.)
   - How does edge mode interact with the Taste Vault? (The Taste Vault operates fully
     locally in SQLite. Global Wisdom writes are queued to a local `pending-global-wisdom.json`
     file. When edge mode is disabled, queued contributions are uploaded.)
   - What is the recommended hardware spec for edge mode? (Minimum: Apple M2 or equivalent
     with 16GB RAM for `llama3.2:8b`. Recommended: M3 Pro / AMD Ryzen 9 with 32GB RAM for
     `qwen2.5-coder:32b`. VRAM-equipped GPU (NVIDIA RTX 3080+) significantly improves
     throughput for large models.)

7. **Sync engine design: technical deep dive.** Specify the sync algorithm:

   ```
   ON RECONNECT:
   1. Pull remote changes since lastSyncTimestamp (per table)
   2. For each pulled change:
      a. Look up local version by recordId
      b. If no local version: apply remote change directly (new record)
      c. If local version exists and was NOT modified offline: apply remote change
      d. If local version was modified offline: invoke ConflictResolver
   3. Push all local changes since lastSyncTimestamp (per table)
      a. For each pushed change: server validates and accepts or returns conflict
      b. Server conflicts: resolve locally and retry
   4. Update lastSyncTimestamp to now
   5. Write sync summary to blackboard: 'sync-complete: {pushed: N, pulled: M, conflicts: K}'

   ON WRITE (offline):
   1. Write to local SQLite immediately (synchronous for ACID guarantees)
   2. Append to pending-changes queue (OfflineChange with VectorClock)
   3. If online: attempt immediate sync (non-blocking)
   4. If offline: queue for next reconnect

   SYNC FREQUENCY (when online):
   - patterns: sync every 5 minutes
   - builds: sync on build completion
   - tasks: sync on task completion
   - learnings: sync every 15 minutes
   ```

8. **File structure.** Specify:
   - `src/offline/offline-store.ts` — `OfflineStore` interface + SQLite implementation
   - `src/offline/offline-store-sqlite.ts` — SQLite backend (better-sqlite3)
   - `src/offline/sync-engine.ts` — `SyncEngine` implementation
   - `src/offline/conflict-resolver.ts` — `ConflictResolver`, merge strategies per field
   - `src/offline/connectivity-monitor.ts` — `ConnectivityState` polling, event emission
   - `src/offline/vector-clock.ts` — `VectorClock` utilities (increment, compare, merge)
   - `src/offline/edge-mode.ts` — `EdgeModeConfig`, activation, feature gate enforcement
   - `src/offline/pending-queue.ts` — offline change queue, persistence, replay
   - `src/offline/index.ts` — unified export + RalphLoop integration
   - New `RalphLoopOptions` fields:
     ```typescript
     // New in R13:
     offlineFirstEnabled?: boolean;         // default true when convexSync is true
     offlineConfig?: OfflineFirstConfig;
     edgeModeEnabled?: boolean;
     edgeConfig?: EdgeModeConfig;

     interface OfflineFirstConfig {
       localStorageBackend: 'sqlite' | 'memory';  // memory for testing
       syncIntervalMs: number;                     // default 300000 (5 min)
       conflictEscalationEnabled: boolean;         // default true
       pendingQueuePath: string;                   // default '.nova/pending-sync.json'
       maxPendingChanges: number;                  // warn user if exceeded (default 10000)
     }
     ```
   - `src/offline/offline.test.ts` — tests for offline write/read, sync on reconnect,
     conflict resolution for all strategy types, vector clock merging, edge mode feature gates

9. **Open questions for the build team.** List 3-5 questions addressing: how to handle
   SQLite database corruption in edge mode (backup strategy, integrity checks); whether
   `better-sqlite3` is acceptable for all target platforms (Windows WSL, Linux, macOS —
   check native binary compatibility); how the sync engine handles very large offline
   sessions (10,000+ pending changes accumulated over a week of offline development);
   and whether Global Wisdom contributions made offline and later synced are subject to
   the same review/filtering pipeline as online contributions, or whether they bypass it
   and require additional safeguards.

---

## Output Format

- Label each section clearly: `## GROK-R13-01`, `## GROK-R13-02`, etc.
- Begin each deliverable with the big-picture analogy paragraph before any technical content.
- Use TypeScript for all interfaces and method signatures.
- Use ASCII or prose for flow diagrams — no image dependencies.
- Reference real Nova26 file paths where applicable:
  - `src/orchestrator/ralph-loop.ts`
  - `src/orchestrator/prompt-builder.ts`
  - `src/agent-loop/agent-loop.ts`
  - `src/tools/` (tool registry patterns)
  - `convex/schema.ts`
  - `convex/atlas.ts`
- Each deliverable must be independently useful — a developer picking up GROK-R13-03
  should not need to read R13-01 first.
- Estimated output: 2,500-4,000 words per deliverable, 12,500-20,000 words total.

---

## Reference: Key Nova26 Types

For accuracy, here are the core types from `src/types/index.ts` that your specs should
build on or extend:

```typescript
// Agent names in the system
type AgentName = 'MARS' | 'VENUS' | 'MERCURY' | 'JUPITER' | 'SATURN' | 'PLUTO'
  | 'NEPTUNE' | 'URANUS' | 'EARTH' | 'IO' | 'GANYMEDE' | 'EUROPA' | 'CALLISTO'
  | 'TITAN' | 'ENCELADUS' | 'MIMAS' | 'TRITON' | 'CHARON' | 'ANDROMEDA'
  | 'ATLAS' | 'SUN';

// Task structure (used throughout ralph-loop.ts and prompt-builder.ts)
interface Task {
  id: string;
  title: string;
  description: string;
  agent: string;
  phase: string;
  status: 'pending' | 'ready' | 'running' | 'done' | 'failed';
  dependencies: string[];
  attempts: number;
  output?: string;
  todos?: TodoItem[];
  currentTodoId?: string;
}

// The autonomy spectrum
type AutonomyLevel = 1 | 2 | 3 | 4 | 5;

// Ralph Loop options (cumulative from R1-R12; R13 adds are noted inline per deliverable)
interface RalphLoopOptions {
  parallelMode?: boolean;
  concurrency?: number;
  autoTestFix?: boolean;
  maxTestRetries?: number;
  planApproval?: boolean;
  eventStore?: boolean;
  sessionMemory?: boolean;
  gitWorkflow?: boolean;
  costTracking?: boolean;
  budgetLimit?: number;
  convexSync?: boolean;
  agenticMode?: boolean;
  autonomyLevel?: AutonomyLevel;
  acePlaybooks?: boolean;
  rehearsalStage?: boolean;
  similarityEngine?: boolean;
  modelRouting?: boolean;
  pluginAgents?: boolean;
  teamVault?: boolean;
  ciMode?: boolean;
  predictiveAnalytics?: boolean;
  onboardingMode?: boolean;
  checkpointing?: boolean;
  gracefulDegradation?: boolean;
  agentPooling?: boolean;
  llmResponseCache?: boolean;
  migrationCheck?: boolean;
  visionEnabled?: boolean;
  visionModel?: string;
  screenshotEnabled?: boolean;
  diagramGeneration?: boolean;
  voiceEnabled?: boolean;
  speechConfig?: SpeechConfig;
  knowledgeGraphEnabled?: boolean;
  projectGenEnabled?: boolean;
  projectPlanId?: string;
  phaseId?: string;
  context7Enabled?: boolean;
  context7Config?: Context7Config;
  skillsEnabled?: boolean;
  skillsConfig?: SkillsConfig;
  // New in R13: see individual deliverable specs
}
```

---

## Coordination Note

All five R13 deliverables target new source directories with no conflicts against existing code:

- GROK-R13-01 targets `src/agents/` — message bus, blackboard, sub-team coordinator
- GROK-R13-02 targets `src/decomposition/` — predictive decomposer, templates, learner
- GROK-R13-03 targets `src/code-index/` and `src/tools/code-index/` — semantic search engine
- GROK-R13-04 targets `src/personality/` — adaptation engine, style builder, signal processor
- GROK-R13-05 targets `src/offline/` — offline store, sync engine, conflict resolver

Each deliverable adds new optional fields to `RalphLoopOptions`. These additions are purely
additive — no modification of existing fields. All new Convex tables (if any) must be
specified as explicit additions to `convex/schema.ts`. The existing tables (`builds`,
`tasks`, `executions`, `patterns`, `agents`, `companyAgents`, `learnings`, `userEngagement`,
`churnRisk`) must not be modified.

For R13-05 (Offline-First): the offline store wraps and eventually syncs to Convex. It
does not replace Convex for team features. The local SQLite database path is
`~/.nova26/local.db` (user-level, not project-level), so it persists across projects and
survives `git clean`.

---

*Prompt issued by Claude Code on 2026-02-18. Grok R13 output should be delivered to
`.nova/output/` or committed directly to the `grok/r13` branch for coordinator review.*
