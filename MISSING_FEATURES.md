# NOVA26 Missing Features & Functions
## Updated: February 19, 2026 (post Gemini-01 audit)
## Current state: 2,642 tests, 0 TS errors, 62 src/ directories, 17 R16/R17 modules, 21 EARTH XML agents

---

## ✅ IMPLEMENTED — Previously Critical/High (all P0s done)

| # | Feature | Status | Where It Lives |
|---|---------|--------|----------------|
| 1 | Configuration Management | DONE | `src/config/`, `RalphLoopOptions` in ralph-loop.ts |
| 2 | State Persistence & Recovery | DONE | `src/persistence/`, event-store.ts, better-sqlite3, R17-01 build snapshots |
| 3 | LLM Response Caching | DONE | response-cache.ts wired into ollama-client (C-01, C-03) |
| 4 | Rate Limiting & Circuit Breakers | DONE | model-router circuit breaker (C-07), `src/recovery/circuit-breaker.ts` |
| 5 | Cost Tracking & Budgets | DONE | `src/cost/cost-tracker.ts`, /cost CLI, budget enforcement (C-04, C-05) |
| 6 | Performance Monitoring | DONE | `src/analytics/`, `src/health/health-dashboard.ts` (R17-10) |
| 7 | Dependency Analysis | DONE | `src/dependency-analysis/`, `src/deps/dependency-manager.ts` (R17-08) |
| 8 | Smart Retry with Escalation | DONE | `src/retry/`, `src/recovery/recovery-strategy.ts` (R17-01) |
| 9 | Project Templates | DONE | `src/init/template-system.ts` (R17-02) |
| 17 | Security Scanner | DONE | `src/security/security-scanner.ts`, .novaignore (O-12, O-13, O-14) |
| 27 | Testing Utilities | DONE | `src/testing/` — runner, coverage, mocks, snapshots, patterns (R16-04) |
| 26 | Database Migration Manager | DONE | `src/migrate/framework-migrator.ts` (R17-04) |
| 31 | Self-Improving Agents | DONE | `src/agents/self-improvement.ts`, R17-12 meta-learning |

---

## 🟠 IN PROGRESS — Being Specced or Built

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 11 | IDE Integration (VS Code) | SPECCED | Grok R18-03 spec delivered, awaiting Kimi sprint |
| 14 | Documentation Generator | PARTIAL | 16 root markdown docs exist, no auto-gen or OpenAPI |
| 20 | Team Collaboration | SPECCED | Grok R9 covered teams/enterprise |
| 29 | Plugin System | PARTIAL | `src/skills/marketplace.ts` scaffold exists |

---

## 🔴 NOT YET BUILT — Remaining Gaps

### High Impact

| # | Feature | Impact | Effort | Spec Status |
|---|---------|--------|--------|-------------|
| 10 | Multi-Language Support (Python/Go/Rust) | High | High | Not specced |
| — | Dashboard UI (Next.js 15 + Convex) | Critical | High | Grok R18-01 specced |
| — | Deployment story (Docker, Vercel, `npx nova26 init`) | Critical | Medium | Grok R18-02 specced |
| — | Ralph-loop wiring (13 features are dead code) | Critical | Low | Kimi mega-wiring sprint assigned |
| — | Lifecycle hooks (feature activation system) | High | Medium | Kimi mega-wiring sprint assigned |
| — | Behavior system (reusable agent patterns) | High | Medium | Kimi mega-wiring sprint assigned |
| — | Mobile Launch Stage (Expo + App Store) | High | High | Grok R19-01 being specced |
| — | Deep Semantic Model (ATLAS brain) | High | High | Grok R19-02 being specced |
| — | Studio Rules + Prompt Optimization | High | Medium | Grok R19-03 being specced |
| — | Orchestrator L0/L1/L2/L3 hierarchy | High | High | Grok R20-01 queued |
| — | Tauri desktop app (native wrapper) | High | High | Grok R20-02 queued |
| — | AI design pipeline (Relume/Uizard-style) | Medium | High | Grok R20-03 queued |

### Medium Impact — New from Gemini-01 Audit

| # | Feature | Impact | Effort | Notes |
|---|---------|--------|--------|-------|
| — | MCP (Model Context Protocol) support | High | Medium | Must-have ecosystem standard — agent ↔ tool interop |
| — | ACP (Agent Client Protocol) support | High | Medium | Decouple agents from IDE — run in JetBrains, Zed, etc. |
| — | Braintrust eval-in-CI | Medium | High | Golden set evaluation on every agent template change |
| — | EU AI Act audit trails | Medium | Medium | Article 86 Right to Explanation — enterprise requirement |
| — | Local SLM agent routing | Medium | Medium | Different models per agent role (Qwen for code, DeepSeek for reasoning) |
| — | Perplexity research integration | Medium | Low | Grok specced, queued for Kimi — cited web research for all agents |
| — | PostHog session replay | Medium | Medium | Agent session replay for debugging file system interactions |
| — | Semantic Diff agent | Medium | Medium | Summarize intent behind large AI PRs for human review |

### Medium Impact — Original

| # | Feature | Impact | Effort | Notes |
|---|---------|--------|--------|-------|
| 12 | Import/Export Formats (Jira, Linear, GitHub) | Medium | Medium | Not specced |
| 13 | Search System (cross-skill, cross-agent) | Medium | Medium | Semantic search exists (O-03) but no CLI |
| 15 | Changelog Generator | Low-Medium | Low | Not built |
| 16 | Git Integration Enhancements | Medium | Medium | Basic git workflow exists |
| 18 | Performance Budget | Low-Medium | Low | Not built |
| 19 | Image Optimization Pipeline | Low | Medium | Not built |
| — | ESLint + Prettier config | Medium | Low | No project-level lint config exists |

### Nice to Have

| # | Feature | Notes |
|---|---------|-------|
| 21 | Notification System (Slack, Discord, webhooks) | Not built |
| 22 | A/B Testing Framework | Not built |
| 23 | Feature Flags System | Not built |
| 24 | Analytics Integration (PostHog/Sentry) | Langfuse exists for LLM, no product analytics |
| 25 | Email System | Not built |
| 28 | Backup & Restore | Not built (build snapshots exist in R17-01) |
| 30 | Localization (i18n) | Not built |
| 32 | Visual Programming Interface | Not built |
| 33 | Voice Interface | Not built |
| 34 | Screenshot Comparison | Not built |
| 35 | Auto-Documentation Videos | Not built |
| — | Snyk pre-commit security gates | Already have security scanner, could add pre-commit hook |
| — | ElectricSQL offline sync | Local-first persistence exists, no conflict resolution |
| — | Flowstep multi-screen generation | Living Canvas enhancement — full user journeys |
| — | DSPy GEPA cost-vs-quality tuning | Multi-objective prompt optimization |

---

## ✅ RECENTLY COMPLETED (not in original tracking)

| Feature | Status | Notes |
|---------|--------|-------|
| 21 EARTH XML agent templates | DONE | All 21/21 agents standardized (CL-25) |
| Kiro pattern validation | DONE | 140 patterns, 9 properties, fast-check (KIRO-04) |
| Gemini-01 ecosystem audit | DONE | 30+ tools across 11 categories analyzed |

---

## 📊 Updated Priority Matrix

| Feature | Impact | Effort | Priority | Owner |
|---------|--------|--------|----------|-------|
| Ralph-loop wiring (13 modules) | Critical | Low | P0 | Kimi (assigned) |
| Dashboard UI | Critical | High | P0 | Kimi (after Grok R18-01) |
| Deployment story | Critical | Medium | P1 | Kimi (after Grok R18-02) |
| Lifecycle hooks | High | Medium | P1 | Kimi (assigned) |
| Mobile Launch Stage | High | High | P1 | Kimi (after Grok R19-01) |
| Deep Semantic Model | High | High | P1 | Kimi (after Grok R19-02) |
| VS Code Extension | Medium | High | P2 | Kimi (after Grok R18-03) |
| Multi-Language | High | High | P2 | Not specced yet |
| ESLint + Prettier | Medium | Low | P2 | Kimi (after Grok R18-05) |
| Studio Rules | High | Medium | P2 | Kimi (after Grok R19-03) |
| MCP support | High | Medium | P2 | Gemini-01 flagged as must-have |
| ACP support | High | Medium | P2 | Gemini-01 flagged — multi-IDE agents |
| Orchestrator hierarchy | High | High | P2 | Grok R20-01 queued |
| Tauri desktop | High | High | P2 | Grok R20-02 queued |
| EU AI Act audit trails | Medium | Medium | P3 | Gemini-05 researching |

---

## Summary

**Total features tracked:** 35 original + 9 new + 12 from Gemini-01 = 56
**Implemented:** 13 core + 3 recent = 16
**In progress/specced:** 17
**Not yet built:** 23
**Overall:** ~59% of all tracked features implemented or in progress
