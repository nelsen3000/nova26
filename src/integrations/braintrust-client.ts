// KMS-11: Braintrust API Client
// Mock implementation for experiment tracking and evaluation

// ============================================================================
// Types
// ============================================================================

export interface BraintrustExperiment {
  id: string;
  name: string;
  projectId: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  status: 'running' | 'completed' | 'failed';
  metadata?: Record<string, unknown>;
}

export interface BraintrustResult {
  id: string;
  experimentId: string;
  input: string;
  expectedOutput?: string;
  actualOutput: string;
  scores: Record<string, number>;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export interface BraintrustScore {
  name: string;
  value: number;
  weight: number;
  metadata?: Record<string, unknown>;
}

export interface CreateExperimentOptions {
  name: string;
  projectId?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface LogResultOptions {
  experimentId: string;
  input: string;
  expectedOutput?: string;
  actualOutput: string;
  scores?: Record<string, number>;
  metadata?: Record<string, unknown>;
}

export interface ListExperimentsOptions {
  projectId?: string;
  status?: 'running' | 'completed' | 'failed';
  limit?: number;
  offset?: number;
}

// ============================================================================
// Mock Data Store
// ============================================================================

class MockBraintrustStore {
  private experiments: Map<string, BraintrustExperiment> = new Map();
  private results: Map<string, BraintrustResult[]> = new Map();
  private nextId = 1;

  generateId(): string {
    return `bt-exp-${Date.now()}-${this.nextId++}`;
  }

  generateResultId(): string {
    return `bt-res-${Date.now()}-${this.nextId++}`;
  }

  saveExperiment(exp: BraintrustExperiment): void {
    this.experiments.set(exp.id, exp);
    if (!this.results.has(exp.id)) {
      this.results.set(exp.id, []);
    }
  }

  getExperiment(id: string): BraintrustExperiment | undefined {
    return this.experiments.get(id);
  }

  listExperiments(options: ListExperimentsOptions = {}): BraintrustExperiment[] {
    let exps = Array.from(this.experiments.values());

    if (options.projectId) {
      exps = exps.filter((e) => e.projectId === options.projectId);
    }

    if (options.status) {
      exps = exps.filter((e) => e.status === options.status);
    }

    // Sort by createdAt desc
    exps.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (options.offset) {
      exps = exps.slice(options.offset);
    }

    if (options.limit) {
      exps = exps.slice(0, options.limit);
    }

    return exps;
  }

  saveResult(result: BraintrustResult): void {
    const list = this.results.get(result.experimentId) || [];
    list.push(result);
    this.results.set(result.experimentId, list);
  }

  getResults(experimentId: string): BraintrustResult[] {
    return this.results.get(experimentId) || [];
  }

  clear(): void {
    this.experiments.clear();
    this.results.clear();
    this.nextId = 1;
  }
}

const store = new MockBraintrustStore();

// ============================================================================
// Braintrust Client
// ============================================================================

export interface BraintrustClientConfig {
  apiKey: string;
  baseUrl?: string;
  projectId?: string;
}

export class BraintrustClient {
  private config: BraintrustClientConfig;
  private connected = false;

  constructor(config: BraintrustClientConfig) {
    this.config = {
      baseUrl: 'https://api.braintrust.dev',
      ...config,
    };
  }

  /**
   * Connect to Braintrust API (mock)
   */
  async connect(): Promise<boolean> {
    // Simulate connection delay
    await new Promise((resolve) => setTimeout(resolve, 50));

    if (!this.config.apiKey) {
      throw new Error('Braintrust API key is required');
    }

    this.connected = true;
    return true;
  }

  /**
   * Check if client is connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Create a new experiment
   */
  async createExperiment(options: CreateExperimentOptions): Promise<BraintrustExperiment> {
    this.ensureConnected();

    const experiment: BraintrustExperiment = {
      id: store.generateId(),
      name: options.name,
      projectId: options.projectId || this.config.projectId || 'default-project',
      description: options.description,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'running',
      metadata: options.metadata,
    };

    store.saveExperiment(experiment);

    return experiment;
  }

  /**
   * Log a result to an experiment
   */
  async logResult(options: LogResultOptions): Promise<BraintrustResult> {
    this.ensureConnected();

    const experiment = store.getExperiment(options.experimentId);
    if (!experiment) {
      throw new Error(`Experiment not found: ${options.experimentId}`);
    }

    const result: BraintrustResult = {
      id: store.generateResultId(),
      experimentId: options.experimentId,
      input: options.input,
      expectedOutput: options.expectedOutput,
      actualOutput: options.actualOutput,
      scores: options.scores || {},
      metadata: options.metadata,
      timestamp: new Date().toISOString(),
    };

    store.saveResult(result);

    return result;
  }

  /**
   * Get aggregated scores for an experiment
   */
  async getScores(experimentId: string): Promise<Record<string, { mean: number; count: number }>> {
    this.ensureConnected();

    const results = store.getResults(experimentId);
    if (results.length === 0) {
      return {};
    }

    const aggregates: Record<string, { sum: number; count: number }> = {};

    for (const result of results) {
      for (const [name, value] of Object.entries(result.scores)) {
        if (!aggregates[name]) {
          aggregates[name] = { sum: 0, count: 0 };
        }
        aggregates[name].sum += value;
        aggregates[name].count += 1;
      }
    }

    const scores: Record<string, { mean: number; count: number }> = {};
    for (const [name, agg] of Object.entries(aggregates)) {
      scores[name] = {
        mean: agg.sum / agg.count,
        count: agg.count,
      };
    }

    return scores;
  }

  /**
   * List experiments with optional filtering
   */
  async listExperiments(options: ListExperimentsOptions = {}): Promise<BraintrustExperiment[]> {
    this.ensureConnected();

    return store.listExperiments(options);
  }

  /**
   * Get a specific experiment by ID
   */
  async getExperiment(id: string): Promise<BraintrustExperiment | null> {
    this.ensureConnected();

    return store.getExperiment(id) || null;
  }

  /**
   * Complete an experiment
   */
  async completeExperiment(id: string, status: 'completed' | 'failed' = 'completed'): Promise<BraintrustExperiment> {
    this.ensureConnected();

    const experiment = store.getExperiment(id);
    if (!experiment) {
      throw new Error(`Experiment not found: ${id}`);
    }

    experiment.status = status;
    experiment.updatedAt = new Date().toISOString();
    store.saveExperiment(experiment);

    return experiment;
  }

  /**
   * Delete an experiment
   */
  async deleteExperiment(id: string): Promise<boolean> {
    this.ensureConnected();

    const exists = store.getExperiment(id);
    if (!exists) {
      return false;
    }

    store['experiments'].delete(id);
    store['results'].delete(id);
    return true;
  }

  private ensureConnected(): void {
    if (!this.connected) {
      throw new Error('Braintrust client not connected. Call connect() first.');
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let globalClient: BraintrustClient | null = null;

export function getBraintrustClient(config?: BraintrustClientConfig): BraintrustClient {
  if (!globalClient && config) {
    globalClient = new BraintrustClient(config);
  }

  if (!globalClient) {
    throw new Error('Braintrust client not initialized. Provide config on first call.');
  }

  return globalClient;
}

export function resetBraintrustClient(): void {
  globalClient = null;
  store.clear();
}

export function createBraintrustClient(config: BraintrustClientConfig): BraintrustClient {
  return new BraintrustClient(config);
}
