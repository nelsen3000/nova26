# NOVA26 Missing Features & Functions
## Updated: February 19, 2026 (post Gemini-06 + Kimi W-05 + Grok R20-02)
## Current state: 2,885 tests, 0 TS errors, 119 test files, 17 R16/R17 modules wired, 21 EARTH XML agents

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
| — | Ralph-loop wiring (all 17 features) | DONE | All R16/R17 modules wired into `RalphLoopOptions` (KIMI-W-01) |
| — | Lifecycle hooks (feature activation) | DONE | `src/orchestrator/lifecycle-hooks.ts`, HookRegistry, 6 phases (KIMI-W-02) |
| — | Behavior system (reusable patterns) | DONE | `src/behaviors/` — retry, circuit-breaker, timeout, validate, backoff (KIMI-W-03) |

---

## 🟠 IN PROGRESS — Being Specced or Built

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 11 | IDE Integration (VS Code) | SPECCED | Grok R18-03 spec delivered, awaiting Kimi sprint |
| 14 | Documentation Generator | PARTIAL | 16 root markdown docs exist, no auto-gen or OpenAPI |
| 20 | Team Collaboration | SPECCED | Grok R9 covered teams/enterprise |
| 29 | Plugin System | PARTIAL | `src/skills/marketplace.ts` scaffold exists |
| — | Mobile Launch Stage | SPECCED → KIMI | Grok R19-01 specced, Kimi R19 sprint ready (.prompts/kimi-r19-sprint.md) |
| — | Deep Semantic Model | SPECCED → KIMI | Grok R19-02 specced, Kimi R19 sprint ready |
| — | Studio Rules + Prompt Optimization | SPECCED → KIMI | Grok R19-03 specced, Kimi R19 sprint ready |
| — | Orchestrator L0/L1/L2/L3 hierarchy | SPECCED → KIMI | Grok R20-01 specced, Kimi R20 sprint ready (.prompts/kimi-r20-sprint.md) |
| — | Tauri desktop app | SPECCED → KIMI | Grok R20-02 specced, Kimi R20 sprint ready |
| — | AI design pipeline | SPECCING | Grok R20-03 in progress |
| — | MCP support | SPECCING | Grok R21-01 prompt ready |
| — | ACP support | SPECCING | Grok R21-02 prompt ready |
| — | Compliance & Audit Trail | SPECCING | Grok R21-03 prompt ready (based on Gemini-05 research) |
| — | Agent-specific model routing | SPECCING | Grok R22-01 prompt ready (based on Gemini-06 research) |
| — | Perplexity research integration | SPECCED → KIMI | Grok spec in .nova/specs/perplexity-integration.md |

---

## 🔴 NOT YET BUILT — Remaining Gaps

### High Impact

| # | Feature | Impact | Effort | Spec Status |
|---|---------|--------|--------|-------------|
| 10 | Multi-Language Support (Python/Go/Rust) | High | High | Not specced |
| — | Dashboard UI (Next.js 15 + Convex) | Critical | High | Grok R18-01 specced, awaiting Kimi |
| — | Deployment story (Docker, Vercel, `npx nova26 init`) | Critical | Medium | Grok R18-02 specced, awaiting Kimi |

### Medium Impact — From Gemini Research

| # | Feature | Impact | Effort | Notes |
|---|---------|--------|--------|-------|
| — | Braintrust eval-in-CI | Medium | High | Golden set evaluation on every agent template change |
| — | PostHog session replay | Medium | Medium | Agent session replay for debugging file system interactions |
| — | Semantic Diff agent | Medium | Medium | Summarize intent behind large AI PRs for human review |
| — | Sovereign Tier pricing ($12/$25/$45) | High | Medium | Gemini-04: hybrid seat+usage model, PLG playbook |
| — | Agent marketplace (Skills/Templates) | Medium | High | Gemini-04: 70/30 revenue share, community agents |
| — | Celestial CLI aesthetic (ink/charm.sh) | Medium | Medium | Gemini-02: React-based CLI with orbital animations |
| — | Optimistic task execution | High | Low | Gemini-02: show task as "Done" while MERCURY validates |
| — | Multi-agent activity stream | Medium | Medium | Gemini-02: Dynamic Island pattern for agent avatars |
| — | Maestro mobile E2E testing | Medium | Low | Gemini-03: YAML-based, 90% less flaky than Detox |
| — | Nova-Bench benchmark suite | Medium | Medium | Gemini-06: 5 task types to verify model selection quality |

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
| Mega-wiring sprint (W-01→W-05) | DONE | 13 modules wired, lifecycle hooks, behaviors, 243 new tests |
| Gemini-02 UX patterns | DONE | 20 must-steal patterns, 9 categories |
| Gemini-03 Mobile deep dive | DONE | React Native + Expo SDK 54 recommended |
| Gemini-04 Monetization & GTM | DONE | $12/$25/$45 sovereign tiers, PLG playbook |
| Gemini-05 EU AI Act compliance | DONE | Article 86 roadmap, OTel tracing, audit trail schema |
| Gemini-06 Local SLM optimization | DONE | Qwen 3.5 Coder king, hardware-tiered configs |
| Grok R19 specs (3) | DONE | Mobile Launch, Semantic Model, Studio Rules (204 tests) |
| Grok R20 specs (2) | DONE | Orchestrator Hierarchy, Tauri Desktop (199 tests) |

---

## 📊 Updated Priority Matrix

| Feature | Impact | Effort | Priority | Owner | Status |
|---------|--------|--------|----------|-------|--------|
| ~~Ralph-loop wiring~~ | ~~Critical~~ | ~~Low~~ | ~~P0~~ | ~~Kimi~~ | DONE |
| ~~Lifecycle hooks~~ | ~~High~~ | ~~Medium~~ | ~~P0~~ | ~~Kimi~~ | DONE |
| ~~Behavior system~~ | ~~High~~ | ~~Medium~~ | ~~P0~~ | ~~Kimi~~ | DONE |
| Dashboard UI | Critical | High | P0 | Kimi (after R19/R20) | Specced |
| Deployment story | Critical | Medium | P1 | Kimi (after R19/R20) | Specced |
| Mobile Launch Stage | High | High | P1 | Kimi (R19 sprint) | Sprint ready |
| Deep Semantic Model | High | High | P1 | Kimi (R19 sprint) | Sprint ready |
| Studio Rules | High | Medium | P1 | Kimi (R19 sprint) | Sprint ready |
| Orchestrator hierarchy | High | High | P1 | Kimi (R20 sprint) | Sprint ready |
| Tauri desktop | High | High | P1 | Kimi (R20 sprint) | Sprint ready |
| MCP support | High | Medium | P2 | Grok R21-01 → Kimi | Speccing |
| ACP support | High | Medium | P2 | Grok R21-02 → Kimi | Speccing |
| Compliance/Audit Trail | Medium | Medium | P2 | Grok R21-03 → Kimi | Speccing |
| Model routing | Medium | Medium | P2 | Grok R22-01 → Kimi | Speccing |
| AI design pipeline | Medium | High | P2 | Grok R20-03 → Kimi | Speccing |
| VS Code Extension | Medium | High | P2 | Kimi (after R20) | Specced |
| Multi-Language | High | High | P3 | Not specced yet | — |
| EU AI Act audit trails | Medium | Medium | P2 | Gemini-05 researched | Researched |

---

## Summary

**Total features tracked:** 35 original + 9 new + 12 from Gemini-01 + 10 from Gemini-02→06 = 66
**Implemented:** 16 core + 3 mega-wiring + 8 recent = 19 (29%)
**In progress/specced/sprint-ready:** 22 (33%)
**Not yet built:** 25 (38%)
**Overall:** ~62% of all tracked features implemented or in progress
**Test coverage:** 2,885 tests across 119 files, 0 TypeScript errors
