# GROK-R8: Nova26 Deep Technical Research Prompt

> Assigned to: Grok
> Round: R8 (post-R7)
> Date issued: 2026-02-18
> Status: Active

---

## Context Brief

Nova26 is a 21-agent AI-powered IDE built with TypeScript, Ollama, and Convex. The 21 agents
are named after celestial bodies (MARS, VENUS, MERCURY, JUPITER, SATURN, PLUTO, etc.) and
operate through a core execution engine called the Ralph Loop (`src/orchestrator/ralph-loop.ts`),
which drives a Generator -> Reflector -> Curator cycle (ACE) for iterative quality improvement.
Prompts are assembled in `src/orchestrator/prompt-builder.ts`.

**Current state of the build:**
- R1-R7 covered: tool use, inner loops, Taste Vault design, Global Wisdom Pipeline, Premium
  Buyer Experience, ACE specs, Rehearsal Stage specs, Self-Improvement Protocol, Real-Time
  Collaboration UX, Competitive Moat Analysis.
- Kimi is executing KIMI-VAULT-01 through KIMI-VAULT-06 (Living Taste Vault), then moves to
  ACE and Rehearsal Stage implementation.
- Claude Code (claude-sonnet-4-6) owns `src/orchestrator/`, `src/llm/`, and `convex/`.
- Pricing target: $250-$500/month premium tier. Path A: Opt-In Global Wisdom Layer.
- Technical foundation is solid. R8 pushes into new territory: the subsystems that have not
  been designed yet but that are critical for a shipped, defensible product.

**Your style:** Open each deliverable with a big-picture analogy that makes the architecture
click instantly. Then go deep — TypeScript interfaces, method signatures, file structure, flow
diagrams in ASCII or prose. Every spec must be ready-to-implement or ready-to-research: a
developer or researcher should be able to pick it up without re-reading R1-R7.

---

## Deliverables

Label each section clearly: GROK-R8-01, GROK-R8-02, etc.

---

### GROK-R8-01: Semantic Similarity Engine for Global Wisdom

**The ask:** The Global Wisdom Pipeline (Kimi's KIMI-VAULT-05/06 territory, referenced in R4-R6)
promotes high-signal patterns from individual Taste Vaults into a shared pool. Before a pattern
is promoted, the system must check: does a semantically equivalent pattern already exist in the
global pool? Without deduplication, the Global Wisdom layer becomes noise. The challenge is doing
this check locally, fast, and without cloud embedding APIs — because Nova26's local-first
architecture is a core moat.

Produce a research spec covering:

1. **The big-picture analogy.** One paragraph. What is the right mental model for semantic
   deduplication in a pattern library? (Think: music Shazam fingerprinting, DNA sequence
   alignment, or a librarian's subject index — pick the one that best captures the tradeoff
   between precision and speed at this scale.)

2. **Local embedding options via Ollama.** Research and evaluate the following approaches
   for generating text embeddings that run entirely on-device via Ollama:
   - `nomic-embed-text` — what are its embedding dimensions, quality benchmarks, and
     inference speed on a modern MacBook Pro (M2/M3)?
   - `mxbai-embed-large` — same evaluation.
   - `all-minilm` — same evaluation.
   - Any other embedding model in the Ollama library worth considering as of early 2026.

   For each: provide the Ollama API call to generate an embedding, the vector dimension,
   approximate latency per embedding on commodity hardware, and a qualitative assessment
   of whether it is suitable for short code/design pattern strings (50-500 characters).

3. **Simpler alternatives: non-embedding approaches.**
   Evaluate three lightweight similarity methods that require no ML model at all:
   - **TF-IDF cosine similarity**: how to build a TF-IDF index over pattern strings,
     how to query it, what Python or TypeScript library to use, expected accuracy for
     near-duplicate detection.
   - **Jaccard similarity on n-gram tokens**: implementation sketch in TypeScript,
     when it works well vs when it breaks down.
   - **Fuzzy string matching** (Levenshtein distance / edit distance): best TypeScript
     library, appropriate for short strings vs long strings, cost per comparison.

   For each: provide a TypeScript implementation sketch or pseudocode, time complexity,
   and a one-sentence verdict on whether it is suitable for Nova26's use case.

4. **Recommended approach for Nova26.** Given the constraints (local-first, no cloud
   dependencies, TypeScript/Node.js runtime, patterns are short text strings 50-500 chars,
   corpus grows to ~10,000 patterns over time), recommend a single approach. Justify the
   choice. If the recommendation is a hybrid (e.g., fast pre-filter with Jaccard, then
   embedding-based reranking for candidates), explain each stage.

5. **SimilarityEngine interface.** Design the full TypeScript interface:

   ```typescript
   interface SimilarityMatch {
     patternId: string;
     score: number;           // 0.0 - 1.0
     method: 'embedding' | 'tfidf' | 'jaccard' | 'fuzzy';
   }

   interface SimilarityEngineConfig {
     method: 'embedding' | 'tfidf' | 'jaccard' | 'fuzzy' | 'hybrid';
     threshold: number;       // minimum score to return as a match
     topK: number;            // max matches to return per query
     embeddingModel?: string; // if method includes embedding
     ollamaBaseUrl?: string;
   }

   interface SimilarityEngine {
     // Add a pattern to the index
     index(patternId: string, text: string): Promise<void>;

     // Query for similar patterns
     findSimilar(text: string, topK?: number): Promise<SimilarityMatch[]>;

     // Check if a near-duplicate already exists above the threshold
     isDuplicate(text: string): Promise<boolean>;

     // Bulk index from a corpus
     bulkIndex(patterns: Array<{ id: string; text: string }>): Promise<void>;

     // Persist index to disk (for local-first durability)
     saveIndex(path: string): Promise<void>;
     loadIndex(path: string): Promise<void>;
   }
   ```

   For each method: describe the internal implementation in pseudocode. What data structures
   back the index? (e.g., inverted index for TF-IDF, Float32Array for embeddings, Map for
   Jaccard token sets.)

6. **Benchmark estimates.** Provide concrete estimates (or measured numbers if available) for:
   - Time to index 10,000 patterns from scratch (bulk build)
   - Time per query (single `findSimilar` call) against a 10,000-pattern index
   - Memory footprint of the index at 10,000 patterns
   - Accuracy estimate: what percentage of true near-duplicates are caught at a threshold
     of 0.85?

   If measured benchmarks are not available, provide reasoned estimates with stated assumptions.

7. **Integration with Global Wisdom Pipeline.** Where in the promotion flow does
   `SimilarityEngine.isDuplicate()` get called? Show the integration point as a pseudocode
   diff on the `promoteToGlobal()` function that Kimi is building. Note: "Integration point
   with KIMI-VAULT — exact function signature TBD pending Kimi's output."

8. **File structure.** Specify:
   - `src/similarity/engine.ts` — `SimilarityEngine` interface + `createSimilarityEngine(config)`
     factory function
   - `src/similarity/tfidf.ts` — TF-IDF implementation (if recommended)
   - `src/similarity/embedding.ts` — Ollama embedding client wrapper (if recommended)
   - `src/similarity/jaccard.ts` — Jaccard n-gram implementation (if recommended)

9. **Open questions for the build team.** List 3-5 questions that must be answered before
   implementation begins.

---

### GROK-R8-02: Convex Real-Time Architecture for Multi-User Features

**The ask:** Nova26's premium tier requires real-time features: Global Wisdom distribution,
live agent activity feeds, multi-user collaboration presence, and nightly aggregation pipelines.
Convex is already in the stack (`convex/` directory, owned by Claude Code). This deliverable
designs the complete Convex architecture for everything multi-user and real-time.

Produce a complete, ready-to-code specification covering:

1. **The big-picture analogy.** One paragraph. Convex's reactive query model is unlike
   traditional databases. What is the right mental model for a developer who has used
   PostgreSQL + WebSockets but never used Convex? Make the subscription model click in
   one paragraph.

2. **Schema design.** Design the complete Convex schema additions needed for multi-user
   Nova26 features. Use Convex's schema syntax (`defineSchema`, `defineTable`). Cover:

   - **`userProfiles`** table: userId, displayName, plan ('free' | 'premium'), globalWisdomOptIn,
     createdAt, lastActiveAt, tastevaultId
   - **`tasteVaultSync`** table: userId, vaultId, lastSyncedAt, syncStatus, conflictCount —
     tracks sync state between local vault and Convex cloud copy
   - **`globalPatterns`** table: patternId, text, category, promotedAt, promotedByUserId
     (anonymized), upvoteCount, downvoteCount, qualityScore, status ('active' | 'deprecated')
   - **`agentActivityFeed`** table: eventId, userId (whose session this is), agentName,
     eventType, subject, detail, severity, timestamp — the live feed events from R7-04
   - **`presenceSlots`** table: userId, sessionId, lastSeen, currentFile, currentAgent,
     status ('active' | 'idle' | 'away') — for Director's Chair multi-user presence

   Include indexes for each table (which fields need `index()` for efficient queries?).
   Reference the existing `convex/schema.ts` which has `builds`, `tasks`, `executions`,
   `patterns`, `agents`, `companyAgents`, and `learnings` tables — your new tables extend
   this schema without modifying existing tables.

3. **Convex function patterns.** For each of the following features, provide the specific
   Convex function type (query, mutation, or action), the function signature, and a
   pseudocode implementation:

   a. **Real-time Global Wisdom distribution** — a reactive query that a client subscribes
      to, returning the top-N active global patterns filtered by category:
      ```typescript
      // query: getGlobalPatterns
      // Args: { category?: string; topN: number }
      // Returns: GlobalPattern[]
      // Client subscribes with useQuery — updates push automatically when patterns change
      ```

   b. **Pattern promotion mutation** — called when a local pattern is promoted to global:
      ```typescript
      // mutation: promotePattern
      // Args: { patternText: string; category: string; userId: string }
      // Runs: deduplication check (calls SimilarityEngine via action), then inserts
      ```

   c. **Agent activity feed subscription** — reactive query for the live feed panel:
      ```typescript
      // query: getActivityFeed
      // Args: { userId: string; limit: number; since?: number }
      // Returns: AgentActivityEvent[]
      ```

   d. **Presence heartbeat mutation** — called every 30s to keep presence slot alive:
      ```typescript
      // mutation: updatePresence
      // Args: { userId: string; sessionId: string; currentFile?: string; currentAgent?: string }
      ```

   e. **Nightly aggregation action** — runs as a cron job, aggregates promoted patterns,
      recomputes quality scores, deprecates stale patterns:
      ```typescript
      // action: runNightlyAggregation
      // Args: none (cron-triggered)
      // Steps: fetch all patterns, recompute scores, batch-update via mutations
      ```

4. **Real-time presence for Director's Chair.** Design the full presence system:
   - How does a client register its presence on connect?
   - How does the system detect disconnects / stale presence? (TTL on lastSeen field?)
   - How does a second user see another user's current context in real time?
   - What does the `PresenceIndicator` component receive from Convex?

   Provide the Convex query that returns all active users in a session and their current
   context (file, agent), suitable for rendering a "who's online" panel.

5. **Convex cron jobs for nightly aggregation pipeline.** Design the complete cron
   configuration (`convex/crons.ts`):
   - Nightly (02:00 UTC): run `runNightlyAggregation` — recompute global pattern scores
   - Hourly: run `cleanStalePresence` — remove presenceSlots with lastSeen > 2 hours ago
   - Weekly (Sunday 03:00 UTC): run `archiveDeprecatedPatterns` — move deprecated patterns
     to an archive table, free up active index

   Show the `crons.ts` file content using Convex's `cronJobs` API.

6. **Cost modeling.** Provide concrete estimates for Convex pricing at three user scales.
   Base your estimates on Convex's published pricing as of early 2026 (function calls,
   document reads/writes, bandwidth, storage). Model the following workload per user per day:
   - 200 activity feed events written (agentActivityFeed mutations)
   - 500 reactive query reads (live feed subscriptions refreshing)
   - 10 pattern promotion checks
   - 48 presence heartbeats (every 30 minutes of active use)

   Compute estimated monthly cost at:
   - **100 users** (beta/early access)
   - **1,000 users** (post-launch growth)
   - **10,000 users** (scale target)

   Express cost as both total monthly and per-user-per-month. Flag which pricing tier
   boundary Nova26 would hit at each scale.

7. **File structure.** Specify new Convex files to create (alongside existing `convex/atlas.ts`,
   `convex/schema.ts`):
   - `convex/schema.ts` — additions to existing schema (show only the new table definitions)
   - `convex/globalWisdom.ts` — all global pattern functions
   - `convex/activityFeed.ts` — all activity feed functions
   - `convex/presence.ts` — all presence functions
   - `convex/crons.ts` — cron job definitions

8. **Integration with ralph-loop.ts.** The Ralph Loop currently runs locally. To emit
   activity feed events, it needs to write to Convex. Show the integration point:
   - Where in `processTask()` are events emitted?
   - What is the call pattern? (HTTP action to Convex endpoint, or via a local Convex
     client instance?)
   - What happens if Convex is unreachable? (offline-first: buffer events locally, flush
     on reconnect.)

9. **Open questions for the build team.** List 3-5 questions.

---

### GROK-R8-03: Launch Strategy & Go-To-Market

**The ask:** Nova26 has a technical moat (21-agent architecture, Living Taste Vault, Global
Wisdom, local-first Ollama). Now it needs its first 50 paying users. Getting from zero to
$500/month x 50 users ($25K MRR) is the most critical phase. This deliverable designs the
launch strategy with the same rigor applied to the technical architecture.

Produce a strategic research spec covering:

1. **The big-picture analogy.** One paragraph. What product launch in the developer tools
   space best maps to Nova26's situation — a technically superior product entering a market
   with entrenched incumbents? What did they do right in the first 90 days?

2. **Ideal first 50 users: user archetype analysis.** Define three specific user archetypes
   that would both pay $400/month AND become vocal advocates. For each archetype, provide:
   - Job title / work context (indie hacker, agency CTO, senior engineer at a startup, etc.)
   - What problem Nova26 solves for them specifically
   - Their current solution and what they hate about it
   - Their budget authority (do they pay personally or expense it?)
   - Where they hang out online (specific communities, forums, Twitter/X follows)
   - What "aha moment" would convert them from trial to paid

   Recommend which archetype to target first and why.

3. **Launch channels: where serious builders who pay $400/month gather.**
   Evaluate each of the following channels — for each, provide: estimated reach among the
   target archetype, effort to execute, expected conversion rate, and a specific tactic:
   - **Hacker News (Show HN)** — what makes a Show HN post go to the front page for a dev tool?
   - **Twitter/X developer community** — who are the 10 specific accounts that, if they
     tweet about Nova26, would drive meaningful signups? How do you get them to try it?
   - **r/programming, r/MachineLearning, r/LocalLLaMA** — which subreddit is the best fit
     and what post format works?
   - **Discord servers** — which specific Discord communities (name them) have the highest
     density of developers who use AI tools and pay for them?
   - **Developer newsletters** — which newsletters (name them, with subscriber counts if
     known) reach senior developers who influence tooling decisions?
   - **YouTube / demo videos** — what 3-minute demo would go viral among the target audience?
     What is the hook in the first 10 seconds?

4. **Beta program design: 20 premium beta users.**
   Design a concrete beta program that recruits 20 users who will pay (or commit to pay on
   launch), give structured feedback, and become references:
   - What do beta users get? (discounted price, direct access to founders/team, early feature
     influence, named in credits?)
   - What is expected of beta users? (structured feedback sessions, usage metrics sharing,
     testimonials?)
   - How do you find 20 beta users in the first 30 days? (cold outreach, warm intro, content,
     community?)
   - What is the beta feedback loop? (weekly sync, async Loom reviews, structured survey?)
   - What is the graduation criteria from beta to paid? (what does success look like?)

5. **Content marketing angle: posts and demos that go viral.**
   Design five specific content pieces. For each, provide: format, platform, headline/hook,
   core narrative, and why it would resonate with the target archetype:

   a. A blog post that demonstrates the Taste Vault learning over time
      (e.g., "I let 21 AI agents build my SaaS for 30 days — here's what they learned")
   b. A demo video showing the live agent activity feed
   c. A technical deep-dive on local-first AI inference with Ollama (no cloud fees angle)
   d. A comparison post: Nova26 vs Cursor vs Devin (specific, fair, factual)
   e. A "behind the build" thread: building Nova26 with Nova26 (eating your own dog food)

6. **Pricing psychology: $250 vs $400 vs $500.**
   Research and apply pricing psychology principles to the Nova26 premium tier:
   - What does the research say about charm pricing in B2B SaaS? (e.g., $399 vs $400)
   - What is the anchoring effect of listing a $500/month plan alongside a $250/month plan?
   - How do developer tools that have successfully priced at $300-$500/month frame their
     value proposition? (Name specific products and their pricing pages.)
   - What is the risk of under-pricing at $100-$150/month? (signal quality, customer
     selection, willingness-to-pay anchoring for future raises)
   - Recommended price point for launch, with reasoning. Consider: introductory price vs
     full price, annual discount, team seats.

7. **"Aha moment" design: first 5 minutes.**
   The moment a trial user sees Nova26 working for the first time is the most critical
   moment in the product. Design the ideal first-session experience:
   - What is the first task Nova26 should run on a new user's project? (Should it be
     automatic? User-chosen? Guided?)
   - What output should the user see in the first 90 seconds that makes them say "I have
     never seen a tool do that before"?
   - At what point in the first session does the Taste Vault log its first preference node?
     How is this surfaced to the user?
   - What is the first Global Wisdom touchpoint? (When does the user see that their agents
     are benefiting from patterns learned by other users?)
   - Design a 5-step "first session script" — what happens in minutes 1, 2, 3, 4, 5.

8. **90-day launch timeline.** Provide a concrete week-by-week plan:
   - Weeks 1-2: pre-launch (what to build, what content to prepare, who to contact)
   - Week 3: soft launch (who gets access first, what feedback to gather)
   - Weeks 4-6: beta iteration (what to fix, what to amplify)
   - Weeks 7-10: public launch (Show HN, Product Hunt, newsletter pushes)
   - Weeks 11-12: post-launch (what to measure, when to adjust pricing)

---

### GROK-R8-04: Security & Privacy Architecture for Taste Vault

**The ask:** The Living Taste Vault holds deeply personal data: a user's aesthetic preferences,
coding style, design decisions, and judgment calls accumulated over hundreds of builds. The
Global Wisdom Pipeline shares anonymized patterns across users. Both systems require a security
and privacy architecture that can withstand scrutiny from enterprise buyers, EU regulators, and
sophisticated developers who will audit the system before paying $400/month.

Produce a complete security and privacy specification covering:

1. **The big-picture analogy.** One paragraph. What is the right mental model for thinking
   about Taste Vault security? (Credit scores? Medical records? A physical safe? A shared
   recipe index where ingredients are private but techniques are public?) Pick the analogy
   that best captures the specific sensitivity and sharing model.

2. **Threat model.** Identify and assess the top security risks for Nova26's data layer.
   For each threat, provide: description, likelihood (High/Medium/Low), impact
   (High/Medium/Low), and the primary mitigation:

   a. **Data poisoning** — a malicious user promotes deliberately bad patterns into Global
      Wisdom to degrade other users' outputs
   b. **Pattern theft** — a user extracts another user's private vault patterns through
      the Global Wisdom API (inference attack: "does this exact pattern exist in global pool?")
   c. **Privacy leak via promoted patterns** — a pattern promoted to Global Wisdom contains
      implicit information about the user's project, company, or codebase
   d. **Vault exfiltration** — an attacker who compromises a Convex instance can read all
      vault data in plaintext
   e. **Agent prompt injection** — malicious content in a file being processed causes an
      agent to exfiltrate vault data through its output
   f. **Supply chain attack** — a compromised Ollama model or npm package reads vault data
      from disk

3. **Encryption at rest for personal vaults.**
   Design the encryption architecture for Taste Vault data:
   - What encryption algorithm? (AES-256-GCM is standard — is it appropriate here?)
   - Where is the encryption key derived from? (User password KDF? Hardware key from OS
     keychain? Convex-managed key? User-controlled key?)
   - What is the key lifecycle? (Key rotation, key recovery, key export for portability)
   - For local-first vaults (`.nova/vault/`): how are files encrypted on disk?
   - For Convex cloud sync: are records encrypted before upload, or does Convex provide
     encryption at rest that is sufficient?
   - Provide the TypeScript interface for a `VaultEncryption` module:
     ```typescript
     interface VaultEncryption {
       encrypt(plaintext: string, key: CryptoKey): Promise<string>;
       decrypt(ciphertext: string, key: CryptoKey): Promise<string>;
       deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey>;
       generateSalt(): Uint8Array;
     }
     ```

4. **Anonymization pipeline: stripping identifying information before global promotion.**
   When a local pattern is promoted to Global Wisdom, it must be anonymized. Design the
   complete anonymization pipeline:

   - **Step 1: Entity detection.** What types of identifying information must be detected
     and removed? (Project names, company names, file paths, variable names that mirror
     business domain, email addresses, API endpoint patterns, internal library names.)
   - **Step 2: Redaction.** For each entity type, what is the redaction strategy?
     (Replace with placeholder? Generalize? Remove the pattern entirely if too specific?)
   - **Step 3: Generalization.** How is a specific pattern generalized into a reusable
     one? (e.g., "Use `acmeButton` component for all CTAs" → "Use the design system's
     primary button component for all CTAs")
   - **Step 4: Human review gate (optional).** Should users see the anonymized version
     before it is promoted? Design the approval UI as a text protocol.

   Provide the TypeScript interface:
   ```typescript
   interface AnonymizationResult {
     original: string;          // never stored after this pipeline
     anonymized: string;
     entitiesRedacted: string[]; // types of entities removed
     confidence: number;         // 0.0-1.0: how confident the pipeline is in quality
     requiresReview: boolean;    // flag for human review gate
   }

   interface AnonymizationPipeline {
     process(pattern: string, userId: string): Promise<AnonymizationResult>;
   }
   ```

5. **GDPR and privacy compliance.**
   For Nova26 to serve EU users, it must comply with GDPR. Provide a compliance checklist
   covering the minimum viable requirements:
   - **Right to access**: how can a user export all their Taste Vault data?
   - **Right to erasure**: how does a "delete my vault" request propagate through local
     files, Convex cloud records, and anonymized patterns already promoted to Global Wisdom?
   - **Data minimization**: what is the minimum data the vault needs to function? What
     can be excluded?
   - **Consent**: at what point does the user consent to Global Wisdom opt-in, and how
     is that consent recorded?
   - **Data residency**: does Convex support EU data residency? Is that required for
     Nova26's use case?
   - **Privacy policy requirements**: list 5 specific clauses the Nova26 privacy policy
     must include.

6. **Audit trail.** Design the audit log for vault and global wisdom operations:
   - What events must be logged? (Pattern promoted, pattern deprecated, vault exported,
     vault deleted, opt-in changed, anonymization applied, quality score changed)
   - What fields does each audit log entry contain?
   - Where is the audit log stored? (Convex table? Local append-only file?)
   - Who can read the audit log? (User can read their own; admins can read all?)
   - How long are audit logs retained?

   Provide the TypeScript interface:
   ```typescript
   interface AuditLogEntry {
     id: string;
     timestamp: string;
     userId: string;
     action: AuditAction;
     resourceType: 'pattern' | 'vault' | 'globalWisdom' | 'user';
     resourceId: string;
     detail?: string;
     ipAddress?: string;  // for cloud-side events only
   }

   type AuditAction =
     | 'pattern.promoted'
     | 'pattern.deprecated'
     | 'pattern.flagged'
     | 'vault.exported'
     | 'vault.deleted'
     | 'vault.synced'
     | 'globalWisdom.optIn'
     | 'globalWisdom.optOut'
     | 'anonymization.applied'
     | 'qualityScore.updated';
   ```

7. **Trust scoring for user contributions.**
   Not all Global Wisdom contributions should be weighted equally. Design a trust scoring
   system:
   - What factors increase a user's trust score? (Account age, premium subscription,
     number of non-rejected contributions, engagement with downvoting bad patterns)
   - What factors decrease it? (Patterns that get flagged or downvoted, rapid pattern
     submission bursts that look like spam, patterns that fail anonymization)
   - How is trust score used in the promotion pipeline? (Threshold to skip human review?
     Weight applied to quality score?)
   - What is the initial trust score for a new user?

   Provide the `TrustScore` interface and the `computeTrustScore(userId)` function signature.

8. **File structure.** Specify:
   - `src/security/vault-encryption.ts` — `VaultEncryption` implementation
   - `src/security/anonymization.ts` — `AnonymizationPipeline` implementation
   - `src/security/audit-log.ts` — `AuditLogger` class
   - `src/security/trust-score.ts` — `TrustScoreEngine` class

9. **Open questions for the build team.** List 3-5 questions.

---

### GROK-R8-05: Ollama Model Strategy for 2026

**The ask:** Nova26 runs 21 specialized agents. Each agent has a different job: MARS generates
code, VENUS reviews it, MERCURY tests it, JUPITER plans architecture. Not all agents need the
same model — and in a local-first system, model selection directly determines quality, speed,
and hardware feasibility. This deliverable designs the complete model strategy.

Produce a research spec covering:

1. **The big-picture analogy.** One paragraph. A 21-agent system with model routing is like
   what real-world organization? (A film production where different crew roles need different
   tools? A hospital with different specialists? A law firm with partners, associates, and
   paralegals?) Pick the analogy that best captures the principle of right-model-for-right-job.

2. **Model evaluation by agent role.** Research and evaluate the best Ollama-available models
   as of early 2026 for each of the following agent role categories:

   a. **Code generation** (MARS, MERCURY, IO, GANYMEDE — agents that write or modify code):
      - Which models perform best on coding benchmarks (HumanEval, SWE-bench)?
      - Recommended model at 7B, 14B, and 32B tiers
      - Context window requirements for typical code generation tasks

   b. **Code review / reflection** (VENUS, REFLECTOR role in ACE):
      - Which models have the strongest reasoning about code quality?
      - Do larger models significantly outperform smaller ones for review tasks?
      - Recommended model

   c. **Test generation** (MERCURY, EUROPA):
      - What model characteristics matter most for generating correct, non-trivial tests?
      - Recommended model

   d. **Architecture and planning** (JUPITER, SATURN, ATLAS):
      - Long-context reasoning, system design — which models excel?
      - How much context window is needed for planning a full PRD?
      - Recommended model

   e. **Documentation / prose** (PLUTO, TRITON):
      - Which models produce the cleanest technical documentation?
      - Does writing quality differ significantly between models at the same parameter count?

   f. **Orchestration / meta-reasoning** (SUN — the coordinator agent):
      - The coordinator needs to reason about agent states, delegate tasks, and resolve
        conflicts. Which model handles meta-reasoning best?

   For each category: provide a primary recommendation, a budget alternative (smaller/faster),
   and a quality ceiling (largest/best if hardware allows).

3. **Model routing: when to use 7B vs 14B vs 32B.**
   Design the model routing logic:
   - Define the task complexity score and how it is computed (token length of task + files
     touched + schema changes involved + agent confidence from prior turns)
   - Define the routing thresholds:
     ```typescript
     interface ModelRoutingConfig {
       complexityThresholds: {
         small: number;   // below this: use 7B model
         medium: number;  // below this: use 14B model
         large: number;   // above this: use 32B model
       };
       alwaysLargeFor: string[]; // task types that always route to 32B
       alwaysSmallFor: string[]; // task types that always use 7B
     }
     ```
   - What task types should always use the largest available model? (schema migrations,
     multi-file refactors, architectural decisions)
   - What task types can safely use the smallest model? (doc string updates, simple
     variable renames, formatting passes)

   Provide the `selectModel(task: Task, config: ModelRoutingConfig): string` function
   with implementation in TypeScript pseudocode.

4. **Context window strategies.**
   Nova26 agents frequently work with large files and multi-file contexts. Design strategies
   for maximizing quality within context limits:

   a. **Context prioritization**: when a task's context exceeds the model's context window,
      what is included first? (Task description, relevant file sections, Taste Vault nodes,
      prior agent output, test results — rank these by importance.)
   b. **Sliding window for large files**: how does an agent process a 1,000-line file with
      a 4,096-token context window? Describe the chunking and synthesis strategy.
   c. **Summary compression**: when prior conversation history exceeds context, how is it
      compressed? (Summarize with a smaller model? Extract key decisions only?)
   d. **Cross-agent context passing**: when VENUS reviews MARS's output, how much of MARS's
      reasoning is passed to VENUS? What is the optimal handoff format?

5. **Fine-tuning potential: Taste Vault as training data.**
   The Taste Vault accumulates a user's preferences over time. Could this data be used to
   fine-tune a local model to match their style? Research and answer:
   - What is the minimum dataset size for meaningful fine-tuning of a 7B or 14B model?
     (LoRA / QLoRA approaches)
   - What format does Taste Vault data need to be in to be usable as fine-tuning examples?
     (Instruction-following pairs? Preference pairs for DPO?)
   - What hardware is required to run LoRA fine-tuning on a 7B model locally?
   - How would a fine-tuned model be integrated back into Ollama? (GGUF export workflow)
   - Is this a near-term feature (build in 6 months) or a future roadmap item (12-18 months)?
   - What is the privacy risk of a user exporting a fine-tuned model that encodes their
     proprietary patterns?

6. **Hardware requirements for smooth 21-agent parallel execution.**
   Nova26's Ralph Loop can run agents in parallel (`parallelMode: true`, `concurrency` up
   to N). What hardware does a user need for different performance profiles?

   Design a hardware tier table:

   | Tier | Hardware | Max Concurrent Agents | Recommended Model Size | Expected Latency/Task |
   |------|----------|----------------------|----------------------|----------------------|
   | Minimum | ? | ? | ? | ? |
   | Comfortable | ? | ? | ? | ? |
   | Power User | ? | ? | ? | ? |
   | Server/Team | ? | ? | ? | ? |

   Fill in the table with specific hardware (e.g., "MacBook Pro M3 Pro, 36GB unified memory")
   and realistic numbers. Include a note on whether NVIDIA GPU or Apple Silicon makes a
   meaningful difference for Ollama inference.

7. **Cost comparison: local Ollama vs cloud API.**
   Nova26's local-first approach is a moat. Quantify it:
   - Estimate the monthly token usage for a power user running Nova26 for 4 hours/day,
     5 days/week. (Assume average task = 2,000 tokens in + 1,000 tokens out, 50 tasks/day.)
   - At that usage level, what would the monthly API cost be on:
     - OpenAI GPT-4o (current pricing)
     - Anthropic Claude Sonnet (current pricing)
     - Google Gemini Pro (current pricing)
   - What is the local inference cost? (electricity: estimate kWh for a MacBook M3 Pro
     running Ollama at 70% GPU load for 4 hours, at $0.12/kWh average US rate)
   - Compute the break-even: at what usage level does local inference pay for itself
     vs cloud API, assuming the user spent $3,000 on hardware?
   - Express the annual savings as a number the Nova26 marketing page can use.

8. **Model update strategy.** Ollama models improve rapidly. How does Nova26 handle model
   updates without breaking agent behavior?
   - Should Nova26 pin specific model versions or always use latest?
   - How do Playbooks (from R7-01) need to be revalidated when a model changes?
   - Design a `ModelVersionPolicy` config option and its handling in the system.

9. **File structure.** Specify:
   - `src/llm/model-router.ts` — `selectModel()` function + `ModelRoutingConfig` interface
   - `src/llm/context-manager.ts` — context prioritization and compression logic
   - `src/llm/model-config.ts` — agent-to-model mapping, hardware tier detection

10. **Open questions for the build team.** List 3-5 questions.

---

## Output Format

- Label each section clearly: `## GROK-R8-01`, `## GROK-R8-02`, etc.
- Begin each deliverable with the big-picture analogy paragraph before any technical content.
- Use TypeScript for all interfaces and method signatures.
- Use ASCII or prose for flow diagrams — no image dependencies.
- For code examples that reference real Nova26 files, use the actual file paths:
  - `src/orchestrator/ralph-loop.ts`
  - `src/orchestrator/prompt-builder.ts`
  - `src/llm/structured-output.ts`
  - `src/agent-loop/scratchpad.ts`
  - `src/agent-loop/agent-loop.ts`
  - `src/memory/session-memory.ts`
  - `src/analytics/agent-analytics.ts`
  - `convex/schema.ts`
  - `convex/atlas.ts`
- Each deliverable should be independently useful — a developer picking up GROK-R8-04
  should not need to read R8-01 first.
- Estimated output: 3,000-5,000 words per deliverable, 15,000-25,000 words total.

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

// Ralph Loop options (extend this for new features)
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
  acePlaybooks?: boolean;      // added in R7-01
  rehearsalStage?: boolean;    // added in R7-02
  // TODO: add similarityEngine?: boolean; modelRouting?: boolean;
}
```

---

## Coordination Note

Kimi is currently building KIMI-VAULT-01 through KIMI-VAULT-06 (Living Taste Vault), then
moves to ACE and Rehearsal Stage implementation.

Your specs in R8-01 (Similarity Engine) and R8-04 (Security) reference Kimi's vault interfaces
as dependencies — design your specs to plug into whatever Kimi builds, not to replace it.
When you reference the Vault in your specs, note explicitly:
"Integration point with KIMI-VAULT — exact function signature TBD pending Kimi's output."

Claude Code (claude-sonnet-4-6) owns `src/orchestrator/`, `src/llm/`, and `convex/`.
Your new files (`src/similarity/`, `src/security/`) land in new directories — clean slate
for whoever picks up the implementation.

Existing Convex tables (from `convex/schema.ts`): `builds`, `tasks`, `executions`,
`patterns`, `agents`, `companyAgents`, `learnings`. Your R8-02 schema additions must not
modify these tables — only add new ones alongside them.

---

*Prompt issued by Claude Code on 2026-02-18. Grok R8 output should be delivered to
`.nova/output/` or committed directly to the `grok/r8` branch for coordinator review.*
