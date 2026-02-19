// Parallel Universe Engine — Clone agent loop into parallel creative directions
// KIMI-VISIONARY-02: R16-07 spec

import { z } from 'zod';

// ============================================================================
// Core Types
// ============================================================================

export interface ParallelUniverseConfig {
  maxUniverses: number;          // default: 4
  defaultCount: number;          // default: 3
  computeBudgetMs: number;       // default: 120000 (2 min total)
  perUniverseTimeoutMs: number;  // default: 60000
  modelOverride?: string;        // lighter model for universe exploration
}

export interface ParallelUniverseSession {
  id: string;
  description: string;
  status: 'exploring' | 'compared' | 'selected' | 'blended' | 'cancelled';
  universes: Universe[];
  selectedUniverseId?: string;
  blendedFrom?: string[];        // universe IDs used in blend
  createdAt: string;
  completedAt?: string;
}

export interface Universe {
  id: string;
  sessionId: string;
  label: string;                 // "Universe A", "Universe B", etc.
  approach: string;              // description of the creative direction
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  result?: UniverseResult;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
}

export interface UniverseResult {
  universeId: string;
  codeDiff: string;              // the code changes this universe produced
  qualityScore: number;          // 0-100
  summary: string;               // one-paragraph description of approach
  filesCreated: string[];
  filesModified: string[];
}

export interface BlendRequest {
  sessionId: string;
  sourceUniverses: Array<{
    universeId: string;
    elements: string[];          // what to take from this universe
  }>;
}

// ============================================================================
// Zod Schemas
// ============================================================================

export const ParallelUniverseConfigSchema = z.object({
  maxUniverses: z.number().int().positive().default(4),
  defaultCount: z.number().int().positive().default(3),
  computeBudgetMs: z.number().int().positive().default(120000),
  perUniverseTimeoutMs: z.number().int().positive().default(60000),
  modelOverride: z.string().optional(),
});

export const UniverseResultSchema = z.object({
  universeId: z.string(),
  codeDiff: z.string(),
  qualityScore: z.number().min(0).max(100),
  summary: z.string(),
  filesCreated: z.array(z.string()),
  filesModified: z.array(z.string()),
});

export const UniverseSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  label: z.string(),
  approach: z.string(),
  status: z.enum(['running', 'completed', 'failed', 'cancelled']),
  result: UniverseResultSchema.optional(),
  startedAt: z.string(),
  completedAt: z.string().optional(),
  durationMs: z.number().optional(),
});

export const ParallelUniverseSessionSchema = z.object({
  id: z.string(),
  description: z.string(),
  status: z.enum(['exploring', 'compared', 'selected', 'blended', 'cancelled']),
  universes: z.array(UniverseSchema),
  selectedUniverseId: z.string().optional(),
  blendedFrom: z.array(z.string()).optional(),
  createdAt: z.string(),
  completedAt: z.string().optional(),
});

export const BlendRequestSchema = z.object({
  sessionId: z.string(),
  sourceUniverses: z.array(z.object({
    universeId: z.string(),
    elements: z.array(z.string()),
  })),
});

// ============================================================================
// Default Config
// ============================================================================

const DEFAULT_CONFIG: ParallelUniverseConfig = {
  maxUniverses: 4,
  defaultCount: 3,
  computeBudgetMs: 120000,
  perUniverseTimeoutMs: 60000,
};

// ============================================================================
// Helper Functions
// ============================================================================

function indexToLabel(index: number): string {
  return `Universe ${String.fromCharCode(65 + index)}`; // A, B, C, D, ...
}

// ============================================================================
// ParallelUniverseEngine Class
// ============================================================================

export class ParallelUniverseEngine {
  private config: ParallelUniverseConfig;
  private sessions: Map<string, ParallelUniverseSession> = new Map();

  constructor(config?: Partial<ParallelUniverseConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ---- Session Management ----

  createSession(
    description: string,
    count?: number,
    config?: Partial<ParallelUniverseConfig>
  ): ParallelUniverseSession {
    const sessionConfig = { ...this.config, ...config };
    const universeCount = count ?? sessionConfig.defaultCount;

    if (universeCount > sessionConfig.maxUniverses) {
      throw new Error(
        `Cannot create ${universeCount} universes: maximum is ${sessionConfig.maxUniverses}`
      );
    }

    const sessionId = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    // Create universes
    const universes: Universe[] = [];
    for (let i = 0; i < universeCount; i++) {
      universes.push({
        id: crypto.randomUUID(),
        sessionId,
        label: indexToLabel(i),
        approach: '',
        status: 'running',
        startedAt: createdAt,
      });
    }

    const session: ParallelUniverseSession = {
      id: sessionId,
      description,
      status: 'exploring',
      universes,
      createdAt,
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  async startExploration(sessionId: string): Promise<ParallelUniverseSession> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const explorationStart = Date.now();
    const budget = this.config.computeBudgetMs;
    const perUniverseTimeout = this.config.perUniverseTimeoutMs;

    // Run all universes in parallel with allSettled
    const universePromises = session.universes.map(async (universe) => {
      const universeStart = Date.now();
      
      try {
        // Check if we've exceeded total budget before starting
        if (Date.now() - explorationStart > budget) {
          throw new Error('Total compute budget exceeded');
        }

        // Run the universe exploration with timeout
        const result = await this.runUniverseWithTimeout(
          universe,
          perUniverseTimeout,
          budget - (Date.now() - explorationStart)
        );

        universe.result = result;
        universe.status = 'completed';
        universe.completedAt = new Date().toISOString();
        universe.durationMs = Date.now() - universeStart;
      } catch (error) {
        if ((error as Error).message === 'Timeout') {
          universe.status = 'cancelled';
        } else if ((error as Error).message === 'Total compute budget exceeded') {
          universe.status = 'cancelled';
        } else {
          universe.status = 'failed';
        }
        universe.completedAt = new Date().toISOString();
        universe.durationMs = Date.now() - universeStart;
      }
    });

    await Promise.allSettled(universePromises);

    // Update session status
    session.status = 'compared';
    session.completedAt = new Date().toISOString();

    return session;
  }

  private async runUniverseWithTimeout(
    universe: Universe,
    timeoutMs: number,
    remainingBudgetMs: number
  ): Promise<UniverseResult> {
    const effectiveTimeout = Math.min(timeoutMs, remainingBudgetMs);
    
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Timeout'));
      }, effectiveTimeout);

      // Simulate LLM exploration
      this.exploreUniverse(universe)
        .then((result) => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  private async exploreUniverse(universe: Universe): Promise<UniverseResult> {
    // In production, this would call an LLM to generate approach and code diff
    // For tests, generate deterministic mock results
    
    const approaches = [
      'Minimalist functional approach with clean separation of concerns',
      'Component-based architecture with reusable patterns',
      'Event-driven design with reactive state management',
      'Layered architecture with clear data flow',
    ];

    const index = universe.label.charCodeAt(9) - 65; // 'A' = 0, 'B' = 1, etc.
    const approach = approaches[index % approaches.length];
    const qualityScore = 60 + (index * 10) + Math.floor(Math.random() * 20);

    universe.approach = approach;

    return {
      universeId: universe.id,
      codeDiff: `diff --git a/src/feature.ts b/src/feature.ts\n+ // ${approach}\n+ export function feature() { return true; }`,
      qualityScore: Math.min(100, qualityScore),
      summary: `A ${approach.toLowerCase()} that prioritizes maintainability and testability.`,
      filesCreated: [`src/universe-${index}/feature.ts`],
      filesModified: ['src/index.ts'],
    };
  }

  getSession(sessionId: string): ParallelUniverseSession | undefined {
    return this.sessions.get(sessionId);
  }

  selectUniverse(sessionId: string, universeId: string): ParallelUniverseSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const universe = session.universes.find(u => u.id === universeId);
    if (!universe) {
      throw new Error(`Universe not found in session: ${universeId}`);
    }

    session.selectedUniverseId = universeId;
    session.status = 'selected';

    return session;
  }

  async blendUniverses(request: BlendRequest): Promise<ParallelUniverseSession> {
    const session = this.sessions.get(request.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${request.sessionId}`);
    }

    // Validate all universes belong to this session
    for (const source of request.sourceUniverses) {
      const universe = session.universes.find(u => u.id === source.universeId);
      if (!universe) {
        throw new Error(
          `Universe ${source.universeId} does not belong to session ${request.sessionId}`
        );
      }
    }

    // In production, this would call an LLM to blend the universes
    // For tests, we just mark it as blended
    session.blendedFrom = request.sourceUniverses.map(s => s.universeId);
    session.status = 'blended';

    return session;
  }

  cancelSession(sessionId: string): ParallelUniverseSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Cancel all running universes
    for (const universe of session.universes) {
      if (universe.status === 'running') {
        universe.status = 'cancelled';
        universe.completedAt = new Date().toISOString();
      }
    }

    session.status = 'cancelled';
    session.completedAt = new Date().toISOString();

    return session;
  }

  compareUniverses(sessionId: string): string {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const lines: string[] = ['# Universe Comparison\n'];

    for (const universe of session.universes) {
      const result = universe.result;
      lines.push(`### ${universe.label}`);
      lines.push(`**Approach:** ${universe.approach || 'Not completed'}`);
      lines.push(`**Quality:** ${result ? result.qualityScore : 'N/A'}/100`);
      lines.push(`**Summary:** ${result ? result.summary : 'No result'}`);
      
      if (result) {
        lines.push(`**Files:** ${result.filesCreated.length} created, ${result.filesModified.length} modified`);
      } else {
        lines.push('**Files:** No files generated');
      }
      
      lines.push('');
    }

    return lines.join('\n');
  }
}
