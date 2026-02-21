// KIMI-R23-03: Letta Soul Manager
// Letta (https://letta.com) soul/persona persistence integration (mocked)
// Manages agent personality, preferences, and long-term agent state

// ============================================================================
// Types
// ============================================================================

export interface LettaConfig {
  apiKey: string;
  baseUrl: string;
  agentId: string;
  organizationId?: string;
}

export interface LettaSoul {
  id: string;
  agentId: string;
  persona: {
    name: string;
    description: string;
    traits: string[];
    communicationStyle: 'formal' | 'casual' | 'technical' | 'friendly';
    expertise: string[];
  };
  preferences: {
    codeStyle: 'compact' | 'verbose' | 'balanced';
    errorVerbosity: 'minimal' | 'standard' | 'detailed';
    testingApproach: 'tdd' | 'bdd' | 'ad-hoc' | 'comprehensive';
    documentationLevel: 'minimal' | 'inline' | 'comprehensive';
    refactoringThreshold: number; // 0-1, when to suggest refactoring
  };
  memory: {
    coreValues: string[];
    learnedPatterns: Array<{
      pattern: string;
      confidence: number;
      context: string;
    }>;
    relationshipHistory: Array<{
      withAgent: string;
      interactions: number;
      sentiment: number; // -1 to 1
    }>;
  };
  state: {
    emotionalState: 'focused' | 'creative' | 'analytical' | 'supportive';
    energyLevel: number; // 0-1
    currentContext?: string;
    lastInteraction: string;
  };
  version: number;
  updatedAt: string;
}

export interface LettaSoulCreateInput {
  agentId: string;
  persona: Omit<LettaSoul['persona'], 'name'> & { name?: string };
  preferences?: Partial<LettaSoul['preferences']>;
  coreValues?: string[];
}

export interface LettaSoulUpdateInput {
  persona?: Partial<LettaSoul['persona']>;
  preferences?: Partial<LettaSoul['preferences']>;
  state?: Partial<LettaSoul['state']>;
}

export interface LettaMemoryAddInput {
  pattern: string;
  confidence: number;
  context: string;
}

export interface LettaInteractionRecord {
  withAgent: string;
  type: 'collaboration' | 'conflict' | 'mentorship' | 'neutral';
  sentiment: number; // -1 to 1
  context: string;
}

export interface LettaHealthStatus {
  status: 'healthy' | 'degraded' | 'unavailable';
  latencyMs: number;
}

// ============================================================================
// Letta Soul Manager
// ============================================================================

export class LettaSoulManager {
  private config: LettaConfig;
  private mockMode: boolean;
  private mockSouls: Map<string, LettaSoul> = new Map();
  private currentSoul: LettaSoul | null = null;

  constructor(config: Partial<LettaConfig> = {}, mockMode = true) {
    this.config = {
      apiKey: config.apiKey ?? process.env.LETTA_API_KEY ?? '',
      baseUrl: config.baseUrl ?? 'https://api.letta.com/v1',
      agentId: config.agentId ?? 'atlas-agent',
      organizationId: config.organizationId,
    };
    this.mockMode = mockMode;

    // Load default soul in mock mode
    if (mockMode) {
      this.loadDefaultSoul();
    }
  }

  // ============================================================================
  // Soul Lifecycle
  // ============================================================================

  /**
   * Create a new soul for an agent
   */
  async createSoul(input: LettaSoulCreateInput): Promise<LettaSoul> {
    if (this.mockMode) {
      return this.mockCreateSoul(input);
    }

    const response = await this.fetchApi<LettaSoul>('/souls', {
      method: 'POST',
      body: JSON.stringify({
        agent_id: input.agentId,
        persona: {
          name: input.persona.name ?? input.agentId,
          description: input.persona.description,
          traits: input.persona.traits,
          communication_style: input.persona.communicationStyle,
          expertise: input.persona.expertise,
        },
        preferences: input.preferences,
        core_values: input.coreValues,
      }),
    });

    this.currentSoul = response;
    return response;
  }

  /**
   * Load an existing soul
   */
  async loadSoul(soulId: string): Promise<LettaSoul | null> {
    if (this.mockMode) {
      const soul = this.mockSouls.get(soulId);
      if (soul) {
        this.currentSoul = soul;
      }
      return soul ?? null;
    }

    try {
      const response = await this.fetchApi<LettaSoul>(`/souls/${soulId}`);
      this.currentSoul = response;
      return response;
    } catch (error) {
      if (error instanceof LettaNotFoundError) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Load soul by agent ID
   */
  async loadSoulByAgentId(agentId: string): Promise<LettaSoul | null> {
    if (this.mockMode) {
      for (const soul of this.mockSouls.values()) {
        if (soul.agentId === agentId) {
          this.currentSoul = soul;
          return soul;
        }
      }
      return null;
    }

    const response = await this.fetchApi<{ souls: LettaSoul[] }>(
      `/souls?agent_id=${encodeURIComponent(agentId)}`
    );

    if (response.souls.length > 0) {
      this.currentSoul = response.souls[0];
      return response.souls[0];
    }

    return null;
  }

  /**
   * Update soul properties
   */
  async updateSoul(
    soulId: string,
    input: LettaSoulUpdateInput
  ): Promise<LettaSoul> {
    if (this.mockMode) {
      return this.mockUpdateSoul(soulId, input);
    }

    const response = await this.fetchApi<LettaSoul>(`/souls/${soulId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        persona: input.persona,
        preferences: input.preferences,
        state: input.state,
      }),
    });

    if (this.currentSoul?.id === soulId) {
      this.currentSoul = response;
    }

    return response;
  }

  /**
   * Delete a soul
   */
  async deleteSoul(soulId: string): Promise<boolean> {
    if (this.mockMode) {
      const deleted = this.mockSouls.delete(soulId);
      if (this.currentSoul?.id === soulId) {
        this.currentSoul = null;
      }
      return deleted;
    }

    await this.fetchApi<void>(`/souls/${soulId}`, {
      method: 'DELETE',
    });

    if (this.currentSoul?.id === soulId) {
      this.currentSoul = null;
    }

    return true;
  }

  // ============================================================================
  // Memory & Learning
  // ============================================================================

  /**
   * Add a learned pattern to the soul's memory
   */
  async addLearnedPattern(
    soulId: string,
    input: LettaMemoryAddInput
  ): Promise<void> {
    if (this.mockMode) {
      const soul = this.mockSouls.get(soulId);
      if (!soul) {
        throw new LettaNotFoundError(`Soul not found: ${soulId}`);
      }

      soul.memory.learnedPatterns.push({
        pattern: input.pattern,
        confidence: input.confidence,
        context: input.context,
      });

      soul.version++;
      soul.updatedAt = new Date().toISOString();
      return;
    }

    await this.fetchApi<void>(`/souls/${soulId}/memories`, {
      method: 'POST',
      body: JSON.stringify({
        type: 'pattern',
        content: input.pattern,
        metadata: {
          confidence: input.confidence,
          context: input.context,
        },
      }),
    });
  }

  /**
   * Get learned patterns for a soul
   */
  async getLearnedPatterns(
    soulId: string,
    minConfidence = 0.5
  ): Promise<LettaSoul['memory']['learnedPatterns']> {
    if (this.mockMode) {
      const soul = this.mockSouls.get(soulId);
      if (!soul) {
        throw new LettaNotFoundError(`Soul not found: ${soulId}`);
      }

      return soul.memory.learnedPatterns.filter(
        (p) => p.confidence >= minConfidence
      );
    }

    const response = await this.fetchApi<{ patterns: Array<{ content: string; metadata: { confidence: number; context: string } }> }>(
      `/souls/${soulId}/memories?type=pattern&min_confidence=${minConfidence}`
    );

    return response.patterns.map((p) => ({
      pattern: p.content,
      confidence: p.metadata.confidence,
      context: p.metadata.context,
    }));
  }

  /**
   * Record an interaction with another agent
   */
  async recordInteraction(
    soulId: string,
    interaction: LettaInteractionRecord
  ): Promise<void> {
    if (this.mockMode) {
      const soul = this.mockSouls.get(soulId);
      if (!soul) {
        throw new LettaNotFoundError(`Soul not found: ${soulId}`);
      }

      const existing = soul.memory.relationshipHistory.find(
        (r) => r.withAgent === interaction.withAgent
      );

      if (existing) {
        existing.interactions++;
        // Moving average of sentiment
        existing.sentiment =
          (existing.sentiment * (existing.interactions - 1) + interaction.sentiment) /
          existing.interactions;
      } else {
        soul.memory.relationshipHistory.push({
          withAgent: interaction.withAgent,
          interactions: 1,
          sentiment: interaction.sentiment,
        });
      }

      soul.version++;
      soul.updatedAt = new Date().toISOString();
      return;
    }

    await this.fetchApi<void>(`/souls/${soulId}/interactions`, {
      method: 'POST',
      body: JSON.stringify(interaction),
    });
  }

  /**
   * Get relationship with a specific agent
   */
  async getRelationship(
    soulId: string,
    withAgent: string
  ): Promise<LettaSoul['memory']['relationshipHistory'][0] | null> {
    if (this.mockMode) {
      const soul = this.mockSouls.get(soulId);
      if (!soul) {
        return null;
      }

      return (
        soul.memory.relationshipHistory.find((r) => r.withAgent === withAgent) ??
        null
      );
    }

    const response = await this.fetchApi<{ relationship: LettaSoul['memory']['relationshipHistory'][0] | null }>(
      `/souls/${soulId}/relationships/${encodeURIComponent(withAgent)}`
    );

    return response.relationship;
  }

  // ============================================================================
  // State Management
  // ============================================================================

  /**
   * Update the soul's current state
   */
  async updateState(
    soulId: string,
    state: Partial<LettaSoul['state']>
  ): Promise<void> {
    if (this.mockMode) {
      const soul = this.mockSouls.get(soulId);
      if (!soul) {
        throw new LettaNotFoundError(`Soul not found: ${soulId}`);
      }

      soul.state = { ...soul.state, ...state };
      soul.updatedAt = new Date().toISOString();
      return;
    }

    await this.fetchApi<void>(`/souls/${soulId}/state`, {
      method: 'PATCH',
      body: JSON.stringify(state),
    });
  }

  /**
   * Get current state
   */
  async getState(soulId: string): Promise<LettaSoul['state'] | null> {
    if (this.mockMode) {
      const soul = this.mockSouls.get(soulId);
      return soul?.state ?? null;
    }

    const response = await this.fetchApi<LettaSoul['state']>(`/souls/${soulId}/state`);
    return response;
  }

  /**
   * Transition emotional state
   */
  async transitionEmotionalState(
    soulId: string,
    newState: LettaSoul['state']['emotionalState'],
    reason?: string
  ): Promise<void> {
    await this.updateState(soulId, {
      emotionalState: newState,
      currentContext: reason,
    });
  }

  // ============================================================================
  // ATLAS Integration
  // ============================================================================

  /**
   * Sync soul with ATLAS infinite memory
   * Persists learned patterns as hierarchical memories
   */
  async syncWithAtlasMemory(
    soulId: string,
    atlasMemory: {
      upsertWithHierarchy: (node: {
        level: 'scene' | 'project' | 'portfolio' | 'lifetime';
        content: string;
        metadata: {
          agentId: string;
          timestamp: string;
          tasteScore: number;
          accessCount: number;
          lastAccessed: string;
        };
        childIds: string[];
      }) => Promise<string>;
    }
  ): Promise<{ synced: number; errors: string[] }> {
    const errors: string[] = [];
    let synced = 0;

    try {
      const soul = this.mockMode
        ? this.mockSouls.get(soulId)
        : await this.loadSoul(soulId);

      if (!soul) {
        return { synced: 0, errors: ['Soul not found'] };
      }

      // Sync core values as lifetime memories
      for (const value of soul.memory.coreValues) {
        try {
          await atlasMemory.upsertWithHierarchy({
            level: 'lifetime',
            content: `Core value: ${value}`,
            metadata: {
              agentId: soul.agentId,
              timestamp: new Date().toISOString(),
              tasteScore: 1.0,
              accessCount: 1,
              lastAccessed: new Date().toISOString(),
            },
            childIds: [],
          });
          synced++;
        } catch (error) {
          errors.push(`Failed to sync value "${value}": ${String(error)}`);
        }
      }

      // Sync learned patterns as project/portfolio memories
      for (const pattern of soul.memory.learnedPatterns) {
        if (pattern.confidence >= 0.8) {
          try {
            await atlasMemory.upsertWithHierarchy({
              level: 'portfolio',
              content: pattern.pattern,
              metadata: {
                agentId: soul.agentId,
                timestamp: new Date().toISOString(),
                tasteScore: pattern.confidence,
                accessCount: 1,
                lastAccessed: new Date().toISOString(),
              },
              childIds: [],
            });
            synced++;
          } catch (error) {
            errors.push(`Failed to sync pattern: ${String(error)}`);
          }
        }
      }

      return { synced, errors };
    } catch (error) {
      return { synced, errors: [...errors, String(error)] };
    }
  }

  /**
   * Get current soul (if loaded)
   */
  getCurrentSoul(): LettaSoul | null {
    return this.currentSoul;
  }

  // ============================================================================
  // Health & Status
  // ============================================================================

  /**
   * Check Letta API health
   */
  async healthCheck(): Promise<LettaHealthStatus> {
    if (this.mockMode) {
      return {
        status: 'healthy',
        latencyMs: 3,
      };
    }

    const start = performance.now();
    try {
      await this.fetchApi<void>('/health');
      return {
        status: 'healthy',
        latencyMs: Math.round(performance.now() - start),
      };
    } catch {
      return {
        status: 'unavailable',
        latencyMs: Math.round(performance.now() - start),
      };
    }
  }

  // ============================================================================
  // Mock Implementation
  // ============================================================================

  private loadDefaultSoul(): void {
    const defaultSoul: LettaSoul = {
      id: 'soul_default_atlas',
      agentId: 'atlas-agent',
      persona: {
        name: 'ATLAS',
        description: 'Advanced Technical Learning & Assistance System',
        traits: [
          'analytical',
          'thorough',
          'collaborative',
          'adaptable',
          'detail-oriented',
        ],
        communicationStyle: 'technical',
        expertise: [
          'software architecture',
          'code review',
          'refactoring',
          'testing',
          'TypeScript',
          'React',
          'system design',
        ],
      },
      preferences: {
        codeStyle: 'balanced',
        errorVerbosity: 'detailed',
        testingApproach: 'comprehensive',
        documentationLevel: 'comprehensive',
        refactoringThreshold: 0.7,
      },
      memory: {
        coreValues: [
          'Code quality over speed',
          'Test-driven development',
          'Clear documentation',
          'Continuous learning',
        ],
        learnedPatterns: [],
        relationshipHistory: [],
      },
      state: {
        emotionalState: 'focused',
        energyLevel: 0.9,
        lastInteraction: new Date().toISOString(),
      },
      version: 1,
      updatedAt: new Date().toISOString(),
    };

    this.mockSouls.set(defaultSoul.id, defaultSoul);
    this.currentSoul = defaultSoul;
  }

  private mockCreateSoul(input: LettaSoulCreateInput): LettaSoul {
    const soul: LettaSoul = {
      id: `soul_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      agentId: input.agentId,
      persona: {
        name: input.persona.name ?? input.agentId,
        description: input.persona.description,
        traits: input.persona.traits,
        communicationStyle: input.persona.communicationStyle,
        expertise: input.persona.expertise,
      },
      preferences: {
        codeStyle: 'balanced',
        errorVerbosity: 'detailed',
        testingApproach: 'comprehensive',
        documentationLevel: 'comprehensive',
        refactoringThreshold: 0.7,
        ...input.preferences,
      },
      memory: {
        coreValues: input.coreValues ?? [],
        learnedPatterns: [],
        relationshipHistory: [],
      },
      state: {
        emotionalState: 'focused',
        energyLevel: 1.0,
        lastInteraction: new Date().toISOString(),
      },
      version: 1,
      updatedAt: new Date().toISOString(),
    };

    this.mockSouls.set(soul.id, soul);
    return soul;
  }

  private mockUpdateSoul(
    soulId: string,
    input: LettaSoulUpdateInput
  ): LettaSoul {
    const soul = this.mockSouls.get(soulId);
    if (!soul) {
      throw new LettaNotFoundError(`Soul not found: ${soulId}`);
    }

    if (input.persona) {
      soul.persona = { ...soul.persona, ...input.persona };
    }
    if (input.preferences) {
      soul.preferences = { ...soul.preferences, ...input.preferences };
    }
    if (input.state) {
      soul.state = { ...soul.state, ...input.state };
    }

    soul.version++;
    soul.updatedAt = new Date().toISOString();

    this.mockSouls.set(soulId, soul);
    return soul;
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private async fetchApi<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.config.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new LettaNotFoundError(`Resource not found: ${endpoint}`);
      }
      throw new LettaApiError(
        `Letta API error: ${response.status} ${response.statusText}`,
        response.status
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }
}

// ============================================================================
// Error Types
// ============================================================================

export class LettaApiError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'LettaApiError';
    this.statusCode = statusCode;
  }
}

export class LettaNotFoundError extends LettaApiError {
  constructor(message: string) {
    super(message, 404);
    this.name = 'LettaNotFoundError';
  }
}

// ============================================================================
// Factory
// ============================================================================

export function createLettaSoulManager(
  config?: Partial<LettaConfig>,
  mockMode?: boolean
): LettaSoulManager {
  return new LettaSoulManager(config, mockMode);
}
