# Requirements Document

## Introduction

This spec covers a comprehensive pattern extraction effort across four phases (KIRO-03-01 through KIRO-03-04). Phase 1 fills 11 missing BistroLens patterns identified as broken cross-references during validation of the original 79-pattern extraction. Phases 2 and 3 extract 50+ new patterns from the Nova26 core architecture and data/intelligence layers. Phase 4 produces a unified manifest and relationship map that catalogs all patterns (original 79 + new 11 + ~50 Nova26 patterns).

## Glossary

- **Pattern_File**: A markdown document following the standard pattern template (Source, Code Examples, Anti-Patterns, When to Use, Benefits, Related Patterns sections)
- **Extractor**: The agent or process responsible for reading source code and producing Pattern_Files
- **Knowledge_Base**: The `.nova/bistrolens-knowledge/` directory containing all extracted BistroLens patterns organized in numbered category folders (01–16)
- **Nova26_Knowledge_Base**: The `.nova/nova26-patterns/` directory containing all extracted Nova26 architecture and intelligence patterns
- **Manifest**: A single markdown document listing every pattern across both knowledge bases with metadata (name, category, source, description)
- **Relationship_Map**: A section within the Manifest that documents how patterns connect to each other (dependencies, alternatives, compositions)
- **Cross_Reference**: A link in a pattern's "Related Patterns" section pointing to another pattern file
- **Source_Directory**: A directory in the Nova26 `src/` tree from which patterns are extracted
- **Pattern_Template**: The standard markdown structure every Pattern_File must follow (defined in the original extraction design)

## Requirements

### Requirement 1: Validate and Quality-Check the 11 Previously-Missing BistroLens Patterns (KIRO-03-01)

**User Story:** As a Nova26 developer, I want the 11 previously-missing BistroLens patterns validated for quality and cross-reference integrity, so that the Knowledge_Base is complete and all references resolve correctly.

#### Acceptance Criteria

1. WHEN the Extractor audits the 11 patterns (`rate-limiting.md`, `soft-delete-pattern.md`, `useAuthWithRecaptcha.md`, `convex-file-storage.md`, `resilience-patterns.md`, `useSwipeGesture.md`, `useTierGates.md`, `useFreemium.md`, `subscription-service.md`, `optimistic-mutation-pattern.md`, and one additional pattern), THE Extractor SHALL verify each Pattern_File conforms to the Pattern_Template with all required sections: Source, Code Examples (at least one TypeScript/TSX block), Anti-Patterns or When to Use, Benefits, and Related Patterns
2. IF a Pattern_File is missing required sections or contains placeholder content, THEN THE Extractor SHALL update the file to meet the Pattern_Template standard
3. WHEN all 11 patterns are validated, THE Extractor SHALL verify that every Cross_Reference in the full Knowledge_Base (all 90 patterns) resolves to a valid file
4. IF a Cross_Reference points to a non-existent file, THEN THE Extractor SHALL either create the missing pattern or update the referring pattern to remove the broken reference
5. WHEN validation is complete, THE Extractor SHALL update the INDEX.md to include all 90 patterns

### Requirement 2: Extract Nova26 Core Architecture Patterns (KIRO-03-02)

**User Story:** As a Nova26 developer, I want patterns documenting the core architecture extracted from the orchestrator, agents, CLI, gates, retry, sandbox, swarm, templates, browser, IDE, and preview modules, so that the team has a reusable reference for Nova26's architecture.

#### Acceptance Criteria

1. WHEN the Extractor processes the Nova26 Source_Directories (`src/orchestrator/`, `src/agents/`, `src/skills/`, `src/cli/`, `src/gates/`, `src/retry/`, `src/sandbox/`, `src/swarm/`, `src/templates/`, `src/browser/`, `src/ide/`, `src/preview/`), THE Extractor SHALL produce at least 25 Pattern_Files documenting core architecture patterns
2. THE Extractor SHALL place all Nova26 architecture patterns in the Nova26_Knowledge_Base directory organized into numbered category folders
3. WHEN a Pattern_File is created, THE Pattern_File SHALL conform to the Pattern_Template with all required sections: Source, Code Examples (at least one TypeScript block), Anti-Patterns or When to Use, Benefits, and Related Patterns
4. THE Extractor SHALL create an INDEX.md file in the Nova26_Knowledge_Base listing all extracted architecture patterns with name, category, and description
5. WHEN extracting patterns, THE Extractor SHALL document the Ralph Loop orchestration cycle, agent loading and dispatch, quality gates, parallel execution, and CLI command routing as distinct patterns

### Requirement 3: Extract Nova26 Data and Intelligence Patterns (KIRO-03-03)

**User Story:** As a Nova26 developer, I want patterns documenting the data and intelligence layer extracted from the LLM, memory, persistence, security, observability, cost, codebase analysis, dependency analysis, git, integrations, and types modules, so that the team has a reusable reference for Nova26's data and intelligence infrastructure.

#### Acceptance Criteria

1. WHEN the Extractor processes the Nova26 Source_Directories (`src/llm/`, `src/memory/`, `src/persistence/`, `src/security/`, `src/observability/`, `src/cost/`, `src/codebase/`, `src/dependency-analysis/`, `src/git/`, `src/integrations/`, `src/types/`), THE Extractor SHALL produce at least 25 Pattern_Files documenting data and intelligence patterns
2. THE Extractor SHALL place all Nova26 data/intelligence patterns in the Nova26_Knowledge_Base directory in appropriately numbered category folders
3. WHEN a Pattern_File is created, THE Pattern_File SHALL conform to the Pattern_Template with all required sections: Source, Code Examples (at least one TypeScript block), Anti-Patterns or When to Use, Benefits, and Related Patterns
4. THE Extractor SHALL append the data/intelligence patterns to the INDEX.md file in the Nova26_Knowledge_Base
5. WHEN extracting patterns, THE Extractor SHALL document the model routing strategy, structured output parsing, response caching, session memory, checkpoint persistence, security scanning, cost tracking, and observability tracing as distinct patterns

### Requirement 4: Unified Manifest and Relationship Map (KIRO-03-04)

**User Story:** As a Nova26 developer, I want a single manifest listing every pattern across both knowledge bases with a relationship map, so that I can discover patterns and understand how they connect.

#### Acceptance Criteria

1. THE Extractor SHALL create a `UNIFIED-MANIFEST.md` file in `.nova/` that lists every pattern from the Knowledge_Base (79 original + 11 new) and the Nova26_Knowledge_Base (50+ patterns)
2. WHEN listing a pattern in the Manifest, THE Manifest SHALL include the pattern name, category, source knowledge base, relative file path, and a one-line description
3. THE Manifest SHALL include a Relationship_Map section documenting connections between patterns using categories: "depends on", "alternative to", "extends", and "used with"
4. WHEN a pattern in the Knowledge_Base references a pattern in the Nova26_Knowledge_Base (or vice versa), THE Manifest SHALL document that cross-base relationship
5. THE Manifest SHALL include a statistics section showing total pattern count, count per category, count per knowledge base, and count of cross-base relationships
6. WHEN all patterns are cataloged, THE Extractor SHALL verify that every Cross_Reference across both knowledge bases resolves to a valid file

### Requirement 5: Pattern Quality and Consistency

**User Story:** As a Nova26 developer, I want all patterns to meet consistent quality standards, so that the knowledge base is reliable and useful.

#### Acceptance Criteria

1. THE Extractor SHALL ensure every Pattern_File contains at least one complete, syntactically valid TypeScript or TSX code block with proper imports and type annotations
2. WHEN a Pattern_File includes an Anti-Patterns section, THE Pattern_File SHALL provide both a "Don't Do This" example and a "Do This Instead" example
3. THE Extractor SHALL ensure every Pattern_File includes a "When to Use" section with at least two "Use for" scenarios and at least one "Don't use for" scenario
4. THE Extractor SHALL ensure every Pattern_File includes a Related Patterns section with at least one cross-reference to another pattern
5. IF a pattern references external dependencies or APIs, THEN THE Pattern_File SHALL document the dependency name and version constraint
