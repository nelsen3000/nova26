# GROK-R12: Nova26 Integration, Retention & Community Research Prompt

> Assigned to: Grok
> Round: R12 (post-R11)
> Date issued: 2026-02-18
> Status: Active

---

## Context Brief

Nova26 is a 21-agent AI-powered IDE built with TypeScript, Ollama, and Convex. The 21 agents
are named after celestial bodies (MARS, VENUS, MERCURY, JUPITER, SATURN, PLUTO, ATLAS, etc.)
and operate through a core execution engine called the Ralph Loop (`src/orchestrator/ralph-loop.ts`),
which drives a Generator -> Reflector -> Curator cycle (ACE) for iterative quality improvement.

**Current state of the build:**
- R1-R11 covered: tool use, inner loops, Taste Vault, Global Wisdom Pipeline, ACE specs,
  Rehearsal Stage, Self-Improvement Protocol, Real-Time Collaboration, Security/Privacy,
  Ollama Model Strategy, Plugin Ecosystem, Team/Enterprise, CI/CD Integration, Advanced
  Analytics, Onboarding & Education, Error Recovery, Performance Optimization, Testing at
  Scale, Accessibility/i18n, Long-Term Architecture, Multi-Modal Vision, Voice Interface,
  Code Quality Benchmarks, Knowledge Graph Visualization, Autonomous Project Generation.
- Open-source tools researched by Grok: Obsidian Skills (knowledge graphs), Context7
  (live documentation retrieval), UI/UX Pro Max (design skills), Superpowers (agent skill
  framework). Top priority integrations recommended: **Superpowers + Context7**.
- Kimi has built: inner loop, Taste Vault + Global Wisdom, ACE + Rehearsal + Self-Improvement,
  similarity engine, Convex real-time, security, model routing, analytics. Currently in polish
  sprint (error recovery, performance, testing).
- Kiro extracted 79 patterns from BistroLens into `.nova/bistrolens-knowledge/`.
- 1226+ tests passing, 0 TypeScript errors.
- Premium pricing: $299/month. Local-first with Ollama.

**R12 mission:** Grok has covered the full technical surface of Nova26. R12 shifts to the two
remaining levers that determine whether an excellent product becomes a successful business:
(1) practical integration of the open-source tools Grok already vetted (Context7, Superpowers),
and (2) the human systems — retention mechanics, pricing optimization, and community — that
turn users into advocates and advocates into revenue. A product no one knows about, or that
people cancel after 30 days, is a product that fails regardless of its technical quality.

**Your style:** Open each deliverable with a big-picture analogy that makes the architecture
click instantly. Then go deep — TypeScript interfaces, method signatures, file structure, flow
diagrams in ASCII or prose. Every spec must be ready-to-implement or ready-to-research: a
developer or researcher should be able to pick it up without reading R1-R11. For the
business-facing deliverables (R12-03, R12-04, R12-05), go equally deep on concrete
recommendations: actual email copy, actual pricing numbers, actual Discord channel names.
Vague strategy documents are not acceptable — specific, actionable outputs only.

---

## Deliverables

Label each section clearly: GROK-R12-01, GROK-R12-02, etc.

---

### GROK-R12-01: Context7 Integration Spec

**The ask:** Nova26's agents currently reason about code using knowledge frozen at their
training cutoff. When MARS writes a Next.js 15 App Router route handler, it may confidently
produce code that was correct for Next.js 13 and wrong today. This is not a model limitation —
it is an information supply problem. Context7 (github.com/upstash/context7) solves it by
providing real-time, current documentation for any library or framework, fetched on demand.
Integrating Context7 transforms Nova26's agents from brilliant-but-outdated colleagues into
colleagues who pull up the official docs before answering — and get it right every time.
The analogy: adding Context7 to Nova26's agents is like giving a senior developer a live
internet connection in the middle of a pair programming session — the expertise was already
there, but now it is always current.

Produce a complete, ready-to-code specification covering:

1. **The big-picture analogy.** One paragraph. An agent that fetches live documentation
   before generating code is like what other professional who checks the authoritative
   source before giving advice that could be acted upon? The key insight is that agents
   hallucinate API shapes not because they lack reasoning ability but because their training
   data is stale — and live doc injection is the most targeted possible fix. The analogy
   should capture why this is a retrieval problem, not a reasoning problem, and why the
   solution is a fetch-and-inject pattern rather than a bigger model.

2. **Context7 architecture deep-dive.** Research and specify:
   - How does Context7 work under the hood? (It maps library names + version queries to
     documentation sources, retrieves current docs, and returns chunked, LLM-ready content.)
   - What is the Context7 API? (REST API at `https://context7.com/api/v1/docs`? MCP server?
     Specify the actual endpoint shape based on the GitHub repo.)
   - What rate limits apply to the free tier vs. paid tier?
   - What libraries does Context7 cover as of 2026? (Next.js, React, Prisma, Convex, Ollama,
     shadcn/ui, Tailwind — confirm coverage for Nova26's core stack.)
   - How are documentation responses structured? (Chunks? Sections? Versioned by semver?)
   - What is the latency for a typical doc fetch? (Estimate for cached vs. uncached responses.)
   - Does Context7 expose an MCP server interface? If so, how does that change the integration
     approach — should Nova26 consume Context7 as an MCP server rather than a direct API?

3. **`fetchDocs` tool design.** Design the new ToolRegistry entry:

   The `fetchDocs` tool is the primary interface through which agents access live documentation.
   Agents call it exactly as they would call `read_file` or `run_tests` — it is a first-class
   tool in the ReAct loop, not a middleware layer.

   ```typescript
   interface DocsQuery {
     library: string;             // e.g., 'next.js', 'convex', 'prisma'
     topic: string;               // e.g., 'app router', 'mutations', 'schema'
     version?: string;            // e.g., '15.0', '0.18.x' — omit for latest
     maxChunks?: number;          // default 3; controls context length
   }

   interface DocsResult {
     library: string;
     version: string;             // resolved version (e.g., '15.1.2')
     topic: string;
     chunks: DocsChunk[];
     fetchedAt: string;           // ISO timestamp
     source: 'cache' | 'live';   // whether this came from local cache or live Context7 fetch
     cacheExpiresAt?: string;     // ISO timestamp; absent if source === 'live'
   }

   interface DocsChunk {
     id: string;
     title: string;               // e.g., 'Route Handler API reference'
     content: string;             // LLM-ready markdown
     url: string;                 // canonical URL for the docs page
     relevanceScore: number;      // 0-1, how well this chunk matches the query topic
   }

   interface DocsFetcher {
     fetch(query: DocsQuery): Promise<DocsResult>;
     prefetch(libraries: string[]): Promise<void>;   // warm cache for a project's dependencies
     clearCache(library?: string): Promise<void>;    // clear all or one library's cache
   }

   interface DocsCache {
     get(key: string): DocsResult | null;
     set(key: string, result: DocsResult, ttlMs: number): void;
     invalidate(library: string): void;
     getStats(): { hitRate: number; totalEntries: number; totalSizeBytes: number };
   }

   interface FetchDocsToolParams {
     library: string;
     topic: string;
     version?: string;
   }
   ```

   Specify:
   - How the `fetchDocs` tool is registered in `src/agent-loop/agent-loop.ts` alongside
     existing tools. Show the tool registration object shape.
   - How the tool handler calls Context7 (direct REST, or via the MCP interface if available).
   - What the tool returns to the agent as the tool-call result string (a markdown-formatted
     summary of the most relevant `DocsChunk` content, attributed with the URL).
   - How the tool gracefully degrades when Context7 is unreachable (fall back to cache;
     if cache is empty, return a structured warning the agent can act on).

4. **Caching strategy.** Design the two-tier caching system:

   **Tier 1 — In-memory cache (hot):**
   - Stores the last N doc queries in process memory (LRU, configurable N, default 50 entries)
   - TTL: 1 hour for free tier, 15 minutes for premium (fresher is more valuable to premium)
   - Key: `${library}@${resolvedVersion}:${normalizedTopic}`

   **Tier 2 — Disk cache (warm):**
   - Stores serialized `DocsResult` objects as JSON in `.nova/docs-cache/<library>/`
   - TTL: 7 days for free tier, 24 hours for premium
   - On process start, warm the in-memory cache from disk for the current project's dependencies
     (scan `package.json` → prefetch docs for all direct dependencies)
   - Cache invalidation: manual (`nova26 docs clear next.js`), on TTL expiry, or on `package.json`
     dependency version change (watch `package.json` for version bumps)

   **Free vs. Premium tier differentiation:**
   - Free: disk cache only, no live fetches after the first fetch (cache-forever mode)
   - Premium: live fetches on every request (always-fresh mode), 15-minute in-memory TTL
   - The `DocsFetcher` implementation reads `config.premium` to decide which tier to activate

   Show the cache key normalization function (lowercase, trim whitespace, strip punctuation
   from the topic string to maximize cache hits across similar queries).

5. **Integration with `prompt-builder.ts`.** Design the doc injection pipeline:

   When a task involves a known library (detected by scanning task description and current
   file context for import statements), `prompt-builder.ts` proactively fetches relevant docs
   and injects them into the agent's system context before the first ACE cycle.

   ```
   Task received → scan for library references → for each library: fetchDocs(library, inferred topic)
   → inject top 2 chunks per library into system context → run ACE cycle
   ```

   - Where in `prompt-builder.ts` does doc injection occur? (After the Taste Vault context
     injection, before the tool list is appended — docs are context, not instructions.)
   - What is the maximum total doc content injected per task? (Cap at 2,000 tokens to avoid
     context overflow; rank chunks by relevance score and trim from the bottom.)
   - How does `prompt-builder.ts` infer the relevant topic from the task description?
     (Use a lightweight pattern: if the task mentions "route handler" and the library is
     "next.js", the topic is "route handlers". Define a small topic-inference map.)
   - Show the additions to the `PromptBuilderOptions` interface:

   ```typescript
   // New in R12:
   context7Enabled?: boolean;
   context7Config?: Context7Config;

   interface Context7Config {
     apiKey?: string;                 // optional for free tier, required for premium live fetches
     maxChunksPerLibrary: number;     // default 2
     maxTotalTokens: number;          // default 2000
     cacheDir: string;                // default '.nova/docs-cache'
     freeTier: boolean;               // if true, cache-only mode
     prefetchOnProjectOpen: boolean;  // default true for premium, false for free
   }
   ```

6. **Library name normalization.** Design the alias map that handles the messy reality of
   library names in the wild:
   - `react` → Context7 query: `react`
   - `next` / `next.js` / `nextjs` → `next.js`
   - `@prisma/client` / `prisma` → `prisma`
   - `convex` / `convex-dev` → `convex`
   - `shadcn` / `shadcn/ui` / `@shadcn/ui` → `shadcn-ui`
   - `tailwind` / `tailwindcss` → `tailwindcss`
   - `ollama` / `ollama-js` → `ollama`
   - Provide a `normalizeLibraryName(raw: string): string` function signature and the
     full alias map as a `Record<string, string>`.

7. **File structure.** Specify:
   - `src/tools/context7/docs-fetcher.ts` — `DocsFetcher` implementation, Context7 API calls
   - `src/tools/context7/docs-cache.ts` — two-tier cache implementation
   - `src/tools/context7/fetch-docs-tool.ts` — ToolRegistry entry, parameter validation
   - `src/tools/context7/library-normalizer.ts` — alias map, normalization function
   - `src/tools/context7/prompt-injector.ts` — `prompt-builder.ts` integration logic
   - `src/tools/context7/index.ts` — unified export and tool registration helper
   - `.nova/docs-cache/` — runtime directory (added to `.gitignore`)
   - `src/tools/context7/context7.test.ts` — unit tests (cache hit/miss, graceful degradation,
     library normalization, token budget enforcement)

8. **Open questions for the build team.** List 3-5 questions that must be answered before
   implementation begins. Address: MCP vs. REST integration decision, API key management,
   whether Context7 coverage of Convex's API is sufficient, and the interaction between
   Context7 doc freshness and the ACE Reflector's citation behavior.

---

### GROK-R12-02: Superpowers/Skills Framework Adaptation

**The ask:** Nova26's tools are atomic — `read_file`, `write_file`, `run_tests`. They are
the building blocks. But expert developers do not think in atomic operations — they think in
workflows: "debug root cause", "refactor safely", "optimize hot path". These are multi-step,
repeatable patterns of tool use that encode domain expertise. The Superpowers pattern
(github.com/obra/superpowers) provides a model for packaging this expertise as composable,
shareable skills. Adapting it into Nova26 means agents can pick up a "debug-root-cause" skill
the way a surgeon picks up a proven diagnostic protocol — not improvising from scratch each
time, but executing a battle-tested sequence with full situational awareness. The analogy:
skills are to tools what surgical protocols are to scalpels — the protocol tells you which
instrument to reach for, in what order, and what to check before moving to the next step.

Produce a complete, ready-to-code specification covering:

1. **The big-picture analogy.** One paragraph. A skills framework layered on top of a tools
   framework is like what other abstraction hierarchy where lower-level primitives are composed
   into higher-level reusable patterns? The key insight is that skills are not just macros —
   they are adaptive workflows that use tool results to decide their next step. A skill is
   stateful within its execution; a tool is stateless. The right analogy should capture the
   "strategy that orchestrates tactics" distinction.

2. **Skills vs. tools — the conceptual boundary.** Define it precisely:

   | Dimension | Tool | Skill |
   |---|---|---|
   | Steps | Single operation | Multi-step workflow (2-20 steps) |
   | State | Stateless | Stateful within execution |
   | Decision logic | None | Branches based on intermediate results |
   | Reusability | Called ad hoc | Packaged, versioned, shareable |
   | Author | Nova26 core team | Core team + community |
   | Example | `run_tests` | `debug-root-cause` (runs tests → reads errors → searches code → proposes fix → reruns) |
   | ACE integration | Evaluated per tool call | Evaluated as a complete unit |

   Clarify: when should an agent call a skill vs. composing tools directly? (Rule of thumb:
   if the same sequence of tool calls appears in 3+ different tasks, it should be a skill.)

3. **Core TypeScript interfaces.** Define the full skill type system:

   ```typescript
   interface Skill {
     id: string;                    // e.g., 'debug-root-cause'
     name: string;                  // human-readable: 'Debug Root Cause'
     version: string;               // semver: '1.0.0'
     description: string;           // what this skill does and when to use it
     author: string;                // 'nova26-core' or a community username
     category: SkillCategory;
     steps: SkillStep[];
     inputs: SkillInput[];          // required inputs before skill starts
     outputs: SkillOutput[];        // what the skill produces on success
     compatibleAgents: AgentName[]; // which agents this skill is designed for
     requiredTools: string[];       // tool names this skill depends on
     estimatedSteps: number;        // rough guide for ACE iteration budgeting
     tasteVaultTags?: string[];     // tags for Taste Vault pattern matching
   }

   type SkillCategory =
     | 'debugging'
     | 'refactoring'
     | 'optimization'
     | 'testing'
     | 'documentation'
     | 'security'
     | 'architecture'
     | 'onboarding'
     | 'custom';

   interface SkillStep {
     id: string;                    // e.g., 'step-1-run-tests'
     name: string;
     description: string;
     toolName: string;              // which tool this step calls
     toolParams: Record<string, unknown> | SkillParamRef[];  // static params or refs to skill inputs/prior outputs
     condition?: SkillCondition;    // if present, step only executes when condition is true
     onSuccess: SkillTransition;    // what to do next on success
     onFailure: SkillTransition;    // what to do next on failure
     retryable: boolean;
     maxRetries: number;
   }

   interface SkillParamRef {
     type: 'input' | 'step-output';
     ref: string;                   // input name or 'step-{id}.{field}'
   }

   interface SkillCondition {
     expression: string;            // e.g., 'step-1-run-tests.testsPassed === false'
     description: string;           // human-readable: 'only if tests are failing'
   }

   type SkillTransition =
     | { type: 'next' }                    // proceed to next step in order
     | { type: 'goto'; stepId: string }    // jump to a specific step
     | { type: 'complete'; outputRef?: string }  // skill is done, return output
     | { type: 'fail'; reason: string };   // skill has failed

   interface SkillInput {
     name: string;                  // e.g., 'targetFile'
     type: 'string' | 'file-path' | 'agent-name' | 'test-suite';
     required: boolean;
     description: string;
     default?: unknown;
   }

   interface SkillOutput {
     name: string;                  // e.g., 'rootCause'
     type: 'string' | 'file-path' | 'patch' | 'report';
     description: string;
   }

   interface SkillExecution {
     id: string;                    // execution UUID
     skillId: string;
     skillVersion: string;
     agentName: AgentName;
     inputs: Record<string, unknown>;
     status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
     currentStepId?: string;
     stepResults: Record<string, unknown>;  // stepId → tool result
     outputs?: Record<string, unknown>;
     startedAt: string;
     completedAt?: string;
     durationMs?: number;
     error?: string;
   }
   ```

4. **Skill execution engine.** Design the `SkillRunner`:

   ```typescript
   interface SkillRunner {
     execute(skill: Skill, inputs: Record<string, unknown>, context: SkillRunContext): AsyncGenerator<SkillExecutionEvent>;
     pause(executionId: string): Promise<void>;
     resume(executionId: string): Promise<void>;
     cancel(executionId: string): Promise<void>;
     getExecution(executionId: string): SkillExecution | null;
   }

   interface SkillRunContext {
     agentName: AgentName;
     taskId: string;               // the Ralph Loop task this skill is part of
     toolRegistry: ToolRegistry;   // the agent's current tool registry
     tasteVault?: TasteVaultClient;
     onProgress?: (event: SkillExecutionEvent) => void;
   }

   type SkillExecutionEvent =
     | { type: 'step-started'; stepId: string; stepName: string }
     | { type: 'step-completed'; stepId: string; result: unknown }
     | { type: 'step-failed'; stepId: string; error: string; willRetry: boolean }
     | { type: 'condition-skipped'; stepId: string; reason: string }
     | { type: 'skill-completed'; outputs: Record<string, unknown>; durationMs: number }
     | { type: 'skill-failed'; error: string; lastStepId: string };
   ```

   Describe the step execution loop: how `toolParams` with `SkillParamRef` entries are
   resolved at runtime (by substituting prior step results), how `SkillCondition` expressions
   are evaluated (safely — use a tiny expression parser, NOT `eval`), and how `SkillTransition`
   determines the next step.

5. **Integration with ACE playbooks.** Design the `Skill <-> ACE` bridge:

   Skills are elevated first-class artifacts in the ACE playbook system. The playbook system
   (from R5-R6) recommends next actions; it should also recommend applicable skills.

   - How does the ACE Reflector detect that the agent is about to improvise a multi-step
     workflow that exists as a skill? (The Reflector checks the agent's planned tool sequence
     against a skill index; if a skill covers the same sequence, it suggests using the skill.)
   - How does JUPITER learn from skill execution to create new playbook directives?
     (On skill completion, the `SkillExecution` result is evaluated; if the quality score
     exceeds a threshold, JUPITER adds a playbook directive: "When debugging failing tests
     in this project, prefer the `debug-root-cause` skill.")
   - How does the Taste Vault store skill preferences? (Skills with `tasteVaultTags` have
     their usage logged as patterns: "user applied `debug-root-cause` skill 8 times — high
     preference signal.")
   - Define the `SkillRecommendation` type that the ACE Reflector emits:

   ```typescript
   interface SkillRecommendation {
     skillId: string;
     skillName: string;
     reason: string;               // why the Reflector thinks this skill applies
     confidence: number;           // 0-1
     requiredInputs: Record<string, unknown>;  // pre-filled from context
   }
   ```

6. **Skill Marketplace.** Design the community skill distribution system:

   ```typescript
   interface SkillMarketplace {
     search(query: string, category?: SkillCategory): Promise<SkillListing[]>;
     install(skillId: string, version?: string): Promise<Skill>;
     uninstall(skillId: string): Promise<void>;
     publish(skill: Skill, metadata: SkillPublishMetadata): Promise<SkillListing>;
     getInstalled(): Skill[];
     checkUpdates(): Promise<SkillUpdate[]>;
   }

   interface SkillListing {
     id: string;
     name: string;
     latestVersion: string;
     author: string;
     description: string;
     category: SkillCategory;
     downloadCount: number;
     rating: number;              // 0-5
     ratingCount: number;
     compatibleAgents: AgentName[];
     previewSteps: string[];      // human-readable step names for preview
     tags: string[];
   }

   interface SkillPublishMetadata {
     tags: string[];
     previewSteps: string[];
     changelogEntry: string;      // for this version
     testCoverage?: number;       // 0-1
   }

   interface SkillUpdate {
     skillId: string;
     installedVersion: string;
     latestVersion: string;
     changelog: string;
   }
   ```

   Specify:
   - Where are installed skills stored on disk? (`.nova/skills/<skillId>@<version>/skill.json`)
   - How are skills distributed? (A central registry at `skills.nova26.dev` serving HTTPS JSON,
     or a GitHub-based registry like `npm` uses a registry endpoint?)
   - How are skills sandboxed? (Skills only call tools that are already in the agent's
     `ToolRegistry` — they cannot introduce new code execution paths. This is the security
     boundary: a skill is a workflow descriptor, never executable code.)
   - Security model: how are community skills reviewed before they appear in the marketplace?
     (Automated scan for: tool names not in the standard tool set, external network calls in
     `toolParams`, excessively long step chains > 50 steps.)

7. **Built-in skills: the starter library.** Design the 5 core skills shipped with Nova26:

   For each skill: id, name, description, step sequence (plain English, numbered), inputs,
   outputs, and recommended agent.

   - **`debug-root-cause`**: runs tests → reads error output → searches codebase for root cause
     → generates a fix hypothesis → applies fix → reruns tests → reports outcome
   - **`refactor-safely`**: reads target file → runs related tests (baseline) → extracts
     refactoring intent from task description → applies refactor in small increments → runs
     tests after each increment → if any step fails, reverts → reports final state
   - **`optimize-performance`**: profiles the target function/module → identifies the slowest
     path → researches optimization patterns (via `fetchDocs` if relevant library) → applies
     optimization → benchmarks before/after → reports improvement ratio
   - **`security-audit`**: scans target files with SAST tool → categorizes findings by severity
     → for each critical/high finding: generates a fix → applies fix → rescans to confirm
     resolution → generates audit report
   - **`onboard-module`**: reads a target module's source → generates a plain-English explanation
     → identifies entry points and public API → generates usage examples → writes a
     `<module>.docs.md` file in the same directory

8. **File structure.** Specify:
   - `src/skills/skill-types.ts` — all TypeScript interfaces (`Skill`, `SkillStep`, `SkillExecution`, etc.)
   - `src/skills/skill-runner.ts` — `SkillRunner` execution engine
   - `src/skills/skill-registry.ts` — local skill index, lookup, version management
   - `src/skills/skill-marketplace.ts` — `SkillMarketplace` implementation
   - `src/skills/condition-evaluator.ts` — safe `SkillCondition` expression evaluator
   - `src/skills/ace-bridge.ts` — `SkillRecommendation` generation, playbook integration
   - `src/skills/builtin/debug-root-cause.ts` — built-in skill definition
   - `src/skills/builtin/refactor-safely.ts`
   - `src/skills/builtin/optimize-performance.ts`
   - `src/skills/builtin/security-audit.ts`
   - `src/skills/builtin/onboard-module.ts`
   - `src/skills/index.ts` — unified export
   - `.nova/skills/` — installed community skills (added to `.gitignore` for user-specific installs)
   - New `RalphLoopOptions` additions:
     ```typescript
     // New in R12:
     skillsEnabled?: boolean;
     skillsConfig?: SkillsConfig;

     interface SkillsConfig {
       builtinSkillsEnabled: boolean;   // default true
       marketplaceEnabled: boolean;     // default true for premium, false for free
       aceRecommendations: boolean;     // Reflector suggests skills during ACE
       maxSkillSteps: number;           // safety cap, default 30
     }
     ```

9. **Open questions for the build team.** List 3-5 questions addressing: how to prevent
   skill step loops (infinite condition cycles), how to version-pin skill dependencies when
   a required tool is deprecated, and how the `SkillRunner` interacts with the existing
   ACE iteration counter.

---

### GROK-R12-03: User Retention & Engagement Mechanics

**The ask:** Acquiring a $299/month user costs money. Keeping them costs excellence. The
economics of Nova26 are governed entirely by Monthly Recurring Revenue (MRR = subscribers
× price) and churn rate (the percentage who cancel each month). A product with 5% monthly
churn loses half its user base in 14 months. A product with 2% monthly churn has a user
lifetime of 4+ years. The difference between 5% churn and 2% churn is not feature quality —
it is the presence or absence of engagement mechanics that make users feel the product is
actively working for them every day. The analogy: retention mechanics in a SaaS product are
like a coral reef — the hard structure (the product itself) is necessary but not sufficient;
the living ecosystem of habit loops, milestone celebrations, and social proof is what makes
users stay, just as the reef's biodiversity is what makes it worth protecting.

Produce a complete, actionable specification covering:

1. **The big-picture analogy.** One paragraph. Designing retention mechanics for a premium
   developer tool is like designing what other system where intrinsic value must be made
   visible and celebrated to prevent abandonment? The key insight is that Nova26 creates
   real, measurable value (hours saved, bugs prevented, patterns learned) that users
   experience implicitly but rarely stop to quantify — and retention mechanics work by
   surfacing that invisible value in concrete, human-readable terms. The right analogy should
   capture the "making invisible value visible" mechanism.

2. **Weekly Studio Report.** Design the weekly email digest:

   The Studio Report is Nova26's highest-leverage retention asset. It arrives every Monday
   morning, it is personalized, and it answers the question every $299/month subscriber asks
   unconsciously: "Is this worth it?"

   Write the complete email template:
   - Subject line options (A/B test these): at least 3 variants
   - Hero stat: "Your agents completed [N] tasks this week" — large, prominent
   - Secondary stats block:
     - Hours saved (estimate: 1 agent task ≈ 45 minutes of human dev time)
     - Test pass rate trend (up or down from last week)
     - New patterns learned this week
     - Vault size (total patterns, with sparkline if HTML email)
   - "This week's highlight" section: the single most impressive task MARS completed,
     with a 2-sentence summary and a link to the build log
   - "Your vault is learning" section: 1-2 new patterns added to Taste Vault this week,
     displayed as short quotes with quality scores
   - Global Wisdom note (premium only): "2 of your patterns were promoted to Global Wisdom
     this week — [N] other builders now benefit from your taste."
   - Call to action: "Continue building" button → opens Nova26 CLI or dashboard
   - Unsubscribe link (required by CAN-SPAM)

   Specify the data model that powers the report:
   ```typescript
   interface WeeklyStudioReport {
     userId: string;
     weekEnding: string;           // ISO date (Sunday)
     tasksCompleted: number;
     estimatedHoursSaved: number;  // tasksCompleted * 0.75 hours
     testPassRateCurrent: number;  // 0-1
     testPassRatePrevious: number;
     newPatternsLearned: number;
     vaultTotalPatterns: number;
     highlightTask: {
       title: string;
       agentName: AgentName;
       summary: string;
       buildLogUrl: string;
     } | null;
     newVaultPatterns: Array<{ text: string; qualityScore: number }>;
     patternsPromotedToGlobalWisdom: number;   // 0 for non-premium
     generatedAt: string;
   }
   ```

   Where is the report generated? (Convex scheduled function, runs Sunday at 11pm UTC,
   queries the `builds`, `tasks`, `patterns`, and `learnings` tables for the past 7 days,
   sends via Resend or Postmark.) Show the Convex scheduled function signature.

3. **Streak system.** Design the daily build streak:

   - **Definition:** a streak day is any day the user's agents complete at least one task
   - **Streak milestones** (with celebration copy):
     - 3 days: "You're on a 3-day building streak. Momentum is everything."
     - 7 days: "One week straight. Your vault just learned [N] new patterns."
     - 14 days: "14 days of building. Nova26 is starting to really know your style."
     - 30 days: "30-day streak. You've saved an estimated [N] hours this month."
     - 90 days: "Quarterly streak. Your Taste Vault is in the top 5% by pattern count."
     - 365 days: "One year. Nova26 has been your co-builder for 365 days. Here's your year in review." [special email]
   - **Streak recovery:** if a user misses a day, offer a 24-hour grace window:
     "You missed yesterday. Your 12-day streak is at risk — run a quick build to keep it alive."
   - **What breaks a streak?** Define clearly: missing a UTC calendar day with zero task
     completions. Weekend grace mode option: streaks do not require weekends (for users who
     set `streakMode: 'weekdays-only'`).
   - **CLI streak indicator:** `nova26 status` shows `Streak: 14 days 🔥` (or ASCII: `Streak: 14 days [**]`)

   Data model:
   ```typescript
   interface UserStreak {
     userId: string;
     currentStreak: number;         // days
     longestStreak: number;
     lastActivityDate: string;      // ISO date
     streakMode: 'daily' | 'weekdays-only';
     graceWindowActive: boolean;
     graceWindowExpiresAt?: string; // ISO timestamp
     milestonesCelebrated: number[]; // streak lengths that have been celebrated (to avoid repeat)
   }
   ```

4. **Vault milestones.** Design the Taste Vault growth celebration system:

   The Taste Vault grows with every build. Milestone celebrations make the vault feel like
   a living asset rather than a background process.

   - **Milestone thresholds:** 10, 50, 100, 250, 500, 1000, 2500, 5000 patterns
   - For each milestone, specify:
     - In-app notification copy (1 sentence, shown in the CLI build output)
     - Email subject line
     - Email body (2-3 sentences + a stat: "Your 500th pattern was about: [pattern text excerpt]")
   - **"Your style evolved" report** (triggered at 100, 500, 1000 patterns):
     - Top 3 most-referenced patterns (your most consistent preferences)
     - Most recently added pattern (what you've been learning lately)
     - A quality score trend: "Your patterns' average quality score went from 0.71 to 0.84 over
       the past 90 days — your taste is getting sharper."
   - Write the complete 500-pattern milestone email.

5. **Community engagement: Builder of the Week.** Design the opt-in showcase:

   - **Opt-in mechanism:** `nova26 config set showcaseOptIn true` + checkbox in onboarding
   - **Selection criteria** (weekly, automated): highest weekly task completion count among
     opted-in users, tie-broken by vault quality score improvement
   - **"Builder of the Week" deliverables:**
     - Featured in the weekly digest email sent to all users (not just the winner)
     - A public profile page at `nova26.dev/builders/<username>` showing: streak, vault stats,
       top patterns (anonymized), notable builds (titles only)
     - A Discord "Builder of the Week" role (auto-assigned via bot for 7 days)
   - **Privacy:** no actual code or build content is ever made public without explicit approval
     on a per-build basis. The showcase is stats and pattern themes only.

6. **Churn prediction.** Design the early warning system:

   Define the churn risk signals (score 0-10 per user; 7+ is high risk):
   - No builds in the past 7 days: +3 points
   - Build frequency down >50% vs. 30-day average: +2 points
   - No builds in the past 14 days: +5 points (replaces the 7-day signal)
   - Task failure rate this week > 30%: +2 points (frustrated users churn)
   - Studio Report email not opened for 3 consecutive weeks: +1 point
   - Subscription created < 30 days ago (new user churn risk): +1 point
   - Last build had a critical error with no retry: +1 point

   ```typescript
   interface ChurnRiskProfile {
     userId: string;
     score: number;                // 0-10
     riskLevel: 'low' | 'medium' | 'high' | 'critical';
     signals: ChurnSignal[];
     recommendedIntervention: ChurnIntervention;
     computedAt: string;
   }

   interface ChurnSignal {
     name: string;
     points: number;
     description: string;         // human-readable: "No builds in 7 days"
   }

   type ChurnIntervention =
     | { type: 'none' }
     | { type: 're-engagement-email'; templateId: string }
     | { type: 'personal-outreach'; reason: string }    // score >= 8
     | { type: 'cancellation-offer'; discountPercent: number };  // score >= 9
   ```

7. **Win-back campaigns.** Design the post-cancellation re-engagement sequence:

   When a user cancels, trigger a 4-email sequence:

   - **Email 1 (Day 0 — cancellation confirmed):**
     Subject: "Your Nova26 data is safe — and so is your vault."
     Body: Confirm cancellation. Tell them their Taste Vault is preserved for 90 days.
     Offer: "Changed your mind? Reactivate at any time and pick up exactly where you left off."

   - **Email 2 (Day 7):**
     Subject: "Nova26 just shipped [newest feature] — here's what you're missing."
     Body: 1 specific new feature or improvement. "Your vault still has [N] patterns waiting."
     Offer: None. Pure value demonstration.

   - **Email 3 (Day 30):**
     Subject: "Your vault expires in 60 days."
     Body: Urgency without manipulation. Specific stat from their last active month.
     Offer: 20% off first month back.

   - **Email 4 (Day 75 — 15 days before vault expiry):**
     Subject: "Your Taste Vault expires in 15 days."
     Body: Final notice. Specific pattern count. What they'll lose.
     Offer: 30% off first month back. Or: export your vault for free (even without reactivating).

   The vault export offer is the ethical safety net — it respects user autonomy and builds
   goodwill regardless of whether they return.

8. **TypeScript data model for engagement infrastructure.** Specify the additions to
   `convex/schema.ts` for:
   - `userEngagement` table: streak data, vault milestones celebrated, Studio Report history
   - `churnRisk` table: computed churn scores, intervention history
   Show the Convex table definitions and key indexes.

---

### GROK-R12-04: Revenue Optimization & Pricing Experiments

**The ask:** Nova26's $299/month price is a hypothesis, not a law. It was chosen based on
positioning (above Cursor, below Devin), but it has never been tested against alternatives.
The correct price is the one that maximizes MRR = (subscribers × price), which is a function
of conversion rate, churn rate, and expansion revenue. A price that is too high reduces
conversion; a price that is too low reduces revenue per user and attracts lower-intent buyers
who churn faster. Finding the optimal price is an empirical problem, not an opinion problem.
The analogy: pricing optimization for a SaaS product is like tuning a carburetor — you can
smell when the mixture is wrong (high churn, low conversion) but you need instruments to
find the exact setting that maximizes power without flooding the engine.

Produce a complete, actionable specification covering:

1. **The big-picture analogy.** One paragraph. Optimizing a SaaS pricing model is like
   what other optimization problem where the objective function has multiple local maxima
   and the only way to find the global maximum is systematic experimentation? The key insight
   is that pricing is not a one-time decision but a continuous optimization loop — measure,
   experiment, analyze, adjust. The right analogy should capture why intuition alone fails
   and why data-driven experimentation is the only reliable method.

2. **Competitive landscape analysis.** Build the positioning matrix:

   | Product | Price | Model | Target user | Key differentiator vs. Nova26 |
   |---|---|---|---|---|
   | GitHub Copilot | $19/mo | Cloud, single AI | Any developer | Ubiquity, IDE integration |
   | Cursor | $20/mo | Cloud, AI editor | Individual dev | Editor-native experience |
   | Windsurf (Codeium) | $15/mo | Cloud, AI editor | Individual dev | Speed, affordability |
   | Devin (Cognition) | $500/mo | Cloud, autonomous agent | Teams | Fully autonomous, async |
   | Bolt.new | $20/mo | Cloud, full-stack gen | Non-developers | Zero-setup, visual first |
   | Continue.dev | Free/OSS | Self-hosted | Privacy-focused devs | Open source, bring your own model |
   | Nova26 | $299/mo | Local-first, 21 agents | Professional devs | Privacy, taste learning, Ollama |

   Based on this matrix:
   - What is Nova26's justified premium over Cursor/Copilot? (15x price requires 15x perceived value.)
   - What is Nova26's justified discount vs. Devin? (Devin is $500 but fully hosted/managed;
     Nova26 requires more user involvement but is 40% cheaper and fully private.)
   - Identify the underserved segment: privacy-conscious professional developers willing to
     invest in local-first tooling who are currently using Copilot but dissatisfied with its
     cloud dependency. This is Nova26's primary acquisition target.

3. **Current pricing model analysis: $299/month flat.** Evaluate:
   - **Strengths:** simple, predictable, premium signal, aligns with "serious tool for serious
     developers" positioning
   - **Weaknesses:** high barrier to trial, no way to capture value from lighter users, all-or-
     nothing commitment (no pause, no downgrade)
   - **MRR sensitivity:** if churn is 5%/month, average subscriber LTV = $299 / 0.05 = $5,980.
     If churn drops to 2%, LTV = $14,950. Retention is worth 2.5x more than price optimization.
   - **Conversion sensitivity:** if 10% of free-trial users convert at $299, vs. 25% at $149,
     what is the breakeven? (At 1,000 trials/month: 10% × $299 = $29,900 MRR vs.
     25% × $149 = $37,250 MRR. Lower price wins if conversion uplift > 2.5x.)

4. **Pricing experiment design.** Design 3 concrete experiments:

   **Experiment A — Usage-based floor:**
   - Hypothesis: A $99/month base price with usage-based overage ($0.10/agent-task beyond
     200 tasks/month) will improve conversion without destroying MRR for power users.
   - Expected impact: conversion rate improves 2x (lower commitment); power users pay more.
   - Risk: revenue unpredictability; users optimize to stay under the cap.
   - Recommendation: test with a cohort of 50 trial users. Measure conversion and month-2
     task volume.

   **Experiment B — Annual discount:**
   - Current: no annual option. Proposed: $2,490/year (2 months free vs. $299 × 12 = $3,588).
     That is 30.6% savings, or equivalently, $207.50/month billed annually.
   - Why annual matters: converts MRR to ARR, reduces churn risk (committed for 12 months),
     improves cash flow (receive $2,490 upfront).
   - Churn assumption: annual subscribers churn at 30-50% the rate of monthly subscribers
     (industry benchmark). At 2% monthly churn, annual subscribers churn at ~0.8%/month.
   - Recommendation: launch annual billing immediately. It is low-risk and the industry
     standard. Present it as the default option on the pricing page.

   **Experiment C — Team pricing:**
   - Hypothesis: teams of 3-10 developers represent higher LTV than individual subscribers.
   - Proposed model: $199/seat/month for 3+ seats (33% discount vs. individual).
   - Alternative: flat team rate of $799/month for up to 5 seats ($159.80/seat).
   - Recommendation: flat team rate is easier to sell ("one invoice, no counting seats").
   - Team features required to justify team pricing: shared team vault, team analytics
     dashboard, centralized billing, single SSO login. (See GROK-R8 Team/Enterprise spec.)

5. **Free-to-paid conversion funnel.** Design the upgrade journey:

   Nova26 does not currently have a free tier. This is both a strength (no cheapening the
   brand) and a weakness (no low-friction trial path). Evaluate two options:

   **Option A — 14-day full-featured trial (no credit card):**
   - User installs Nova26, runs `nova26 trial` — full premium features for 14 days
   - At day 10, trigger the upgrade nudge sequence (3 emails + CLI notifications)
   - At day 14, features downgrade to "free tier" (limited to 10 tasks/day, no Global Wisdom)
   - Pros: low friction, user experiences full value before committing
   - Cons: users who never upgrade have consumed resources

   **Option B — Freemium with hard capability cap:**
   - Free tier: 10 tasks/day, local vault only, no Global Wisdom, no ACE playbooks
   - Premium: unlimited tasks, full vault, Global Wisdom, all features
   - Conversion trigger: user hits the 10-task cap and sees "You've reached your daily limit.
     Upgrade to unlock unlimited builds."
   - Pros: unlimited trial period, natural conversion trigger at the moment of highest intent
   - Cons: free users may be satisfied with 10 tasks/day and never upgrade

   Recommendation: Option A (14-day full trial, no credit card) for v1.0. Freemium introduces
   significant infrastructure complexity and may dilute the premium brand.

6. **Upsell moment map.** Identify the 5 highest-intent upgrade moments:

   | Moment | Trigger | Upsell message |
   |---|---|---|
   | Task cap hit (free tier) | 10th task in a day | "You're 10/10 for today. Upgrade for unlimited." |
   | First vault milestone | Vault reaches 10 patterns | "Your vault is learning. Upgrade to unlock Global Wisdom." |
   | Long build time | Build takes >30 min | "Premium users get parallel agent execution — 3x faster builds." |
   | Team invite | User invites a collaborator | "Invite your team. Team plans start at $799/month for 5 seats." |
   | Annual billing page view | User visits billing settings | "Save 30% with annual billing. Switch now." |

7. **Pricing page copy.** Write the complete pricing page (designed for conversion):

   **Headline:** "Build software at the speed of thought. Keep your code private."

   **Subheadline:** "Nova26 is a 21-agent AI IDE that runs entirely on your hardware.
   No cloud. No data sharing. No compromises."

   **Individual — $299/month or $2,490/year:**
   - 21 specialized AI agents
   - Taste Vault: personalized code quality memory
   - Global Wisdom: learn from 10,000+ builders
   - Unlimited builds, unlimited tasks
   - Local-first with Ollama (your data never leaves your machine)
   - Context7 live documentation (always-current API reference)
   - Skills marketplace
   - Priority support

   **Team — $799/month (up to 5 developers):**
   - Everything in Individual, times 5
   - Shared team vault
   - Team analytics dashboard
   - Centralized billing
   - SSO (SAML, Google Workspace)

   **FAQ answers** (write actual answers, not placeholders):
   - "Why $299?" → specific answer comparing to Devin ($500, cloud, no privacy) and Copilot ($19, no taste learning, shares your code)
   - "Can I use my own models?" → Yes, any Ollama model. Recommended: [list 3 models]
   - "What happens to my data?" → Never leaves your machine. Period. No telemetry without opt-in.
   - "Is there a free trial?" → Yes, 14 days, no credit card required. Full access.

8. **Revenue forecast model.** Provide a simple 12-month MRR model:
   - Assumptions: 50 paid users at launch, 15% month-over-month growth, 4% monthly churn
   - Show month 1-12 MRR and total ARR at end of year 1
   - Show the impact of reducing churn to 2%: what is the ARR difference?
   - Show the impact of adding team plans at 15% of subscribers: what is the ARR difference?
   - Provide the formula: `MRR_next = MRR_current * (1 + growth_rate - churn_rate) + expansion`

---

### GROK-R12-05: Developer Relations & Community Building Strategy

**The ask:** The best products in developer tooling do not win on features alone — they win
on community. VS Code beat Sublime Text not because it was technically superior on day one,
but because Microsoft built a community of extension authors, YouTube tutorial creators,
conference speakers, and Discord moderators that made VS Code the inevitable choice for new
developers. Nova26 needs the same ecosystem: a Discord where questions get answered in
minutes, a YouTube channel where weekly build sessions happen live, a GitHub org where
contributors submit agents and skills, and a conference circuit where Nova26's architecture
is the talk of the TypeScript community. The analogy: building a developer community is like
planting a forest — you do not grow a forest by planting one tree, you grow it by creating
the conditions (soil, water, sunlight, protection from deer) where many trees want to grow.
The conditions are: a frictionless contribution path, genuine recognition, and the sense
that participation makes the contributor better at their craft.

Produce a complete, actionable specification covering:

1. **The big-picture analogy.** One paragraph. Building a developer relations program for a
   technical product is like what other effort where the output is trust and reputation rather
   than a direct deliverable? The key insight is that DevRel is not marketing — it is
   a genuine contribution to the ecosystem that happens to benefit the company. The right
   analogy should capture why the most effective DevRel programs feel like community service,
   not advertising.

2. **Discord server structure.** Design the complete server:

   **Categories and channels:**

   ```
   # INFORMATION
   📋 #announcements       — release notes, major news (admin only)
   📖 #docs-and-guides     — pinned links to documentation
   🗺️ #roadmap             — public roadmap, vote on features

   # GETTING STARTED
   👋 #introductions       — new member intro thread
   ❓ #help-and-questions  — general support, community answers
   🚀 #quick-wins          — share your first successful Nova26 build

   # BUILD LOG
   🔨 #show-your-builds    — share what your agents built
   💡 #tips-and-tricks     — short tips, config tricks, model recommendations
   🔬 #benchmark-results   — share your quality scores and comparisons

   # SKILLS & PLUGINS
   🛠️ #skills-marketplace  — announce new community skills
   🔌 #plugin-showcase     — announce new plugins
   📬 #skill-requests      — request skills from the community

   # ADVANCED
   🧠 #architecture        — deep dives into Nova26's internals
   🤝 #contributing        — PRs, issues, contribution discussions
   🏗️ #agents              — agent-specific discussions (MARS, VENUS, etc.)

   # COMMUNITY
   🏆 #builder-of-the-week — weekly showcase (auto-posted by bot)
   🎉 #milestones          — vault milestones, streak celebrations (opt-in bot)
   💬 #off-topic           — non-Nova26 dev chat
   ```

   **Roles:**
   - `@Nova26 Team` — core team (assigned by admin)
   - `@Builder` — any verified paid subscriber (auto-assigned on account link)
   - `@Contributor` — merged a PR to nova26 (auto-assigned by GitHub Actions bot)
   - `@Skill Author` — published a skill to the marketplace
   - `@Builder of the Week` — 7-day rotating role
   - `@Ambassador` — Nova26 ambassadors (see section 7)

   **Bot automations** (using a custom Discord bot or Arcane/MEE6):
   - Auto-post Builder of the Week on Monday 9am UTC
   - Auto-assign `@Builder` role when user links their Nova26 account via OAuth
   - Auto-post to `#announcements` when a GitHub release is tagged
   - Weekly summary in `#build-log`: "This week: [N] builds shared, [N] skills published"
   - Streaks bot: if a user posts in `#milestones` with their streak count, react with
     custom emoji milestone badges

3. **Open-source strategy.** Define what to open-source and what to keep proprietary:

   **Open-source (MIT license):**
   - `src/agent-loop/` — the core ReAct loop (the engine; differentiator is the agents on top)
   - `src/orchestrator/ralph-loop.ts` — the ACE orchestration logic
   - `src/types/index.ts` — type definitions
   - `src/skills/builtin/` — the 5 built-in skills
   - CLI entrypoint (`nova26` command)
   - Agent XML templates (all 21) — invite the community to improve them

   **Proprietary (closed source):**
   - `src/memory/taste-vault/` — the Taste Vault learning algorithm (core moat)
   - `src/similarity/` — the similarity engine (trained on Nova26 data)
   - Global Wisdom Pipeline — the cross-user pattern aggregation logic
   - `convex/` schema and backend — infrastructure
   - Analytics pipeline

   **Rationale for this split:**
   - Open-sourcing the engine builds community, attracts contributors, and signals
     confidence in the architecture
   - The moat is not in the engine — it is in the Taste Vault data and the similarity
     model trained on it. These stay proprietary.
   - Open agent templates invite community improvement of Nova26's core intelligence
     without giving away the memory/learning layer.

4. **Content strategy.** Design the 90-day launch content plan:

   **YouTube (1 video/week):**
   - Week 1: "Building a full SaaS in 2 hours with Nova26" (screen recording, no commentary)
   - Week 2: "How the ACE loop works" (architecture explainer, whiteboard-style)
   - Week 3: "MARS vs. GitHub Copilot: head-to-head benchmark" (controversial, shareable)
   - Week 4: "Writing your first Nova26 skill" (tutorial, drives Skills Marketplace adoption)
   - Week 5-8: "Build with me" live sessions (stream a real project using Nova26, unscripted)
   - Week 9-12: guest builders (invite 4 community members to share their Nova26 workflows)

   **Blog (2 posts/month, at nova26.dev/blog):**
   - "Why your AI assistant is lying to you about Next.js 15" (Context7 integration launch)
   - "The Taste Vault: how Nova26 gets smarter the more you use it" (vault deep dive)
   - "Benchmarking Nova26 against SWE-bench: what we learned" (credibility, uses R11-03 work)
   - "Building Nova26: 21 agents, one loop, 1226 tests" (technical origin story)
   - "The case for local-first AI development" (thought leadership, privacy angle)
   - "How we extracted 79 patterns from a real codebase" (BistroLens/Kiro story)

   **Conference talks (target events):**
   - Render Atlanta / ViteConf — "21 agents, one loop: the architecture of Nova26"
   - TypeScript Congress — "Type-safe multi-agent orchestration at runtime"
   - GopherCon / Node+JS Interactive — "Local-first AI: why your code should never leave your machine"
   - CFP strategy: submit 60 days before each conference. Use GROK-R11 research as talk content.

5. **Partnership opportunities.** Evaluate and prioritize:

   | Partner | What they get | What Nova26 gets | Priority |
   |---|---|---|---|
   | **Ollama** | Nova26 is a flagship use case demonstrating Ollama's power | Co-marketing, official "Powered by Ollama" badge, potential blog post | High — pursue immediately |
   | **Convex** | Nova26 is a real-time, multi-agent showcase app | Case study on convex.dev, potential conference co-appearance | High — pursue immediately |
   | **shadcn/ui** | If Nova26's VENUS agent generates shadcn components well, it validates the library | "Nova26 generates shadcn" as social proof; component library usage data | Medium — after launch |
   | **Vercel** | Nova26 targets Next.js/Vercel deployment; Context7 + Vercel AI SDK alignment | Distribution to Vercel's developer audience | Medium — after launch |
   | **Upstash/Context7** | Nova26 is a high-profile Context7 integration | Co-marketing, integration showcase, potential joint blog post | High — pursue with R12-01 implementation |

   **Partnership pitch for Ollama:**
   Write the 3-paragraph outreach email to the Ollama team:
   - Paragraph 1: who we are and what Nova26 does (specific, no fluff)
   - Paragraph 2: how Nova26 is a showcase for Ollama's capabilities (specific model names,
     specific Nova26 features that depend on Ollama)
   - Paragraph 3: proposed partnership: co-blog post, "Powered by Ollama" badge, and
     a joint demo video. Clear ask, clear timeline.

6. **Contributor program.** Design the external contribution framework:

   Nova26 accepts external contributions in 5 categories:
   - **Agent improvements:** PRs to `.nova/agents/*.xml` files. Review criteria: does the
     new template produce better ACE Reflector-scored output than the current? Requires a
     benchmark comparison (R11-03 methodology).
   - **New skills:** PRs to `src/skills/builtin/` or submissions to the Skills Marketplace.
     Review criteria: does the skill have at least 10 steps, tests, and a documented use case?
   - **New plugins:** plugin submissions following the Plugin Ecosystem spec (GROK-R8).
   - **Documentation:** PRs to `docs/` or nova26.dev/blog guest posts.
   - **Bug fixes:** standard GitHub issue/PR flow.

   **Contributor recognition:**
   - First merged PR: `@Contributor` Discord role + mention in weekly `#announcements` post
   - 5 merged PRs: name in `CONTRIBUTORS.md` + shoutout in the monthly newsletter
   - Top contributor of the month: featured in a blog post + free 3-month subscription
   - Skill with 100+ downloads: "Featured Skill" badge in the marketplace + blog post

   **Contribution guide deliverables:**
   - `CONTRIBUTING.md` in the GitHub repo (specify the sections: Development Setup,
     PR Guidelines, Agent Template Guidelines, Skill Submission Guidelines, Code of Conduct)
   - `docs/agent-template-guide.md` — how to write a high-quality agent XML template
   - `docs/skill-authoring-guide.md` — how to write and test a Nova26 skill

7. **Ambassador program.** Design the power-user advocacy program:

   Ambassadors are paid subscribers who actively promote Nova26 in exchange for recognition
   and perks. They are not paid employees — they are fans with elevated access.

   **Ambassador criteria:**
   - Active paid subscriber for at least 3 months
   - Has shared at least 3 builds in `#show-your-builds` or publicly on social media
   - Has at least one community contribution (skill, bug report, or help post)
   - Nominated by the Nova26 team or by 3+ community members via `#ambassador-nominations`

   **Ambassador perks:**
   - Free subscription for as long as they are active as an ambassador
   - `@Ambassador` Discord role with access to a private `#ambassador-lounge` channel
   - Early access to new features before public release
   - Invited to quarterly video calls with the Nova26 core team
   - Listed on nova26.dev/ambassadors with a photo and quote

   **Ambassador responsibilities (informal, not contractual):**
   - Share at least 2 Nova26 builds publicly per month (Twitter/X, LinkedIn, or YouTube)
   - Answer at least 5 questions in `#help-and-questions` per month
   - Provide feedback on pre-release features within 48 hours when asked

   **Ambassador activation sequence:**
   1. Nova26 team identifies candidate in Discord/social media
   2. Send a private DM: "We've noticed your contributions to the Nova26 community. We'd love
      to invite you to become a Nova26 Ambassador. Here's what that means: [link to program page]"
   3. Candidate accepts, fills out a short form (timezone, preferred communication, content
      focus area)
   4. Ambassador role assigned, subscription extended, invited to ambassador onboarding call

8. **Launch week plan.** Design the coordinated launch sequence:

   ```
   Day -7 (T-minus 7):
   - Publish teaser blog post: "Something big is coming. Nova26 launches in one week."
   - Open Discord server, invite beta users
   - Submit Product Hunt draft

   Day -3:
   - Email waitlist: "You're in. Nova26 launches in 3 days. Here's a sneak peek."
   - Publish YouTube teaser: 90-second "what is Nova26" video

   Day 0 (Launch day):
   - Product Hunt goes live at 12:01am PST
   - Hacker News "Show HN" post: "Show HN: Nova26 — 21-agent local-first AI IDE"
   - Blog post: "Introducing Nova26: the AI IDE that never leaves your machine"
   - Post in relevant subreddits: r/programming, r/MachineLearning, r/devops
   - Email entire waitlist: "We're live. Here's your invite code."
   - Nova26 team on Discord all day answering questions

   Day 1-6:
   - Daily "build of the day" post in #show-your-builds (core team posts their own builds)
   - YouTube: full demo video goes live on Day 2
   - Twitter/X thread on Day 3: architecture deep dive (drives #nova26 hashtag)
   - Reach out to Ollama and Convex for co-posts

   Day 7:
   - "Week 1 in review" blog post: user count, total tasks completed, top community builds
   ```

---

## Output Format

- Label each section clearly: `## GROK-R12-01`, `## GROK-R12-02`, etc.
- Begin each deliverable with the big-picture analogy paragraph before any technical content.
- Use TypeScript for all interfaces and method signatures.
- Use ASCII or prose for flow diagrams — no image dependencies.
- For R12-01 and R12-02, reference real Nova26 file paths where applicable:
  - `src/orchestrator/ralph-loop.ts`
  - `src/orchestrator/prompt-builder.ts`
  - `src/agent-loop/agent-loop.ts`
  - `src/tools/` (tool registry patterns)
  - `convex/schema.ts`
  - `convex/atlas.ts`
- For R12-03 and R12-04: write actual copy, actual numbers, actual email templates. No
  placeholders. Imagine you are handing this document directly to a copywriter and a
  growth engineer who will implement it tomorrow.
- For R12-05: write actual channel names, actual partnership email copy, actual event names.
  Specificity is the entire value of this deliverable.
- Each deliverable should be independently useful — a developer picking up GROK-R12-01
  should not need to read R12-02 first. A growth marketer picking up GROK-R12-03 should
  not need to read R12-01.
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

// Ralph Loop options (cumulative from R1-R11; R12 adds are at bottom)
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
  // New in R12:
  // context7Enabled?: boolean;
  // context7Config?: Context7Config;
  // skillsEnabled?: boolean;
  // skillsConfig?: SkillsConfig;
}
```

---

## Coordination Note

All five R12 deliverables target either new source directories or non-code domains:
- GROK-R12-01 targets `src/tools/context7/` — no conflicts with existing code
- GROK-R12-02 targets `src/skills/` — no conflicts with existing code
- GROK-R12-03 targets new Convex tables (`userEngagement`, `churnRisk`) and email templates — no code conflicts
- GROK-R12-04 is a strategy/copy document — no code changes required
- GROK-R12-05 is a strategy/operations document — no code changes required

For R12-01 and R12-02, any new Convex tables must be specified as explicit additions to
`convex/schema.ts`. Do not modify existing tables (`builds`, `tasks`, `executions`,
`patterns`, `agents`, `companyAgents`, `learnings`).

R12-01's `fetchDocs` tool integrates with `src/orchestrator/prompt-builder.ts`. The
integration should be designed as an additive injection point — no rewriting of existing
`PromptBuilderOptions` fields, only new optional fields appended.

R12-02's `SkillRunner` executes tool calls via the existing `ToolRegistry` in
`src/agent-loop/agent-loop.ts`. Skills must not introduce new execution contexts or bypass
the tool registry — the security boundary is firm.

---

*Prompt issued by Claude Code on 2026-02-18. Grok R12 output should be delivered to
`.nova/output/` or committed directly to the `grok/r12` branch for coordinator review.*
