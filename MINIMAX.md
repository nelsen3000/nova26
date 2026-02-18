# MiniMax Task File — NOVA26

> Owner: MiniMax
> Domains: src/orchestrator/, src/gates/, src/atlas/, src/agents/, model router

---

## Phase 1 — COMPLETE ✅

- [x] Task 1: Structured Output with Instructor JS (`src/llm/structured-output.ts`)
- [x] Task 2: Parallel Task Execution (`src/orchestrator/parallel-runner.ts`)
- [x] Task 3: Observability with Langfuse (`src/observability/tracer.ts`)
- [x] Task 4: Real Code Validation with Piston (`src/gates/piston-client.ts`, `typescript-gate.ts`, `test-runner-gate.ts`)

## Phase 2 — IN PROGRESS 🔄

- [ ] Task 5: Wire ParallelRunner into RalphLoop
  - `src/orchestrator/ralph-loop.ts` — use `parallelRunner.runPhase()` for concurrent tasks
  - Extract `processTask()` helper
  - Sequential fallback if `ParallelRunner.checkAvailability()` returns false

- [ ] Task 6: Real MERCURY LLM Validation Gate
  - `src/orchestrator/gate-runner.ts` — replace keyword matching with actual MERCURY LLM call
  - Load `.nova/agents/MERCURY.md` as system prompt
  - Parse APPROVED / NEEDS REVISION / REJECTED from response
  - Graceful fallback if Ollama unavailable

- [ ] Task 7: ATLAS Convex Integration
  - Create `src/atlas/convex-logger.ts`
  - Calls Claude's `convex/atlas.ts` mutations via HTTP API
  - Mutation paths: `atlas:startBuild`, `atlas:logTask`, `atlas:logExecution`,
    `atlas:logLearning`, `atlas:completeBuild`
  - Wire into `ralph-loop.ts`
  - No-op gracefully if `CONVEX_URL` not set

- [ ] Task 8: SUN Agent PRD Generator CLI
  - `nova26 generate "<request>" <output-prd-file>`
  - NOTE: `src/agents/sun-prd-generator.ts` already exists (stub)
  - Improve it to match the full spec in COORDINATION.md Phase 2

- [ ] Task 9: Model Router Upgrade
  - `src/llm/ollama-client.ts` or new `src/llm/model-router.ts`
  - JUPITER/MERCURY/ENCELADUS → `qwen2.5:14b`
  - Others → `qwen2.5:7b`
  - `NOVA26_MODEL_OVERRIDE` env var support

## Verification

After all Phase 2 tasks:
```bash
npx tsc --noEmit          # 0 errors
npx tsx src/test/mock-run.ts         # 3/3 pass
npx tsx src/test/integration-test.ts # 25/25 pass
```

---

## Requests TO Other Agents

### → Claude
- Please update `src/llm/structured-output.ts` SunSchema if the PRD format changes.

### → Kimi
- When gate-runner.ts loads `.nova/agents/MERCURY.md` as a system prompt,
  ensure MERCURY.md has a clear OUTPUT FORMAT section specifying:
  APPROVED / NEEDS REVISION / REJECTED at the top of its response.
  (Current MERCURY.md may need this added.)
