// Context Window - Serialization and utility functions
// Spec: .kiro/specs/recursive-language-models/design.md

import type { ContextWindow, ContextSegment } from './types.js';
import {
  serializeContextWindow as serialize,
  deserializeContextWindow as deserialize,
  ContextWindowSchema,
  ContextSegmentSchema,
} from './schemas.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Serialization Exports
// ═══════════════════════════════════════════════════════════════════════════════

export { serialize, deserialize };

// ═══════════════════════════════════════════════════════════════════════════════
// Context Window Creation
// ═══════════════════════════════════════════════════════════════════════════════

export function createContextWindow(
  segments: ContextSegment[],
  readerModelId: string,
  taskContext?: string
): ContextWindow {
  const totalOriginalTokens = segments.reduce(
    (sum, s) => sum + s.originalTokens,
    0
  );
  const totalCompressedTokens = segments.reduce(
    (sum, s) => sum + s.compressedTokens,
    0
  );

  const contextWindow: ContextWindow = {
    segments,
    totalOriginalTokens,
    totalCompressedTokens,
    compressionRatio:
      totalCompressedTokens > 0
        ? totalOriginalTokens / totalCompressedTokens
        : 1,
    readerModelId,
    createdAt: Date.now(),
    taskContext,
  };

  return ContextWindowSchema.parse(contextWindow);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Segment Filtering
// ═══════════════════════════════════════════════════════════════════════════════

export function filterByRelevance(
  segments: ContextSegment[],
  threshold: number
): ContextSegment[] {
  return segments.filter(s => s.relevanceScore >= threshold);
}

export function filterByTokenBudget(
  segments: ContextSegment[],
  maxTokens: number
): ContextSegment[] {
  // Sort by relevance (highest first) then by recency (most recent first)
  const sorted = [...segments].sort((a, b) => {
    const relevanceDiff = b.relevanceScore - a.relevanceScore;
    if (Math.abs(relevanceDiff) > 0.01) return relevanceDiff;
    // If relevance is similar, prefer more recent (higher id/index)
    return b.id.localeCompare(a.id);
  });

  const result: ContextSegment[] = [];
  let tokenCount = 0;

  for (const segment of sorted) {
    if (tokenCount + segment.compressedTokens <= maxTokens) {
      result.push(segment);
      tokenCount += segment.compressedTokens;
    }
  }

  // Sort back to original order for coherence
  return result.sort(
    (a, b) => segments.indexOf(a) - segments.indexOf(b)
  );
}

export function filterSegments(
  segments: ContextSegment[],
  relevanceThreshold: number,
  highRelevanceThreshold: number,
  maxTokens: number
): ContextSegment[] {
  // Always keep high-relevance segments
  const highRelevance = segments.filter(
    s => s.relevanceScore >= highRelevanceThreshold
  );

  // Filter remaining by threshold
  const remaining = segments.filter(
    s =>
      s.relevanceScore >= relevanceThreshold &&
      s.relevanceScore < highRelevanceThreshold
  );

  // Apply token budget to remaining (not high-relevance)
  const budgetForRemaining = Math.max(
    0,
    maxTokens - highRelevance.reduce((sum, s) => sum + s.compressedTokens, 0)
  );
  const filteredRemaining = filterByTokenBudget(remaining, budgetForRemaining);

  return [...highRelevance, ...filteredRemaining];
}

// ═══════════════════════════════════════════════════════════════════════════════
// Segment Creation
// ═══════════════════════════════════════════════════════════════════════════════

export function createSegment(
  id: string,
  role: ContextSegment['role'],
  content: string,
  originalTokens: number,
  compressedTokens: number,
  relevanceScore: number,
  sourceMessageIds: string[],
  metadata?: Record<string, unknown>
): ContextSegment {
  const segment: ContextSegment = {
    id,
    role,
    content,
    originalTokens,
    compressedTokens,
    relevanceScore,
    sourceMessageIds,
    metadata,
  };

  return ContextSegmentSchema.parse(segment);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Context Window Utilities
// ═══════════════════════════════════════════════════════════════════════════════

export function mergeContextWindows(
  windows: ContextWindow[],
  readerModelId: string
): ContextWindow {
  // Merge segments, removing duplicates by id
  const seenIds = new Set<string>();
  const mergedSegments: ContextSegment[] = [];

  for (const window of windows) {
    for (const segment of window.segments) {
      if (!seenIds.has(segment.id)) {
        seenIds.add(segment.id);
        mergedSegments.push(segment);
      }
    }
  }

  // Sort by timestamp (if available in metadata) or original order
  mergedSegments.sort((a, b) => {
    const aTime = (a.metadata?.timestamp as number) || 0;
    const bTime = (b.metadata?.timestamp as number) || 0;
    return aTime - bTime;
  });

  return createContextWindow(mergedSegments, readerModelId);
}

export function getRelevanceDistribution(segments: ContextSegment[]): {
  high: number;
  medium: number;
  low: number;
} {
  let high = 0;
  let medium = 0;
  let low = 0;

  for (const segment of segments) {
    if (segment.relevanceScore >= 0.7) {
      high++;
    } else if (segment.relevanceScore >= 0.3) {
      medium++;
    } else {
      low++;
    }
  }

  return { high, medium, low };
}

export function estimateTokenCount(content: string): number {
  // Rough estimate: ~4 characters per token for English
  return Math.ceil(content.length / 4);
}
