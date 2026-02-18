# MERCURY - Validation & Review Style Guide

## Validation Report Format

### Structure
```markdown
# Validation Report: [Component/Feature Name]

## Metadata
- **Date**: YYYY-MM-DD
- **Validator**: [Name/ID]
- **Version**: [Version being validated]
- **Scope**: [Full/Partial/Regression]

## Summary
| Metric | Value |
|--------|-------|
| Total Checks | N |
| Passed | N |
| Failed | N |
| Skipped | N |
| Success Rate | N% |

## Test Results

### [Category 1]
| ID | Check | Status | Notes |
|----|-------|--------|-------|
| VAL-001 | [Description] | ✅ PASS | |
| VAL-002 | [Description] | ❌ FAIL | [Issue ref] |

## Findings

### Critical Issues
- [ ] [Issue description with severity]

### Warnings
- [ ] [Warning description]

### Recommendations
- [ ] [Recommendation]

## Sign-off
- [ ] Validator Approval
- [ ] Lead Review
```

## PASS/FAIL Criteria Templates

### PASS Criteria (Must Meet ALL)
```markdown
✅ **Functional**: Feature works as specified
✅ **Performance**: Meets latency/throughput thresholds
✅ **Security**: Passes security scan (no critical/high vulns)
✅ **Quality**: Code coverage ≥ 80%, no critical bugs
✅ **Documentation**: Required docs complete and accurate
✅ **Compatibility**: Backward compatible (or breaking change approved)
```

### FAIL Criteria (Any Triggers Rejection)
```markdown
❌ **Critical Bug**: Data loss, security breach, system crash
❌ **Performance**: Fails SLA thresholds (>p99 latency)
❌ **Regression**: Existing functionality broken
❌ **Compliance**: Fails legal/security compliance checks
❌ **Incomplete**: Missing required components or documentation
```

### Conditional PASS (WARN + Required Actions)
```markdown
⚠️ **Minor Issues**: Non-critical bugs with workarounds
⚠️ **Performance**: Within 10% of target (optimization planned)
⚠️ **Documentation**: Minor gaps with follow-up ticket
⚠️ **Tech Debt**: Pre-approved debt with remediation plan
```

## Review Checklist Standards

### Pre-Review Checklist
```markdown
- [ ] PR description complete with context
- [ ] Tests added/updated (unit, integration, e2e)
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] Breaking changes documented
- [ ] Security implications considered
```

### Code Review Checklist
```markdown
- [ ] **Correctness**: Logic is sound and handles edge cases
- [ ] **Performance**: No obvious performance issues
- [ ] **Security**: Input validation, auth checks, data handling
- [ ] **Maintainability**: Readable, well-organized, commented
- [ ] **Testing**: Adequate coverage, meaningful assertions
- [ ] **Style**: Follows project conventions
- [ ] **Dependencies**: Necessary and up-to-date
```

### Post-Review Checklist
```markdown
- [ ] All comments resolved
- [ ] CI/CD pipeline green
- [ ] Final approval from required reviewers
- [ ] Squash commits if required
- [ ] Merge strategy confirmed
- [ ] Rollback plan documented (for major changes)
```

## Issue Severity Classification

| Level | Criteria | Response Time | Action Required |
|-------|----------|---------------|-----------------|
| **P0 - Critical** | Production down, data loss, security breach | Immediate | All hands, emergency fix |
| **P1 - High** | Major feature broken, significant performance degradation | < 4 hours | Fix in current sprint |
| **P2 - Medium** | Feature partially broken, workaround exists | < 24 hours | Fix in next sprint |
| **P3 - Low** | Minor bug, cosmetic issue | < 1 week | Backlog, fix as capacity allows |
| **P4 - Trivial** | Typo, formatting, nice-to-have | < 1 month | Icebox or won't fix |

### Severity Assignment Rules
```markdown
1. **Security**: Any exploitable vulnerability → P0/P1
2. **Data**: Any risk of data loss/corruption → P0/P1
3. **Availability**: Complete outage → P0; Degraded service → P1/P2
4. **User Impact**: >50% users affected → P0/P1; <10% users → P2/P3
5. **Workaround**: No workaround available → Increase severity by 1
```

### Issue Template
```markdown
### [P0/P1/P2/P3/P4] [Component]: [Brief Description]

**Impact**: [Who/what is affected]
**Reproduction**: [Steps to reproduce]
**Expected**: [Expected behavior]
**Actual**: [Actual behavior]
**Workaround**: [If any]
**Related**: [Links to related issues/PRs]
```
