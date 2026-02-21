// Task Complexity Estimator - Analyze task descriptions and estimate complexity
// KMS-15: Keyword-based complexity detection with historical data support

// ============================================================================
// Core Types
// ============================================================================

/**
 * Complexity levels for task estimation
 */
export type ComplexityLevel = 'simple' | 'medium' | 'complex' | 'epic';

/**
 * Input for complexity estimation
 */
export interface TaskInput {
  description: string;
  dependencies?: string[];
  estimatedTokens?: number;
  domain?: string;
}

/**
 * Detailed complexity analysis result
 */
export interface ComplexityResult {
  level: ComplexityLevel;
  score: number;
  factors: ComplexityFactors;
  confidence: number;
  recommendations: string[];
}

/**
 * Individual factors contributing to complexity score
 */
export interface ComplexityFactors {
  keywordScore: number;
  dependencyScore: number;
  tokenScore: number;
  historicalAdjustment: number;
}

/**
 * Historical task data for learning
 */
export interface HistoricalTask {
  id: string;
  description: string;
  actualComplexity: ComplexityLevel;
  timeSpent: number;
  dependencies: number;
  tokensUsed: number;
  timestamp: string;
}

/**
 * Keyword patterns for complexity detection
 */
interface KeywordPatterns {
  simple: string[];
  medium: string[];
  complex: string[];
  epic: string[];
}

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Default keyword patterns for complexity detection
 */
const DEFAULT_KEYWORDS: KeywordPatterns = {
  simple: [
    'fix typo',
    'update readme',
    'update docs',
    'add comment',
    'rename',
    'simple',
    'minor',
    'tweak',
    'adjust',
    'quick',
    'patch',
    'format',
    'lint',
    'cosmetic',
    'style',
    'docs',
  ],
  medium: [
    'refactor',
    'implement',
    'add feature',
    'update',
    'modify',
    'enhance',
    'improve',
    'optimize',
    'migrate',
    'upgrade',
    'configure',
    'setup',
    'integration',
  ],
  complex: [
    'redesign',
    'rearchitect',
    'rewrite',
    'complex',
    'breaking change',
    'security',
    'performance',
    'scalability',
    'architecture',
    'core',
    'fundamental',
    'multi-step',
    'cross-module',
    'database migration',
    'api redesign',
  ],
  epic: [
    'platform',
    'ecosystem',
    'enterprise',
    'foundation',
    'revolutionary',
    'transformative',
    'strategic',
    'organization-wide',
    'multi-team',
    'quarter',
    'year',
    'vision',
    'paradigm shift',
    'greenfield',
  ],
};

/**
 * Score thresholds for complexity levels
 */
const COMPLEXITY_THRESHOLDS = {
  simple: { min: 0, max: 25 },
  medium: { min: 26, max: 50 },
  complex: { min: 51, max: 75 },
  epic: { min: 76, max: 100 },
};

/**
 * Token count thresholds
 */
const TOKEN_THRESHOLDS = {
  simple: 500,
  medium: 2000,
  complex: 5000,
  epic: 10000,
};

// ============================================================================
// Complexity Estimator Class
// ============================================================================

export class ComplexityEstimator {
  private keywords: KeywordPatterns;
  private historicalData: HistoricalTask[] = [];
  private domainMultipliers: Map<string, number> = new Map();

  constructor(options?: { keywords?: KeywordPatterns; initialHistory?: HistoricalTask[] }) {
    this.keywords = options?.keywords ?? DEFAULT_KEYWORDS;
    if (options?.initialHistory) {
      this.historicalData = [...options.initialHistory];
    }
  }

  /**
   * Estimate complexity for a given task
   */
  estimate(task: TaskInput): ComplexityResult {
    const description = task.description.toLowerCase();
    const dependencies = task.dependencies ?? [];
    const estimatedTokens = task.estimatedTokens ?? this.estimateTokens(description);

    // Calculate individual factor scores
    const keywordScore = this.calculateKeywordScore(description);
    const dependencyScore = this.calculateDependencyScore(dependencies.length);
    const tokenScore = this.calculateTokenScore(estimatedTokens);
    const historicalAdjustment = this.calculateHistoricalAdjustment(task);

    // Calculate weighted total score
    const weights = {
      keyword: 0.85,
      dependency: 0.1,
      token: 0.03,
      historical: 0.02,
    };

    const totalScore = Math.min(
      100,
      Math.round(
        keywordScore * weights.keyword +
          dependencyScore * weights.dependency +
          tokenScore * weights.token +
          historicalAdjustment * weights.historical
      )
    );

    const level = this.scoreToLevel(totalScore);
    const confidence = this.calculateConfidence(task, keywordScore);

    return {
      level,
      score: totalScore,
      factors: {
        keywordScore,
        dependencyScore,
        tokenScore,
        historicalAdjustment,
      },
      confidence,
      recommendations: this.generateRecommendations(level, totalScore, dependencies.length),
    };
  }

  /**
   * Calculate keyword-based complexity score
   */
  private calculateKeywordScore(description: string): number {
    let score = 15; // Base score

    // Check for each complexity level keywords
    const simpleMatches = this.countMatches(description, this.keywords.simple);
    const mediumMatches = this.countMatches(description, this.keywords.medium);
    const complexMatches = this.countMatches(description, this.keywords.complex);
    const epicMatches = this.countMatches(description, this.keywords.epic);

    // Priority-based scoring system
    if (epicMatches > 0) {
      // Epic keywords - single should reach epic range (76+ after weighting)
      // With 0.85 weight: 76/0.85 ≈ 90, so need score >= 90
      score = Math.min(95, 85 + epicMatches * 5);
    } else if (complexMatches > 0) {
      // Complex keywords - single should be in complex range (51-75 after weighting)
      // With 0.85 weight: 51/0.85 ≈ 60, 75/0.85 ≈ 88
      score = Math.min(88, 65 + complexMatches * 12);
    } else if (mediumMatches > 0) {
      // Medium keywords - must stay in medium range (26-50 after weighting)
      // With 0.85 weight: 26/0.85 ≈ 31, 50/0.85 ≈ 59
      if (simpleMatches >= mediumMatches) {
        score = 18; // Stay in simple range
      } else {
        score = Math.min(55, 32 + mediumMatches * 10); // Stay in medium range
      }
    } else if (simpleMatches > 0) {
      // Simple keywords - reduce score to stay in simple range (0-25 after weighting)
      score = Math.max(5, 12 - simpleMatches * 5);
    }

    // Additional heuristics
    if (description.includes('and') || description.includes(',')) {
      score += 2;
    }

    if (description.length > 200) {
      score += 4;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Count keyword matches in description
   */
  private countMatches(description: string, keywords: string[]): number {
    return keywords.reduce((count, keyword) => {
      // Normalize description and keyword for matching
      const normalizedDesc = description.toLowerCase();
      const normalizedKeyword = keyword.toLowerCase();
      
      // Handle hyphenated words by also checking without hyphens
      const descVariations = [normalizedDesc, normalizedDesc.replace(/-/g, ' ')];
      
      let found = false;
      for (const desc of descVariations) {
        // Escape special regex characters in keyword (except hyphen which we handle separately)
        const escapedKeyword = normalizedKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        
        // For hyphenated keywords, try matching with space or literal hyphen
        const keywordVariations = normalizedKeyword.includes('-') 
          ? [escapedKeyword, escapedKeyword.replace(/-/g, '\\s+')]
          : [escapedKeyword];
        
        for (const kw of keywordVariations) {
          // Use word boundaries for single words, but match phrases anywhere
          const isPhrase = kw.includes('\\s+') || keyword.includes(' ');
          const pattern = isPhrase ? kw : `\\b${kw}\\b`;
          const regex = new RegExp(pattern, 'gi');
          if (regex.test(desc)) {
            found = true;
            break;
          }
        }
        if (found) break;
      }
      
      return count + (found ? 1 : 0);
    }, 0);
  }

  /**
   * Calculate dependency-based complexity score
   */
  private calculateDependencyScore(dependencyCount: number): number {
    if (dependencyCount === 0) return 0;
    if (dependencyCount <= 2) return 15;
    if (dependencyCount <= 5) return 35;
    if (dependencyCount <= 10) return 60;
    return 85;
  }

  /**
   * Calculate token-based complexity score
   */
  private calculateTokenScore(tokens: number): number {
    if (tokens <= TOKEN_THRESHOLDS.simple) return 5;
    if (tokens <= TOKEN_THRESHOLDS.medium) return 20;
    if (tokens <= TOKEN_THRESHOLDS.complex) return 50;
    if (tokens <= TOKEN_THRESHOLDS.epic) return 75;
    return 95;
  }

  /**
   * Estimate token count from description if not provided
   */
  private estimateTokens(description: string): number {
    // Rough estimate: ~4 chars per token on average
    return Math.ceil(description.length / 4);
  }

  /**
   * Calculate adjustment based on historical data
   */
  private calculateHistoricalAdjustment(task: TaskInput): number {
    if (this.historicalData.length === 0) {
      return 25; // Neutral baseline
    }

    // Find similar historical tasks
    const similar = this.findSimilarTasks(task.description);
    if (similar.length === 0) {
      return 25;
    }

    // Calculate average complexity score from similar tasks
    const avgScore =
      similar.reduce((sum, t) => sum + this.levelToScore(t.actualComplexity), 0) / similar.length;

    return avgScore;
  }

  /**
   * Find similar historical tasks based on description
   */
  private findSimilarTasks(description: string): HistoricalTask[] {
    const keywords = description
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3);

    return this.historicalData.filter((task) => {
      const taskWords = task.description.toLowerCase().split(/\s+/);
      const matches = keywords.filter((k) => taskWords.includes(k));
      return matches.length >= Math.min(2, keywords.length);
    });
  }

  /**
   * Convert complexity level to numeric score
   */
  private levelToScore(level: ComplexityLevel): number {
    const scores: Record<ComplexityLevel, number> = {
      simple: 15,
      medium: 40,
      complex: 65,
      epic: 90,
    };
    return scores[level];
  }

  /**
   * Convert numeric score to complexity level
   */
  private scoreToLevel(score: number): ComplexityLevel {
    if (score <= COMPLEXITY_THRESHOLDS.simple.max) return 'simple';
    if (score <= COMPLEXITY_THRESHOLDS.medium.max) return 'medium';
    if (score <= COMPLEXITY_THRESHOLDS.complex.max) return 'complex';
    return 'epic';
  }

  /**
   * Calculate confidence in the estimation
   */
  private calculateConfidence(task: TaskInput, keywordScore: number): number {
    let confidence = 0.7; // Base confidence

    // Higher confidence with more specific keyword matches
    if (keywordScore > 0 && keywordScore !== 10) {
      confidence += 0.15;
    }

    // Higher confidence with explicit token estimate
    if (task.estimatedTokens !== undefined) {
      confidence += 0.1;
    }

    // Higher confidence with historical data
    if (this.historicalData.length > 0) {
      const similar = this.findSimilarTasks(task.description);
      confidence += Math.min(0.1, similar.length * 0.02);
    }

    return Math.min(0.98, confidence);
  }

  /**
   * Generate recommendations based on complexity
   */
  private generateRecommendations(
    level: ComplexityLevel,
    score: number,
    dependencyCount: number
  ): string[] {
    const recommendations: string[] = [];

    switch (level) {
      case 'simple':
        recommendations.push('Can be completed in a single session');
        recommendations.push('Good for quick wins');
        break;
      case 'medium':
        recommendations.push('Break into smaller subtasks if possible');
        recommendations.push('Allow 2-4 hours for completion');
        break;
      case 'complex':
        recommendations.push('Requires detailed planning');
        recommendations.push('Consider multiple iterations');
        recommendations.push('May need architecture review');
        break;
      case 'epic':
        recommendations.push('Requires significant planning and coordination');
        recommendations.push('Break down into multiple phases');
        recommendations.push('Stakeholder alignment needed');
        break;
    }

    if (dependencyCount > 5) {
      recommendations.push('High dependency count - consider dependency analysis');
    }

    if (score > 80) {
      recommendations.push('Consider splitting into smaller deliverables');
    }

    return recommendations;
  }

  /**
   * Add historical task data for learning
   */
  addHistoricalData(task: HistoricalTask): void {
    this.historicalData.push(task);
  }

  /**
   * Get historical data
   */
  getHistoricalData(): HistoricalTask[] {
    return [...this.historicalData];
  }

  /**
   * Clear historical data
   */
  clearHistoricalData(): void {
    this.historicalData = [];
  }

  /**
   * Set domain multiplier for specific domains
   */
  setDomainMultiplier(domain: string, multiplier: number): void {
    this.domainMultipliers.set(domain.toLowerCase(), multiplier);
  }

  /**
   * Get complexity thresholds
   */
  getThresholds(): typeof COMPLEXITY_THRESHOLDS {
    return { ...COMPLEXITY_THRESHOLDS };
  }

  /**
   * Update keyword patterns
   */
  updateKeywords(level: keyof KeywordPatterns, keywords: string[]): void {
    this.keywords[level] = [...keywords];
  }

  /**
   * Get current keyword patterns
   */
  getKeywords(): KeywordPatterns {
    return {
      simple: [...this.keywords.simple],
      medium: [...this.keywords.medium],
      complex: [...this.keywords.complex],
      epic: [...this.keywords.epic],
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let instance: ComplexityEstimator | null = null;

/**
 * Get the singleton complexity estimator instance
 */
export function getComplexityEstimator(
  options?: ConstructorParameters<typeof ComplexityEstimator>[0]
): ComplexityEstimator {
  if (!instance) {
    instance = new ComplexityEstimator(options);
  }
  return instance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetComplexityEstimator(): void {
  instance = null;
}

/**
 * Batch estimate multiple tasks
 */
export function batchEstimate(
  tasks: TaskInput[],
  estimator?: ComplexityEstimator
): ComplexityResult[] {
  const est = estimator ?? getComplexityEstimator();
  return tasks.map((task) => est.estimate(task));
}

/**
 * Get complexity distribution from results
 */
export function getComplexityDistribution(
  results: ComplexityResult[]
): Record<ComplexityLevel, number> {
  const distribution: Record<ComplexityLevel, number> = {
    simple: 0,
    medium: 0,
    complex: 0,
    epic: 0,
  };

  for (const result of results) {
    distribution[result.level]++;
  }

  return distribution;
}

/**
 * Compare estimated vs actual complexity
 */
export function compareComplexity(
  estimated: ComplexityLevel,
  actual: ComplexityLevel
): { match: boolean; difference: number } {
  const levels: ComplexityLevel[] = ['simple', 'medium', 'complex', 'epic'];
  const estIndex = levels.indexOf(estimated);
  const actualIndex = levels.indexOf(actual);

  return {
    match: estIndex === actualIndex,
    difference: Math.abs(estIndex - actualIndex),
  };
}
