/**
 * Nova26 AI Model Database
 * KIMI-R24-01 - Ensemble Engine
 *
 * Multi-model ensemble debates for selecting the best response.
 * Implements a deliberative voting mechanism where models evaluate
 * each other's responses.
 */

import {
  ModelMetadata,
  EnsembleDebateResult,
  ModelVote,
} from './types.js';
import { AIModelVault } from './ai-model-vault.js';

// ============================================================================
// Debate Configuration
// ============================================================================

interface DebateConfig {
  maxRounds: number;
  consensusThreshold: number;
  minConfidence: number;
  timeoutMs: number;
  votingStrategy: 'weighted' | 'majority' | 'unanimous';
}

const DEFAULT_CONFIG: DebateConfig = {
  maxRounds: 2,
  consensusThreshold: 0.7,
  minConfidence: 0.6,
  timeoutMs: 30000,
  votingStrategy: 'weighted',
};

// ============================================================================
// Mock Response Generation
// ============================================================================

interface MockResponse {
  content: string;
  confidence: number;
  quality: number; // 0-1 quality score
}

// Mock responses for demonstration (in production, these would be real LLM calls)
const MOCK_RESPONSES: Record<string, MockResponse[]> = {
  'gpt-4o': [
    { content: 'Implementation using async/await with proper error handling', confidence: 0.92, quality: 0.9 },
    { content: 'Functional approach with immutable data structures', confidence: 0.88, quality: 0.85 },
  ],
  'claude-3-5-sonnet': [
    { content: 'Clean architecture with separation of concerns', confidence: 0.95, quality: 0.92 },
    { content: 'Type-safe implementation with comprehensive edge case handling', confidence: 0.93, quality: 0.9 },
  ],
  'llama-3.1-70b': [
    { content: 'Efficient implementation with minimal dependencies', confidence: 0.85, quality: 0.8 },
    { content: 'Straightforward solution following best practices', confidence: 0.82, quality: 0.78 },
  ],
  'default': [
    { content: 'Standard implementation approach', confidence: 0.75, quality: 0.7 },
    { content: 'Basic solution with core functionality', confidence: 0.7, quality: 0.65 },
  ],
};

// ============================================================================
// Ensemble Engine Class
// ============================================================================

export class EnsembleEngine {
  private vault: AIModelVault;
  private config: DebateConfig;

  constructor(vault: AIModelVault, config: Partial<DebateConfig> = {}) {
    this.vault = vault;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // --------------------------------------------------------------------------
  // Core Debate API
  // --------------------------------------------------------------------------

  /**
   * Run a multi-model ensemble debate.
   * Each model generates a response, then votes on the best response.
   */
  async debate(
    modelIds: string[],
    prompt: string
  ): Promise<EnsembleDebateResult> {
    // Validate models
    const models = modelIds
      .map((id) => this.vault.getModel(id))
      .filter((m): m is ModelMetadata => m !== undefined);

    if (models.length === 0) {
      throw new Error('No valid models provided for debate');
    }

    if (models.length === 1) {
      return this.singleModelResult(models[0]!);
    }

    // Phase 1: Generate responses from each model
    const responses = await this.generateResponses(models, prompt);

    // Phase 2: Voting rounds
    let round = 0;
    let consensus = 0;
    let votes: ModelVote[] = [];

    while (round < this.config.maxRounds && consensus < this.config.consensusThreshold) {
      votes = await this.runVotingRound(models, responses);
      consensus = this.calculateConsensus(votes);
      round++;
    }

    // Phase 3: Determine winner
    const winner = this.determineWinner(votes, models, responses);

    return {
      winner: winner.modelId,
      reasoning: this.generateReasoning(winner, votes, round),
      votes,
      consensusScore: consensus,
    };
  }

  /**
   * Quick debate with pre-selected models based on task type.
   * Automatically selects appropriate models for common scenarios.
   */
  async quickDebate(
    taskType: 'code' | 'reasoning' | 'creative',
    prompt: string
  ): Promise<EnsembleDebateResult> {
    const modelIds = this.selectModelsForTask(taskType);
    return this.debate(modelIds, prompt);
  }

  /**
   * Compare specific models for a given prompt.
   * Returns detailed comparison metrics.
   */
  async compare(
    modelIds: string[],
    prompt: string
  ): Promise<Array<{ modelId: string; response: string; score: number }>> {
    const models = modelIds
      .map((id) => this.vault.getModel(id))
      .filter((m): m is ModelMetadata => m !== undefined);

    const responses = await this.generateResponses(models, prompt);
    const votes = await this.runVotingRound(models, responses);

    // Calculate scores from votes
    const scores = new Map<string, number>();
    for (const vote of votes) {
      const current = scores.get(vote.votedFor) ?? 0;
      scores.set(vote.votedFor, current + vote.confidence);
    }

    return responses.map((r) => ({
      modelId: r.modelId,
      response: r.response,
      score: scores.get(r.modelId) ?? 0,
    }));
  }

  // --------------------------------------------------------------------------
  // Configuration
  // --------------------------------------------------------------------------

  /**
   * Update debate configuration.
   */
  updateConfig(config: Partial<DebateConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration.
   */
  getConfig(): DebateConfig {
    return { ...this.config };
  }

  // --------------------------------------------------------------------------
  // Private Helpers
  // --------------------------------------------------------------------------

  private async generateResponses(
    models: ModelMetadata[],
    _prompt: string // eslint-disable-line -- mocked in tests
  ): Promise<Array<{ modelId: string; response: string; confidence: number; quality: number }>> {
    // In production, these would be parallel LLM API calls
    // For now, use mock responses based on model capabilities
    const responses: Array<{
      modelId: string;
      response: string;
      confidence: number;
      quality: number;
    }> = [];

    for (const model of models) {
      const mockResponse = this.getMockResponse(model);
      responses.push({
        modelId: model.id,
        response: mockResponse.content,
        confidence: mockResponse.confidence,
        quality: mockResponse.quality,
      });
    }

    return responses;
  }

  private async runVotingRound(
    models: ModelMetadata[],
    responses: Array<{ modelId: string; response: string; confidence: number; quality: number }>
  ): Promise<ModelVote[]> {
    const votes: ModelVote[] = [];

    for (const voter of models) {
      const vote = this.castVote(voter, responses);
      votes.push(vote);
    }

    return votes;
  }

  private castVote(
    voter: ModelMetadata,
    responses: Array<{ modelId: string; response: string; confidence: number; quality: number }>
  ): ModelVote {
    // Exclude self-voting for fairness
    const otherResponses = responses.filter((r) => r.modelId !== voter.id);

    if (otherResponses.length === 0) {
      // Only self response available
      const self = responses.find((r) => r.modelId === voter.id);
      return {
        modelId: voter.id,
        response: self?.response ?? '',
        confidence: self?.confidence ?? 0.5,
        votedFor: voter.id,
      };
    }

    // Score each response based on:
    // - Response quality (simulated)
    // - Voter's capability bias (models favor responses matching their strengths)
    const scored = otherResponses.map((r) => {
      let score = r.quality;

      // Boost for code-related responses from code-capable voters
      if (voter.capabilities.code > 80 && r.response.includes('implementation')) {
        score += 0.1;
      }

      // Boost for architectural responses from reasoning-capable voters
      if (voter.capabilities.reasoning > 80 && r.response.includes('architecture')) {
        score += 0.1;
      }

      return { ...r, score };
    });

    // Select best response
    scored.sort((a, b) => b.score - a.score);
    const winner = scored[0]!;

    return {
      modelId: voter.id,
      response: winner.response,
      confidence: Math.min(1, winner.score + 0.1),
      votedFor: winner.modelId,
    };
  }

  private calculateConsensus(votes: ModelVote[]): number {
    if (votes.length === 0) return 0;

    // Count votes for each model
    const voteCounts = new Map<string, number>();
    for (const vote of votes) {
      const current = voteCounts.get(vote.votedFor) ?? 0;
      voteCounts.set(vote.votedFor, current + 1);
    }

    // Find majority vote share
    const maxVotes = Math.max(...Array.from(voteCounts.values()));
    return maxVotes / votes.length;
  }

  private determineWinner(
    votes: ModelVote[],
    models: ModelMetadata[],
    responses: Array<{ modelId: string; response: string; confidence: number; quality: number }>
  ): { modelId: string; score: number } {
    // Calculate weighted scores
    const scores = new Map<string, number>();
    const voterCapabilities = new Map(models.map((m) => [m.id, m.capabilities]));

    for (const vote of votes) {
      const voterCaps = voterCapabilities.get(vote.modelId);
      const weight = voterCaps
        ? (voterCaps.code + voterCaps.reasoning) / 200
        : 0.5;

      const current = scores.get(vote.votedFor) ?? 0;
      scores.set(vote.votedFor, current + vote.confidence * weight);
    }

    // Convert to array for iteration
    const scoreEntries = Array.from(scores.entries());

    // Find winner
    let winnerId = '';
    let maxScore = -1;

    for (const [modelId, score] of scoreEntries) {
      if (score > maxScore) {
        maxScore = score;
        winnerId = modelId;
      }
    }

    // Fallback to first response if no votes
    if (!winnerId && responses.length > 0) {
      winnerId = responses[0]!.modelId;
      maxScore = responses[0]!.confidence;
    }

    return { modelId: winnerId, score: maxScore };
  }

  private generateReasoning(
    winner: { modelId: string; score: number },
    votes: ModelVote[],
    rounds: number
  ): string {
    const voteCount = votes.filter((v) => v.votedFor === winner.modelId).length;
    const totalVotes = votes.length;

    const reasons: string[] = [];
    reasons.push(`${winner.modelId} won with ${voteCount}/${totalVotes} votes`);
    reasons.push(`Consensus reached after ${rounds} round${rounds > 1 ? 's' : ''}`);
    reasons.push(`Weighted score: ${(winner.score * 100).toFixed(1)}%`);

    if (winner.score > 0.8) {
      reasons.push('Strong consensus across models');
    } else if (winner.score > 0.5) {
      reasons.push('Moderate agreement with some divergence');
    } else {
      reasons.push('Weak consensus - consider reviewing alternatives');
    }

    return reasons.join('; ');
  }

  private singleModelResult(model: ModelMetadata): EnsembleDebateResult {
    return {
      winner: model.id,
      reasoning: 'Single model debate - no alternatives to compare',
      votes: [
        {
          modelId: model.id,
          response: 'Default response',
          confidence: 1.0,
          votedFor: model.id,
        },
      ],
      consensusScore: 1.0,
    };
  }

  private selectModelsForTask(taskType: string): string[] {
    const selections: Record<string, string[]> = {
      code: ['claude-3-5-sonnet', 'gpt-4o', 'codellama-34b'],
      reasoning: ['claude-3-opus', 'gpt-4o', 'mistral-large'],
      creative: ['claude-3-5-sonnet', 'gpt-4o', 'gemini-1.5-pro'],
    };

    return selections[taskType] ?? ['gpt-4o', 'claude-3-5-sonnet'];
  }

  private getMockResponse(model: ModelMetadata): MockResponse {
    const responses = MOCK_RESPONSES[model.id] ?? MOCK_RESPONSES['default'];
    // Deterministic selection based on model capabilities
    const index = Math.floor((model.capabilities.code + model.capabilities.reasoning) / 50) % responses.length;
    return responses[index] ?? responses[0]!;
  }
}
