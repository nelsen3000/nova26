# Import Guide — BistroLens Knowledge Manifest

**File:** `import-manifest.json`
**Consumer:** Kimi's PatternLoader (KIMI-INTEGRATE-03)
**Destination:** Taste Vault graph memory

---

## Structure Overview

The manifest has two top-level arrays: `nodes` and `edges`.

---

## Node Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique stable identifier. Format: `bistrolens-{category}-{slug}`. Use kebab-case. Never change after import — edges reference this. |
| `type` | `Pattern \| Strategy \| Preference \| Decision` | Semantic classification of the knowledge node (see Type Guide below). |
| `content` | string | One or two sentence description of what this pattern does and when to use it. Written for LLM consumption — be specific. |
| `confidence` | number (0–1) | How reliable this pattern is. All 79 BistroLens patterns are set to `0.85` — they passed the KIRO-02-01 quality audit. Use lower values for experimental or unvalidated patterns. |
| `helpful` | number | Feedback counter. Always starts at `0`. The Taste Vault increments this when an agent successfully applies the pattern. Do not set manually. |
| `tags` | string[] | Searchable keywords. Include: the category name, key technologies, and the primary use case. Used for semantic search and filtering. |
| `source` | string | Origin of the pattern. `"bistrolens"` for all patterns in this manifest. Other valid values: `"nova26"`, `"manual"`, `"inferred"`. |
| `filePath` | string | Relative path to the full pattern markdown file from workspace root. PatternLoader reads this file for the full implementation details. |

---

## Type Guide

| Type | When to Use | Examples |
|------|-------------|---------|
| `Pattern` | A reusable, concrete implementation approach with code | `useQuery` patterns, error boundaries, toast notifications |
| `Strategy` | An architectural or process-level decision that spans multiple patterns | RBAC implementation, caching strategy, deployment config |
| `Preference` | A style, naming, or convention choice — not strictly required but consistently applied | Component structure conventions, button variants, ARIA patterns |
| `Decision` | A one-time architectural decision with documented rationale (ADR-style) | Reserved for future ADR imports |

---

## Edge Fields

| Field | Type | Description |
|-------|------|-------------|
| `sourceId` | string | The `id` of the originating node. |
| `targetId` | string | The `id` of the destination node. |
| `relation` | `supports \| refines \| depends_on` | The semantic relationship (see Relation Guide below). |
| `strength` | number (0–1) | How strong the relationship is. `0.9+` = tightly coupled, `0.8` = related but independent. |

---

## Relation Guide

| Relation | Meaning | Example |
|----------|---------|---------|
| `supports` | Source pattern makes the target pattern work better, but target can exist without source | `query-patterns` supports `performance-optimization` |
| `refines` | Source is a more specific or detailed version of the target | `react-error-boundaries` refines `errors-error-boundaries` |
| `depends_on` | Source pattern requires the target pattern to function correctly | `protected-routes` depends_on `auth-helpers` |

---

## Category → Type Mapping

| Category | Default Type | Rationale |
|----------|-------------|-----------|
| 01 Convex Patterns | `Pattern` / `Strategy` | Schema/migration = Strategy; queries/mutations = Pattern |
| 02 React Patterns | `Pattern` / `Preference` | Component structure = Preference; hooks/effects = Pattern |
| 03 Auth Patterns | `Pattern` / `Strategy` | RBAC/subscription = Strategy; helpers/session = Pattern |
| 04 UI Components | `Pattern` / `Preference` | Button/card variants = Preference; modals/toasts = Pattern |
| 05 Form Patterns | `Pattern` | All form patterns are concrete implementations |
| 06 Data Fetching | `Pattern` / `Strategy` | Caching = Strategy; useQuery/useMutation = Pattern |
| 07 Error Handling | `Pattern` / `Preference` | Error messages copy = Preference; boundaries/retry = Pattern |
| 08 Testing Patterns | `Pattern` | All testing patterns are concrete implementations |
| 09 Custom Hooks | `Pattern` | All hooks are concrete implementations |
| 10 Utilities | `Pattern` | All utility functions are concrete implementations |
| 11 Validation | `Pattern` / `Strategy` | Business rules = Strategy; validators = Pattern |
| 12 Routing | `Pattern` / `Strategy` | Route structure = Strategy; navigation = Pattern |
| 13 State Management | `Pattern` / `Strategy` | Global state = Strategy; local/context = Pattern |
| 14 Performance | `Pattern` / `Strategy` | Bundle/code-splitting = Strategy; render = Pattern |
| 15 Accessibility | `Preference` / `Strategy` | WCAG compliance = Strategy; ARIA/keyboard = Preference |
| 16 Deployment | `Strategy` | All deployment patterns are architectural decisions |

---

## PatternLoader Integration Notes

The PatternLoader (KIMI-INTEGRATE-03) expects:

1. Valid JSON at `.nova/knowledge-import/import-manifest.json`
2. All `filePath` values to resolve from workspace root
3. `id` values to be globally unique across all imports
4. `confidence` between 0 and 1 inclusive
5. `helpful` starting at 0 (managed by Taste Vault)

To add more patterns in future imports, append to the `nodes` array and add corresponding `edges`. Do not change existing `id` values — they are used as stable graph node identifiers.

---

## Stats

| Metric | Value |
|--------|-------|
| Total nodes | 104 |
| Total edges | 93 |
| Sources | `bistrolens`, `nova26` |
| Confidence level | 0.85 (bistrolens validated), 0.90 (nova26 extracted) |
| BistroLens categories | 16 + 11 missing patterns |
| Nova26 categories | 2 (orchestration, intelligence) |

---

## Source Guide

| Source | Description | Node Count |
|--------|-------------|-----------|
| `bistrolens` | Patterns extracted from BistroLens codebase (KIRO-01 + KIRO-03-01) | 90 |
| `nova26` | Patterns extracted from Nova26 source code (KIRO-03-02 + KIRO-03-03) | 14 |

---

## Nova26 Pattern Locations

Nova26 patterns are stored in `.nova/nova26-patterns/`:
- `01-orchestration/` — Ralph Loop, parallel runner, council voting, gate runner, prompt builder, todo tracking, test-fix loop, agent schemas
- `02-intelligence/` — Model router, response cache, smart retry, session memory, security scanner, Langfuse tracing, checkpoint system

---

*Generated: 2026-02-18*
*Phase: KIRO-03-04*
*Next: KIMI-INTEGRATE-03 PatternLoader consumption*
