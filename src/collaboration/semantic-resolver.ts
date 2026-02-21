// Semantic Conflict Resolver — Taste Vault-aware CRDT conflict resolution
// KIMI-R24-03 | Feb 2026

import type { CRDTOperation, SemanticCRDTNode, ConflictMarker, ConflictResolutionStrategy } from './crdt-core.js';

export interface SemanticContext {
  agentId?: string;
  taskType?: string;
  semanticTags?: string[];
  tasteScore?: number;
  priority?: number;
}

export interface ResolutionCandidate {
  content: string;
  source: 'local' | 'remote' | 'merged';
  confidence: number;
  semanticTags: string[];
  tasteScore: number;
}

export interface SemanticResolutionResult {
  resolved: boolean;
  content: string | null;
  strategy: ConflictResolutionStrategy;
  confidence: number;
  candidates: ResolutionCandidate[];
  explanation: string;
}

export interface TasteVaultPreferences {
  preferredAgents?: string[];
  preferredTags?: string[];
  penalizedTags?: string[];
  agentWeights?: Record<string, number>;
  minTasteScore?: number;
}

// Strategies in priority order
const STRATEGY_PRIORITY: ConflictResolutionStrategy[] = [
  'taste-vault',
  'semantic-merge',
  'last-write-wins',
  'manual',
];

export class SemanticConflictResolver {
  private preferences: TasteVaultPreferences;
  private resolvedCount = 0;
  private manualCount = 0;

  constructor(preferences: TasteVaultPreferences = {}) {
    this.preferences = {
      preferredAgents: preferences.preferredAgents ?? ['JUPITER', 'PLUTO', 'VENUS'],
      preferredTags: preferences.preferredTags ?? ['architecture', 'security', 'performance'],
      penalizedTags: preferences.penalizedTags ?? ['draft', 'deprecated', 'wip'],
      agentWeights: preferences.agentWeights ?? {},
      minTasteScore: preferences.minTasteScore ?? 0.3,
    };
  }

  resolve(node: SemanticCRDTNode, op: CRDTOperation, context?: SemanticContext): SemanticResolutionResult {
    const candidates = this.buildCandidates(node, op, context);
    const strategy = this.pickStrategy(node, op);

    switch (strategy) {
      case 'taste-vault':
        return this.resolveByTaste(candidates, strategy);
      case 'semantic-merge':
        return this.resolveBySemanticMerge(candidates, strategy);
      case 'last-write-wins':
        return this.resolveByLWW(node, op, candidates, strategy);
      default:
        return this.resolveManual(candidates, strategy);
    }
  }

  resolveMarker(marker: ConflictMarker, node: SemanticCRDTNode): SemanticResolutionResult {
    const [firstOp] = marker.ops;
    if (!firstOp) {
      return {
        resolved: false,
        content: node.content,
        strategy: 'manual',
        confidence: 0,
        candidates: [],
        explanation: 'No operations in conflict marker',
      };
    }
    return this.resolve(node, firstOp);
  }

  getStats() {
    return {
      resolvedCount: this.resolvedCount,
      manualCount: this.manualCount,
      successRate: this.resolvedCount + this.manualCount > 0
        ? this.resolvedCount / (this.resolvedCount + this.manualCount)
        : 1,
    };
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  private buildCandidates(
    node: SemanticCRDTNode,
    op: CRDTOperation,
    context?: SemanticContext,
  ): ResolutionCandidate[] {
    const candidates: ResolutionCandidate[] = [];

    // Local node state
    candidates.push({
      content: node.content,
      source: 'local',
      confidence: this.computeConfidence(node.tasteScore, node.semanticTags),
      semanticTags: node.semanticTags,
      tasteScore: node.tasteScore,
    });

    // Remote operation content
    const opPayload = op.payload as { content?: string; tags?: string[] };
    if (opPayload.content !== undefined) {
      const opTasteScore = op.tasteScore ?? context?.tasteScore ?? 0.5;
      const opTags = opPayload.tags ?? context?.semanticTags ?? [];
      candidates.push({
        content: opPayload.content,
        source: 'remote',
        confidence: this.computeConfidence(opTasteScore, opTags),
        semanticTags: opTags,
        tasteScore: opTasteScore,
      });
    }

    // Merged candidate (simple concatenation / union)
    const mergedContent = this.attemptMerge(node.content, opPayload.content ?? '');
    if (mergedContent !== null) {
      const mergedScore = (node.tasteScore + (op.tasteScore ?? 0.5)) / 2;
      const mergedTags = [...new Set([...node.semanticTags, ...(opPayload.tags ?? [])])];
      candidates.push({
        content: mergedContent,
        source: 'merged',
        confidence: this.computeConfidence(mergedScore, mergedTags) * 0.9, // slight discount
        semanticTags: mergedTags,
        tasteScore: mergedScore,
      });
    }

    return candidates;
  }

  private pickStrategy(node: SemanticCRDTNode, op: CRDTOperation): ConflictResolutionStrategy {
    // Taste vault if both sides have meaningful taste scores
    const opTasteScore = op.tasteScore ?? 0;
    if (node.tasteScore > 0.5 || opTasteScore > 0.5) {
      return 'taste-vault';
    }

    // Semantic merge if node has semantic tags
    if (node.semanticTags.length > 0) {
      return 'semantic-merge';
    }

    // LWW for simple text
    return 'last-write-wins';
  }

  private resolveByTaste(
    candidates: ResolutionCandidate[],
    strategy: ConflictResolutionStrategy,
  ): SemanticResolutionResult {
    const minScore = this.preferences.minTasteScore ?? 0.3;
    const viable = candidates.filter(c => c.tasteScore >= minScore);

    if (viable.length === 0) {
      this.manualCount++;
      return {
        resolved: false,
        content: null,
        strategy,
        confidence: 0,
        candidates,
        explanation: 'No candidates meet minimum taste score threshold',
      };
    }

    // Score each candidate with tag preferences
    const scored = viable.map(c => ({
      candidate: c,
      finalScore: this.applyTagPreferences(c),
    }));

    scored.sort((a, b) => b.finalScore - a.finalScore);
    const winner = scored[0]!;

    this.resolvedCount++;
    return {
      resolved: true,
      content: winner.candidate.content,
      strategy,
      confidence: winner.finalScore,
      candidates,
      explanation: `Selected ${winner.candidate.source} candidate via Taste Vault (score: ${winner.finalScore.toFixed(3)})`,
    };
  }

  private resolveBySemanticMerge(
    candidates: ResolutionCandidate[],
    strategy: ConflictResolutionStrategy,
  ): SemanticResolutionResult {
    const merged = candidates.find(c => c.source === 'merged');
    if (merged && merged.confidence > 0.4) {
      this.resolvedCount++;
      return {
        resolved: true,
        content: merged.content,
        strategy,
        confidence: merged.confidence,
        candidates,
        explanation: 'Semantic merge succeeded — content combined from both sides',
      };
    }

    // Fall back to highest-confidence non-merged
    const best = [...candidates]
      .filter(c => c.source !== 'merged')
      .sort((a, b) => b.confidence - a.confidence)[0];

    if (best) {
      this.resolvedCount++;
      return {
        resolved: true,
        content: best.content,
        strategy,
        confidence: best.confidence,
        candidates,
        explanation: `Semantic merge unavailable — picked ${best.source} candidate`,
      };
    }

    this.manualCount++;
    return { resolved: false, content: null, strategy, confidence: 0, candidates, explanation: 'No candidates available' };
  }

  private resolveByLWW(
    node: SemanticCRDTNode,
    op: CRDTOperation,
    candidates: ResolutionCandidate[],
    strategy: ConflictResolutionStrategy,
  ): SemanticResolutionResult {
    // Higher vector clock total wins
    const nodeTotal = Object.values(node.vectorClock).reduce((s, v) => s + v, 0);
    const opTotal = Object.values(op.vectorClock).reduce((s, v) => s + v, 0);
    const winner = opTotal > nodeTotal ? candidates.find(c => c.source === 'remote') : candidates.find(c => c.source === 'local');

    if (!winner) {
      this.manualCount++;
      return { resolved: false, content: null, strategy, confidence: 0, candidates, explanation: 'LWW: no winner determined' };
    }

    this.resolvedCount++;
    return {
      resolved: true,
      content: winner.content,
      strategy,
      confidence: winner.confidence,
      candidates,
      explanation: `LWW: ${winner.source} wins (clock totals: node=${nodeTotal}, op=${opTotal})`,
    };
  }

  private resolveManual(
    candidates: ResolutionCandidate[],
    strategy: ConflictResolutionStrategy,
  ): SemanticResolutionResult {
    this.manualCount++;
    return {
      resolved: false,
      content: null,
      strategy,
      confidence: 0,
      candidates,
      explanation: 'Manual resolution required — conflict flagged for user review',
    };
  }

  private computeConfidence(tasteScore: number, tags: string[]): number {
    let score = tasteScore;
    const preferred = this.preferences.preferredTags ?? [];
    const penalized = this.preferences.penalizedTags ?? [];

    const preferredMatches = tags.filter(t => preferred.includes(t)).length;
    const penalizedMatches = tags.filter(t => penalized.includes(t)).length;

    score += preferredMatches * 0.05;
    score -= penalizedMatches * 0.08;

    return Math.max(0, Math.min(1, score));
  }

  private applyTagPreferences(candidate: ResolutionCandidate): number {
    let score = candidate.tasteScore;
    const preferred = this.preferences.preferredTags ?? [];
    const penalized = this.preferences.penalizedTags ?? [];

    for (const tag of candidate.semanticTags) {
      if (preferred.includes(tag)) score += 0.05;
      if (penalized.includes(tag)) score -= 0.08;
    }

    return Math.max(0, Math.min(1, score));
  }

  private attemptMerge(local: string, remote: string): string | null {
    if (!local || !remote) return null;
    if (local === remote) return local;

    // Simple line-based merge: deduplicate lines from both
    const localLines = new Set(local.split('\n').map(l => l.trim()).filter(Boolean));
    const remoteLines = remote.split('\n').map(l => l.trim()).filter(Boolean);

    const merged: string[] = [...localLines];
    for (const line of remoteLines) {
      if (!localLines.has(line)) merged.push(line);
    }

    return merged.join('\n');
  }
}

// Factory using default preferences
export function createSemanticResolver(preferences?: TasteVaultPreferences): SemanticConflictResolver {
  return new SemanticConflictResolver(preferences);
}

// Strategy priority helper
export function getStrategyPriority(strategy: ConflictResolutionStrategy): number {
  return STRATEGY_PRIORITY.indexOf(strategy);
}
