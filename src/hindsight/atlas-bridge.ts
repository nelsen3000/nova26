// ATLAS Bridge - Integrate Hindsight with ATLAS memory system
// Spec: .kiro/specs/hindsight-persistent-memory/tasks.md

import type {
  MemoryFragmentInput,
  BuildLog,
  HindsightEngine,
  RetrievalContext,
} from './types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════════════════

export interface ATLASBridgeConfig {
  enableEnrichment: boolean;
  enrichmentTimeoutMs: number;
}

export const DEFAULT_CONFIG: ATLASBridgeConfig = {
  enableEnrichment: true,
  enrichmentTimeoutMs: 5000,
};

// ═══════════════════════════════════════════════════════════════════════════════
// ATLAS Bridge
// ═══════════════════════════════════════════════════════════════════════════════

export class ATLASBridge {
  private engine: HindsightEngine;
  private config: ATLASBridgeConfig;

  constructor(engine: HindsightEngine, config?: Partial<ATLASBridgeConfig>) {
    this.engine = engine;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Build Log Handling
  // ═══════════════════════════════════════════════════════════════════════════

  async onBuildLogged(buildLog: BuildLog): Promise<void> {
    const input = this.convertBuildLogToFragment(buildLog);
    await this.engine.store(input);
  }

  private convertBuildLogToFragment(buildLog: BuildLog): MemoryFragmentInput {
    return {
      content: `Build ${buildLog.buildId}: ${buildLog.success ? 'SUCCESS' : 'FAILURE'}\nOutput: ${buildLog.output.substring(0, 500)}\nErrors: ${buildLog.errors.join(', ')}`,
      type: buildLog.success ? 'episodic' : 'procedural',
      agentId: buildLog.agentId,
      projectId: buildLog.projectId,
      relevance: buildLog.success ? 0.6 : 0.9, // Failed builds are more relevant
      confidence: buildLog.success ? 0.8 : 0.95,
      provenance: {
        sourceType: 'build',
        sourceId: buildLog.buildId,
        timestamp: buildLog.timestamp,
        agentId: buildLog.agentId,
        projectId: buildLog.projectId,
      },
      tags: ['build', buildLog.success ? 'success' : 'failure'],
      extra: {
        durationMs: buildLog.durationMs,
        errorCount: buildLog.errors.length,
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Retrospective Handling
  // ═══════════════════════════════════════════════════════════════════════════

  async onRetrospectiveComplete(
    projectId: string,
    agentId: string,
    insights: string[]
  ): Promise<void> {
    for (const insight of insights) {
      const input: MemoryFragmentInput = {
        content: insight,
        type: 'semantic',
        agentId,
        projectId,
        relevance: 0.8,
        confidence: 0.7,
        provenance: {
          sourceType: 'retrospective',
          sourceId: `retro-${Date.now()}`,
          timestamp: Date.now(),
          agentId,
          projectId,
        },
        tags: ['retrospective', 'insight'],
      };
      await this.engine.store(input);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Semantic Tag Mapping
  // ═══════════════════════════════════════════════════════════════════════════

  mapSemanticTags(atlasTags: string[]): string[] {
    const namespaceTags: string[] = [];

    for (const tag of atlasTags) {
      // Map ATLAS CodeNode tags to Hindsight namespace tags
      if (tag.startsWith('agent:')) {
        namespaceTags.push(`agent-${tag.slice(6)}`);
      } else if (tag.startsWith('project:')) {
        namespaceTags.push(`project-${tag.slice(8)}`);
      } else if (tag.startsWith('domain:')) {
        namespaceTags.push(`domain-${tag.slice(7)}`);
      } else {
        namespaceTags.push(tag);
      }
    }

    return [...new Set(namespaceTags)]; // Remove duplicates
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Retrieval Enrichment
  // ═══════════════════════════════════════════════════════════════════════════

  async enrichRetrieval(
    baseContext: RetrievalContext,
    query: string
  ): Promise<RetrievalContext> {
    if (!this.config.enableEnrichment) {
      return baseContext;
    }

    try {
      // Query Kronos for additional context (best-effort)
      const enriched = await this.queryKronos(query, this.config.enrichmentTimeoutMs);

      // Merge with base context
      const mergedFragments = [...baseContext.fragments, ...enriched.fragments];
      const mergedRelevanceScores = {
        ...baseContext.relevanceScores,
        ...enriched.relevanceScores,
      };

      return {
        fragments: mergedFragments,
        formattedContext: baseContext.formattedContext + '\n\n' + enriched.formattedContext,
        tokenCount: baseContext.tokenCount + enriched.tokenCount,
        relevanceScores: mergedRelevanceScores,
      };
    } catch {
      // Graceful fallback to base context
      return baseContext;
    }
  }

  private async queryKronos(
    _query: string,
    _timeoutMs: number
  ): Promise<RetrievalContext> {
    // Placeholder: In production, this would query the Kronos system
    // For now, return empty context
    return {
      fragments: [],
      formattedContext: '',
      tokenCount: 0,
      relevanceScores: {},
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Factory Function
// ═══════════════════════════════════════════════════════════════════════════════

export function createATLASBridge(
  engine: HindsightEngine,
  config?: Partial<ATLASBridgeConfig>
): ATLASBridge {
  return new ATLASBridge(engine, config);
}
