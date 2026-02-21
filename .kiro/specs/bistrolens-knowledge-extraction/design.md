# BistroLens Knowledge Extraction - Design

## Architecture

### Directory Structure

```
.nova/bistrolens-knowledge/
├── 01-convex-patterns/          (8 patterns) ✅ COMPLETE
├── 02-react-patterns/           (6 patterns)
├── 03-auth-patterns/            (5 patterns) 🔄 1/5 complete
├── 04-ui-components/            (8 patterns)
├── 05-form-patterns/            (5 patterns)
├── 06-data-fetching/            (4 patterns)
├── 07-error-handling/           (4 patterns)
├── 08-testing-patterns/         (5 patterns)
├── 09-hooks/                    (6 patterns)
├── 10-utilities/                (5 patterns)
├── 11-validation/               (4 patterns)
├── 12-routing/                  (3 patterns)
├── 13-state-management/         (4 patterns)
├── 14-performance/              (4 patterns)
├── 15-accessibility/            (4 patterns)
├── 16-deployment/               (3 patterns)
├── EXTRACTION-TASK-LIST.md      (master tracking)
└── INDEX.md                     (final deliverable)
```

### Pattern File Template

```markdown
# Pattern Name

## Source
Extracted from BistroLens `[file path]`

---

## Pattern: [Pattern Name]

[Description]

---

## [Section 1]

### Code Example

```typescript
// Full working code with types
```

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// Bad example
```

### ✅ Do This Instead

```typescript
// Good example
```

---

## When to Use This Pattern

✅ **Use for:**
- Scenario 1
- Scenario 2

❌ **Don't use for:**
- Scenario 3

---

## Benefits

1. Benefit 1
2. Benefit 2
3. Benefit 3

---

## Related Patterns

- See `other-pattern.md` for related concept

---

*Extracted: 2026-02-18*
```

## Extraction Strategy

### Batch 1: Auth & Data (14 patterns)
**Priority:** HIGH - Foundation patterns
**Source Files:**
- `39-AUTHENTICATION-AUTHORIZATION.md`
- `38-CONVEX-DATABASE-PATTERNS.md`

**Patterns:**
1. ✅ auth-helpers.md
2. session-management.md
3. rbac-implementation.md
4. subscription-enforcement.md
5. age-verification.md
6. usequery-patterns.md
7. usemutation-patterns.md
8. pagination-patterns.md
9. caching-strategies.md

### Batch 2: UI & Components (17 patterns)
**Priority:** HIGH - User-facing patterns
**Source Files:**
- `components/ui/` directory
- `34-BRAND-VOICE-UX.md`

**Patterns:**
1. button-variants.md
2. form-components.md
3. modal-dialog.md
4. toast-notifications.md
5. loading-states.md
6. empty-states.md
7. error-states.md
8. card-layouts.md
9. form-validation.md
10. form-submission.md
11. multi-step-forms.md
12. file-upload-forms.md
13. dynamic-fields.md
14. error-boundaries.md
15. error-messages.md
16. retry-logic.md
17. error-logging.md

### Batch 3: Hooks & Utilities (15 patterns)
**Priority:** MEDIUM - Reusable logic
**Source Files:**
- `hooks/` directory
- `utils/` directory
- `lib/` directory

**Patterns:**
1. useAuth.md
2. useSubscription.md
3. useToast.md
4. useLocalStorage.md
5. useDebounce.md
6. useMediaQuery.md
7. date-formatting.md
8. string-utilities.md
9. number-formatting.md
10. validation-helpers.md
11. array-utilities.md
12. convex-validators.md
13. client-validation.md
14. schema-validation.md
15. business-rules.md

### Batch 4: Architecture & Performance (14 patterns)
**Priority:** MEDIUM - Optimization patterns
**Source Files:**
- `components/` directory
- `vite.config.ts`

**Patterns:**
1. component-structure.md
2. state-management.md
3. effect-patterns.md
4. memo-optimization.md
5. error-boundaries.md
6. suspense-patterns.md
7. context-patterns.md
8. global-state.md
9. local-state.md
10. state-persistence.md
11. code-splitting.md
12. image-optimization.md
13. bundle-optimization.md
14. render-optimization.md

### Batch 5: Quality & Deployment (15 patterns)
**Priority:** LOW - Process patterns
**Source Files:**
- `.kiro/testing/` directory
- `49-DEPLOYMENT-RELEASE-PROCESS.md`
- `50-ACCESSIBILITY-WCAG-COMPLIANCE.md`

**Patterns:**
1. unit-testing.md
2. component-testing.md
3. integration-testing.md
4. e2e-testing.md
5. test-utilities.md
6. route-structure.md
7. navigation-patterns.md
8. protected-routes.md
9. aria-patterns.md
10. keyboard-navigation.md
11. screen-reader.md
12. wcag-compliance.md
13. build-process.md
14. deployment-config.md
15. release-checklist.md

## Implementation Details

### Code Extraction Rules

1. **Find actual code** - Search BistroLens codebase for real implementations
2. **Include full context** - Show imports, types, and complete functions
3. **Add comments** - Explain complex logic inline
4. **Show variations** - Include multiple approaches when applicable
5. **Document edge cases** - Note special handling requirements

### Anti-Pattern Documentation

For each pattern, document:
- ❌ Common mistakes
- Why they're problematic
- ✅ Correct alternatives
- Performance/security implications

### Cross-References

Link related patterns:
- "See X for related concept"
- "Alternative approach in Y"
- "Used together with Z"

## Quality Gates

### Pattern File Checklist

- [ ] Source reference included
- [ ] At least 2 code examples
- [ ] Anti-patterns documented
- [ ] "When to Use" section complete
- [ ] "Benefits" section complete
- [ ] Related patterns linked
- [ ] TypeScript types included
- [ ] No placeholder code

### Batch Completion Criteria

- [ ] All patterns in batch extracted
- [ ] Code examples tested for syntax
- [ ] Cross-references added
- [ ] Progress tracking updated

## Final Deliverable: INDEX.md

### Structure

```markdown
# BistroLens Knowledge Base Index

## Overview
75+ patterns extracted from BistroLens

## Categories

### 01. Convex Patterns (8)
- [Schema Conventions](01-convex-patterns/schema-conventions.md)
- [Query Patterns](01-convex-patterns/query-patterns.md)
- ...

### 02. React Patterns (6)
- ...

## Quick Reference

### Most Used Patterns
1. Auth Helpers
2. Query Patterns
3. Mutation Patterns
4. Form Validation
5. Error Handling

### By Use Case

**Building a new feature:**
1. Schema conventions
2. Auth helpers
3. Queries/mutations
4. UI components
5. Error handling

**Optimizing performance:**
1. Query optimization
2. Memo patterns
3. Code splitting
4. Image optimization
```

## Progress Tracking

- ✅ Batch 1: Auth & Data (9/14 complete - 64%)
- 🔲 Batch 2: UI & Components (0/17)
- 🔲 Batch 3: Hooks & Utilities (0/15)
- 🔲 Batch 4: Architecture & Performance (0/14)
- 🔲 Batch 5: Quality & Deployment (0/15)
- 🔲 INDEX.md creation

**Total Progress: 9/75 patterns (12%)**

---

*Created: 2026-02-18*
