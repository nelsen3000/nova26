# Requirements Document

## Introduction

KIRO-04 is the audit phase following the comprehensive pattern extraction (KIRO-03). It validates the quality, completeness, and structural integrity of the 140 extracted patterns across both knowledge bases (BistroLens: 89 patterns in 16 categories, Nova26: 51 patterns in 15 categories), the ~20 markdown documentation files in `.nova/`, and the cross-module dependency relationships. The audit produces gap-fill patterns, a structural pass/fail matrix, documentation accuracy scores, and a cross-module dependency graph.

## Glossary

- **Knowledge_Base**: A collection of categorized pattern files stored under `.nova/bistrolens-knowledge/` or `.nova/nova26-patterns/`
- **Module**: A numbered category folder within a knowledge base (e.g., `01-convex-patterns/`, `02-agent-system/`)
- **Pattern_File**: A markdown file documenting a single reusable code pattern, following the Pattern_Template
- **Pattern_Template**: The standard structure for pattern files: Source, Pattern description, Implementation (Code Examples), Anti-Patterns, When to Use, Benefits, Related Patterns
- **INDEX_File**: The `INDEX.md` file in each knowledge base root that catalogs all patterns
- **Unified_Manifest**: The `UNIFIED-MANIFEST.md` file at `.nova/` root that catalogs patterns across both knowledge bases
- **Pass_Fail_Matrix**: A table scoring each module against structural consistency criteria
- **Dependency_Graph**: A JSON structure mapping cross-references between patterns across modules
- **Audit_Scanner**: The analysis process that reads pattern files and documentation to produce audit reports
- **Gap_Pattern**: A pattern identified as missing during the audit that should be extracted and documented

## Requirements

### Requirement 1: Gap Pattern Extraction

**User Story:** As a knowledge base maintainer, I want to identify and extract missing patterns from all modules, so that the knowledge bases have comprehensive coverage.

#### Acceptance Criteria

1. WHEN the Audit_Scanner analyzes a Module, THE Audit_Scanner SHALL compare the existing Pattern_Files against the source code and related patterns to identify gaps
2. WHEN a Gap_Pattern is identified, THE Audit_Scanner SHALL create a new Pattern_File following the Pattern_Template
3. WHEN new Pattern_Files are created, THE Audit_Scanner SHALL update the corresponding INDEX_File with entries for each new pattern
4. WHEN new Pattern_Files are created, THE Audit_Scanner SHALL update the Unified_Manifest with entries for each new pattern
5. THE Audit_Scanner SHALL produce a summary report listing all Gap_Patterns found per Module with pattern name and file path

### Requirement 2: Structural Consistency Audit

**User Story:** As a knowledge base maintainer, I want to verify that all modules follow consistent structural conventions, so that patterns are uniformly discoverable and readable.

#### Acceptance Criteria

1. WHEN the Audit_Scanner audits a Pattern_File, THE Audit_Scanner SHALL verify the presence of all Pattern_Template sections: Source, Pattern description, Implementation with Code Examples, Anti-Patterns, When to Use, Benefits, Related Patterns
2. WHEN the Audit_Scanner audits a Module, THE Audit_Scanner SHALL verify that the INDEX_File lists every Pattern_File in that Module
3. WHEN the Audit_Scanner audits a Module, THE Audit_Scanner SHALL verify consistent file naming using lowercase-kebab-case with `.md` extension
4. WHEN the Audit_Scanner completes all Module audits, THE Audit_Scanner SHALL produce a Pass_Fail_Matrix with one row per Module and one column per structural criterion
5. IF a Pattern_File is missing a required section, THEN THE Audit_Scanner SHALL record a failure for that Module and criterion in the Pass_Fail_Matrix
6. THE Pass_Fail_Matrix SHALL include a summary row with total pass count and total fail count per criterion

### Requirement 3: Documentation Accuracy Validation

**User Story:** As a knowledge base maintainer, I want to validate that documentation files contain accurate references and counts, so that documentation remains trustworthy.

#### Acceptance Criteria

1. WHEN the Audit_Scanner validates a documentation file, THE Audit_Scanner SHALL check that every referenced file path resolves to an existing file
2. WHEN the Audit_Scanner validates a documentation file, THE Audit_Scanner SHALL check that stated pattern counts match actual file counts in the referenced directories
3. WHEN the Audit_Scanner validates a documentation file, THE Audit_Scanner SHALL check that cross-references to other documentation files resolve correctly
4. WHEN the Audit_Scanner finds a stale reference, THE Audit_Scanner SHALL record the file path, line number, and the broken reference text
5. WHEN the Audit_Scanner completes validation of all documentation files, THE Audit_Scanner SHALL produce an accuracy score per file as the ratio of valid references to total references
6. THE Audit_Scanner SHALL produce a consolidated stale references report listing all broken references across all documentation files

### Requirement 4: Cross-Module Dependency Mapping

**User Story:** As a knowledge base maintainer, I want to understand how patterns reference each other across modules, so that I can identify isolated patterns, circular dependencies, and high-value hub patterns.

#### Acceptance Criteria

1. WHEN the Audit_Scanner scans a Pattern_File, THE Audit_Scanner SHALL extract all references from the Related Patterns section
2. WHEN the Audit_Scanner builds the Dependency_Graph, THE Audit_Scanner SHALL represent each pattern as a node and each reference as a directed edge
3. WHEN the Dependency_Graph is complete, THE Audit_Scanner SHALL identify island nodes with zero incoming and zero outgoing edges
4. WHEN the Dependency_Graph is complete, THE Audit_Scanner SHALL detect circular reference cycles of any length
5. WHEN the Dependency_Graph is complete, THE Audit_Scanner SHALL rank patterns by in-degree to identify the most-referenced hub patterns
6. THE Audit_Scanner SHALL output the Dependency_Graph as a JSON file with nodes and edges arrays
7. THE Audit_Scanner SHALL output an ASCII visualization of the Dependency_Graph showing modules as groups and edges between them
