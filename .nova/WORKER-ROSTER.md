# NOVA26 OPERATION ETERNAL FLAME — Final Worker Roster
## February 20, 2026

> **Locked**: Sonnet 4.6, Haiku 4, Kimi 2.5, Kiro (planning only)
> **OpenRouter**: 2 additional workers via aider
> **Browser agents**: Perplexity, Grok, ChatGPT, Gemini (unchanged)

---

## CODING WORKERS (6 total)

| # | Worker | Model | Platform | Role | Cost/1M tokens (approx) |
|---|--------|-------|----------|------|------------------------|
| 1 | **Sonnet 4.6** | Claude Sonnet 4.6 | Claude terminal | The Architect — wiring, auth, engine bridge | $3/$15 (in/out) |
| 2 | **Haiku 4** | Claude Haiku 4 | Claude terminal | Backend Glue — Convex functions, deployment | $0.25/$1.25 (in/out) |
| 3 | **Kimi 2.5** | Kimi 2.5 | Kimi terminal (swarm) | The Implementer — PERP-01, R22-01, R23-05 | Free/cheap |
| 4 | **DeepSeek V3** | deepseek/deepseek-chat | OpenRouter via aider | Frontend Builder — dashboard UI, components | ~$0.27/$1.10 (in/out) |
| 5 | **Qwen 3 235B** | qwen/qwen3-235b-a22b | OpenRouter via aider | Overflow — R23/R24 features, tests | ~$0.20/$0.60 (in/out) |
| 6 | **GLM 5** | (keep or swap) | OpenRouter or direct | Backup/parallel frontend | Varies |

### Why this roster works:

**Rate limit isolation**: 3 different providers (Anthropic, Kimi, OpenRouter). If Anthropic throttles, Kimi and OpenRouter keep going. If OpenRouter has issues, the Claude terminals keep going.

**Cost efficiency**: Haiku 4 is ~12x cheaper than Sonnet for output tokens. DeepSeek V3 is ~14x cheaper than Sonnet. Qwen 3 235B is ~25x cheaper. You get 6 workers for roughly the cost of 2 Sonnet instances.

**Capability matching**:
- Sonnet 4.6 gets the hardest work (auth integration, engine bridge) — needs strong reasoning
- Haiku 4 gets well-specified Convex functions — just needs to follow the schema and write validators
- Kimi 2.5 gets spec-driven implementation — detailed specs with test counts already defined
- DeepSeek V3 gets React/Tailwind/shadcn dashboard — strong at frontend, follows patterns well
- Qwen 3 235B gets overflow/Wave 3 features — MoE model, cheap, good at TypeScript

### GLM 5 decision:
Keep GLM 5 as a 6th worker if you want maximum parallelism. Drop it if 5 workers feels like enough to manage. My recommendation: **start with 5, add GLM 5 only if you need it in Wave 2/3**.

---

## HOW TO CONNECT OPENROUTER WORKERS TO YOUR TERMINAL

### Step 1: Install aider (one-time setup)

```bash
# Install aider via pip (requires Python 3.8+)
python3 -m pip install aider-install
aider-install

# Or if you prefer pipx:
pipx install aider-chat
```

### Step 2: Set your OpenRouter API key

```bash
# Add to your shell profile (~/.zshrc on macOS)
export OPENROUTER_API_KEY=your-key-here

# Then reload:
source ~/.zshrc
```

### Step 3: Launch a DeepSeek V3 worker

```bash
cd /path/to/nova26

# DeepSeek V3 — Frontend Builder
aider --model openrouter/deepseek/deepseek-chat \
  --no-auto-commits \
  --map-tokens 2048
```

### Step 4: Launch a Qwen 3 235B worker

```bash
cd /path/to/nova26

# Qwen 3 235B — Overflow Worker
aider --model openrouter/qwen/qwen3-235b-a22b \
  --no-auto-commits \
  --map-tokens 2048
```

### Key aider flags:
- `--no-auto-commits` — don't auto-commit, you control when to commit
- `--map-tokens 2048` — limits repo map size to save context
- `--read FILE` — add a file as read-only context (use for specs)
- `--file FILE` — add a file as editable

### Running a sprint task in aider:

```bash
# Example: Give DeepSeek the dashboard task
# In the aider session, type:

/read .nova/24HR-BATTLE-PLAN.md
/read convex/schema.ts
/add app/(dashboard)/layout.tsx
/add app/(dashboard)/page.tsx
/add app/components/sidebar.tsx

# Then paste the task prompt from the battle plan
```

### Alternative: If aider doesn't work well

You can also use OpenRouter models through:
1. **Kilo Code** (VS Code extension) — supports OpenRouter natively
2. **Continue** (VS Code extension) — supports OpenRouter
3. **Direct API calls** via curl/script — for batch file generation

---

## REVISED TASK ASSIGNMENTS

| Task | Worker | Why This Worker |
|------|--------|----------------|
| Next.js + Convex wiring | Sonnet 4.6 | Complex integration, needs strong reasoning |
| Convex Auth integration | Sonnet 4.6 | Auth is tricky, Sonnet handles edge cases |
| Engine → Convex bridge | Sonnet 4.6 | Needs to understand ralph-loop internals |
| Convex dashboard functions | Haiku 4 | Well-defined schema, just write queries/mutations |
| Convex realtime functions | Haiku 4 | Same — follow schema, write validators |
| Deployment config | Haiku 4 | Boilerplate — vercel.json, .env, convex config |
| Dashboard UI shell (4 pages) | DeepSeek V3 | Strong at React/Tailwind, cheap for large output |
| Dashboard components | DeepSeek V3 | Same — lots of JSX output, DeepSeek handles it |
| Activity feed (real-time) | DeepSeek V3 | React + Convex hooks, well-specified |
| KIMI-PERP-01 (Perplexity) | Kimi 2.5 | Has the spec, proven track record |
| KIMI-R22-01 (model routing) | Kimi 2.5 | Has the spec, 79 tests defined |
| KIMI-R23-05 (observability) | Kimi 2.5 | Has the spec, 60 tests defined |
| R23-01 Visual Workflow | Qwen 3 235B | Wave 3 overflow, spec-driven |
| R23-03 Infinite Memory | Qwen 3 235B | Wave 3 overflow, spec-driven |
| R24-01 AI Model Database | Qwen 3 235B | Wave 3 overflow, spec-driven |
| R24-03 CRDT Collaboration | Qwen 3 235B | Wave 3 overflow, spec-driven |

---

## SPRINT WORKFLOW (per worker)

Each worker gets a 2-hour atomic chunk. The prompt format:

```
=== NOVA26 SPRINT CHUNK — [WORKER NAME] — [WAVE].[CHUNK] ===

CONTEXT: [paste unified worker context]
YOUR DOMAIN: [list of files you own]
DO NOT TOUCH: [list of files outside your domain]

TASK: [specific task description]
SPEC: [link to spec file if applicable]
EXPECTED OUTPUT: [list of files to create/modify]
TESTS: [number of tests expected]
DONE WHEN: [specific completion criteria]

GO.
```

---

## COST ESTIMATE (24-hour sprint)

Assuming ~50K tokens input + ~100K tokens output per worker per 2-hour chunk:

| Worker | Chunks | Input Cost | Output Cost | Total |
|--------|--------|-----------|-------------|-------|
| Sonnet 4.6 | 4 | $0.60 | $6.00 | ~$6.60 |
| Haiku 4 | 4 | $0.05 | $0.50 | ~$0.55 |
| Kimi 2.5 | 3 | ~free | ~free | ~$0 |
| DeepSeek V3 | 4 | $0.05 | $0.44 | ~$0.50 |
| Qwen 3 235B | 4 | $0.04 | $0.24 | ~$0.28 |
| **TOTAL** | | | | **~$8** |

That's roughly $8 for the entire 24-hour sprint across 5 coding workers. Even if usage is 3x higher than estimated, you're looking at ~$25 max. The OpenRouter workers are essentially free compared to running multiple Opus instances.

---

*Generated by Kiro (Opus 4.6) — February 20, 2026*
