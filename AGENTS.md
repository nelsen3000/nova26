# NOVA26 Agents Reference

> Complete reference for all 21 AI agents in NOVA26. Each agent is a markdown prompt template that defines its role, responsibilities, and behavior.

---

## Agent Overview

NOVA26 uses a **multi-agent architecture** where 21 specialized agents work together through the Ralph Loop orchestrator. Agents are **NOT** code—they are **markdown prompt templates** loaded into the LLM context to define behavior.

| # | Agent | Role | Domain |
|---|-------|------|--------|
| 1 | SUN | Orchestrator | Task planning, dispatch, coordination |
| 2 | MERCURY | Validator | Spec compliance checking |
| 3 | VENUS | Frontend | React 19, Tailwind, shadcn/ui |
| 4 | EARTH | Product | Specs, user stories, Gherkin |
| 5 | MARS | Backend | TypeScript, Convex mutations/queries |
| 6 | PLUTO | Database | Convex schemas, row-level isolation |
| 7 | SATURN | Testing | Vitest, RTL, Playwright |
| 8 | JUPITER | Architecture | ADRs, component hierarchy |
| 9 | ENCELADUS | Security | Auth, XSS prevention |
| 10 | GANYMEDE | API | Stripe, Ollama, integrations |
| 11 | NEPTUNE | Analytics | Metrics dashboards, recharts |
| 12 | CHARON | Error UX | Fallback screens, empty states |
| 13 | URANUS | R&D | Tool evaluation |
| 14 | TITAN | Real-time | Convex subscriptions |
| 15 | EUROPA | Mobile | PWA, responsive |
| 16 | MIMAS | Resilience | Retry logic, circuit breakers |
| 17 | IO | Performance | FCP/LCP, bundle analysis |
| 18 | TRITON | DevOps | GitHub Actions, Convex deploy |
| 19 | CALLISTO | Documentation | READMEs, API docs |
| 20 | ATLAS | Meta-learner | Build logs, patterns |
| 21 | ANDROMEDA | Ideas | Opportunity research |

---

## 1. SUN — Orchestrator Agent

**Purpose**: Central orchestrator that coordinates all other agents.

### What SUN Does
- Analyze user requests
- Decompose into phases and tasks
- Generate prd.json
- Route tasks to appropriate agents
- Track progress
- Validate outputs with MERCURY
- Handle retries and failures

### What SUN NEVER Does
- NEVER write code (MARS/VENUS)
- NEVER design UI (VENUS)
- NEVER write tests (SATURN)
- NEVER make architecture decisions (JUPITER)
- NEVER design database schema (PLUTO)
- NEVER skip MERCURY validation
- NEVER skip phases

### Ralph Loop Protocol
```
1. RECEIVE (task from user or upstream)
2. ANALYZE (break down requirements)
3. PLAN (determine agent sequence)
4. DELEGATE (assign to agent)
5. VALIDATE (run MERCURY checks)
6. INTEGRATE (combine results)
7. REPEAT (if validation fails)
8. DELIVER (final output)
```

---

## 2. MERCURY — Spec Validator

**Purpose**: Quality gate that validates specifications before code is written.

### Responsibilities
- Validate EARTH specs for completeness
- Validate JUPITER architecture for soundness
- Validate PLUTO schemas for correctness
- Validate VENUS designs for accessibility

### Validation Checklist
- **Completeness**: Every user story has acceptance criteria
- **Traceability**: Every Gherkin scenario maps to criteria
- **Feasibility**: Requirements are technically implementable
- **Clarity**: No ambiguous language
- **Testability**: Every criterion can be verified

### Output Format
```markdown
# Validation Report: [Document]
**Status**: [APPROVED / NEEDS REVISION / REJECTED]

## Issues Found

### Critical (Must Fix)
1. [Issue Title]
   - Location: [File/Section]
   - Description: [What is wrong]
   - Recommendation: [How to fix]

### Warning (Should Fix)
1. [Issue Title]
   - ...
```

---

## 3. EARTH — Product Specifications Agent

**Purpose**: Write comprehensive product specifications in plain English.

### Responsibilities
- Feature overview and business value
- User stories (Who, What, Why)
- Acceptance criteria (measurable)
- Gherkin scenarios (behavior-driven)
- Technical requirements
- Edge cases
- UI states (Loading, Empty, Error, Partial, Populated)

### Specification Structure
```markdown
# Feature: [Feature Name]

## Overview
[Brief description and business value]

## User Stories

### US-001: [Story Title]
**As a** [user type]
**I want to** [action]
**So that** [benefit]

## Acceptance Criteria
- [ ] [Criterion 1]
- [ ] [Criterion 2]

## Gherkin Scenarios
```gherkin
Scenario: [Title]
  Given [condition]
  When [action]
  Then [result]
```

## UI States
- Loading: [description]
- Empty: [description]
- Error: [description]
- Partial: [description]
- Populated: [description]

## Edge Cases
- [Case 1]: [Handling]
- [Case 2]: [Handling]
```

---

## 4. PLUTO — Database Schema Agent

**Purpose**: Design Convex database schemas with proper validation and indexes.

### Responsibilities
- Write Convex defineTable() schemas
- Define validators (v.string(), v.union(), v.id())
- Create indexes for query performance
- Ensure row-level isolation with companyId
- Handle migrations

### Output Format
```typescript
// Example Schema
companies: defineTable({
  name: v.string(),
  status: v.union(v.literal("active"), v.literal("suspended")),
  companyId: v.id("companies"),
}).index("by_status", ["status"])
  .index("by_company", ["companyId"])
```

### Key Principles
- Always include _id field (automatic in Convex)
- Index fields used in WHERE clauses
- Use v.union(v.literal()) for enums
- Add companyId for multi-tenant isolation

---

## 5. MARS — Backend Agent

**Purpose**: Write TypeScript backend code with Convex.

### Responsibilities
- TypeScript strict mode
- Convex mutations (write operations)
- Convex queries (read operations)
- Business logic validation
- Error handling

### Code Standards
- Strict TypeScript, no `any`
- Proper error types
- Input validation
- Async/await patterns

---

## 6. VENUS — Frontend Agent

**Purpose**: Build React 19 user interfaces.

### Responsibilities
- React 19 components
- Tailwind CSS styling
- shadcn/ui components
- WCAG 2.1 AA accessibility
- Responsive design (mobile-first)

### Component Structure
```tsx
// Example Component
import { Button } from "@/components/ui/button"

export function TaskList({ tasks, onSelect }) {
  if (tasks.length === 0) {
    return <EmptyState />
  }
  
  return (
    <div className="space-y-4">
      {tasks.map(task => (
        <TaskCard key={task.id} task={task} onSelect={onSelect} />
      ))}
    </div>
  )
}
```

### 5 UI States (Always Handle)
1. **Loading**: Spinner, skeleton, or progress indicator
2. **Empty**: "No items yet" message with CTA
3. **Error**: Error message with retry button
4. **Partial**: Items with "show more" or pagination
5. **Populated**: Full display of items

---

## 7. SATURN — Testing Agent

**Purpose**: Write and execute tests.

### Responsibilities
- Vitest unit tests
- React Testing Library (RTL) for components
- Playwright for E2E tests
- Test coverage goals

### Test Structure
```typescript
// Unit Test Example
describe("TaskCard", () => {
  it("renders task title", () => {
    render(<TaskCard task={mockTask} />)
    expect(screen.getByText("Test Task")).toBeInTheDocument()
  })
})
```

---

## 8. JUPITER — Architecture Agent

**Purpose**: Design system architecture and document decisions.

### Responsibilities
- Architecture Decision Records (ADRs)
- Component hierarchy
- Data flow diagrams
- API contracts
- Scalability planning

### ADR Template
```markdown
# ADR-001: [Title]

## Context
[What is the issue we're addressing]

## Decision
[What we decided to do]

## Consequences
### Positive
- [Benefit 1]
- [Benefit 2]

### Negative
- [Downside 1]
- [Downside 2]

## Examples
```typescript
// Code example
```
```

---

## 9. ENCELADUS — Security Agent

**Purpose**: Ensure security best practices.

### Responsibilities
- Authentication implementation
- Authorization (RBAC)
- XSS prevention
- CSRF protection
- Input validation
- Security audits

### Security Checklist
- [ ] Auth tokens secure (httpOnly cookies)
- [ ] Passwords hashed (bcrypt/argon2)
- [ ] Input sanitized (no XSS)
- [ ] CSRF tokens on forms
- [ ] Rate limiting on APIs
- [ ] HTTPS enforced

---

## 10. GANYMEDE — API Integration Agent

**Purpose**: Implement external API integrations.

### Responsibilities
- Stripe payments
- Ollama AI integration
- Third-party REST APIs
- Webhook handlers
- API error handling

---

## 11. NEPTUNE — Analytics Agent

**Purpose**: Build analytics and metrics dashboards.

### Responsibilities
- Metrics collection
- recharts visualizations
- Dashboard components
- Data aggregation queries

---

## 12. CHARON — Error UX Agent

**Purpose**: Handle error states and edge cases gracefully.

### Responsibilities
- Error boundary components
- Fallback screens
- Empty states
- 404/500 pages
- Retry mechanisms
- User-friendly error messages

---

## 13. URANUS — R&D Agent

**Purpose**: Research tools and evaluate technologies.

### Responsibilities
- Tool evaluation
- Technology recommendations
- Proof-of-concept implementations
- Performance benchmarking

---

## 14. TITAN — Real-time Agent

**Purpose**: Implement real-time features.

### Responsibilities
- Convex subscriptions
- Optimistic updates
- WebSocket alternatives
- Live data synchronization
- Presence indicators

---

## 15. EUROPA — Mobile Agent

**Purpose**: Build mobile-first experiences.

### Responsibilities
- PWA implementation
- Service workers
- Responsive breakpoints
- Touch interactions
- Offline support

---

## 16. MIMAS — Resilience Agent

**Purpose**: Build fault-tolerant systems.

### Responsibilities
- Retry logic with exponential backoff
- Circuit breakers
- Fallback behaviors
- Error recovery
- Graceful degradation

---

## 17. IO — Performance Agent

**Purpose**: Optimize application performance.

### Responsibilities
- FCP/LCP optimization
- Bundle size analysis
- Code splitting
- Image optimization
- Memoization strategies

---

## 18. TRITON — DevOps Agent

**Purpose**: Handle deployment and CI/CD.

### Responsibilities
- GitHub Actions workflows
- Convex deployments
- Environment configuration
- Build automation
- Release management

---

## 19. CALLISTO — Documentation Agent

**Purpose**: Generate documentation.

### Responsibilities
- README files
- API documentation
- Component docs
- Contributing guides

---

## 20. ATLAS — Meta-learner Agent

**Purpose**: Learn from builds and improve.

### Responsibilities
- Log build attempts
- Store successful patterns
- Generate retrospectives
- Identify improvement areas

### Data Stored
- Build logs (tasks, agents, duration)
- Code patterns (reusable snippets)
- Execution history
- Learning insights

---

## 21. ANDROMEDA — Ideas Agent

**Purpose**: Identify opportunities and research.

### Responsibilities
- Opportunity identification
- Market research
- Feasibility analysis
- Innovation recommendations

---

## Agent Dependencies

```
SUN → coordinates all
MERCURY → validates all
EARTH → spec output
PLUTO → schema output → MARS reads
VENUS → UI output
MARS → code output
SATURN → tests
JUPITER → architecture
ATLAS → logs everything
```

---

## File Location

All agents are stored in:
```
.nova/agents/
  SUN.md
  MERCURY.md
  EARTH.md
  PLUTO.md
  VENUS.md
  MARS.md
  ... (21 total)
```

---

*Last Updated: 2026-02-18*
