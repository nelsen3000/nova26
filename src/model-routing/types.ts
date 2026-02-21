// Agent Model Routing — Type Definitions
// KIMI-R22-01 | Feb 2026

export type HardwareTierId = 'low' | 'mid' | 'high' | 'ultra' | 'apple-silicon';
export type GpuVendor = 'nvidia' | 'amd' | 'apple' | 'none';
export type QuantizationLevel = 'q4' | 'q5' | 'q6' | 'q8' | 'fp16' | 'bf16';
export type ModelFamily =
  | 'qwen'
  | 'deepseek'
  | 'kimi'
  | 'nemotron'
  | 'mimo'
  | 'minimax'
  | 'gemini'
  | 'claude'
  | 'gpt'
  | 'grok'
  | 'glm'
  | 'llama'
  | 'phi';

export type ModelStrength =
  | 'code'
  | 'reasoning'
  | 'multimodal'
  | 'embedding'
  | 'fast'
  | 'balanced';

export interface HardwareTier {
  id: HardwareTierId;
  gpuVendor: GpuVendor;
  vramGB: number;
  ramGB: number;
  cpuCores: number;
  recommendedQuant: QuantizationLevel;
  maxConcurrentInferences: number;
}

export interface ModelProfile {
  name: string;            // e.g. "qwen3.5-coder:32b-q5"
  family: ModelFamily;
  strength: ModelStrength;
  quant: QuantizationLevel;
  contextWindow: number;   // tokens
  tokensPerSec: number;    // on reference hardware (mid tier)
  costFactor: number;      // relative to baseline (1.0 = cheapest)
  vramRequiredGB: number;
  speculativeDraft?: boolean; // can be used as draft model?
  ollamaTag: string;       // exact ollama pull tag
}

export interface AgentModelMapping {
  agentId: string;
  primary: ModelProfile;
  fallback: ModelProfile[];
  confidenceThreshold: number;  // 0-1; below this → escalate
  maxConcurrent: number;
  tasteVaultWeight: number;     // 0-1; priority boost from user preferences
}

export interface SpeculativeDecodingConfig {
  enabled: boolean;
  draftModel: string;             // e.g. "nemotron3-nano:8b-q4"
  verifyModel: string;            // e.g. "qwen3.5-coder:32b-q5"
  draftTokens: number;            // tokens to speculatively generate per step
  acceptanceRateTarget: number;   // 0-1; aim for this acceptance rate
}

export interface ModelRoutingConfig {
  enabled: boolean;
  autoDetectHardware: boolean;
  defaultTier: HardwareTierId;
  agentMappings: AgentModelMapping[];
  speculativeDecoding: SpeculativeDecodingConfig;
  queueEnabled: boolean;
  benchmarkOnStartup: boolean;
  forceTier: HardwareTierId | null;
}

export interface InferenceMetrics {
  agentId: string;
  modelUsed: string;
  tokensIn: number;
  tokensOut: number;
  durationMs: number;
  confidence: number;        // 0-1 from model output
  energyWh: number;          // estimated watt-hours
  timestamp: number;         // Unix ms
  wasEscalated: boolean;
  speculativeAcceptanceRate?: number;
}

export interface QueuedInferenceTask {
  id: string;
  agentId: string;
  prompt: string;
  priority: number;          // 0-100; higher = sooner
  enqueuedAt: number;        // Unix ms
  timeoutMs: number;
  tasteVaultWeight: number;
  resolve: (result: InferenceResult) => void;
  reject: (err: Error) => void;
}

export interface InferenceResult {
  agentId: string;
  modelUsed: string;
  output: string;
  confidence: number;
  tokensIn: number;
  tokensOut: number;
  durationMs: number;
  escalated: boolean;
}

export interface BenchmarkTask {
  id: string;
  agentId: string;
  role: string;
  prompt: string;
  expectedKeywords: string[];
  timeoutMs: number;
  complexity: 'low' | 'medium' | 'high';
}

export interface BenchmarkResult {
  taskId: string;
  agentId: string;
  modelUsed: string;
  durationMs: number;
  passed: boolean;
  score: number;           // 0-100
  keywordsFound: string[];
  timestamp: number;
}

export interface OllamaModelfile {
  agentId: string;
  hardwareTier: HardwareTierId;
  modelName: string;
  content: string;         // Full Modelfile text
}
