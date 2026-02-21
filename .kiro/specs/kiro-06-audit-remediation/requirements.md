# Requirements Document

## Introduction

KIRO-06 is the audit remediation sprint following the KIRO-04 structural audit. The KIRO-04 audit identified 87 failures across the Nova26 and BistroLens knowledge bases: 49 missing entries in the Nova26 INDEX.md, 28 missing sections across 7 intelligence pattern files, 11 BistroLens hook files using camelCase instead of kebab-case, and stale file references in AI_COORDINATION.md. This sprint remediates all 87 failures, extracts agent template patterns from the 21 EARTH XML agent files, builds an agent interaction graph, and re-runs the structural audit to verify zero remaining failures. All outputs are markdown and JSON files under `.nova/` — no TypeScript modifications.

## Glossary

- **INDEX_File**: The `INDEX.md` file in `.nova/nova26-patterns/` that catalogs all Nova26 patterns by category
- **Pattern_File**: A markdown file documenting a single reusable pattern following the required 8-section template
- **Required_Sections**: The 8 mandatory sections in every Pattern_File: Title (H1), Problem/Overview, Solution/Pattern, Example/Usage, Anti-Pattern, Source, When to Use, Benefits
- **Intelligence_Pattern**: A Pattern_File in the `.nova/nova26-patterns/02-intelligence/` directory
- **Hook_Pattern**: A Pattern_File in `.nova/bistrolens-knowledge/09-hooks/` documenting a React hook
- **Kebab_Case**: Lowercase words separated by hyphens (e.g., `use-auth.md`), the required naming convention for all Pattern_Files
- **CamelCase**: Words joined with capital letters (e.g., `useAuth.md`), the current non-compliant naming of Hook_Patterns
- **Agent_Template**: A markdown file in `.nova/agents/` defining an agent's role, constraints, inputs, outputs, and behavior using EARTH XML format
- **EARTH_XML_Format**: The standardized XML structure in Agent_Templates containing `agent_profile`, `principles`, `constraints`, `input_requirements`, `output_format`, and `self_check` elements
- **Agent_Pattern_File**: A Pattern_File in `.nova/nova26-knowledge/agents/` extracted from an Agent_Template
- **Interaction_Graph**: A directed graph where nodes represent agents and edges represent data flows parsed from `input_requirements` and `output_format` sections
- **Stale_Reference**: A file path or identifier in a documentation file that does not resolve to an existing file on disk
- **Structural_Audit**: The verification process that checks INDEX completeness, section presence, filename conventions, and reference validity across all knowledge bases
- **Remediation_Agent**: The process that reads, fixes, and writes `.nova/` markdown and JSON files to resolve audit failures

## Requirements

### Requirement 1: INDEX.md Gap Remediation

**User Story:** As a knowledge base maintainer, I want the Nova26 INDEX.md to list all 51 patterns on disk, so that the index is a complete and accurate catalog.

#### Acceptance Criteria

1. WHEN the Remediation_Agent scans all subdirectories of `.nova/nova26-patterns/`, THE Remediation_Agent SHALL enumerate every `.md` Pattern_File (excluding INDEX.md, EXTRACTION-TASK-LIST.md, and .gitkeep)
2. WHEN the Remediation_Agent compares the enumerated Pattern_Files against the INDEX_File entries, THE Remediation_Agent SHALL identify every Pattern_File not listed in the INDEX_File
3. WHEN missing Pattern_Files are identified, THE Remediation_Agent SHALL add an entry for each to the appropriate category table in the INDEX_File with pattern name, relative file path, and description
4. WHEN the INDEX_File is updated, THE Remediation_Agent SHALL update the summary count table so that each category count matches the actual file count on disk
5. WHEN the INDEX_File update is complete, THE Remediation_Agent SHALL verify that the total pattern count in the INDEX_File equals the total `.md` Pattern_File count on disk

### Requirement 2: Intelligence Pattern Section Remediation

**User Story:** As a knowledge base maintainer, I want all 7 intelligence pattern files to contain all required sections, so that patterns are structurally consistent and complete.

#### Acceptance Criteria

1. WHEN the Remediation_Agent reads an Intelligence_Pattern file, THE Remediation_Agent SHALL check for the presence of all Required_Sections
2. WHEN an Intelligence_Pattern file is missing one or more Required_Sections, THE Remediation_Agent SHALL add the missing sections with accurate content derived from the corresponding source code referenced in the Source section
3. WHEN sections are added to an Intelligence_Pattern file, THE Remediation_Agent SHALL preserve all existing content and section ordering
4. WHEN all 7 Intelligence_Pattern files have been remediated, THE Remediation_Agent SHALL verify that each file contains all 8 Required_Sections

### Requirement 3: BistroLens Hook Filename Remediation

**User Story:** As a knowledge base maintainer, I want all BistroLens hook pattern files to use kebab-case filenames, so that naming conventions are consistent across the knowledge base.

#### Acceptance Criteria

1. WHEN the Remediation_Agent scans `.nova/bistrolens-knowledge/09-hooks/`, THE Remediation_Agent SHALL identify all files using CamelCase naming
2. WHEN a CamelCase file is identified, THE Remediation_Agent SHALL rename the file to its Kebab_Case equivalent (e.g., `useAuth.md` → `use-auth.md`)
3. WHEN a Hook_Pattern file is renamed, THE Remediation_Agent SHALL search all Pattern_Files and INDEX files in `.nova/bistrolens-knowledge/` for references to the old filename and update them to the new filename
4. WHEN all 11 Hook_Pattern files have been renamed, THE Remediation_Agent SHALL verify that zero CamelCase `.md` files remain in the `09-hooks/` directory

### Requirement 4: Stale Reference Remediation

**User Story:** As a knowledge base maintainer, I want all file references in AI_COORDINATION.md to resolve to existing files, so that documentation remains accurate and trustworthy.

#### Acceptance Criteria

1. WHEN the Remediation_Agent reads `.nova/AI_COORDINATION.md`, THE Remediation_Agent SHALL identify all file path references in the document
2. WHEN a Stale_Reference is found (a referenced file path that does not exist on disk), THE Remediation_Agent SHALL search the codebase for the correct replacement file
3. WHEN a replacement file is identified, THE Remediation_Agent SHALL update the Stale_Reference to point to the correct file path
4. WHEN the Remediation_Agent completes scanning AI_COORDINATION.md, THE Remediation_Agent SHALL report the total count of stale references found and fixed

### Requirement 5: Agent Template Pattern Extraction

**User Story:** As a knowledge base maintainer, I want a pattern file extracted from each of the 21 agent templates, so that agent behaviors are documented as discoverable patterns in the knowledge base.

#### Acceptance Criteria

1. WHEN the Remediation_Agent reads an Agent_Template, THE Remediation_Agent SHALL extract the role and domain from the `agent_profile` element
2. WHEN the Remediation_Agent reads an Agent_Template, THE Remediation_Agent SHALL extract constraints from the `constraints` element
3. WHEN the Remediation_Agent reads an Agent_Template, THE Remediation_Agent SHALL extract input/output flows from the `input_requirements` and `output_format` elements
4. WHEN the Remediation_Agent reads an Agent_Template, THE Remediation_Agent SHALL extract quality criteria from the `self_check` element if present
5. WHEN extraction is complete for an Agent_Template, THE Remediation_Agent SHALL create an Agent_Pattern_File in `.nova/nova26-knowledge/agents/` using the standard pattern template (Problem → Solution → Example → Anti-Pattern → Source → When to Use → Benefits)
6. WHEN all 21 Agent_Templates have been processed, THE Remediation_Agent SHALL verify that exactly 21 Agent_Pattern_Files exist in `.nova/nova26-knowledge/agents/`

### Requirement 6: Agent Interaction Graph

**User Story:** As a knowledge base maintainer, I want a directed graph of agent data flows, so that I can understand inter-agent dependencies and identify hub agents.

#### Acceptance Criteria

1. WHEN the Remediation_Agent parses all 21 Agent_Templates, THE Remediation_Agent SHALL extract all `input_requirements` and `output_format`/`handoff` relationships
2. WHEN relationships are extracted, THE Remediation_Agent SHALL build a directed graph with 21 agent nodes and edges representing data flows between agents
3. WHEN building edges, THE Remediation_Agent SHALL include a label on each edge describing the data type that flows between agents
4. THE Remediation_Agent SHALL output the Interaction_Graph as `.nova/nova26-knowledge/agent-interaction-graph.json` with `nodes` and `edges` arrays
5. THE Remediation_Agent SHALL output `.nova/nova26-knowledge/agent-interaction-graph.md` containing an ASCII visualization of the graph, a table of all edges (from → to → data type), and a hub analysis ranking agents by total connection count

### Requirement 7: Verification Audit

**User Story:** As a knowledge base maintainer, I want to re-run the structural audit after all remediations, so that I can confirm zero remaining failures.

#### Acceptance Criteria

1. WHEN all remediations (Requirements 1–4) are complete, THE Remediation_Agent SHALL re-run the Structural_Audit checks: INDEX completeness, section presence, filename conventions, and reference validity
2. WHEN the Structural_Audit completes, THE Remediation_Agent SHALL output a verification report to `.nova/audit-reports/kiro-06-verification.md`
3. WHEN the verification report is generated, THE Remediation_Agent SHALL include a summary table showing failure count per check category with a target of zero failures
4. IF any failures remain after remediation, THEN THE Remediation_Agent SHALL document each remaining failure with a remediation note explaining why it persists and what action is needed
