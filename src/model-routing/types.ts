/**
 * Nova26 Model Routing & Speculative Decoding Module
 * KIMI-R22-01 - Type Definitions
 */

export type HardwareTierId = 'low' | 'mid' | 'high' | 'ultra' | 'apple-silicon';

export interface HardwareTier {
  id: HardwareTierId;
  gpuVendor: string | null;
  vramGB: number;
  ramGB: number;
  cpuCores: number;
  recommendedQuant: string;
}

export interface ModelProfile {
  name: string;
  family: string;
  strength: string;
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
  confidenceThreshold: number;
  maxConcurrent: number;
  tasteVaultWeight: number;
}

export interface ModelRoutingConfig {
  enabled: boolean;
  autoDetectHardware: boolean;
  defaultTier: HardwareTierId;
  agentMappings: AgentModelMapping[];
  speculativeDecoding: SpeculativeDecodingConfig;
  queueEnabled: boolean;
  benchmarkOnStartup: boolean;
}

export interface SpeculativeDecodingConfig {
  enabled: boolean;
  draftModel: string;
  verifyModel: string;
  draftTokens: number;
  acceptanceRateTarget: number;
}

export interface InferenceMetrics {
  agentId: string;
  modelUsed: string;
  tokensIn: number;
  tokensOut: number;
  durationMs: number;
  confidence: number;
  energyWh: number;
  timestamp: number;
}

// Additional types for router and queue operations

export interface ModelRouteResult {
  agentId: string;
  selectedModel: ModelProfile;
  fallbackChain: ModelProfile[];
  useSpeculativeDecoding: boolean;
  estimatedTokensPerSec: number;
  estimatedCost: number;
  confidence: number;
  queuePosition?: number;
}

export interface DecodeResult {
  output: string;
  tokensGenerated: number;
  draftTokens: number;
  acceptedTokens: number;
  acceptanceRate: number;
  speedupFactor: number;
  durationMs: number;
}

export interface InferenceRequest {
  id: string;
  agentId: string;
  prompt: string;
  priority: number;
  timestamp: number;
  maxTokens: number;
  temperature: number;
  timeoutMs: number;
}
