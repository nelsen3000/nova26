# NOVA26 TASK BOARD — February 19, 2026

> **Coordination Hub** — All AI agents reference this file for their next assignment.
> **How it works**: When you finish a task, report output to Jon. Jon gives you a prompt
> that sends you back here. Find your section, pick the next unchecked task, do it.
> **Coordinator**: Claude Code (assigns tasks, evaluates output, resolves conflicts)
> **Repo**: https://github.com/nelsen3000/nova26
> **Current state**: 4,552 tests, 0 TS errors, 158 test files
> **Vision**: Eternal Engine — self-evolving Rust core + ZeroClaw/TinyClaw/NanoClaw patterns

---

## Agent Roster

| Agent | Domain | Status | Current Sprint |
|-------|--------|--------|----------------|
| **Claude Code** | Coordinator + Core Engine + Convex | Active | Evaluation + prompt writing |
| **Sonnet** | Integration + Hardening + Wiring | Active | S-01 (6 tasks) + CL-50 hardening sprint (7 tasks) |
| **Kimi** | Implementation (TypeScript + Tests) | Active | R22-R24 source committed, R25 testing sprint ready |
| **Grok** | Research + Deep Specs | Active | R23+R24 delivered, awaiting R25 |
| **Kiro** | Knowledge Extraction + Quality Audits | Active | KIRO-06 + KIRO-07 done (by Claude), awaiting KIRO-08 |
| **Gemini** | Deep Research + Competitive Intel | Active | GEMINI-12 delivered, GEMINI-07→11 + 13→15 pending |

---

## SONNET — Integration & Hardening Engine

> Sprint file: `.prompts/sonnet-s01-integration-sprint.md`
> Rules: TypeScript strict, ESM `.js` imports, vitest, no `any`, mock all I/O
> Domain: ralph-loop.ts wiring, lifecycle system, module integration, TS error fixing, codebase hardening
> Constraint: Do NOT create new feature modules (that's Kimi's job). Focus on wiring, fixing, deduplicating, testing integration.

### Sprint S-01: Integration & Hardening

- [ ] `S-01-01` Fix P0: Deduplicate RalphLoopOptions (ralph-loop.ts line 85 vs ralph-loop-types.ts) — keep ralph-loop-types.ts as single source of truth, re-export from ralph-loop.ts
- [ ] `S-01-02` Wire 4 missing modules into lifecycle-wiring.ts — agentMemory (R16-02), wellbeing (R16-05), advancedRecovery (R17-01), advancedInit (R17-02) — add to DEFAULT_FEATURE_HOOKS + featureFlags map
- [ ] `S-01-03` Delete cut R23-02 sandbox artifacts — remove src/sandbox/ files (Kimi started before we cut this task). Files: firecracker-adapter.ts, index.ts, opa-policy-engine.ts, security/, types.ts, ultra-sandbox-manager.ts, wasi-bridge.ts
- [ ] `S-01-04` Extract shared failure handler from processTask() — 3 near-identical failure paths at ralph-loop.ts lines ~1037, ~1066, ~1112 share Taste Vault recording + ACE outcome recording + analytics. Extract into `handleTaskFailure()` helper
- [ ] `S-01-05` Add integration tests for lifecycle wiring — test that wireFeatureHooks() registers correct hooks for all 17 features (13 existing + 4 new), test priority ordering, test getWiringSummary() accuracy
- [ ] `S-01-06` Evaluate + integrate Kimi R22-R24 deliveries as they arrive — run `npx tsc --noEmit`, fix TS errors, run `npx vitest run`, commit passing code

---

## KIMI — Implementation Engine

> Sprint file: `.prompts/kimi-mega-wiring-sprint.md`
> Rules: TypeScript strict, ESM `.js` imports, vitest, no `any`, mock all I/O

### Completed: Mega Wiring + Lifecycle Hooks + Hardening

- [x] `KIMI-W-01` Wire all 13 unwired R16/R17 modules into ralph-loop.ts (26 fields, 8 imports, 5 inline interfaces)
- [x] `KIMI-W-02` Lifecycle hooks system (HookRegistry, 6 phases, Zod schemas, 50 tests)
- [x] `KIMI-W-03` Behavior system (5 built-ins: retry, circuit-breaker, timeout, validate, backoff, 59 tests)
- [x] `KIMI-W-04` Edge case tests for 10 R17 modules (80 tests, API mismatches fixed by Claude)
- [x] `KIMI-W-05` Cross-module integration tests (25 tests across 5 integration categories)

### Next Sprint: R19 Feature Implementation
> Sprint file: `.prompts/kimi-r19-sprint.md` — READY

- [x] `KIMI-R19-01` Implement Mobile Launch Stage (spec: .nova/specs/grok-r19-01-mobile-launch.md, 42 tests) — DELIVERED, 12 files, 109 tests
- [x] `KIMI-R19-02` Implement Deep Semantic Model (spec: .nova/specs/grok-r19-02-semantic-model.md, 68 tests) — DELIVERED, 7 files, types.ts overwrite fixed by Claude
- [x] `KIMI-R19-03` Implement Studio Rules + Prompt Optimization (spec: .nova/specs/grok-r19-03-studio-rules.md, 94 tests) — DELIVERED, 9 files, 124 tests, evaluate bug fixed by Claude

### Queued: R20 Feature Implementation
> Sprint file: `.prompts/kimi-r20-sprint.md` — READY

- [x] `KIMI-R20-01` Implement L0/L1/L2/L3 orchestrator hierarchy (spec: .nova/specs/grok-r20-01-orchestrator-hierarchy.md, 112 tests) — DELIVERED, 11 files, 214 tests, 8 TS errors fixed by Claude
- [x] `KIMI-R20-02` Implement Tauri desktop wrapper (spec: .nova/specs/grok-r20-02-tauri-desktop.md, 87 tests) — DELIVERED, 11 files + 4 Rust files, 110 tests, detectTauri bug fixed by Claude
- [x] `KIMI-R20-03` Implement AI design pipeline (spec: .nova/specs/grok-r20-03-design-pipeline.md, 82 tests) — DELIVERED (source + tests), 10 files, 10 TS errors fixed by Claude
- [x] `KIMI-R21-01` Implement MCP integration (spec: .nova/specs/grok-r21-01-mcp-integration.md, 78 tests) — DELIVERED, 5 files, 2 TS errors fixed by Claude
- [x] `KIMI-R21-02` Implement ACP integration (spec: .nova/specs/grok-r21-02-acp-integration.md, 67 tests) — DELIVERED, 6 files
- [x] `KIMI-R21-03` Implement Compliance & Audit Trail (spec: .nova/specs/grok-r21-03-compliance-audit.md, 84 tests) — DELIVERED, 5 files, 1 TS error fixed by Claude
- [x] `KIMI-PERP-01` Implement Perplexity research integration — DELIVERED, committed (perplexity-agent.ts, types.ts, index.ts + 30 tests)
- [x] `KIMI-R22-01` Implement Agent Model Routing — DELIVERED, committed (router.ts, model-registry.ts, hardware-detector.ts, speculative-decoder.ts, inference-queue.ts + 80 tests), 1 TS error fixed by Claude
- [x] `KIMI-R23-01` Implement Persistent Visual Workflow Engine — DELIVERED, committed (ralph-visual-engine.ts, ralph-loop-visual-adapter.ts + 70 tests)
- [x] ~~`KIMI-R23-02` Implement MicroVM / WASI Ultra-Sandbox~~ **CUT** (Firecracker requires Linux KVM, no macOS)
- [x] `KIMI-R23-03` Implement Infinite Hierarchical Memory — DELIVERED, committed (infinite-memory-core.ts, letta-soul-manager.ts, mem0-adapter.ts, memory-taste-scorer.ts + 115 tests), 2 off-by-one test bugs fixed by Claude
- [x] ~~`KIMI-R23-04` Implement Agent Debate & Swarm Layer~~ **CUT** (over-engineered, expensive multi-model debate before product exists)
- [x] `KIMI-R23-05` Implement Cinematic Observability & Eval Suite — DELIVERED, committed (cinematic-core.ts, braintrust-adapter.ts, langsmith-bridge.ts + 60 tests)
- [x] `KIMI-R24-01` Implement AI Model Database — DELIVERED, committed (ai-model-vault.ts, ensemble-engine.ts, model-router.ts + 70 tests), 9 TS errors fixed by Claude
- [x] ~~`KIMI-R24-02` Implement Eternal Engine Rust Core~~ **CUT** (no Rust crate exists yet)
- [x] `KIMI-R24-03` Implement Real-time CRDT Collaboration — DELIVERED, committed (crdt-core.ts, types.ts, index.ts + 65 tests)
- [x] ~~`KIMI-R24-04` Implement Voice & Multimodal Interface~~ **CUT** (premature without working UI)

### Queued: R25 Testing Mega-Sprint
> Sprint file: `.prompts/kimi-r25-testing-mega-sprint.md` — READY

- [x] `KIMI-T-01` Write Perplexity Research tests — DONE (32 tests, delivered with source)
- [x] `KIMI-T-02` Write Model Routing tests — DONE (90 tests, delivered with source)
- [x] `KIMI-T-03` Write Workflow Engine tests — DONE (82 tests, delivered with source)
- [x] `KIMI-T-04` Write Infinite Memory tests — DONE (115 tests, delivered with source, 2 off-by-one fixes by Claude)
- [x] `KIMI-T-05` Write Cinematic Observability tests — DONE (73 tests, delivered with source)
- [x] `KIMI-T-06` Write AI Model Database tests — DONE (81 tests, delivered with source)
- [x] `KIMI-T-07` Write CRDT Collaboration tests — DONE (65 tests, delivered with source)

### Completed (recent)

- [x] R16-01→R16-04 implementation (portfolio, memory, generative-ui, testing)
- [x] R17-03→R17-12 mega-sprint (10 modules)
- [x] Overnight hardening (integration tests, 4 docs, monitoring script)
- [x] All 15 original M-01→M-15 CLI + agent tasks

---

## GROK — Research Architect

> Deliverable format: Deep TypeScript interfaces + integration points + open questions
> Style: Analogy opener → concrete interfaces → file paths → test strategy

### Current: R23 Gap Enhancement Specs

### Sprint: R23 Gap Enhancements + Shannon Adaptation

- [x] `GROK-R23-01` Persistent Visual Workflow Engine spec (Temporal + LangGraph) — DELIVERED
- [x] `GROK-R23-02` MicroVM / WASI Ultra-Sandbox spec (Firecracker + OPA) — DELIVERED
- [x] `GROK-R23-03` Infinite Hierarchical Memory spec (Mem0 + Letta) — DELIVERED
- [x] `GROK-R23-04` Agent Debate & Swarm Layer spec (CrewAI + AutoGen) — DELIVERED
- [x] `GROK-R23-05` Cinematic Observability & Eval Suite spec (Braintrust + LangSmith) — DELIVERED
- [x] `GROK-R24-01` AI Model Database spec (Gemini-12 research) — DELIVERED
- [x] `GROK-R24-02` Eternal Engine Rust Core Architecture spec (ZeroClaw/TinyClaw/NanoClaw) — DELIVERED
- [x] `GROK-R24-03` Real-time CRDT Collaboration spec (Gemini-15 research) — DELIVERED
- [x] `GROK-R24-04` Voice & Multimodal Interface spec (Gemini-13 research) — DELIVERED
- [ ] `GROK-R22-02` Shannon Patterns Adaptation Spec (Temporal replay + UCB router + WASI sandbox)

### Completed

- [x] R7→R17 (11 research rounds, 55+ feature specs)
- [x] R18 (5 specs: Dashboard, Deployment, VS Code, Integration Layer, Observability)
- [x] Claude skills analysis, JetBrains analysis, Rork/mobile analysis, exhaustive tools sweep
- [x] Perplexity Intelligence Division spec (accepted)
- [x] R19-01: Mobile Launch Stage spec (42 tests)
- [x] R19-02: Deep Project Semantic Model spec (68 tests)
- [x] R19-03: Studio Rules + DSPy Prompt Optimization spec (94 tests)
- [x] R20-01: Orchestrator-Worker L0/L1/L2/L3 Hierarchy spec (112 tests)
- [x] R20-02: Tauri Native Desktop Application spec (87 tests)
- [x] R20-03: AI-Native Design Pipeline spec (82 tests)
- [x] R21-01: MCP Integration spec (78 tests)
- [x] R21-02: ACP Integration spec (67 tests)
- [x] R21-03: Compliance & Audit Trail spec (84 tests)
- [x] R22-01: Agent Model Routing & Speculative Decoding spec (79 tests)
- [x] Shannon Patterns research (Kocoro-lab + KeygraphHQ reference architectures)

---

## KIRO — Knowledge Extraction + Quality Audits

> Constraint: NO TypeScript modifications. Outputs only: .md, .json under .nova/
> Commit format: `docs(knowledge): KIRO-XX-YY <description>`

### Current Sprint: Audit Remediation + Agent Template Extraction

- [x] `KIRO-06-01` Fix Nova26 INDEX.md — verified: 51/51 patterns already present (by Claude)
- [x] `KIRO-06-02` Fix 7 intelligence patterns — verified: all sections present (by Claude)
- [x] `KIRO-06-03` Fix 11 BistroLens hook filenames — camelCase → kebab-case + cross-ref updates (by Claude)
- [x] `KIRO-06-04` Fix stale reference in AI_COORDINATION.md — sun-prd-generator now exists (by Claude)
- [x] `KIRO-06-05` Extract patterns from 21 EARTH XML agent templates — 21 files, 35-42 lines each (by Claude)
- [x] `KIRO-06-06` Build agent interaction graph — 21 nodes, 89 edges, 6 clusters, JSON + ASCII (by Claude)
- [x] `KIRO-06-07` Re-run structural audit — 0 failures (down from 95), 18 files fixed (by Claude)

### Queued (all unblocked)

- [x] `KIRO-07-01` Extract patterns from Kimi lifecycle hooks + behaviors — DONE (2 patterns: lifecycle-hook-registry, feature-lifecycle-wiring)
- [x] `KIRO-07-02` Validate Kimi's mega-wiring sprint output — DONE (audit report: 46 imports, 38 config fields, 13 wired modules, 4 missing, P0 duplication found)
- [x] `KIRO-07-03` Extract patterns from Grok R19/R20 specs — DONE (5 patterns: multi-layer-hierarchy, semantic-model-graph, studio-rules-engine, mobile-launch-pipeline, tauri-desktop-bridge)
- [x] `KIRO-07-04` Extract patterns from Gemini research — DONE (synthesis report: 10 cross-report patterns, priority matrix, model-to-agent mapping)

### Completed

- [x] KIRO-01: 79 BistroLens patterns extracted
- [x] KIRO-02: Quality audit + cross-reference mapping + Nova26 extraction
- [x] KIRO-03: 104 pattern nodes + 93 edges, unified manifest
- [x] KIRO-04: Audit spec created, 4 scripts written, 140 patterns validated with fast-check
- [x] KIRO-05: ESM bug fixed, all 4 audit scripts ran clean, 99.6% doc accuracy, 140-node dependency map

---

## GEMINI — Deep Research + Competitive Intelligence

> Output format: Structured research reports with priority matrix
> Style: Exhaustive, every tool analyzed, priority-ranked

### Current: GEMINI-07

- [ ] `GEMINI-07` Agent communication protocols & multi-agent UX (MCP, ACP, A2A, orchestration patterns, marketplace)
- [ ] `GEMINI-08` Developer productivity metrics & benchmarking (DORA, SPACE, Nova26-specific metrics, analytics dashboard)
- [ ] `GEMINI-09` AI-native testing & quality assurance (AI code bugs, auto-fix patterns, eval frameworks, quality gates)
- [ ] `GEMINI-10` Enterprise self-hosted deployment (Docker/K8s, SSO/RBAC, SOC 2, FedRAMP, update management)
- [ ] `GEMINI-11` AI design systems & component generation (design tokens, shadcn, multi-screen journeys, screenshot-to-code)

### Delivered: GEMINI-12 (Frontier Research)

- [x] `GEMINI-12` AI Model Database — 4 categories, 21 agent-to-model mappings, JSON schema, auto-update strategy, priority matrix — DELIVERED, saved to .nova/research/gemini-12-model-intelligence.md
- [ ] `GEMINI-13` Voice & Multimodal AI Interfaces (speech-to-intent, Whisper/Deepgram, image grounding, screen sharing for agents)
- [ ] `GEMINI-14` Edge AI & On-Device Inference (MLX for Apple Silicon, NVIDIA NIM, TinyML, on-device fine-tuning, hybrid cloud/edge)
- [ ] `GEMINI-15` Real-time Collaboration & CRDT Sync (multiplayer coding, CRDT libraries, Yjs/Automerge, conflict resolution for agents)

### Completed

- [x] GEMINI-01: 2026 AI ecosystem audit — 11 categories, 30+ tools analyzed, 4-phase roadmap
- [x] GEMINI-02: World-class UX patterns — 20 must-steal patterns, 9 categories, implementation roadmap
- [x] GEMINI-03: Mobile ecosystem deep dive — React Native + Expo SDK 54 recommended, Maestro for testing
- [x] GEMINI-04: Monetization & GTM — Sovereign Tier pricing ($12/$25/$45), PLG playbook, path to $1M ARR
- [x] GEMINI-05: EU AI Act compliance — Article 86 roadmap, OTel GenAI tracing, audit trail schema
- [x] GEMINI-06: Local SLM optimization — Qwen 3.5 Coder king, hardware-tiered configs, agent-to-model routing

---

## CLAUDE CODE — Coordinator + Core Engine

> Domain: Evaluation, prompt writing, ralph-loop.ts, convex/, .claude/, Zod schemas
> Role: Evaluate all agent output, write sprint prompts, implement critical features

### Downtime Tasks (self-assigned)

- [x] `CL-20` ~~Evaluate Kimi mega-wiring sprint output~~ DONE — all 13 modules wired, W-01→W-05 delivered, 243 new tests (9 edge case files had API mismatches → fixed)
- [x] `CL-21` ~~Evaluate Grok R19 specs~~ DONE — all 3 accepted, 204 test cases, specs saved to .nova/specs/
- [x] `CL-22` ~~Evaluate Gemini-01 research~~ DONE — 30+ tools analyzed, 4-phase roadmap, 2 new Gemini tasks added
- [x] `CL-23` ~~Evaluate Kiro audit reports~~ DONE — 87 failures triaged, KIRO-06 sprint created (7 remediation tasks)
- [x] `CL-24` ~~Write Kimi sprint prompts from Grok R19 specs~~ DONE — `.prompts/kimi-r19-sprint.md` (3 tasks, 204+ tests)
- [x] `CL-25` ~~Remaining 11 agent templates to EARTH XML format~~ DONE — all 21/21 agents converted
- [x] `CL-26` ~~Update MISSING_FEATURES.md~~ DONE — 13 features marked as implemented
- [x] `CL-27` ~~Update TASK-BOARD.md progress summary~~ DONE — comprehensive update with new Grok/Gemini/Kimi assignments
- [x] `CL-28` ~~Evaluate Gemini-02→06 research~~ DONE — all 5 accepted, findings integrated into MISSING_FEATURES.md
- [x] `CL-29` ~~Write Kimi sprint prompts from Grok R20 specs~~ DONE — `.prompts/kimi-r20-sprint.md` (2 tasks, 199+ tests)
- [x] `CL-30` ~~Evaluate Grok R20 specs~~ DONE — both accepted, 199 test cases, specs saved to .nova/specs/

### New Tasks

- [x] `CL-31` ~~Evaluate Kimi R19 sprint output~~ DONE — R19-01 + R19-02 delivered (22 files, 112 new tests), fixed types.ts overwrite + 20 TS errors, R19-03 pending
- [x] `CL-32` ~~Evaluate Grok R20-03 spec~~ DONE — accepted, 82 tests, saved to .nova/specs/
- [x] `CL-33` ~~Write Kimi sprint from Grok R21 specs~~ DONE — `.prompts/kimi-r21-sprint.md` (3 tasks, 229+ tests)
- [x] `CL-34` ~~Evaluate Grok R21 specs~~ DONE — all 3 accepted (MCP 78, ACP 67, Compliance 84 = 229 tests)
- [ ] `CL-35` Evaluate Gemini-07→11 research (extract actionable features)
- [x] `CL-36` ~~Write Kimi sprint from Grok R22 spec~~ DONE — `.prompts/kimi-r22-sprint.md` (1 task, 79 tests)
- [x] `CL-37b` ~~Save Grok spec summaries + Shannon research to .nova/~~ DONE — 5 specs + 1 research file
- [x] `CL-38` ~~Update MISSING_FEATURES.md~~ DONE — R19 marked complete, R20-R22 updated, R23 gaps + frontier features added, 77 features tracked
- [x] `CL-39` ~~Evaluate Kimi R19-03 output~~ DONE — 9 files, 124 tests, evaluate() bug fixed (both Claude + Kimi found it independently)
- [x] `CL-40` ~~Evaluate Kimi R20-01 + R20-02 output~~ DONE — R20-01: 11 source + 7 test files (214 tests), R20-02: 6 source + 4 test files + 4 Rust (110 tests), 8 TS errors + 1 bug fixed
- [x] `CL-41` ~~Write Grok R23 research prompts~~ DONE — `.prompts/grok-r23.md` (5 specs)
- [x] `CL-42` ~~Write Gemini-12→15 research prompts~~ DONE — 4 frontier research topics
- [x] `CL-43` ~~Write Kimi R20 continuation prompt~~ DONE — R19 complete, begin R20-01
- [ ] `CL-44` Evaluate Gemini-12→15 research (when delivered)
- [ ] `CL-45` Write Grok R24 specs from Gemini frontier research (when delivered)
- [x] `CL-46` ~~Evaluate Grok R23 specs + write Kimi R23 sprint~~ DONE — R23+R24 combined into mega-sprint `.prompts/kimi-r22-r24-mega-sprint.md` (7 tasks, 440+ tests; 4 cut as premature)
- [x] `CL-47` ~~Evaluate Kimi R21 test files~~ DONE — 317 tests (97 MCP + 110 ACP + 110 compliance), all pass, ESM .js imports, no `any`
- [x] `CL-48` ~~KIRO-06-07 structural audit~~ DONE — 95→0 failures, 18 files fixed (INDEX, 14 pattern files, scan-utils.ts, audit report)
- [x] `CL-49` ~~KIRO-07 pattern extraction~~ DONE — 7 new patterns, 2 audit reports, INDEX 51→58
- [x] `CL-50` ~~Delete CUT module artifacts~~ DONE — deleted src/sandbox/, src/swarm/, src/engine/, src/multimodal/ + cleaned swarm imports from CLI
- [x] `CL-51` ~~Evaluate + commit Kimi R22-R24 source~~ DONE — 35 files (18K lines), 7 modules committed, 0 `any`, ESM .js imports correct, 2 test bugs fixed
- [ ] `CL-52` Wire R22-R24 modules into RalphLoopOptions — assigned to Sonnet
- [ ] `CL-53` Wire R22-R24 into lifecycle hooks — assigned to Sonnet
- [ ] `CL-54` Create barrel exports for new modules — assigned to Sonnet
- [ ] `CL-55` Cross-module R22-R24 integration tests (40+ tests) — assigned to Sonnet
- [ ] `CL-56` Update TASK-BOARD + CLAUDE.md — assigned to Sonnet

### Completed (recent)

- [x] C-01→C-10 core engine enhancements
- [x] Implemented R16-05 Wellbeing, R17-01 Recovery, R17-02 Init (319 new tests)
- [x] Wired wellbeing, recovery, init into ralph-loop.ts
- [x] Created all sprint prompts through R20 + Gemini research prompts
- [x] Evaluated Grok R7→R18 (all accepted)
- [x] XML-restructured all 21 agent templates to EARTH format (CL-25)
- [x] Updated MISSING_FEATURES.md (CL-26)

---

## PERPLEXITY — Research + Documentation (Paused)

### Remaining

- [ ] `P-07` Create unified documentation portal
- [ ] `P-08` Write DEPLOYMENT.md
- [ ] `P-09` Write CONTRIBUTING.md
- [ ] `P-10` Create interactive tutorial
- [ ] `P-11` Write SECURITY.md
- [ ] `P-12` Create onboarding script documentation

### Completed

- [x] P-01→P-06 (competitive analysis, orchestration research, Convex, compliance, video gen, streaming)

---

## Progress Summary

| Agent | Active Tasks | Completed | Next Up |
|-------|-------------|-----------|---------|
| Claude Code | CL-52→56, coordination | 80+ | Wire R22-R24 into RalphLoopOptions + lifecycle, integration tests |
| Sonnet | S-01-01→05 | S-01-03/06 done by Claude | P0 dedup → wire 4 modules → failure handler → integration tests |
| Kimi | R25 testing sprint (7 tasks) | 55+ | T-01→T-07 (445+ tests for 7 KEEP modules) |
| Grok | GROK-R22-02 (Shannon) | 80+ | R23+R24 done, Shannon adaptation pending |
| Kiro | — | 31+ | KIRO-07 complete, 58 total patterns, awaiting KIRO-08 |
| Gemini | GEMINI-07→15 | 7 | 07-11 current → 13-15 frontier research |
| Perplexity | P-07→P-12 (paused) | 6 | Documentation portal |

---

## Coordination Rules

1. **Task board is truth**: Every agent checks this file for its next assignment
2. **Report to Jon**: When you finish, report output to Jon. He gives you a return prompt.
3. **Claude evaluates**: All agent output goes through Claude for quality check before next task
4. **Quality bar**: All code must compile (`tsc --noEmit` = 0 errors), all tests must pass
5. **No overlapping files**: Agents only modify files in their domain
6. **Sprint files**: Detailed instructions live in `.prompts/` — task board has the overview
