# Implementation Plan: KIRO-04 Knowledge Base Audit

## Overview

Four audit scripts in TypeScript, sharing a common scan-utils module. Each script reads the knowledge bases and documentation, then produces structured reports in `.nova/audit-reports/`. Gap patterns (KIRO-04-01) also write new files into the knowledge base directories.

## Tasks

- [x] 1. Set up audit infrastructure and shared utilities
  - [x] 1.1 Create `scripts/audit/scan-utils.ts` with shared interfaces and functions
    - Implement `scanKnowledgeBases()` to discover all modules and pattern files
    - Implement `parsePatternFile()` to extract sections, related patterns, code block presence
    - Implement `getMarkdownDocs()` to list `.nova/*.md` files
    - Create `.nova/audit-reports/` output directory
    - _Requirements: 1.1, 2.1, 3.1, 4.1_

  - [ ]* 1.2 Write property tests for scan-utils
    - **Property 4: Section detection accuracy**
    - **Property 5: Kebab-case filename validation**
    - **Validates: Requirements 2.1, 2.3, 2.5**

- [x] 2. Checkpoint — Verify scan-utils works
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. KIRO-04-01 — Gap pattern extraction
  - [x] 3.1 Create `scripts/audit/kiro-04-01-gap-extraction.ts`
    - Scan all 31 module directories across both knowledge bases
    - For each module, identify patterns that are referenced in Related Patterns sections but don't have their own pattern file
    - For each module, identify patterns referenced in INDEX.md but missing files
    - Create new Pattern_File for each identified gap following the Pattern_Template
    - Update INDEX.md files with new pattern entries
    - Update UNIFIED-MANIFEST.md with new pattern entries
    - Generate `kiro-04-01-gap-report.md` in `.nova/audit-reports/`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ]* 3.2 Write property tests for gap extraction
    - **Property 1: Gap pattern template conformance**
    - **Property 2: INDEX completeness**
    - **Property 3: Manifest completeness for new patterns**
    - **Validates: Requirements 1.2, 1.3, 1.4, 2.2**

- [x] 4. KIRO-04-02 — Structural consistency audit
  - [x] 4.1 Create `scripts/audit/kiro-04-02-structural-audit.ts`
    - Define audit criteria: has-source-section, has-code-examples, has-anti-patterns, has-when-to-use, has-benefits, has-related-patterns, kebab-case-filename, in-index
    - Audit every pattern file in all 31 modules against all criteria
    - Build pass/fail matrix with one row per module, one column per criterion
    - Add summary row with totals
    - Generate `kiro-04-02-structural-matrix.md` in `.nova/audit-reports/`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [ ]* 4.2 Write property tests for structural audit
    - **Property 4: Section detection accuracy** (if not covered in 1.2)
    - **Validates: Requirements 2.1, 2.5**

- [x] 5. Checkpoint — Verify KIRO-04-01 and KIRO-04-02 outputs
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. KIRO-04-03 — Documentation accuracy validation
  - [x] 6.1 Create `scripts/audit/kiro-04-03-doc-validation.ts`
    - Scan all `.nova/*.md` documentation files plus INDEX.md files
    - Extract file path references (markdown links, inline paths)
    - Check each reference resolves to an existing file
    - Extract stated pattern counts and compare to actual file counts
    - Calculate accuracy score per file (valid / total references)
    - Record stale references with file path, line number, and reference text
    - Generate `kiro-04-03-doc-accuracy.md` in `.nova/audit-reports/`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [ ]* 6.2 Write property tests for doc validation
    - **Property 6: File path reference resolution**
    - **Property 7: Count accuracy validation**
    - **Property 8: Stale reference recording completeness**
    - **Property 9: Accuracy score calculation**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

- [x] 7. KIRO-04-04 — Cross-module dependency mapping
  - [x] 7.1 Create `scripts/audit/kiro-04-04-dependency-map.ts`
    - Extract Related Patterns references from all pattern files
    - Build dependency graph with nodes (patterns) and directed edges (references)
    - Detect island nodes (inDegree=0 and outDegree=0)
    - Detect circular reference cycles using DFS
    - Rank patterns by inDegree for hub identification
    - Output `kiro-04-04-dependency-graph.json` in `.nova/audit-reports/`
    - Output `kiro-04-04-dependency-map.md` with ASCII visualization in `.nova/audit-reports/`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [ ]* 7.2 Write property tests for dependency mapping
    - **Property 10: Graph structural invariant**
    - **Property 11: Island detection correctness**
    - **Property 12: Cycle detection correctness**
    - **Property 13: Hub ranking sort order**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**

- [x] 8. Checkpoint — Verify KIRO-04-03 and KIRO-04-04 outputs
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Run all four audit scripts and validate outputs
  - [x] 9.1 Execute all audit scripts and verify report generation
    - Run each script via `npx tsx`
    - Verify all 5 output files exist in `.nova/audit-reports/`
    - Verify gap patterns were created and indexes updated
    - Verify structural matrix covers all modules
    - Verify doc accuracy report covers all documentation files
    - Verify dependency graph JSON is valid and visualization is readable
    - _Requirements: 1.5, 2.4, 2.6, 3.6, 4.6, 4.7_

- [x] 10. Final checkpoint — Ensure all outputs are complete
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Existing pattern files and documentation are read-only — only new files are created
- Gap patterns (KIRO-04-01) are the exception: they add new files to the knowledge base directories
- All audit report outputs go to `.nova/audit-reports/`
- Property tests use `fast-check` and run minimum 100 iterations each
