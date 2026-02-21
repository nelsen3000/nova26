# Implementation Plan: Comprehensive Pattern Extraction

## Overview

Four-phase extraction: validate 11 existing BistroLens gap-fill patterns, extract ~25 Nova26 architecture patterns, extract ~25 Nova26 data/intelligence patterns, then build a unified manifest. All pattern files follow the shared Pattern_Template. A validation script using `fast-check` verifies correctness properties.

## Tasks

- [x] 1. KIRO-03-01 — Validate and quality-check the 11 BistroLens gap-fill patterns
  - [x] 1.1 Audit each of the 11 pattern files for template conformance
    - Read each file: `rate-limiting.md`, `soft-delete-pattern.md`, `useAuthWithRecaptcha.md`, `convex-file-storage.md`, `resilience-patterns.md`, `useSwipeGesture.md`, `useTierGates.md`, `useFreemium.md`, `subscription-service.md`, `optimistic-mutation-pattern.md`, and identify any additional missing pattern
    - Check for required sections: Source, Code Examples (TypeScript/TSX), Anti-Patterns or When to Use, Benefits, Related Patterns
    - Fix any files missing sections or containing placeholder text
    - _Requirements: 1.1, 1.2_

  - [x] 1.2 Run cross-reference validation across all 90 BistroLens patterns
    - Scan every pattern file's Related Patterns section
    - Resolve each reference to a file path
    - Fix or remove any broken references
    - _Requirements: 1.3, 1.4_

  - [x] 1.3 Update BistroLens INDEX.md to include all 90 patterns
    - Add entries for the 11 gap-fill patterns to the appropriate category tables
    - Verify the total count matches 90
    - _Requirements: 1.5_

- [x] 2. Checkpoint — Validate KIRO-03-01 completion
  - Ensure all 11 patterns pass template conformance
  - Ensure zero broken cross-references in BistroLens knowledge base
  - Ask the user if questions arise.

- [x] 3. KIRO-03-02 — Extract Nova26 core architecture patterns
  - [x] 3.1 Create Nova26 knowledge base directory structure
    - Create `.nova/nova26-patterns/` with category folders: `01-orchestration/`, `02-agent-system/`, `03-quality-gates/`, `04-cli-and-commands/`, `05-execution/`, `06-llm-integration/`, `07-memory-and-persistence/`, `08-security/`, `09-observability/`, `10-cost-management/`, `11-codebase-analysis/`, `12-git-and-integrations/`, `13-browser-and-preview/`, `14-templates-and-skills/`, `15-type-system/`
    - Create empty `INDEX.md` and `EXTRACTION-TASK-LIST.md`
    - _Requirements: 2.2_

  - [x] 3.2 Extract orchestration patterns (01-orchestration)
    - Source: `src/orchestrator/ralph-loop.ts`, `task-picker.ts`, `parallel-runner.ts`, `event-store.ts`, `prompt-builder.ts`, `gate-runner.ts`, `council-runner.ts`
    - Extract patterns: ralph-loop.md, task-picker.md, parallel-runner.md, event-store.md, prompt-builder.md, gate-runner.md, council-runner.md
    - Each file follows Pattern_Template with real code from source
    - _Requirements: 2.1, 2.3, 2.5_

  - [x] 3.3 Extract agent system patterns (02-agent-system)
    - Source: `src/orchestrator/agent-loader.ts`, `src/orchestrator/agent-explanations.ts`, `src/agents/sun-prd-generator.ts`, `src/orchestrator/atlas-convex.ts`, `src/orchestrator/convex-client.ts`
    - Extract patterns: agent-loader.md, agent-explanations.md, prd-generator.md, atlas-convex.md, convex-client.md
    - _Requirements: 2.1, 2.3, 2.5_

  - [x] 3.4 Extract quality gate patterns (03-quality-gates)
    - Source: `src/gates/typescript-gate.ts`, `src/gates/test-runner-gate.ts`, `src/gates/piston-client.ts`
    - Extract patterns: typescript-gate.md, test-runner-gate.md, piston-client.md
    - _Requirements: 2.1, 2.3, 2.5_

  - [x] 3.5 Extract CLI and command patterns (04-cli-and-commands)
    - Source: `src/cli/index.ts`, `src/cli/slash-commands.ts`, `src/cli/slash-commands-extended.ts`
    - Extract patterns: cli-entry.md, slash-commands.md, slash-commands-extended.md
    - _Requirements: 2.1, 2.3, 2.5_

  - [x] 3.6 Extract execution patterns (05-execution)
    - Source: `src/sandbox/docker-executor.ts`, `src/swarm/swarm-mode.ts`
    - Extract patterns: docker-executor.md, swarm-mode.md
    - _Requirements: 2.1, 2.3_

  - [x] 3.7 Extract browser and preview patterns (13-browser-and-preview)
    - Source: `src/browser/visual-validator.ts`, `src/preview/server.ts`
    - Extract patterns: visual-validator.md, preview-server.md
    - _Requirements: 2.1, 2.3_

  - [x] 3.8 Extract template and skill patterns (14-templates-and-skills)
    - Source: `src/templates/template-engine.ts`, `src/skills/skill-loader.ts`
    - Extract patterns: template-engine.md, skill-loader.md
    - _Requirements: 2.1, 2.3_

  - [x] 3.9 Extract IDE integration pattern (13-browser-and-preview or separate)
    - Source: `src/ide/vscode-extension.ts`
    - Extract pattern: vscode-extension.md
    - _Requirements: 2.1, 2.3_

  - [x] 3.10 Create Nova26 architecture INDEX.md
    - List all extracted architecture patterns with name, category, and description
    - Organize by category folder
    - _Requirements: 2.4_

- [x] 4. Checkpoint — Validate KIRO-03-02 completion
  - Ensure at least 25 architecture pattern files exist
  - Ensure all follow Pattern_Template
  - Ensure INDEX.md lists all patterns
  - Ask the user if questions arise.

- [x] 5. KIRO-03-03 — Extract Nova26 data and intelligence patterns
  - [x] 5.1 Extract LLM integration patterns (06-llm-integration)
    - Source: `src/llm/model-router.ts`, `src/llm/ollama-client.ts`, `src/llm/structured-output.ts`, `src/llm/response-cache.ts`
    - Extract patterns: model-router.md, ollama-client.md, structured-output.md, response-cache.md
    - _Requirements: 3.1, 3.3, 3.5_

  - [x] 5.2 Extract memory and persistence patterns (07-memory-and-persistence)
    - Source: `src/memory/session-memory.ts`, `src/persistence/checkpoint-system.ts`
    - Extract patterns: session-memory.md, checkpoint-system.md
    - _Requirements: 3.1, 3.3, 3.5_

  - [x] 5.3 Extract security patterns (08-security)
    - Source: `src/security/security-scanner.ts`
    - Extract pattern: security-scanner.md
    - _Requirements: 3.1, 3.3, 3.5_

  - [x] 5.4 Extract observability patterns (09-observability)
    - Source: `src/observability/tracer.ts`, `src/observability/index.ts`
    - Extract patterns: tracer.md, observability-setup.md
    - _Requirements: 3.1, 3.3, 3.5_

  - [x] 5.5 Extract cost management patterns (10-cost-management)
    - Source: `src/cost/cost-tracker.ts`
    - Extract pattern: cost-tracker.md
    - _Requirements: 3.1, 3.3, 3.5_

  - [x] 5.6 Extract codebase analysis patterns (11-codebase-analysis)
    - Source: `src/codebase/repo-map.ts`, `src/dependency-analysis/analyzer.ts`
    - Extract patterns: repo-map.md, dependency-analyzer.md
    - _Requirements: 3.1, 3.3, 3.5_

  - [x] 5.7 Extract git and integration patterns (12-git-and-integrations)
    - Source: `src/git/workflow.ts`, `src/integrations/issue-importer.ts`, `src/integrations/xcode/`
    - Extract patterns: git-workflow.md, issue-importer.md, xcode-integration.md
    - _Requirements: 3.1, 3.3_

  - [x] 5.8 Extract type system patterns (15-type-system)
    - Source: `src/types/index.ts`
    - Extract pattern: core-types.md
    - _Requirements: 3.1, 3.3_

  - [x] 5.9 Update Nova26 INDEX.md with data/intelligence patterns
    - Append all data/intelligence patterns to the existing INDEX.md
    - _Requirements: 3.4_

- [x] 6. Checkpoint — Validate KIRO-03-03 completion
  - Ensure at least 25 total data/intelligence pattern files exist (combined with architecture patterns, total should be 50+)
  - Ensure all follow Pattern_Template
  - Ensure INDEX.md lists all patterns
  - Ask the user if questions arise.

- [x] 7. KIRO-03-04 — Build unified manifest and relationship map
  - [x] 7.1 Create UNIFIED-MANIFEST.md with pattern table
    - Scan all pattern files in both knowledge bases
    - Build a table with columns: Pattern Name, Category, Knowledge Base, File Path, Description
    - _Requirements: 4.1, 4.2_

  - [x] 7.2 Build relationship map section
    - Scan all Related Patterns sections across both knowledge bases
    - Classify each relationship as: depends_on, alternative_to, extends, or used_with
    - Document all cross-base relationships (bistrolens ↔ nova26)
    - _Requirements: 4.3, 4.4_

  - [x] 7.3 Add statistics section to manifest
    - Calculate total pattern count, count per category, count per knowledge base
    - Count cross-base relationships
    - _Requirements: 4.5_

  - [x] 7.4 Final cross-reference validation across both knowledge bases
    - Scan every pattern file in both knowledge bases
    - Verify every Related Patterns reference resolves to an existing file
    - Fix any remaining broken references
    - _Requirements: 4.6_

- [x] 8. Checkpoint — Validate KIRO-03-04 completion
  - Ensure UNIFIED-MANIFEST.md exists with all sections
  - Ensure zero broken cross-references across both knowledge bases
  - Ensure statistics match actual file counts
  - Ask the user if questions arise.

- [x] 9. Write validation script
  - [x] 9.1 Create validation script with property-based tests
    - Create `scripts/validate-patterns.ts` using `fast-check`
    - Implement tests for Properties 1–9 from the design document
    - Each test runs minimum 100 iterations
    - Tag each test with Feature and Property number
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [ ]* 9.2 Write property test for template section conformance
    - **Property 1: Template section conformance**
    - **Validates: Requirements 1.1, 2.3, 3.3**

  - [ ]* 9.3 Write property test for category folder structure
    - **Property 2: Category folder structure**
    - **Validates: Requirements 2.2, 3.2**

  - [ ]* 9.4 Write property test for cross-reference integrity
    - **Property 3: Cross-reference integrity**
    - **Validates: Requirements 1.3, 4.6**

  - [ ]* 9.5 Write property test for manifest entry completeness
    - **Property 4: Manifest entry completeness**
    - **Validates: Requirements 4.2**

  - [ ]* 9.6 Write property test for cross-base relationship coverage
    - **Property 5: Cross-base relationship coverage**
    - **Validates: Requirements 4.4**

  - [ ]* 9.7 Write property test for code block presence
    - **Property 6: Code block presence**
    - **Validates: Requirements 5.1**

  - [ ]* 9.8 Write property test for anti-pattern completeness
    - **Property 7: Anti-pattern completeness**
    - **Validates: Requirements 5.2**

  - [ ]* 9.9 Write property test for when-to-use completeness
    - **Property 8: When-to-use completeness**
    - **Validates: Requirements 5.3**

  - [ ]* 9.10 Write property test for related patterns non-empty
    - **Property 9: Related patterns non-empty**
    - **Validates: Requirements 5.4**

  - [ ]* 9.11 Write unit tests for specific examples and edge cases
    - Verify BistroLens INDEX.md lists 90 patterns
    - Verify Nova26 INDEX.md lists 50+ patterns
    - Verify UNIFIED-MANIFEST.md statistics match actual counts
    - Verify specific named patterns exist (ralph-loop.md, model-router.md, etc.)
    - Verify no pattern contains placeholder text
    - _Requirements: 1.5, 2.4, 2.5, 3.4, 3.5, 4.5_

- [x] 10. Final checkpoint — Ensure all tests pass
  - Run validation script
  - Ensure all property tests and unit tests pass
  - Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation after each KIRO phase
- The 11 BistroLens gap-fill patterns already exist — KIRO-03-01 is a quality audit, not extraction
- Nova26 patterns go in a separate `.nova/nova26-patterns/` directory to keep the two knowledge bases distinct
- Property tests validate structural correctness of all pattern files using `fast-check`
