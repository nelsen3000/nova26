# URANUS - Research & Evaluation Style Guide

## Research Report Naming

### File Naming
```
[YYYY-MM-DD]-[topic]-[type].md

Examples:
- 2026-02-18-database-selection-research.md
- 2026-02-15-auth-provider-comparison.md
- 2026-02-10-cicd-tool-evaluation.md
```

### Report Title Format
```markdown
# [Topic] Research & Evaluation

## Alternative Title Formats
- Technology Evaluation: [Subject]
- [Subject] - Architecture Decision Research
- [Subject] Comparison & Recommendation
```

### Report Metadata Header
```markdown
---
title: [Topic] Research Report
date: YYYY-MM-DD
author: [Name]
status: draft | in-review | approved | obsolete
classification: internal | confidential | public
domain: [relevant domain/team]
tags: [tag1, tag2, tag3]
---

## Executive Summary
[Brief overview: 2-3 sentences on what was researched and the recommendation]

## Research Scope
- **Objective**: [What we need to decide/solve]
- **Constraints**: [Budget, time, technical requirements]
- **Success Criteria**: [How we'll evaluate options]
```

## Comparison Matrix Format

### Matrix Structure
```markdown
## Option Comparison Matrix

### Feature Comparison
| Criteria | Weight | Option A | Option B | Option C |
|----------|--------|----------|----------|----------|
| **Cost** | 20% | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ |
| **Performance** | 25% | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Ease of Use** | 15% | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| **Integration** | 20% | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Support** | 15% | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Security** | 5% | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Total** | 100% | **3.15** | **3.25** | **3.35** |

Legend: ⭐ (Poor) → ⭐⭐⭐⭐⭐ (Excellent)
```

### Detailed Comparison Table
```markdown
| Aspect | Option A | Option B | Option C |
|--------|----------|----------|----------|
| **Price** | $X/month | $Y/month | $Z/month |
| **Setup Time** | 2 weeks | 1 week | 3 weeks |
| **Learning Curve** | Steep | Moderate | Gentle |
| **Scaling** | Manual | Auto | Semi-auto |
| **Vendor Lock-in** | High | Medium | Low |
| **Community** | Large | Small | Medium |
| **Documentation** | Excellent | Good | Fair |
```

### Scoring Methodology
```markdown
## Scoring Methodology

### Scoring Scale
| Score | Meaning |
|-------|---------|
| 1 | Does not meet requirement |
| 2 | Partially meets requirement |
| 3 | Meets requirement |
| 4 | Exceeds requirement |
| 5 | Significantly exceeds requirement |

### Weighting Rationale
- **Performance (25%)**: Critical for user experience
- **Cost (20%)**: Significant budget impact
- **Integration (20%)**: Affects development timeline
- **Ease of Use (15%)**: Impacts team productivity
- **Support (15%)**: Important for production issues
- **Security (5%)**: Baseline requirement met by all

### Calculated Score Formula
```
Total = Σ (Criterion Score × Weight)
```
```

## Tool Evaluation Rubric

### Evaluation Categories
```markdown
## Evaluation Framework

### 1. Technical Criteria (40%)
| Sub-criteria | Description | Measurement |
|--------------|-------------|-------------|
| Performance | Speed, throughput, latency | Benchmark tests |
| Scalability | Handles growth | Load testing |
| Reliability | Uptime, error rates | SLA history |
| Security | Compliance, certifications | Audit results |
| Integration | API quality, ecosystem | API docs review |

### 2. Business Criteria (30%)
| Sub-criteria | Description | Measurement |
|--------------|-------------|-------------|
| Cost | TCO over 3 years | Pricing analysis |
| Vendor Stability | Company health | Financial reports |
| Contract Terms | Flexibility, exit options | Legal review |
| Roadmap Alignment | Future plans match needs | Vendor interview |

### 3. Operational Criteria (20%)
| Sub-criteria | Description | Measurement |
|--------------|-------------|-------------|
| Ease of Deployment | Time to production | POC results |
| Maintenance Overhead | Ongoing effort required | Team estimation |
| Monitoring/Ops | Observability features | Feature review |
| Training Required | Learning investment | Team assessment |

### 4. Strategic Criteria (10%)
| Sub-criteria | Description | Measurement |
|--------------|-------------|-------------|
| Industry Adoption | Market presence | Market research |
| Talent Availability | Hiring implications | Job market analysis |
| Competitive Advantage | Differentiation potential | Strategy review |
```

### Scoring Worksheet
```markdown
## Evaluation Scorecard

### Option: [Name]

| Category | Criteria | Score (1-5) | Weight | Weighted |
|----------|----------|-------------|--------|----------|
| Technical | Performance | | 10% | |
| Technical | Scalability | | 10% | |
| Technical | Reliability | | 10% | |
| Technical | Security | | 5% | |
| Technical | Integration | | 5% | |
| Business | Cost | | 10% | |
| Business | Vendor Stability | | 10% | |
| Business | Contract Terms | | 5% | |
| Business | Roadmap | | 5% | |
| Operational | Deployment | | 7% | |
| Operational | Maintenance | | 7% | |
| Operational | Monitoring | | 4% | |
| Operational | Training | | 2% | |
| Strategic | Adoption | | 3% | |
| Strategic | Talent | | 4% | |
| Strategic | Advantage | | 3% | |
| **TOTAL** | | | **100%** | |

### Notes
- [Key findings, concerns, or highlights]
```

## Recommendation Structure

### Recommendation Format
```markdown
## Recommendation

### Primary Recommendation: [Option Name]
**Confidence Level**: High | Medium | Low

**Rationale**:
1. [Primary reason for recommendation]
2. [Secondary reason]
3. [Additional supporting factors]

**Key Benefits**:
- [Benefit 1 with quantified impact if possible]
- [Benefit 2]
- [Benefit 3]

**Risks & Mitigations**:
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| [Risk 1] | Medium | High | [Mitigation strategy] |
| [Risk 2] | Low | Medium | [Mitigation strategy] |

**Implementation Approach**:
- **Phase 1**: [Initial steps]
- **Phase 2**: [Follow-up steps]
- **Timeline**: [Expected duration]

**Success Metrics**:
- [Metric 1: target value]
- [Metric 2: target value]
```

### Alternative Options
```markdown
### Alternative: [Option Name]

**When to Consider**: [Scenarios where this is a better choice]

**Pros**:
- [Advantage 1]
- [Advantage 2]

**Cons**:
- [Disadvantage 1]
- [Disadvantage 2]

**Verdict**: Not recommended due to [primary reason]. Consider if [condition changes].
```

### Decision Record
```markdown
## Decision

**Selected Option**: [Name]
**Decision Date**: YYYY-MM-DD
**Decision Makers**: [Names/Roles]

**Decision Rationale**:
[2-3 paragraph summary of why this option was chosen over alternatives]

**Implementation Owner**: [Name/Team]
**Target Completion**: YYYY-MM-DD
**Review Date**: YYYY-MM-DD (to evaluate decision)

**Related Decisions**:
- [Link to related ADR/research]
- [Link to follow-up work]
```

### Research Report Template
```markdown
# [Topic] Research & Evaluation Report

---
date: YYYY-MM-DD
author: [Name]
status: draft
---

## Executive Summary
[2-3 sentence overview and recommendation]

## Background
[Context: why this research was initiated]

## Objectives & Constraints
- **Must Have**: [Required capabilities]
- **Nice to Have**: [Desired capabilities]
- **Constraints**: [Budget, timeline, technical limits]
- **Deal Breakers**: [Must NOT have]

## Options Considered

### Option 1: [Name]
**Overview**: [Brief description]
**Pros**:
- 
**Cons**:
- 
**Estimates**: [Cost, time, resources]

### Option 2: [Name]
...

### Option 3: [Name]
...

## Comparison Matrix
[Feature/score matrix]

## Evaluation Details
[In-depth analysis of each option]

## Recommendation
[Primary recommendation with rationale]

## Next Steps
- [ ] [Action item 1]
- [ ] [Action item 2]

## Appendix
[Supporting data, benchmarks, references]
```
