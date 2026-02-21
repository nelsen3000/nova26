// Audit & Drift Detection - Track compression quality over time
// Spec: .kiro/specs/recursive-language-models/design.md

import type {
  ContextWindow,
  AuditEntry,
  DriftWarningEvent,
  ScratchpadMessage,
} from './types.js';
import { AuditEntrySchema } from './schemas.js';
import { EventEmitter } from 'events';

// ═══════════════════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════════════════

export interface AuditConfig {
  driftThreshold: number;
  maxHistorySize: number;
  enableWarnings: boolean;
}

export const DEFAULT_CONFIG: AuditConfig = {
  driftThreshold: 0.3,
  maxHistorySize: 1000,
  enableWarnings: true,
};

// ═══════════════════════════════════════════════════════════════════════════════
// Drift Detection
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Compute drift score between compressed and original context.
 * 0.0 = no drift (perfect preservation)
 * 1.0 = total drift (complete information loss)
 */
export function computeDriftScore(
  original: ScratchpadMessage[],
  compressed: ContextWindow
): number {
  if (original.length === 0) {
    return compressed.segments.length === 0 ? 0 : 1;
  }

  // Calculate content overlap using Jaccard similarity on word sets
  const originalContent = original.map(m => m.content.toLowerCase()).join(' ');
  const compressedContent = compressed.segments
    .map(s => s.content.toLowerCase())
    .join(' ');

  const originalWords = new Set(originalContent.split(/\s+/));
  const compressedWords = new Set(compressedContent.split(/\s+/));

  const intersection = new Set(
    [...originalWords].filter(w => compressedWords.has(w))
  );
  const union = new Set([...originalWords, ...compressedWords]);

  const jaccardSimilarity =
    union.size > 0 ? intersection.size / union.size : 0;

  // Calculate token retention ratio
  const originalTokens = original.reduce(
    (sum, m) => sum + Math.ceil(m.content.length / 4),
    0
  );
  const tokenRetention =
    originalTokens > 0
      ? compressed.totalCompressedTokens / originalTokens
      : 1;

  // Calculate relevance retention (weighted by segment relevance)
  const totalRelevance = compressed.segments.reduce(
    (sum, s) => sum + s.relevanceScore,
    0
  );
  const avgRelevance =
    compressed.segments.length > 0
      ? totalRelevance / compressed.segments.length
      : 0;

  // Combine metrics into drift score
  // High similarity + high token retention + high relevance = low drift
  const contentDrift = 1 - jaccardSimilarity;
  const tokenDrift = 1 - Math.min(1, tokenRetention * 2); // Penalize heavy compression
  const relevanceDrift = 1 - avgRelevance;

  // Weighted average
  const driftScore = contentDrift * 0.4 + tokenDrift * 0.3 + relevanceDrift * 0.3;

  return Math.max(0, Math.min(1, driftScore));
}

// ═══════════════════════════════════════════════════════════════════════════════
// Audit Entry Creation
// ═══════════════════════════════════════════════════════════════════════════════

export function createAuditEntry(
  turnId: string,
  readerModelId: string,
  original: ScratchpadMessage[],
  compressed: ContextWindow
): AuditEntry {
  const driftScore = computeDriftScore(original, compressed);

  // Count relevance distribution
  let high = 0;
  let medium = 0;
  let low = 0;

  for (const segment of compressed.segments) {
    if (segment.relevanceScore >= 0.7) {
      high++;
    } else if (segment.relevanceScore >= 0.3) {
      medium++;
    } else {
      low++;
    }
  }

  const entry: AuditEntry = {
    turnId,
    timestamp: Date.now(),
    readerModelId,
    compressionRatio: compressed.compressionRatio,
    driftScore,
    relevanceDistribution: { high, medium, low },
    totalOriginalTokens: compressed.totalOriginalTokens,
    totalCompressedTokens: compressed.totalCompressedTokens,
  };

  return AuditEntrySchema.parse(entry);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Audit History
// ═══════════════════════════════════════════════════════════════════════════════

export class AuditHistory extends EventEmitter {
  private entries: AuditEntry[] = [];
  private config: AuditConfig;

  constructor(config: Partial<AuditConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  add(entry: AuditEntry): void {
    this.entries.push(entry);

    // Enforce max history size
    if (this.entries.length > this.config.maxHistorySize) {
      this.entries = this.entries.slice(-this.config.maxHistorySize);
    }

    // Check for drift warning
    if (this.config.enableWarnings && entry.driftScore > this.config.driftThreshold) {
      const warning: DriftWarningEvent = {
        type: 'drift_warning',
        timestamp: Date.now(),
        turnId: entry.turnId,
        driftScore: entry.driftScore,
        threshold: this.config.driftThreshold,
        message: `High drift detected: ${(entry.driftScore * 100).toFixed(1)}% (threshold: ${(this.config.driftThreshold * 100).toFixed(1)}%)`,
      };
      this.emit('drift_warning', warning);
    }

    this.emit('entry_added', entry);
  }

  getAll(): AuditEntry[] {
    return [...this.entries].sort((a, b) => b.timestamp - a.timestamp);
  }

  getRecent(count: number): AuditEntry[] {
    return this.getAll().slice(0, count);
  }

  getByTurnId(turnId: string): AuditEntry | undefined {
    return this.entries.find(e => e.turnId === turnId);
  }

  getStatistics(): {
    totalEntries: number;
    avgCompressionRatio: number;
    avgDriftScore: number;
    highDriftCount: number;
  } {
    if (this.entries.length === 0) {
      return {
        totalEntries: 0,
        avgCompressionRatio: 1,
        avgDriftScore: 0,
        highDriftCount: 0,
      };
    }

    const totalCompressionRatio = this.entries.reduce(
      (sum, e) => sum + e.compressionRatio,
      0
    );
    const totalDriftScore = this.entries.reduce(
      (sum, e) => sum + e.driftScore,
      0
    );
    const highDriftCount = this.entries.filter(
      e => e.driftScore > this.config.driftThreshold
    ).length;

    return {
      totalEntries: this.entries.length,
      avgCompressionRatio: totalCompressionRatio / this.entries.length,
      avgDriftScore: totalDriftScore / this.entries.length,
      highDriftCount,
    };
  }

  clear(): void {
    this.entries = [];
    this.emit('cleared');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Global Audit History Instance
// ═══════════════════════════════════════════════════════════════════════════════

export const globalAuditHistory = new AuditHistory();

// ═══════════════════════════════════════════════════════════════════════════════
// Drift Warning Subscription
// ═══════════════════════════════════════════════════════════════════════════════

export function onDriftWarning(
  callback: (warning: DriftWarningEvent) => void
): () => void {
  globalAuditHistory.on('drift_warning', callback);
  return () => globalAuditHistory.off('drift_warning', callback);
}
