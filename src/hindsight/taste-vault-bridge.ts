// Taste Vault Bridge - Integrate Hindsight with Taste Vault
// Spec: .kiro/specs/hindsight-persistent-memory/tasks.md

import type {
  MemoryFragmentInput,
  GraphNode,
  HindsightEngine,
  FragmentFilter,
} from './types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════════════════

export interface TasteVaultBridgeConfig {
  enableSupplementalSearch: boolean;
  supplementTopK: number;
}

export const DEFAULT_CONFIG: TasteVaultBridgeConfig = {
  enableSupplementalSearch: true,
  supplementTopK: 5,
};

// ═══════════════════════════════════════════════════════════════════════════════
// Taste Vault Bridge
// ═══════════════════════════════════════════════════════════════════════════════

export class TasteVaultBridge {
  private engine: HindsightEngine;
  private config: TasteVaultBridgeConfig;
  private patternToFragmentId = new Map<string, string>();

  constructor(engine: HindsightEngine, config?: Partial<TasteVaultBridgeConfig>) {
    this.engine = engine;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Pattern Learning
  // ═══════════════════════════════════════════════════════════════════════════

  async onPatternLearned(node: GraphNode): Promise<void> {
    const input = this.convertGraphNodeToFragment(node);
    const fragment = await this.engine.store(input);
    
    // Track mapping from pattern ID to fragment ID
    this.patternToFragmentId.set(node.id, fragment.id);
  }

  private convertGraphNodeToFragment(node: GraphNode): MemoryFragmentInput {
    return {
      content: node.content,
      type: 'semantic',
      agentId: 'system',
      projectId: 'taste-vault',
      relevance: node.confidence,
      confidence: node.confidence,
      provenance: {
        sourceType: 'pattern',
        sourceId: node.id,
        timestamp: Date.now(),
        agentId: 'taste-vault',
      },
      tags: ['taste-vault', 'pattern', ...node.tags],
      extra: {
        patternType: node.type,
        confidence: node.confidence,
        graphNodeId: node.id,
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Pattern Reinforcement
  // ═══════════════════════════════════════════════════════════════════════════

  async onPatternReinforced(patternId: string, boostAmount: number = 0.1): Promise<void> {
    const fragmentId = this.patternToFragmentId.get(patternId);
    if (!fragmentId) {
      return; // Pattern not in Hindsight
    }

    // Boost relevance of corresponding fragment
    // Note: In production, this would update the fragment in storage
    // For now, we track the boost in memory
    const currentRelevance = 0.5; // Would be fetched from storage
    const newRelevance = Math.min(1, currentRelevance + boostAmount);

    // Create reinforcement record
    const reinforcementInput: MemoryFragmentInput = {
      content: `Pattern ${patternId} reinforced (relevance: ${newRelevance})`,
      type: 'procedural',
      agentId: 'system',
      projectId: 'taste-vault',
      relevance: 0.5,
      confidence: 0.9,
      provenance: {
        sourceType: 'pattern',
        sourceId: `reinforcement-${patternId}`,
        timestamp: Date.now(),
        agentId: 'taste-vault',
      },
      tags: ['taste-vault', 'reinforcement'],
      extra: {
        patternId,
        boostAmount,
        newRelevance,
      },
    };

    await this.engine.store(reinforcementInput);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Conflict Resolution
  // ═══════════════════════════════════════════════════════════════════════════

  async onConflictResolved(
    conflictId: string,
    winningPatternId: string,
    losingPatternId: string,
    resolution: string
  ): Promise<void> {
    const input: MemoryFragmentInput = {
      content: `Conflict Resolution: ${resolution}\nWinner: ${winningPatternId}\nLoser: ${losingPatternId}`,
      type: 'procedural',
      agentId: 'system',
      projectId: 'taste-vault',
      relevance: 0.9,
      confidence: 0.95,
      provenance: {
        sourceType: 'pattern',
        sourceId: conflictId,
        timestamp: Date.now(),
        agentId: 'taste-vault',
      },
      tags: ['taste-vault', 'conflict-resolution'],
      extra: {
        conflictId,
        winningPatternId,
        losingPatternId,
        resolution,
      },
    };

    await this.engine.store(input);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Supplemental Retrieval
  // ═══════════════════════════════════════════════════════════════════════════

  async supplementRetrieval(
    tasteVaultResults: GraphNode[],
    query: string
  ): Promise<GraphNode[]> {
    if (!this.config.enableSupplementalSearch) {
      return tasteVaultResults;
    }

    // Search Hindsight for semantically similar fragments
    const filter: FragmentFilter = {
      tags: ['taste-vault'],
    };

    // Note: In production, this would compute the embedding for the query
    // For now, we use a simple text search via the engine
    const hindsightResults = await this.engine.retrieve({
      query,
      filter,
      topK: this.config.supplementTopK,
    });

    // Convert Hindsight fragments back to GraphNode format
    const supplemental: GraphNode[] = hindsightResults.fragments.map(f => ({
      id: f.fragment.id,
      content: f.fragment.content,
      type: f.fragment.extra?.patternType || 'unknown',
      confidence: f.fragment.confidence,
      tags: f.fragment.tags,
      metadata: f.fragment.extra,
    }));

    // Merge with Taste Vault results, removing duplicates
    const seenIds = new Set(tasteVaultResults.map(n => n.id));
    const uniqueSupplemental = supplemental.filter(n => !seenIds.has(n.id));

    return [...tasteVaultResults, ...uniqueSupplemental];
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Factory Function
// ═══════════════════════════════════════════════════════════════════════════════

export function createTasteVaultBridge(
  engine: HindsightEngine,
  config?: Partial<TasteVaultBridgeConfig>
): TasteVaultBridge {
  return new TasteVaultBridge(engine, config);
}
