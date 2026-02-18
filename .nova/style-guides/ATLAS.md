# ATLAS Style Guide - Build Patterns & Retrospectives

> Standards for build patterns, performance tracking, and retrospective documentation

---

## Pattern Naming Conventions

### Effective Patterns (effective_*)

| Pattern Type | Naming | Example |
|--------------|--------|---------|
| Build optimization | `effective_build_[technique].md` | `effective_build_caching.md` |
| Performance pattern | `effective_performance_[area].md` | `effective_performance_images.md` |
| CI/CD pattern | `effective_ci_[practice].md` | `effective_ci_parallel_jobs.md` |
| Testing pattern | `effective_testing_[strategy].md` | `effective_testing_e2e.md` |

### Failure Patterns (failure_*)

| Pattern Type | Naming | Example |
|--------------|--------|---------|
| Build failures | `failure_build_[symptom].md` | `failure_build_memory_exhausted.md` |
| Performance anti-pattern | `failure_performance_[issue].md` | `failure_performance_layout_shift.md` |
| Common errors | `failure_error_[type].md` | `failure_error_cors.md` |
| Deployment failures | `failure_deploy_[symptom].md` | `failure_deploy_timeout.md` |

---

## Build Log Format

### Log File Naming

```
logs/
├── build/
│   ├── build-YYYY-MM-DD-HHMMSS.log
│   ├── build-failed-YYYY-MM-DD-HHMMSS.log
│   └── build-deploy-YYYY-MM-DD-HHMMSS.log
├── perf/
│   └── perf-YYYY-MM-DD-HHMMSS.json
└── errors/
    └── error-[hash].log
```

### Build Log Structure

```markdown
# Build Log: [Project] - [Timestamp]

## Build Metadata
- **Trigger:** [Manual | Push | PR | Scheduled]
- **Branch:** [branch-name]
- **Commit:** [hash]
- **Runner:** [CI runner ID]
- **Duration:** [MM:SS]

## Environment
- Node.js: [version]
- Package Manager: [npm/yarn/pnpm] [version]
- OS: [runner OS]

## Build Phases

### Phase 1: Install Dependencies
- **Start:** HH:MM:SS
- **Duration:** [seconds]
- **Status:** ✅ Success | ❌ Failed
- **Cache Hit:** [Yes/No]
- **Packages Installed:** [count]

### Phase 2: Type Check
- **Start:** HH:MM:SS
- **Duration:** [seconds]
- **Status:** ✅ Success | ❌ Failed
- **Errors:** [count]
- **Warnings:** [count]

### Phase 3: Lint
- **Start:** HH:MM:SS
- **Duration:** [seconds]
- **Status:** ✅ Success | ❌ Failed
- **Files Checked:** [count]
- **Issues Found:** [count]

### Phase 4: Test
- **Start:** HH:MM:SS
- **Duration:** [seconds]
- **Status:** ✅ Success | ❌ Failed
- **Tests Passed:** [count]
- **Tests Failed:** [count]
- **Coverage:** [percentage]

### Phase 5: Build
- **Start:** HH:MM:SS
- **Duration:** [seconds]
- **Status:** ✅ Success | ❌ Failed
- **Bundle Size:** [KB/MB]
- **Chunks Generated:** [count]
- **Warnings:** [count]

### Phase 6: Deploy (if applicable)
- **Start:** HH:MM:SS
- **Duration:** [seconds]
- **Status:** ✅ Success | ❌ Failed
- **Target:** [environment]
- **URL:** [deployment URL]

## Performance Metrics

| Metric | Value | Threshold | Status |
|--------|-------|-----------|--------|
| Build Time | [MM:SS] | < 5:00 | ✅ Pass |
| Bundle Size | [MB] | < 500KB | ⚠️ Warn |
| Test Duration | [MM:SS] | < 2:00 | ✅ Pass |
| Memory Usage | [MB] | < 4GB | ✅ Pass |

## Errors (if any)

### Error #[N]
- **Phase:** [Build phase]
- **File:** [file path]
- **Line:** [line number]
- **Message:** [error message]
- **Stack Trace:**
  ```
  [stack trace]
  ```

## Artifacts
- [ ] Build output: [path]
- [ ] Coverage report: [path]
- [ ] Bundle analysis: [path]

## Next Steps
- [ ] [Action item if failed]
```

---

## Performance Metric Tracking

### Metric Collection Template

```json
{
  "timestamp": "2024-01-01T00:00:00Z",
  "version": "1.0.0",
  "environment": "production",
  "metrics": {
    "build": {
      "totalDuration": 245000,
      "installDuration": 45000,
      "typeCheckDuration": 30000,
      "buildDuration": 120000,
      "memoryPeak": 2048000000
    },
    "bundle": {
      "totalSize": 450000,
      "jsSize": 380000,
      "cssSize": 50000,
      "imageSize": 20000,
      "chunks": 12,
      "lazyLoadedChunks": 4
    },
    "webVitals": {
      "fcp": 1200,
      "lcp": 2500,
      "fid": 12,
      "cls": 0.02,
      "ttfb": 180,
      "inp": 180
    },
    "custom": {
      "apiResponseTime": 120,
      "timeToInteractive": 3200,
      "firstPaint": 800
    }
  },
  "thresholds": {
    "buildDuration": 300000,
    "bundleSize": 500000,
    "lcp": 2500,
    "fid": 100,
    "cls": 0.1
  },
  "alerts": [
    {
      "metric": "bundleSize",
      "severity": "warning",
      "message": "Bundle size approaching threshold"
    }
  ]
}
```

### Performance Dashboard Schema

```markdown
# Performance Dashboard: [Project]

**Last Updated:** [timestamp]
**Period:** [7 days | 30 days | 90 days]

## Trend Summary

| Metric | Current | 7d Avg | 30d Avg | Trend |
|--------|---------|--------|---------|-------|
| Build Time | 4:05 | 4:12 | 4:30 | ↓ -5% |
| Bundle Size | 450KB | 445KB | 420KB | ↑ +7% |
| LCP | 2.1s | 2.2s | 2.5s | ↓ -16% |
| FID | 12ms | 15ms | 18ms | ↓ -33% |

## Build Performance

### Duration Trend
```
[ASCII chart or link to Grafana/Datadog]
```

### Size Analysis
| Chunk | Size | Gzipped | % of Total |
|-------|------|---------|------------|
| main | 180KB | 55KB | 40% |
| vendor | 150KB | 45KB | 33% |
| app | 120KB | 38KB | 27% |

## Alert History

| Date | Metric | Severity | Resolution |
|------|--------|----------|------------|
| [date] | LCP | warning | Optimized images |
```

---

## Retrospective Structure

### Retrospective File Naming

```
retrospectives/
├── sprint-[NN]-retrospective.md
├── release-v[X.Y.Z]-retrospective.md
├── incident-[YYYY-MM-DD]-retrospective.md
└── project-[name]-retrospective.md
```

### Sprint Retrospective Template

```markdown
# Sprint [N] Retrospective

**Sprint Dates:** [Start] - [End]
**Sprint Goal:** [Goal statement]
**Facilitator:** [Name]

## Metrics

| Metric | Planned | Completed | Completion % |
|--------|---------|-----------|--------------|
| Story Points | 40 | 35 | 87.5% |
| Features | 5 | 4 | 80% |
| Bugs Fixed | 8 | 10 | 125% |

## What Went Well 🎉

1. **[Category]: [Specific item]**
   - [Details]
   - [Impact]

2. **[Category]: [Specific item]**
   - [Details]

## What Could Be Improved 🔧

1. **[Category]: [Specific item]**
   - [Problem description]
   - [Impact on team/sprint]

2. **[Category]: [Specific item]**
   - [Problem description]

## Action Items

| Action | Owner | Due Date | Priority |
|--------|-------|----------|----------|
| [Action 1] | [Name] | [Date] | P1 |
| [Action 2] | [Name] | [Date] | P2 |

## Technical Debt Identified

| Item | Severity | Effort | Ticket |
|------|----------|--------|--------|
| [Debt item] | High | 3 pts | #[number] |

## Shoutouts
- [Name]: [Contribution/achievement]

## Notes for Next Sprint
- [Lesson learned or consideration]
```

### Incident Retrospective Template (Post-Mortem)

```markdown
# Incident Retrospective: [Incident Title]

**Incident ID:** [ID]
**Date:** [YYYY-MM-DD]
**Duration:** [HH:MM]
**Severity:** [P0 | P1 | P2 | P3]
**Status:** [RESOLVED | MITIGATED]

## Timeline

| Time | Event | Actor |
|------|-------|-------|
| 09:15 | Alert triggered | Monitoring |
| 09:20 | Incident declared | [Name] |
| 09:45 | Root cause identified | [Name] |
| 10:30 | Fix deployed | [Name] |
| 11:00 | Incident resolved | [Name] |

## Impact

- **Services Affected:** [List]
- **Users Affected:** [Count or %]
- **Data Loss:** [Yes/No - details if yes]
- **Revenue Impact:** [If applicable]

## Root Cause Analysis

### Problem
[Clear description of what went wrong]

### Contributing Factors
1. [Factor 1]
2. [Factor 2]
3. [Factor 3]

### 5 Whys
1. **Why?** [Answer]
2. **Why?** [Answer]
3. **Why?** [Answer]
4. **Why?** [Answer]
5. **Why?** [Root cause]

## Resolution

### Immediate Fix
[What was done to resolve the incident]

### Verification
[How we confirmed the fix worked]

## Preventive Measures

| Action | Type | Owner | Due Date |
|--------|------|-------|----------|
| [Action] | [Prevention/Detection/Response] | [Name] | [Date] |

## Lessons Learned
- [Lesson 1]
- [Lesson 2]

## Related Incidents
- [Previous similar incident links]
```

---

## Quality Checklist (25+ items)

### Build Logs (5)
- [ ] All phases documented
- [ ] Duration captured for each phase
- [ ] Errors include context
- [ ] Artifacts listed
- [ ] Environment documented

### Performance Metrics (5)
- [ ] Build time tracked
- [ ] Bundle size measured
- [ ] Web Vitals captured
- [ ] Thresholds defined
- [ ] Alerts configured

### Patterns Documentation (5)
- [ ] effective_* patterns have examples
- [ ] failure_* patterns have root causes
- [ ] Patterns reference each other
- [ ] Version/date on patterns
- [ ] Success metrics for effective patterns

### Retrospectives (5)
- [ ] Metrics section complete
- [ ] Action items assigned
- [ ] Root cause analysis included
- [ ] Timeline for incidents
- [ ] Follow-up scheduled

### Continuous Improvement (5)
- [ ] Trends analyzed
- [ ] Patterns updated based on new learnings
- [ ] Action items tracked across retrospectives
- [ ] Metrics compared to baselines
- [ ] Team feedback incorporated

---

## Self-Check Before Responding

- [ ] Pattern naming follows convention (effective_* / failure_*)
- [ ] Build log includes all required phases
- [ ] Performance metrics have thresholds
- [ ] Retrospective has actionable items
- [ ] Root cause analysis uses 5 Whys for incidents
- [ ] Metrics are comparable over time
- [ ] Patterns include code examples
- [ ] All timestamps use ISO 8601 format

---

## Output Format Template

```markdown
## Pattern: [effective_*/failure_*][Name]

### Category
[Build | Performance | Testing | Deployment]

### Problem/Solution
[Description]

### Context
[When to apply/avoid]

### Implementation
\`\`\`[language]
[Code example]
\`\`\`

### Metrics
- **Expected Improvement:** [Metric]
- **Measured Impact:** [Result]

### Related
- [Links to other patterns]
```
