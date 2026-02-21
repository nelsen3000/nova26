// Memory Module - Agent Memory Consolidation & Long-Term Learning
// KIMI-MEMORY: R16-02 spec

// Agent Memory Types & SQLite Store
export {
  AgentMemoryStore,
  serializeEmbedding,
  deserializeEmbedding,
  AgentMemoryConfigSchema,
  type AgentMemoryConfig,
  type MemoryType,
  type MemoryOutcome,
  type AgentMemory,
  type EpisodicMemory,
  type SemanticMemory,
  type ProceduralMemory,
  type ConsolidationResult,
  type RetrievalQuery,
  type RetrievalResult,
} from './agent-memory.js';

// Consolidation Pipeline
export {
  ConsolidationPipeline,
  ConsolidationConfigSchema,
  type ConsolidationConfig,
  type BuildEventLog,
  type ExtractionPromptResult,
} from './consolidation-pipeline.js';
import type { BuildEventLog, ExtractionPromptResult } from './consolidation-pipeline.js';

// Memory Retrieval & Forgetting Curve
export {
  MemoryRetrieval,
  RetrievalConfigSchema,
  ForgettingCurveConfigSchema,
  type RetrievalConfig,
  type ForgettingCurveConfig,
  type MemoryConfidenceLabel,
} from './memory-retrieval.js';

// Memory Commands (CLI Interface)
export {
  MemoryCommands,
  MemoryExportSchema,
  type MemoryCommandResult,
  type MemoryListOptions,
  type MemoryListEntry,
  type MemoryStatsOutput,
  type MemoryExport,
} from './memory-commands.js';

// ============================================================================
// Factory function for easy instantiation
// ============================================================================

import { AgentMemoryStore, type AgentMemoryConfig } from './agent-memory.js';
import { ConsolidationPipeline, type ConsolidationConfig } from './consolidation-pipeline.js';
import { MemoryRetrieval, type RetrievalConfig, type ForgettingCurveConfig } from './memory-retrieval.js';
import { MemoryCommands } from './memory-commands.js';

export interface MemoryEngineConfig {
  store?: Partial<AgentMemoryConfig>;
  consolidation?: Partial<ConsolidationConfig>;
  retrieval?: Partial<RetrievalConfig>;
  forgetting?: Partial<ForgettingCurveConfig>;
}

/**
 * Create a complete memory engine with all components
 */
export function createMemoryEngine(
  embeddingFn: (text: string) => Promise<number[]>,
  extractionFn: (eventLog: BuildEventLog) => Promise<ExtractionPromptResult>,
  config: MemoryEngineConfig = {}
) {
  const store = new AgentMemoryStore(config.store);
  const consolidation = new ConsolidationPipeline(store, embeddingFn, extractionFn, config.consolidation);
  const retrieval = new MemoryRetrieval(store, embeddingFn, config.retrieval, config.forgetting);
  const commands = new MemoryCommands(store, embeddingFn, retrieval);

  return {
    store,
    consolidation,
    retrieval,
    commands,
  };
}
