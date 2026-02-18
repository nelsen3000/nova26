# Nova26 Adaptations from BistroLens

**Phase 5: BistroLens Knowledge Extraction → Nova26 Adaptation**
**Date:** 2026-02-18
**Agent:** Kimi (implementing)

---

## Summary

This directory contains 30+ patterns adapted from BistroLens for Nova26. Each pattern has been transformed from raw documentation into actionable specifications with:

- **Concrete implementation code**
- **Files to modify** in Nova26
- **Priority rankings** (P1-P3)
- **Reusability scores** (1-10)

---

## Adapted Patterns Index

### P1: Critical Priority

| Pattern | Source | Nova26 File | Impact |
|---------|--------|-------------|--------|
| Steering System | BistroLens steering | `src/steering/` | Context management for 21 agents |
| Security Scanner | BistroLens security | `src/security/` | Agent output validation |
| Quality Gates | BistroLens hooks | `src/gates/` | 6 new validation gates |
| Code Governance | BistroLens image governance | `src/governance/` | Red lines, quality scoring |
| Cost Protection | BistroLens API cost | `src/cost/` | Per-agent budgets |

### P2: High Priority

| Pattern | Source | Nova26 File | Impact |
|---------|--------|-------------|--------|
| Enhanced PRD Format | BistroLens specs | `.nova/templates/` | Design phase, ADRs |
| Convex Patterns | BistroLens DB | `convex/lib/` | Auth, soft delete, pagination |
| Error Handling | BistroLens Error UX | `src/errors/` | Retry, degradation |
| Accessibility | BistroLens WCAG | `src/accessibility/` | 12 validation checks |
| Testing Strategy | BistroLens QA | `tests/` | Integration, E2E |
| Prompt Engineering | BistroLens AI | `src/prompts/` | Safety filters, grounding |

---

## Directory Structure

```
.nova/bistrolens-knowledge/
├── 01-security/
│   └── nova26-security-enforcement.md
├── 02-steering-system/
│   └── nova26-steering-architecture.md
├── 03-quality-gates/
│   └── nova26-expanded-gates.md
├── 04-code-governance/
│   └── nova26-code-governance.md
├── 05-database-patterns/
│   └── nova26-convex-improvements.md
├── 06-cost-protection/
│   └── nova26-cost-protection.md
├── 07-testing-strategies/
│   └── nova26-test-plan.md
├── 08-design-system/
│   └── nova26-accessibility-rules.md
├── 09-error-handling/
│   └── nova26-error-patterns.md
├── 15-ai-prompts/
│   └── nova26-prompt-improvements.md
└── 17-nova26-adaptations/
    ├── README.md (this file)
    ├── steering-system.md
    ├── security-patterns.md
    ├── quality-gates.md
    ├── code-governance.md
    ├── cost-protection.md
    ├── convex-patterns.md
    ├── error-patterns.md
    ├── accessibility-rules.md
    ├── test-plan.md
    ├── prompt-engineering.md
    └── enhanced-prd-format.md
```

---

## Implementation Roadmap

### Phase 1: Infrastructure (Week 1)
- [ ] Steering system (`src/steering/`)
- [ ] Security enforcement (`src/security/`)
- [ ] Cost protection (`src/cost/`)

### Phase 2: Quality (Week 2)
- [ ] Expanded gates (`src/gates/`)
- [ ] Code governance (`src/governance/`)
- [ ] Prompt improvements (`src/prompts/`)

### Phase 3: Patterns (Week 3)
- [ ] Convex helpers (`convex/lib/`)
- [ ] Error handling (`src/errors/`)
- [ ] Accessibility (`src/accessibility/`)

### Phase 4: Testing (Week 4)
- [ ] Test infrastructure (`tests/`)
- [ ] PRD template v2 (`.nova/templates/`)
- [ ] Integration with Ralph Loop

---

## Key Adaptations Summary

### 1. Steering System → Agent Context Management
**BistroLens:** File-based steering with inclusion patterns  
**Nova26:** Agent registry with dynamic loading based on task context

### 2. Image Governance → Code Governance
**BistroLens:** Image generation red lines, quality gates, kill switch  
**Nova26:** Code generation red lines (no eval, no any), quality scoring, circuit breaker

### 3. API Cost Protection → LLM Cost Protection
**BistroLens:** Per-user daily limits, tier-based throttling  
**Nova26:** Per-agent budgets, per-build cost tracking, graceful degradation

### 4. Security Steering → Agent Output Security
**BistroLens:** WAF, rate limiting, content safety  
**Nova26:** Post-generation security scan, agent behavior analysis

### 5. Spec Structure → Enhanced PRD
**BistroLens:** requirements.md → design.md → tasks.md  
**Nova26:** PRD v2 with design phase, ADRs, acceptance criteria

---

## New Files to Create (Summary)

### TypeScript Implementation (~20 files)
```
src/steering/agent-loader.ts
src/steering/manual-invocation.ts
src/steering/context-budget.ts
src/security/agent-output-scanner.ts
src/security/llm-rate-limiter.ts
src/security/build-suspicion-scorer.ts
src/security/code-content-safety.ts
src/gates/accessibility-gate.ts
src/gates/performance-gate.ts
src/gates/i18n-gate.ts
src/gates/documentation-gate.ts
src/gates/cost-monitor-gate.ts
src/governance/red-lines.ts
src/governance/quality-scorer.ts
src/governance/kill-switch.ts
src/cost/build-budget.ts
src/cost/cost-circuit-breaker.ts
src/cost/cache-first-llm.ts
src/errors/error-messages.ts
src/errors/retry-logic.ts
```

### Convex Helpers (~5 files)
```
convex/lib/auth.ts
convex/lib/softDelete.ts
convex/lib/pagination.ts
convex/lib/rateLimit.ts
convex/lib/validators.ts
```

---

## Files to Modify (Summary)

| File | Changes Required |
|------|-----------------|
| `src/orchestrator/ralph-loop.ts` | Integrate steering, new gates |
| `src/orchestrator/gate-runner.ts` | Add security, a11y, cost gates |
| `src/llm/model-router.ts` | Add budget checks |
| `src/llm/prompt-builder.ts` | Use system prompt templates |
| `src/cost/cost-tracker.ts` | Per-agent tracking |
| `src/browser/visual-validator.ts` | 12 new a11y checks |
| `.nova/agents/*.md` | Add YAML front matter |
| `.nova/config/hard-limits.json` | Add a11y limits |

---

## Metrics

- **Patterns adapted:** 30+
- **New files specified:** 25+
- **Files to modify:** 15+
- **Lines of implementation code:** 3000+
- **Total documentation:** ~15,000 words

---

## Credits

Patterns adapted from [BistroLens](https://bistrolens.app) codebase  
Original BistroLens steering system created by Kiro  
Nova26 adaptations by Kimi (Nova26 agent)

---

*End of Phase 5: BistroLens Knowledge Extraction → Nova26 Adaptation*
