# GROK-R16: Nova26 Category-Creating Frontier Research Prompt

> Assigned to: Grok
> Round: R16 (post-R15)
> Date issued: 2026-02-18
> Status: Active

---

## Context Brief

Nova26 is a 21-agent AI-powered IDE built with TypeScript, Ollama, and Convex. The 21 agents
are named after celestial bodies (MARS, VENUS, MERCURY, JUPITER, SATURN, PLUTO, ATLAS, etc.)
and operate through a core execution engine called the Ralph Loop (`src/orchestrator/ralph-loop.ts`),
which drives a Generator -> Reflector -> Curator cycle (ACE) for iterative quality improvement.

**Current state of the build:**
- R1-R15 covered: core architecture, Taste Vault, Global Wisdom, ACE, Rehearsal, Security,
  Performance, Plugins, Teams, CI/CD, Analytics, Onboarding, Multi-Modal, Voice, Benchmarks,
  Graph Viz, Autonomous Projects, Context7, Superpowers, Retention, Revenue, Community,
  Agent Communication, Predictive Decomposition, Semantic Search, Adaptive Personality,
  Offline-First, Documentation, CLI Polish, Launch Readiness, Growth Playbook, Brand Identity,
  Security Auditing, Database Design, Multiplayer Editing, Natural Language Programming,
  Self-Healing Codebase.
- Kimi's frontier sprint is finishing: agent communication, semantic search, predictive
  decomposition, adaptive personality, offline-first.
- Kiro completed KIRO-03: 104 pattern nodes + 93 edges in the unified manifest.
- 1445+ tests passing, 0 TypeScript errors.
- Premium pricing: $299/month. Local-first with Ollama.

**R16 mission:** Fifteen rounds is an extraordinary body of work. R1-R15 built Nova26 from
raw architecture to a 2027 product roadmap — security, database design, multiplayer, natural
language programming, self-healing. R16 goes further still: into territory that does not exist
in ANY current AI coding tool. Not a better version of something that exists. Not a logical
extension of what Nova26 already does. The features in R16 are the ones that make competing
products look at Nova26 and have to rethink their roadmap from scratch.

Each deliverable must feel genuinely category-creating. Ask: "If a senior engineer at a
competing AI IDE team read this spec, would they be uncomfortable?" If the answer is no,
the spec is not ambitious enough. Think about what no one has built yet. Think about the
human side of software development — the parts that tools have always ignored. Think about
what creates the kind of loyalty that survives a price increase.

**Your style:** Open each deliverable with a tight, concrete analogy that makes the challenge
click in one paragraph — the kind of analogy that makes a senior engineer pause and say
"hm, I hadn't thought about it that way." Then go deep: concrete TypeScript interfaces,
integration points with named agents (MERCURY, PLUTO, SATURN, etc.), rationale for design
decisions, and honest analysis of the hardest implementation problems. Every spec must be
independently actionable. Vague vision documents are not acceptable — specific, buildable
outputs only.

---

## Deliverables

Label each section clearly: GROK-R16-01, GROK-R16-02, etc.

---

### GROK-R16-01: Cross-Project Intelligence & Portfolio Learning

**The analogy:** A great financial advisor does not evaluate each of your investments in
isolation — they look at your entire portfolio, notice that you have too much exposure to
one sector, remember that you bought a similar position three years ago and it underperformed,
and ask you whether this new investment is a conscious choice or an accident of inattention.
Most AI coding tools evaluate each project as if it exists in a vacuum. But developers are
not one-project creatures. Jon has built twelve dashboards. He has a preferred auth pattern
that he reinvents slightly differently every time. He solved a particularly tricky pagination
problem in Project D in a way that would save him two hours if he applied it to the project
he is starting today. No tool knows this. Nova26 can.

Produce a complete specification for Nova26's cross-project intelligence layer covering:

1. **Portfolio model architecture.** Define how Nova26 tracks and relates projects over time:

   - The `Portfolio` record: a local-first, persistent record of every project Nova26 has
     touched. Stored in a portfolio manifest at `~/.nova/portfolio.json`, not inside any
     individual project — this is user-level, not project-level. Define what metadata is
     captured per project: name, path, primary language, framework, last build date, ACE
     score history, Taste Vault pattern count, project type (dashboard, API, CLI, mobile,
     full-stack), and a vector embedding of the project's semantic fingerprint.
   - Project fingerprinting: define the algorithm for computing a project's "semantic
     fingerprint" — a vector embedding that captures the project's architectural shape,
     not its code verbatim. The fingerprint should be computable without sending code to
     any external service (purely local, using the existing Ollama embedding model). Specify
     the input to the embedding: a structured summary of the project's key files, patterns,
     dependencies, and architecture decisions, capped at 2,000 tokens.
   - Portfolio update triggers: the portfolio manifest updates after every successful build
     completion. The update is fast (sub-200ms) and non-blocking — it runs as a background
     task after the build summary is written.
   - ATLAS's expanded role: ATLAS (the memory agent) is the natural owner of the portfolio.
     Extend ATLAS's responsibilities to include portfolio manifest read/write, similarity
     queries across projects, and cross-project insight generation. Define the new ATLAS
     task types that support portfolio intelligence.

2. **Portfolio-level pattern detection.** Define what patterns Nova26 detects across projects:

   - Personal idiom extraction: "Every time Jon builds a dashboard, he uses this exact
     auth pattern." Define the detection algorithm — after N projects (suggest: 3+) share
     a structural pattern, that pattern is promoted from project-specific to personal idiom
     and flagged in the Taste Vault with a `scope: 'portfolio'` tag. Specify N and the
     minimum similarity threshold for promotion.
   - Pattern evolution tracking: when a pattern appears in multiple projects but evolves
     across them (Project A version, Project B improved version, Project C best version),
     Nova26 should track the lineage. "You've refined this auth pattern 3 times. Project C
     has your best version." Define the `PatternLineage` type that captures this evolution.
   - Anti-pattern detection: patterns that appear in multiple projects AND correlate with
     low ACE scores or bug reports are portfolio-level anti-patterns. "You've used this
     error-handling approach in 4 projects. In 3 of them, it contributed to low test
     coverage scores." Define how the correlation is computed.
   - The Taste Vault connection: the Taste Vault already stores per-project patterns. The
     portfolio layer adds a cross-project index — a second-level Taste Vault that indexes
     patterns across all projects. Define how the cross-project index extends the existing
     `patterns` Convex table without modifying its schema (new table vs. additional fields).

3. **Cross-project refactoring proposals.** Define the "you did this better in Project B" feature:

   - Detection: when VENUS (code quality agent) reviews code in Project A, it queries the
     portfolio for similar code across all other projects. If a similar function in Project
     B scores higher on quality metrics (ACE score, test coverage, complexity), VENUS
     surfaces a cross-project suggestion.
   - The proposal format: "In `project-b/src/auth/session.ts` (built 3 months ago), you
     solved this same problem with a pattern that scored 94 on quality vs. this version's
     71. Want to see the diff?" Define the `CrossProjectSuggestion` type with the source
     project, source file, quality delta, and a human-readable explanation.
   - Upgrade flow: if the user accepts, Nova26 extracts the better pattern from Project B
     (accounting for naming differences, dependency differences, and project-specific
     context), adapts it to the current project's conventions, and proposes the change as
     a diff. This is a multi-step operation — specify the adaptation pipeline: extract,
     normalize (remove project-specific names/paths), contextualize (adapt to current
     project's naming and imports), propose.
   - Privacy boundary: cross-project refactoring only reads from the user's own projects.
     It must never read from another user's projects, even if Global Wisdom is enabled.
     Global Wisdom shares anonymized pattern vectors, not code. Define the data flow that
     enforces this boundary.

4. **Project similarity detection.** Define the "you've built this before" feature:

   - Trigger: when the user starts a new project (`nova26 init` or when JUPITER begins
     decomposing a new PRD), Nova26 computes the new project's preliminary fingerprint
     and queries the portfolio for similar projects.
   - Similarity scoring: cosine similarity between project fingerprints. Define the
     threshold for surfacing a similarity alert (suggest: 0.70+). Define what "similar"
     means at different thresholds: 0.70-0.80 = architecturally similar; 0.80-0.90 =
     very similar approach; 0.90+ = essentially the same project type.
   - The "head start" offer: when similarity is detected, Nova26 offers to pre-load
     relevant patterns from the similar project into the Taste Vault for the new project.
     The user can accept all, review and select, or decline. Define the selection UX in
     a terminal context (numbered list, multi-select).
   - Time decay: similarity to a project built 2 years ago is less useful than similarity
     to one built 3 months ago, because the user's skills and preferences have evolved.
     Define a recency weighting in the similarity score — projects within 90 days are
     weighted at 1.0; projects 90-365 days old are weighted at 0.8; projects over a year
     old are weighted at 0.6.

5. **Portfolio health dashboard.** Define the `nova26 portfolio status` output and what
   it communicates:

   - Metrics surfaced: total projects, active projects (built in last 30 days), total
     builds across all projects, total patterns in the personal Taste Vault, portfolio-level
     ACE score trend (is the user getting better over time?), most-used frameworks and
     patterns, and a "skill growth" indicator that shows which capabilities have improved
     most across projects.
   - The skill growth model: define how Nova26 infers skill growth from portfolio data.
     "Your test coverage has improved from 62% average (first 5 projects) to 84% average
     (last 5 projects). Your complexity scores have also improved." This is not just
     metrics — it is evidence that Nova26 is making the user a better developer.
   - Project health overview: a table of all portfolio projects with their current health
     scores (from the R15-05 self-healing integration), last activity, and a status
     indicator (active, stale, archived).
   - Write a complete worked example of the `nova26 portfolio status` terminal output,
     following the same formatting style as the `nova26 health status` output defined in
     R15-05. Make it specific — include realistic project names, dates, and scores.

6. **Privacy architecture.** Define the privacy model precisely:

   - Local-first guarantee: the portfolio manifest (`~/.nova/portfolio.json`) never leaves
     the user's machine unless they explicitly opt in to Global Wisdom. Define the code path
     that enforces this — the portfolio manifest is read only by local Nova26 processes and
     never passed to Convex sync or any network call.
   - Global Wisdom opt-in: when enabled, Nova26 uploads anonymized pattern vectors (not
     code, not project names, not file paths) to the Global Wisdom network. The portfolio
     manifest is not uploaded. Define exactly what is anonymized and how — use a diagram
     or step-by-step description of the anonymization pipeline.
   - Per-project privacy flags: a user can mark individual projects as `private: true` in
     the portfolio manifest, which excludes them from cross-project comparisons and Global
     Wisdom entirely. Define how this flag is set (`nova26 portfolio private <project-id>`).
   - The lock-in argument: write 200 words on why cross-project intelligence creates the
     most durable form of product lock-in Nova26 has — not dark-pattern lock-in, but
     genuine value lock-in. The user's portfolio IS the product. Every new project makes
     the portfolio more valuable. Canceling Nova26 does not erase the portfolio, but it
     stops it from growing.

7. **TypeScript interfaces.** Define the complete type system:

   ```typescript
   // Extend RalphLoopOptions
   interface RalphLoopOptions {
     // ... existing options (R1-R15 cumulative)
     portfolioIntelligenceEnabled?: boolean;
     portfolioConfig?: PortfolioConfig;
   }

   interface PortfolioConfig {
     manifestPath: string;               // default: '~/.nova/portfolio.json'
     similarityThreshold: number;        // default: 0.70
     patternPromotionMinProjects: number;// default: 3
     patternPromotionSimilarityMin: number; // default: 0.80
     recencyWeights: {
       within90Days: number;             // default: 1.0
       within1Year: number;              // default: 0.8
       beyond1Year: number;              // default: 0.6
     };
     crossProjectSuggestionsEnabled: boolean; // default: true
     globalWisdomOptIn: boolean;         // default: false
   }

   interface Portfolio {
     version: string;
     userId: string;                     // local machine identifier (not user account)
     createdAt: string;
     updatedAt: string;
     projects: PortfolioProject[];
     portfolioPatterns: PortfolioPattern[];
     skillGrowthHistory: SkillGrowthRecord[];
   }

   interface PortfolioProject {
     id: string;
     name: string;
     path: string;
     type: 'dashboard' | 'api' | 'cli' | 'mobile' | 'full-stack' | 'library' | 'other';
     primaryLanguage: string;
     framework?: string;
     firstBuildAt: string;
     lastBuildAt: string;
     totalBuilds: number;
     aceScoreHistory: Array<{ date: string; score: number }>;
     currentHealthScore?: number;        // from R15-05
     patternCount: number;
     semanticFingerprint: number[];      // embedding vector
     isPrivate: boolean;
     isArchived: boolean;
     tags: string[];
   }

   type PatternScope = 'project' | 'portfolio' | 'global';

   interface PortfolioPattern {
     id: string;
     scope: PatternScope;
     name: string;
     description: string;
     sourceProjectIds: string[];         // projects where this pattern appears
     firstSeenAt: string;
     lastSeenAt: string;
     occurrenceCount: number;
     averageQualityScore: number;        // 0-100
     isAntiPattern: boolean;
     lineage?: PatternLineage;
   }

   interface PatternLineage {
     patternId: string;
     versions: Array<{
       projectId: string;
       projectName: string;
       builtAt: string;
       qualityScore: number;
       changeDescription: string;        // what improved vs. previous version
     }>;
     bestVersionProjectId: string;
   }

   interface ProjectSimilarity {
     sourceProjectId: string;
     targetProjectId: string;
     similarityScore: number;            // 0-1 cosine similarity
     recencyWeightedScore: number;       // similarity * recency weight
     architecturalOverlap: string[];     // shared patterns/approaches
     computedAt: string;
   }

   interface CrossProjectInsight {
     id: string;
     type: 'better-pattern' | 'anti-pattern' | 'new-project-match' | 'skill-growth';
     sourceProjectId: string;
     targetProjectId?: string;
     title: string;
     description: string;
     qualityDelta?: number;              // signed; positive = source is better
     actionAvailable: boolean;
     actionDescription?: string;
     generatedAt: string;
     generatedBy: AgentName;
     status: 'pending' | 'accepted' | 'rejected' | 'dismissed';
   }

   interface CrossProjectSuggestion {
     insightId: string;
     sourceProject: string;
     sourceFile: string;
     targetProject: string;
     targetFile: string;
     qualityDelta: number;
     explanation: string;
     adaptedDiff?: string;               // set after adaptation pipeline runs
     adaptationStatus: 'not-started' | 'running' | 'ready' | 'failed';
   }

   interface SkillGrowthRecord {
     date: string;
     dimension: 'test-coverage' | 'complexity' | 'security' | 'ace-score' | 'build-speed';
     rollingAverage5Projects: number;
     allTimeAverage: number;
     trend: 'improving' | 'stable' | 'declining';
   }
   ```

8. **CLI surface.** Define all portfolio-related commands:

   ```
   nova26 portfolio status             # Overview of all projects with health scores
   nova26 portfolio projects           # Detailed project list with metadata
   nova26 portfolio patterns           # Portfolio-level patterns (personal idioms)
   nova26 portfolio insights           # Active cross-project insights and suggestions
   nova26 portfolio insights accept <id>  # Apply a cross-project suggestion
   nova26 portfolio insights dismiss <id> # Dismiss an insight
   nova26 portfolio similar <path>     # Find similar past projects to the given path
   nova26 portfolio private <id>       # Mark a project as private
   nova26 portfolio archive <id>       # Archive a project (stop updating, keep data)
   nova26 portfolio export             # Export portfolio manifest as JSON
   nova26 portfolio skill-growth       # Show skill improvement trends over time
   ```

9. **Integration points.** Specify the exact moments in the Ralph Loop where portfolio
   intelligence fires:
   - `afterBuildComplete`: update portfolio manifest, compute new fingerprint, generate
     any new portfolio-level insights (non-blocking, background).
   - `onNewPrdReceived` (JUPITER decomposition start): query portfolio for similar projects,
     surface the "head start" offer before decomposition begins.
   - `onVenusReview` (VENUS quality pass): query portfolio for better versions of the code
     under review, surface `CrossProjectSuggestion` if quality delta exceeds 15 points.
   - Specify the file location for these hooks in `src/orchestrator/ralph-loop.ts` and
     the ATLAS agent's handler in `src/agent-loop/agent-loop.ts`.

10. **Open questions.** List 3-5 hard implementation questions: how to handle projects
    where the path has changed (the user moved the project directory — how does Nova26
    re-identify it?); whether the semantic fingerprint should be re-computed on every build
    or only when key files change (the fingerprint computation involves an Ollama embedding
    call — it should be cached and invalidated only when `package.json`, `tsconfig.json`,
    or the top-level `src/` structure changes); how to define "project" when a monorepo
    contains multiple apps (should each workspace be a separate portfolio entry, or is the
    monorepo root the unit?); how to handle the cold-start problem for users who are new
    to Nova26 (0 projects in portfolio — all portfolio features are silently disabled until
    at least 2 projects have been built); and whether portfolio insights should be opt-in
    or opt-out (recommend opt-out — the insights are the most compelling retention mechanic
    in R16, so hiding them by default would undercut their value).

---

### GROK-R16-02: Agent Memory Consolidation & Long-Term Learning

**The analogy:** A junior developer who has been on your team for two years is not the same
as a junior developer on their first day. They have been in the room for every post-mortem.
They remember the week you tried microservices and rolled it back after three days. They
know that the payments module always becomes the bottleneck in load testing because you
learned that in Q3 of last year. A new AI assistant has none of this — every session is
day one. Nova26 already has the Taste Vault for patterns (the "what" of the codebase) and
the portfolio for cross-project intelligence (the "where"). What it does not have is genuine
episodic memory — the ability to say "remember when we tried X and it failed?" and have
that statement mean something. This is the difference between a tool and a colleague.

Produce a complete specification for Nova26's long-term agent memory layer covering:

1. **Memory taxonomy.** Define the three memory types and what each stores:

   - Episodic memory: specific past events with context. "On 2025-11-14, during the auth
     sprint, MARS attempted to use JWT refresh tokens with 15-minute expiry. MERCURY flagged
     it as a security risk. VENUS noted it introduced 200 lines of complexity. User chose
     to use session-based auth instead." Episodic memories are timestamped, project-linked,
     and searchable by topic and outcome. They are the "what happened" layer.
   - Semantic memory: general knowledge the agents have accumulated about the user's
     codebase, preferences, and domain. "This user prefers functional programming patterns
     over class-based. They have a strong preference for explicit error handling over
     exception propagation. They work primarily in a fintech domain and are familiar with
     PCI-DSS constraints." Semantic memories are not tied to a specific event — they are
     distilled generalizations that inform every future decision.
   - Procedural memory: how to do things in the context of this user's projects. "When
     this user asks for a new API endpoint, the correct procedure is: (1) define the Zod
     schema first, (2) write the Convex mutation, (3) write the handler, (4) write tests
     before the implementation." Procedural memories are essentially the user's preferred
     workflows, learned from observation across many builds.
   - The distinction from the Taste Vault: the Taste Vault stores code patterns (structural
     artifacts). Agent memory stores experiences, generalizations, and procedures (behavioral
     and contextual knowledge). A Taste Vault entry says "this is the shape of good code."
     An agent memory says "here is why we made that decision and what happened when we tried
     something else."

2. **Memory consolidation pipeline.** Define exactly what happens after each build:

   - Trigger: after every successful or failed build completion, the consolidation pipeline
     runs as a background task. It should complete within 60 seconds and use no more than
     128MB additional RAM.
   - Input: the build's full event log (all agent outputs, task completions, errors,
     user interventions, ACE scores, and the final build summary).
   - Extraction: ATLAS (the memory agent) processes the event log and extracts candidate
     memories. Extraction is LLM-assisted — ATLAS sends a structured prompt to the local
     Ollama model asking it to identify: (a) decisions made and their rationale, (b)
     approaches tried and their outcomes, (c) user preferences expressed (explicit or
     implicit), and (d) new generalizations that should update semantic memory.
   - Deduplication: before writing new memories, ATLAS compares candidates against existing
     memories using semantic similarity. A new episodic memory that describes an event
     substantially similar to an existing memory is merged rather than duplicated. Define
     the merge strategy.
   - Writing: accepted memories are written to `~/.nova/memory.db` — a local SQLite
     database (not Convex — memory is strictly local-first). Define the SQLite schema for
     each memory type.
   - Compression: after every 10 consolidation cycles, ATLAS runs a compression pass that
     collapses related episodic memories into a single semantic memory if they all point
     to the same generalization. "Attempts at JWT refresh tokens across 3 different builds
     all failed → semantic memory: 'User's auth requirements conflict with short-lived JWT
     patterns; prefer session-based auth.'"

3. **Memory retrieval before task execution.** Define how memories are loaded into agent context:

   - Trigger: before each task is assigned to an agent, ATLAS performs a retrieval query
     against `~/.nova/memory.db`. The query is semantic (embedding similarity against the
     task description) and recency-weighted.
   - Retrieval budget: agents receive at most 5 episodic memories, 3 semantic memories,
     and 2 procedural memories per task. The total retrieved memory must not exceed 800
     tokens (to preserve context window space for the actual task). Define the ranking
     algorithm that selects within budget.
   - Memory injection format: define the exact format in which retrieved memories are
     injected into the agent's system prompt. They must be clearly labeled as "past
     experiences" and presented in a way that does not confuse the agent about its current
     context. Show a worked example of a memory-injected system prompt prefix.
   - Negative memories: memories of failed approaches should be surfaced preferentially
     when the current task resembles the failed approach. "I attempted this exact pattern
     in the `user-dashboard` project in November. It failed because [reason]. I should
     not repeat this." Define the `outcome` field on `AgentMemory` and how a `negative`
     outcome triggers priority retrieval.

4. **The forgetting curve.** Define the memory decay model:

   - Ebbinghaus inspiration: human memory decays exponentially without reinforcement.
     Nova26's memory should do the same — a memory that has never been retrieved and never
     reinforced should gradually fade. Define the decay function: relevance score =
     initial_weight * e^(-decay_rate * days_since_last_access), where decay_rate is
     configurable (default: 0.05, meaning a memory loses ~5% relevance per day without use).
   - Reinforcement: every time a memory is retrieved and the associated task completes
     successfully, the memory's relevance score is boosted. Define the boost amount
     (suggest: +0.2, capped at 1.0).
   - Deletion threshold: memories with relevance score below 0.1 are candidates for
     deletion. Before deletion, ATLAS checks whether the memory is the only record of a
     specific important event (e.g., a critical failure). If so, it is preserved at 0.1
     indefinitely as a "landmark memory." Define the landmark designation criteria.
   - The user-facing metaphor: never surface the relevance score to the user. Instead,
     use language that mirrors human memory: "I have a clear memory of this," "I vaguely
     recall something similar," "I don't think we've tried this before." Define the
     relevance-to-language mapping.

5. **"Remember when" — the explicit memory interface.** Define the conversational memory feature:

   - When a user says `nova26 ask "Remember when we tried using Redis for session storage?"`,
     ATLAS queries memory for the most relevant episodic memories matching the query and
     returns a natural language summary of what happened.
   - When a user says `nova26 remember "Never use lodash in this project — it caused bundle
     bloat in v1"`, ATLAS creates a high-priority semantic memory with an indefinite TTL
     (it will not decay). Define this as a `PinnedMemory` variant.
   - When a user says `nova26 forget "The Redis session storage incident"`, ATLAS finds
     the matching episodic memory and marks it as `suppressed`. It is not deleted (for
     audit purposes) but will not be retrieved in future queries.
   - The memory audit: `nova26 memory list` shows all active memories, sorted by
     relevance score, with type (episodic/semantic/procedural), age, and access count.
     `nova26 memory show <id>` shows the full memory text.

6. **TypeScript interfaces.** Define the complete type system:

   ```typescript
   // Extend RalphLoopOptions
   interface RalphLoopOptions {
     // ... existing options (R1-R16-01 cumulative)
     agentMemoryEnabled?: boolean;
     memoryConfig?: AgentMemoryConfig;
   }

   interface AgentMemoryConfig {
     dbPath: string;                     // default: '~/.nova/memory.db'
     consolidationEnabled: boolean;      // default: true
     retrievalBudget: {
       episodic: number;                 // default: 5
       semantic: number;                 // default: 3
       procedural: number;              // default: 2
       maxTokens: number;               // default: 800
     };
     forgettingCurve: {
       decayRate: number;               // default: 0.05
       deletionThreshold: number;       // default: 0.1
       reinforcementBoost: number;      // default: 0.2
     };
     compressionCycleInterval: number;  // default: 10 (builds)
   }

   type MemoryType = 'episodic' | 'semantic' | 'procedural';
   type MemoryOutcome = 'positive' | 'negative' | 'neutral' | 'unknown';

   interface AgentMemory {
     id: string;
     type: MemoryType;
     content: string;                   // the memory text, in natural language
     embedding: number[];               // vector for semantic search
     projectId?: string;                // null for cross-project semantic memories
     buildId?: string;                  // null for semantic and procedural memories
     agentsInvolved: AgentName[];
     outcome: MemoryOutcome;
     relevanceScore: number;            // 0-1, decays over time
     isPinned: boolean;                 // pinned memories do not decay
     isSuppressed: boolean;             // suppressed memories are not retrieved
     accessCount: number;
     lastAccessedAt?: string;
     createdAt: string;
     updatedAt: string;
     sourceEventIds?: string[];         // build event log IDs that produced this memory
     tags: string[];
   }

   type MemoryType_Episodic = AgentMemory & {
     type: 'episodic';
     eventDate: string;
     location: string;                  // e.g., 'auth/session.ts during auth sprint'
     decision?: string;                 // what was decided
     alternativesConsidered?: string[];
   };

   type MemoryType_Semantic = AgentMemory & {
     type: 'semantic';
     confidence: number;                // 0-1, how confident ATLAS is in this generalization
     supportingMemoryIds: string[];     // episodic memories that support this generalization
   };

   type MemoryType_Procedural = AgentMemory & {
     type: 'procedural';
     triggerPattern: string;            // when this procedure applies (e.g., 'new API endpoint')
     steps: string[];
     successRate: number;              // 0-1, proportion of times this procedure succeeded
   };

   interface ConsolidationResult {
     buildId: string;
     consolidatedAt: string;
     memoriesExtracted: number;
     memoriesDeduplicated: number;
     memoriesCompressed: number;
     memoriesDeleted: number;
     newMemoryIds: string[];
     durationMs: number;
   }

   interface RetrievalQuery {
     taskDescription: string;
     taskEmbedding: number[];
     agentName: AgentName;
     projectId: string;
     maxEpisodic: number;
     maxSemantic: number;
     maxProcedural: number;
     maxTokens: number;
   }

   interface RetrievalResult {
     queryId: string;
     memories: AgentMemory[];
     totalTokensUsed: number;
     injectedPromptPrefix: string;      // the formatted memory context for the agent
     retrievedAt: string;
   }
   ```

7. **SQLite schema.** Define the local database schema for `~/.nova/memory.db`:

   ```sql
   CREATE TABLE memories (
     id TEXT PRIMARY KEY,
     type TEXT NOT NULL CHECK(type IN ('episodic', 'semantic', 'procedural')),
     content TEXT NOT NULL,
     embedding BLOB NOT NULL,           -- stored as Float32Array binary
     project_id TEXT,
     build_id TEXT,
     agents_involved TEXT NOT NULL,     -- JSON array of AgentName
     outcome TEXT NOT NULL DEFAULT 'unknown',
     relevance_score REAL NOT NULL DEFAULT 1.0,
     is_pinned INTEGER NOT NULL DEFAULT 0,
     is_suppressed INTEGER NOT NULL DEFAULT 0,
     access_count INTEGER NOT NULL DEFAULT 0,
     last_accessed_at TEXT,
     created_at TEXT NOT NULL,
     updated_at TEXT NOT NULL,
     tags TEXT NOT NULL DEFAULT '[]',   -- JSON array
     extra_json TEXT                    -- type-specific fields as JSON
   );

   CREATE INDEX idx_memories_type ON memories(type);
   CREATE INDEX idx_memories_project ON memories(project_id);
   CREATE INDEX idx_memories_relevance ON memories(relevance_score DESC);
   CREATE INDEX idx_memories_suppressed ON memories(is_suppressed);
   ```

8. **CLI surface.** Define all memory-related commands:

   ```
   nova26 memory list                  # All active memories, sorted by relevance
   nova26 memory list --type episodic  # Filter by memory type
   nova26 memory list --project <id>   # Memories for a specific project
   nova26 memory show <id>             # Full memory text and metadata
   nova26 remember "<text>"            # Create a pinned semantic memory manually
   nova26 forget "<query>"             # Suppress memories matching a query
   nova26 ask "Remember when..."       # Conversational memory retrieval
   nova26 memory consolidate           # Run consolidation now (instead of waiting)
   nova26 memory compress              # Run compression pass now
   nova26 memory stats                 # Memory database statistics
   nova26 memory export                # Export all memories as JSON (for backup)
   nova26 memory import <file>         # Import memories from backup
   ```

9. **Open questions.** List 3-5 hard implementation questions: how to handle the embedding
   storage in SQLite (the `embedding BLOB` column requires careful serialization — recommend
   storing as a Float32Array binary, with a utility function that handles read/write); how
   to prevent memory injection from degrading agent performance when the agent's context
   window is already near capacity (the 800-token budget is a safety valve, but it must
   be enforced strictly — define the trimming algorithm); whether consolidation should use
   the full Ollama model or a lightweight model (recommend the full model for consolidation,
   which runs once per build in the background, and a lightweight model for retrieval
   queries, which must be fast); how to validate that memory-injected agents actually
   perform better than non-memory agents (propose an A/B framework for internal testing:
   run 50 builds with memory enabled, 50 without, compare ACE scores); and how to handle
   the case where a memory is confidently wrong (the agent generalized incorrectly from
   past experience — define the `confidence` degradation mechanism when a procedural
   memory's associated procedure consistently produces lower-quality outputs).

---

### GROK-R16-03: Generative UI & Live Preview System

**The analogy:** Architects have always shown clients the building before it is built.
Floor plans. Scale models. Walkthroughs. The gap between "here is a drawing of your
house" and "here is your house" used to take years and cost millions. In software, the
same gap has always existed: the developer implements the UI, the designer reviews it,
someone says "that's not what I meant," and the cycle repeats. The reason this gap
persists in AI coding tools is that the tools operate in the past tense: they write code,
the developer runs the code, the developer sees the result, the developer asks for changes.
The tense is always "after." The Living Canvas collapses this into a present tense: as
agents generate UI code, you see it. As you point at something and say "bigger," the
code changes. The feedback loop is not a loop at all — it is a continuous negotiation.

Produce a complete specification for Nova26's Generative UI and Live Preview System covering:

1. **Live preview architecture.** Define the technical approach for real-time UI preview:

   - Vite HMR integration: when agents write UI component files to disk, Vite's Hot Module
     Replacement triggers automatically, updating the preview without a full reload. This
     is the path of least resistance for React/Next.js projects already using Vite. Define
     the `LivePreviewSession` lifecycle: start → watch file writes → HMR update → capture
     preview state → present to user.
   - Iframe sandbox model: for non-Vite projects and for isolation, the preview renders
     in a sandboxed iframe served locally (e.g., `http://localhost:5274`). Define the
     sandbox security constraints: `sandbox="allow-scripts allow-same-origin"`, no
     external network access, no cookie access to the parent frame.
   - Preview server: a lightweight Express server that serves the built UI and proxies
     API calls to a mock backend (generated by Nova26 for preview purposes). Define the
     mock backend generation: MARS generates stub API responses based on the TypeScript
     types of the API calls in the component.
   - Framework detection: Nova26 auto-detects the UI framework from `package.json`
     dependencies (React, Vue, Svelte, SolidJS) and selects the appropriate preview
     strategy. Define the detection priority order and the fallback (React is the default).

2. **Generative UI flow.** Define the agent-driven visual design loop:

   - Input modes: the user can describe a UI component in natural language ("a data table
     with sortable columns and a search filter"), sketch the layout in ASCII in the terminal
     ("create something like this: [header] [sidebar | main content] [footer]"), or reference
     a screenshot (`nova26 ui from-screenshot design.png`).
   - Generation: MARS generates the component code. VENUS reviews it for accessibility and
     best practices. The preview server renders it. All of this happens in parallel — by
     the time VENUS is done reviewing, the first render is already visible.
   - Variation mode: when `--variations N` is passed, Nova26 generates N distinct design
     variants (different layout, different color scheme, different interaction model) and
     presents them side by side (in terminal: numbered list with descriptions; in browser:
     a grid). The user selects or asks for a blend of two variants.
   - Component decomposition: for complex UIs (a full dashboard, a multi-step form),
     JUPITER decomposes the request into individual component tasks. Each component gets
     its own generation + preview cycle. The final composition assembles the components.
     Define the composition step: how does Nova26 assemble individually previewed components
     into a working page without breaking the live preview?

3. **Interactive feedback from the preview.** The hardest and most innovative part:

   - Point-and-describe: `nova26 ui feedback "make the button in the top right bigger and
     change it to primary blue"`. This command does not require the user to know the
     component name, the prop name, or the CSS class. Nova26 uses the preview's DOM tree
     (via Playwright's accessibility tree) to identify the target element, maps it back
     to the source component, and makes the change.
   - Visual selection: in a browser-based preview (future phase — specify but do not
     fully design), the user clicks on an element and types feedback inline. In the terminal
     phase (current), the user describes the element by its visual position or label.
   - Feedback parsing: define the `VisualFeedback` structure. A feedback statement like
     "make the sidebar narrower" must be parsed into: target (sidebar component), attribute
     (width), direction (reduce). Define the parsing strategy — a zero-shot LLM parse is
     appropriate here, since the feedback is open-ended.
   - DOM-to-source mapping: explain how Nova26 maps a DOM element back to its source code.
     This requires the preview server to inject a source-map annotation into each rendered
     element (`data-nova-source="src/components/Sidebar.tsx:42"`). Define the injection
     strategy and the source map format.

4. **Component playground.** Define the isolated component testing environment:

   - Concept: `nova26 ui playground <component-path>` starts an isolated preview of a
     single component, decoupled from its parent page. The playground renders the component
     with mock props (generated by MARS based on the component's TypeScript prop types) and
     allows the user to modify props interactively.
   - Prop editor: in the terminal, a numbered prop list with current values. The user types
     `nova26 ui prop 3 "Acme Corp"` to change prop 3 to "Acme Corp" and sees the preview
     update. Define the prop editing commands.
   - Edge case testing: `nova26 ui stress <component-path>` generates extreme prop values
     (empty strings, very long strings, null values, large arrays) and tests each combination
     in the playground. Failures (layout breaks, error boundaries triggered) are reported
     as issues for MARS to fix.
   - Storybook integration: if the project uses Storybook, the playground writes the
     tested scenarios as Storybook stories automatically. Define the story generation
     format and where the story files are written.

5. **The Living Canvas concept.** Define the philosophical and UX model:

   - The Living Canvas is not a feature — it is the mode of interaction when the Live
     Preview and Generative UI features are both active. Describe what a 10-minute
     Living Canvas session looks like: the developer's flow, what they see, what they
     say, what the agents do, and how the code base changes as a result.
   - Write this as a narrative: specific, concrete, first-person. "I open the terminal
     and type `nova26 canvas`. A preview window opens in my browser. I type: 'Build me
     a user settings page with profile photo upload, notification preferences, and a
     danger zone for account deletion.' I watch the layout appear..." Continue for 300
     words. Make it feel real and desirable.
   - The canvas state: define `CanvasState` — what is remembered between interactions
     in a canvas session. The user should be able to close and reopen the canvas and
     find it exactly where they left it.

6. **TypeScript interfaces.** Define the complete type system:

   ```typescript
   // Extend RalphLoopOptions
   interface RalphLoopOptions {
     // ... existing options
     livePreviewEnabled?: boolean;
     livePreviewConfig?: LivePreviewConfig;
   }

   interface LivePreviewConfig {
     port: number;                      // default: 5274
     framework: 'auto' | 'react' | 'vue' | 'svelte' | 'solid';
     strategy: 'vite-hmr' | 'iframe-sandbox' | 'auto';
     mockBackend: boolean;              // default: true
     openBrowser: boolean;              // default: false (terminal-first)
     variationsDefault: number;         // default: 1
     sourceMapAnnotation: boolean;      // inject data-nova-source attributes
   }

   interface LivePreviewSession {
     id: string;
     projectId: string;
     strategy: 'vite-hmr' | 'iframe-sandbox';
     port: number;
     url: string;
     startedAt: string;
     lastUpdatedAt: string;
     activeComponentPath?: string;
     status: 'starting' | 'ready' | 'updating' | 'error' | 'stopped';
     errorMessage?: string;
   }

   interface GenerativeUIRequest {
     id: string;
     description: string;
     inputMode: 'natural-language' | 'ascii-sketch' | 'screenshot';
     screenshotPath?: string;
     asciiSketch?: string;
     variationsRequested: number;
     targetPath?: string;              // where to write the component
     framework: string;
     projectId: string;
     requestedAt: string;
     requestedBy: 'human' | AgentName;
   }

   interface GenerativeUIResult {
     requestId: string;
     variations: UIVariation[];
     selectedVariationId?: string;
     finalComponentPath?: string;
     generatedAt: string;
     generatedBy: AgentName;
     previewUrl: string;
     aceScore?: number;
   }

   interface UIVariation {
     id: string;
     description: string;              // what distinguishes this variation
     componentCode: string;
     previewUrl: string;
     accessibility: {
       score: number;                  // 0-100
       issues: string[];
     };
     qualityScore: number;             // VENUS review score
   }

   interface VisualFeedback {
     id: string;
     sessionId: string;
     rawStatement: string;             // what the user said
     parsedTarget: {
       elementDescription: string;
       sourceFile?: string;
       sourceLine?: number;
       domSelector?: string;
     };
     parsedChange: {
       attribute: string;              // e.g., 'width', 'color', 'font-size'
       direction?: 'increase' | 'decrease' | 'change' | 'remove' | 'add';
       value?: string;
     };
     confidence: number;              // 0-1
     appliedAt?: string;
     codeDiff?: string;
     status: 'pending' | 'applied' | 'rejected' | 'ambiguous';
   }

   interface CanvasState {
     sessionId: string;
     projectId: string;
     activeComponents: string[];
     feedbackHistory: VisualFeedback[];
     variationHistory: GenerativeUIResult[];
     previewUrl: string;
     lastInteractionAt: string;
     status: 'active' | 'paused' | 'closed';
   }

   interface ComponentPlayground {
     sessionId: string;
     componentPath: string;
     propTypes: Array<{
       name: string;
       type: string;
       currentValue: unknown;
       mockValues: unknown[];
     }>;
     activeProps: Record<string, unknown>;
     renderStatus: 'ok' | 'error' | 'loading';
     stressTestResults?: StressTestResult[];
     storiesGenerated: boolean;
   }

   interface StressTestResult {
     propCombination: Record<string, unknown>;
     passed: boolean;
     failureType?: 'layout-break' | 'error-boundary' | 'accessibility' | 'console-error';
     failureDescription?: string;
   }
   ```

7. **CLI surface.** Define all UI/preview commands:

   ```
   nova26 ui build "<description>"     # Generate a UI component from description
   nova26 ui build --variations 3      # Generate 3 design variations
   nova26 ui build --from design.png   # Generate from a screenshot reference
   nova26 ui preview                   # Start the live preview server
   nova26 ui preview --open            # Start and open in browser
   nova26 ui feedback "<statement>"    # Apply visual feedback to active preview
   nova26 ui playground <path>         # Open isolated component playground
   nova26 ui prop <n> <value>          # Change prop N in active playground
   nova26 ui stress <path>             # Run stress test on a component
   nova26 ui canvas                    # Start a full Living Canvas session
   nova26 ui canvas --resume           # Resume last canvas session
   nova26 ui stop                      # Stop the preview server
   ```

8. **Open questions.** List 3-5 hard implementation questions: how to handle the preview
   for projects that do not have a UI (API-only projects, CLI tools — the preview system
   should gracefully do nothing); how to manage the port lifecycle when multiple projects
   are open simultaneously (recommend a dynamic port allocation strategy: scan from 5274
   upward until a free port is found); how to implement DOM-to-source mapping reliably
   across minified builds (the `data-nova-source` annotation must survive the build step —
   this works in development mode but is stripped in production builds, which is correct);
   whether the preview server should double as a development server or remain strictly
   separate (separate is safer and more maintainable); and how to handle React Server
   Components, which cannot be rendered in a client-only iframe sandbox.

---

### GROK-R16-04: Autonomous Testing & Quality Assurance

**The analogy:** A chess grandmaster does not evaluate only the current position — they
think several moves ahead, mentally simulating their opponent's responses. A test suite
written by most developers evaluates only the current position: does the code that exists
today pass? But the code that matters is the code in three months, after two junior
developers have changed the auth module, after a dependency was upgraded, after a hotfix
was applied at 2am. A test suite that passes today but does not catch the regression at
2am has failed its primary job. The difference between a test suite that catches 2am
regressions and one that does not is not the coverage percentage — it is the strategic
intelligence behind which tests were written. Nova26 can think ahead. It can identify
which paths are actually risky, not just which paths are covered. It can see the moves
the code will make before they happen.

Produce a complete specification for Nova26's autonomous testing and quality assurance layer:

1. **PLUTO's strategic role expansion.** PLUTO already runs tests. Expand PLUTO's role to
   include strategic testing intelligence:

   - Test gap analysis: PLUTO analyzes the test suite and identifies not just uncovered
     lines (that is coverage tooling) but uncovered *scenarios* — business logic paths
     that matter but are not tested. "You have 94% line coverage, but the payment failure
     flow is covered by exactly one test that only tests the happy path error message.
     The retry logic, the idempotency key behavior, and the webhook failure case are
     completely untested." Define how PLUTO identifies scenario gaps: it reads the
     application's intent specs (from R16-01's `.intents` file if present), reads the
     Taste Vault for known patterns in this domain, and compares the logical branches
     of the code against the test assertions.
   - Test quality scoring: beyond coverage, define a `TestQualityScore` that measures
     how good the tests are, not just how many there are. Dimensions: assertion depth
     (tests that assert multiple properties of the output, not just "it returned something"),
     boundary testing (are edge cases tested?), failure path coverage (are error cases
     tested?), test independence (do tests share mutable state?), and test speed
     (slow tests catch fewer regressions in practice because developers skip them).
   - PLUTO's daily brief: after each successful build, PLUTO generates a one-paragraph
     testing brief: "Your highest-risk untested paths today are X, Y, and Z. I recommend
     writing tests for X first because it handles payment processing for premium users."

2. **Mutation testing.** Define the mutation testing system:

   - Concept: Nova26 systematically introduces small, controlled bugs into the codebase
     (mutations) and verifies that the existing tests catch them. A mutation that is not
     caught by any test reveals a gap in the test suite's effectiveness. This is different
     from coverage: a line can be covered but the test might not assert anything meaningful
     about that line.
   - Mutation operators: define the set of mutations Nova26 applies. Standard mutation
     operators for TypeScript: boundary mutations (change `>` to `>=`, `===` to `!==`),
     arithmetic mutations (change `+` to `-`, `*` to `/`), return mutations (return `null`
     instead of a computed value), statement mutations (delete a statement), and logical
     mutations (change `&&` to `||`). Define at minimum 10 mutation operators.
   - Mutation schedule: mutation testing is computationally expensive (it reruns the test
     suite for each mutation). It should not run on every build. Define the schedule:
     weekly (in maintenance mode from R15-05), or on demand (`nova26 test mutate`).
   - Mutation score: the percentage of mutations caught by the test suite. A mutation
     score of 85%+ is excellent; 70-85% is adequate; below 70% is concerning. Define
     how the mutation score is surfaced and how it relates to line coverage.
   - Surviving mutations: when a mutation survives (no test caught it), PLUTO generates
     a test that would have caught it. This test is proposed to the user, not auto-applied.

3. **Test maintenance automation.** Define how tests stay in sync with code:

   - Change detection: when a function's signature changes, PLUTO identifies all tests
     that call that function and checks whether they need to be updated. Specifically:
     if a parameter is added (with no default), tests that do not pass that parameter will
     fail at runtime — PLUTO flags these before the build fails and offers to update them.
   - Semantic drift detection: when a function's behavior changes significantly (not just
     its signature), PLUTO runs the existing tests in watch mode and captures which ones
     fail. For each failing test, PLUTO determines whether the test is wrong (the behavior
     changed intentionally) or the code is wrong (regression). How PLUTO makes this
     determination: it checks the git diff and looks for intent-level signals ("refactor"
     in the commit message suggests intentional change; no commit message suggests unplanned
     change).
   - Auto-update for safe cases: for failing tests where the failure is clearly due to a
     signature change (not a logic change), PLUTO can auto-update the test call sites.
     Define "clearly safe" — only parameter additions where the new parameter is typed and
     a sensible default can be inferred from the context.
   - Flaky test detection and quarantine: a test that fails more than 2 times in 10 runs
     without a code change is flaky. PLUTO quarantines it (marks as `.skip` with a
     `@nova26-flaky` comment) and opens an issue in the project's tracking system.
     Define the flaky test detection algorithm: requires the build history from Convex's
     `builds` table.

4. **Test strategy generation.** Define how Nova26 proposes testing plans for new features:

   - Input: a PRD task description ("Add Stripe webhook handling for subscription
     cancellations") or a code file that has just been written.
   - Output: a `TestStrategy` document that specifies: the test types needed (unit,
     integration, e2e), the specific scenarios to cover, the mocking strategy (what to
     mock vs. what to test with real implementations), and an estimated time to implement.
   - The strategy format: a structured document with sections for happy paths, failure
     paths, edge cases, and integration scenarios. Each scenario includes a one-sentence
     description and the expected assertion. Show a worked example for the Stripe webhook
     scenario — write the complete `TestStrategy` output, not an outline.
   - JUPITER integration: when JUPITER decomposes a PRD into tasks, one task per
     significant feature should be a "Write test strategy" task assigned to PLUTO, which
     runs before the implementation task. The test strategy informs the implementation.

5. **End-to-end test generation with Playwright.** Define the Playwright test generation feature:

   - Input: a user flow description ("User logs in, navigates to billing, upgrades to
     premium, and sees a success confirmation") or a recorded user session (if the Live
     Preview from R16-03 is active, Nova26 can record the session as a Playwright script).
   - Code generation: PLUTO generates a complete Playwright test file with proper selectors
     (preferring accessible role-based selectors over brittle CSS selectors), wait
     conditions, and assertions. Show the complete generated Playwright test for the
     billing upgrade flow.
   - Selector strategy: PLUTO should prefer `getByRole`, `getByLabel`, and `getByText`
     selectors, in that order, before falling back to `data-testid` attributes. It should
     never generate CSS class selectors. Define this as a hard constraint, not a preference.
   - CI integration: generated Playwright tests are automatically added to the project's
     CI pipeline configuration (`.github/workflows/` or equivalent). Define how PLUTO
     identifies the correct CI config file and the exact change it makes.

6. **TypeScript interfaces.** Define the complete type system:

   ```typescript
   // Extend RalphLoopOptions
   interface RalphLoopOptions {
     // ... existing options
     autonomousTestingEnabled?: boolean;
     testingConfig?: AutonomousTestingConfig;
   }

   interface AutonomousTestingConfig {
     mutationTestingEnabled: boolean;   // default: false (expensive)
     mutationTestingSchedule?: string;  // cron expression; default: weekly
     flakynessThreshold: number;        // failures per 10 runs; default: 2
     testMaintenanceEnabled: boolean;   // default: true
     playwrightEnabled: boolean;        // default: false; requires Playwright installed
     strategyGenerationEnabled: boolean;// default: true
     dailyBriefEnabled: boolean;        // default: true
   }

   interface TestGap {
     id: string;
     type: 'scenario' | 'boundary' | 'error-path' | 'integration';
     description: string;
     affectedFile: string;
     affectedFunction: string;
     riskScore: number;                // 0-100; higher = more important to fix
     businessImpact: string;          // why this matters in plain English
     suggestedTestDescription: string; // what a test covering this gap would assert
     relatedIntentSpecId?: string;    // link to R16-01 intent spec if applicable
   }

   interface TestQualityScore {
     overall: number;                  // 0-100
     grade: 'excellent' | 'good' | 'adequate' | 'poor';
     dimensions: {
       assertionDepth: number;
       boundaryTesting: number;
       failurePathCoverage: number;
       testIndependence: number;
       testSpeed: number;
     };
     lineCoverage: number;            // separate from quality score
     mutationScore?: number;          // null if mutation testing not run
     gaps: TestGap[];
     computedAt: string;
   }

   type MutationOperator =
     | 'boundary-relax'               // > to >=
     | 'boundary-tighten'             // >= to >
     | 'equality-negate'              // === to !==
     | 'arithmetic-add-sub'           // + to -
     | 'arithmetic-mul-div'           // * to /
     | 'logical-and-or'               // && to ||
     | 'logical-or-and'               // || to &&
     | 'return-null'                  // return value to null
     | 'return-empty'                 // return value to [] or {}
     | 'statement-delete'             // remove a statement
     | 'condition-true'               // force condition to true
     | 'condition-false';             // force condition to false

   interface Mutation {
     id: string;
     operator: MutationOperator;
     file: string;
     line: number;
     originalCode: string;
     mutatedCode: string;
     status: 'pending' | 'killed' | 'survived' | 'skipped' | 'timeout';
     killedByTest?: string;           // test that caught it
     survivedReason?: string;
   }

   interface MutationResult {
     sessionId: string;
     projectId: string;
     runAt: string;
     totalMutations: number;
     killed: number;
     survived: number;
     skipped: number;
     mutationScore: number;           // killed / (killed + survived), 0-1
     survivors: Mutation[];
     suggestedTests: SuggestedTest[];
     durationMs: number;
   }

   interface SuggestedTest {
     mutationId: string;
     description: string;
     testCode: string;
     targetFile: string;
     confidence: number;
   }

   interface TestStrategy {
     id: string;
     featureDescription: string;
     generatedAt: string;
     generatedBy: AgentName;
     testTypes: Array<'unit' | 'integration' | 'e2e'>;
     estimatedImplementationHours: number;
     scenarios: TestScenario[];
     mockingStrategy: {
       externalServices: string[];     // what to mock
       database: 'real' | 'in-memory' | 'mocked';
       rationale: string;
     };
   }

   interface TestScenario {
     id: string;
     type: 'happy-path' | 'failure-path' | 'edge-case' | 'integration';
     description: string;
     preconditions: string[];
     assertion: string;
     priority: 'critical' | 'high' | 'medium' | 'low';
   }

   interface TestMaintenance {
     triggeredAt: string;
     changedFile: string;
     changedFunction: string;
     changeType: 'signature' | 'behavior' | 'deletion';
     affectedTests: string[];
     autoUpdated: string[];
     manualReviewRequired: string[];
     flakiesDetected: string[];
   }
   ```

7. **CLI surface.** Define all autonomous testing commands:

   ```
   nova26 test analyze                 # Full test quality analysis with gaps
   nova26 test gaps                    # Show untested scenarios by risk score
   nova26 test strategy "<feature>"    # Generate a test strategy for a feature
   nova26 test mutate                  # Run mutation testing (takes time)
   nova26 test mutate --file <path>    # Mutation testing for a single file
   nova26 test mutate --report         # Show last mutation testing report
   nova26 test flaky                   # List quarantined flaky tests
   nova26 test flaky fix <test-name>   # Attempt to fix a flaky test
   nova26 test playwright "<flow>"     # Generate a Playwright test for a user flow
   nova26 test brief                   # Today's testing brief from PLUTO
   nova26 test maintain                # Run test maintenance on changed files
   ```

8. **Open questions.** List 3-5 hard implementation questions: how to make mutation testing
   fast enough to be practical (the naive approach runs the full test suite for each
   mutation — a 1,000-test suite with 500 mutations = 500,000 test executions; recommend
   "selective mutation testing" that only reruns tests that cover the mutated line); how
   to distinguish intentional behavior changes from regressions in the test maintenance
   system (the git commit message heuristic is fragile — consider integrating with the
   intent spec system from R16-01 for ground truth about expected behavior); whether PLUTO
   should auto-apply mutant-killing tests or always require user approval (recommend always
   requiring approval, since auto-generated tests can encode incorrect assumptions); and
   how to handle projects with no existing test infrastructure at all (PLUTO should detect
   zero tests and offer to bootstrap the testing setup before doing any analysis).

---

### GROK-R16-05: Emotional Intelligence & Developer Wellbeing

**The analogy:** A good pair programming partner does more than just write code. They
notice when you have been staring at the same bug for 45 minutes and say "want to take a
break and come back to it?" They notice when you are in flow and do not interrupt. They
say "that was elegant" when you write something elegant, not because they are programmed
to encourage you, but because they were there and they saw it. The closest thing to this
in current AI tools is a loading spinner that says "Thinking..." — a reminder that the
tool is processing, with zero awareness of what you are experiencing on the other side of
the interface. Nova26 has 21 agents that are already watching every build, every file
write, every test run. They are already in the room. This spec asks them to look up.

Produce a complete specification for Nova26's emotional intelligence and developer wellbeing layer:

1. **Frustration signal detection.** Define the observable signals Nova26 monitors:

   - Rapid undo sequences: more than 5 undos within 60 seconds on the same file. This is
     a strong signal of confusion or regret about a recent change. Not frustration with
     Nova26 specifically — frustration with the problem.
   - Repeated failed attempts: the same task failing ACE review 3+ times in a row, or
     the same test failing after 3+ manual fix attempts. The user is stuck.
   - Commit message sentiment: "fix: ugh this again", "fix: WHY", "wip: nothing is
     working" — these are explicit frustration signals. Define the sentiment analysis
     approach: a simple keyword list (not an LLM, to keep it fast) covering expletives,
     expressions of confusion, and negative exclamations.
   - Session length without a successful build: more than 90 minutes of active editing
     with no successful build completion. The user has been fighting something for a long
     time.
   - Rapid task abandonment: starting and deleting tasks within a short window,
     suggesting the user is not sure what to ask for.
   - Define `WellbeingSignal` with a confidence score for each signal type. Multiple
     low-confidence signals should aggregate into a higher-confidence composite signal.

2. **Emotional state model.** Define the state machine for developer emotional state:

   - States: `focused` (in flow, building well), `exploring` (not sure what to build,
     trying things), `stuck` (clear problem, no progress), `frustrated` (stuck + negative
     signals), `fatigued` (long session, slowing down), `celebrating` (significant
     milestone just reached).
   - Transitions: define the signal thresholds that trigger each transition. A developer
     moves from `focused` to `stuck` after 90 minutes without a build success. They move
     from `stuck` to `frustrated` when rapid undo sequences or negative commit messages
     appear. They move from anything to `celebrating` after a milestone (first passing
     build, test coverage milestone, build completion).
   - Recovery: define how state returns to `focused`. After a successful build following
     a `frustrated` state, Nova26 notes the recovery with encouragement. After a break
     suggestion is taken (user is inactive for 15+ minutes following a `fatigued` signal),
     state resets to `focused`.
   - The state is never surfaced as a label to the user. It is internal to Nova26's
     decision-making. The user experiences the effects (interventions, tone, pacing) but
     never sees "your emotional state: FRUSTRATED." That would be condescending.

3. **Gentle interventions.** Define the specific interventions for each state:

   - `stuck` (first 30 minutes): no intervention. The user may be in a productive deep
     focus. Nova26 watches but does not speak.
   - `stuck` (30-90 minutes): a single, optional offer. "I notice this has been tricky
     for a while. Want me to try a different approach?" The message is short, non-alarmist,
     and requires no response (the user can ignore it).
   - `frustrated`: tone shift (defined in point 4) + a reframe offer. "This error has
     come up a few times. Sometimes it helps to step back — want me to explain what's
     causing it rather than trying to fix it directly?" The offer of explanation rather
     than another fix attempt is key — it breaks the stuck loop.
   - `fatigued` (90+ minute session, slowing output): a break suggestion. "You've been
     building for about two hours. A 10-minute break often helps with problems like this.
     I'll be here." One suggestion only. Never repeated in the same session.
   - `celebrating`: acknowledgment proportional to the milestone. "Test coverage just
     crossed 80% — that's a significant improvement over last week." Not effusive. Not
     hollow. Specific and true.
   - The ethics of intervention: write a 150-word reflection on where the line is between
     helpful and patronizing. Acknowledge the risk that well-intentioned interventions can
     feel condescending or surveillance-like. Define the design principles that keep
     interventions on the right side of that line: (1) always optional, (2) never
     repeated, (3) never labeled (do not say "I can see you're frustrated"), (4)
     offer-not-advice (offer something actionable, not an assessment of the developer's
     state), (5) minimal — the least intrusive intervention that might help.

4. **Tone adaptation.** Define how agents adjust their communication style based on state:

   - Baseline tone: informative, direct, somewhat technical. "The function you requested
     uses a recursive pattern that could hit stack limits with inputs larger than ~10,000
     elements. I've added a guard. Here's what changed."
   - `frustrated` tone: shorter messages, less technical detail, more supportive framing.
     "Done. I kept this simpler than last time — just the core logic. Let me know if you
     want to add edge case handling." Not "I've simplified the implementation based on
     the earlier complexity issues" — that subtly references the failure, which is
     unhelpful.
   - `celebrating` tone: brief acknowledgment before the result. "Nice — that sorted
     itself out cleanly. Here's the code." One sentence of acknowledgment. Not a paragraph.
   - `fatigued` tone: brief and clear. No lengthy explanations. Just the result and a
     single key point.
   - Define the `ToneProfile` type with response length targets, technical depth level,
     and acknowledgment frequency for each state.

5. **Work session awareness.** Define the session lifecycle model:

   - Session start detection: first build, first file write, or `nova26 start`.
   - Active session tracking: Nova26 tracks session duration and output velocity (builds
     per hour, tasks completed per hour). Velocity drop of 40%+ over a 30-minute window
     is a fatigue signal.
   - Milestone celebration: define the milestones worth acknowledging: first passing build
     of the session, 10th consecutive passing build, test coverage milestone (crossing
     60%, 70%, 80%, 90%), first build with a Security Score above 85, build completion
     (project feature done), project completion (full PRD shipped).
   - Session summary: at session end (`nova26 stop` or 30 minutes of inactivity), Nova26
     generates a brief session summary: what was accomplished, how long it took, any
     notable milestones, and the current state of the project. This is output to the
     terminal. It should feel like a colleague's end-of-day summary, not a metrics report.

6. **Connection to Adaptive Personality (R13-04).** Clarify how Emotional Intelligence
   extends Adaptive Personality without duplicating it:

   - R13-04 (Adaptive Personality): agents adapt their communication style based on the
     user's expressed preferences and long-term feedback. Style is a setting — the user
     tells Nova26 "be more concise" and that preference persists.
   - R16-05 (Emotional Intelligence): agents adapt their communication style based on
     real-time signals of the user's emotional state. State is transient — the user is
     frustrated right now; they will not be frustrated in an hour. The adaptation is
     temporary and reverts automatically.
   - Integration: emotional state overrides personality settings temporarily. If the user
     has set a "verbose" personality preference but is currently `frustrated`, Nova26
     uses the `frustrated` tone profile (shorter, simpler) until state returns to `focused`.
     Define the override logic and how it resolves when state changes.

7. **TypeScript interfaces.** Define the complete type system:

   ```typescript
   // Extend RalphLoopOptions
   interface RalphLoopOptions {
     // ... existing options
     wellbeingEnabled?: boolean;
     wellbeingConfig?: WellbeingConfig;
   }

   interface WellbeingConfig {
     signalDetectionEnabled: boolean;   // default: true
     interventionsEnabled: boolean;     // default: true
     toneAdaptationEnabled: boolean;    // default: true
     milestoneAcknowledgmentEnabled: boolean; // default: true
     sessionSummaryEnabled: boolean;    // default: true
     sessionInactivityTimeoutMinutes: number; // default: 30
     stuckThresholdMinutes: number;     // default: 30
     fatigueThresholdMinutes: number;   // default: 90
   }

   type DeveloperState =
     | 'focused'
     | 'exploring'
     | 'stuck'
     | 'frustrated'
     | 'fatigued'
     | 'celebrating';

   type SignalType =
     | 'rapid-undo'
     | 'repeated-failure'
     | 'negative-commit-message'
     | 'long-session-no-build'
     | 'rapid-task-abandonment'
     | 'velocity-drop'
     | 'milestone-reached'
     | 'successful-build-after-stuck';

   interface WellbeingSignal {
     id: string;
     type: SignalType;
     confidence: number;              // 0-1
     detectedAt: string;
     context: string;                 // human-readable description of what triggered it
     sessionId: string;
     projectId: string;
     rawData?: Record<string, unknown>; // the raw numbers that triggered it
   }

   interface EmotionalState {
     sessionId: string;
     currentState: DeveloperState;
     previousState?: DeveloperState;
     stateEnteredAt: string;
     signals: WellbeingSignal[];
     compositeConfidence: number;     // 0-1, aggregate of all active signals
     interventionCooldownUntil?: string; // do not intervene again until this time
     lastMilestoneAt?: string;
     lastMilestoneDescription?: string;
   }

   type InterventionType =
     | 'alternative-approach-offer'
     | 'explanation-offer'
     | 'break-suggestion'
     | 'milestone-acknowledgment'
     | 'session-summary';

   interface InterventionStrategy {
     id: string;
     triggerState: DeveloperState;
     type: InterventionType;
     minimumStateAgeMinutes: number;  // do not intervene before state is this old
     cooldownMinutes: number;         // do not repeat within this window
     messageTemplate: string;         // the message to show the user
     requiresResponse: boolean;       // default: false
     maxPerSession: number;           // default: 1
   }

   interface ToneProfile {
     state: DeveloperState;
     maxResponseLength: 'short' | 'medium' | 'long'; // short: <100w, medium: 100-300w, long: 300w+
     technicalDepth: 'minimal' | 'standard' | 'detailed';
     acknowledgmentFrequency: 'never' | 'milestones-only' | 'regular';
     useEmoji: false;                 // always false; never use emoji
     ledeStyle: 'result-first' | 'context-first';
   }

   interface SessionSummary {
     sessionId: string;
     projectId: string;
     startedAt: string;
     endedAt: string;
     durationMinutes: number;
     buildsCompleted: number;
     tasksCompleted: number;
     linesChanged: number;
     milestonesReached: string[];
     statesVisited: DeveloperState[];
     peakFrustrationSignals: number;
     recoveries: number;              // transitions from frustrated/stuck back to focused
     narrativeSummary: string;        // 2-3 sentence natural language summary
   }
   ```

8. **CLI surface.** Define wellbeing-related commands (deliberately minimal — the feature
   should be largely invisible):

   ```
   nova26 wellbeing status             # Show current session state and active signals
   nova26 wellbeing history            # Session history with state timelines
   nova26 wellbeing disable            # Disable all wellbeing features for this session
   nova26 wellbeing disable --permanent # Disable permanently (stored in .novarc)
   nova26 session summary              # Show current session summary
   nova26 session stop                 # End session and generate summary
   ```

   The wellbeing feature should surface primarily through agent output, not through
   dedicated commands. The command surface is minimal by design.

9. **The ethics section.** Write 300 words on the ethics of emotional intelligence in a
   developer tool:

   The core tension is this: detecting a developer's emotional state from behavioral
   signals is useful if it makes the experience better; it is invasive if it makes the
   developer feel observed, categorized, or managed. The line between those two outcomes
   is thinner than it appears.

   Three design principles that keep Nova26 on the right side of that line:

   First, the data stays local. Emotional state signals are computed locally, never
   sent to a server, never aggregated across users, never used to improve the model.
   A developer's frustration pattern is not a training signal for Anthropic or for
   Nova26 LLC. It is private, the same way a developer's commit history is private.
   State is computed in memory and discarded at session end.

   Second, the interventions are offers, not assessments. Nova26 never says "I can
   see you are frustrated." It says "want to try a different approach?" The first
   statement categorizes the developer's state out loud, which is condescending.
   The second statement offers something useful without requiring the developer to
   acknowledge their own frustration. The developer can accept or ignore.

   Third, the feature can be turned off entirely. `nova26 wellbeing disable --permanent`
   removes all emotional intelligence features from the experience. This is not buried
   in settings — it is a first-class CLI command. Developers who do not want this kind
   of attention from a tool should not have to have it.

   The goal is not a tool that manages your emotions. It is a tool that is aware that
   you are a human being who has good sessions and bad ones, and that adjusts its
   behavior slightly in response — the same way any thoughtful collaborator would.

10. **Open questions.** List 3-5 hard implementation questions: how to distinguish
    frustration with the problem (productive struggle) from frustration with Nova26
    (product feedback) — these require different responses and the signals may look
    similar; how to handle cultural and individual differences in frustration expression
    (some developers use negative commit messages habitually without being frustrated;
    others never express frustration in text); whether the tone adaptation should be
    applied to all 21 agents simultaneously or only to agents that produce user-facing
    output (recommend: only user-facing output agents — MARS, VENUS, MERCURY — not
    internal coordination agents like JUPITER or ATLAS); and how to validate that the
    wellbeing features actually improve developer experience without running invasive
    A/B tests on emotional states (recommend: opt-in session surveys after the session
    summary is shown, asking simply "how was this session?" on a 1-5 scale, to track
    correlation between state detections and user-reported experience).

---

## Output Format

- Label each section clearly: `## GROK-R16-01`, `## GROK-R16-02`, etc.
- Begin each deliverable with the big-picture analogy paragraph before any technical content.
- Use TypeScript for all interfaces and configuration schemas — interfaces must be complete
  and directly buildable (no placeholder fields, no `// TODO` stubs).
- Use tables for comparisons, taxonomies, and command inventories.
- Reference real Nova26 file paths where applicable:
  - `src/orchestrator/ralph-loop.ts`
  - `src/orchestrator/prompt-builder.ts`
  - `src/agent-loop/agent-loop.ts`
  - `src/llm/structured-output.ts`
  - `convex/schema.ts`
  - `.novarc`
  - `~/.nova/portfolio.json`
  - `~/.nova/memory.db`
- Each deliverable must be independently actionable — a person picking up GROK-R16-04
  (Autonomous Testing) should not need to have read R16-01 (Portfolio Intelligence) first.
- Estimated output: 2,500-4,000 words per deliverable, 12,500-20,000 words total.
- Where this spec asks for a "worked example," write the actual example — complete
  TypeScript code, complete terminal output, complete narrative. Not an outline.
- Where this spec asks for an "ethics section" or "honest analysis," be honest.
  Acknowledge what Nova26 cannot do yet. Acknowledge the risks. The goal is a credible
  spec, not a marketing document.
- The TypeScript interfaces defined here extend the cumulative `RalphLoopOptions` type
  in `src/orchestrator/ralph-loop.ts`. Each new `*Config` type and `*Enabled` flag
  follows the existing naming convention exactly.

---

## Reference: Key Nova26 Types (Cumulative through R16)

For accuracy and consistency, these are the core types your specs must build on or extend:

```typescript
// Agent names in the system
type AgentName = 'MARS' | 'VENUS' | 'MERCURY' | 'JUPITER' | 'SATURN' | 'PLUTO'
  | 'NEPTUNE' | 'URANUS' | 'EARTH' | 'IO' | 'GANYMEDE' | 'EUROPA' | 'CALLISTO'
  | 'TITAN' | 'ENCELADUS' | 'MIMAS' | 'TRITON' | 'CHARON' | 'ANDROMEDA'
  | 'ATLAS' | 'SUN';

// Task structure
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

// Ralph Loop options (cumulative through R16)
interface RalphLoopOptions {
  // R1-R12 core options
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
  agentProtocolEnabled?: boolean;
  agentProtocolConfig?: AgentProtocolConfig;
  predictiveDecompositionEnabled?: boolean;
  predictiveDecompositionConfig?: PredictiveDecompositionConfig;
  adaptivePersonalityEnabled?: boolean;
  adaptivePersonalityConfig?: AdaptivePersonalityConfig;
  offlineFirstEnabled?: boolean;
  offlineConfig?: OfflineFirstConfig;
  edgeModeEnabled?: boolean;
  edgeConfig?: EdgeModeConfig;
  // R15 additions
  securityAuditEnabled?: boolean;
  securityConfig?: SecurityConfig;
  dbDesignEnabled?: boolean;
  dbDesignConfig?: DatabaseDesignConfig;
  multiplayerEnabled?: boolean;
  multiplayerConfig?: MultiplayerConfig;
  intentProgrammingEnabled?: boolean;
  intentConfig?: IntentProgrammingConfig;
  healthMonitorEnabled?: boolean;
  healthConfig?: HealthMonitorConfig;
  // R16 additions — each deliverable adds its own pair:
  portfolioIntelligenceEnabled?: boolean;
  portfolioConfig?: PortfolioConfig;
  agentMemoryEnabled?: boolean;
  memoryConfig?: AgentMemoryConfig;
  livePreviewEnabled?: boolean;
  livePreviewConfig?: LivePreviewConfig;
  autonomousTestingEnabled?: boolean;
  testingConfig?: AutonomousTestingConfig;
  wellbeingEnabled?: boolean;
  wellbeingConfig?: WellbeingConfig;
}
```

The existing Convex tables (`builds`, `tasks`, `executions`, `patterns`, `agents`,
`companyAgents`, `learnings`, `userEngagement`, `churnRisk`) must not be modified.
New tables required by R16 deliverables must be specified as explicit additions with
full Convex schema definitions, following the existing naming conventions in `convex/schema.ts`.

Note that R16-01 (Portfolio) and R16-02 (Memory) use local filesystem storage
(`~/.nova/portfolio.json` and `~/.nova/memory.db`) rather than Convex — this is a
deliberate architectural choice for privacy and local-first guarantees. These stores
are never synced to Convex unless the user explicitly opts in to Global Wisdom.

---

## Coordination Note

R16 is the second explicitly post-launch research round. The deliverables are the
roadmap for Nova26 v2.5 — the version that makes users say "I could never cancel this."

- Kimi's frontier sprint is finishing. R16 specs must assume all Kimi deliverables
  (agent communication, semantic search, predictive decomposition, personality,
  offline-first) are in production when R16 features are being designed.
- GROK-R16-01 (Portfolio) builds on ATLAS and the Taste Vault — ATLAS's role expands
  significantly. This should be designed to not increase ATLAS's memory footprint during
  active builds (portfolio operations are background tasks only).
- GROK-R16-02 (Memory) is the most architecturally significant R16 addition — it
  introduces a new persistent local database (`~/.nova/memory.db`) that sits outside
  the Convex sync layer. Design it with the assumption that this database could grow to
  10MB+ over a year of heavy use.
- GROK-R16-03 (Generative UI) depends on the presence of a UI framework in the project.
  It must gracefully no-op for non-UI projects (API servers, CLIs, libraries).
- GROK-R16-04 (Autonomous Testing) builds directly on PLUTO's existing infrastructure.
  Mutation testing is the most computationally expensive feature in R16 — its scheduling
  must be conservative by default.
- GROK-R16-05 (Emotional Intelligence) is the most human feature in all 16 rounds of
  research. It must be designed with humility: agents that notice, not agents that manage.

---

*Prompt issued by Claude Code on 2026-02-18. Grok R16 output should be delivered to
`.nova/output/` or committed directly to the `grok/r16` branch for coordinator review.*
