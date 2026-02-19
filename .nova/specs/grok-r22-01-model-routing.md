# Grok R22-01: Agent-Specific Model Routing & Speculative Decoding
## Source: Grok Research Round 22-01 (Feb 19, 2026)
## Status: Accepted

## Key Interfaces

### HardwareTier
- id: 'low'|'mid'|'high'|'ultra'|'apple-silicon'
- gpuVendor, vramGB, ramGB, cpuCores, recommendedQuant

### ModelProfile
- name (e.g. "qwen3.5-coder:32b-q5"), family, strength, quant
- contextWindow, tokensPerSec, costFactor, speculativeDraft

### AgentModelMapping
- agentId, primary: ModelProfile, fallback: ModelProfile[]
- confidenceThreshold (0-1), maxConcurrent, tasteVaultWeight

### ModelRoutingConfig
- enabled, autoDetectHardware, defaultTier, agentMappings
- speculativeDecoding: SpeculativeDecodingConfig, queueEnabled, benchmarkOnStartup

### SpeculativeDecodingConfig
- enabled, draftModel ("nemotron3-nano:8b-q4"), verifyModel
- draftTokens, acceptanceRateTarget (0.65 default)

### InferenceMetrics
- agentId, modelUsed, tokensIn/Out, durationMs, confidence, energyWh, timestamp

## Default Agent-Model Mapping (from Gemini-06)
- MARS/PLUTO → Qwen 3.5 Coder (heavy code gen)
- VENUS/EUROPA → Kimi K2.5 (multimodal/UI)
- MERCURY/CHARON → MiniMax M2.5 (validation/debugging)
- SUN/JUPITER → DeepSeek-V3.2 (reasoning)
- NEPTUNE/IO → MiMo-V2-Flash (low latency)

## File Structure
src/model-routing/
├── index.ts, types.ts, hardware-detector.ts, model-registry.ts
├── router.ts, speculative-decoder.ts, inference-queue.ts
├── benchmark/ (nova-bench.ts, results.json)
├── ollama-modelfile-generator.ts, metrics-tracker.ts
└── __tests__/routing.test.ts

## RalphLoopOptions Addition
modelRoutingConfig: { enabled, speculativeDecoding: {enabled, acceptanceRateTarget: 0.68}, queueEnabled, benchmarkOnStartup, forceTier: null }

## Key Features
- Hardware auto-detection (Apple Silicon, NVIDIA, CPU-only)
- Confidence-based escalation (start fast, upgrade if confidence < threshold)
- Speculative decoding: Nemotron-3-Nano draft + Qwen-3.5 verify = 2.5x throughput
- Auto-generated Ollama Modelfiles per hardware tier
- Inference queue with priority (Taste Vault weight + urgency)
- Nova-Bench suite (42 role-specific benchmark tasks)

## Test Strategy
79 vitest cases: hardware detection, agent mapping, confidence escalation, speculative decoding, queue fairness, Modelfile generation, Nova-Bench regression, metrics tracking, chaos fallback
