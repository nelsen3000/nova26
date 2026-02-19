// KIMI-ACE-02: AceCurator
// Curates playbook deltas, deduplicates, and applies updates

import type { Playbook, PlaybookDelta, PlaybookRule } from './playbook.js';
import { getPlaybookManager } from './playbook.js';
import { getTasteVault } from '../taste-vault/taste-vault.js';

// ============================================================================
// AceCurator Class
// ============================================================================

export class AceCurator {
  private jaccardThreshold = 0.65;
  private minScore = 0.4;
  private maxApplied = 3;
  private globalCandidateThreshold = 0.75;

  /**
   * Curate deltas and update playbook
   */
  async curate(
    deltas: PlaybookDelta[],
    agentName: string
  ): Promise<{ applied: PlaybookDelta[]; rejected: PlaybookDelta[]; newPlaybook: Playbook }> {
    // 1. Get current playbook
    const currentPlaybook = getPlaybookManager().getPlaybook(agentName);
    const existingRules = currentPlaybook.rules;

    const applied: PlaybookDelta[] = [];
    const rejected: PlaybookDelta[] = [];

    // 2. Process each delta
    for (const delta of deltas) {
      // 2a. Deduplicate: Check Jaccard similarity
      const duplicateCheck = this.isDuplicate(delta.content, existingRules, this.jaccardThreshold);
      
      if (duplicateCheck.isDuplicate && delta.action === 'add') {
        // For adds, reject if duplicate
        rejected.push({ ...delta, reason: `${delta.reason} [REJECTED: Duplicate of ${duplicateCheck.matchedRule?.id}]` });
        continue;
      }

      // 2b. Score the delta
      const score = this.calculateScore(delta);

      // 2c. Reject if score < 0.4
      if (score < this.minScore) {
        rejected.push({ ...delta, reason: `${delta.reason} [REJECTED: Score ${score.toFixed(2)} < ${this.minScore}]` });
        continue;
      }

      applied.push(delta);
    }

    // 3. Cap at 3 applied deltas (keep highest scoring)
    if (applied.length > this.maxApplied) {
      const scoredApplied = applied.map(d => ({ 
        delta: d, 
        score: this.calculateScore(d) 
      }));
      scoredApplied.sort((a, b) => b.score - a.score);
      
      const topApplied = scoredApplied.slice(0, this.maxApplied);
      const extraRejected = scoredApplied.slice(this.maxApplied).map(s => ({
        ...s.delta,
        reason: `${s.delta.reason} [REJECTED: Exceeded cap of ${this.maxApplied} deltas]`
      }));
      
      applied.length = 0;
      applied.push(...topApplied.map(s => s.delta));
      rejected.push(...extraRejected);
    }

    // 4. Update playbook with surviving deltas
    const newPlaybook = getPlaybookManager().updatePlaybook(agentName, applied);

    // 5. For isGlobalCandidate && score >= 0.75: call taste vault learn
    for (const delta of applied) {
      const score = this.calculateScore(delta);
      if (delta.isGlobalCandidate && score >= this.globalCandidateThreshold) {
        const vault = getTasteVault('default');
        await vault.learn({
          type: delta.type,
          content: delta.content,
          source: agentName,
          tags: ['ace-global-candidate', delta.type.toLowerCase()],
          confidence: delta.confidence,
        });
      }
    }

    return { applied, rejected, newPlaybook };
  }

  /**
   * Calculate score for a delta
   * Score = helpfulDelta * 0.6 + confidence * 0.4 - harmfulDelta * 0.3, clamped to [0, 1]
   */
  calculateScore(delta: PlaybookDelta): number {
    const helpfulScore = delta.helpfulDelta * 0.6;
    const confidenceScore = delta.confidence * 0.4;
    const harmfulPenalty = delta.harmfulDelta * 0.3;
    
    let score = helpfulScore + confidenceScore - harmfulPenalty;
    
    // Clamp to [0, 1]
    return Math.max(0, Math.min(1, score));
  }

  /**
   * Check if content is a duplicate of any existing rule using Jaccard similarity
   */
  isDuplicate(
    deltaContent: string,
    existingRules: PlaybookRule[],
    threshold: number = this.jaccardThreshold
  ): { isDuplicate: boolean; matchedRule?: PlaybookRule } {
    const deltaTokens = this.tokenize(deltaContent);
    const deltaTokenSet = new Set(deltaTokens);

    for (const rule of existingRules) {
      const ruleTokens = this.tokenize(rule.content);
      const ruleTokenSet = new Set(ruleTokens);

      const similarity = this.jaccardSimilarity(deltaTokenSet, ruleTokenSet);

      if (similarity >= threshold) {
        return { isDuplicate: true, matchedRule: rule };
      }
    }

    return { isDuplicate: false };
  }

  /**
   * Calculate Jaccard similarity between two token sets
   * J(A, B) = |A ∩ B| / |A ∪ B|
   */
  private jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
    if (setA.size === 0 || setB.size === 0) return 0;

    const intersection = new Set(Array.from(setA).filter(x => setB.has(x)));
    const union = new Set([...Array.from(setA), ...Array.from(setB)]);

    return intersection.size / union.size;
  }

  /**
   * Tokenize text for similarity comparison
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 2);
  }
}

// ============================================================================
// Singleton Factory
// ============================================================================

let curatorInstance: AceCurator | null = null;

export function getAceCurator(): AceCurator {
  if (!curatorInstance) {
    curatorInstance = new AceCurator();
  }
  return curatorInstance;
}

export function resetAceCurator(): void {
  curatorInstance = null;
}

export function setAceCurator(curator: AceCurator): void {
  curatorInstance = curator;
}
