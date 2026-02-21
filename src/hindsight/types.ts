// Hindsight Persistent Memory - Core Types
// Spec: .kiro/specs/hindsight-persistent-memory/design.md

// ═══════════════════════════════════════════════════════════════════════════════
// Memory Fragment Types
// ═══════════════════════════════════════════════════════════════════════════════

export type MemoryType = 'episodic' | 'procedural' | 'semantic';

export interface MemoryProvenance {
  sourceType: 'task' | 'retrospective' | 'build' | 'pattern' | 'user' | 'system';
  sourceId: string;
  timestamp: number;
  agentId: string;
  projectId?: string;
}

export interface MemoryFragment {
  id: string;
  content: string;
  type: MemoryType;
  namespace: string; // {projectId}:{agentId} format
  agentId: string;
  projectId: string;
  relevance: number; // 0.0–1.0
  confidence: number; // 0.0–1.0
  embedding: number[];
  accessCount: number;
  lastAccessedAt: number;
  createdAt: number;
  updatedAt: number;
  expiresAt?: number;
  isPinned: boolean;
  isArchived: boolean;
  tags: string[];
  provenance: MemoryProvenance;
  extra?: Record<string, unknown>;
}

export interface MemoryFragmentInput {
  content: string;
  type: MemoryType;
  agentId: string;
  projectId: string;
  relevance?: number;
  confidence?: number;
  embedding?: number[];
  tags?: string[];
  provenance?: Partial<MemoryProvenance>;
  extra?: Record<string, unknown>;
  isPinned?: boolean;
  expiresAt?: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════════════════

export interface HindsightConfig {
  // Storage backend
  storageType: 'sqlite' | 'convex' | 'memory';
  storagePath?: string; // For SQLite
  
  // Vector index settings
  embeddingDimension: number;
  similarityThreshold: number;
  
  // Consolidation settings
  consolidationIntervalMs: number;
  dedupSimilarityThreshold: number;
  decayRate: number; // D in R × exp(-D × T)
  archiveThreshold: number;
  maxFragmentsBeforeCompression: number;
  
  // Retrieval settings
  defaultTopK: number;
  tokenBudget: number;
  recencyWeight: number;
  frequencyWeight: number;
  similarityWeight: number;
  
  // Namespace settings
  defaultNamespace: string;
  enableNamespaceIsolation: boolean;
  
  // Health check
  healthCheckIntervalMs: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Filters and Queries
// ═══════════════════════════════════════════════════════════════════════════════

export interface FragmentFilter {
  namespace?: string;
  agentId?: string;
  projectId?: string;
  type?: MemoryType;
  minRelevance?: number;
  maxRelevance?: number;
  isArchived?: boolean;
  isPinned?: boolean;
  timeRange?: { start: number; end: number };
  tags?: string[];
  tagsAll?: boolean; // If true, all tags must match; if false, any tag matches
}

export interface RetrievalQuery {
  query: string;
  embedding?: number[];
  topK?: number;
  filter?: FragmentFilter;
  tokenBudget?: number;
}

export interface SemanticSearchQuery {
  embedding: number[];
  topK: number;
  filter?: FragmentFilter;
  similarityThreshold?: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Retrieval Results
// ═══════════════════════════════════════════════════════════════════════════════

export interface ScoredFragment {
  fragment: MemoryFragment;
  score: number; // composite: similarity × recency × frequency
  similarityScore: number;
  recencyScore: number;
  frequencyScore: number;
}

export interface RetrievalResult {
  fragments: ScoredFragment[];
  totalTokens: number;
  query: RetrievalQuery;
  durationMs: number;
}

export interface RetrievalContext {
  fragments: MemoryFragment[];
  formattedContext: string;
  tokenCount: number;
  relevanceScores: Record<string, number>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Consolidation
// ═══════════════════════════════════════════════════════════════════════════════

export interface ConsolidationReport {
  merged: number;
  compressed: number;
  archived: number;
  decayed: number;
  deleted: number;
  durationMs: number;
  timestamp: number;
}

export interface DeduplicationResult {
  merged: number;
  clusters: Array<{ kept: MemoryFragment; removed: MemoryFragment[] }>;
}

export interface DecayResult {
  decayed: number;
  archived: number;
}

export interface ArchiveResult {
  archived: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Health and Stats
// ═══════════════════════════════════════════════════════════════════════════════

export interface HealthStatus {
  healthy: boolean;
  storageAvailable: boolean;
  indexSize: number;
  fragmentCount: number;
  lastConsolidation?: number;
  errors: string[];
}

export interface StorageStats {
  totalFragments: number;
  totalSizeBytes: number;
  indexSize: number;
  averageFragmentSize: number;
  namespaces: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// Merge and Import
// ═══════════════════════════════════════════════════════════════════════════════

export interface MergeReport {
  sourceNamespace: string;
  targetNamespace: string;
  fragmentsMerged: number;
  fragmentsSkipped: number;
  conflicts: Array<{ fragmentId: string; reason: string }>;
}

export interface ImportReport {
  imported: number;
  skipped: number;
  errors: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// Bridge Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface BuildLog {
  buildId: string;
  agentId: string;
  projectId: string;
  timestamp: number;
  success: boolean;
  output: string;
  errors: string[];
  durationMs: number;
}

export interface GraphNode {
  id: string;
  content: string;
  type: string;
  confidence: number;
  tags: string[];
  metadata?: Record<string, unknown>;
}

export interface ParallelUniverseContext {
  universeId: string;
  baseProjectId: string;
  branchName: string;
  forkedAt: number;
  memories: MemoryFragment[];
}
