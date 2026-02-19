// Overnight Evolution Engine — Safe experiments on sandbox copies
// KIMI-VISIONARY-03: R16-08 spec

import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { z } from 'zod';

// ============================================================================
// Core Types
// ============================================================================

export interface OvernightEvolutionConfig {
  enabled: boolean;              // default: false (opt-in)
  schedule: 'nightly' | 'weekly' | 'manual';
  computeBudgetMs: number;       // default: 600000 (10 min)
  maxExperiments: number;        // default: 20
  perExperimentTimeoutMs: number;// default: 300000 (5 min)
  sandboxPath: string;           // default: '.nova/sandbox/evolution'
  reportPath: string;            // default: '.nova/evolution-reports'
}

export type ExperimentType =
  | 'wisdom-pattern'             // apply Global Wisdom pattern
  | 'alternative-impl'          // try different implementation
  | 'dependency-upgrade'        // simulate upgrade
  | 'refactor-suggestion'       // VENUS-suggested refactor
  | 'test-gap-fill';            // PLUTO-suggested test

export interface Experiment {
  id: string;
  sessionId: string;
  type: ExperimentType;
  description: string;
  status: 'pending' | 'running' | 'success' | 'failure' | 'skipped' | 'timeout';
  beforeScore?: number;          // quality score before
  afterScore?: number;           // quality score after
  scoreDelta?: number;           // after - before
  diff?: string;                 // the code changes
  testsPassed?: boolean;
  durationMs?: number;
  error?: string;
}

export interface OvernightSession {
  id: string;
  startedAt: string;
  completedAt?: string;
  status: 'running' | 'completed' | 'aborted';
  experiments: Experiment[];
  computeUsedMs: number;
  report?: MorningReport;
}

export interface MorningReport {
  sessionId: string;
  generatedAt: string;
  totalExperiments: number;
  successful: number;
  improved: number;              // experiments with positive scoreDelta
  recommendations: Array<{
    experimentId: string;
    summary: string;
    scoreDelta: number;
    actionLabel: string;         // e.g., "Apply refactor to auth module"
  }>;
  narrative: string;             // 2-3 sentence natural language summary
}

// ============================================================================
// Zod Schemas
// ============================================================================

export const OvernightEvolutionConfigSchema = z.object({
  enabled: z.boolean().default(false),
  schedule: z.enum(['nightly', 'weekly', 'manual']).default('manual'),
  computeBudgetMs: z.number().int().positive().default(600000),
  maxExperiments: z.number().int().positive().default(20),
  perExperimentTimeoutMs: z.number().int().positive().default(300000),
  sandboxPath: z.string().default('.nova/sandbox/evolution'),
  reportPath: z.string().default('.nova/evolution-reports'),
});

export const ExperimentSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  type: z.enum(['wisdom-pattern', 'alternative-impl', 'dependency-upgrade', 'refactor-suggestion', 'test-gap-fill']),
  description: z.string(),
  status: z.enum(['pending', 'running', 'success', 'failure', 'skipped', 'timeout']),
  beforeScore: z.number().optional(),
  afterScore: z.number().optional(),
  scoreDelta: z.number().optional(),
  diff: z.string().optional(),
  testsPassed: z.boolean().optional(),
  durationMs: z.number().optional(),
  error: z.string().optional(),
});

export const MorningReportSchema = z.object({
  sessionId: z.string(),
  generatedAt: z.string(),
  totalExperiments: z.number(),
  successful: z.number(),
  improved: z.number(),
  recommendations: z.array(z.object({
    experimentId: z.string(),
    summary: z.string(),
    scoreDelta: z.number(),
    actionLabel: z.string(),
  })),
  narrative: z.string(),
});

export const OvernightSessionSchema = z.object({
  id: z.string(),
  startedAt: z.string(),
  completedAt: z.string().optional(),
  status: z.enum(['running', 'completed', 'aborted']),
  experiments: z.array(ExperimentSchema),
  computeUsedMs: z.number(),
  report: MorningReportSchema.optional(),
});

// ============================================================================
// Default Config
// ============================================================================

const DEFAULT_CONFIG: OvernightEvolutionConfig = {
  enabled: false,
  schedule: 'manual',
  computeBudgetMs: 600000,
  maxExperiments: 20,
  perExperimentTimeoutMs: 300000,
  sandboxPath: '.nova/sandbox/evolution',
  reportPath: '.nova/evolution-reports',
};

// ============================================================================
// OvernightEngine Class
// ============================================================================

export class OvernightEngine {
  private config: OvernightEvolutionConfig;
  private sessions: Map<string, OvernightSession> = new Map();

  constructor(config?: Partial<OvernightEvolutionConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ---- Session Management ----

  createSession(config?: Partial<OvernightEvolutionConfig>): OvernightSession {
    const sessionConfig = { ...this.config, ...config };

    const session: OvernightSession = {
      id: crypto.randomUUID(),
      startedAt: new Date().toISOString(),
      status: 'running',
      experiments: [],
      computeUsedMs: 0,
    };

    // Create sandbox directory if needed
    if (sessionConfig.enabled) {
      this.ensureSandboxExists(sessionConfig.sandboxPath);
    }

    this.sessions.set(session.id, session);
    return session;
  }

  async runSession(sessionId: string): Promise<OvernightSession> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const experiments = [...session.experiments]; // Copy to avoid mutation issues
    let computeUsed = 0;
    let experimentCount = 0;

    for (const experiment of experiments) {
      // Check compute budget
      if (computeUsed >= this.config.computeBudgetMs) {
        experiment.status = 'skipped';
        continue;
      }

      // Check max experiments
      if (experimentCount >= this.config.maxExperiments) {
        experiment.status = 'skipped';
        continue;
      }

      // Run experiment
      experiment.status = 'running';
      const startTime = Date.now();

      try {
        const result = await this.runExperiment(experiment, this.config.perExperimentTimeoutMs);
        
        experiment.beforeScore = result.beforeScore;
        experiment.afterScore = result.afterScore;
        experiment.scoreDelta = result.scoreDelta;
        experiment.diff = result.diff;
        experiment.testsPassed = result.testsPassed;
        experiment.status = result.success ? 'success' : 'failure';
        experiment.error = result.error;
      } catch (error) {
        const duration = Date.now() - startTime;
        if (duration >= this.config.perExperimentTimeoutMs) {
          experiment.status = 'timeout';
        } else {
          experiment.status = 'failure';
        }
        experiment.error = (error as Error).message;
      }

      const duration = Date.now() - startTime;
      experiment.durationMs = duration;
      computeUsed += duration;
      experimentCount++;
    }

    session.computeUsedMs = computeUsed;
    session.status = 'completed';
    session.completedAt = new Date().toISOString();

    return session;
  }

  private async runExperiment(
    experiment: Experiment,
    timeoutMs: number
  ): Promise<{
    success: boolean;
    beforeScore: number;
    afterScore: number;
    scoreDelta: number;
    diff: string;
    testsPassed: boolean;
    error?: string;
  }> {
    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        resolve({
          success: false,
          beforeScore: 0,
          afterScore: 0,
          scoreDelta: 0,
          diff: '',
          testsPassed: false,
          error: 'Timeout',
        });
      }, timeoutMs);

      // Simulate experiment execution
      this.simulateExperiment(experiment).then((result) => {
        clearTimeout(timeoutId);
        resolve(result);
      });
    });
  }

  private async simulateExperiment(
    experiment: Experiment
  ): Promise<{
    success: boolean;
    beforeScore: number;
    afterScore: number;
    scoreDelta: number;
    diff: string;
    testsPassed: boolean;
    error?: string;
  }> {
    // Deterministic mock based on experiment type
    const typeIndex = [
      'wisdom-pattern',
      'alternative-impl',
      'dependency-upgrade',
      'refactor-suggestion',
      'test-gap-fill',
    ].indexOf(experiment.type);

    // Generate a predictable score based on type
    const baseScore = 60 + (typeIndex * 5);
    const beforeScore = baseScore;
    const improvement = typeIndex === 0 ? 15 : typeIndex === 1 ? 10 : typeIndex === 2 ? 5 : 8;
    const afterScore = baseScore + improvement;

    return {
      success: true,
      beforeScore,
      afterScore,
      scoreDelta: improvement,
      diff: `diff --git a/src/${experiment.type}.ts b/src/${experiment.type}.ts\n+ // Improved by ${experiment.type}\n+ export const improved = true;`,
      testsPassed: typeIndex !== 2, // dependency-upgrade might fail tests
    };
  }

  generateReport(sessionId: string): MorningReport {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const totalExperiments = session.experiments.length;
    const successful = session.experiments.filter(e => e.status === 'success').length;
    const improved = session.experiments.filter(
      e => e.scoreDelta && e.scoreDelta > 0
    ).length;

    const recommendations = session.experiments
      .filter(e => e.scoreDelta && e.scoreDelta > 0)
      .sort((a, b) => (b.scoreDelta || 0) - (a.scoreDelta || 0))
      .map(e => ({
        experimentId: e.id,
        summary: `${e.type}: ${e.description}`,
        scoreDelta: e.scoreDelta || 0,
        actionLabel: `Apply ${e.type}: ${e.description}`,
      }));

    const narrative = this.generateNarrative(totalExperiments, successful, improved);

    const report: MorningReport = {
      sessionId,
      generatedAt: new Date().toISOString(),
      totalExperiments,
      successful,
      improved,
      recommendations,
      narrative,
    };

    session.report = report;

    // Write report to disk
    this.persistReport(report);

    return report;
  }

  private generateNarrative(total: number, successful: number, improved: number): string {
    if (total === 0) {
      return 'No experiments were run during this session.';
    }

    const successRate = Math.round((successful / total) * 100);
    
    return `Ran ${total} experiments with a ${successRate}% success rate. ` +
      `${improved} experiments showed measurable quality improvements. ` +
      `Review the recommendations below to apply the most promising changes.`;
  }

  private persistReport(report: MorningReport): void {
    const reportPath = this.config.reportPath;
    
    if (!existsSync(reportPath)) {
      mkdirSync(reportPath, { recursive: true });
    }

    const filePath = join(reportPath, `${report.sessionId}-report.json`);
    const validated = MorningReportSchema.parse(report);
    writeFileSync(filePath, JSON.stringify(validated, null, 2));
  }

  getSession(sessionId: string): OvernightSession | undefined {
    return this.sessions.get(sessionId);
  }

  listSessions(): OvernightSession[] {
    return Array.from(this.sessions.values());
  }

  async applyExperiment(experimentId: string): Promise<boolean> {
    // Find experiment across all sessions
    let experiment: Experiment | undefined;
    
    for (const session of this.sessions.values()) {
      experiment = session.experiments.find(e => e.id === experimentId);
      if (experiment) break;
    }

    if (!experiment) {
      return false;
    }

    // Only apply successful experiments
    if (experiment.status !== 'success') {
      return false;
    }

    // In production, this would apply the diff to the real codebase
    // For tests, we just return true
    return true;
  }

  abortSession(sessionId: string): OvernightSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.status = 'aborted';
    session.completedAt = new Date().toISOString();

    // Mark pending/running experiments as skipped
    for (const experiment of session.experiments) {
      if (experiment.status === 'pending' || experiment.status === 'running') {
        experiment.status = 'skipped';
      }
    }

    return session;
  }

  getLatestReport(): MorningReport | undefined {
    const sessionsWithReports = Array.from(this.sessions.values())
      .filter(s => s.report && s.status === 'completed')
      .sort((a, b) => 
        new Date(b.completedAt || 0).getTime() - new Date(a.completedAt || 0).getTime()
      );

    return sessionsWithReports[0]?.report;
  }

  // ---- Private Helpers ----

  private ensureSandboxExists(sandboxPath: string): void {
    if (!existsSync(sandboxPath)) {
      mkdirSync(sandboxPath, { recursive: true });
    }
  }
}
