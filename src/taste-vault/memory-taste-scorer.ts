// Memory Taste Scorer — Scores memory nodes against Taste Vault preferences
// KIMI-R23-03 | Feb 2026

export interface TasteProfile {
  preferredTags: string[];       // Tags that get boosted
  penalizedTags: string[];       // Tags that get penalized
  preferredAgents: string[];     // Agents whose memories are preferred
  contentKeywordWeights: Record<string, number>; // keyword → weight boost (0-2)
  recencyBias: number;           // 0-1; weight for recently created memories
  importanceBias: number;        // 0-1; weight for high-access memories
}

export interface ScoredMemory {
  id: string;
  content: string;
  rawImportance: number;
  tasteScore: number;
  breakdown: {
    tagBoost: number;
    agentBoost: number;
    contentBoost: number;
    recencyBoost: number;
    importanceBoost: number;
  };
}

const DEFAULT_PROFILE: TasteProfile = {
  preferredTags: ['architecture', 'security', 'performance', 'ux'],
  penalizedTags: ['draft', 'deprecated', 'temporary'],
  preferredAgents: ['JUPITER', 'PLUTO', 'VENUS', 'MERCURY'],
  contentKeywordWeights: {
    'pattern': 1.3,
    'best practice': 1.4,
    'antipattern': 0.7,
    'todo': 0.8,
    'fixme': 0.6,
  },
  recencyBias: 0.4,
  importanceBias: 0.3,
};

export class MemoryTasteScorer {
  private profile: TasteProfile;

  constructor(profile: Partial<TasteProfile> = {}) {
    this.profile = { ...DEFAULT_PROFILE, ...profile };
  }

  score(
    id: string,
    content: string,
    tags: string[],
    agentId: string | undefined,
    rawImportance: number,
    createdAt: number,
  ): ScoredMemory {
    const tagBoost = this.computeTagBoost(tags);
    const agentBoost = this.computeAgentBoost(agentId);
    const contentBoost = this.computeContentBoost(content);
    const recencyBoost = this.computeRecencyBoost(createdAt);
    const importanceBoost = rawImportance * this.profile.importanceBias;

    const tasteScore = Math.min(
      1,
      Math.max(0, 0.5 + tagBoost + agentBoost + contentBoost + recencyBoost + importanceBoost),
    );

    return {
      id,
      content,
      rawImportance,
      tasteScore,
      breakdown: { tagBoost, agentBoost, contentBoost, recencyBoost, importanceBoost },
    };
  }

  scoreMany(
    memories: Array<{
      id: string;
      content: string;
      tags: string[];
      agentId?: string;
      importance: number;
      createdAt: number;
    }>,
  ): ScoredMemory[] {
    return memories
      .map(m => this.score(m.id, m.content, m.tags, m.agentId, m.importance, m.createdAt))
      .sort((a, b) => b.tasteScore - a.tasteScore);
  }

  rankByTaste(
    memories: Array<{ id: string; tasteScore: number }>,
  ): typeof memories {
    return [...memories].sort((a, b) => b.tasteScore - a.tasteScore);
  }

  updateProfile(updates: Partial<TasteProfile>): void {
    this.profile = { ...this.profile, ...updates };
  }

  getProfile(): TasteProfile {
    return { ...this.profile };
  }

  private computeTagBoost(tags: string[]): number {
    let boost = 0;
    for (const tag of tags) {
      if (this.profile.preferredTags.includes(tag)) boost += 0.1;
      if (this.profile.penalizedTags.includes(tag)) boost -= 0.15;
    }
    return Math.max(-0.3, Math.min(0.3, boost));
  }

  private computeAgentBoost(agentId: string | undefined): number {
    if (!agentId) return 0;
    return this.profile.preferredAgents.includes(agentId) ? 0.1 : 0;
  }

  private computeContentBoost(content: string): number {
    const lower = content.toLowerCase();
    let boost = 0;
    for (const [keyword, weight] of Object.entries(this.profile.contentKeywordWeights)) {
      if (lower.includes(keyword.toLowerCase())) {
        boost += (weight - 1) * 0.1;
      }
    }
    return Math.max(-0.2, Math.min(0.2, boost));
  }

  private computeRecencyBoost(createdAt: number): number {
    const ageMs = Date.now() - createdAt;
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    const recency = Math.max(0, 1 - ageDays / 30); // recency within last 30 days
    return recency * this.profile.recencyBias * 0.2;
  }
}
