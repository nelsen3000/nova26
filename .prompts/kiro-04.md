# KIRO TASK FILE — Round 4: R16/R17 Module Extraction, Structural Audit & Documentation Validation

> Owner: Kiro
> Priority: 1 (Module Pattern Extraction) → 2 (Structural Audit) → 3 (Doc Validation) → 4 (Dependency Map)
> Prerequisite: KIRO-03 complete, pattern validation passing (140 patterns, 9 properties)
> Test baseline: 2,642+ tests passing, 0 TypeScript errors
> Commit format: `docs(knowledge): KIRO-04-XX <short description>`

---

## Context

Nova26 has grown significantly since your last extraction round. Since KIRO-03, 17 new feature
modules have been implemented across R16 and R17 sprints. These modules contain rich architectural
patterns, error handling strategies, and design decisions that should be extracted into the
knowledge system — just as you extracted patterns from BistroLens and the original Nova26 core.

Additionally, the codebase now has 62 directories under `src/`, 105 test files, and 2,642 tests.
The structural consistency varies: some modules (R16-01 through R16-05, R17-01, R17-02) are deep
with 5-7 source files and 59-210 tests each, while others (R17-03 through R17-12) are shallow
with 2 source files and 13-22 tests each. A structural audit will help identify inconsistencies.

**Your constraint:** Do NOT modify any TypeScript source files. All outputs are knowledge
artifacts only — `.md` and `.json` files under `.nova/`. Zero `.ts` or `.tsx` changes.

---

## Global Rules (apply to every task)

- **Read** source from `/Users/jonathannelsen/nova26/src/` — specifically the 17 R16/R17 module
  directories listed below
- **Write** only to `.nova/nova26-knowledge/`, `.nova/knowledge-import/`, and `.nova/audits/`
  — all paths relative to `/Users/jonathannelsen/nova26/`
- **No TypeScript modifications** — zero changes to any `.ts` or `.tsx` file
- **Consistent format** — use the Nova26 pattern template from KIRO-03 for all extractions
- **Self-contained** — every pattern file must be understandable without reading the source code
- **File paths and line numbers** — reference actual source locations wherever possible
- **Commit after each task** — one commit per KIRO-04 subtask

---

## The 17 R16/R17 Modules to Analyze

| ID | Module | Directory | Source Files | Test Files |
|----|--------|-----------|-------------|------------|
| R16-01 | Portfolio Intelligence | `src/portfolio/` | 5 | 5 |
| R16-02 | Agent Memory | `src/memory/` | 6 | 5 |
| R16-03 | Generative UI | `src/generative-ui/` | 3 | 2 |
| R16-04 | Autonomous Testing | `src/testing/` | 7 | 6 |
| R16-05 | Developer Wellbeing | `src/wellbeing/` | 6 | 6 |
| R17-01 | Advanced Recovery | `src/recovery/` | 6 | 6 |
| R17-02 | Advanced Init | `src/init/` | 5 | 5 |
| R17-03 | Code Review | `src/review/` | 2 | 1 |
| R17-04 | Migration Engine | `src/migrate/` | 2 | 1 |
| R17-05 | Debugging | `src/debug/` | 2 | 1 |
| R17-06 | Accessibility | `src/a11y/` | 2 | 1 |
| R17-07 | Technical Debt | `src/debt/` | 2 | 1 |
| R17-08 | Dependency Mgmt | `src/deps/` | 2 | 1 |
| R17-09 | Prod Feedback | `src/prod-feedback/` | 2 | 1 |
| R17-10 | Health Dashboard | `src/health/` | 2 | 1 |
| R17-11 | Environment Mgmt | `src/env/` | 2 | 1 |
| R17-12 | Orchestration | `src/orchestration/` | 2 | 2 |

---

## Task KIRO-04-01: R16/R17 Pattern Extraction

**Goal:** Extract architectural and design patterns from all 17 R16/R17 modules.

**For each module, extract:**
1. **Primary pattern** — the core architectural approach (e.g., "State Machine Pattern" for
   wellbeing, "Circuit Breaker Pattern" for recovery)
2. **Data modeling pattern** — how the module structures its data (interfaces, enums, type unions)
3. **Error handling pattern** — how the module handles failures (if applicable)
4. **Testing pattern** — notable testing approaches (property tests, mocks, fixtures)
5. **Integration pattern** — how the module exposes its API (factory functions, config objects, etc.)

**Output:** One pattern file per module in `.nova/nova26-knowledge/r16-r17/`:
- `portfolio-patterns.md`
- `memory-patterns.md`
- `generative-ui-patterns.md`
- `testing-patterns.md`
- `wellbeing-patterns.md`
- `recovery-patterns.md`
- `init-patterns.md`
- `review-patterns.md`
- `migrate-patterns.md`
- `debug-patterns.md`
- `a11y-patterns.md`
- `debt-patterns.md`
- `deps-patterns.md`
- `prod-feedback-patterns.md`
- `health-patterns.md`
- `env-patterns.md`
- `orchestration-patterns.md`

**Expected:** 17 pattern files, 3-5 patterns each = 51-85 new patterns.

**Use this template for each pattern:**

```markdown
### Pattern: [Descriptive Name]

**Category:** [Architecture/Data Modeling/Error Handling/Testing/Integration]
**Source File:** [Exact file path relative to nova26/]
**Module:** [R16-XX or R17-XX module name]
**Status:** EXTRACTED

**Problem Solved:** [1-2 sentences]

**How It's Implemented:**
[Detailed description with key interfaces/types quoted from source]

**Key Design Decisions:**
- [Decision 1 and rationale]
- [Decision 2 and rationale]

**Anti-Patterns (what NOT to do):**
- Don't: [anti-pattern] → Do: [correct approach]

**Positive Counterexample:**
[Brief example of the pattern applied correctly elsewhere in the codebase]

**Related Patterns:** [Cross-references to other extracted patterns]

**Don't Use For:** [Scenarios where this pattern is inappropriate]
```

---

## Task KIRO-04-02: Structural Consistency Audit

**Goal:** Audit all 17 R16/R17 modules for structural consistency and identify gaps.

**Check each module for:**
1. **Barrel export** — does it have `index.ts`? If not, what's the entry point?
2. **Config type** — does it export a typed config interface? Is it importable?
3. **Factory function** — does it export a `createXxx()` factory or require manual instantiation?
4. **Test coverage** — ratio of test files to source files. Flag modules with < 1:1 ratio.
5. **Test depth** — approximate test count. Flag modules with < 20 tests.
6. **Type safety** — are all public APIs fully typed? Any `any` types?
7. **Immutability** — does the module follow immutable patterns (return new objects, don't mutate)?
8. **Error handling** — does it define custom error types or use generic throws?
9. **Documentation** — are public types and functions documented with JSDoc?

**Output:** `.nova/audits/r16-r17-structural-audit.md` with:
- Summary table (module × checklist items = pass/fail matrix)
- Detailed findings per module
- Prioritized list of inconsistencies to fix (sorted by severity)
- Specific recommendations for each module

**Expected inconsistencies to find:**
- R17-03 through R17-12 are shallow (2 source files, 13-22 tests) vs R16 modules (5-7 files, 59-210 tests)
- Wellbeing, Recovery, Init use `*-index.ts` instead of `index.ts` as barrel exports
- `src/memory/session-memory.ts` has no test file
- Some modules may lack factory functions or typed configs

---

## Task KIRO-04-03: Documentation Accuracy Validation

**Goal:** Validate that the 16 root-level markdown documentation files accurately reflect the
current codebase state.

**Files to validate:**
1. `README.md`
2. `ARCHITECTURE.md`
3. `AGENTS.md`
4. `CLI.md`
5. `CONTRIBUTING.md`
6. `COORDINATION.md`
7. `FEATURES_GUIDE.md`
8. `INTEGRATIONS.md`
9. `MINIMAX.md`
10. `MISSING_FEATURES.md`
11. `NEW_FEATURES_SUMMARY.md`
12. `ORCHESTRATOR.md`
13. `PRDS.md`
14. `PROJECT_REFERENCE.md`
15. `SCHEMA.md`
16. `CLAUDE.md`

**For each file, check:**
1. **Accuracy** — do code references (file paths, function names, class names) match reality?
2. **Completeness** — does it mention the R16/R17 modules? The 2,642+ test count? The 14 Convex tables?
3. **Staleness** — are there references to old states (e.g., "queued" items that are actually complete)?
4. **Contradictions** — do any docs contradict each other?

**Also validate Kimi's overnight docs:**
- `OVERNIGHT_SUMMARY.md`
- `R17_QUICK_REFERENCE.md`
- `R17_API_DOCUMENTATION.md`
- `FINAL_OVERNIGHT_REPORT.md`

**Output:** `.nova/audits/documentation-accuracy-report.md` with:
- Per-file accuracy score (0-100%)
- Specific inaccuracies found (with line numbers)
- Stale references that need updating
- Missing sections that should be added
- Overall documentation health score

---

## Task KIRO-04-04: Cross-Module Dependency Map

**Goal:** Build a comprehensive dependency map showing how all 62 `src/` directories relate to
each other through imports.

**Methodology:**
1. For each of the 17 R16/R17 modules, trace all `import` statements to identify dependencies
2. For the core modules (orchestrator, cli, agents, llm, ace), trace which R16/R17 modules they import
3. Identify modules that are **islands** — no other module imports them (dead code candidates)
4. Identify circular dependency chains
5. Map the "critical path" — which modules must work for a basic build to succeed

**Output:** `.nova/knowledge-import/dependency-map.json` with:
```json
{
  "nodes": [
    { "id": "orchestrator", "type": "core", "importCount": 15, "exportCount": 8 }
  ],
  "edges": [
    { "from": "orchestrator", "to": "recovery", "type": "import", "symbols": ["AdvancedRecoveryConfig"] }
  ],
  "islands": ["module-names-that-nothing-imports"],
  "cycles": [["a", "b", "a"]],
  "criticalPath": ["cli", "orchestrator", "agent-loop", "llm", "agents"]
}
```

Also output a human-readable `.nova/audits/dependency-map.md` with:
- ASCII visualization of the dependency graph
- List of island modules (these are the unwired dead code modules)
- Recommendations for which islands should be wired and where

---

## Success Criteria

- KIRO-04-01: 17 pattern files created, 51+ patterns extracted, all following template
- KIRO-04-02: Structural audit complete with pass/fail matrix for all 17 modules
- KIRO-04-03: All 20 markdown files validated, accuracy scores assigned, inaccuracies catalogued
- KIRO-04-04: Dependency map JSON + markdown report, islands identified

**Total expected output:** ~25-30 new files in `.nova/`
