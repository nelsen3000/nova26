/**
 * Nova26 AI Model Database
 * KIMI-R24-01 - Type Definitions
 */

// ============================================================================
// Model Metadata Types
// ============================================================================

export interface ModelMetadata {
  id: string;
  name: string;
  provider: string;
  family: string;
  version: string;
  capabilities: ModelCapabilities;
  contextWindow: number;
  pricing: {
    inputPerMToken: number;
    outputPerMToken: number;
  };
  benchmarks: Record<string, number>;
  lastUpdated: string;
}

export interface ModelCapabilities {
  code: number; // 0-100
  reasoning: number;
  multimodal: number;
  speed: number;
  cost: number;
  localAvailable: boolean;
  quantizations: string[];
}

// ============================================================================
// Routing Types
// ============================================================================

export interface ModelRoute {
  agentId: string;
  taskType: string;
  selectedModel: ModelMetadata;
  confidence: number;
  reasoning: string;
  alternatives: ModelMetadata[];
}

export interface JonFeedback {
  routeId: string;
  modelId: string;
  rating: 1 | 2 | 3 | 4 | 5;
  comment?: string;
  timestamp: string;
}

// ============================================================================
// Ensemble Types
// ============================================================================

export interface EnsembleDebateResult {
  winner: string;
  reasoning: string;
  votes: ModelVote[];
  consensusScore: number;
}

export interface ModelVote {
  modelId: string;
  response: string;
  confidence: number;
  votedFor: string;
}

// ============================================================================
// Provider Sync Types
// ============================================================================

export interface SyncResult {
  added: number;
  updated: number;
  removed: number;
  errors: string[];
}

export interface ProviderModelInfo {
  id: string;
  name: string;
  capabilities: Partial<ModelCapabilities>;
  contextWindow: number;
  pricing: {
    inputPerMToken: number;
    outputPerMToken: number;
  };
  benchmarks?: Record<string, number>;
}

// ============================================================================
// Affinity & Taste Types
// ============================================================================

export interface ModelAffinity {
  modelId: string;
  agentId: string;
  taskType: string;
  score: number; // 0-100
  feedbackCount: number;
  lastFeedbackAt: string;
}

export interface TasteProfile {
  userId: string;
  preferredProviders: string[];
  preferredFamilies: string[];
  capabilityWeights: {
    code: number;
    reasoning: number;
    multimodal: number;
    speed: number;
    cost: number;
  };
  taskPreferences: Record<string, string[]>; // taskType -> preferred model IDs
}

// ============================================================================
// Performance Types
// ============================================================================

export interface RoutingMetrics {
  totalRoutes: number;
  avgLatencyMs: number;
  p50LatencyMs: number;
  p99LatencyMs: number;
  cacheHitRate: number;
  feedbackIncorporated: number;
}

export interface ModelPerformance {
  modelId: string;
  avgResponseTimeMs: number;
  successRate: number;
  userRating: number;
  costPerRequest: number;
  tokensPerSecond: number;
}
