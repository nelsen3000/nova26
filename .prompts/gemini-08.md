# Gemini Research Prompt — GEMINI-08
## Topic: Developer Productivity Metrics & Benchmarking for AI IDEs

**Role**: You are an engineering effectiveness researcher with expertise in DORA metrics, developer experience measurement, and AI-assisted development productivity.

---

## Research Mission

Nova26 claims to make developers 10x faster. We need to define HOW we measure that — both for internal quality gates and for marketing claims. This research should yield a concrete metrics framework we can implement in our ATLAS dashboard.

---

## Required Research Areas

### 1. Industry Frameworks (2026 State)
- **DORA metrics** (Deployment Frequency, Lead Time, MTTR, Change Failure Rate): how AI IDEs affect each metric
- **SPACE framework** (Satisfaction, Performance, Activity, Communication, Efficiency): which dimensions Nova26 impacts
- **DevEx Index** (DX Core 4): what developers actually care about in 2026
- **AI-specific metrics**: token efficiency, acceptance rate, hallucination rate per agent, gate pass rate
- Which companies (GitHub, Cursor, Devin, Codeium) publish data on these metrics?

### 2. Nova26-Specific Metrics
Design a metrics system for Nova26 that covers:

**Build metrics:**
- Build success rate (by PRD type, agent count, model tier)
- Phase completion time (per Ralph Loop phase)
- Gate pass rate per agent (GANYMEDE's test coverage gate, MERCURY's review gate)
- Task retry rate (signal for prompt quality issues)
- Time-to-first-working-build (TTFWB)

**Agent metrics:**
- Per-agent success rate, avg latency, cost per task
- Model routing efficiency (how often does the router pick the right model?)
- Speculative decoding hit rate (accepted draft tokens / total tokens)
- Cross-agent handoff success rate

**User-facing metrics:**
- Idea-to-PRD time (SUN agent)
- PRD-to-first-build time (full pipeline)
- Build-to-deployment time (MARS agent)
- User override frequency (how often does the user reject agent output?)

### 3. Analytics Dashboard Design
For the ATLAS dashboard (`/dashboard` in our Next.js app):
- Which metrics belong on the Overview page? (we have 4 stat cards now)
- What charts/visualizations make sense? (time series, heatmaps, scatter plots)
- Real-time vs. historical views — what's the right time horizon?
- Agent leaderboard: rank agents by success rate, cost efficiency
- Anomaly detection: when should the dashboard alert the user?

### 4. Competitive Benchmarking
- How does Cursor publish "lines of code written" metrics?
- How does GitHub Copilot measure acceptance rate?
- What does Devin publish about its SWE-bench performance?
- How should Nova26 position against these (marketing claims we can make)?
- Third-party benchmark suites: SWE-bench, HumanEval, Terminal-Bench 2.0 — which matter for Nova26?

### 5. Priority Matrix
Top 10 metrics to implement first, ranked by: (a) data collection effort, (b) user insight value, (c) marketing value.

---

## Output Format

```
## Executive Summary (3 bullets)
## 1. Industry Frameworks
## 2. Nova26-Specific Metrics Schema (TypeScript interfaces)
## 3. Dashboard Design Recommendations
## 4. Competitive Benchmarking Positioning
## 5. Priority Matrix (table)
## 6. Implementation Roadmap (phases)
## 7. Open Questions for Jon
```

**Depth target**: 3,000-4,000 words. Include the TypeScript interfaces for the metrics schema.
Save output to: `.nova/research/gemini-08-productivity-metrics.md`
