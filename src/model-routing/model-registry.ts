// Model Registry — Catalog of all supported models
// KIMI-R22-01 | Feb 2026

import type { ModelProfile, AgentModelMapping } from './types.js';

// ─── Model Catalog ────────────────────────────────────────────────────────────

export const MODELS: Record<string, ModelProfile> = {
  'qwen3.5-coder:32b-q5': {
    name: 'qwen3.5-coder:32b-q5',
    family: 'qwen',
    strength: 'code',
    quant: 'q5',
    contextWindow: 131072,
    tokensPerSec: 28,
    costFactor: 1.0,
    vramRequiredGB: 22,
    speculativeDraft: false,
    ollamaTag: 'qwen2.5-coder:32b-instruct-q5_K_M',
  },
  'qwen3.5-coder:7b-q5': {
    name: 'qwen3.5-coder:7b-q5',
    family: 'qwen',
    strength: 'code',
    quant: 'q5',
    contextWindow: 131072,
    tokensPerSec: 68,
    costFactor: 0.4,
    vramRequiredGB: 6,
    speculativeDraft: true,
    ollamaTag: 'qwen2.5-coder:7b-instruct-q5_K_M',
  },
  'deepseek-v3.2:32b-q5': {
    name: 'deepseek-v3.2:32b-q5',
    family: 'deepseek',
    strength: 'reasoning',
    quant: 'q5',
    contextWindow: 65536,
    tokensPerSec: 24,
    costFactor: 1.2,
    vramRequiredGB: 22,
    speculativeDraft: false,
    ollamaTag: 'deepseek-r1:32b-q5_K_M',
  },
  'kimi-k2.5:14b-q6': {
    name: 'kimi-k2.5:14b-q6',
    family: 'kimi',
    strength: 'multimodal',
    quant: 'q6',
    contextWindow: 128000,
    tokensPerSec: 38,
    costFactor: 1.4,
    vramRequiredGB: 12,
    speculativeDraft: false,
    ollamaTag: 'llava:13b-v1.6-mistral-q6_K',
  },
  'nemotron3-nano:8b-q4': {
    name: 'nemotron3-nano:8b-q4',
    family: 'nemotron',
    strength: 'fast',
    quant: 'q4',
    contextWindow: 32768,
    tokensPerSec: 180,
    costFactor: 0.1,
    vramRequiredGB: 5,
    speculativeDraft: true,
    ollamaTag: 'nemotron-mini:4b-instruct-q4_K_M',
  },
  'mimo-v2-flash:7b-q4': {
    name: 'mimo-v2-flash:7b-q4',
    family: 'mimo',
    strength: 'fast',
    quant: 'q4',
    contextWindow: 32768,
    tokensPerSec: 220,
    costFactor: 0.08,
    vramRequiredGB: 4,
    speculativeDraft: true,
    ollamaTag: 'phi3.5:3.8b-mini-instruct-q4_K_M',
  },
  'minimax-m2.5:8b-q5': {
    name: 'minimax-m2.5:8b-q5',
    family: 'minimax',
    strength: 'balanced',
    quant: 'q5',
    contextWindow: 65536,
    tokensPerSec: 55,
    costFactor: 0.6,
    vramRequiredGB: 6,
    speculativeDraft: false,
    ollamaTag: 'mistral:7b-instruct-v0.3-q5_K_M',
  },
  'phi-4:14b-q5': {
    name: 'phi-4:14b-q5',
    family: 'phi',
    strength: 'code',
    quant: 'q5',
    contextWindow: 16384,
    tokensPerSec: 45,
    costFactor: 0.5,
    vramRequiredGB: 10,
    speculativeDraft: false,
    ollamaTag: 'phi4:14b-q5_K_M',
  },
};

// ─── Default Agent-to-Model Mappings (from Gemini-06 + Gemini-12) ────────────

export const DEFAULT_AGENT_MAPPINGS: AgentModelMapping[] = [
  {
    agentId: 'MARS',
    primary: MODELS['qwen3.5-coder:32b-q5']!,
    fallback: [MODELS['qwen3.5-coder:7b-q5']!, MODELS['phi-4:14b-q5']!],
    confidenceThreshold: 0.75,
    maxConcurrent: 2,
    tasteVaultWeight: 0.8,
  },
  {
    agentId: 'PLUTO',
    primary: MODELS['qwen3.5-coder:32b-q5']!,
    fallback: [MODELS['phi-4:14b-q5']!, MODELS['nemotron3-nano:8b-q4']!],
    confidenceThreshold: 0.85,  // security needs high confidence
    maxConcurrent: 1,
    tasteVaultWeight: 0.3,
  },
  {
    agentId: 'VENUS',
    primary: MODELS['kimi-k2.5:14b-q6']!,
    fallback: [MODELS['minimax-m2.5:8b-q5']!, MODELS['qwen3.5-coder:7b-q5']!],
    confidenceThreshold: 0.70,
    maxConcurrent: 2,
    tasteVaultWeight: 0.9,
  },
  {
    agentId: 'ANDROMEDA',
    primary: MODELS['kimi-k2.5:14b-q6']!,
    fallback: [MODELS['minimax-m2.5:8b-q5']!],
    confidenceThreshold: 0.70,
    maxConcurrent: 2,
    tasteVaultWeight: 0.9,
  },
  {
    agentId: 'EUROPA',
    primary: MODELS['kimi-k2.5:14b-q6']!,
    fallback: [MODELS['minimax-m2.5:8b-q5']!, MODELS['qwen3.5-coder:7b-q5']!],
    confidenceThreshold: 0.70,
    maxConcurrent: 2,
    tasteVaultWeight: 0.7,
  },
  {
    agentId: 'MERCURY',
    primary: MODELS['minimax-m2.5:8b-q5']!,
    fallback: [MODELS['qwen3.5-coder:7b-q5']!, MODELS['nemotron3-nano:8b-q4']!],
    confidenceThreshold: 0.72,
    maxConcurrent: 3,
    tasteVaultWeight: 0.6,
  },
  {
    agentId: 'CHARON',
    primary: MODELS['minimax-m2.5:8b-q5']!,
    fallback: [MODELS['qwen3.5-coder:7b-q5']!, MODELS['deepseek-v3.2:32b-q5']!],
    confidenceThreshold: 0.72,
    maxConcurrent: 2,
    tasteVaultWeight: 0.5,
  },
  {
    agentId: 'SUN',
    primary: MODELS['deepseek-v3.2:32b-q5']!,
    fallback: [MODELS['qwen3.5-coder:32b-q5']!, MODELS['minimax-m2.5:8b-q5']!],
    confidenceThreshold: 0.80,
    maxConcurrent: 1,
    tasteVaultWeight: 0.7,
  },
  {
    agentId: 'JUPITER',
    primary: MODELS['deepseek-v3.2:32b-q5']!,
    fallback: [MODELS['qwen3.5-coder:32b-q5']!, MODELS['minimax-m2.5:8b-q5']!],
    confidenceThreshold: 0.80,
    maxConcurrent: 1,
    tasteVaultWeight: 0.6,
  },
  {
    agentId: 'NEPTUNE',
    primary: MODELS['mimo-v2-flash:7b-q4']!,
    fallback: [MODELS['nemotron3-nano:8b-q4']!, MODELS['minimax-m2.5:8b-q5']!],
    confidenceThreshold: 0.60,
    maxConcurrent: 4,
    tasteVaultWeight: 0.4,
  },
  {
    agentId: 'IO',
    primary: MODELS['mimo-v2-flash:7b-q4']!,
    fallback: [MODELS['nemotron3-nano:8b-q4']!],
    confidenceThreshold: 0.55,  // latency-critical: accept lower confidence
    maxConcurrent: 4,
    tasteVaultWeight: 0.4,
  },
  {
    agentId: 'EARTH',
    primary: MODELS['qwen3.5-coder:32b-q5']!,
    fallback: [MODELS['deepseek-v3.2:32b-q5']!, MODELS['minimax-m2.5:8b-q5']!],
    confidenceThreshold: 0.78,
    maxConcurrent: 2,
    tasteVaultWeight: 0.8,
  },
  {
    agentId: 'SATURN',
    primary: MODELS['minimax-m2.5:8b-q5']!,
    fallback: [MODELS['qwen3.5-coder:7b-q5']!],
    confidenceThreshold: 0.70,
    maxConcurrent: 2,
    tasteVaultWeight: 0.6,
  },
  {
    agentId: 'GANYMEDE',
    primary: MODELS['minimax-m2.5:8b-q5']!,
    fallback: [MODELS['qwen3.5-coder:7b-q5']!, MODELS['nemotron3-nano:8b-q4']!],
    confidenceThreshold: 0.70,
    maxConcurrent: 3,
    tasteVaultWeight: 0.5,
  },
  {
    agentId: 'URANUS',
    primary: MODELS['deepseek-v3.2:32b-q5']!,
    fallback: [MODELS['minimax-m2.5:8b-q5']!],
    confidenceThreshold: 0.78,
    maxConcurrent: 1,
    tasteVaultWeight: 0.7,
  },
  {
    agentId: 'TITAN',
    primary: MODELS['qwen3.5-coder:32b-q5']!,
    fallback: [MODELS['deepseek-v3.2:32b-q5']!],
    confidenceThreshold: 0.78,
    maxConcurrent: 2,
    tasteVaultWeight: 0.6,
  },
  {
    agentId: 'CALLISTO',
    primary: MODELS['kimi-k2.5:14b-q6']!,
    fallback: [MODELS['minimax-m2.5:8b-q5']!],
    confidenceThreshold: 0.72,
    maxConcurrent: 2,
    tasteVaultWeight: 0.8,
  },
  {
    agentId: 'ENCELADUS',
    primary: MODELS['qwen3.5-coder:32b-q5']!,
    fallback: [MODELS['phi-4:14b-q5']!, MODELS['nemotron3-nano:8b-q4']!],
    confidenceThreshold: 0.75,
    maxConcurrent: 2,
    tasteVaultWeight: 0.6,
  },
  {
    agentId: 'MIMAS',
    primary: MODELS['deepseek-v3.2:32b-q5']!,
    fallback: [MODELS['qwen3.5-coder:32b-q5']!],
    confidenceThreshold: 0.78,
    maxConcurrent: 1,
    tasteVaultWeight: 0.5,
  },
  {
    agentId: 'TRITON',
    primary: MODELS['minimax-m2.5:8b-q5']!,
    fallback: [MODELS['mimo-v2-flash:7b-q4']!],
    confidenceThreshold: 0.65,
    maxConcurrent: 3,
    tasteVaultWeight: 0.7,
  },
  {
    agentId: 'ATLAS',
    primary: MODELS['qwen3.5-coder:7b-q5']!,
    fallback: [MODELS['nemotron3-nano:8b-q4']!],
    confidenceThreshold: 0.60,
    maxConcurrent: 4,
    tasteVaultWeight: 0.5,
  },
];

export function getAgentMapping(agentId: string): AgentModelMapping | undefined {
  return DEFAULT_AGENT_MAPPINGS.find(m => m.agentId === agentId);
}

export function getAllModels(): ModelProfile[] {
  return Object.values(MODELS);
}

export function getModelByName(name: string): ModelProfile | undefined {
  return MODELS[name];
}

export function getDraftModels(): ModelProfile[] {
  return Object.values(MODELS).filter(m => m.speculativeDraft === true);
}
