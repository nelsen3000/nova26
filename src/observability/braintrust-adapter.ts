// KIMI-R23-05: Cinematic Observability & Eval Suite - Braintrust Adapter
// Braintrust integration for eval datasets and experiment tracking

import {
  type EvalSuite,
  type BraintrustDataset,
  type EvaluatorConfig,
} from './types.js';

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Braintrust API configuration
 */
export interface BraintrustConfig {
  /** Braintrust API key */
  apiKey: string;
  /** Project identifier */
  projectId: string;
  /** Project name */
  projectName: string;
  /** API endpoint (optional, for self-hosted) */
  endpoint?: string;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Braintrust experiment configuration
 */
export interface BraintrustExperimentConfig {
  /** Experiment name */
  name: string;
  /** Experiment description */
  description?: string;
  /** Dataset ID to use */
  datasetId: string;
  /** Scoring functions */
  scores?: Array<{
    name: string;
    type: 'exact' | 'fuzzy' | 'llm' | 'custom';
    config?: Record<string, unknown>;
  }>;
}

/**
 * Braintrust experiment result
 */
export interface BraintrustExperimentResult {
  /** Experiment ID */
  experimentId: string;
  /** Overall score (0-1) */
  score: number;
  /** Per-score breakdown */
  scores: Record<string, number>;
  /** Number of evaluations run */
  evalCount: number;
  /** Comparison to baseline */
  comparison?: {
    improved: number;
    regressed: number;
    unchanged: number;
  };
}

// ============================================================================
// Mock Braintrust Client
// ============================================================================

/**
 * Mock Braintrust client for Nova26 development
 * In production, this would connect to the actual Braintrust API
 */
class BraintrustClient {
  private config: BraintrustConfig;
  private datasets: Map<string, BraintrustDataset> = new Map();
  private experiments: Map<string, BraintrustExperimentResult> = new Map();
  private connected: boolean = false;

  constructor(config: BraintrustConfig) {
    this.config = config;
  }

  /**
   * Connect to Braintrust (mock)
   */
  async connect(): Promise<boolean> {
    if (this.config.debug) {
      console.log('[Braintrust] Connecting to project:', this.config.projectName);
    }
    
    // Simulate connection delay
    await new Promise(resolve => setTimeout(resolve, 50));
    
    this.connected = true;
    
    if (this.config.debug) {
      console.log('[Braintrust] Connected successfully');
    }
    
    return true;
  }

  /**
   * Check connection status
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Create or update a dataset
   */
  async upsertDataset(dataset: Omit<BraintrustDataset, 'id'>): Promise<BraintrustDataset> {
    this.ensureConnected();
    
    const fullDataset: BraintrustDataset = {
      ...dataset,
      id: `ds_${this.generateId()}`,
    };
    
    this.datasets.set(fullDataset.id, fullDataset);
    
    if (this.config.debug) {
      console.log(`[Braintrust] Dataset upserted: ${fullDataset.name} (${fullDataset.data.length} entries)`);
    }
    
    return fullDataset;
  }

  /**
   * Get a dataset by ID
   */
  async getDataset(datasetId: string): Promise<BraintrustDataset | null> {
    this.ensureConnected();
    return this.datasets.get(datasetId) || null;
  }

  /**
   * List all datasets
   */
  async listDatasets(): Promise<BraintrustDataset[]> {
    this.ensureConnected();
    return Array.from(this.datasets.values());
  }

  /**
   * Delete a dataset
   */
  async deleteDataset(datasetId: string): Promise<boolean> {
    this.ensureConnected();
    return this.datasets.delete(datasetId);
  }

  /**
   * Run an experiment
   */
  async runExperiment(
    config: BraintrustExperimentConfig,
    runFn: (input: unknown) => Promise<unknown>
  ): Promise<BraintrustExperimentResult> {
    this.ensureConnected();
    
    const dataset = this.datasets.get(config.datasetId);
    if (!dataset) {
      throw new Error(`Dataset not found: ${config.datasetId}`);
    }

    if (this.config.debug) {
      console.log(`[Braintrust] Running experiment: ${config.name} (${dataset.data.length} evals)`);
    }

    const startTime = Date.now();
    let completed = 0;
    let failed = 0;
    const scores: Record<string, number[]> = {};

    // Initialize score arrays
    for (const score of config.scores || []) {
      scores[score.name] = [];
    }

    // Run evaluations
    for (const entry of dataset.data) {
      try {
        const output = await runFn(entry.input);
        
        // Calculate scores
        for (const score of config.scores || []) {
          const scoreValue = this.calculateScore(score, entry.expected, output);
          scores[score.name].push(scoreValue);
        }
        
        completed++;
      } catch (error) {
        failed++;
        if (this.config.debug) {
          console.warn(`[Braintrust] Eval failed for entry ${entry.id}:`, error);
        }
      }
    }

    // Aggregate scores
    const aggregatedScores: Record<string, number> = {};
    for (const [name, values] of Object.entries(scores)) {
      aggregatedScores[name] = values.length > 0
        ? values.reduce((a, b) => a + b, 0) / values.length
        : 0;
    }

    const overallScore = Object.values(aggregatedScores).length > 0
      ? Object.values(aggregatedScores).reduce((a, b) => a + b, 0) / Object.values(aggregatedScores).length
      : 0;

    const result: BraintrustExperimentResult = {
      experimentId: `exp_${this.generateId()}`,
      score: overallScore,
      scores: aggregatedScores,
      evalCount: completed,
      comparison: {
        improved: Math.floor(completed * 0.3),
        regressed: Math.floor(completed * 0.1),
        unchanged: Math.floor(completed * 0.6),
      },
    };

    this.experiments.set(result.experimentId, result);

    if (this.config.debug) {
      const duration = Date.now() - startTime;
      console.log(`[Braintrust] Experiment complete: ${config.name} (${(overallScore * 100).toFixed(1)}%) in ${duration}ms`);
    }

    return result;
  }

  /**
   * Get experiment results
   */
  async getExperiment(experimentId: string): Promise<BraintrustExperimentResult | null> {
    this.ensureConnected();
    return this.experiments.get(experimentId) || null;
  }

  // --------------------------------------------------------------------------
  // Private Helpers
  // --------------------------------------------------------------------------

  private ensureConnected(): void {
    if (!this.connected) {
      throw new Error('Braintrust client not connected. Call connect() first.');
    }
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  private calculateScore(
    scoreConfig: { name: string; type: string; config?: Record<string, unknown> },
    expected: unknown,
    actual: unknown
  ): number {
    switch (scoreConfig.type) {
      case 'exact':
        return JSON.stringify(expected) === JSON.stringify(actual) ? 1 : 0;
      
      case 'fuzzy':
        const expStr = JSON.stringify(expected).toLowerCase();
        const actStr = JSON.stringify(actual).toLowerCase();
        const common = this.longestCommonSubstring(expStr, actStr);
        return expStr.length > 0 ? common.length / Math.max(expStr.length, actStr.length) : 1;
      
      case 'llm':
        // Mock LLM scoring - would call actual LLM in production
        return 0.7 + Math.random() * 0.3;
      
      case 'custom':
        const threshold = scoreConfig.config?.threshold as number || 0.8;
        return Math.random() > (1 - threshold) ? 1 : 0;
      
      default:
        return 0;
    }
  }

  private longestCommonSubstring(a: string, b: string): string {
    const matrix: number[][] = Array(a.length + 1).fill(null).map(() => Array(b.length + 1).fill(0));
    let maxLen = 0;
    let endPos = 0;

    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        if (a[i - 1] === b[j - 1]) {
          matrix[i][j] = matrix[i - 1][j - 1] + 1;
          if (matrix[i][j] > maxLen) {
            maxLen = matrix[i][j];
            endPos = i;
          }
        }
      }
    }

    return a.substring(endPos - maxLen, endPos);
  }
}

// ============================================================================
// BraintrustAdapter Class
// ============================================================================

/**
 * BraintrustAdapter - Integration layer for Braintrust eval platform
 * Provides dataset management, experiment tracking, and result analysis
 */
export class BraintrustAdapter {
  private client: BraintrustClient;
  private config: BraintrustConfig;

  constructor(config: BraintrustConfig) {
    this.config = config;
    this.client = new BraintrustClient(config);
  }

  /**
   * Initialize the adapter and connect to Braintrust
   */
  async initialize(): Promise<boolean> {
    return this.client.connect();
  }

  /**
   * Check if adapter is connected
   */
  isConnected(): boolean {
    return this.client.isConnected();
  }

  /**
   * Convert a Nova26 EvalSuite to a Braintrust dataset
   */
  convertEvalSuiteToDataset(suite: EvalSuite): Omit<BraintrustDataset, 'id'> {
    return {
      name: suite.name,
      projectId: this.config.projectId,
      data: suite.dataset.map((entry, index) => ({
        id: `${suite.id}_entry_${index}`,
        input: entry.input,
        expected: entry.expectedOutput,
        metadata: { tags: entry.tags },
      })),
    };
  }

  /**
   * Upload an EvalSuite as a Braintrust dataset
   */
  async uploadEvalSuite(suite: EvalSuite): Promise<BraintrustDataset> {
    const datasetInput = this.convertEvalSuiteToDataset(suite);
    return this.client.upsertDataset(datasetInput);
  }

  /**
   * Convert Nova26 evaluators to Braintrust scoring config
   */
  convertEvaluatorsToScores(evaluators: EvaluatorConfig[]): BraintrustExperimentConfig['scores'] {
    return evaluators.map(evaluator => {
      let type: 'exact' | 'fuzzy' | 'llm' | 'custom' = 'custom';
      
      switch (evaluator.type) {
        case 'heuristic':
          type = 'exact';
          break;
        case 'llm-judge':
          type = 'llm';
          break;
        case 'human-labeled':
          type = 'exact';
          break;
        case 'taste-vault':
          type = 'fuzzy';
          break;
      }
      
      return {
        name: evaluator.name,
        type,
        config: evaluator.config,
      };
    });
  }

  /**
   * Run a Nova26 EvalSuite as a Braintrust experiment
   */
  async runExperiment(
    suite: EvalSuite,
    runFn: (input: unknown) => Promise<unknown>,
    experimentName?: string
  ): Promise<BraintrustExperimentResult> {
    // First upload the dataset
    const dataset = await this.uploadEvalSuite(suite);
    
    // Configure experiment
    const experimentConfig: BraintrustExperimentConfig = {
      name: experimentName || `${suite.name}_experiment_${Date.now()}`,
      description: `Auto-generated experiment for ${suite.name}`,
      datasetId: dataset.id,
      scores: this.convertEvaluatorsToScores(suite.evaluators),
    };

    return this.client.runExperiment(experimentConfig, runFn);
  }

  /**
   * Compare two experiments
   */
  async compareExperiments(
    baselineId: string,
    candidateId: string
  ): Promise<{
    baseline: BraintrustExperimentResult;
    candidate: BraintrustExperimentResult;
    diff: Record<string, number>;
    improved: boolean;
  }> {
    const baseline = await this.client.getExperiment(baselineId);
    const candidate = await this.client.getExperiment(candidateId);

    if (!baseline || !candidate) {
      throw new Error('One or both experiments not found');
    }

    // Calculate diffs
    const diff: Record<string, number> = {};
    for (const [name, score] of Object.entries(candidate.scores)) {
      const baselineScore = baseline.scores[name] || 0;
      diff[name] = score - baselineScore;
    }

    const overallImproved = candidate.score > baseline.score;

    return {
      baseline,
      candidate,
      diff,
      improved: overallImproved,
    };
  }

  /**
   * Get all datasets
   */
  async listDatasets(): Promise<BraintrustDataset[]> {
    return this.client.listDatasets();
  }

  /**
   * Delete a dataset
   */
  async deleteDataset(datasetId: string): Promise<boolean> {
    return this.client.deleteDataset(datasetId);
  }
}

// ============================================================================
// Singleton Factory
// ============================================================================

let braintrustAdapterInstance: BraintrustAdapter | null = null;

/**
 * Get or create the singleton BraintrustAdapter instance
 */
export function getBraintrustAdapter(config?: BraintrustConfig): BraintrustAdapter {
  if (!braintrustAdapterInstance && config) {
    braintrustAdapterInstance = new BraintrustAdapter(config);
  }
  
  if (!braintrustAdapterInstance) {
    throw new Error('BraintrustAdapter not initialized. Provide config on first call.');
  }
  
  return braintrustAdapterInstance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetBraintrustAdapter(): void {
  braintrustAdapterInstance = null;
}

/**
 * Create a new adapter instance
 */
export function createBraintrustAdapter(config: BraintrustConfig): BraintrustAdapter {
  return new BraintrustAdapter(config);
}
