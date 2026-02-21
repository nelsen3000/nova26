// Ensemble Engine — Multi-model debate and ensemble voting
// KIMI-R24-01 | Feb 2026

export interface EnsembleParticipant {
  modelId: string;
  weight: number;    // 0-1; higher = more influence
  agentId?: string;
}

export interface DebateRound {
  round: number;
  responses: Array<{ modelId: string; response: string; confidence: number }>;
  consensusReached: boolean;
  consensusResponse?: string;
}

export interface EnsembleDebateResult {
  finalResponse: string;
  roundsNeeded: number;
  participantResponses: Array<{ modelId: string; finalResponse: string; weight: number }>;
  consensusScore: number;    // 0-1; how much participants agreed
  tasteVaultScore: number;
  durationMs: number;
}

export interface EnsembleConfig {
  maxRounds: number;
  consensusThreshold: number;  // 0-1; similarity above this = consensus
  timeoutMs: number;
  votingStrategy: 'majority' | 'weighted' | 'best-of-n';
}

export type ModelInferenceFn = (
  modelId: string,
  prompt: string,
) => Promise<{ response: string; confidence: number }>;

const DEFAULT_CONFIG: EnsembleConfig = {
  maxRounds: 3,
  consensusThreshold: 0.75,
  timeoutMs: 30000,
  votingStrategy: 'weighted',
};

export class EnsembleEngine {
  private config: EnsembleConfig;

  constructor(config: Partial<EnsembleConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async ensembleDebate(
    participants: EnsembleParticipant[],
    prompt: string,
    inferenceFn: ModelInferenceFn,
  ): Promise<EnsembleDebateResult> {
    const start = Date.now();
    const rounds: DebateRound[] = [];
    let finalResponse = '';

    for (let round = 1; round <= this.config.maxRounds; round++) {
      // Each participant responds (potentially informed by previous round)
      const previousRound = rounds[round - 2];
      const contextualPrompt = previousRound
        ? `${prompt}\n\n[Previous round responses: ${previousRound.responses.map(r => r.response).join(' | ')}]`
        : prompt;

      const responses = await Promise.all(
        participants.map(async p => {
          const result = await inferenceFn(p.modelId, contextualPrompt);
          return { modelId: p.modelId, response: result.response, confidence: result.confidence };
        }),
      );

      const consensus = this.checkConsensus(responses, this.config.consensusThreshold);

      rounds.push({ round, responses, consensusReached: consensus.reached, consensusResponse: consensus.response });

      if (consensus.reached) {
        finalResponse = consensus.response!;
        break;
      }
    }

    // If no consensus, use voting strategy
    if (!finalResponse) {
      const lastRound = rounds[rounds.length - 1]!;
      finalResponse = this.applyVotingStrategy(lastRound.responses, participants);
    }

    const consensusScore = this.computeConsensusScore(
      rounds[rounds.length - 1]?.responses ?? [],
    );

    return {
      finalResponse,
      roundsNeeded: rounds.length,
      participantResponses: participants.map(p => {
        const lastResponse = rounds[rounds.length - 1]?.responses.find(r => r.modelId === p.modelId);
        return { modelId: p.modelId, finalResponse: lastResponse?.response ?? '', weight: p.weight };
      }),
      consensusScore,
      tasteVaultScore: this.estimateTasteScore(finalResponse),
      durationMs: Date.now() - start,
    };
  }

  private checkConsensus(
    responses: Array<{ response: string; confidence: number }>,
    threshold: number,
  ): { reached: boolean; response?: string } {
    if (!responses.length) return { reached: false };

    // Simple consensus: check if most responses share significant overlap
    const allResponses = responses.map(r => r.response.toLowerCase().split(/\s+/));
    const commonWords = allResponses.reduce((common, words) => {
      if (!common) return new Set(words);
      return new Set([...common].filter(w => words.includes(w)));
    }, null as Set<string> | null);

    const longestResponse = responses.reduce((a, b) => a.response.length > b.response.length ? a : b);
    const totalWords = longestResponse.response.toLowerCase().split(/\s+/).length;
    const overlapRatio = (commonWords?.size ?? 0) / Math.max(totalWords, 1);

    if (overlapRatio >= threshold) {
      // Pick highest confidence response
      const best = responses.reduce((a, b) => a.confidence > b.confidence ? a : b);
      return { reached: true, response: best.response };
    }
    return { reached: false };
  }

  private applyVotingStrategy(
    responses: Array<{ modelId: string; response: string; confidence: number }>,
    participants: EnsembleParticipant[],
  ): string {
    if (!responses.length) return '';

    switch (this.config.votingStrategy) {
      case 'best-of-n':
        return responses.reduce((a, b) => a.confidence > b.confidence ? a : b).response;

      case 'weighted': {
        // Weight each response by participant weight and confidence
        const scored = responses.map(r => {
          const participant = participants.find(p => p.modelId === r.modelId);
          return { response: r.response, score: (participant?.weight ?? 0.5) * r.confidence };
        });
        return scored.reduce((a, b) => a.score > b.score ? a : b).response;
      }

      case 'majority':
      default:
        // Return the most common response (by content similarity)
        return responses[Math.floor(responses.length / 2)]?.response ?? responses[0]!.response;
    }
  }

  private computeConsensusScore(
    responses: Array<{ response: string; confidence: number }>,
  ): number {
    if (responses.length <= 1) return 1;
    const avgConf = responses.reduce((s, r) => s + r.confidence, 0) / responses.length;
    return Math.min(1, avgConf);
  }

  private estimateTasteScore(response: string): number {
    // Simple heuristic: longer, more structured responses tend to score better
    const words = response.split(/\s+/).length;
    const hasStructure = /(\n|```|##|\d\.)/.test(response);
    return Math.min(1, 0.5 + words / 200 + (hasStructure ? 0.1 : 0));
  }
}
