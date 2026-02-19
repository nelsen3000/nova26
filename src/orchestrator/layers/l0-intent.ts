// L0 Intent Layer — R20-01
// Parse user intent, confirmation loop, confidence scoring

import type {
  UserIntent,
  IntentParseResult,
  ClarificationExchange,
} from '../hierarchy-types.js';

export interface L0Config {
  minConfidenceThreshold: number;
  maxClarificationRounds: number;
  parsingStrategies: ('direct' | 'taste-vault' | 'contextual')[];
}

export const DEFAULT_L0_CONFIG: L0Config = {
  minConfidenceThreshold: 0.7,
  maxClarificationRounds: 3,
  parsingStrategies: ['direct', 'taste-vault', 'contextual'],
};

export class L0IntentLayer {
  private config: L0Config;
  private clarificationHistory: Map<string, ClarificationExchange[]> = new Map();

  constructor(config: Partial<L0Config> = {}) {
    this.config = { ...DEFAULT_L0_CONFIG, ...config };
  }

  /**
   * Parse raw user input into structured intent
   */
  async parseIntent(
    input: string,
    context?: {
      previousIntents?: UserIntent[];
      tasteVaultTags?: string[];
      projectContext?: string;
    }
  ): Promise<IntentParseResult> {
    const intentId = this.generateIntentId();
    
    // Simulate intent parsing with different strategies
    const parsed = await this.applyParsingStrategies(input, context);
    
    const intent: UserIntent = {
      id: intentId,
      rawInput: input,
      parsedType: parsed.type,
      scope: parsed.scope,
      constraints: parsed.constraints,
      tasteVaultTags: context?.tasteVaultTags ?? [],
      confidence: parsed.confidence,
      needsClarification: parsed.confidence < this.config.minConfidenceThreshold,
      clarificationHistory: [],
    };

    return {
      intent,
      alternatives: parsed.alternatives,
      parsingMetadata: {
        strategiesUsed: this.config.parsingStrategies,
        processingTimeMs: 150,
        contextUsed: !!context,
      },
    };
  }

  /**
   * Request clarification from user when confidence is low
   */
  async requestClarification(
    _intent: UserIntent,
    question: string
  ): Promise<string> {
    // In real implementation, this would interface with user
    // For now, return a simulated response
    return `Clarification for: ${question}`;
  }

  /**
   * Process user clarification and update intent
   */
  async processClarification(
    intent: UserIntent,
    question: string,
    answer: string
  ): Promise<UserIntent> {
    const exchange: ClarificationExchange = {
      question,
      answer,
      timestamp: Date.now(),
    };

    const history = this.clarificationHistory.get(intent.id) ?? [];
    history.push(exchange);
    this.clarificationHistory.set(intent.id, history);

    // Recalculate confidence based on clarification
    const newConfidence = Math.min(0.95, intent.confidence + 0.15);
    const clarificationRound = history.length;

    return {
      ...intent,
      confidence: newConfidence,
      needsClarification: 
        newConfidence < this.config.minConfidenceThreshold &&
        clarificationRound < this.config.maxClarificationRounds,
      clarificationHistory: history,
    };
  }

  /**
   * Run full clarification loop until confidence threshold or max rounds
   */
  async runClarificationLoop(
    initialIntent: UserIntent,
    clarificationProvider: (intent: UserIntent) => Promise<string>
  ): Promise<UserIntent> {
    let intent = initialIntent;
    let rounds = 0;

    while (
      intent.needsClarification &&
      rounds < this.config.maxClarificationRounds
    ) {
      const question = await this.generateClarificationQuestion(intent);
      const answer = await clarificationProvider(intent);
      
      intent = await this.processClarification(intent, question, answer);
      rounds++;
    }

    return intent;
  }

  /**
   * Score confidence based on input characteristics
   */
  scoreConfidence(input: string): number {
    let score = 0.5;

    // Length-based scoring
    if (input.length > 50) score += 0.1;
    if (input.length > 100) score += 0.1;

    // Specificity indicators
    if (/\b(create|build|implement|add|fix|update|refactor|test)\b/i.test(input)) {
      score += 0.15;
    }

    // Technical terms indicate clearer intent
    if (/\b(component|function|class|api|database|ui|test)\b/i.test(input)) {
      score += 0.1;
    }

    // Constraints indicate clearer scope
    if (/\b(only|just|must|should|need|require)\b/i.test(input)) {
      score += 0.05;
    }

    // Penalize ambiguity
    if (/\b(maybe|perhaps|something|whatever|anything)\b/i.test(input)) {
      score -= 0.15;
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Detect if input contains multiple intents
   */
  detectMultiIntent(input: string): string[] {
    const separators = /\b(and also|plus|additionally|furthermore|moreover|;|\n)\b/gi;
    const parts = input.split(separators).filter(p => p.trim().length > 10);
    
    if (parts.length <= 1) return [input];
    return parts.map(p => p.trim()).filter(p => p.length > 0);
  }

  /**
   * Get clarification history for an intent
   */
  getClarificationHistory(intentId: string): ClarificationExchange[] {
    return this.clarificationHistory.get(intentId) ?? [];
  }

  /**
   * Clear clarification history
   */
  clearHistory(intentId?: string): void {
    if (intentId) {
      this.clarificationHistory.delete(intentId);
    } else {
      this.clarificationHistory.clear();
    }
  }

  private async applyParsingStrategies(
    input: string,
    _context?: {
      previousIntents?: UserIntent[];
      tasteVaultTags?: string[];
      projectContext?: string;
    }
  ): Promise<{
    type: string;
    scope: string;
    constraints: string[];
    confidence: number;
    alternatives: string[];
  }> {
    // Simulate parsing with multiple strategies
    const confidence = this.scoreConfidence(input);
    
    // Determine intent type based on keywords
    const type = this.classifyIntentType(input);
    
    // Extract scope
    const scope = this.extractScope(input);
    
    // Extract constraints
    const constraints = this.extractConstraints(input);
    
    // Generate alternatives
    const alternatives = this.generateAlternatives(input, type);

    return {
      type,
      scope,
      constraints,
      confidence,
      alternatives,
    };
  }

  private classifyIntentType(input: string): string {
    const lower = input.toLowerCase();
    
    if (/\b(create|build|implement|generate|make)\b/.test(lower)) return 'create';
    if (/\b(fix|bug|repair|correct|resolve)\b/.test(lower)) return 'fix';
    if (/\b(update|modify|change|refactor|improve)\b/.test(lower)) return 'modify';
    if (/\b(test|spec|verify|validate|check)\b/.test(lower)) return 'test';
    if (/\b(review|audit|inspect|analyze)\b/.test(lower)) return 'review';
    if (/\b(deploy|publish|release|ship)\b/.test(lower)) return 'deploy';
    
    return 'general';
  }

  private extractScope(input: string): string {
    // Simple scope extraction
    const scopeMatch = input.match(/\b(for|in|to)\s+(?:the\s+)?([a-z]+(?:\s+[a-z]+){0,3})/i);
    return scopeMatch?.[2] ?? 'project';
  }

  private extractConstraints(input: string): string[] {
    const constraints: string[] = [];
    
    // Time constraints
    if (/\b(quick|fast|asap|immediately|soon)\b/i.test(input)) {
      constraints.push('time-sensitive');
    }
    
    // Quality constraints
    if (/\b(clean|proper|best practice|standard)\b/i.test(input)) {
      constraints.push('high-quality');
    }
    
    // Scope constraints
    if (/\b(minimal|simple|basic|small)\b/i.test(input)) {
      constraints.push('minimal-scope');
    }
    
    // Test constraints
    if (/\b(test|spec|coverage)\b/i.test(input)) {
      constraints.push('tested');
    }

    return constraints;
  }

  private generateAlternatives(input: string, type: string): string[] {
    const alternatives: string[] = [];
    
    if (type === 'create') {
      alternatives.push(`Refine: ${input} with tests`);
      alternatives.push(`Alternative: Build incrementally`);
    } else if (type === 'fix') {
      alternatives.push(`Refine: ${input} with regression test`);
    }

    return alternatives;
  }

  private async generateClarificationQuestion(intent: UserIntent): Promise<string> {
    const questions = [
      `Could you provide more details about the ${intent.scope}?`,
      `What specific outcomes are you expecting?`,
      `Are there any constraints I should be aware of?`,
      `Which part of the ${intent.scope} should I focus on first?`,
    ];

    const history = this.clarificationHistory.get(intent.id) ?? [];
    return questions[history.length % questions.length];
  }

  private generateIntentId(): string {
    return `intent-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }
}

export function createL0IntentLayer(config?: Partial<L0Config>): L0IntentLayer {
  return new L0IntentLayer(config);
}
