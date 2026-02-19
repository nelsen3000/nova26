# KIRO TASK FILE — Round 3: Missing BistroLens Patterns, Nova26 Extraction & Unified Manifest

> Owner: Kiro
> Priority: 1 (Missing BistroLens) → 2 (Nova26 Architecture) → 3 (Nova26 Data/Intelligence) → 4 (Unified Manifest)
> Prerequisite: KIRO-02-01 through KIRO-02-04 complete
> Test baseline: 1226+ tests passing, 0 TypeScript errors
> Commit format: `docs(knowledge): KIRO-03-XX <short description>`

---

## Context

Nova26 is a 21-agent AI-powered IDE built with TypeScript, Ollama, and Convex. You have
completed two full extraction rounds:

- **KIRO-01:** Extracted 79 BistroLens patterns across 16 categories into
  `.nova/bistrolens-knowledge/`
- **KIRO-02-01:** Quality audit of all 79 patterns with PROMOTE/IMPROVE/DEPRIORITIZE flags
- **KIRO-02-02:** Cross-reference mapping — 11 broken references catalogued, 30+ relationships
  mapped in RELATIONSHIPS.md
- **KIRO-02-03:** Nova26 own-codebase extraction (initial pass — if complete, patterns exist
  under `.nova/nova26-knowledge/`; if not yet complete, begin there first)
- **KIRO-02-04:** import-manifest.json for Taste Vault consumption (in progress or complete)

Round 3 has three new extraction targets plus a unification step:

1. **KIRO-03-01** — Extract the 11 missing BistroLens patterns (broken cross-references)
2. **KIRO-03-02** — Extract 25+ architectural patterns from Nova26's own `src/` (orchestrator,
   agent-loop, tools, ace layers)
3. **KIRO-03-03** — Extract 25+ data/intelligence patterns from Nova26's own `src/` (taste-vault,
   similarity, security, analytics, llm, memory, rehearsal, agents layers)
4. **KIRO-03-04** — Build a single unified import manifest covering all extracted knowledge and
   a comprehensive relationship map

The systems that will consume this knowledge:

- `src/taste-vault/graph-memory.ts` — GraphNode types: `Strategy | Mistake | Preference | Pattern | Decision`
- `src/taste-vault/taste-vault.ts` — per-user API; patterns injected at prompt-build time
- `src/taste-vault/pattern-loader.ts` — Kimi's PatternLoader reads the manifest JSON and
  bulk-imports via `TasteVault.addNode()`
- `src/ace/playbook.ts` — playbooks reference patterns by tag and type
- `src/orchestrator/prompt-builder.ts` — `buildVaultContext()` injects relevant patterns into
  every agent prompt

**Your constraint:** Do NOT modify any TypeScript source files. All outputs are knowledge
artifacts only — `.md` and `.json` files under `.nova/`. Zero `.ts` or `.tsx` changes.

---

## Global Rules (apply to every task)

- **Read** source from `/Users/jonathannelsen/bistrolens-2` and `/Users/jonathannelsen/nova26/src/`
- **Write** only to `.nova/bistrolens-knowledge/`, `.nova/nova26-knowledge/`, and
  `.nova/knowledge-import/`  — all paths relative to `/Users/jonathannelsen/nova26/`
- **No TypeScript modifications** — zero changes to any `.ts` or `.tsx` file
- **Consistent format** — every BistroLens pattern uses the KIRO-01 template (see below);
  every Nova26 pattern uses the Nova26 pattern template (see below)
- **Self-contained** — every pattern file must be understandable without reading the source code
- **File paths and line numbers** — reference actual source locations wherever possible
- **Honest stubs** — if a referenced pattern does not exist in source, write a stub marked
  `STATUS: ASPIRATIONAL` with a one-paragraph explanation of why it was expected
- **Commit after each task** — one commit per KIRO-03 subtask

---

## Pattern Templates

### BistroLens Pattern Template (use for KIRO-03-01)

```markdown
### Pattern: [Descriptive Name]

**Category:** [Security/Database/UI/etc.]
**Source File:** [Exact file path relative to /Users/jonathannelsen/bistrolens-2]
**Status:** EXTRACTED | ASPIRATIONAL

**Problem Solved:** [1-2 sentences on what problem this addresses]

**How It's Implemented:**
[Detailed description with code examples where relevant]

**Key Insights:**
- [What makes this approach valuable?]
- [What are the trade-offs?]
- [When should you use this vs. alternatives?]

**Reusability Score:** [1-10]
- 10 = Copy-paste ready for any project
- 5 = Needs adaptation but concept is universal
- 1 = Very project-specific

**Code Example:**
```[language]
[Relevant code with comments explaining key parts]
```

**Related Patterns:**
- [pattern name] — [one-line reason]
```

### Nova26 Pattern Template (use for KIRO-03-02 and KIRO-03-03)

```markdown
# Pattern: [Descriptive Name]

**Category:** [agent-architecture / orchestration / tool / memory / playbook / testing /
               error-handling / type-conventions / security / analytics / llm / data-pipeline]
**Source Files:**
- `src/[path/file.ts]` — [role of this file]
- `src/[path/file.ts]` — [role of this file]
**Relevant Lines:** [line range, e.g., 45-112]

---

## Problem Solved

[2-3 sentences: what design challenge does this pattern address? Why is the naive approach
insufficient here?]

## Implementation

[Prose description of the pattern — how the pieces fit together, what invariants it
maintains, what the caller/implementor must do]

```typescript
// Excerpt from src/[path].ts — annotated for clarity
[code block with inline comments explaining non-obvious choices]
```

## When to Use

- [Concrete scenario A]
- [Concrete scenario B]

## Anti-Patterns / When NOT to Use

- [What looks similar but is wrong and why]
- [Common mistake when implementing this pattern]

## Related Patterns

- [Pattern name] — [relationship: depends on / supports / extends / conflicts with]

## Reusability Score: [1-10]

[One sentence explaining the score]
```

---

## KIRO-03-01: Extract the 11 Missing BistroLens Patterns

**Output directory:** `.nova/bistrolens-knowledge/` (appropriate category subdirectories)
**Update files:** `.nova/bistrolens-knowledge/INDEX.md` and `.nova/bistrolens-knowledge/EXTRACTION-SUMMARY.md`
**Commit message:** `docs(knowledge): KIRO-03-01 extracted N missing BistroLens patterns (79 + N total)`

### Background

The KIRO-02-02 cross-reference mapping identified 11 broken references — patterns that were
mentioned inside already-extracted files but never fully documented. Three of these are
explicitly known: `rate-limiting.md`, `useSwipeGesture.md`, and `useTierGates.md`. The
remaining 8 were catalogued in the RELATIONSHIPS.md file produced by KIRO-02-02.

### Step 1: Recover the full list of 11 references

Read `.nova/bistrolens-knowledge/RELATIONSHIPS.md` (produced by KIRO-02-02). Locate the
"Cross-Reference Follow-Ups" table. Extract all 11 entries — pattern name, expected category,
and the BistroLens source file that was flagged.

If RELATIONSHIPS.md does not exist or the table is missing, fall back: scan every `.md` file
under `.nova/bistrolens-knowledge/` for strings matching any of these markers:
`"see also:"`, `"cross-reference:"`, `"future candidate:"`, `"→ extract later"`, `"TODO"`,
`"not yet extracted"`. Compile the complete list before proceeding.

### Step 2: Extract each pattern

For each of the 11 references, perform the following:

**2a. Locate the source**

The three confirmed sources are:

| Pattern | Source File |
|---|---|
| Rate Limiting (dedicated) | `/Users/jonathannelsen/bistrolens-2/utils/rateLimiter.ts` and `utils/advancedRateLimiter.ts` |
| useSwipeGesture | `/Users/jonathannelsen/bistrolens-2/.kiro/hooks/useSwipeGesture.ts` |
| useTierGates | `/Users/jonathannelsen/bistrolens-2/.kiro/hooks/useTierGates.ts` |

For the remaining 8, check these likely locations in `/Users/jonathannelsen/bistrolens-2`:

```
.kiro/hooks/          — React hook patterns
.kiro/steering/       — Steering documents (41-50 range for uncovered areas)
utils/                — Utility patterns (see full list below)
api/                  — API/middleware patterns
components/           — UI component patterns
convex/               — Database/backend patterns
```

Uncovered utility files likely to contain extractable patterns:
`utils/gdprCompliance.ts`, `utils/resilience.ts`, `utils/cachingStrategy.ts`,
`utils/progressiveDisclosure.ts`, `utils/offlineManager.ts`, `utils/bundleOptimizer.ts`,
`utils/legalCompliance.ts`, `utils/ssrfProtection.ts`

Uncovered steering files:
`.kiro/steering/41-SUBSCRIPTION-TIER-ENFORCEMENT.md`,
`.kiro/steering/44-SOCIAL-FEATURES-MODERATION.md`,
`.kiro/steering/46-PWA-OFFLINE-BEHAVIOR.md`,
`.kiro/steering/47-ANALYTICS-TRACKING-POLICY.md`,
`.kiro/steering/50-ACCESSIBILITY-WCAG-COMPLIANCE.md`

**2b. Extract or stub**

If source exists and contains a pattern: extract using the BistroLens pattern template.
If source does not exist or contains no extractable pattern: write a stub file with
`STATUS: ASPIRATIONAL` — include the pattern name, the reference where it was mentioned,
and a brief explanation of what the pattern was expected to cover.

**2c. Place in correct category**

Use these category folders under `.nova/bistrolens-knowledge/`:

| Pattern type | Folder |
|---|---|
| Hook-based UI patterns (swipe, tier gates) | `08-design-system/` |
| Rate limiting, security enforcement | `01-security/` |
| GDPR, legal compliance | `01-security/` |
| Offline / PWA behavior | `14-performance/` |
| Subscription/tier enforcement | `12-business-logic/` |
| Resilience, caching | `14-performance/` |
| SSRF, API security | `01-security/` |
| Analytics tracking | `11-monitoring/` |
| Social moderation | `12-business-logic/` |
| Accessibility compliance | `08-design-system/` |
| Bundle optimization | `14-performance/` |

### Step 3: Update INDEX.md

If `.nova/bistrolens-knowledge/INDEX.md` does not exist, create it. If it exists, append
the new patterns. Format:

```markdown
# BistroLens Knowledge Base — Index

**Last Updated:** [date]
**Total Patterns:** [79 + N new]

## By Category

### 01 Security
| Pattern | File | Reusability |
|---|---|---|
| [name] | [relative path] | [score/10] |

[repeat for all active categories]

## Recently Added (KIRO-03-01)

| Pattern | Category | Source | Status |
|---|---|---|---|
| [name] | [cat] | [bistrolens source file] | EXTRACTED \| ASPIRATIONAL |
```

### Step 4: Update EXTRACTION-SUMMARY.md

If `.nova/bistrolens-knowledge/EXTRACTION-SUMMARY.md` does not exist, create it. Update
the total pattern count to `79 + N` (where N = number of new patterns extracted or stubbed).
Include a brief section "KIRO-03-01 Additions" listing every new file created.

---

## KIRO-03-02: Nova26 Core Architecture Pattern Extraction

**Output directory:** `.nova/nova26-knowledge/architecture/`
**Index:** `.nova/nova26-knowledge/INDEX.md` (create if absent, append if present)
**Target:** 25+ architectural patterns
**Commit message:** `docs(knowledge): KIRO-03-02 extracted N Nova26 architecture patterns`

### Source directories to read

```
/Users/jonathannelsen/nova26/src/orchestrator/
/Users/jonathannelsen/nova26/src/agent-loop/
/Users/jonathannelsen/nova26/src/tools/
/Users/jonathannelsen/nova26/src/ace/
```

Read every `.ts` file in these directories, including test files. Tests reveal the intended
contract more clearly than the implementation in many cases.

### File inventory

**src/orchestrator/**
- `ralph-loop.ts` — outer build loop, the top-level orchestration driver
- `task-picker.ts` — how the next agent task is selected
- `gate-runner.ts` — how quality gates are evaluated before/after agent steps
- `prompt-builder.ts` — how agent prompts are assembled; `buildVaultContext()` is key
- `event-store.ts` — event sourcing for agent actions
- `task-decomposer.ts` — PRD → task graph decomposition
- `agent-selector.ts` — which agent handles which task type
- `plan-approval.ts` — plan review before execution
- `council-runner.ts` — multi-agent council pattern
- `parallel-runner.ts` — parallel agent execution
- `agent-loader.ts` — agent initialization and configuration loading
- `agent-explanations.ts` — human-readable explanations of agent decisions
- `convex-client.ts` — Convex backend client used by orchestrator
- `atlas-convex.ts` — ATLAS logging mutations

**src/agent-loop/**
- `agent-loop.ts` — ReAct inner loop (Reason → Act → Observe → repeat)
- `scratchpad.ts` — per-agent working context and intermediate state

**src/tools/**
- `tool-registry.ts` — singleton registry for all available tools
- `tool-parser.ts` — parsing LLM tool call XML/JSON into executable calls
- `tool-executor.ts` — safe execution with permission checks and rate limiting
- `core-tools.ts` — built-in tools (file read/write, shell, search)
- `repo-map.ts` — codebase structure mapping for agents
- `knowledge-base.ts` — static knowledge lookup tool
- `docs-fetcher.ts` — documentation retrieval tool

**src/ace/**
- `playbook.ts` — playbook structure, evolution, and retrieval
- `generator.ts` — generates new playbook entries from agent runs
- `reflector.ts` — reflects on playbook quality and identifies improvements
- `curator.ts` — curates and prunes the playbook over time
- `index.ts` — ACE cycle orchestration

### Patterns to extract (minimum — extract more if warranted)

For each pattern, create one `.md` file in `.nova/nova26-knowledge/architecture/` using
the Nova26 pattern template.

**Mandatory extractions:**

| Pattern Name | Source File(s) | What to Capture |
|---|---|---|
| Ralph Loop Orchestration | `ralph-loop.ts` | The outer while-loop structure, how it drives agent selection and gate evaluation, termination conditions |
| ReAct Inner Loop | `agent-loop.ts` | Reason-Act-Observe cycle, how tool calls are interleaved with LLM calls, scratchpad updates per step |
| Scratchpad Context Management | `scratchpad.ts` | What state lives in scratchpad vs. prompt vs. memory, how it is reset between tasks |
| Task Decomposition Pattern | `task-decomposer.ts` | How a PRD becomes a task graph, node/edge schema, dependency ordering |
| Task Routing and Selection | `task-picker.ts`, `agent-selector.ts` | How the next task is chosen, how the right agent is matched to a task type |
| Gate Runner Lifecycle | `gate-runner.ts` | Pre-gate vs. post-gate distinction, how gate failures halt vs. warn, gate result propagation |
| Prompt Assembly Pipeline | `prompt-builder.ts` | Sections of a Nova26 agent prompt, `buildVaultContext()` injection point, system vs. user vs. context split |
| Event Store Pattern | `event-store.ts` | Event sourcing for agent actions, event schema, replay capability |
| Tool Registry Singleton | `tool-registry.ts` | Singleton pattern with reset support for tests, tool registration API, tool lookup |
| Tool Parser Safety | `tool-parser.ts` | How LLM output is parsed into tool calls, what validation catches malformed output |
| Tool Executor Permission Model | `tool-executor.ts` | Permission levels, which tools require explicit grants, how violations are surfaced |
| Repo Map Generation | `repo-map.ts` | How the codebase structure is summarized for agent context, staleness handling |
| ACE Generator Pattern | `generator.ts` | How new playbook entries are generated from a completed agent run |
| ACE Reflector Pattern | `reflector.ts` | What the reflector evaluates, reflection output schema, how scores feed back |
| ACE Curator Pattern | `curator.ts` | Pruning logic, how duplicates are detected, what makes a playbook entry worth keeping |
| ACE Cycle Orchestration | `ace-cycle.test.ts`, `index.ts` | How Generator → Reflector → Curator is sequenced, what triggers a cycle, async coordination |
| Playbook Structure | `playbook.ts` | Playbook schema, how entries are tagged and retrieved, versioning |
| Council Pattern | `council-runner.ts` | Multi-agent deliberation, how votes/outputs are aggregated, when council is invoked |
| Parallel Runner Pattern | `parallel-runner.ts` | Concurrent agent execution, result merging, error isolation |
| Plan Approval Gate | `plan-approval.ts` | Human/automated plan review before agent execution, approval schema |

**Additional patterns to look for** (extract if the pattern is non-obvious or recurring):

- Singleton factory with reset (any file using a module-level singleton with a `reset()` for tests)
- ESM `.js` extension convention on imports (check import statements project-wide)
- Config interface pattern (how agent configs are typed and loaded)
- Agent explanation/transparency pattern (`agent-explanations.ts`)
- ATLAS logging integration (how agent events are recorded to Convex)

### Output file naming convention

Use kebab-case. Examples:
- `ralph-loop-orchestration.md`
- `react-inner-loop.md`
- `scratchpad-context-management.md`
- `task-decomposition-pattern.md`
- `tool-registry-singleton.md`
- `ace-generator-pattern.md`
- `ace-cycle-orchestration.md`

---

## KIRO-03-03: Nova26 Data & Intelligence Pattern Extraction

**Output directory:** `.nova/nova26-knowledge/data-intelligence/`
**Index:** `.nova/nova26-knowledge/INDEX.md` (append to existing)
**Target:** 25+ data/intelligence patterns
**Commit message:** `docs(knowledge): KIRO-03-03 extracted N Nova26 data-intelligence patterns`

### Source directories to read

```
/Users/jonathannelsen/nova26/src/taste-vault/
/Users/jonathannelsen/nova26/src/similarity/
/Users/jonathannelsen/nova26/src/security/
/Users/jonathannelsen/nova26/src/analytics/
/Users/jonathannelsen/nova26/src/llm/
/Users/jonathannelsen/nova26/src/memory/
/Users/jonathannelsen/nova26/src/rehearsal/
/Users/jonathannelsen/nova26/src/agents/
```

### File inventory

**src/taste-vault/**
- `graph-memory.ts` — graph data structure, node/edge schema, GraphNode type definition
- `taste-vault.ts` — per-user high-level API wrapping GraphMemory
- `global-wisdom.ts` — pipeline that promotes high-confidence patterns to global scope
- `pattern-loader.ts` — bulk import from manifest JSON (Kimi's PatternLoader)
- `property-tests.ts` — property-based tests revealing invariants

**src/similarity/**
- `semantic-dedup.ts` — embedding-based deduplication of agent outputs

**src/security/**
- `security-scanner.ts` — static analysis of agent-generated code
- `vault-security.ts` — encryption and access control for the Taste Vault

**src/analytics/**
- `agent-analytics.ts` — per-agent performance metrics
- `build-intelligence.ts` — cross-build learning and prediction
- `reflection.ts` — post-build reflection and lesson extraction

**src/llm/**
- `ollama-client.ts` — Ollama HTTP client, streaming, error handling
- `model-router.ts` — model selection by task type and cost tier
- `response-cache.ts` — LLM response caching strategy
- `structured-output.ts` — Zod schemas for typed LLM outputs

**src/memory/**
- `session-memory.ts` — per-session working memory for agents

**src/rehearsal/**
- `stage.ts` — rehearsal stage setup, sandbox environment
- `branch-manager.ts` — git branch management for rehearsal runs
- `scorer.ts` — scoring rehearsal outcomes

**src/agents/**
- `self-improvement.ts` — self-improvement loop pattern
- `protocol.ts` — agent communication protocol

### Patterns to extract (minimum — extract more if warranted)

**Mandatory extractions:**

| Pattern Name | Source File(s) | What to Capture |
|---|---|---|
| GraphNode Schema Design | `graph-memory.ts` | Node type union, confidence scoring, isGlobal flag semantics, edge weight meaning |
| Confidence Scoring System | `graph-memory.ts`, `taste-vault.ts` | How confidence is calculated, updated, and used for retrieval ranking |
| Graph Memory API Surface | `graph-memory.ts`, `taste-vault.ts` | Separation between low-level GraphMemory and high-level TasteVault, why the split exists |
| Global Wisdom Promotion Pipeline | `global-wisdom.ts` | What threshold triggers global promotion, how the pipeline runs, write path to Convex |
| Pattern Loader Import Protocol | `pattern-loader.ts` | How manifest.json is consumed, node creation sequence, edge wiring, error handling |
| Semantic Deduplication Pattern | `semantic-dedup.ts` | Embedding generation, similarity threshold, how duplicates are merged vs. rejected |
| Embedding Cache Strategy | `semantic-dedup.ts` | How embeddings are cached to avoid repeated Ollama calls, cache invalidation |
| Agent Output Security Scanner | `security-scanner.ts` | What patterns the scanner catches, severity classification, how findings are returned |
| Vault Encryption Pattern | `vault-security.ts` | Encryption scheme for stored nodes, key management, PII stripping |
| Agent Analytics Recording | `agent-analytics.ts` | What metrics are captured per agent run, storage schema, aggregation |
| Build Intelligence Pattern | `build-intelligence.ts` | Cross-build learning: how past build data informs future task selection |
| Post-Build Reflection | `reflection.ts` | What the reflection step produces, output schema, how it feeds back into the Taste Vault |
| Ollama Client Pattern | `ollama-client.ts` | HTTP streaming pattern, retry logic, timeout handling, error surface |
| Model Routing Strategy | `model-router.ts` | How tasks are matched to model tiers, cost vs. quality trade-off encoding |
| LLM Response Caching | `response-cache.ts` | What is cached (prompt hash?), TTL strategy, cache miss fallback |
| Structured Output Validation | `structured-output.ts` | Zod schema pattern for LLM outputs, how parse errors are handled |
| Session Memory Pattern | `session-memory.ts` | What lives in session memory vs. graph memory vs. scratchpad, lifecycle |
| Rehearsal Stage Pattern | `stage.ts` | How a sandboxed rehearsal environment is set up and torn down |
| Branch Simulation Pattern | `branch-manager.ts` | Git branch creation for safe rehearsal, cleanup strategy |
| Rehearsal Scoring | `scorer.ts` | How rehearsal outcomes are scored, scoring criteria, how scores influence real runs |
| Self-Improvement Loop | `self-improvement.ts` | The feedback cycle: how agents propose improvements to their own prompts/playbooks |
| Agent Protocol | `protocol.ts` | Communication contract between agents, message schema |

**Additional patterns to look for:**

- Local JSON fallback before Convex (any file that reads/writes local JSON as a cache or
  fallback when the Convex backend is unavailable)
- Property-based test pattern (`property-tests.ts` in taste-vault — reveals invariants)
- GDPR compliance in graph memory (PII handling, data deletion, audit trail)
- Zod boundary validation (any place Zod is used at a system boundary, not just LLM output)

### Output file naming convention

Use kebab-case. Examples:
- `graph-node-schema.md`
- `confidence-scoring-system.md`
- `global-wisdom-pipeline.md`
- `semantic-dedup-pattern.md`
- `ollama-client-pattern.md`
- `self-improvement-loop.md`

---

## KIRO-03-04: Unified Import Manifest + Relationship Map

**Output directory:** `.nova/knowledge-import/`
**Key outputs:**
- `.nova/knowledge-import/full-manifest.json`
- `.nova/knowledge-import/FULL-IMPORT-GUIDE.md`
- `.nova/nova26-knowledge/RELATIONSHIPS.md`
**Commit message:** `docs(knowledge): KIRO-03-04 unified manifest N patterns M edges across BistroLens + Nova26`

### Prerequisites

Do not start this task until KIRO-03-01, KIRO-03-02, and KIRO-03-03 are all complete.
Read the following files before generating the manifest:

- `.nova/bistrolens-knowledge/QUALITY-AUDIT.md` — confidence values for BistroLens patterns
- `.nova/bistrolens-knowledge/RELATIONSHIPS.md` — BistroLens inter-pattern edges
- `.nova/bistrolens-knowledge/INDEX.md` — complete list of all BistroLens patterns
- `.nova/nova26-knowledge/architecture/` — all KIRO-03-02 pattern files
- `.nova/nova26-knowledge/data-intelligence/` — all KIRO-03-03 pattern files

### GraphNode schema (from src/taste-vault/graph-memory.ts)

All manifest entries must map onto this interface:

```typescript
type NodeType = 'Strategy' | 'Mistake' | 'Preference' | 'Pattern' | 'Decision';

interface GraphNode {
  id: string;                  // omit — PatternLoader generates via nanoid
  type: NodeType;              // required
  content: string;             // required — max 500 characters, human-readable summary
  confidence: number;          // 0–1
  helpfulCount: number;        // 0 for seeded knowledge
  userId: string;              // 'system' for all seeded patterns
  isGlobal: boolean;           // true for high-confidence / architectural patterns
  globalSuccessCount: number;  // 0 for seeded knowledge
  language?: string;           // 'typescript' for code patterns; omit for architectural
  tags: string[];              // 3–8 tags per pattern
  createdAt: string;           // ISO 8601 timestamp
  updatedAt: string;           // ISO 8601 timestamp
}
```

### Manifest ID conventions

| Source | Format | Example |
|---|---|---|
| BistroLens original (79) | `BL-<cat>-<seq>` | `BL-01-001`, `BL-01-002` |
| BistroLens new (KIRO-03-01) | `BL-<cat>-<seq>` | `BL-01-080`, `BL-08-042` |
| Nova26 architecture | `N26-ARCH-<seq>` | `N26-ARCH-001`, `N26-ARCH-002` |
| Nova26 data/intelligence | `N26-DATA-<seq>` | `N26-DATA-001`, `N26-DATA-002` |

Category numbers for BistroLens align with folder numbers (01 = security, 08 = design-system, etc.).

### Confidence mapping

**BistroLens patterns** — derive from QUALITY-AUDIT.md composite scores:

| Composite Score | Confidence |
|---|---|
| 9.0 – 10.0 | 0.95 |
| 8.0 – 8.9 | 0.85 |
| 7.0 – 7.9 | 0.75 |
| 5.0 – 6.9 | 0.60 |
| < 5.0 | Omit from manifest (DEPRIORITIZE) |
| ASPIRATIONAL stub | 0.40 |

**Nova26 patterns** — no audit score yet; use these defaults:

| Condition | Confidence |
|---|---|
| Pattern extracted from a file with a corresponding test file at 100% coverage signal | 0.90 |
| Pattern extracted from a well-tested file (test file exists, coverage looks complete) | 0.80 |
| Pattern extracted from a file with no test counterpart | 0.70 |

### isGlobal mapping

Set `isGlobal: true` when:
- BistroLens pattern was PROMOTE-flagged in the quality audit
- Nova26 architectural pattern that would benefit any agent working on any task (i.e., not
  tied to BistroLens-specific domain logic)
- Confidence >= 0.85

Set `isGlobal: false` when:
- Pattern is project-specific or too narrow
- Confidence < 0.75
- Pattern is ASPIRATIONAL

### NodeType mapping

| Pattern characteristics | NodeType |
|---|---|
| Recurring structural choice used across the codebase | `Pattern` |
| Explicit design decision with trade-off documentation | `Decision` |
| A hard rule enforced by tooling or tests | `Strategy` |
| A known failure mode or anti-pattern to avoid | `Mistake` |
| A subjective style choice without a definitive right answer | `Preference` |

### Cross-source edge types

Where a Nova26 pattern implements, extends, or depends on a BistroLens pattern, add an
edge between them. Use these edge types:

| Relationship | Edge type | Default weight |
|---|---|---|
| Nova26 directly implements the BistroLens pattern | `implements` | 0.9 |
| Nova26 refines or specializes the BistroLens pattern | `refines` | 0.8 |
| Nova26 depends on the BistroLens pattern being understood first | `depends_on` | 1.0 |
| Patterns complement each other across sources | `supports` | 0.7 |
| Nova26 supersedes or improves on the BistroLens approach | `supersedes` | 0.85 |

Also translate all BistroLens-to-BistroLens edges from RELATIONSHIPS.md using this mapping:

| RELATIONSHIPS.md type | Edge type | Default weight |
|---|---|---|
| `[depends on]` | `requires` | 1.0 |
| `[supports]` | `supports` | 0.8 |
| `[extends]` | `extends` | 0.7 |
| `[conflicts with]` | `conflicts` | 0.5 |
| `[replaces]` | `supersedes` | 0.9 |

### full-manifest.json schema

```json
{
  "version": "2.0.0",
  "generatedAt": "<ISO 8601 timestamp>",
  "generatedBy": "KIRO-03-04",
  "summary": {
    "totalPatterns": 0,
    "bistrolensOriginal": 79,
    "bistrolensNew": 0,
    "nova26Architecture": 0,
    "nova26DataIntelligence": 0,
    "highConfidence": 0,
    "aspirationalStubs": 0,
    "totalEdges": 0,
    "crossSourceEdges": 0
  },
  "patterns": [
    {
      "manifestId": "BL-01-001",
      "source": "bistrolens",
      "category": "security",
      "sourceFile": ".nova/bistrolens-knowledge/01-security/rate-limiting-patterns.md",
      "type": "Strategy",
      "content": "<500 char max — the pattern in plain English>",
      "tags": ["rate-limiting", "security", "per-user", "convex"],
      "confidence": 0.90,
      "isGlobal": true,
      "language": "typescript",
      "userId": "system",
      "helpfulCount": 0,
      "globalSuccessCount": 0,
      "createdAt": "<ISO>",
      "updatedAt": "<ISO>"
    },
    {
      "manifestId": "N26-ARCH-001",
      "source": "nova26",
      "category": "orchestration",
      "sourceFile": ".nova/nova26-knowledge/architecture/ralph-loop-orchestration.md",
      "type": "Pattern",
      "content": "<500 char max>",
      "tags": ["orchestration", "agent-loop", "ralph", "nova26"],
      "confidence": 0.85,
      "isGlobal": true,
      "language": "typescript",
      "userId": "system",
      "helpfulCount": 0,
      "globalSuccessCount": 0,
      "createdAt": "<ISO>",
      "updatedAt": "<ISO>"
    }
  ],
  "edges": [
    {
      "fromManifestId": "BL-01-001",
      "toManifestId": "BL-05-002",
      "type": "supports",
      "weight": 0.8,
      "reason": "<one sentence>"
    },
    {
      "fromManifestId": "N26-DATA-004",
      "toManifestId": "BL-01-003",
      "type": "refines",
      "weight": 0.85,
      "reason": "Nova26 vault-security.ts refines BistroLens encryption pattern with Ollama-specific key derivation"
    }
  ]
}
```

### Nova26 RELATIONSHIPS.md

Create `.nova/nova26-knowledge/RELATIONSHIPS.md` mapping all inter-pattern relationships
across both knowledge bases:

```markdown
# Unified Pattern Relationship Map

**Generated:** [date]
**BistroLens patterns:** [N]
**Nova26 architecture patterns:** [N]
**Nova26 data/intelligence patterns:** [N]
**Total relationships:** [N]
**Cross-source relationships:** [N]

---

## Nova26 Architecture ↔ Nova26 Data/Intelligence

[relationship entries]

## Nova26 ↔ BistroLens (Cross-Source)

[relationship entries — where Nova26 implements/extends/refines BistroLens patterns]

## BistroLens Internal (from KIRO-02-02)

[copy the key relationships from the existing RELATIONSHIPS.md]

---

## Critical Dependency Chains

[3-5 chains that span both knowledge bases — e.g., how a BistroLens security pattern
flows into Nova26's vault-security, which feeds into the graph memory, which affects
pattern retrieval]

---

## Standalone Patterns (no dependencies)

[Patterns safe to use in isolation]
```

### FULL-IMPORT-GUIDE.md

Create `.nova/knowledge-import/FULL-IMPORT-GUIDE.md`:

```markdown
# Full Pattern Import Guide

**Manifest:** `.nova/knowledge-import/full-manifest.json`
**Version:** 2.0.0
**Generated by:** KIRO-03-04

## Statistics

- Total patterns: [N]
- BistroLens (original): 79
- BistroLens (KIRO-03-01 additions): [N]
- Nova26 architecture: [N]
- Nova26 data/intelligence: [N]
- Total edges: [N]
- Cross-source edges: [N]
- Patterns with confidence >= 0.80 (high-confidence): [N]
- Patterns with isGlobal: true: [N]

## How PatternLoader Should Consume This Manifest

1. Read `full-manifest.json`
2. For each entry in `patterns` where `confidence >= 0.60`:
   - Call `TasteVault.addNode({ type, content, tags, confidence, isGlobal, language,
     userId: 'system', helpfulCount: 0, globalSuccessCount: 0, createdAt, updatedAt })`
   - Store the returned Convex node ID mapped to `manifestId` for edge wiring
3. After all nodes are imported, iterate `edges`:
   - Look up Convex node IDs for `fromManifestId` and `toManifestId` using the stored map
   - Call `GraphMemory.addEdge(fromId, toId, { type, weight, reason })`
4. Call `TasteVault.flush()` to persist to Convex
5. Run `GlobalWisdom.promote()` to surface high-confidence global patterns

## Import Order Recommendation

Import in this sequence to ensure edges resolve correctly:
1. BistroLens original patterns (BL-01-xxx through BL-16-xxx)
2. BistroLens new patterns (BL-xx-0xx new sequences)
3. Nova26 architecture patterns (N26-ARCH-xxx)
4. Nova26 data/intelligence patterns (N26-DATA-xxx)
5. All edges (after all nodes exist)

## Tags Index

| Tag | Pattern Count |
|---|---|
| [tag] | [N] |
[sorted alphabetically, all unique tags]

## Patterns Excluded from Manifest

Patterns with confidence < 0.60 (DEPRIORITIZE flag or ASPIRATIONAL status with low
confidence) are excluded. They are documented here for future improvement:

| manifestId | Pattern Name | Reason Excluded |
|---|---|---|
```

---

## Execution Order

Complete the tasks strictly in this sequence. Each depends on the previous:

```
KIRO-03-01 (11 Missing BistroLens Patterns)
    ↓ produces N new pattern files in .nova/bistrolens-knowledge/
    ↓ updates INDEX.md and EXTRACTION-SUMMARY.md
KIRO-03-02 (Nova26 Architecture Patterns)
    ↓ produces 25+ pattern files in .nova/nova26-knowledge/architecture/
    ↓ creates or updates .nova/nova26-knowledge/INDEX.md
KIRO-03-03 (Nova26 Data/Intelligence Patterns)
    ↓ produces 25+ pattern files in .nova/nova26-knowledge/data-intelligence/
    ↓ appends to .nova/nova26-knowledge/INDEX.md
KIRO-03-04 (Unified Manifest + Relationship Map)
    ↓ reads all prior outputs
    ↓ produces full-manifest.json, FULL-IMPORT-GUIDE.md, RELATIONSHIPS.md
```

Do not start KIRO-03-04 until KIRO-03-01, KIRO-03-02, and KIRO-03-03 are all complete.

---

## Commit Schedule

After each subtask, commit with:

```
docs(knowledge): KIRO-03-01 extracted N missing BistroLens patterns (79 + N total)
docs(knowledge): KIRO-03-02 extracted N Nova26 architecture patterns across orchestrator/agent/tool/ace layers
docs(knowledge): KIRO-03-03 extracted N Nova26 data-intelligence patterns across vault/llm/analytics/security layers
docs(knowledge): KIRO-03-04 unified manifest ready — N patterns, M edges, cross-source relationships mapped
```

---

## Definition of Done

- [ ] All 11 broken cross-references resolved — extracted or stubbed with `STATUS: ASPIRATIONAL`
- [ ] `.nova/bistrolens-knowledge/INDEX.md` reflects the updated total (79 + N)
- [ ] `.nova/bistrolens-knowledge/EXTRACTION-SUMMARY.md` updated with KIRO-03-01 additions
- [ ] `.nova/nova26-knowledge/architecture/` contains 25+ pattern files
- [ ] `.nova/nova26-knowledge/data-intelligence/` contains 25+ pattern files
- [ ] `.nova/nova26-knowledge/INDEX.md` lists all Nova26 patterns by category with reusability scores
- [ ] `.nova/knowledge-import/full-manifest.json` is valid JSON, parseable without errors
- [ ] All `confidence` values in `full-manifest.json` are within [0, 1]
- [ ] All `content` strings in `full-manifest.json` are 500 characters or fewer
- [ ] Cross-source edges exist linking Nova26 patterns to their BistroLens counterparts
- [ ] `.nova/knowledge-import/FULL-IMPORT-GUIDE.md` contains accurate statistics and import steps
- [ ] `.nova/nova26-knowledge/RELATIONSHIPS.md` maps inter-pattern relationships across both knowledge bases
- [ ] Zero TypeScript files modified
- [ ] Four commits on main, one per KIRO-03 subtask
