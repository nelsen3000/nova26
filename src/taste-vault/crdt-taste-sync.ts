// CRDT Taste Sync — Bridges CRDT operations with Taste Vault preferences
// KIMI-R24-03 | Feb 2026

import type { CRDTOperation, SemanticCRDTNode } from '../collaboration/crdt-core.js';

export interface TasteSyncConfig {
  enabled?: boolean;
  minScoreToSync?: number;     // Only sync ops with taste score >= this (default: 0.4)
  decayOnConflict?: number;    // Reduce taste score on conflict (default: 0.05)
  boostOnResolution?: number;  // Boost score when conflict resolves cleanly (default: 0.03)
  maxHistorySize?: number;     // Max ops to keep in history (default: 500)
  agentBoosts?: Record<string, number>; // Per-agent taste boost amounts
}

export interface TasteSyncEntry {
  opId: string;
  peerId: string;
  nodeId: string;
  originalScore: number;
  adjustedScore: number;
  syncedAt: number;
  tags: string[];
  conflicted: boolean;
}

export interface TasteSyncReport {
  totalSynced: number;
  totalSkipped: number;
  totalConflicts: number;
  avgScoreAdjustment: number;
  topAgents: Array<{ peerId: string; syncCount: number; avgScore: number }>;
  tagFrequency: Record<string, number>;
}

export interface NodeTasteProfile {
  nodeId: string;
  currentScore: number;
  peakScore: number;
  conflictCount: number;
  lastUpdated: number;
  topTags: string[];
  contributors: string[]; // peerIds that contributed
}

export class CRDTTasteSync {
  private config: Required<TasteSyncConfig>;
  private history: TasteSyncEntry[] = [];
  private nodeProfiles = new Map<string, NodeTasteProfile>();
  private skippedCount = 0;

  constructor(config: TasteSyncConfig = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      minScoreToSync: config.minScoreToSync ?? 0.4,
      decayOnConflict: config.decayOnConflict ?? 0.05,
      boostOnResolution: config.boostOnResolution ?? 0.03,
      maxHistorySize: config.maxHistorySize ?? 500,
      agentBoosts: config.agentBoosts ?? { JUPITER: 0.03, PLUTO: 0.02, VENUS: 0.02 },
    };
  }

  /**
   * Sync a CRDT operation into Taste Vault.
   * Returns the adjusted taste score, or null if skipped.
   */
  syncOperation(op: CRDTOperation, tags: string[] = []): number | null {
    if (!this.config.enabled) return null;

    const baseScore = op.tasteScore ?? 0.5;
    const agentBoost = this.config.agentBoosts[op.peerId] ?? 0;
    let adjustedScore = baseScore + agentBoost;

    if (adjustedScore < this.config.minScoreToSync) {
      this.skippedCount++;
      return null;
    }

    adjustedScore = Math.min(1, Math.max(0, adjustedScore));

    const entry: TasteSyncEntry = {
      opId: op.id,
      peerId: op.peerId,
      nodeId: op.targetNodeId,
      originalScore: baseScore,
      adjustedScore,
      syncedAt: Date.now(),
      tags,
      conflicted: false,
    };

    this.addToHistory(entry);
    this.updateNodeProfile(op.targetNodeId, op.peerId, adjustedScore, tags, false);

    return adjustedScore;
  }

  /**
   * Apply taste decay when a conflict is detected on an op.
   */
  onConflictDetected(opId: string, nodeId: string): void {
    const entry = this.history.find(e => e.opId === opId);
    if (entry) {
      entry.conflicted = true;
      entry.adjustedScore = Math.max(0, entry.adjustedScore - this.config.decayOnConflict);
    }

    const profile = this.nodeProfiles.get(nodeId);
    if (profile) {
      profile.conflictCount++;
      profile.currentScore = Math.max(0, profile.currentScore - this.config.decayOnConflict);
      profile.lastUpdated = Date.now();
    }
  }

  /**
   * Apply taste boost when a conflict is resolved automatically.
   */
  onConflictResolved(nodeId: string): void {
    const profile = this.nodeProfiles.get(nodeId);
    if (profile) {
      profile.currentScore = Math.min(1, profile.currentScore + this.config.boostOnResolution);
      profile.lastUpdated = Date.now();
    }
  }

  /**
   * Compute a taste-adjusted priority weight for an op in a priority queue.
   */
  computeQueueWeight(op: CRDTOperation): number {
    const profile = this.nodeProfiles.get(op.targetNodeId);
    const nodeScore = profile?.currentScore ?? 0.5;
    const agentBoost = this.config.agentBoosts[op.peerId] ?? 0;
    const opScore = (op.tasteScore ?? 0.5) + agentBoost;

    // Blend node profile score with op score
    return (nodeScore * 0.4 + opScore * 0.6);
  }

  /**
   * Score a set of nodes by taste and return ranked list.
   */
  rankNodes(nodes: SemanticCRDTNode[]): Array<{ node: SemanticCRDTNode; score: number }> {
    return nodes
      .map(node => {
        const profile = this.nodeProfiles.get(node.id);
        const score = profile?.currentScore ?? node.tasteScore;
        return { node, score };
      })
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Get a node's taste profile (or default).
   */
  getNodeProfile(nodeId: string): NodeTasteProfile {
    return this.nodeProfiles.get(nodeId) ?? {
      nodeId,
      currentScore: 0.5,
      peakScore: 0.5,
      conflictCount: 0,
      lastUpdated: 0,
      topTags: [],
      contributors: [],
    };
  }

  /**
   * Build a sync report across all synced operations.
   */
  buildReport(): TasteSyncReport {
    const agentMap = new Map<string, { count: number; totalScore: number }>();
    const tagMap = new Map<string, number>();
    let totalScoreAdj = 0;
    let totalConflicts = 0;

    for (const entry of this.history) {
      const adj = entry.adjustedScore - entry.originalScore;
      totalScoreAdj += adj;
      if (entry.conflicted) totalConflicts++;

      // Agent stats
      const agg = agentMap.get(entry.peerId) ?? { count: 0, totalScore: 0 };
      agg.count++;
      agg.totalScore += entry.adjustedScore;
      agentMap.set(entry.peerId, agg);

      // Tag frequency
      for (const tag of entry.tags) {
        tagMap.set(tag, (tagMap.get(tag) ?? 0) + 1);
      }
    }

    const topAgents = [...agentMap.entries()]
      .map(([peerId, agg]) => ({ peerId, syncCount: agg.count, avgScore: agg.totalScore / agg.count }))
      .sort((a, b) => b.syncCount - a.syncCount)
      .slice(0, 5);

    const tagFrequency: Record<string, number> = {};
    for (const [tag, count] of tagMap) {
      tagFrequency[tag] = count;
    }

    return {
      totalSynced: this.history.length,
      totalSkipped: this.skippedCount,
      totalConflicts,
      avgScoreAdjustment: this.history.length > 0 ? totalScoreAdj / this.history.length : 0,
      topAgents,
      tagFrequency,
    };
  }

  /**
   * Get ops synced for a specific node (most recent first).
   */
  getNodeHistory(nodeId: string): TasteSyncEntry[] {
    return this.history.filter(e => e.nodeId === nodeId).reverse();
  }

  /**
   * Reset state (for testing).
   */
  reset(): void {
    this.history = [];
    this.nodeProfiles.clear();
    this.skippedCount = 0;
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  private addToHistory(entry: TasteSyncEntry): void {
    this.history.push(entry);
    if (this.history.length > this.config.maxHistorySize) {
      this.history.shift();
    }
  }

  private updateNodeProfile(
    nodeId: string,
    peerId: string,
    score: number,
    tags: string[],
    conflicted: boolean,
  ): void {
    const existing = this.nodeProfiles.get(nodeId);
    if (!existing) {
      this.nodeProfiles.set(nodeId, {
        nodeId,
        currentScore: score,
        peakScore: score,
        conflictCount: conflicted ? 1 : 0,
        lastUpdated: Date.now(),
        topTags: tags.slice(0, 5),
        contributors: [peerId],
      });
      return;
    }

    existing.currentScore = (existing.currentScore * 0.7 + score * 0.3); // EMA
    existing.peakScore = Math.max(existing.peakScore, score);
    if (conflicted) existing.conflictCount++;
    existing.lastUpdated = Date.now();

    // Merge tags
    const tagSet = new Set([...existing.topTags, ...tags]);
    existing.topTags = [...tagSet].slice(0, 10);

    // Merge contributors
    if (!existing.contributors.includes(peerId)) {
      existing.contributors.push(peerId);
    }
  }
}

// Singleton factory
let _instance: CRDTTasteSync | null = null;

export function getCRDTTasteSync(config?: TasteSyncConfig): CRDTTasteSync {
  if (!_instance) _instance = new CRDTTasteSync(config);
  return _instance;
}

export function resetCRDTTasteSync(): void {
  _instance = null;
}
