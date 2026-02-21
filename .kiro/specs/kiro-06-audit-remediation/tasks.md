# Implementation Plan: KIRO-06 Audit Remediation + Agent Template Extraction

## Overview

Remediate 87 structural audit failures, extract 21 agent template patterns, build an agent interaction graph, and verify zero remaining failures. All outputs are `.md` and `.json` files under `.nova/` — no TypeScript modifications.

## Tasks

- [-] 1. KIRO-06-01: Fix Nova26 INDEX.md (49 gaps)
  - [ ] 1.1 Enumerate all `.md` pattern files across all subdirectories of `.nova/nova26-patterns/` (excluding INDEX.md, EXTRACTION-TASK-LIST.md, and .gitkeep files)
    - Compare enumerated files against current INDEX.md entries
    - Identify all files not currently listed in the INDEX
    - _Requirements: 1.1, 1.2_
  - [x] 1.2 Add missing entries to INDEX.md
    - For each missing file, add a row to the appropriate category table with pattern name, relative file path, and one-line description
    - Update the summary count table so each category count matches actual file count on disk
    - Verify total pattern count in INDEX equals total pattern files on disk
    - _Requirements: 1.3, 1.4, 1.5_
  - [-] 1.3 Verify INDEX completeness (Property 1)
    - **Property 1: INDEX completeness**
    - For every `.md` pattern file on disk, confirm it appears in INDEX.md and per-category counts match
    - **Validates: Requirements 1.3, 1.4**

- [ ] 2. KIRO-06-02: Fix 7 Intelligence Pattern Files (28 section gaps)
  - [ ] 2.1 Audit each of the 7 files in `.nova/nova26-patterns/02-intelligence/` for missing sections
    - Check each file for all 8 required sections: Title (H1), Overview/Problem, Source, Pattern/Solution, Usage/Example, Anti-Patterns, When to Use, Benefits
    - Record which sections are missing per file
    - _Requirements: 2.1_
  - [ ] 2.2 Add missing sections to each intelligence pattern file
    - For each file, add missing sections with accurate content derived from the source code path in the Source section
    - Preserve all existing content and section ordering
    - _Requirements: 2.2, 2.3_
  - [ ] 2.3 Verify section completeness (Property 2)
    - **Property 2: Intelligence pattern section completeness**
    - For all 7 files, confirm all 8 required section headers are present
    - **Validates: Requirements 2.1, 2.4**

- [ ] 3. Checkpoint — Verify KIRO-06-01 and KIRO-06-02
  - Ensure INDEX.md lists all 51 patterns and all 7 intelligence files have complete sections
  - Ask the user if questions arise

- [ ] 4. KIRO-06-03: Fix 11 BistroLens Hook Filenames (kebab-case)
  - [ ] 4.1 Rename all 11 camelCase hook files to kebab-case
    - `useAuth.md` → `use-auth.md`
    - `useAuthWithRecaptcha.md` → `use-auth-with-recaptcha.md`
    - `useDebounce.md` → `use-debounce.md`
    - `useFreemium.md` → `use-freemium.md`
    - `useIntersectionObserver.md` → `use-intersection-observer.md`
    - `useLocalStorage.md` → `use-local-storage.md`
    - `useMediaQuery.md` → `use-media-query.md`
    - `useSubscription.md` → `use-subscription.md`
    - `useSwipeGesture.md` → `use-swipe-gesture.md`
    - `useTierGates.md` → `use-tier-gates.md`
    - `useToast.md` → `use-toast.md`
    - _Requirements: 3.1, 3.2_
  - [ ] 4.2 Update all cross-references to renamed files
    - Search all files in `.nova/bistrolens-knowledge/` for references to old camelCase filenames
    - Update each reference to the new kebab-case filename
    - Update `.nova/bistrolens-knowledge/INDEX.md` entries to match new filenames
    - _Requirements: 3.3_
  - [ ] 4.3 Verify kebab-case compliance and zero stale references (Properties 3, 4)
    - **Property 3: Kebab-case filename compliance**
    - **Property 4: Zero stale hook references**
    - Confirm zero camelCase files remain and zero old filename references exist
    - **Validates: Requirements 3.2, 3.3, 3.4**

- [ ] 5. KIRO-06-04: Fix Stale Reference in AI_COORDINATION.md
  - [ ] 5.1 Identify and fix stale references in `.nova/AI_COORDINATION.md`
    - Scan the entire document for file path references
    - For each reference, check if the file exists on disk
    - The known stale reference is `sun-prd-generator.js` around line 215 — search `src/` for the replacement
    - Update all stale references to correct file paths
    - Report total stale references found and fixed
    - _Requirements: 4.1, 4.2, 4.3, 4.4_
  - [ ] 5.2 Verify reference validity (Property 5)
    - **Property 5: AI_COORDINATION reference validity**
    - Confirm all file path references in AI_COORDINATION.md resolve to existing files
    - **Validates: Requirements 4.3**

- [ ] 6. Checkpoint — Verify KIRO-06-01 through KIRO-06-04 remediations
  - All 87 original audit failures should now be resolved
  - Ask the user if questions arise

- [ ] 7. KIRO-06-05: Extract Patterns from 21 Agent Templates
  - [ ] 7.1 Create `.nova/nova26-knowledge/agents/` directory and extract patterns from all 21 agent templates
    - For each `.nova/agents/*.md` file, parse the EARTH XML elements: `agent_profile`, `principles`, `constraints`, `input_requirements`, `output_format`, `self_check`
    - Create one pattern file per agent in `.nova/nova26-knowledge/agents/` using kebab-case naming (e.g., `sun.md`, `mercury.md`)
    - Each file follows the standard template: Problem → Solution → Constraints → Input/Output Flows → Example → Anti-Pattern → When to Use → Benefits
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
  - [ ] 7.2 Verify agent pattern completeness (Properties 6, 7)
    - **Property 6: Agent pattern file completeness**
    - **Property 7: Agent count invariant**
    - Confirm exactly 21 files exist and each contains all required sections
    - **Validates: Requirements 5.5, 5.6**

- [ ] 8. KIRO-06-06: Agent Interaction Graph
  - [ ] 8.1 Build agent interaction graph JSON
    - Parse all 21 agent templates for `input_requirements` and `output_format`/`handoff` relationships
    - Build directed graph: nodes = 21 agents (with id, role, domain), edges = data flows (with from, to, dataType)
    - Output to `.nova/nova26-knowledge/agent-interaction-graph.json`
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  - [ ] 8.2 Create agent interaction graph markdown
    - Create `.nova/nova26-knowledge/agent-interaction-graph.md` with:
      - ASCII visualization of the directed graph
      - Table of all edges: From → To → Data Type
      - Hub analysis: agents ranked by total connections (in-degree + out-degree)
    - _Requirements: 6.5_
  - [ ] 8.3 Verify graph structural validity (Property 8)
    - **Property 8: Interaction graph structural validity**
    - Confirm 21 nodes and all edges have non-empty from, to, and dataType fields
    - **Validates: Requirements 6.2, 6.3**

- [ ] 9. KIRO-06-07: Re-run Structural Audit (Verify Fixes)
  - [ ] 9.1 Run verification audit and produce report
    - Re-run all structural audit checks: INDEX completeness, section presence, filename conventions, reference validity
    - Output report to `.nova/audit-reports/kiro-06-verification.md`
    - Include summary table with failure count per check category (target: 0)
    - If any failures remain, document each with a remediation note
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [ ] 10. Final checkpoint — Verify all deliverables
  - Ensure all tests pass, ask the user if questions arise
  - Deliverables checklist:
    - Updated INDEX.md with all 51 patterns
    - 7 fixed intelligence pattern files
    - 11 renamed BistroLens hook files + updated references
    - Fixed stale reference(s) in AI_COORDINATION.md
    - 21 agent pattern files in `.nova/nova26-knowledge/agents/`
    - Agent interaction graph (JSON + markdown)
    - Clean verification audit report

## Notes

- Tasks marked with `*` are optional verification sub-tasks that can be skipped for faster execution
- All commits follow: `docs(knowledge): KIRO-06-XX description`
- NO TypeScript modifications — outputs only: `.md`, `.json` under `.nova/`
- KIRO-06-01 through KIRO-06-04 fix the 87 audit failures; KIRO-06-05 and KIRO-06-06 extend the knowledge base; KIRO-06-07 verifies everything
- Property-based testing libraries are not applicable since there's no executable code — verification is done via file system checks
