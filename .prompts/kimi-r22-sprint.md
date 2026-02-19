# Kimi Sprint: R22 Feature Implementation
## 1 Task | 79+ Tests | TypeScript Strict | ESM `.js` Imports

> **Pre-requisite**: R19 + R20 + R21 sprints should ideally be complete first.
> **Repo**: https://github.com/nelsen3000/nova26
> **Branch**: `main` (or feature branch if preferred)
> **Rules**: TypeScript strict, ESM `.js` imports, vitest, no `any`, mock all I/O, no real API calls

---

## Task 1: KIMI-R22-01 — Agent-Specific Model Routing & Speculative Decoding

**Spec**: `.nova/specs/grok-r22-01-model-routing.md`
**Tests**: 79 vitest cases minimum

### What to Build

Create `src/model-routing/` module for intelligent per-agent model selection.

```
src/model-routing/
├── index.ts
├── types.ts
├── hardware-detector.ts           ← GPU/VRAM/RAM auto-detect
├── model-registry.ts              ← all model profiles + Modelfile generator
├── router.ts                      ← confidence-based routing + agent mapping
├── speculative-decoder.ts         ← draft/verify pipeline
├── inference-queue.ts             ← priority queue + GPU lock management
├── benchmark/
│   ├── nova-bench.ts              ← 42 role-specific benchmark tasks
│   └── results.json               ← persisted results
├── ollama-modelfile-generator.ts  ← auto-generate per hardware tier
├── metrics-tracker.ts             ← per-agent inference metrics
└── __tests__/routing.test.ts
```

### Key Interfaces to Implement

```typescript
export interface HardwareTier {
  id: 'low' | 'mid' | 'high' | 'ultra' | 'apple-silicon';
  gpuVendor: 'nvidia' | 'apple' | 'none';
  vramGB: number;
  ramGB: number;
  cpuCores: number;
  recommendedQuant: 'q4' | 'q5' | 'q8' | 'fp16' | 'fp32';
}

export interface ModelProfile {
  name: string; // e.g. "qwen3.5-coder:32b-q5"
  family: string;
  strength: 'code' | 'ui' | 'reasoning' | 'validation' | 'fast';
  quant: string;
  contextWindow: number;
  tokensPerSec: number;
  costFactor: number;
  speculativeDraft?: string;
}

export interface AgentModelMapping {
  agentId: string;
  primary: ModelProfile;
  fallback: ModelProfile[];
  confidenceThreshold: number; // 0-1
  maxConcurrent: number;
  tasteVaultWeight: number;
}

export interface ModelRoutingConfig {
  enabled: boolean;
  autoDetectHardware: boolean;
  defaultTier: HardwareTier['id'];
  agentMappings: AgentModelMapping[];
  speculativeDecoding: SpeculativeDecodingConfig;
  queueEnabled: boolean;
  benchmarkOnStartup: boolean;
}

export interface SpeculativeDecodingConfig {
  enabled: boolean;
  draftModel: string; // "nemotron3-nano:8b-q4"
  verifyModel: string;
  draftTokens: number;
  acceptanceRateTarget: number; // 0.65 default
}

export interface InferenceMetrics {
  agentId: string;
  modelUsed: string;
  tokensIn: number;
  tokensOut: number;
  durationMs: number;
  confidence: number;
  energyWh?: number;
  timestamp: string;
}
```

### Default Agent-Model Mapping (from Gemini-06 Research)

| Agent Role | Primary Model | Strength |
|-----------|--------------|----------|
| MARS / PLUTO | Qwen 3.5 Coder (397B-A17B) | Heavy code generation |
| VENUS / EUROPA | Kimi K2.5 | Multimodal / UI / vision |
| MERCURY / CHARON | MiniMax M2.5 | Validation / debugging |
| SUN / JUPITER | DeepSeek-V3.2 (Thinking) | Multi-step reasoning |
| NEPTUNE / IO | Xiaomi MiMo-V2-Flash | Low latency metrics |

### RalphLoopOptions Addition

```typescript
modelRoutingEnabled?: boolean;
modelRoutingConfig?: {
  speculativeDecoding: { enabled: boolean; acceptanceRateTarget: number };
  queueEnabled: boolean;
  benchmarkOnStartup: boolean;
  forceTier?: HardwareTier['id'] | null;
};
```

### Key Implementation Notes

- **Hardware auto-detection**: Run on first launch + every RalphLoop start
  - Apple Silicon: detect via `sysctl` or `os.cpus()`
  - NVIDIA: detect via `nvidia-smi` (mock in tests)
  - Graceful fallback to CPU-only tier
- **Confidence-based escalation**: Start with fast/small model → if confidence < threshold, silently upgrade
- **Speculative decoding**: Nemotron-3-Nano as draft + Qwen 3.5 as verifier = 2.5x throughput
  - Draft model generates N tokens, verifier accepts/rejects in batch
- **Ollama Modelfile generation**: Auto-creates optimized Modelfiles per hardware tier
  - Include: FROM, PARAMETER (num_ctx, temperature, top_p, repeat_penalty, num_predict), SYSTEM
- **Inference queue**: Priority based on Taste Vault weight + task urgency
  - GPU lock management for concurrent agents
- **Nova-Bench**: 42 role-specific benchmark tasks (mock results in tests)
  - Quality-to-Latency Ratio (QLR) = ACE Score / Total Seconds
- **Metrics tracking**: Every inference logged with tokens, duration, confidence, energy
- **Integration with existing**: `ollama-client.ts` and `model-router.ts` — router becomes single source of truth

### Test Requirements (79 cases)

- Hardware detection accuracy across 6 configs (M1-M4, RTX 4090, CPU-only)
- Agent mapping + confidence escalation (42 role-specific paths)
- Speculative decoding acceptance rate & speed-up verification
- Queue fairness under 12 concurrent agents
- Modelfile generation + validation
- Nova-Bench regression (quality scores per agent)
- Metrics tracking + calculation accuracy
- Chaos: GPU overload, model not found → graceful fallback
- End-to-end: multiple agents → correct models selected + metrics logged

---

## Final Checklist

After implementing:
1. `npx tsc --noEmit` → 0 errors
2. `npx vitest run` → all tests pass (target: 79+ new tests)
3. Barrel exports in `index.ts`
4. No `any` types (use `unknown` + type guards)
5. All I/O mocked (especially hardware detection + Ollama calls)
6. ESM `.js` imports throughout
