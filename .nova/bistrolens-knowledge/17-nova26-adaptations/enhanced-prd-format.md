# Nova26 Enhanced PRD Format

## Adapted from BistroLens Spec-Driven Development

**Source:** BistroLens `.kiro/specs/*/{requirements.md,design.md,tasks.md}`  
**Category:** Specification & Requirements  
**Priority:** P2  
**Reusability:** 9/10

---

## Overview

BistroLens uses structured specs with:
- `requirements.md` - User stories, acceptance criteria
- `design.md` - UI/UX specifications, interactions
- `tasks.md` - Implementation tasks with estimates

Nova26 PRDs are flat task lists. This enhancement adds a design phase and structured templates.

---

## Current Nova26 PRD Format (Flat)

```markdown
# PRD: Feature Name

## Agent Chain
SUN → EARTH → PLUTO → MARS → VENUS

## Tasks
- [ ] Task 1: Description
- [ ] Task 2: Description
```

## Enhanced PRD Format (Structured)

```markdown
---
prd_version: 2.0
complexity: standard|complex|research
estimated_cost: $X.XX
---

# PRD: Feature Name

## 1. Requirements Phase (EARTH)

### User Stories
```gherkin
As a [type of user]
I want [some goal]
So that [some reason]
```

### Acceptance Criteria (Given-When-Then)
```gherkin
Feature: Feature Name

  Scenario: Happy path
    Given [initial context]
    When [event/action]
    Then [expected outcome]
    And [additional outcome]

  Scenario: Error case
    Given [error context]
    When [action that triggers error]
    Then [error is handled gracefully]
    And [user sees helpful message]

  Scenario: Edge case
    Given [edge condition]
    When [action]
    Then [specific outcome]
```

### Constraints
- MUST: [non-negotiable requirement]
- SHOULD: [strong recommendation]
- MUST NOT: [prohibited behavior]

### Input/Output Specifications
| Input | Type | Validation | Required |
|-------|------|------------|----------|
| field1 | string | min: 3, max: 100 | Yes |
| field2 | number | > 0 | No |

| Output | Type | Description |
|--------|------|-------------|
| result | object | [description] |
| error | Error | [error format] |

---

## 2. Design Phase (VENUS + JUPITER) — NEW

### User Experience Flow
```
[State 1: Initial] 
    ↓ [Action: User clicks]
[State 2: Loading]
    ↓ [System: Data fetched]
[State 3: Success]
    ↓ [Action: User submits]
[State 4: Complete]
```

### UI Specifications

#### Layout
- **Container**: max-w-7xl, mx-auto, px-4
- **Grid**: 12-column, gap-6
- **Breakpoints**: mobile-first, md:, lg:, xl:

#### Components
| Component | Purpose | States | Accessibility |
|-----------|---------|--------|---------------|
| Button | Primary action | default, hover, active, disabled, loading | aria-label, keyboard |
| Input | Text entry | empty, filled, error, focused | label, aria-describedby |
| Card | Content container | default, hover, selected | role="article" |

#### Visual Design
- **Colors**: [reference design system]
- **Typography**: Inter, sizes from design system
- **Spacing**: 4px base unit, multiples of 4
- **Shadows**: [elevation levels]
- **Border radius**: [component-specific]

#### Interactions
| Trigger | Animation | Duration | Easing |
|---------|-----------|----------|--------|
| Hover | scale(1.02), shadow increase | 200ms | ease-out |
| Click | ripple effect | 300ms | ease-in-out |
| Loading | skeleton shimmer | infinite | linear |

### API Design (GANYMEDE input)
```typescript
// Types
interface FeatureRequest {
  field1: string;
  field2?: number;
}

interface FeatureResponse {
  id: string;
  result: ResultType;
  createdAt: number;
}

// Convex functions
export const featureAction = mutation({
  args: { /* validator */ },
  returns: v.id("features"),
});

export const featureQuery = query({
  args: { id: v.id("features") },
  returns: v.union(FeatureResponse, null),
});
```

### Error States
| Scenario | UI State | Message | Recovery |
|----------|----------|---------|----------|
| Network error | Retry button | "Connection lost. Try again?" | Auto-retry 3x |
| Validation | Inline error | Field-specific | Fix and resubmit |
| Server error | Error boundary | "Something went wrong" | Report + refresh |

---

## 3. Architecture Decisions (JUPITER) — NEW

### ADR-XXX: [Decision Title]
**Status**: Proposed | Accepted | Deprecated

**Context**: [What is the issue we're deciding?]

**Decision**: [What we decided to do]

**Consequences**:
- Positive: [benefits]
- Negative: [trade-offs]
- Neutral: [observations]

**Alternatives Considered**:
1. [Option A] - rejected because...
2. [Option B] - rejected because...

---

## 4. Implementation Tasks (Ralph Loop)

### Phase 1: Foundation (SUN → PLUTO → MARS)
- [ ] SUN: Create PRD (est: 30 min)
  - Output: `.nova/specs/[feature]-prd.md`
- [ ] PLUTO: Design schema (est: 20 min)
  - Output: `convex/schema.ts` updates
  - Depends on: SUN
- [ ] MARS: Type definitions (est: 20 min)
  - Output: `src/types/[feature].ts`
  - Depends on: PLUTO

### Phase 2: Backend (GANYMEDE + TITAN)
- [ ] GANYMEDE: API implementation (est: 40 min)
  - Output: `convex/[feature].ts`
  - Depends on: MARS
- [ ] TITAN: Realtime subscriptions (est: 20 min)
  - Output: Subscription queries
  - Depends on: GANYMEDE

### Phase 3: Frontend (VENUS + EUROPA)
- [ ] VENUS: Component implementation (est: 60 min)
  - Output: `src/components/[Feature]/`
  - Depends on: MARS
  - Acceptance: All 5 UI states implemented
- [ ] EUROPA: Responsive behavior (est: 20 min)
  - Output: Mobile/tablet adaptations
  - Depends on: VENUS

### Phase 4: Quality (SATURN + MERCURY)
- [ ] SATURN: Unit tests (est: 40 min)
  - Output: `**/*.test.ts`
  - Coverage: >80%
- [ ] MERCURY: Validation gate (est: 10 min)
  - All gates must pass

### Phase 5: Polish (CHARON + ATLAS)
- [ ] CHARON: Error handling (est: 20 min)
  - All error states implemented
- [ ] ATLAS: Analytics (est: 10 min)
  - Events tracked

---

## 5. Testing Strategy (SATURN)

### Test Coverage Requirements
| Level | Minimum | Target |
|-------|---------|--------|
| Unit | 70% | 80% |
| Integration | 60% | 75% |
| E2E | Critical paths | All user flows |

### Test Scenarios
- [ ] Happy path: [describe]
- [ ] Error handling: [describe]
- [ ] Edge cases: [describe]
- [ ] Accessibility: [WCAG AA]
- [ ] Performance: [load time < X]

---

## 6. Rollback Plan (MIMAS)

### Checkpoint Before
- [ ] Database backup
- [ ] Previous version tagged

### Rollback Trigger
- [ ] Error rate > 5%
- [ ] Critical functionality broken
- [ ] Performance degraded > 50%

### Rollback Steps
1. Revert code to tag `vX.Y.Z`
2. Run down migration
3. Verify system health
4. Post-mortem within 24h

---

## Agent Chain
```
SUN (create PRD)
  ↓
EARTH (requirements) → JUPITER (ADR if needed)
  ↓
PLUTO (schema) → MERCURY (validate)
  ↓
MARS (types) + GANYMEDE (API) + TITAN (realtime)
  ↓
VENUS (UI) + EUROPA (responsive)
  ↓
SATURN (tests) + CHARON (errors) + ENCELADUS (security)
  ↓
MIMAS (resilience) + ATLAS (analytics) + TRITON (deploy)
```

---

## Success Criteria
- [ ] All acceptance criteria pass
- [ ] Code quality score > 70
- [ ] Test coverage > 80%
- [ ] Performance budget met
- [ ] Accessibility audit passed
- [ ] Cost within budget

---

*Generated by Nova26 SUN agent*
*PRD Version 2.0*
```

---

## Migration from v1 to v2

### For Existing PRDs
1. Add YAML front matter
2. Split flat task list into phases
3. Add acceptance criteria in Gherkin format
4. Add design section (retroactively)
5. Add ADR section for architectural decisions

### For New PRDs
Use the template above. The Ralph Loop should:
1. Parse PRD v2 format
2. Execute phase by phase
3. Update task status
4. Track progress

---

## Files to Modify

| File | Changes |
|------|---------|
| `.nova/templates/prd-v2.md` | New template file |
| `src/agents/sun-prd-generator.ts` | Update to generate v2 format |
| `src/orchestrator/ralph-loop.ts` | Parse v2 format, execute phases |
| `.nova/agents/EARTH.md` | Update to handle requirements section |
| `.nova/agents/VENUS.md` | Update to read design section |

---

*Adapted from BistroLens spec-driven development*
*For Nova26 enhanced PRD format*
