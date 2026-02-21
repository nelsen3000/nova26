// RLM CRDT Integration - Compress context for collaborative sessions
// Spec: .kiro/specs/recursive-language-models/tasks.md

import type { ContextWindow, ContextSegment } from './types.js';
import { createContextWindow, mergeContextWindows } from './context-window.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════════════════

export interface CRDTIntegrationConfig {
  compressionRatio: number;
  maxBroadcastSize: number; // in bytes
  includeMetadata: boolean;
}

export const DEFAULT_CONFIG: CRDTIntegrationConfig = {
  compressionRatio: 0.5,
  maxBroadcastSize: 10000, // 10KB
  includeMetadata: true,
};

// ═══════════════════════════════════════════════════════════════════════════════
// CRDT Message Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface CompressedCRDTMessage {
  type: 'context_update' | 'join_summary' | 'context_sync';
  sessionId: string;
  participantId: string;
  timestamp: number;
  compressedContext: CompressedContext;
  vectorClock: Record<string, number>;
}

export interface CompressedContext {
  segments: CompressedSegment[];
  totalOriginalTokens: number;
  totalCompressedTokens: number;
  compressionRatio: number;
  createdAt: number;
}

export interface CompressedSegment {
  id: string;
  role: string;
  content: string;
  relevanceScore: number;
  sourceMessageIds: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// RLM CRDT Integration
// ═══════════════════════════════════════════════════════════════════════════════

export class RLMCRDTIntegration {
  private config: CRDTIntegrationConfig;

  constructor(config?: Partial<CRDTIntegrationConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Compress for CRDT Broadcast
  // ═══════════════════════════════════════════════════════════════════════════

  compressForBroadcast(
    sessionId: string,
    participantId: string,
    contextWindow: ContextWindow,
    vectorClock: Record<string, number>
  ): CompressedCRDTMessage {
    // Compress segments
    const compressedSegments = this.compressSegments(contextWindow.segments);

    const compressedContext: CompressedContext = {
      segments: compressedSegments,
      totalOriginalTokens: contextWindow.totalOriginalTokens,
      totalCompressedTokens: this.estimateCompressedTokens(compressedSegments),
      compressionRatio: this.config.compressionRatio,
      createdAt: contextWindow.createdAt,
    };

    return {
      type: 'context_update',
      sessionId,
      participantId,
      timestamp: Date.now(),
      compressedContext,
      vectorClock,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Generate Join Summary
  // ═══════════════════════════════════════════════════════════════════════════

  generateJoinSummary(
    sessionId: string,
    participantId: string,
    recentHistory: ContextWindow[],
    maxSegments: number = 10
  ): CompressedCRDTMessage {
    // Merge recent history
    let merged: ContextWindow;
    if (recentHistory.length === 0) {
      merged = createContextWindow([], 'join-summary');
    } else if (recentHistory.length === 1) {
      merged = recentHistory[0];
    } else {
      merged = mergeContextWindows(recentHistory, 'join-summary');
    }

    // Take most relevant segments
    const topSegments = [...merged.segments]
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, maxSegments);

    // Sort back to chronological order
    topSegments.sort((a, b) => {
      const aTime = parseInt(a.id.split('-')[1] || '0');
      const bTime = parseInt(b.id.split('-')[1] || '0');
      return aTime - bTime;
    });

    const compressedSegments = this.compressSegments(topSegments);

    const compressedContext: CompressedContext = {
      segments: compressedSegments,
      totalOriginalTokens: merged.totalOriginalTokens,
      totalCompressedTokens: this.estimateCompressedTokens(compressedSegments),
      compressionRatio: this.config.compressionRatio,
      createdAt: Date.now(),
    };

    return {
      type: 'join_summary',
      sessionId,
      participantId,
      timestamp: Date.now(),
      compressedContext,
      vectorClock: { [participantId]: 1 },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Reconcile Divergent Contexts
  // ═══════════════════════════════════════════════════════════════════════════

  reconcileContexts(
    localContext: ContextWindow,
    remoteMessages: CompressedCRDTMessage[]
  ): ContextWindow {
    // Sort by timestamp (LWW - Last Writer Wins)
    const sortedMessages = [...remoteMessages].sort(
      (a, b) => a.timestamp - b.timestamp
    );

    // Merge all segments
    const allSegments: ContextSegment[] = [...localContext.segments];

    for (const message of sortedMessages) {
      const segments = this.decompressSegments(message.compressedContext.segments);
      allSegments.push(...segments);
    }

    // Deduplicate by ID
    const seen = new Set<string>();
    const uniqueSegments = allSegments.filter(s => {
      if (seen.has(s.id)) {
        return false;
      }
      seen.add(s.id);
      return true;
    });

    // Sort by createdAt from segment IDs (if possible)
    uniqueSegments.sort((a, b) => {
      const aTime = this.extractTimestamp(a.id);
      const bTime = this.extractTimestamp(b.id);
      return aTime - bTime;
    });

    return createContextWindow(uniqueSegments, 'reconciled');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Vector Clock Merge
  // ═══════════════════════════════════════════════════════════════════════════

  mergeVectorClocks(
    local: Record<string, number>,
    remote: Record<string, number>
  ): Record<string, number> {
    const merged: Record<string, number> = { ...local };

    for (const [key, value] of Object.entries(remote)) {
      merged[key] = Math.max(merged[key] || 0, value);
    }

    return merged;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Size Validation
  // ═══════════════════════════════════════════════════════════════════════════

  validateBroadcastSize(message: CompressedCRDTMessage): boolean {
    const serialized = JSON.stringify(message);
    return serialized.length <= this.config.maxBroadcastSize;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Private Helpers
  // ═══════════════════════════════════════════════════════════════════════════

  private compressSegments(segments: ContextSegment[]): CompressedSegment[] {
    return segments.map(s => ({
      id: s.id,
      role: s.role,
      content: s.content,
      relevanceScore: s.relevanceScore,
      sourceMessageIds: s.sourceMessageIds,
    }));
  }

  private decompressSegments(segments: CompressedSegment[]): ContextSegment[] {
    return segments.map(s => ({
      id: s.id,
      role: s.role as ContextSegment['role'],
      content: s.content,
      originalTokens: Math.ceil(s.content.length / 4),
      compressedTokens: Math.ceil(s.content.length / 4 * this.config.compressionRatio),
      relevanceScore: s.relevanceScore,
      sourceMessageIds: s.sourceMessageIds,
    }));
  }

  private estimateCompressedTokens(segments: CompressedSegment[]): number {
    return segments.reduce(
      (sum, s) => sum + Math.ceil(s.content.length / 4 * this.config.compressionRatio),
      0
    );
  }

  private extractTimestamp(segmentId: string): number {
    // Extract timestamp from segment ID (format: seg-{timestamp}-{random})
    const parts = segmentId.split('-');
    if (parts.length >= 2) {
      const timestamp = parseInt(parts[1], 10);
      if (!isNaN(timestamp)) {
        return timestamp;
      }
    }
    return 0;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Factory Function
// ═══════════════════════════════════════════════════════════════════════════════

export function createRLMCRDTIntegration(
  config?: Partial<CRDTIntegrationConfig>
): RLMCRDTIntegration {
  return new RLMCRDTIntegration(config);
}
