# ANDROMEDA Style Guide - Research & Analysis

> Standards for technology research, comparison reports, and architecture evaluations

---

## File Naming Conventions

| Type | Pattern | Example |
|------|---------|---------|
| Comparison reports | `[topic]-comparison-report.md` | `state-management-comparison-report.md` |
| Technology evaluation | `[tech]-evaluation.md` | `convex-evaluation.md` |
| Research notes | `research-[topic].md` | `research-authentication.md` |
| Recommendation docs | `[topic]-recommendation.md` | `ui-library-recommendation.md` |
| Feasibility study | `[feature]-feasibility.md` | `realtime-sync-feasibility.md` |

---

## Comparison Report Structure

Every comparison report must follow this structure:

```markdown
# [Topic] Comparison Report

**Date:** YYYY-MM-DD
**Researcher:** [Name/Agent]
**Status:** [Draft | Under Review | Final]

## Executive Summary
- **Recommendation:** [Option X]
- **Key Factor:** [Primary decision driver]

## Comparison Matrix

| Criteria | Option A | Option B | Option C |
|----------|----------|----------|----------|
| Performance | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ |
| Learning Curve | Low | Medium | High |
| Community | Large | Medium | Small |
| Integration | Easy | Moderate | Complex |
| Cost | Free | $X/mo | $Y/mo |

## Detailed Analysis

### Option A: [Name]
**Best for:** [Use case]

#### Pros
- [Advantage 1]
- [Advantage 2]

#### Cons
- [Disadvantage 1]
- [Disadvantage 2]

#### Evidence
- [Benchmark result]
- [Documentation link]

### Option B: [Name]
...

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| [Risk 1] | Low | High | [Strategy] |

## Recommendation

### Primary Choice: [Option]
**Rationale:** [Explanation]

### Fallback: [Option]
**Trigger:** [When to switch]

## Next Steps
- [ ] Action item 1
- [ ] Action item 2
```

---

## Technology Evaluation Format

```markdown
# [Technology] Evaluation

## Overview
- **Category:** [State management, Database, UI library, etc.]
- **Version Evaluated:** [X.Y.Z]
- **License:** [MIT/Apache/Proprietary]

## Scorecard (1-5 scale)

| Dimension | Score | Notes |
|-----------|-------|-------|
| Maturity | ⭐⭐⭐⭐⭐ | [v1.0+ stable] |
| Documentation | ⭐⭐⭐⭐ | [Excellent guides] |
| Community | ⭐⭐⭐ | [Growing Discord] |
| Performance | ⭐⭐⭐⭐⭐ | [Benchmarks attached] |
| Type Safety | ⭐⭐⭐⭐ | [Full TS support] |
| **Overall** | **4.2** | |

## Integration Analysis

### Compatibility Matrix
- React: ✅ Full support
- Convex: ✅ Native integration
- Mobile: ⚠️ Partial (PWA only)

### Migration Effort
| From | Effort | Notes |
|------|--------|-------|
| Redux | Medium | 2-3 sprints |
| Zustand | Low | 1 sprint |

## Decision
- **Verdict:** [Adopt | Trial | Hold | Reject]
- **Confidence:** [High | Medium | Low]
- **Review Date:** [When to re-evaluate]
```

---

## Recommendation Template

```markdown
# Recommendation: [Decision Title]

**Date:** YYYY-MM-DD
**Author:** [Name/Agent]
**Priority:** [P0 | P1 | P2]

## Current Situation
[Context and problem statement]

## Options Considered
1. **[Option A]** - [Brief description]
2. **[Option B]** - [Brief description]
3. **[Option C]** - [Brief description]

## Recommendation: [Chosen Option]

### Why This Option
1. [Reason 1 with evidence]
2. [Reason 2 with evidence]
3. [Reason 3 with evidence]

### Trade-offs Accepted
- [Trade-off 1]: [Why acceptable]
- [Trade-off 2]: [Mitigation strategy]

## Implementation Plan

### Phase 1: [Name] (Week 1-2)
- [ ] Task 1
- [ ] Task 2

### Phase 2: [Name] (Week 3-4)
- [ ] Task 3
- [ ] Task 4

### Success Metrics
- [Metric 1]: [Target value]
- [Metric 2]: [Target value]

## Risk Analysis

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| [Risk] | High | Medium | [Strategy] |

## Stakeholders
- **Approver:** [Name/Role]
- **Consulted:** [Names/Roles]
- **Informed:** [Names/Roles]
```

---

## Research Methodology Standards

### Evidence Hierarchy (Most to Least Reliable)
1. **Benchmark Data** - Measured performance metrics
2. **Official Documentation** - Primary source
3. **Production Case Studies** - Real-world usage
4. **Community Feedback** - GitHub issues, Discord
5. **Proof of Concept** - Tested in isolation
6. **Expert Opinion** - Industry consensus

### Required Sources
Every research finding must cite:
- Primary documentation link
- Version number of technology evaluated
- Date of information retrieval

---

## Quality Checklist (20+ items)

### Research Quality (5)
- [ ] Multiple sources consulted (minimum 3)
- [ ] Official documentation reviewed
- [ ] Community sentiment analyzed
- [ ] Version numbers documented
- [ ] Date stamps on all findings

### Comparison Rigor (5)
- [ ] Criteria defined before comparison
- [ ] Weighted scoring if applicable
- [ ] Evidence cited for each claim
- [ ] Edge cases considered
- [ ] Bias acknowledgment (if any)

### Evaluation Completeness (5)
- [ ] Integration complexity assessed
- [ ] Migration effort estimated
- [ ] Risk analysis included
- [ ] Fallback options identified
- [ ] Review cadence defined

### Recommendation Clarity (5)
- [ ] Clear preferred option stated
- [ ] Rationale evidence-based
- [ ] Trade-offs explicitly listed
- [ ] Implementation steps outlined
- [ ] Success metrics defined

---

## Self-Check Before Responding

- [ ] All technologies evaluated against same criteria
- [ ] Evidence cited with links/versions
- [ ] Comparison matrix includes all relevant options
- [ ] Recommendation includes clear rationale
- [ ] Risks and trade-offs documented
- [ ] Implementation plan has actionable steps
- [ ] Fallback option identified
- [ ] Review date for re-evaluation set

---

## Output Format Template

```markdown
## Research Topic: [Name]

### Summary
- **Question:** [Research question]
- **Answer:** [Concise answer]
- **Confidence:** [High/Medium/Low]

### Comparison Matrix
| Criteria | A | B | C |
|----------|---|---|---|
| [Criteria] | [Score] | [Score] | [Score] |

### Recommendation
**Choice:** [Option]
**Rationale:** [Why]

### Evidence
- [Source 1]: [Finding]
- [Source 2]: [Finding]

### Next Steps
- [ ] [Action]
```
