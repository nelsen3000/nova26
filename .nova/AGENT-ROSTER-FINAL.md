# NOVA26 OPERATION ETERNAL FLAME — Final Agent Roster & Setup Guide
## February 20, 2026

> **Goal**: 9 coding workers + 4 browser agents, rate limits spread across 5 providers
> **Philosophy**: Cheap but correct. Maximum parallelism. Ship the cockpit.

---

## LOCKED ROSTER — 9 Coding Workers

| # | Worker | Model | Provider | Role | Cost | Rate Limit Risk |
|---|--------|-------|----------|------|------|-----------------|
| 1 | **Sonnet 4.6** | claude-sonnet-4-20250514 | Anthropic (terminal) | The Architect — wiring, auth, bridge | $$ | Medium |
| 2 | **Haiku 4** | claude-haiku-4-20250414 | Anthropic (terminal) | Backend Glue — Convex functions, deploy | $ | Low (own tier) |
| 3 | **Kimi 2.5** | kimi-2.5 | Moonshot (swarm) | The Implementer — PERP-01, R22-01 | $ | Low |
| 4 | **DeepSeek V3.2** | deepseek/deepseek-chat | OpenRouter (aider) | Frontend Builder — dashboard UI | ¢ | Very Low |
| 5 | **Qwen 3 Coder** | qwen/qwen3-coder-480b | OpenRouter (aider) | Feature Worker — R23 features | ¢ | Very Low |
| 6 | **GLM 5** | zhipu/glm-5 | OpenRouter (aider) | R24 Feature Worker — CRDT, Model DB | $ | Low |
| 7 | **Mistral Large** | mistralai/mistral-large | OpenRouter (aider) | The Fixer — TS errors, test validation, integration QA | $ | Very Low |
| 8 | **Llama 4 Maverick** | meta-llama/llama-4-maverick | OpenRouter (aider) | Wave 3 Parallel — Visual Workflow, Memory | ¢ | Very Low |
| 9 | **Kiro** | Claude Opus 4.6 | Kiro IDE | Coordinator ONLY — no code | $$ | N/A (planning) |

### Why This Roster

**9 workers across 5 providers**: Anthropic (Sonnet + Haiku), Moonshot (Kimi), DeepSeek, Qwen, Meta/Mistral/GLM via OpenRouter. Maximum parallelism, minimum rate limit risk.

**The two new workers solve real bottlenecks:**

**Mistral Large — "The Fixer"**: In every previous sprint, Claude Code spent 30-50% of its time fixing TS errors and API mismatches in other agents' output (CL-31 through CL-48 on the task board). Having a dedicated fixer means the other 7 workers never stop to debug. Mistral reviews output, runs `tsc --noEmit`, fixes errors, runs `vitest run`, and reports back. This is the force multiplier — it makes every other worker faster.

**Llama 4 Maverick — "Wave 3 Parallel"**: Without it, Wave 3 has 5 features fighting for 2-3 workers. With Maverick, each R23/R24 feature gets its own dedicated worker running in parallel. The difference between attempting 2 frontier features and attempting 5.

**Cost strategy**: DeepSeek V3.2 is ~$0.28/M input, $0.42/M output — roughly 20x cheaper than Sonnet. Qwen 3 Coder and Llama 4 Maverick are similar or cheaper. Mistral Large is mid-range. For a full sprint producing ~500K tokens of code per worker, the 5 OpenRouter workers cost under $10 total combined.

**Why keep GLM 5**: It's already in the plan, you're familiar with it, and it's decent at React/TypeScript. Now it gets a dedicated domain (R24 features) instead of being overflow.

---

## SETUP GUIDE — Connecting OpenRouter Workers via Aider

Aider is a terminal-based AI coding assistant that connects to any model via OpenRouter. It can read/write files, run commands, and work in your git repo. Perfect for sprint-style work.

### Step 1: Install Aider (one time)

```bash
# Install aider
python3 -m pip install aider-install
aider-install

# Or if you prefer brew
brew install aider
```

### Step 2: Set Your OpenRouter API Key

```bash
# Add to your shell profile (~/.zshrc on macOS)
export OPENROUTER_API_KEY=your-key-here

# Reload
source ~/.zshrc
```

### Step 3: Launch Workers (one terminal per worker)

Open 5 separate terminal tabs/windows, one for each OpenRouter worker:

**Terminal A — DeepSeek V3.2 (Frontend Builder)**
```bash
cd /path/to/nova26
aider --model openrouter/deepseek/deepseek-chat \
  --no-auto-commits \
  --map-tokens 4096
```

**Terminal B — Qwen 3 Coder (Feature Worker)**
```bash
cd /path/to/nova26
aider --model openrouter/qwen/qwen3-coder-480b-a35b \
  --no-auto-commits \
  --map-tokens 4096
```

**Terminal C — GLM 5 (R24 Features)**
```bash
cd /path/to/nova26
aider --model openrouter/zhipu/glm-5 \
  --no-auto-commits \
  --map-tokens 4096
```

**Terminal D — Mistral Large (The Fixer)**
```bash
cd /path/to/nova26
aider --model openrouter/mistralai/mistral-large \
  --no-auto-commits \
  --map-tokens 4096
```

**Terminal E — Llama 4 Maverick (Wave 3 Parallel)**
```bash
cd /path/to/nova26
aider --model openrouter/meta-llama/llama-4-maverick \
  --no-auto-commits \
  --map-tokens 4096
```

### Step 4: Add Files to Each Worker's Context

Once aider is running, add the files each worker needs:

**DeepSeek (Frontend):**
```
/add convex/schema.ts
/add app/(landing)/page.tsx
```
Then paste the GLM 5 "Frontend Builder" prompt from the battle plan.

**Qwen (Features):**
```
/add src/integrations/
/add src/observability/
```
Then paste the relevant KIMI task prompt.

**GLM (Overflow):**
```
/add app/components/
```
Then paste whatever task is next in the queue.

### Aider Sprint Workflow

For each 2-hour chunk:
1. Paste the task prompt into aider
2. Let it generate files
3. Review the output
4. Run `npx tsc --noEmit` to check for errors
5. Run `vitest run` to check tests
6. If issues, paste the error back into aider and say "fix this"
7. When clean, move to next task

Key aider commands:
- `/add <file>` — add file to context
- `/drop <file>` — remove file from context
- `/run <command>` — execute shell command
- `/diff` — show pending changes
- `/undo` — revert last change
- `/clear` — clear conversation history (saves tokens)

---

## REVISED TASK ASSIGNMENTS

### Wave 1 (Hours 0-8): MVP Cockpit — ALL 8 WORKERS IN PARALLEL

| Worker | Task | Domain | Hours |
|--------|------|--------|-------|
| Sonnet 4.6 | Next.js wiring + Convex provider | `next.config.*`, `app/layout.tsx`, `app/providers.tsx` | 0-2h |
| Sonnet 4.6 | Convex Auth integration | `app/(auth)/`, auth middleware | 2-4h |
| Sonnet 4.6 | Engine → Convex bridge | `src/convex/bridge.ts` | 4-6h |
| Sonnet 4.6 | Integration fixes, blocker resolution | Any file in domain | 6-8h |
| Haiku 4 | Convex dashboard functions | `convex/dashboard.ts`, `convex/auth.ts` | 0-3h |
| Haiku 4 | Convex realtime + users functions | `convex/realtime.ts`, `convex/users.ts` | 3-5h |
| Haiku 4 | Deployment config | `vercel.json`, `.env.local.example`, `convex.json` | 5-7h |
| Haiku 4 | Deploy to Vercel + Convex cloud | Production deployment | 7-8h |
| DeepSeek V3.2 | Dashboard layout + sidebar + overview page | `app/(dashboard)/layout.tsx`, `page.tsx`, `app/components/sidebar.tsx` | 0-3h |
| DeepSeek V3.2 | Builds page + Agents page + Settings page | `app/(dashboard)/builds/`, `agents/`, `settings/` | 3-6h |
| DeepSeek V3.2 | Real-time activity feed component | `app/components/activity-feed.tsx` | 6-8h |
| Kimi 2.5 | KIMI-PERP-01 Perplexity integration | `src/integrations/perplexity-client.ts` + tests | 0-3h |
| Kimi 2.5 | KIMI-R22-01 Agent Model Routing (start) | `src/llm/model-router.ts` + tests | 3-8h |
| Qwen 3 Coder | Agent card + build row + activity item components | `app/components/agent-card.tsx`, `build-row.tsx`, `activity-item.tsx` | 0-4h |
| Qwen 3 Coder | Loading skeletons + error boundaries | `app/components/` polish components | 4-8h |
| GLM 5 | Landing → Dashboard navigation + auth redirect | `app/(landing)/` fixes, auth-gated routing | 0-4h |
| GLM 5 | Mobile responsive polish (375px, 768px, 1024px) | `app/(dashboard)/` responsive fixes | 4-8h |
| Mistral Large | Review ALL output from other workers, run `tsc --noEmit` | Fix TS errors across all domains | 2-8h (rolling) |
| Llama 4 Maverick | KIMI-R23-05 Observability eval framework | `src/observability/eval-framework.ts` + tests | 0-8h |

### Wave 2 (Hours 8-16): R22 Features + Hardening

| Worker | Task | Domain | Hours |
|--------|------|--------|-------|
| Sonnet 4.6 | Integration testing — verify auth + dashboard + Convex | End-to-end validation | 8-12h |
| Haiku 4 | Additional Convex functions for new features | `convex/` new files as needed | 8-12h |
| DeepSeek V3.2 | Dashboard polish — empty states, CTAs, animations | `app/(dashboard)/`, `app/components/` | 8-12h |
| Kimi 2.5 | KIMI-R22-01 Agent Model Routing (finish) | `src/llm/model-router.ts` + remaining tests | 8-12h |
| Qwen 3 Coder | KIMI-R23-01 Visual Workflow Engine (start) | `src/workflow/` | 8-14h |
| GLM 5 | KIMI-R24-01 AI Model Database (start) | `src/model-db/` | 8-14h |
| Mistral Large | Review Wave 1 output, fix all TS errors, run vitest | All domains | 8-12h (rolling) |
| Llama 4 Maverick | KIMI-R23-03 Infinite Hierarchical Memory | `src/memory/` | 8-14h |

### Wave 3 (Hours 16-24): R23/R24 Frontier — Maximum Parallel

| Worker | Task | Domain | Hours |
|--------|------|--------|-------|
| Sonnet 4.6 | Final integration, smoke testing, production fixes | All domains | 16-24h |
| Haiku 4 | Production deploy + monitoring + hotfixes | Deployment | 16-24h |
| DeepSeek V3.2 | KIMI-R24-03 CRDT Collaboration | `src/collaboration/` | 16-22h |
| Kimi 2.5 | KIMI-R23-01 Visual Workflow (if not done) or R24 overflow | `src/workflow/` or next feature | 16-22h |
| Qwen 3 Coder | KIMI-R23-01 Visual Workflow Engine (finish) | `src/workflow/` | 14-20h |
| GLM 5 | KIMI-R24-01 AI Model Database (finish) | `src/model-db/` | 14-20h |
| Mistral Large | Final QA pass — all files, all tests, all TS errors | All domains | 16-24h |
| Llama 4 Maverick | KIMI-R23-03 Infinite Memory (finish) or R24 overflow | `src/memory/` | 14-20h |

---

## FILE DOMAIN MAP (UPDATED — 8 WORKERS, NO OVERLAPS)

| Worker | Owns | Can Read | Cannot Touch |
|--------|------|----------|-------------|
| Sonnet 4.6 | `next.config.*`, `tailwind.config.*`, `app/layout.tsx`, `app/providers.tsx`, `app/(auth)/`, `src/orchestrator/`, `src/convex/` | Everything | `src/mcp/`, `src/acp/` |
| Haiku 4 | `convex/*.ts` (NOT schema.ts), `vercel.json`, `.env*`, `convex.json` | `convex/schema.ts`, `app/` | `src/`, `app/(landing)/` |
| DeepSeek V3.2 | `app/(dashboard)/layout.tsx`, `app/(dashboard)/page.tsx`, `app/(dashboard)/builds/`, `app/(dashboard)/agents/`, `app/(dashboard)/settings/` | `convex/schema.ts` | `src/`, `convex/*.ts` (functions) |
| Kimi 2.5 | `src/integrations/`, `src/llm/`, `src/swarm/` | `src/`, `.nova/specs/` | `convex/`, `app/` |
| Qwen 3 Coder | `src/workflow/`, `app/components/agent-card.tsx`, `app/components/build-row.tsx`, `app/components/activity-item.tsx` | `src/`, `.nova/specs/`, `app/` | `convex/` |
| GLM 5 | `app/(landing)/` (fixes), `src/collaboration/` (Wave 3), mobile responsive polish | `src/`, `app/` | `convex/` |
| Mistral Large | ALL domains (read+fix only) — TS error fixing, test validation | Everything | Cannot CREATE new files — only fix existing |
| Llama 4 Maverick | `src/observability/`, `src/memory/`, `src/model-db/` | `src/`, `.nova/specs/` | `convex/`, `app/` |

---

## RATE LIMIT SAFETY NET (8 WORKERS, 5 PROVIDERS)

If any worker hits rate limits:

| Throttled Worker | Provider | Failover Strategy |
|-----------------|----------|-------------------|
| Sonnet 4.6 | Anthropic | Haiku keeps going (different tier). Shift Sonnet's remaining tasks to DeepSeek via OpenRouter. |
| Haiku 4 | Anthropic | Sonnet keeps going. Shift Haiku's Convex tasks to Sonnet (same domain knowledge). |
| Kimi 2.5 | Moonshot | Shift KIMI tasks to Qwen 3 Coder (both strong at TypeScript + spec implementation). |
| DeepSeek V3.2 | OpenRouter/DeepSeek | Swap to Qwen 3 Coder or Llama 4 Maverick for frontend tasks. Same aider, different `--model`. |
| Qwen 3 Coder | OpenRouter/Qwen | Swap to DeepSeek V3.2 or Llama 4 Maverick. |
| GLM 5 | OpenRouter/Zhipu | Swap to any other OpenRouter model. GLM's tasks are lower priority. |
| Mistral Large | OpenRouter/Mistral | Swap to DeepSeek V3.2 for fixing duties (cheap + fast). Or pause fixing and let workers self-fix. |
| Llama 4 Maverick | OpenRouter/Meta | Swap to Qwen 3 Coder or GLM 5. Wave 3 features are parallelizable. |

**Provider distribution**: Anthropic (2), Moonshot (1), OpenRouter (5 models across 5 orgs: DeepSeek, Qwen, Zhipu, Mistral, Meta). OpenRouter rate limits are per-model, so 5 different models = 5 independent rate limit buckets. No single point of failure.

---

## COST ESTIMATE (24 hours, 8 coding workers)

| Worker | Est. Tokens | Cost |
|--------|-------------|------|
| Sonnet 4.6 | ~2M in + 500K out | ~$10-15 |
| Haiku 4 | ~2M in + 500K out | ~$2-3 |
| Kimi 2.5 | ~2M in + 500K out | ~$2-3 |
| DeepSeek V3.2 | ~3M in + 800K out | ~$1-2 |
| Qwen 3 Coder | ~2M in + 500K out | ~$1-2 |
| GLM 5 | ~1M in + 300K out | ~$1-2 |
| Mistral Large | ~3M in + 600K out | ~$3-5 |
| Llama 4 Maverick | ~2M in + 500K out | ~$1-2 |
| Kiro (me) | Planning only | Included |
| **TOTAL** | | **~$21-34** |

Still under $35 for the entire 24-hour sprint with 8 parallel coding workers. The browser agents (Perplexity, Grok, ChatGPT, Gemini) are free or included in existing subscriptions.

---

*Generated by Kiro (Opus 4.6) — February 20, 2026*
