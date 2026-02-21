// RLM Pipeline - Core compression orchestrator
// Spec: .kiro/specs/recursive-language-models/design.md

import type {
  RlmPipelineConfig,
  CompressionResult,
  ScratchpadMessage,
  AuditEntry,
} from './types.js';
import { RlmPipelineConfigSchema, CompressionResultSchema } from './schemas.js';
import { compressWithReader, LLMCaller } from './reader-adapter.js';
import {
  createContextWindow,
  filterSegments,
  getRelevanceDistribution,
} from './context-window.js';
import { selectReaderModel } from './model-selection.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Default Configuration
// ═══════════════════════════════════════════════════════════════════════════════

export const DEFAULT_PIPELINE_CONFIG: RlmPipelineConfig = {
  enabled: true,
  readerModelId: null,
  relevanceThreshold: 0.3,
  highRelevanceThreshold: 0.7,
  maxOutputTokens: 2000,
  compressionTimeoutMs: 30000,
  enableAudit: true,
  auditSampleRate: 0.1,
};

// ═══════════════════════════════════════════════════════════════════════════════
// RLM Pipeline Class
// ═══════════════════════════════════════════════════════════════════════════════

export class RlmPipeline {
  private config: RlmPipelineConfig;
  private llmCaller: LLMCaller;
  private auditHistory: AuditEntry[] = [];

  constructor(llmCaller: LLMCaller, config?: Partial<RlmPipelineConfig>) {
    this.llmCaller = llmCaller;
    this.config = RlmPipelineConfigSchema.parse({
      ...DEFAULT_PIPELINE_CONFIG,
      ...config,
    });
  }

  async compress(
    messages: ScratchpadMessage[],
    config?: Partial<RlmPipelineConfig>
  ): Promise<CompressionResult> {
    const effectiveConfig = { ...this.config, ...config };
    const startTime = Date.now();
    const turnId = `turn-${Date.now()}`;

    // Skip if disabled
    if (!effectiveConfig.enabled) {
      return this.createPassthroughResult(messages, turnId);
    }

    // Skip if no messages
    if (messages.length === 0) {
      return this.createEmptyResult(turnId);
    }

    try {
      // Select reader model
      const modelSelection = effectiveConfig.readerModelId
        ? {
            modelId: effectiveConfig.readerModelId,
            model: {
              id: effectiveConfig.readerModelId,
              name: effectiveConfig.readerModelId,
              capabilities: ['context-compression'],
              costPerToken: 0.001,
            },
            autoSelected: false,
          }
        : selectReaderModel();

      // Compress with reader model
      const compressionOutput = await compressWithReader(
        messages,
        this.llmCaller,
        {
          modelSelection,
          timeoutMs: effectiveConfig.compressionTimeoutMs,
        }
      );

      if (!compressionOutput.success) {
        // Fallback: return original messages as single segment
        return this.createFallbackResult(
          messages,
          turnId,
          compressionOutput.error,
          Date.now() - startTime
        );
      }

      // Filter segments by relevance and token budget
      const filteredSegments = filterSegments(
        compressionOutput.segments,
        effectiveConfig.relevanceThreshold,
        effectiveConfig.highRelevanceThreshold,
        effectiveConfig.maxOutputTokens
      );

      // Create context window
      const contextWindow = createContextWindow(
        filteredSegments,
        modelSelection.modelId
      );

      // Create audit entry if enabled and sampled
      let auditEntry: AuditEntry | undefined;
      if (
        effectiveConfig.enableAudit &&
        Math.random() < effectiveConfig.auditSampleRate
      ) {
        auditEntry = this.createAuditEntry(
          turnId,
          modelSelection.modelId,
          contextWindow
        );
        this.auditHistory.push(auditEntry);
      }

      const result: CompressionResult = {
        contextWindow,
        success: true,
        fallbackUsed: false,
        compressionTimeMs: Date.now() - startTime,
        auditEntry,
      };

      return CompressionResultSchema.parse(result);
    } catch (error) {
      // Fallback on any error
      return this.createFallbackResult(
        messages,
        turnId,
        error instanceof Error ? error.message : 'Unknown error',
        Date.now() - startTime
      );
    }
  }

  getConfig(): RlmPipelineConfig {
    return { ...this.config };
  }

  updateConfig(partial: Partial<RlmPipelineConfig>): void {
    this.config = RlmPipelineConfigSchema.parse({ ...this.config, ...partial });
  }

  getAuditHistory(limit?: number): AuditEntry[] {
    const history = [...this.auditHistory].sort((a, b) => b.timestamp - a.timestamp);
    return limit ? history.slice(0, limit) : history;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Private Helpers
  // ═══════════════════════════════════════════════════════════════════════════

  private createPassthroughResult(
    messages: ScratchpadMessage[],
    turnId: string
  ): CompressionResult {
    const contextWindow = createContextWindow(
      messages.map((m, i) => ({
        id: `seg-${i}`,
        role: m.role,
        content: m.content,
        originalTokens: Math.ceil(m.content.length / 4),
        compressedTokens: Math.ceil(m.content.length / 4),
        relevanceScore: 1.0,
        sourceMessageIds: [m.id],
        metadata: { passthrough: true },
      })),
      'passthrough'
    );

    return {
      contextWindow,
      success: true,
      fallbackUsed: false,
      compressionTimeMs: 0,
    };
  }

  private createEmptyResult(turnId: string): CompressionResult {
    const contextWindow = createContextWindow([], 'none');
    return {
      contextWindow,
      success: true,
      fallbackUsed: false,
      compressionTimeMs: 0,
    };
  }

  private createFallbackResult(
    messages: ScratchpadMessage[],
    turnId: string,
    error: string | undefined,
    compressionTimeMs: number
  ): CompressionResult {
    const contextWindow = createContextWindow(
      messages.map((m, i) => ({
        id: `seg-fallback-${i}`,
        role: m.role,
        content: m.content,
        originalTokens: Math.ceil(m.content.length / 4),
        compressedTokens: Math.ceil(m.content.length / 4),
        relevanceScore: 1.0,
        sourceMessageIds: [m.id],
        metadata: { fallback: true, error },
      })),
      'fallback'
    );

    return {
      contextWindow,
      success: true,
      fallbackUsed: true,
      compressionTimeMs,
    };
  }

  private createAuditEntry(
    turnId: string,
    readerModelId: string,
    contextWindow: ReturnType<typeof createContextWindow>
  ): AuditEntry {
    const distribution = getRelevanceDistribution(contextWindow.segments);

    return {
      turnId,
      timestamp: Date.now(),
      readerModelId,
      compressionRatio: contextWindow.compressionRatio,
      driftScore: 0, // Would be calculated by comparing with original
      relevanceDistribution: distribution,
      totalOriginalTokens: contextWindow.totalOriginalTokens,
      totalCompressedTokens: contextWindow.totalCompressedTokens,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Factory Function
// ═══════════════════════════════════════════════════════════════════════════════

export function createRlmPipeline(
  llmCaller: LLMCaller,
  config?: Partial<RlmPipelineConfig>
): RlmPipeline {
  return new RlmPipeline(llmCaller, config);
}
