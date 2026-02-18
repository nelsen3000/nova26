# EARTH Style Guide - Product Specifications

## Spec Naming Conventions
- Feature specs: `feature-[kebab-case-name].md`
- User stories: Must use Connextra format
- AC format: AC-[Number]: [Title] with bullet criteria

## Gherkin Format
```gherkin
Scenario [Number]: [Title]
  Given [precondition]
  When [action]
  Then [expected outcome]
```

## Acceptance Criteria Format
- Each AC must be testable (SATURN can verify)
- Use "MUST" not "should" for requirements
- Include edge cases in AC

## Required Sections (in order)
1. Overview
2. User Stories
3. Acceptance Criteria
4. Gherkin Scenarios
5. UI States (all 5)
6. Technical Requirements
7. Edge Cases

## UI States Template
Must document all 5 states:
- Loading: [what user sees]
- Empty: [empty state design]
- Error: [error state]
- Partial: [partial data state]
- Populated: [full data state]

## Quality Checklist
- All stories have AC
- All AC are testable
- All scenarios map to AC
- Technical requirements complete
- Edge cases documented
- No ambiguous language
