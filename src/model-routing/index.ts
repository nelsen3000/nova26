// Agent Model Routing — Barrel Export
// KIMI-R22-01 | Feb 2026

export * from './types.js';
export * from './hardware-detector.js';
export * from './model-registry.js';
export * from './router.js';
export * from './speculative-decoder.js';
export * from './inference-queue.js';
export * from './metrics-tracker.js';
export * from './ollama-modelfile-generator.js';
export { NOVA_BENCH_TASKS, runNovaBench, computeBenchSummary } from './benchmark/nova-bench.js';

// Default routing config
import type { ModelRoutingConfig } from './types.js';

export const DEFAULT_MODEL_ROUTING_CONFIG: ModelRoutingConfig = {
  enabled: true,
  autoDetectHardware: true,
  defaultTier: 'mid',
  agentMappings: [],  // Uses DEFAULT_AGENT_MAPPINGS from model-registry
  speculativeDecoding: {
    enabled: true,
    draftModel: 'nemotron3-nano:8b-q4',
    verifyModel: 'qwen3.5-coder:32b-q5',
    draftTokens: 8,
    acceptanceRateTarget: 0.68,
  },
  queueEnabled: true,
  benchmarkOnStartup: false,
  forceTier: null,
};
