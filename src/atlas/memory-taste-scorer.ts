// KIMI-R23-03: Memory Taste Scorer
// Taste-aware memory ranking using Taste Vault patterns

import {
  HierarchicalMemoryNode,
  MemoryLevel,
} from './infinite-memory-core.js';

// ============================================================================
// Types
// ============================================================================

export interface TasteProfile {
  userId: string;
  preferences: {
    codeStyle: 'compact' | 'verbose' | 'balanced';
    patterns: string[];
    antiPatterns: string[];
    preferredLibraries: string[];
    testingStyle: 'minimal' | 'standard' | 'comprehensive';
    documentationPreference: 'minimal' | 'inline' | 'comprehensive';
  };
  learnedWeights: Record<string, number>;
  contextFactors: {
    recencyBoost: number;
    frequencyBoost: number;
    levelBoost: number;
  };
}

export interface TasteScorerConfig {
  baseTasteWeight: number;
  recencyDecayFactor: number;
  frequencyBoostFactor: number;
  levelMultipliers: Record<MemoryLevel, number>;
  minimumThreshold: number;
  patternMatchWeight: number;
}

export interface ScoredMemory {
  node: HierarchicalMemoryNode;
  baseScore: number;
  tasteScore: number;
  finalScore: number;
  factors: {
    contentRelevance: number;
    tasteAlignment: number;
    recency: number;
    frequency: number;
    level: number;
    patternMatch: number;
  };
}

export interface TasteAnalysis {
  averageScore: number;
  scoreDistribution: {
    high: number; // > 0.8
    medium: number; // 0.5 - 0.8
    low: number; // < 0.5
  };
  topPatterns: string[];
  antiPatterns: string[];
  recommendations: string[];
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: TasteScorerConfig = {
  baseTasteWeight: 0.3,
  recencyDecayFactor: 0.1, // per day
  frequencyBoostFactor: 0.05,
  levelMultipliers: {
    scene: 1.0,
    project: 1.2,
    portfolio: 1.5,
    lifetime: 2.0,
  },
  minimumThreshold: 0.1,
  patternMatchWeight: 0.25,
};

// ============================================================================
// Memory Taste Scorer
// ============================================================================

export class MemoryTasteScorer {
  private config: TasteScorerConfig;
  private tasteProfile: TasteProfile;

  constructor(
    tasteProfile: Partial<TasteProfile> = {},
    config: Partial<TasteScorerConfig> = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.tasteProfile = {
      userId: tasteProfile.userId ?? 'default',
      preferences: {
        codeStyle: tasteProfile.preferences?.codeStyle ?? 'balanced',
        patterns: tasteProfile.preferences?.patterns ?? [],
        antiPatterns: tasteProfile.preferences?.antiPatterns ?? [],
        preferredLibraries: tasteProfile.preferences?.preferredLibraries ?? [],
        testingStyle: tasteProfile.preferences?.testingStyle ?? 'standard',
        documentationPreference:
          tasteProfile.preferences?.documentationPreference ?? 'comprehensive',
      },
      learnedWeights: tasteProfile.learnedWeights ?? {},
      contextFactors: {
        recencyBoost: tasteProfile.contextFactors?.recencyBoost ?? 1.0,
        frequencyBoost: tasteProfile.contextFactors?.frequencyBoost ?? 1.0,
        levelBoost: tasteProfile.contextFactors?.levelBoost ?? 1.0,
      },
    };
  }

  // ============================================================================
  // Core Scoring
  // ============================================================================

  /**
   * Calculate taste score for a single memory node
   */
  calculateScore(
    node: HierarchicalMemoryNode,
    queryContext?: string
  ): ScoredMemory {
    const baseScore = node.metadata.tasteScore;

    // Calculate individual factors
    const recency = this.calculateRecencyFactor(node.metadata.lastAccessed);
    const frequency = this.calculateFrequencyFactor(node.metadata.accessCount);
    const level = this.calculateLevelFactor(node.level);
    const patternMatch = this.calculatePatternMatchFactor(node.content);
    const tasteAlignment = this.calculateTasteAlignment(node, queryContext);

    // Content relevance based on existing score
    const contentRelevance = baseScore;

    // Combine factors with weights
    const weightedScore =
      contentRelevance * 0.25 +
      tasteAlignment * this.config.baseTasteWeight +
      recency * 0.15 * this.tasteProfile.contextFactors.recencyBoost +
      frequency * 0.1 * this.tasteProfile.contextFactors.frequencyBoost +
      level * 0.1 * this.tasteProfile.contextFactors.levelBoost +
      patternMatch * this.config.patternMatchWeight;

    // Normalize to 0-1 range
    const finalScore = Math.min(1, Math.max(0, weightedScore));

    return {
      node,
      baseScore,
      tasteScore: tasteAlignment,
      finalScore,
      factors: {
        contentRelevance,
        tasteAlignment,
        recency,
        frequency,
        level,
        patternMatch,
      },
    };
  }

  /**
   * Rank multiple memories by taste score
   */
  rankMemories(
    nodes: HierarchicalMemoryNode[],
    queryContext?: string,
    limit?: number
  ): ScoredMemory[] {
    const scored = nodes.map((node) => this.calculateScore(node, queryContext));

    // Sort by final score descending
    scored.sort((a, b) => b.finalScore - a.finalScore);

    // Apply minimum threshold
    const filtered = scored.filter(
      (s) => s.finalScore >= this.config.minimumThreshold
    );

    if (limit) {
      return filtered.slice(0, limit);
    }

    return filtered;
  }

  /**
   * Batch update taste scores for multiple nodes
   */
  batchScore(nodes: HierarchicalMemoryNode[]): Map<string, number> {
    const scores = new Map<string, number>();

    for (const node of nodes) {
      const scored = this.calculateScore(node);
      scores.set(node.id, scored.finalScore);
    }

    return scores;
  }

  // ============================================================================
  // Taste Profile Learning
  // ============================================================================

  /**
   * Learn from user feedback on a memory
   */
  learnFromFeedback(
    node: HierarchicalMemoryNode,
    feedback: 'positive' | 'negative' | 'neutral',
    context?: string
  ): void {
    const content = node.content.toLowerCase();
    void this.tokenize(content); // Tokenize for side effects if needed

    // Extract patterns from content
    const patterns = this.extractPatterns(content);

    if (feedback === 'positive') {
      // Boost weights for matched patterns
      for (const pattern of patterns) {
        const currentWeight = this.tasteProfile.learnedWeights[pattern] ?? 0;
        this.tasteProfile.learnedWeights[pattern] = Math.min(
          1,
          currentWeight + 0.1
        );
      }

      // Add to preferences if strong positive
      if (node.metadata.tasteScore > 0.8) {
        for (const pattern of patterns) {
          if (!this.tasteProfile.preferences.patterns.includes(pattern)) {
            this.tasteProfile.preferences.patterns.push(pattern);
          }
        }
      }
    } else if (feedback === 'negative') {
      // Reduce weights for matched patterns
      for (const pattern of patterns) {
        const currentWeight = this.tasteProfile.learnedWeights[pattern] ?? 0;
        this.tasteProfile.learnedWeights[pattern] = Math.max(
          -1,
          currentWeight - 0.1
        );
      }

      // Add to anti-patterns
      for (const pattern of patterns) {
        if (!this.tasteProfile.preferences.antiPatterns.includes(pattern)) {
          this.tasteProfile.preferences.antiPatterns.push(pattern);
        }
      }
    }

    // Store context-specific learning
    if (context) {
      const contextKey = this.tokenize(context).join('_');
      const contextWeight = this.tasteProfile.learnedWeights[contextKey] ?? 0;
      const adjustment = feedback === 'positive' ? 0.05 : feedback === 'negative' ? -0.05 : 0;
      this.tasteProfile.learnedWeights[contextKey] = Math.min(
        1,
        Math.max(-1, contextWeight + adjustment)
      );
    }
  }

  /**
   * Learn from a successful build/task completion
   */
  learnFromSuccess(
    _taskContent: string,
    memoryNodes: HierarchicalMemoryNode[]
  ): void {
    // Boost memories that contributed to success
    for (const node of memoryNodes) {
      const patterns = this.extractPatterns(node.content);
      for (const pattern of patterns) {
        const currentWeight = this.tasteProfile.learnedWeights[pattern] ?? 0;
        this.tasteProfile.learnedWeights[pattern] = Math.min(
          1,
          currentWeight + 0.05
        );
      }
    }

    // Extract and learn new patterns from task content
    const newPatterns = this.extractPatterns(_taskContent);
    for (const pattern of newPatterns) {
      if (!this.tasteProfile.preferences.patterns.includes(pattern)) {
        this.tasteProfile.preferences.patterns.push(pattern);
      }
    }
  }

  /**
   * Learn from a failed build/task
   */
  learnFromFailure(
    _taskContent: string,
    errorMessage: string,
    memoryNodes: HierarchicalMemoryNode[]
  ): void {
    // Identify potentially misleading memories
    for (const node of memoryNodes) {
      const nodePatterns = this.extractPatterns(node.content);
      const errorPatterns = this.extractPatterns(errorMessage);

      // If node patterns overlap with error patterns, reduce weight
      const overlap = nodePatterns.filter((p) => errorPatterns.includes(p));
      if (overlap.length > 0) {
        for (const pattern of overlap) {
          const currentWeight = this.tasteProfile.learnedWeights[pattern] ?? 0;
          this.tasteProfile.learnedWeights[pattern] = Math.max(
            -1,
            currentWeight - 0.1
          );
        }
      }
    }

    // Add error pattern to anti-patterns
    const errorPatterns = this.extractPatterns(errorMessage);
    for (const pattern of errorPatterns) {
      if (!this.tasteProfile.preferences.antiPatterns.includes(pattern)) {
        this.tasteProfile.preferences.antiPatterns.push(pattern);
      }
    }
  }

  // ============================================================================
  // Analysis
  // ============================================================================

  /**
   * Analyze taste profile and provide recommendations
   */
  analyzeProfile(nodes: HierarchicalMemoryNode[]): TasteAnalysis {
    const scored = this.rankMemories(nodes);

    // Calculate distribution
    const distribution = {
      high: scored.filter((s) => s.finalScore > 0.8).length,
      medium: scored.filter((s) => s.finalScore >= 0.5 && s.finalScore <= 0.8)
        .length,
      low: scored.filter((s) => s.finalScore < 0.5).length,
    };

    const averageScore =
      scored.length > 0
        ? scored.reduce((sum, s) => sum + s.finalScore, 0) / scored.length
        : 0;

    // Get top patterns from high-scoring memories
    const topPatterns = new Set<string>();
    for (const score of scored.slice(0, 10)) {
      const patterns = this.extractPatterns(score.node.content);
      for (const pattern of patterns.slice(0, 3)) {
        topPatterns.add(pattern);
      }
    }

    // Generate recommendations
    const recommendations: string[] = [];

    if (distribution.low > distribution.high * 2) {
      recommendations.push(
        'Many memories have low taste scores. Consider pruning or updating taste profile.'
      );
    }

    if (averageScore < 0.5) {
      recommendations.push(
        'Average taste score is low. Review taste preferences and anti-patterns.'
      );
    }

    if (this.tasteProfile.preferences.antiPatterns.length > 20) {
      recommendations.push(
        'Many anti-patterns defined. Some may be overly restrictive.'
      );
    }

    if (Object.keys(this.tasteProfile.learnedWeights).length < 10) {
      recommendations.push(
        'Limited learning history. Provide more feedback to improve scoring.'
      );
    }

    return {
      averageScore,
      scoreDistribution: distribution,
      topPatterns: Array.from(topPatterns).slice(0, 10),
      antiPatterns: this.tasteProfile.preferences.antiPatterns.slice(0, 10),
      recommendations,
    };
  }

  /**
   * Get current taste profile
   */
  getProfile(): TasteProfile {
    return { ...this.tasteProfile };
  }

  /**
   * Update taste profile
   */
  updateProfile(profile: Partial<TasteProfile>): void {
    this.tasteProfile = {
      ...this.tasteProfile,
      ...profile,
      preferences: {
        ...this.tasteProfile.preferences,
        ...profile.preferences,
      },
      contextFactors: {
        ...this.tasteProfile.contextFactors,
        ...profile.contextFactors,
      },
    };
  }

  /**
   * Export taste profile for persistence
   */
  exportProfile(): string {
    return JSON.stringify(this.tasteProfile, null, 2);
  }

  /**
   * Import taste profile from JSON
   */
  importProfile(json: string): boolean {
    try {
      const parsed = JSON.parse(json) as TasteProfile;
      this.tasteProfile = parsed;
      return true;
    } catch {
      return false;
    }
  }

  // ============================================================================
  // Integration with Taste Vault
  // ============================================================================

  /**
   * Sync with Taste Vault for pattern matching
   */
  syncWithTasteVault(
    vaultPatterns: Array<{
      type: string;
      content: string;
      confidence: number;
      tags: string[];
    }>
  ): void {
    for (const pattern of vaultPatterns) {
      // Add high-confidence patterns to preferences
      if (pattern.confidence >= 0.8) {
        const normalizedPattern = this.normalizePattern(pattern.content);
        if (!this.tasteProfile.preferences.patterns.includes(normalizedPattern)) {
          this.tasteProfile.preferences.patterns.push(normalizedPattern);
        }

        // Set learned weight
        this.tasteProfile.learnedWeights[normalizedPattern] = pattern.confidence;
      }

      // Check for anti-patterns
      if (pattern.type === 'Mistake' && pattern.confidence >= 0.7) {
        const normalizedPattern = this.normalizePattern(pattern.content);
        if (!this.tasteProfile.preferences.antiPatterns.includes(normalizedPattern)) {
          this.tasteProfile.preferences.antiPatterns.push(normalizedPattern);
        }
      }
    }
  }

  /**
   * Get patterns that would boost a memory's score
   */
  getBoostingPatterns(content: string): string[] {
    const contentPatterns = this.extractPatterns(content);
    const boosting: string[] = [];

    for (const pattern of contentPatterns) {
      const weight = this.tasteProfile.learnedWeights[pattern] ?? 0;
      if (weight > 0.3) {
        boosting.push(pattern);
      }
    }

    return boosting;
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private calculateRecencyFactor(lastAccessed: string): number {
    const lastAccess = new Date(lastAccessed).getTime();
    const daysSinceAccess = (Date.now() - lastAccess) / (1000 * 60 * 60 * 24);
    return Math.exp(-this.config.recencyDecayFactor * daysSinceAccess);
  }

  private calculateFrequencyFactor(accessCount: number): number {
    return Math.min(
      1,
      1 - Math.exp(-this.config.frequencyBoostFactor * accessCount)
    );
  }

  private calculateLevelFactor(level: MemoryLevel): number {
    const multiplier = this.config.levelMultipliers[level];
    // Normalize to 0-1
    return (multiplier - 1) / 1; // 0 to 1 (since max is 2.0)
  }

  private calculatePatternMatchFactor(content: string): number {
    const contentPatterns = this.extractPatterns(content);
    if (contentPatterns.length === 0) return 0;

    let matchScore = 0;

    for (const pattern of contentPatterns) {
      // Positive match
      if (this.tasteProfile.preferences.patterns.includes(pattern)) {
        const weight = this.tasteProfile.learnedWeights[pattern] ?? 0.5;
        matchScore += weight;
      }

      // Negative match (anti-pattern)
      if (this.tasteProfile.preferences.antiPatterns.includes(pattern)) {
        const weight = this.tasteProfile.learnedWeights[pattern] ?? -0.5;
        matchScore += weight; // weight is typically negative
      }
    }

    // Normalize
    return Math.max(-1, Math.min(1, matchScore / contentPatterns.length));
  }

  private calculateTasteAlignment(
    node: HierarchicalMemoryNode,
    queryContext?: string
  ): number {
    let score = node.metadata.tasteScore;

    // Boost if matches preferred code style
    const codeStylePatterns: Record<string, string[]> = {
      compact: ['arrow', 'implicit', 'terse', 'oneliner'],
      verbose: ['explicit', 'descriptive', 'detailed', 'commented'],
      balanced: ['clear', 'readable', 'maintainable'],
    };

    const stylePatterns = codeStylePatterns[this.tasteProfile.preferences.codeStyle];
    if (stylePatterns) {
      const content = node.content.toLowerCase();
      const styleMatch = stylePatterns.some((p) => content.includes(p));
      if (styleMatch) {
        score += 0.1;
      }
    }

    // Context-based boost
    if (queryContext) {
      const contextTokens = this.tokenize(queryContext);
      const contentTokens = this.tokenize(node.content);

      const overlap = contextTokens.filter((t) => contentTokens.includes(t));
      const contextBoost = overlap.length / Math.max(contextTokens.length, 1);
      score += contextBoost * 0.2;
    }

    return Math.min(1, score);
  }

  private extractPatterns(content: string): string[] {
    const patterns: string[] = [];
    const normalized = content.toLowerCase();

    // Extract code patterns
    const codePatternMatches = normalized.match(
      /(?:function|const|let|var|class|interface|type)\s+(\w+)/g
    );
    if (codePatternMatches) {
      patterns.push(...codePatternMatches.map((m) => m.replace(/\s+/g, '_')));
    }

    // Extract library/framework mentions
    const libMatches = normalized.match(
      /\b(react|vue|angular|svelte|express|fastify|next|nuxt|nestjs|prisma|drizzle|zod|joi)\b/g
    );
    if (libMatches) {
      patterns.push(...libMatches);
    }

    // Extract architectural patterns
    const archMatches = normalized.match(
      /\b(mvc|mvvm|clean|hexagonal|ddd|cqrs|event.sourcing|microservice|monolith)\b/g
    );
    if (archMatches) {
      patterns.push(...archMatches);
    }

    // Extract testing patterns
    const testMatches = normalized.match(
      /\b(tdd|bdd|unit|integration|e2e|jest|vitest|cypress|playwright)\b/g
    );
    if (testMatches) {
      patterns.push(...testMatches);
    }

    return [...new Set(patterns)];
  }

  private normalizePattern(pattern: string): string {
    return pattern.toLowerCase().trim().replace(/\s+/g, '_');
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2);
  }
}

// ============================================================================
// Factory
// ============================================================================

export function createMemoryTasteScorer(
  tasteProfile?: Partial<TasteProfile>,
  config?: Partial<TasteScorerConfig>
): MemoryTasteScorer {
  return new MemoryTasteScorer(tasteProfile, config);
}

/**
 * Create a taste scorer from Taste Vault data
 */
export function createFromTasteVault(
  userId: string,
  vaultPatterns: Array<{
    type: string;
    content: string;
    confidence: number;
    tags: string[];
  }>,
  preferences?: Partial<TasteProfile['preferences']>
): MemoryTasteScorer {
  const scorer = new MemoryTasteScorer({
    userId,
    preferences: {
      codeStyle: 'balanced',
      patterns: [],
      antiPatterns: [],
      preferredLibraries: [],
      testingStyle: 'standard',
      documentationPreference: 'comprehensive',
      ...preferences,
    },
  });

  scorer.syncWithTasteVault(vaultPatterns);
  return scorer;
}
