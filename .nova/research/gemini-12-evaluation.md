# CL-44: Gemini-12 Evaluation — Model Intelligence Database

**Date**: 2026-02-20
**Status**: ACCEPTED — all 6 sections actionable

---

## Verdict

**Accepted without corrections.** The Gemini-12 Model Intelligence Database is the most concrete and immediately actionable research delivered so far. It directly answers "which model does each agent use?" with a 21-agent routing table and a priority-ranked list of models to support first.

---

## Key Findings

### 1. Agent-to-Model Mapping (4-tier system)
Every agent now has a defined routing table: Quality → Fallback → Speed → Budget.

Key assignments:
- **EARTH (Orchestrator)**: Gemini 3.1 Pro (Quality), Qwen 3.5 Full (Fallback)
- **JUPITER (Architecture)**: Claude Opus 4.6 (Quality), GLM-5 (Fallback)
- **SUN (PRD)**: Claude Opus 4.6 (Quality), Claude Haiku 4.5 (Speed)
- **MARS (Deployment)**: Qwen 3.5 Coder (Quality), Nemotron 3 Nano (Budget)
- **IO (Real-time)**: MiMo-V2-Flash (Quality), Nemotron 3 Nano (Fallback)
- **ATLAS (Memory)**: Voyage 3.5 embedding (Quality)
- **CALLISTO (Portfolio)**: Gemini 3 Pro multimodal (Quality)

### 2. Priority Order for Model Support
1. Qwen 3.5 Coder — open, highest local priority (SWE-bench SOTA at 80.2%)
2. Claude Opus 4.6 — required for JUPITER + SUN high-stakes tasks
3. Gemini 3.1 Pro — EARTH orchestration (10M context, ARC-AGI-2 leader)
4. MiniMax M2.5 — GANYMEDE + CHARON agentic debugging
5. Nemotron 3 Nano — speculative decoding draft model

### 3. New Model Landscape Highlights
- **Qwen 3.5 Coder**: 397B open model, $0.15/$1.00 per M — best cost/quality for code
- **Gemini 3.1 Pro**: 1.5T+ params, 77.1% ARC-AGI-2, 10M context window
- **MiMo-V2-Flash**: <0.2s latency — critical for IO (real-time) agent
- **Voyage 3.5**: Best enterprise RAG embeddings — ATLAS should use this
- **GPT-5.3 Codex**: $10/$40 per M — positioned as premium alternative to Qwen

### 4. JSON Schema
The benchmark database schema is clean and well-designed. It covers: model_id, metadata, technical_specs (context_window, latency_ms, throughput_tps), benchmarks array, pricing, and a `non_coder_info` section for user-facing descriptions.

---

## Actionable Features Extracted

| Feature | Priority | File Target |
|---------|----------|-------------|
| Create `src/llm/models/agent-model-map.json` with 21-agent routing table | P0 | New file |
| Update `src/llm/model-router.ts` to read agent-model-map at runtime | P0 | Existing file |
| Add MiMo-V2-Flash as IO agent's preferred model in router | P1 | model-router.ts |
| Create model benchmark DB at `src/llm/models/benchmark-db.json` | P1 | New file |
| Add Voyage 3.5 as ATLAS embedding model option | P1 | model-router.ts |
| Nemotron 3 Nano as speculative decoder draft model | P1 | speculative-decoder.ts |
| Add `non_coder_info` display to dashboard agent cards | P2 | app/dashboard/agents/page.tsx |

---

## Open Questions Answered (for Jon)

1. **$1 = 1 chip**: Yes, this is the right conversion rate for user-facing cost tracking. Implement in ATLAS billing tab.
2. **PLUTO local-only**: Yes — PLUTO (Security) should force local models (Qwen 3.5 Coder, Nemotron 3 Nano) for data sovereignty. The "Sovereign Tier" feature.
3. **Hardware tier override**: Yes — manual toggle is needed. Add to Settings → Advanced → Model Overrides.

---

## Next Steps

- **CL-44b**: Create `src/llm/models/agent-model-map.json` (P0)
- **KIMI-R24-01**: Implement AI Model Database full spec (`.nova/specs/grok-r24-immortal-omniverse.md`)
- **Gemini-13→15**: Still pending delivery (Voice, Edge AI, CRDT research)
