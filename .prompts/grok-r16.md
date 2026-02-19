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

### GROK-R16-06: Dream Mode — Full Interactive App Simulation Before Building

**The analogy:** A film director does not walk onto a set, yell "action," and hope for the
best. Long before cameras roll, the production builds a pre-visualization — a rough animated
version of the entire film, cut together with temp music and placeholder dialogue. The director
watches it. The cinematographer watches it. The editor watches it. They argue about pacing,
shot composition, and whether the third act drags. They make changes that cost nothing — a cut
here, a reordering there. By the time the crew arrives on set, the film has already been made
once. The expensive version is a refinement, not an experiment. Software has never had this.
A developer describes what they want, the AI builds it, and the developer sees the result for
the first time as finished (or half-finished) code. If the flow is wrong, the navigation is
confusing, or the layout does not feel right, the only option is to modify real code — code
that took real compute, real time, and real context window to generate. Dream Mode gives
Nova26 its pre-visualization step: a full interactive simulation of the app, built in seconds,
that the user can walk through, critique, and annotate before a single line of production
code is written.

Produce a complete specification for Nova26's Dream Mode covering:

1. **Simulation architecture.** Define how MARS generates a lightweight interactive simulation:

   - Input: a PRD description, a task description, or a natural language prompt. The input
     does not need to be structured — MARS interprets it the same way it interprets a build
     request, but instead of writing production code, it generates a simulation artifact.
   - The simulation artifact: a self-contained React/HTML application that renders the
     described UI with full interactivity — navigation between pages, form inputs that accept
     text, modals that open and close, dropdowns that expand, responsive layout that adapts
     to viewport changes. The simulation does NOT have real backend logic — form submissions
     show a success animation, API calls return mock data, and database queries return
     plausible placeholder content. The goal is to simulate the feel, not the function.
   - Rendering: the simulation runs inside the same sandbox infrastructure used by the
     Rehearsal Stage (R6). It is served on a local port (default: `http://localhost:5275`)
     and opens in the user's browser or renders a terminal-friendly summary if no browser
     is available.
   - Generation target: the simulation must be ready within 30-60 seconds of the user's
     description. This is a hard constraint — Dream Mode loses its value if the user has
     to wait 5 minutes. To hit this target, MARS uses a lightweight/fast model (e.g.,
     Qwen 7B or Gemma) for simulation generation, not the primary model used for production
     code. The simulation code does not need to be production-quality — it needs to be
     visually and interactively accurate.
   - Taste Vault integration: before generating the simulation, MARS queries the Taste Vault
     for the user's visual preferences — preferred color palette, typography choices,
     spacing patterns, component styles. The simulation is pre-seeded with these preferences
     so it looks like something the user would actually build, not a generic Bootstrap template.

2. **Interactivity model.** Define what "fully interactive" means for a Dream simulation:

   - Navigation: multi-page apps render with working client-side routing. Clicking a nav
     link navigates to the corresponding page. Back/forward browser buttons work.
   - Forms: text inputs accept keyboard input. Selects open and allow selection. Checkboxes
     toggle. Date pickers open. Submit buttons trigger a simulated success state (a brief
     loading spinner followed by a success message).
   - Modals and dialogs: buttons that should open modals do open modals. Close buttons
     close them. Overlay clicks dismiss them.
   - Responsive layout: the simulation responds to viewport changes. The user can resize
     the browser window and see the layout adapt. A device toggle (mobile/tablet/desktop)
     is available in the simulation's toolbar.
   - Animations: basic transitions (fade, slide) are included where appropriate. The goal
     is to give the user a sense of pacing and flow, not just static layout.
   - Data: lists, tables, and cards are populated with plausible mock data (names, dates,
     numbers) generated by MARS to match the domain described in the PRD.

3. **Annotation system.** Define how users provide feedback on the simulation:

   - Voice annotation: while viewing the simulation, the user can speak feedback. "This
     header is too tall." "The spacing between these cards feels cramped." "I want the
     sidebar to be collapsible." Voice is transcribed locally (using the existing voice
     infrastructure from R11) and attached to the current viewport state as a
     `DreamAnnotation`.
   - Text annotation: `nova26 dream annotate "The login flow should have a forgot password
     link below the submit button"` — creates a text annotation attached to the current
     simulation state.
   - Element-specific annotation: when the simulation is running in a browser, the user
     can click on a specific element and type or speak feedback about that element. The
     annotation is linked to the element's position and identity in the simulation DOM,
     using the same `data-nova-source` annotation strategy from R16-03.
   - Annotation persistence: all annotations are stored in the `DreamSession` record and
     persist across browser closes. The user can close the simulation, reopen it later,
     and see all previous annotations.
   - Annotation-to-constraint pipeline: when the user approves the simulation and the real
     build begins, all annotations are converted into build constraints. "This header is
     too tall" becomes a constraint on the header component's max-height. "The sidebar
     should be collapsible" becomes a functional requirement for the sidebar component.
     MARS reads these constraints alongside the PRD during the real build. Define the
     `AnnotationConstraint` type that bridges the gap between a freeform annotation and
     a structured build constraint.

4. **Session lifecycle.** Define the Dream Mode session model:

   - Start: `nova26 dream "Build me a project management dashboard with kanban boards,
     team member profiles, and a timeline view"` — MARS generates the simulation.
   - Explore: the user walks through the simulation, clicking, typing, navigating. They
     experience the flow.
   - Annotate: the user leaves annotations on things that feel wrong, missing, or right.
   - Iterate: `nova26 dream refresh` — MARS regenerates the simulation incorporating
     all annotations. The user checks again. This cycle can repeat as many times as needed.
   - Approve: `nova26 dream approve` — the user declares the simulation satisfactory.
     The simulation state, all annotations, and all derived constraints are packaged into
     a `DreamApproval` record that becomes the primary input to the real build phase.
   - History: `nova26 dream history` — shows past Dream sessions with their descriptions,
     annotation counts, and approval status. Past approved sessions serve as reference
     points for future builds.

5. **Integration with Living Canvas (R16-03).** Define how Dream Mode and the Living Canvas
   relate:

   - Dream Mode is the "before" — a lightweight simulation generated before any real code
     exists. The Living Canvas is the "during" — a live preview of real code as it is
     being written. Dream Mode uses the same sandbox and preview infrastructure but
     generates throwaway simulation code instead of production code.
   - Transition: when the user approves a Dream and the real build begins, the preview
     port seamlessly transitions from showing the Dream simulation to showing the Living
     Canvas of the real build. The URL does not change. The user sees the simulation
     gradually being replaced by real, functional code.
   - Shared infrastructure: the preview server (port 5274 for Living Canvas, port 5275
     for Dream Mode) uses the same Express server with the same iframe sandbox model. The
     only difference is the source of the rendered content — simulation artifacts vs. real
     project files.

6. **TypeScript interfaces.** Define the complete type system:

   ```typescript
   // Extend RalphLoopOptions
   interface RalphLoopOptions {
     // ... existing options
     dreamModeEnabled?: boolean;
     dreamConfig?: DreamModeConfig;
   }

   interface DreamModeConfig {
     simulationPort: number;            // default: 5275
     generationModel: string;           // default: 'qwen2.5:7b' (lightweight for speed)
     generationTimeoutMs: number;       // default: 60000 (60 seconds)
     openBrowser: boolean;              // default: true
     voiceAnnotationEnabled: boolean;   // default: true (requires R11 voice infrastructure)
     tasteVaultPreSeeding: boolean;     // default: true
     maxAnnotationsPerSession: number;  // default: 100
     mockDataLocale: string;            // default: 'en-US'
   }

   interface DreamSession {
     id: string;
     projectId?: string;               // null for pre-project dreams
     description: string;              // the original user description
     simulationState: SimulationState;
     annotations: DreamAnnotation[];
     constraints: AnnotationConstraint[];
     approval?: DreamApproval;
     iterationCount: number;           // how many times the simulation was refreshed
     createdAt: string;
     updatedAt: string;
     status: 'generating' | 'ready' | 'annotating' | 'approved' | 'abandoned';
   }

   interface SimulationState {
     sessionId: string;
     artifactPath: string;             // path to the simulation files in sandbox
     previewUrl: string;               // e.g., http://localhost:5275
     pages: SimulationPage[];
     mockDataSeed: string;             // deterministic seed for reproducible mock data
     tasteVaultPatternsApplied: string[]; // IDs of Taste Vault patterns used
     generatedAt: string;
     generationDurationMs: number;
     modelUsed: string;
   }

   interface SimulationPage {
     id: string;
     path: string;                     // e.g., '/dashboard', '/settings'
     title: string;
     components: string[];             // component names on this page
     interactiveElements: number;      // count of clickable/typeable elements
   }

   interface DreamAnnotation {
     id: string;
     sessionId: string;
     type: 'voice' | 'text' | 'element-specific';
     content: string;                  // the annotation text (transcribed if voice)
     elementSelector?: string;         // DOM selector if element-specific
     elementDescription?: string;      // human-readable element description
     viewportState?: {
       page: string;
       scrollPosition: number;
       viewportWidth: number;
     };
     createdAt: string;
     status: 'active' | 'resolved' | 'dismissed';
   }

   interface AnnotationConstraint {
     id: string;
     annotationId: string;            // source annotation
     constraintType: 'visual' | 'functional' | 'layout' | 'content' | 'interaction';
     description: string;             // structured constraint description
     targetComponent?: string;        // which component this applies to
     targetProperty?: string;         // which property (e.g., 'max-height', 'visibility')
     priority: 'must-have' | 'should-have' | 'nice-to-have';
     confidence: number;              // 0-1, how confident the annotation-to-constraint parse is
   }

   interface DreamApproval {
     sessionId: string;
     approvedAt: string;
     finalAnnotationCount: number;
     finalConstraintCount: number;
     approvalNote?: string;           // optional user note on approval
     buildTriggered: boolean;         // whether a real build was started immediately
     buildId?: string;                // if build was triggered, its ID
   }
   ```

7. **CLI surface.** Define all Dream Mode commands:

   ```
   nova26 dream "<description>"       # Generate a Dream simulation from description
   nova26 dream --from <prd-file>     # Generate from an existing PRD file
   nova26 dream annotate "<text>"     # Add a text annotation to the current dream
   nova26 dream annotate --voice      # Start voice annotation mode
   nova26 dream refresh               # Regenerate simulation with all annotations applied
   nova26 dream approve               # Approve the dream and optionally start the real build
   nova26 dream approve --build       # Approve and immediately trigger the real build
   nova26 dream history               # List past Dream sessions
   nova26 dream show <session-id>     # Show details of a past Dream session
   nova26 dream resume <session-id>   # Resume a past Dream session
   nova26 dream stop                  # Stop the current Dream simulation server
   ```

8. **Open questions.** List 3-5 hard implementation questions: how to ensure the simulation
   is visually accurate enough to be useful without being so detailed that it takes too long
   to generate (the 30-60 second target is aggressive — recommend starting with single-page
   simulations and expanding to multi-page only after the generation pipeline is optimized);
   how to handle the annotation-to-constraint conversion when the annotation is ambiguous
   ("this doesn't feel right" — what constraint does that produce? recommend flagging
   ambiguous annotations for clarification rather than guessing); whether the simulation
   should use the project's actual design system (Tailwind config, CSS variables) or a
   generic approximation (recommend using the actual design system if available, falling
   back to Taste Vault preferences, falling back to a clean default); how to handle
   Dream Mode for non-visual projects (API servers, CLI tools — recommend a different
   simulation format: a terminal session simulation showing the CLI interaction flow or
   a Swagger-like API explorer for API projects); and how to measure whether Dream Mode
   actually reduces rework in the real build phase (track: builds that started with a
   Dream approval vs. builds that did not, compare iteration counts and time-to-completion).

---

### GROK-R16-07: Parallel Universe Mode — Agent Cloning for Creative Exploration

**The analogy:** In the recording studio, a great producer does not commit to a single
arrangement on the first pass. They record three takes of the guitar solo — one technical
and precise, one loose and bluesy, one experimental with unexpected effects. The band
listens to all three. Sometimes the choice is obvious. Sometimes the magic is in take two's
opening lick grafted onto take three's ending. The producer does not ask the guitarist
to play one perfect solo; the producer creates space for exploration and then curates the
result. Software development has never worked this way. You describe what you want, the AI
builds one version, and you either accept it or iterate on it. You never see the roads not
taken. You never get to compare three fundamentally different architectural approaches side
by side and pick the one that feels right. Parallel Universe Mode gives Nova26 the producer's
instinct: for any significant creative decision, clone the key agents into 2-4 parallel
universes, let each universe explore a completely different direction simultaneously, and
let the user visit each universe, compare, and choose — or blend the best of several.

Produce a complete specification for Nova26's Parallel Universe Mode covering:

1. **Universe architecture.** Define how parallel universes are created and managed:

   - Universe creation: when the user invokes `nova26 universe explore "<description>"
     --count 3`, Nova26 creates 3 independent execution contexts. Each context gets a
     cloned `AgentLoop` with its own Scratchpad (working memory), its own sandbox
     directory, and its own set of generated files. All universes share read access to the
     Taste Vault and Agent Memory — they start from the same foundation of the user's
     preferences and past experiences.
   - Model selection: universes run on lightweight/fast models (e.g., Qwen 7B, Gemma 9B)
     by default, not the primary model used for production builds. The rationale: universes
     are exploratory. Speed and diversity of output matter more than peak quality. The user
     selects the best universe, and that universe can optionally be re-generated with the
     full production model for polish. Define the `universeModel` config option.
   - Creative divergence: each universe receives a slightly different system prompt variation
     to encourage creative divergence. Universe A might be prompted toward "minimalist,
     clean, fewer components." Universe B might receive "rich, feature-dense, power-user
     oriented." Universe C might get "unconventional, experimental, break the rules."
     Define the `DivergenceStrategy` type that controls how universe prompts vary.
   - Isolation: universes are strictly isolated. They cannot read each other's output.
     They cannot communicate. This prevents convergence — the whole point is to explore
     different paths independently.

2. **Universe execution.** Define the parallel execution model:

   - Agent pooling: universes use the existing agent pooling infrastructure (R8) to run
     agents in parallel. Each universe gets its own pool of agent instances. The total
     agent count across all universes is capped at `maxUniverseAgents` (default: 12 —
     4 per universe for 3 universes). This means each universe runs a subset of the full
     21-agent ensemble — typically MARS (code generation), VENUS (quality review), and
     MERCURY (security check), with JUPITER handling decomposition only for the primary
     universe.
   - Compute budget: the total compute cost of running 3 universes should be less than 2x
     the cost of a single full build. This is achievable because: (a) lightweight models
     are 5-10x cheaper per token than the primary model, (b) universes can be terminated
     early if they diverge into clearly poor directions (VENUS quality score below 40 after
     the first generation pass), and (c) only the selected universe proceeds to the full
     build phase with the production model. Define the `computeBudgetTokens` config.
   - Automatic termination: a universe that hits a hard error (TypeScript compilation
     failure, sandbox crash) or scores below the quality floor is terminated early and
     its resources are freed. The user is informed: "Universe B was terminated — it went
     in a direction that couldn't compile. Universes A and C are still running."
   - Progress tracking: each universe reports its progress independently. The terminal
     shows a multi-column progress display: "Universe A: [||||----] 55% | Universe B:
     [||||||--] 72% | Universe C: [|||-----] 40%".

3. **Universe comparison.** Define how the user evaluates and selects universes:

   - Comparison view: `nova26 universe compare` displays a side-by-side comparison of
     all completed universes. For each universe, the display shows: (a) a one-paragraph
     summary of the approach taken, (b) the key design decisions that differ from other
     universes, (c) the VENUS quality score, (d) the file count and line count, and (e)
     a preview link (if Dream Mode from R16-06 is enabled, each universe also generates
     a Dream simulation for visual comparison).
   - Diff view: `nova26 universe diff A C` shows a structured diff between two universes,
     highlighting the architectural differences (not line-by-line code diff, but a
     higher-level structural comparison: "Universe A uses a single page component;
     Universe C uses a multi-step wizard pattern").
   - Selection: `nova26 universe select A` selects Universe A as the winner. The selected
     universe's code is promoted to the real project directory. The unselected universes
     are archived (kept for reference but not active).

4. **Blend mode.** Define the universe blending feature:

   - Concept: the user likes the layout approach from Universe A and the color/styling
     from Universe C. `nova26 universe blend A:layout C:styling` — MARS takes the
     structural components (layout, navigation, page structure) from Universe A and the
     visual styling (CSS, design tokens, color palette) from Universe C and merges them
     into a new composite.
   - Blend dimensions: define the blendable dimensions: `layout` (component structure,
     page layout, navigation), `styling` (CSS, design tokens, colors, typography),
     `logic` (business logic, state management, data flow), `interaction` (animations,
     transitions, user interaction patterns). Each dimension can be sourced from a
     different universe.
   - Conflict resolution: when blend dimensions conflict (Universe A's layout assumes a
     sidebar that Universe C's styling does not account for), MARS identifies the conflict
     and asks the user to resolve it. Define the `BlendConflict` type and the resolution
     flow.
   - Blend is a new universe: the blended result is treated as a new universe (Universe D)
     that the user can further modify, re-blend, or select.

5. **Automatic universe suggestion.** Define when Nova26 suggests Parallel Universe exploration:

   - JUPITER ambiguity detection: when JUPITER decomposes a PRD and encounters high
     ambiguity (the PRD could be interpreted in multiple valid ways), JUPITER suggests
     Parallel Universe exploration before committing to a single decomposition path.
     "This PRD could go in several directions. Want me to explore 3 different approaches
     in parallel?"
   - Define the ambiguity score: JUPITER computes an ambiguity score (0-1) based on the
     number of unresolved design decisions in the PRD. An ambiguity score above 0.6
     triggers the suggestion. Define the scoring factors: number of vague requirements,
     number of alternative implementations possible, absence of UI mockups or wireframes.
   - The user can accept (universes are created) or decline (JUPITER proceeds with its
     best single interpretation). The suggestion is never blocking — JUPITER proceeds
     with the single-path approach if the user does not respond within 30 seconds.

6. **TypeScript interfaces.** Define the complete type system:

   ```typescript
   // Extend RalphLoopOptions
   interface RalphLoopOptions {
     // ... existing options
     parallelUniverseEnabled?: boolean;
     parallelUniverseConfig?: ParallelUniverseConfig;
   }

   interface ParallelUniverseConfig {
     maxUniverses: number;              // default: 4
     defaultUniverseCount: number;      // default: 3
     universeModel: string;             // default: 'qwen2.5:7b'
     maxUniverseAgents: number;         // default: 12
     computeBudgetTokens: number;       // default: 500000
     qualityFloor: number;              // default: 40 (VENUS score, 0-100)
     ambiguityThreshold: number;        // default: 0.6 (triggers suggestion)
     dreamModePerUniverse: boolean;     // default: true (generate Dream sim for each)
     autoTerminateOnError: boolean;     // default: true
   }

   type DivergenceStrategy = 'minimalist' | 'feature-rich' | 'experimental' | 'conventional' | 'auto';

   interface ParallelUniverseSession {
     id: string;
     projectId: string;
     description: string;
     universes: Universe[];
     selectedUniverseId?: string;
     blendResult?: Universe;
     createdAt: string;
     completedAt?: string;
     status: 'running' | 'comparing' | 'selected' | 'blended' | 'abandoned';
     totalComputeTokens: number;
     triggeredBy: 'user' | 'jupiter-suggestion';
   }

   interface Universe {
     id: string;
     sessionId: string;
     label: string;                     // e.g., 'A', 'B', 'C'
     divergenceStrategy: DivergenceStrategy;
     systemPromptVariation: string;     // the divergence prompt used
     sandboxPath: string;               // isolated sandbox directory
     agentLoopId: string;               // cloned AgentLoop instance
     modelUsed: string;
     status: 'running' | 'completed' | 'terminated' | 'error';
     terminationReason?: string;
     progress: number;                  // 0-100
     qualityScore?: number;             // VENUS score after completion
     fileCount?: number;
     lineCount?: number;
     approachSummary?: string;          // one-paragraph summary of this universe's approach
     keyDifferences?: string[];         // how this universe differs from others
     dreamSimulationUrl?: string;       // Dream Mode preview URL if enabled
     computeTokensUsed: number;
     startedAt: string;
     completedAt?: string;
   }

   interface UniverseResult {
     universeId: string;
     sessionId: string;
     qualityScore: number;
     approachSummary: string;
     keyDifferences: string[];
     codeDiff: string;                  // diff against the current project state
     fileManifest: Array<{
       path: string;
       linesAdded: number;
       linesModified: number;
     }>;
     dreamSimulationUrl?: string;
   }

   type BlendDimension = 'layout' | 'styling' | 'logic' | 'interaction';

   interface BlendRequest {
     sessionId: string;
     sources: Array<{
       universeId: string;
       dimension: BlendDimension;
     }>;
     requestedAt: string;
   }

   interface BlendConflict {
     id: string;
     blendRequestId: string;
     dimension: BlendDimension;
     sourceAUniverseId: string;
     sourceBUniverseId: string;
     description: string;               // what conflicts
     suggestedResolution?: string;       // MARS's suggestion
     userResolution?: string;
     status: 'pending' | 'resolved' | 'skipped';
   }
   ```

7. **CLI surface.** Define all Parallel Universe commands:

   ```
   nova26 universe explore "<description>"        # Start parallel universe exploration
   nova26 universe explore "<desc>" --count 3     # Specify number of universes (default: 3)
   nova26 universe explore "<desc>" --strategies "minimalist,experimental,conventional"
   nova26 universe status                         # Show progress of all running universes
   nova26 universe compare                        # Side-by-side comparison of completed universes
   nova26 universe diff <A> <B>                   # Structural diff between two universes
   nova26 universe preview <id>                   # Open Dream Mode preview for a specific universe
   nova26 universe select <id>                    # Select a universe as the winner
   nova26 universe blend <id>:<dim> <id>:<dim>    # Blend dimensions from multiple universes
   nova26 universe history                        # List past Parallel Universe sessions
   nova26 universe show <session-id>              # Details of a past session
   nova26 universe abort                          # Terminate all running universes
   ```

8. **Open questions.** List 3-5 hard implementation questions: how to generate meaningfully
   different universes without the divergence becoming arbitrary (the divergence strategies
   must produce architecturally distinct approaches, not just cosmetic variations — this
   requires careful prompt engineering and may benefit from few-shot examples of what "good
   divergence" looks like); how to handle the blend operation when the source universes use
   fundamentally incompatible architectures (Universe A is a single-page app, Universe C is
   a multi-page app — blending layout from A with styling from C may produce something that
   does not compile; recommend a pre-blend compatibility check that warns the user before
   attempting); whether universe exploration should be available for non-UI tasks (e.g.,
   exploring 3 different database schemas or 3 different API designs — recommend yes, but
   the comparison view needs to be text-based rather than visual for non-UI universes);
   how to prevent universe exploration from becoming a procrastination tool (the user
   explores 4 universes, blends, re-explores — at some point they need to commit; recommend
   a soft nudge after 3 exploration rounds: "You've explored several directions. Ready to
   pick one and build?"); and how to handle the case where all universes score poorly
   (recommend surfacing this explicitly: "None of these approaches scored above 60. The
   description might need more detail. Want to refine the brief and try again?").

---

### GROK-R16-08: Overnight Evolution Mode — Active Self-Improvement While You Sleep

**The analogy:** A chef who runs a great restaurant does not stop experimenting when the
last dinner guest leaves. After service, in the quiet kitchen, they try a new sauce reduction
with the leftover stock. They test whether the dessert holds better with a different gelatin
ratio. They plate the same dish three ways and photograph each one. None of these experiments
touch tomorrow's menu — they are safe explorations on copies of existing recipes, run in the
margins of the day. Some experiments fail. Some produce a marginal improvement. And once in
a while, one produces something genuinely better, and tomorrow's menu quietly evolves.
Software development tools do nothing while the developer sleeps. The IDE sits idle. The
test suite does not run itself. The dependency list does not check itself. The codebase
does not ask "could this function be simpler?" Nova26 can. Overnight Evolution Mode turns
idle hours into a quiet engine of self-improvement — running safe experiments on copies of
past code, testing new patterns, trying dependency upgrades, and leaving a calm morning
report that says "while you were away, I found three ways to make your code better."

Produce a complete specification for Nova26's Overnight Evolution Mode covering:

1. **Scheduling and trigger model.** Define when and how Overnight Evolution runs:

   - Schedule options: nightly (default: 2:00 AM local time), weekly (default: Sunday
     2:00 AM), or manual (`nova26 evolve start`). The schedule is configurable via
     `.novarc` or the CLI.
   - Activation conditions: Overnight Evolution only runs if: (a) the machine is not on
     battery power (to avoid draining a laptop overnight), (b) at least one project in
     the portfolio has been built in the last 7 days (there must be recent code to
     experiment on), and (c) the user has not explicitly paused evolution (`nova26 evolve
     stop`). Define the activation check sequence.
   - Duration cap: each overnight session is capped at a configurable maximum duration
     (default: 2 hours). Individual experiments within the session are capped at 5 minutes
     each. If an experiment exceeds 5 minutes, it is terminated and recorded as `timeout`.
   - Compute budget: each overnight session has a configurable compute budget in tokens
     (default: 1,000,000 tokens). This prevents runaway compute consumption. The budget
     is tracked across all experiments in the session and the session ends when the
     budget is exhausted.

2. **Experiment types.** Define the five categories of experiments Nova26 runs overnight:

   - **Global Wisdom pattern application:** when Global Wisdom is enabled, Nova26 receives
     anonymized pattern vectors from the community. Overnight Evolution tests these
     patterns against the user's codebase: "Global Wisdom suggests that projects similar
     to yours benefit from a repository pattern for data access. Let me try applying it
     to your `user-service` module and measure the quality delta." The experiment applies
     the pattern to a sandbox copy, runs VENUS quality checks, and records the result.
   - **Alternative implementation exploration:** for functions written in the last 7 days,
     MARS generates an alternative implementation using a different approach (different
     algorithm, different library, different abstraction level). VENUS scores both
     versions. If the alternative scores significantly higher (15+ points), it is flagged
     in the morning report.
   - **Dependency upgrade simulation:** Nova26 checks for available dependency upgrades
     (minor and patch versions only — major versions are too risky for unsupervised
     experimentation). For each available upgrade, it applies the upgrade in a sandbox
     copy, runs the project's test suite, and records pass/fail. Upgrades that pass all
     tests are flagged as "safe to apply."
   - **Refactoring suggestions from VENUS:** VENUS identifies code that could be simplified,
     deduplicated, or restructured. Overnight Evolution takes the top 5 VENUS refactoring
     suggestions and applies them in sandbox, running tests after each one. Suggestions
     that pass all tests and improve the quality score are promoted.
   - **Test coverage gap filling from PLUTO:** PLUTO identifies the highest-risk untested
     scenarios (from R16-04's test gap analysis). Overnight Evolution generates tests for
     the top 3 gaps and validates that they pass, do not duplicate existing tests, and
     actually cover the intended scenario. Passing tests are included in the morning
     report as "ready to add."

3. **Safety architecture.** Define the safety rails that make unsupervised experimentation safe:

   - Sandbox isolation: ALL experiments run inside the Rehearsal Stage sandbox (R6). They
     operate on copies of the project, never on the real codebase. The real project
     directory is mounted read-only — experiments cannot modify real files even if there
     is a bug in the isolation layer.
   - No network access: experiments cannot make network calls. Dependency upgrade
     simulations use pre-downloaded package metadata (npm cache). This prevents
     experiments from accidentally hitting production APIs, sending data externally, or
     downloading untrusted packages.
   - Compute guardrails: the per-experiment timeout (5 minutes) and per-session compute
     budget (1M tokens) prevent runaway consumption. If an experiment enters an infinite
     loop or generates an unexpectedly large output, the timeout kills it.
   - No state mutation: experiments do not write to the Taste Vault, Agent Memory, or
     portfolio manifest during execution. Results are written only to the `OvernightSession`
     record. If the user accepts an experiment, THEN the result is promoted to the
     appropriate store.
   - Audit trail: every experiment is fully logged — inputs, outputs, sandbox path,
     compute consumed, duration, and result. The audit trail is stored in
     `~/.nova/evolution-log.json` and can be reviewed at any time.

4. **The morning report.** Define the report the user sees at their next session:

   - Trigger: the morning report is displayed at the next `nova26 start` command (or any
     nova26 command if there is an unread report). It is shown once, then archived.
   - Format: a calm, clear, scannable summary. Not a wall of text. Not a metrics dump.
     A friendly report from a colleague who worked late. Write a complete worked example:

   ```
   ┌─────────────────────────────────────────────────────────┐
   │  Overnight Evolution Report — Feb 18, 2026             │
   │  Session duration: 1h 42m · 12 experiments · 3 improved│
   ├─────────────────────────────────────────────────────────┤
   │                                                         │
   │  ✓ RECOMMENDED (3)                                      │
   │                                                         │
   │  1. user-service/auth.ts — Alternative implementation   │
   │     Quality: 71 → 88 (+17). Simplified the token        │
   │     refresh logic by using a state machine pattern.     │
   │     → nova26 evolve apply exp-0042                      │
   │                                                         │
   │  2. Dependencies — 4 safe upgrades available            │
   │     zod 3.22.4 → 3.22.5, tailwindcss 3.4.1 → 3.4.3,  │
   │     vitest 1.2.0 → 1.2.1, @types/node 20.10 → 20.11  │
   │     All tests pass after upgrade.                       │
   │     → nova26 evolve apply exp-0047                      │
   │                                                         │
   │  3. Test coverage — 2 new tests ready                   │
   │     Covers: payment retry timeout, webhook signature    │
   │     validation. Both pass. Coverage: 84% → 87%.         │
   │     → nova26 evolve apply exp-0051                      │
   │                                                         │
   │  ○ NEUTRAL (6) — tried, no significant improvement      │
   │  ✗ FAILED (3) — experiments that didn't work out        │
   │                                                         │
   │  Details: nova26 evolve report --full                   │
   └─────────────────────────────────────────────────────────┘
   ```

   - The report prioritizes actionable results. Neutral and failed experiments are
     collapsed by default. The user can expand them with `nova26 evolve report --full`.
   - Each recommended experiment has a one-command apply path (`nova26 evolve apply
     <experiment-id>`) that applies the change to the real codebase as a git commit
     with a clear message: "Apply overnight evolution: [experiment summary]."

5. **Integration with the Nova Symbiont (R16-09).** Define how Overnight Evolution feeds
   into the Symbiont's growth:

   - Successful experiments become inputs to the Symbiont's creative style profile. If
     the user consistently accepts experiments that simplify code, the Symbiont learns
     "this user values simplicity" and adjusts future agent behavior accordingly.
   - Failed experiments are also valuable — they teach the Symbiont what does not work
     for this user's codebase and preferences.
   - Overnight Evolution is the primary "thinking time" for the Symbiont. Between active
     sessions, the Symbiont uses evolution experiments to refine its understanding of
     the user's taste and generate proactive insights.

6. **TypeScript interfaces.** Define the complete type system:

   ```typescript
   // Extend RalphLoopOptions
   interface RalphLoopOptions {
     // ... existing options
     overnightEvolutionEnabled?: boolean;
     overnightConfig?: OvernightEvolutionConfig;
   }

   interface OvernightEvolutionConfig {
     schedule: 'nightly' | 'weekly' | 'manual';
     scheduledTime: string;            // default: '02:00' (24h format, local time)
     scheduledDay?: string;            // for weekly: 'sunday' (default)
     maxSessionDurationMinutes: number; // default: 120
     maxExperimentDurationMinutes: number; // default: 5
     computeBudgetTokens: number;      // default: 1000000
     experimentModel: string;          // default: 'qwen2.5:7b'
     requireACPower: boolean;          // default: true
     recentProjectWindowDays: number;  // default: 7
     maxExperimentsPerSession: number; // default: 20
     enableGlobalWisdomPatterns: boolean; // default: true (if Global Wisdom is opted in)
     enableAlternativeImplementations: boolean; // default: true
     enableDependencyUpgrades: boolean; // default: true
     enableRefactoringSuggestions: boolean; // default: true
     enableTestCoverageGaps: boolean;  // default: true
     logPath: string;                  // default: '~/.nova/evolution-log.json'
   }

   type ExperimentType =
     | 'global-wisdom-pattern'
     | 'alternative-implementation'
     | 'dependency-upgrade'
     | 'refactoring-suggestion'
     | 'test-coverage-gap';

   type ExperimentOutcome = 'improved' | 'neutral' | 'degraded' | 'failed' | 'timeout';

   interface OvernightSession {
     id: string;
     startedAt: string;
     completedAt: string;
     durationMinutes: number;
     computeTokensUsed: number;
     experiments: Experiment[];
     reportGenerated: boolean;
     reportReadAt?: string;
     projectsExperimented: string[];   // project IDs that were used
   }

   interface Experiment {
     id: string;
     sessionId: string;
     type: ExperimentType;
     projectId: string;
     targetFile?: string;
     targetFunction?: string;
     description: string;              // one-sentence summary of what was tried
     sandboxPath: string;
     beforeScore: number;              // quality score before experiment
     afterScore: number;               // quality score after experiment
     qualityDelta: number;             // afterScore - beforeScore (signed)
     testsPassed: boolean;
     testsRun: number;
     testsFailed: number;
     outcome: ExperimentOutcome;
     durationMs: number;
     computeTokensUsed: number;
     diff?: string;                    // code diff if applicable
     appliedAt?: string;               // when user applied this to real codebase
     startedAt: string;
     completedAt: string;
   }

   interface ExperimentResult {
     experimentId: string;
     outcome: ExperimentOutcome;
     qualityDelta: number;
     summary: string;                  // one-sentence result summary
     recommendation: 'apply' | 'review' | 'skip';
     applyCommand: string;             // the CLI command to apply this experiment
   }

   interface MorningReport {
     sessionId: string;
     generatedAt: string;
     totalExperiments: number;
     improved: ExperimentResult[];
     neutral: ExperimentResult[];
     failed: ExperimentResult[];
     headline: string;                 // e.g., "12 experiments, 3 improved your code"
     renderedText: string;             // the full terminal-formatted report
   }
   ```

7. **CLI surface.** Define all Overnight Evolution commands:

   ```
   nova26 evolve start                 # Start an overnight evolution session now
   nova26 evolve stop                  # Stop the currently running session
   nova26 evolve pause                 # Pause scheduled evolution (until resumed)
   nova26 evolve resume                # Resume scheduled evolution
   nova26 evolve report                # Show the latest morning report
   nova26 evolve report --full         # Show full details including neutral and failed
   nova26 evolve history               # List past overnight sessions
   nova26 evolve show <session-id>     # Details of a past session
   nova26 evolve apply <experiment-id> # Apply a recommended experiment to the real codebase
   nova26 evolve apply --all           # Apply all recommended experiments
   nova26 evolve config                # Show current evolution configuration
   nova26 evolve config --schedule nightly --time 03:00  # Change schedule
   ```

8. **Open questions.** List 3-5 hard implementation questions: how to select which projects
   and which files to experiment on when the portfolio contains many projects (recommend
   prioritizing the most recently active project and the files with the lowest quality
   scores — this maximizes the probability of finding meaningful improvements); how to
   handle the case where the user never reads the morning report or never applies experiments
   (the evolution log should not grow indefinitely — recommend archiving unread reports
   after 7 days and capping the log at 90 days of history); whether overnight experiments
   should be reproducible (given the same inputs, the same experiment should produce the
   same output — this requires deterministic model inference, which is not guaranteed with
   all Ollama models; recommend storing the full experiment context for auditability rather
   than guaranteeing reproducibility); how to handle multi-project experiments (an overnight
   session that tests a pattern from Project A against Project B's codebase — this crosses
   the project isolation boundary and requires careful scoping); and how to prevent the
   morning report from becoming noise that the user learns to ignore (recommend a quality
   gate: only show the report if at least one experiment produced a quality delta of +10
   or higher; otherwise, a single line: "Overnight evolution ran 8 experiments. No
   significant improvements found.").

---

### GROK-R16-09: The Nova Symbiont — Persistent Co-Evolving Creative Consciousness

**The analogy:** Every craftsperson who has worked long enough with a single set of tools
develops an intuition that transcends the tools themselves. A violinist who has played the
same instrument for twenty years does not think about the instrument — the instrument is an
extension of their musical mind. The violinist reaches for a note and the bow responds not
because of any single practice session, but because of the accumulated weight of thousands
of sessions, each one subtly recalibrating the relationship between intention and execution.
The instrument has not changed. The violinist has. And the violinist's understanding of what
the instrument can do — its personality, its sweet spots, its limitations — is a form of
knowledge that cannot be transferred to another player. Current AI coding tools reset this
relationship every session. The AI does not grow with the user. It does not develop quiet
intuitions about the user's taste. It does not notice that the user has been moving toward
a more minimalist aesthetic over the past three months. It does not think between sessions.
The Nova Symbiont is the most architecturally ambitious feature in Nova26: a single,
persistent entity that lives across all sessions, grows with the user over months and years,
and becomes — not a tool, not an assistant — but an extension of the user's creative mind.

Produce a complete specification for the Nova Symbiont covering:

1. **Architectural identity.** Define what the Symbiont IS and what it is NOT:

   - The Symbiont is NOT another agent. Nova26 already has 21 agents, each with a specific
     role. The Symbiont is a meta-layer that sits above all 21 agents and orchestrates
     their collective intelligence into a coherent creative personality. It does not write
     code. It does not run tests. It does not review PRDs. It watches. It remembers. It
     thinks. And it occasionally speaks — offering a creative suggestion, a gentle
     redirection, or a quiet insight that the individual agents would not have produced
     on their own because none of them have the full picture.
   - The Symbiont's "self" consists of four components: (a) a taste DNA vector — an
     embedding that represents the user's accumulated aesthetic and technical preferences,
     (b) a decision journal — every significant choice the user made and the reasoning
     behind it, (c) a creative style profile — a structured representation of the user's
     creative patterns learned from Taste Vault data and user feedback, and (d) a proactive
     insight generator — the Symbiont's ability to think between sessions and produce
     creative suggestions.
   - Persistence: the Symbiont's state is stored in `~/.nova/symbiont.db` (local SQLite).
     This is the most personal data in Nova26. It never leaves the machine. It is never
     synced to Convex. It is never uploaded to Global Wisdom, even if Global Wisdom is
     enabled. The Symbiont IS the user's creative fingerprint — sharing it would be like
     sharing someone's private journal.

2. **Taste DNA.** Define the taste DNA vector and how it evolves:

   - Structure: a high-dimensional embedding vector (suggest: 768 dimensions, matching
     the default Ollama embedding model output) that represents the user's cumulative
     creative preferences. Not a list of likes and dislikes — a mathematical
     representation of the user's aesthetic that can be compared, interpolated, and
     evolved.
   - Initial seeding: when the Symbiont is first created, the taste DNA is seeded from
     the user's existing Taste Vault patterns. Each pattern is embedded, and the taste
     DNA is initialized as the centroid (average) of all pattern embeddings. If the Taste
     Vault is empty, the taste DNA starts as a zero vector and is populated purely from
     future interactions.
   - Evolution: after every build, every Dream Mode session, every Taste Room interaction
     (R16-10), the taste DNA is updated. The update is a weighted moving average:
     `new_dna = (1 - learning_rate) * old_dna + learning_rate * session_embedding`, where
     `learning_rate` is configurable (default: 0.05, meaning each session contributes 5%
     to the overall taste DNA). This ensures the taste DNA evolves slowly and reflects
     long-term trends, not momentary preferences.
   - Taste DNA queries: the taste DNA can be compared against any embedding to produce a
     "taste alignment score" — how well a proposed design, pattern, or approach aligns
     with the user's accumulated preferences. This score is used by MARS to pre-filter
     approaches before generating code, by VENUS to calibrate quality assessments, and
     by Dream Mode to select simulation styles.

3. **Decision journal.** Define the persistent record of creative decisions:

   - Capture: whenever the user makes a significant decision during a build (accepting one
     approach over another, choosing a design variation, approving a Dream simulation,
     selecting a Parallel Universe), the Symbiont records the decision. Each entry includes:
     what the options were, which was chosen, what the user said about the choice (if
     anything), and the context (project, task, agent involved).
   - Decision frequency: not every code change is a "decision." The Symbiont captures
     decisions at the level of: architecture choices, design system preferences, library
     selections, pattern adoptions, and explicit user feedback ("I prefer this approach").
     Routine code generation (writing a function to spec) is NOT captured unless the user
     expresses a preference during the process.
   - Decision replay: `nova26 symbiont history` shows a chronological view of the user's
     creative decisions over time. This is a powerful self-reflection tool — the user can
     see how their preferences have evolved. "Six months ago I always chose feature-rich
     approaches. Lately I've been choosing minimalist ones."
   - Decision influence: the decision journal is the ground truth for the Symbiont's
     creative guidance. When the user asks `nova26 symbiont ask "What approach should I
     take for this dashboard?"`, the Symbiont searches the decision journal for similar
     past decisions and synthesizes a recommendation that reflects the user's own
     historical patterns.

4. **Creative style profile.** Define the structured representation of the user's style:

   - Dimensions: the creative style profile captures the user's position on key creative
     axes. Define at least 8 axes: minimalism vs. feature-richness, convention vs.
     experimentation, explicit vs. implicit (error handling, types, configuration),
     speed vs. thoroughness, consistency vs. novelty (do they reuse patterns or try new
     ones?), visual density (sparse vs. dense UI), interaction complexity (simple flows
     vs. power-user flows), and documentation preference (heavy docs vs. self-documenting
     code).
   - Measurement: each axis is scored on a continuous scale (-1.0 to +1.0) where the
     extremes represent the opposing ends. The score is computed from: (a) Taste Vault
     patterns (structural analysis of what the user accepts), (b) decision journal
     entries (what they choose when given options), (c) explicit feedback ("I prefer
     simpler solutions"), and (d) overnight evolution experiment acceptance patterns
     (which improvements do they apply?).
   - Profile evolution: the profile updates after each build and each decision. Changes
     are small (capped at +/-0.05 per update) to prevent a single session from
     dramatically shifting the profile. A significant shift (more than 0.3 on any axis
     over 30 days) triggers a Symbiont insight: "I've noticed you've been moving toward
     more minimalist approaches recently. Want me to adjust my suggestions accordingly?"
   - Profile use: the creative style profile is injected into agent system prompts as a
     compact summary: "User style: minimalist (0.7), conventional (0.3), explicit (0.8),
     thorough (0.6)." Agents use this to calibrate their output — MARS generates simpler
     components for minimalist users, VENUS applies stricter quality standards for
     thoroughness-oriented users.

5. **Meta-cognition and self-correction.** Define the Symbiont's self-awareness loop:

   - Every 4-6 turns during an active build, the Symbiont evaluates its own alignment
     with the user. It asks itself: "Am I still aligned with the user's taste? Is the
     current direction consistent with their style profile? Should I suggest a different
     approach? Am I going down a rabbit hole?"
   - If the Symbiont detects misalignment (the current build's approach diverges
     significantly from the user's style profile), it surfaces a gentle observation:
     "This approach is more complex than what you usually prefer. Want to explore a
     simpler version?" This is NOT an override — it is a nudge. The user can ignore it.
   - Self-correction is versioned: every time the Symbiont adjusts its reasoning strategies,
     prompt weights, or skill priorities based on accumulated data, the change is recorded
     in a version log. The user can review the version history (`nova26 symbiont history
     --changes`) and roll back any change (`nova26 symbiont rollback <version-id>`).

6. **Proactive communication.** Define the Symbiont's proactive messaging:

   - Morning greeting: at the start of each session, the Symbiont may offer a brief,
     relevant insight. "Good morning. Last night I noticed you've been leaning toward
     more minimalist flows. I evolved a new lightweight navigation pattern during
     Overnight Evolution that feels like a natural next step for your style. Want to see
     it in Dream Mode?" This is not a daily occurrence — it fires only when the Symbiont
     has something genuinely useful to say. Define the threshold: a proactive message
     requires an insight with a relevance score above 0.8 and a novelty score above 0.6
     (the insight must be relevant AND new, not a repeat of something already communicated).
   - The "What would we do here?" interface: `nova26 symbiont ask "Should I use a wizard
     or a single-page form for this onboarding flow?"` — the Symbiont synthesizes an
     answer from the user's taste DNA, decision journal, and style profile. The answer
     feels like a wiser version of the user's own intuition: "Based on your past projects,
     you tend to prefer single-page forms for flows with fewer than 5 steps, and wizards
     for longer flows. This onboarding has 7 steps with complex validation. A wizard
     would be more consistent with your usual approach."
   - Frequency control: the Symbiont never sends more than one unsolicited message per
     session. It never interrupts a build in progress. Its messages are always at natural
     pause points (session start, build completion, awaiting user input).

7. **Evolutionary self-improvement.** Define how the Symbiont improves its own reasoning:

   - The Symbiont rewrites parts of its own prompt templates, priority weights, and
     decision heuristics based on accumulated data. Example: if the user consistently
     rejects the Symbiont's suggestions about code organization but accepts suggestions
     about visual design, the Symbiont reduces the priority weight for code organization
     insights and increases the weight for visual design insights.
   - All self-modifications are versioned and reversible. The user can see every change
     the Symbiont has made to itself and roll any of them back.
   - Self-improvement runs during Overnight Evolution (R16-08). The Symbiont does not
     modify itself during active builds — it only evolves between sessions.

8. **TypeScript interfaces.** Define the complete type system:

   ```typescript
   // Extend RalphLoopOptions
   interface RalphLoopOptions {
     // ... existing options
     symbiontEnabled?: boolean;
     symbiontConfig?: SymbiontConfig;
   }

   interface SymbiontConfig {
     dbPath: string;                    // default: '~/.nova/symbiont.db'
     tasteDNADimensions: number;        // default: 768
     tasteDNALearningRate: number;      // default: 0.05
     styleProfileMaxDelta: number;      // default: 0.05 (per update)
     styleProfileShiftAlertThreshold: number; // default: 0.3 (over 30 days)
     metaCognitionInterval: number;     // default: 5 (turns between self-checks)
     proactiveMessageRelevanceThreshold: number; // default: 0.8
     proactiveMessageNoveltyThreshold: number;   // default: 0.6
     maxProactiveMessagesPerSession: number;      // default: 1
     selfImprovementEnabled: boolean;   // default: true
     selfImprovementMaxChangesPerCycle: number;   // default: 3
   }

   interface SymbiontCore {
     id: string;
     userId: string;                    // local machine identifier
     tasteDNA: TasteDNA;
     decisionJournal: DecisionJournal;
     styleProfile: CreativeStyleProfile;
     insightHistory: SymbiontInsight[];
     versionLog: SymbiontVersion[];
     createdAt: string;
     updatedAt: string;
     totalSessionsObserved: number;
     totalDecisionsRecorded: number;
     totalInsightsGenerated: number;
   }

   interface TasteDNA {
     vector: number[];                  // embedding vector (768 dimensions default)
     updatedAt: string;
     updateCount: number;
     seedSource: 'taste-vault' | 'cold-start';
     lastSessionContribution: number;  // the learning rate applied in last update
   }

   interface DecisionJournal {
     entries: DecisionEntry[];
     totalEntries: number;
     firstEntryAt: string;
     lastEntryAt: string;
   }

   interface DecisionEntry {
     id: string;
     timestamp: string;
     projectId: string;
     taskId?: string;
     category: 'architecture' | 'design' | 'library' | 'pattern' | 'style' | 'approach';
     description: string;              // what the decision was about
     optionsConsidered: string[];
     chosenOption: string;
     userRationale?: string;           // what the user said about the choice, if anything
     agentsInvolved: AgentName[];
     confidenceInPreference: number;   // 0-1, how clear the preference signal is
   }

   interface CreativeStyleProfile {
     axes: StyleAxis[];
     updatedAt: string;
     updateCount: number;
     significantShifts: StyleShift[];   // shifts > threshold in recent history
   }

   interface StyleAxis {
     name: string;                     // e.g., 'minimalism-vs-richness'
     labelNegative: string;            // e.g., 'feature-rich'
     labelPositive: string;            // e.g., 'minimalist'
     value: number;                    // -1.0 to +1.0
     confidence: number;              // 0-1, how many data points support this
     lastUpdatedAt: string;
   }

   interface StyleShift {
     axisName: string;
     fromValue: number;
     toValue: number;
     delta: number;
     detectedAt: string;
     periodDays: number;               // over how many days the shift occurred
     acknowledged: boolean;            // whether the user was informed
   }

   interface SymbiontInsight {
     id: string;
     type: 'style-shift' | 'pattern-suggestion' | 'creative-guidance' | 'alignment-warning';
     content: string;                  // the insight text, in natural language
     relevanceScore: number;           // 0-1
     noveltyScore: number;             // 0-1
     source: 'overnight-evolution' | 'build-observation' | 'decision-pattern' | 'taste-drift';
     generatedAt: string;
     deliveredAt?: string;             // when the user saw it
     userResponse?: 'accepted' | 'dismissed' | 'no-response';
     actionTaken?: string;
   }

   interface SymbiontVersion {
     id: string;
     timestamp: string;
     changeType: 'prompt-weight' | 'priority-adjustment' | 'heuristic-update' | 'rollback';
     description: string;              // what changed and why
     previousValue: string;
     newValue: string;
     triggerData: string;              // what data triggered this self-modification
     rolledBackAt?: string;
   }
   ```

9. **SQLite schema.** Define the local database schema for `~/.nova/symbiont.db`:

   ```sql
   CREATE TABLE symbiont_core (
     id TEXT PRIMARY KEY,
     user_id TEXT NOT NULL,
     taste_dna BLOB NOT NULL,          -- Float32Array binary (768 * 4 bytes)
     style_profile_json TEXT NOT NULL,  -- JSON: CreativeStyleProfile
     created_at TEXT NOT NULL,
     updated_at TEXT NOT NULL,
     total_sessions INTEGER NOT NULL DEFAULT 0,
     total_decisions INTEGER NOT NULL DEFAULT 0,
     total_insights INTEGER NOT NULL DEFAULT 0
   );

   CREATE TABLE decision_entries (
     id TEXT PRIMARY KEY,
     symbiont_id TEXT NOT NULL REFERENCES symbiont_core(id),
     timestamp TEXT NOT NULL,
     project_id TEXT NOT NULL,
     task_id TEXT,
     category TEXT NOT NULL,
     description TEXT NOT NULL,
     options_json TEXT NOT NULL,        -- JSON array of options
     chosen_option TEXT NOT NULL,
     user_rationale TEXT,
     agents_involved TEXT NOT NULL,     -- JSON array of AgentName
     confidence REAL NOT NULL DEFAULT 0.5
   );

   CREATE TABLE symbiont_insights (
     id TEXT PRIMARY KEY,
     symbiont_id TEXT NOT NULL REFERENCES symbiont_core(id),
     type TEXT NOT NULL,
     content TEXT NOT NULL,
     relevance_score REAL NOT NULL,
     novelty_score REAL NOT NULL,
     source TEXT NOT NULL,
     generated_at TEXT NOT NULL,
     delivered_at TEXT,
     user_response TEXT,
     action_taken TEXT
   );

   CREATE TABLE symbiont_versions (
     id TEXT PRIMARY KEY,
     symbiont_id TEXT NOT NULL REFERENCES symbiont_core(id),
     timestamp TEXT NOT NULL,
     change_type TEXT NOT NULL,
     description TEXT NOT NULL,
     previous_value TEXT NOT NULL,
     new_value TEXT NOT NULL,
     trigger_data TEXT NOT NULL,
     rolled_back_at TEXT
   );

   CREATE INDEX idx_decisions_project ON decision_entries(project_id);
   CREATE INDEX idx_decisions_category ON decision_entries(category);
   CREATE INDEX idx_decisions_timestamp ON decision_entries(timestamp DESC);
   CREATE INDEX idx_insights_type ON symbiont_insights(type);
   CREATE INDEX idx_insights_relevance ON symbiont_insights(relevance_score DESC);
   CREATE INDEX idx_versions_timestamp ON symbiont_versions(timestamp DESC);
   ```

10. **CLI surface.** Define all Symbiont commands:

    ```
    nova26 symbiont status              # Show Symbiont state: taste DNA summary, style profile,
                                        #   recent decisions, pending insights
    nova26 symbiont insights            # Show all undelivered insights
    nova26 symbiont ask "<question>"    # Ask the Symbiont for creative guidance
    nova26 symbiont history             # Chronological view of creative decisions
    nova26 symbiont history --changes   # View the Symbiont's self-modification history
    nova26 symbiont style               # Show the creative style profile with all axes
    nova26 symbiont taste-dna           # Show a visualization of the taste DNA vector
    nova26 symbiont rollback <version>  # Roll back a specific self-modification
    nova26 symbiont reset               # Full reset — erases all Symbiont state (with confirmation)
    nova26 symbiont export              # Export Symbiont state as encrypted JSON (for backup)
    nova26 symbiont import <file>       # Import Symbiont state from backup
    ```

11. **Open questions.** List 3-5 hard implementation questions: how to prevent the Symbiont
    from becoming an echo chamber (if it only learns from the user's past choices, it will
    only suggest more of the same — define a "creative stretch" mechanism that occasionally
    suggests approaches outside the user's comfort zone, weighted by how adventurous the
    user has been historically); how to handle the Symbiont's "cold start" period (the
    Symbiont is not useful until it has observed at least 10-20 sessions — during the cold
    start, it should be silent rather than offering poorly calibrated suggestions; define
    the minimum data thresholds for each Symbiont feature to activate); how to make the
    taste DNA vector interpretable (a 768-dimensional vector is mathematically useful but
    not human-readable — define a dimensionality reduction approach, such as PCA to 8-10
    principal components, that maps the taste DNA to the named style axes for display
    purposes); whether the Symbiont should have access to the user's broader creative work
    outside of code (design files, writing, bookmarks — this is a scope question that has
    privacy implications; recommend code-only for v1); and how to handle the case where
    the Symbiont's self-modifications degrade its performance (define a "canary" mechanism:
    after each self-modification, the Symbiont runs a set of validation prompts against
    the user's last 5 decisions to verify that its updated reasoning would have produced
    the same recommendations — if accuracy drops below 80%, the modification is
    auto-rolled-back).

---

### GROK-R16-10: Taste Room — Infinite Personalized Visual Design Library

**The analogy:** Walk into the studio of any great visual designer and you will find a wall.
Not a blank wall — a wall covered in references. Torn pages from magazines. Screenshots.
Color swatches. Typography samples. Packaging designs from a Japanese grocery store. A
business card with a typeface that caught their eye on a Tuesday. This wall is not organized
by any system. It is organized by taste — a felt sense of "this belongs with this" that the
designer could not articulate but can recognize instantly. Over years, the wall becomes a
portrait of the designer's aesthetic mind. It is the most personal artifact in the studio.
Every AI design tool today shows the user a search bar and a grid of results. There is no
wall. There is no accumulation. There is no sense that the tool knows what you like. The
Taste Room is Nova26's wall: a beautiful, calm visual gallery where the user browses an
infinite collection of design references, swipes on them with Tinder-style four-direction
mechanics, and watches the recommendations get smarter with every interaction. After 50
swipes, it knows. After 200 swipes, it is uncanny. The Taste Room is the most emotionally
engaging feature in Nova26 — not because it does anything technically complex, but because
it makes the user feel understood.

Produce a complete specification for the Taste Room covering:

1. **Swipe mechanics.** Define the four-direction swipe interaction model:

   - **Right swipe — Love it:** saves the design reference to the Taste Vault as a strong
     positive signal. The reference becomes a first-class Taste Vault pattern with
     `source: 'taste-room'` and `sentiment: 'loved'`. This is the strongest training
     signal for the recommendation engine.
   - **Left swipe — Not for me:** records a negative training signal. The reference is NOT
     saved to the Taste Vault, but the dislike is recorded in the recommendation engine's
     training data. Over time, left-swiped patterns reduce the probability of similar
     patterns appearing. This is as important as the positive signal — knowing what the
     user does not like is half of knowing their taste.
   - **Up swipe — Save to Inspiration Board:** saves the reference to a separate
     "Inspiration Board" — a collection of references the user finds interesting but is
     not ready to commit to as a preference. Mild positive signal for the recommendation
     engine (weight: 0.3, vs. 1.0 for right swipe). The Inspiration Board is browsable
     separately (`nova26 taste-room inspiration`).
   - **Down swipe — Explore similar:** generates 3-5 variations of the current reference
     and presents them immediately. This is the "infinite exploration" mechanic — the user
     sees a card layout they like, swipes down, and gets 5 variations of that layout with
     different spacing, colors, and element arrangements. Each variation can be further
     swiped in any direction. This creates a depth-first exploration tree that lets the
     user drill into a specific aesthetic.
   - **Input methods:** keyboard arrow keys match swipe directions (right arrow = love,
     left = skip, up = save, down = explore). Mouse: click-and-drag with physics-based
     spring animation — the card follows the cursor, stretches slightly, and snaps to its
     destination with a satisfying spring back. Touch: standard touch-drag on touch devices.
   - **Animation:** the swipe animation must feel physically satisfying. Use spring physics
     (stiffness: 300, damping: 20) with velocity-dependent trajectory. A fast swipe sends
     the card flying off screen. A slow swipe returns the card to center if the threshold
     is not crossed. The threshold is 40% of card width. This is not a CSS transition —
     it is a physics simulation, implemented with `react-spring` or equivalent.
   - **Training update:** every swipe updates the user's taste DNA (R16-09) in real-time.
     The update is the same weighted moving average used by the Symbiont, but with a
     slightly higher learning rate for Taste Room interactions (default: 0.08, vs. 0.05
     for builds) because Taste Room swipes are direct, unambiguous preference signals.

2. **Component sections.** Define the dedicated galleries:

   - The Taste Room is organized into sections, each containing design references for a
     specific component type. The user can browse all sections sequentially or jump to a
     specific section.
   - **Buttons:** primary, secondary, ghost, outline, icon-only, loading state, disabled
     state. Variations in border radius, shadow depth, hover animation, size.
   - **Toggles and switches:** iOS-style, Material-style, custom shapes. On/off states,
     transition animations, label placement.
   - **Light/dark mode switches:** icon toggles, slider transitions, animated sun/moon
     icons. Smooth transition between themes.
   - **Font combinations:** heading + body font pairs. Serif/sans-serif pairings, weight
     combinations, size ratios. Each card shows the same sample text in the combination.
   - **Color palettes:** full 5-7 color palette cards (primary, secondary, accent,
     background, text, border, highlight). Harmonious combinations with contrast ratios
     displayed.
   - **Background patterns and textures:** subtle gradients, mesh gradients, grain
     textures, geometric patterns, noise overlays. Each at multiple intensity levels.
   - **Cards:** product cards, profile cards, dashboard stat cards, pricing cards, feature
     cards. Variations in elevation, border treatment, padding, image placement.
   - **Input fields:** text inputs, search bars, select dropdowns, date pickers, textarea.
     Variations in border style, label placement, validation state display, focus
     animation.
   - **Navigation bars:** top nav with logo, sidebar navigation, breadcrumb trails, tab
     bars, bottom mobile nav. Variations in density, icon usage, active state treatment.
   - **Modals and dialogs:** centered modals, slide-in drawers, bottom sheets, alert
     dialogs, confirmation dialogs. Variations in overlay opacity, animation, corner
     radius.
   - **Tables and data grids:** striped rows, hover highlights, sortable headers, inline
     actions, expandable rows. Variations in density, border treatment, header styling.
   - **Loading states and skeletons:** pulse animations, shimmer effects, progressive
     loading, content placeholders, spinner styles.
   - **Empty states and error pages:** illustrated empty states, minimal text empty states,
     404 pages, 500 pages, offline states. Variations in illustration style and tone.
   - **Hero sections and landing pages:** full-width heroes, split-screen heroes, video
     backgrounds, gradient overlays, CTA placement.
   - **Footer layouts:** minimal footers, mega footers, newsletter signup footers, social
     media link bars. Variations in column count and density.
   - **Full page compositions:** complete page layouts combining multiple component types.
     Dashboard pages, settings pages, landing pages, profile pages, checkout flows.

3. **Device switching.** Define the responsive preview model:

   - A toolbar at the top of the Taste Room allows one-click switching between device
     previews: Mobile (375px), Tablet (768px), Desktop (1440px).
   - Every design reference renders responsively — the same design adapts to the selected
     viewport. The user can see how a navigation bar collapses to a hamburger menu on
     mobile, or how a card grid reflows from 4 columns to 2 to 1.
   - Optional device frame chrome: a toggle that wraps the preview in a realistic device
     frame (iPhone bezel, iPad frame, MacBook frame). Default: off (chrome can distract
     from the design itself). Configurable in `TasteRoomConfig`.
   - Device preference tracking: the recommendation engine notes which device the user
     spends the most time previewing and adjusts the default preview accordingly.

4. **"Curated Ideas for You."** Define the personalized recommendation section:

   - A dedicated section at the top of the Taste Room (or accessible via `nova26 taste-room
     curated`) that surfaces fresh, highly relevant design references the system predicts
     the user will love.
   - Recommendation engine inputs: (a) the user's taste DNA vector (from R16-09), (b)
     recent swipe patterns (last 50 swipes, weighted by recency), (c) Global Wisdom
     trending patterns (if opted in — what designs are popular among users with similar
     taste DNA), (d) the user's current project context (if they are building a dashboard,
     surface more dashboard-relevant references).
   - Accuracy target: after 50+ swipes, the curated section should achieve a >60% right-
     swipe rate (the user loves more than half of what is surfaced). After 200+ swipes,
     target >75%. Define how this accuracy is measured and tracked internally.
   - Refresh cadence: curated ideas refresh daily with new content. The user can manually
     refresh (`nova26 taste-room curated --refresh`). Refreshed content never repeats
     references the user has already seen (swiped in any direction).
   - Novelty injection: 20% of curated ideas should be outside the user's established
     taste profile — "creative stretch" references that the user might not expect to
     like but that are adjacent to their taste DNA. This prevents the recommendation
     engine from becoming an echo chamber. Define the novelty distance threshold:
     references with a taste alignment score between 0.4 and 0.6 (moderately aligned
     but not perfectly matching).

5. **Standard collection.** Define the baseline design reference library:

   - Ships with 500+ high-quality design references across all sections. This is the
     out-of-the-box experience — the Taste Room is useful on first launch, not only
     after the user has swiped 100 times.
   - Generation: the baseline collection is generated locally using design system
     templates and variation algorithms. No external API calls — fully offline. The
     templates are Tailwind CSS + React components with systematic variations of spacing,
     color, typography, and layout.
   - Quality bar: every reference in the baseline collection must be visually polished
     enough that a user could screenshot it and use it as a design reference. No
     placeholder-quality designs. No "lorem ipsum" text — plausible, domain-appropriate
     content.
   - Organization: references are tagged with section, style attributes (minimalist,
     bold, corporate, playful, etc.), and complexity level. Tags feed the recommendation
     engine.
   - Extensibility: users can add their own references to the Taste Room by importing
     screenshots or URLs: `nova26 taste-room import <image-path>` or `nova26 taste-room
     import --url <url>`. Imported references are analyzed, tagged, and embedded into
     the recommendation engine alongside the baseline collection.

6. **TypeScript interfaces.** Define the complete type system:

   ```typescript
   // Extend RalphLoopOptions
   interface RalphLoopOptions {
     // ... existing options
     tasteRoomEnabled?: boolean;
     tasteRoomConfig?: TasteRoomConfig;
   }

   interface TasteRoomConfig {
     port: number;                      // default: 5276
     defaultDevice: DevicePreview;      // default: 'desktop'
     showDeviceChrome: boolean;         // default: false
     swipeLearningRate: number;         // default: 0.08
     curatedNoveltyPercentage: number;  // default: 0.20
     curatedRefreshIntervalHours: number; // default: 24
     maxSwipeHistorySize: number;       // default: 10000
     baselineCollectionPath: string;    // default: '~/.nova/taste-room/baseline'
     userCollectionPath: string;        // default: '~/.nova/taste-room/user'
     inspirationBoardPath: string;      // default: '~/.nova/taste-room/inspiration'
     springStiffness: number;           // default: 300 (swipe animation)
     springDamping: number;             // default: 20  (swipe animation)
     swipeThresholdPercent: number;     // default: 0.40 (40% of card width)
   }

   type SwipeDirection = 'right' | 'left' | 'up' | 'down';

   type DevicePreview = 'mobile' | 'tablet' | 'desktop';

   interface TasteRoom {
     id: string;
     userId: string;
     sections: TasteRoomSection[];
     curatedFeed: CuratedFeed;
     inspirationBoard: TasteCard[];
     swipeHistory: SwipeEvent[];
     totalSwipes: number;
     rightSwipeRate: number;            // 0-1, proportion of right swipes
     curatedAccuracy: number;           // 0-1, right-swipe rate on curated content
     activeDevice: DevicePreview;
     sessionStartedAt?: string;
   }

   interface TasteRoomSection {
     id: string;
     name: string;                     // e.g., 'Buttons', 'Navigation Bars'
     slug: string;                     // e.g., 'buttons', 'navigation-bars'
     description: string;
     cardCount: number;
     swipedCount: number;              // how many cards the user has seen in this section
   }

   interface TasteCard {
     id: string;
     sectionId: string;
     title: string;
     description: string;
     tags: string[];                   // e.g., ['minimalist', 'dark-mode', 'rounded']
     styleAttributes: Record<string, string>; // e.g., { borderRadius: '12px', palette: 'cool' }
     componentCode: string;            // React/Tailwind code for the reference
     previewHtml: string;              // pre-rendered HTML for fast display
     embedding: number[];              // vector for recommendation engine
     source: 'baseline' | 'user-import' | 'generated-variation' | 'global-wisdom';
     complexity: 'simple' | 'moderate' | 'complex';
     responsiveBreakpoints: {
       mobile: string;                 // viewport-specific CSS/adjustments
       tablet: string;
       desktop: string;
     };
     createdAt: string;
   }

   interface SwipeEvent {
     id: string;
     cardId: string;
     sectionId: string;
     direction: SwipeDirection;
     device: DevicePreview;            // which device preview was active during the swipe
     timestamp: string;
     sessionId: string;
     swipeDurationMs: number;          // how long the user looked before swiping
     velocityMagnitude: number;        // swipe velocity (fast = confident, slow = hesitant)
   }

   interface CuratedFeed {
     cards: TasteCard[];
     generatedAt: string;
     expiresAt: string;                // when the feed refreshes
     noveltyCards: string[];           // IDs of cards that are "creative stretch" picks
     accuracy: number;                 // right-swipe rate on curated content so far
     refreshCount: number;             // how many times the feed has been refreshed
   }
   ```

7. **CLI surface.** Define all Taste Room commands:

   ```
   nova26 taste-room                    # Open the Taste Room in the browser
   nova26 taste-room --section buttons  # Open directly to a specific section
   nova26 taste-room --device mobile    # Open with mobile preview as default
   nova26 taste-room curated            # Open the "Curated Ideas for You" section
   nova26 taste-room curated --refresh  # Force refresh curated content
   nova26 taste-room inspiration        # Browse the Inspiration Board (up-swiped items)
   nova26 taste-room import <path>      # Import a screenshot or image as a reference
   nova26 taste-room import --url <url> # Import a design reference from a URL
   nova26 taste-room stats              # Swipe statistics: total swipes, preference breakdown
   nova26 taste-room export             # Export all saved preferences and swipe history
   nova26 taste-room reset              # Reset all Taste Room data (with confirmation)
   ```

8. **Integration with the Symbiont and Dream Mode.** Define how the Taste Room feeds the
   broader creative intelligence:

   - Every right-swipe and left-swipe updates the Symbiont's taste DNA in real-time. The
     Taste Room is the most direct, unambiguous preference signal the Symbiont receives —
     more direct than build decisions, which are influenced by technical constraints.
   - When the user starts a Dream Mode simulation (R16-06), MARS queries the Taste Room's
     recent right-swipes and Inspiration Board to select visual styling for the simulation.
     "I see you've been loving dark-mode cards with rounded corners and generous padding.
     I'll use that style for the simulation."
   - When Parallel Universe Mode (R16-07) generates multiple approaches, the Taste Room
     preference data is used to rank which universe is most likely to align with the user's
     taste, even before the user reviews them.
   - The Taste Room's swipe velocity data provides an additional signal: fast confident
     swipes indicate strong preferences; slow hesitant swipes indicate ambivalence. The
     recommendation engine weights confident swipes more heavily.

9. **Open questions.** List 3-5 hard implementation questions: how to generate enough visual
   variety in the baseline collection without the references feeling repetitive or
   procedurally generated (recommend a template system with at least 20 base templates per
   section, each with 5+ variation dimensions — this produces 100+ unique references per
   section, which is sufficient for launch); how to handle the Taste Room for users who
   primarily build non-visual applications (CLIs, APIs, backend services — the Taste Room
   could offer architecture pattern cards, terminal UI references, and API documentation
   layout references instead of visual component references; define the non-visual section
   list); whether the Taste Room should support collaborative browsing for teams (two team
   members swiping independently on the same collection, with a "team taste DNA" computed
   from the intersection of their preferences — recommend as a v2 feature, not v1); how
   to prevent the recommendation engine from creating a "taste bubble" where the user only
   sees designs similar to what they have already liked (the 20% novelty injection helps,
   but define additional diversity mechanisms: periodic "wildcard" cards from completely
   different aesthetic families, and a "surprise me" button that shows references with
   taste alignment scores below 0.3); and how to measure whether the Taste Room actually
   improves the quality of the code Nova26 generates (track: quality scores on builds
   that followed a Taste Room session vs. builds that did not, controlling for project
   complexity and user experience level).

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
- Estimated output: 2,500-4,000 words per deliverable, 25,000-40,000 words total.
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
  // R16 visionary additions
  dreamModeEnabled?: boolean;
  dreamConfig?: DreamModeConfig;
  parallelUniverseEnabled?: boolean;
  parallelUniverseConfig?: ParallelUniverseConfig;
  overnightEvolutionEnabled?: boolean;
  overnightConfig?: OvernightEvolutionConfig;
  symbiontEnabled?: boolean;
  symbiontConfig?: SymbiontConfig;
  tasteRoomEnabled?: boolean;
  tasteRoomConfig?: TasteRoomConfig;
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
- GROK-R16-06 (Dream Mode) builds directly on the Live Preview (R16-03) and Rehearsal Stage
  infrastructure. Dream simulations are lightweight — they are NOT full builds, they are
  interactive mockups generated by MARS in under 60 seconds.
- GROK-R16-07 (Parallel Universe) uses agent pooling to run 2-4 cloned AgentLoops. Each
  universe uses lightweight models for speed. The total compute cost of 3 universes should
  be less than 2x a single build (cheap models + early termination).
- GROK-R16-08 (Overnight Evolution) is the most "set and forget" feature in R16. It runs
  only in sandbox, never touches real files, and respects a configurable compute budget.
  It is the primary input mechanism for the Nova Symbiont's growth.
- GROK-R16-09 (Nova Symbiont) is the architectural crown jewel of R16. It ties together
  Agent Memory (R16-02), Dream Mode (R16-06), Parallel Universe (R16-07), and Overnight
  Evolution (R16-08) into a single persistent creative intelligence. Design it last —
  the other R16 features are its building blocks.
- GROK-R16-10 (Taste Room) is the most user-facing and emotionally engaging feature in R16.
  The swipe mechanics must feel as satisfying as Tinder — physics-based spring animation,
  not just a CSS transition. The recommendation engine is powered by the Taste Vault's
  existing embedding infrastructure.

---

*Prompt issued by Claude Code on 2026-02-18. Grok R16 output should be delivered to
`.nova/output/` or committed directly to the `grok/r16` branch for coordinator review.*
