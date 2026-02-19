# KIRO TASK FILE — Pattern Quality Audit, Cross-Reference, Nova26 Extraction & Import Preparation

> Owner: Kiro
> Priority: 1 (Quality Audit) → 2 (Cross-Reference) → 3 (Nova26 Extraction) → 4 (Import Prep)
> Prerequisite: KIRO-01 complete — 79 patterns extracted into .nova/bistrolens-knowledge/
> Test baseline: 1226+ tests passing, 0 TypeScript errors
> Commit format: `docs(knowledge): KIRO-02-XX <short description>`

---

## Context

Nova26 is a 21-agent AI-powered IDE built with TypeScript, Ollama, and Convex. You just
finished your first extraction task (KIRO-01), which pulled 79 patterns from the BistroLens
project across 16 categories into `.nova/bistrolens-knowledge/`. That knowledge base now
contains structured pattern files covering security, steering, quality gates, image
governance, database, cost protection, testing, design system, error handling, deployment,
monitoring, business logic, i18n, performance, AI prompts, and documentation.

The four tasks in this session move from raw extraction toward usable knowledge:

1. **Quality Audit** — score every pattern for completeness, accuracy, and usefulness
2. **Cross-Reference Mapping** — follow up on 11 pending cross-references and map relationships
3. **Nova26 Own-Codebase Extraction** — apply the same extraction discipline to Nova26 itself
4. **Import Preparation** — format everything as a JSON manifest ready for Kimi's PatternLoader

The systems that will consume this knowledge:

- `src/taste-vault/graph-memory.ts` — graph nodes have types: `Strategy | Mistake | Preference | Pattern | Decision`
- `src/taste-vault/taste-vault.ts` — per-user high-level API, patterns are injected at prompt build time
- `src/ace/playbook.ts` — playbooks reference patterns by tag and type
- `src/orchestrator/prompt-builder.ts` — `buildVaultContext()` injects relevant patterns into every agent prompt

**Your constraint:** Do NOT modify any TypeScript source files. Your outputs are knowledge
artifacts only — markdown files and JSON files under `.nova/`. No `.ts` changes.

---

## Global Rules (apply to every task)

- **Read only** from source codebases (`/Users/jonathannelsen/bistrolens-2`, `/Users/jonathannelsen/nova26/src/`)
- **Write only** to `.nova/bistrolens-knowledge/`, `.nova/nova26-knowledge/`, and `.nova/knowledge-import/`
- **No TypeScript modifications** — zero changes to any `.ts` or `.tsx` file
- **Consistent format** — every pattern follows the template defined in KIRO-01 (see below)
- **Honest scoring** — flag weak patterns rather than inflate them; quality over quantity
- **Commit after each task** — one commit per KIRO-02 subtask using the format above
- **No new directories outside `.nova/`** — all outputs live under `.nova/`

---

## Pattern Format (from KIRO-01 — use this everywhere)

```markdown
### Pattern: [Descriptive Name]

**Category:** [Security/Database/UI/etc.]
**Source File:** [Exact file path]

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
```

---

## KIRO-02-01: Pattern Quality Audit

**Output file:** `.nova/bistrolens-knowledge/QUALITY-AUDIT.md`

### What to do

Read every pattern file under `.nova/bistrolens-knowledge/` (all 16 category folders). For
each individual pattern found, evaluate it on three dimensions:

**Completeness (0–10):**
- 10 = Has problem statement, implementation detail, code example, key insights, reusability score
- 5 = Missing code example or key insights but core content is present
- 0 = Name-only stub or placeholder text

**Accuracy (0–10):**
- 10 = Code is syntactically correct, types are valid, logic is sound
- 5 = Code has minor issues but the concept is correct
- 0 = Code is wrong, misleading, or fabricated

**Usefulness (0–10):**
- 10 = An agent working on a real task would directly benefit from this pattern
- 5 = Conceptually interesting but too abstract or too project-specific to apply directly
- 0 = Obvious, trivial, or irrelevant to Nova26's domain

Calculate a **composite score**: `(Completeness + Accuracy + Usefulness) / 3`

### Flags to assign (at most one per pattern)

- `PROMOTE` — composite >= 8.0 AND all three dimensions >= 7 → high-confidence, ready for import
- `IMPROVE` — composite 5.0–7.9 OR any dimension < 6 → needs more detail or a code example
- `DUPLICATE` — substantially overlaps another pattern (note which one)
- `VAGUE` — problem statement is too broad to act on
- `WRONG_CODE` — code example contains errors that would cause runtime or compile failures
- `DEPRIORITIZE` — composite < 5.0 or BistroLens-specific with no generalizable insight

### Output format for QUALITY-AUDIT.md

```markdown
# Pattern Quality Audit

**Audited:** [date]
**Total patterns reviewed:** [N]
**Promote:** [N] | **Improve:** [N] | **Duplicate:** [N] | **Vague:** [N] | **Wrong Code:** [N] | **Deprioritize:** [N]

---

## High Confidence (PROMOTE)

| Pattern Name | Category | File | Completeness | Accuracy | Usefulness | Composite |
|---|---|---|---|---|---|---|
| [name] | [cat] | [file] | [0-10] | [0-10] | [0-10] | [0-10] |

## Needs Improvement (IMPROVE)

| Pattern Name | Category | File | Composite | Issues |
|---|---|---|---|---|
| [name] | [cat] | [file] | [0-10] | [What specifically needs to be fixed] |

## Duplicates

| Pattern Name | Duplicates | Recommendation |
|---|---|---|
| [name] | [name of the pattern it duplicates] | [Which one to keep] |

## Deprioritize / Wrong Code / Vague

| Pattern Name | Category | Flag | Reason |
|---|---|---|---|

---

## Improvement Recommendations

[For each IMPROVE-flagged pattern: specific instructions on what to add or fix — be
prescriptive enough that another agent can execute the fix without re-reading the source]

---

## Summary Statistics

- Average composite score: [X.X]
- Best category (highest average): [category name]
- Weakest category (lowest average): [category name]
- Patterns ready for Taste Vault import (PROMOTE): [N]
- Patterns needing work before import: [N]
```

---

## KIRO-02-02: Cross-Reference Mapping

**Output file:** `.nova/bistrolens-knowledge/RELATIONSHIPS.md`

### Background

During KIRO-01, 11 cross-references to future pattern candidates were noted — patterns
referenced within extracted files but not yet fully documented. Your first job in this task
is to follow up on those cross-references.

### Step 1: Find the 11 cross-references

Scan all existing pattern files in `.nova/bistrolens-knowledge/` for any markers that
indicate a forward reference. Look for phrases like:
- "see also:", "cross-reference:", "future candidate:", "TODO:", "→ extract later"
- Any mention of a BistroLens file that was not the primary source for the current pattern
- Explicit notes left by the KIRO-01 session about patterns that were deferred

List every cross-reference you find. If you find fewer or more than 11, that is fine —
document exactly what you find.

### Step 2: Follow up on each cross-reference

For each cross-reference, read the referenced BistroLens source file (at
`/Users/jonathannelsen/bistrolens-2`). If an extractable pattern exists:

- Extract it using the standard pattern format
- Add it to the appropriate category folder
- Note it as "cross-reference follow-up" in the file's frontmatter

If the referenced file does not exist or contains no extractable pattern, document that
finding.

### Step 3: Build the relationship map

After extraction is complete, read all patterns across all 16 category folders and map the
relationships between them. For each relationship you identify, write one entry:

```
[Pattern A] [relationship-type] [Pattern B]
Reason: [One sentence explaining the dependency or complementarity]
```

Relationship types to use:
- `[depends on]` — Pattern A cannot be correctly implemented without Pattern B
- `[supports]` — Pattern A makes Pattern B more effective but is not required
- `[conflicts with]` — Pattern A and Pattern B make incompatible assumptions; note when to use each
- `[extends]` — Pattern A is a specialized application of Pattern B
- `[replaces]` — Pattern A supersedes Pattern B in modern contexts

Aim for 30+ relationships. Group them by category pairing (e.g., "Security ↔ Database",
"Testing ↔ Quality Gates").

### Output format for RELATIONSHIPS.md

```markdown
# Pattern Relationship Map

**Generated:** [date]
**Patterns mapped:** [N]
**Relationships found:** [N]
**Cross-reference follow-ups completed:** [N] of 11

---

## Cross-Reference Follow-Ups

| # | Original Reference | Source File Checked | Pattern Extracted? | Notes |
|---|---|---|---|---|

---

## Relationship Map

### Security ↔ Database
[Pattern A] [depends on] [Pattern B]
Reason: ...

### Security ↔ Testing
...

[continue for all relevant category pairings]

---

## Dependency Chains

[List the 3-5 most critical dependency chains — sequences of patterns that must all be
present for a feature area to work correctly]

Example:
RLS Policies → Convex Schema Design → Auth Patterns → Rate Limiting
(Each pattern in the chain requires the previous one to be implemented correctly)

---

## Standalone Patterns

[Patterns with no dependencies — safe to import and use in isolation]
```

---

## KIRO-02-03: Nova26 Codebase Pattern Extraction

**Output directory:** `.nova/nova26-knowledge/`
**Target:** 50+ patterns from Nova26's own source code

### What to read

Focus on these directories under `/Users/jonathannelsen/nova26/src/`:

```
src/orchestrator/       — outer build loop, prompt assembly, agent coordination
src/agent-loop/         — ReAct inner loop, scratchpad, tool execution
src/tools/              — tool registry, core tools, repo map
src/taste-vault/        — graph memory, global wisdom, vault API
src/ace/                — ACE playbook system, generator/reflector/curator cycle
src/security/           — vault security scanner, security patterns
src/similarity/         — semantic dedup engine
src/analytics/          — build intelligence, agent analytics, reflection
```

Read every `.ts` file in those directories. Also read the test files — tests often reveal
the intended contract more clearly than the implementation.

### Categories to extract into

Create this folder structure under `.nova/nova26-knowledge/`:

```
01-agent-architecture/      — how agents are structured, the ReAct loop, scratchpad design
02-orchestration-patterns/  — how Ralph coordinates agents, task routing, event store
03-tool-patterns/           — tool registration, permissions, rate limiting, tool executor
04-memory-patterns/         — graph memory design, node/edge schema, confidence scoring
05-playbook-patterns/       — ACE cycle, playbook evolution, generator/reflector/curator
06-testing-conventions/     — vitest patterns, singleton reset, integration test structure
07-error-handling/          — error types, propagation, graceful degradation in agent loop
08-type-conventions/        — TypeScript patterns used throughout (config interfaces, Zod, enums)
09-security-patterns/       — vault security scanner, agent output validation
10-analytics-patterns/      — build intelligence recording, reflection, metric accumulation
```

### What makes a good Nova26 pattern

- A recurring structural choice that appears in 2+ files (e.g., "singleton factory with reset")
- A non-obvious design decision with a clear rationale (e.g., "local JSON fallback before Convex")
- A testing pattern that is specific to this codebase's constraints
- A TypeScript convention that is enforced project-wide (e.g., ESM `.js` extensions on imports)
- An architectural boundary that separates concerns (e.g., GraphMemory vs TasteVault API surface)

### Required output files (minimum — create more if patterns justify it)

```
.nova/nova26-knowledge/01-agent-architecture/react-loop-pattern.md
.nova/nova26-knowledge/01-agent-architecture/scratchpad-design.md
.nova/nova26-knowledge/02-orchestration-patterns/event-store-pattern.md
.nova/nova26-knowledge/02-orchestration-patterns/task-routing.md
.nova/nova26-knowledge/03-tool-patterns/tool-registry-singleton.md
.nova/nova26-knowledge/03-tool-patterns/permission-model.md
.nova/nova26-knowledge/04-memory-patterns/graph-node-design.md
.nova/nova26-knowledge/04-memory-patterns/confidence-scoring.md
.nova/nova26-knowledge/05-playbook-patterns/ace-cycle.md
.nova/nova26-knowledge/06-testing-conventions/singleton-reset-pattern.md
.nova/nova26-knowledge/06-testing-conventions/vitest-integration-pattern.md
.nova/nova26-knowledge/07-error-handling/agent-loop-error-propagation.md
.nova/nova26-knowledge/08-type-conventions/config-interface-pattern.md
.nova/nova26-knowledge/08-type-conventions/zod-boundary-validation.md
.nova/nova26-knowledge/09-security-patterns/agent-output-scanner.md
.nova/nova26-knowledge/10-analytics-patterns/build-intelligence-recording.md
.nova/nova26-knowledge/INDEX.md
```

### INDEX.md format (mirror the BistroLens INDEX.md structure)

```markdown
# Nova26 Knowledge Base — Index

**Extracted:** [date]
**Total patterns:** [N]
**Source directories scanned:** [list]

## By Category

### 01 Agent Architecture
| Pattern | File | Reusability |
|---|---|---|
| [name] | [path] | [score] |

[repeat for all 10 categories]

## By Reusability Score (Top 20)

| Score | Pattern | Category |
|---|---|---|
| 10 | [name] | [cat] |
```

---

## KIRO-02-04: Pattern Import Preparation

**Output directory:** `.nova/knowledge-import/`
**Key output file:** `.nova/knowledge-import/manifest.json`

### Purpose

Kimi's PatternLoader (task KIMI-INTEGRATE-03) will read this manifest and bulk-import
patterns into the Taste Vault's graph memory via `TasteVault.addNode()`. The manifest must
be structured so PatternLoader can iterate it without any pre-processing.

### GraphNode schema (from src/taste-vault/graph-memory.ts)

The manifest entries must map cleanly onto the GraphNode type:

```typescript
type NodeType = 'Strategy' | 'Mistake' | 'Preference' | 'Pattern' | 'Decision';

interface GraphNode {
  id: string;                 // nanoid — PatternLoader generates this, leave empty or omit
  type: NodeType;             // required
  content: string;            // required — human-readable, max 500 chars
  confidence: number;         // 0–1, use QUALITY-AUDIT scores to inform this
  helpfulCount: number;       // 0 for new patterns
  userId: string;             // use 'system' for seeded knowledge
  isGlobal: boolean;          // true for high-confidence patterns (PROMOTE-flagged)
  globalSuccessCount: number; // 0 for new patterns
  language?: string;          // 'typescript' for code patterns, omit for architectural
  tags: string[];             // 3–8 tags per pattern
  createdAt: string;          // ISO timestamp of extraction
  updatedAt: string;          // ISO timestamp of extraction
}
```

### Manifest schema

```json
{
  "version": "1.0.0",
  "generatedAt": "<ISO timestamp>",
  "generatedBy": "KIRO-02-04",
  "summary": {
    "totalPatterns": 0,
    "bistrolensPatterns": 0,
    "nova26Patterns": 0,
    "highConfidence": 0,
    "categories": []
  },
  "patterns": [
    {
      "manifestId": "BL-01-001",
      "source": "bistrolens",
      "category": "security",
      "sourceFile": ".nova/bistrolens-knowledge/01-security/...",
      "type": "Strategy",
      "content": "<500 char max summary of the pattern>",
      "tags": ["rate-limiting", "security", "per-user"],
      "confidence": 0.9,
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
    }
  ]
}
```

### Manifest ID convention

- BistroLens patterns: `BL-<category-number>-<sequence>` (e.g., `BL-01-001`, `BL-01-002`)
- Nova26 patterns: `N26-<category-number>-<sequence>` (e.g., `N26-01-001`)
- Category numbers align with the folder numbers (01 = security/agent-architecture, etc.)

### Confidence mapping from quality audit

Use the composite scores from KIRO-02-01 QUALITY-AUDIT.md to set `confidence`:

| Composite Score | Confidence |
|---|---|
| 9.0 – 10.0 | 0.95 |
| 8.0 – 8.9 | 0.85 |
| 7.0 – 7.9 | 0.75 |
| 5.0 – 6.9 | 0.60 |
| < 5.0 | Omit from manifest (DEPRIORITIZE) |

For Nova26 patterns (no audit score yet): use 0.80 as default; 0.90 for patterns extracted
from files with 100% test coverage (check test files for full coverage signals).

### isGlobal mapping

- `true` — pattern was PROMOTE-flagged in quality audit, OR is a Nova26 architectural pattern
  that would benefit any agent on any task
- `false` — project-specific, needs improvement, or too narrow to share globally

### Edge extraction

Read RELATIONSHIPS.md (from KIRO-02-02) and translate each relationship into a manifest
edge. Map relationship types as follows:

| RELATIONSHIPS.md type | Edge type | Default weight |
|---|---|---|
| `[depends on]` | `requires` | 1.0 |
| `[supports]` | `supports` | 0.8 |
| `[extends]` | `extends` | 0.7 |
| `[conflicts with]` | `conflicts` | 0.5 |
| `[replaces]` | `supersedes` | 0.9 |

### Additional output files

Beyond manifest.json, also create:

**`.nova/knowledge-import/IMPORT-GUIDE.md`**

Instructions for Kimi's PatternLoader on how to consume the manifest:

```markdown
# Pattern Import Guide

## How to consume manifest.json

1. Read manifest.json
2. For each entry in `patterns` where `confidence >= 0.6`:
   - Call `TasteVault.addNode({ type, content, tags, confidence, isGlobal, userId: 'system', ... })`
   - Store the returned node ID alongside the manifestId for edge creation
3. After all nodes are imported, iterate `edges`:
   - Look up the Convex node IDs for fromManifestId and toManifestId
   - Call `GraphMemory.addEdge(fromId, toId, { type, weight, reason })`
4. Call `TasteVault.flush()` to persist to Convex

## Expected counts
[Fill in from your manifest]

## Tags index
[List all unique tags used, sorted alphabetically, with count of patterns using each tag]
```

**`.nova/knowledge-import/STATISTICS.md`**

A human-readable summary for the Nova26 team:

```markdown
# Knowledge Import Statistics

**Generated:** [date]

## Overall
- Total patterns ready for import: [N]
- BistroLens patterns: [N]
- Nova26 patterns: [N]
- Total edges: [N]

## Confidence Distribution
| Range | Count |
|---|---|
| 0.90 – 1.00 | [N] |
| 0.80 – 0.89 | [N] |
| 0.70 – 0.79 | [N] |
| 0.60 – 0.69 | [N] |

## Top Tags (by frequency)
[Top 15 tags]

## Patterns by Type
| Type | Count |
|---|---|
| Strategy | [N] |
| Pattern | [N] |
| Preference | [N] |
| Decision | [N] |
| Mistake | [N] |

## Categories Represented
[List all categories with pattern counts]
```

---

## Execution Order

Complete the tasks strictly in order. Each task depends on the output of the previous:

```
KIRO-02-01 (Quality Audit)
    ↓ produces QUALITY-AUDIT.md with PROMOTE/IMPROVE/DEPRIORITIZE flags
KIRO-02-02 (Cross-Reference Mapping)
    ↓ produces RELATIONSHIPS.md with typed edges between patterns
KIRO-02-03 (Nova26 Extraction)
    ↓ produces .nova/nova26-knowledge/ with INDEX.md
KIRO-02-04 (Import Preparation)
    ↓ consumes all three outputs → produces manifest.json + IMPORT-GUIDE.md + STATISTICS.md
```

Do not start KIRO-02-04 until KIRO-02-01, KIRO-02-02, and KIRO-02-03 are all complete.

---

## Commit Schedule

After each subtask, commit with:

```
docs(knowledge): KIRO-02-01 pattern quality audit — N promoted, M flagged for improvement
docs(knowledge): KIRO-02-02 cross-reference mapping — N follow-ups, M relationships mapped
docs(knowledge): KIRO-02-03 nova26 pattern extraction — N patterns across 10 categories
docs(knowledge): KIRO-02-04 import manifest ready — N patterns, M edges for KIMI-INTEGRATE-03
```

---

## Definition of Done

- [ ] QUALITY-AUDIT.md exists with scores for all 79 BistroLens patterns
- [ ] RELATIONSHIPS.md exists with 30+ typed relationships and all 11 cross-references resolved
- [ ] `.nova/nova26-knowledge/` exists with 50+ patterns and a complete INDEX.md
- [ ] `manifest.json` is valid JSON, parseable without errors, with all confidence values in [0,1]
- [ ] `manifest.json` includes edges derived from RELATIONSHIPS.md
- [ ] IMPORT-GUIDE.md exists with concrete steps for Kimi's PatternLoader
- [ ] STATISTICS.md exists and reflects the actual manifest counts
- [ ] Zero TypeScript files modified
- [ ] Four commits on main, one per subtask
