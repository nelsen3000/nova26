// KMS-12: LangSmith API Client
// Mock implementation for LLM tracing and evaluation

// ============================================================================
// Types
// ============================================================================

export type RunType = 'llm' | 'chain' | 'tool' | 'retriever' | 'embedding' | 'prompt';

export type RunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'error';

export interface LangSmithRun {
  id: string;
  name: string;
  runType: RunType;
  inputs: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  error?: string;
  status: RunStatus;
  startTime: string;
  endTime?: string;
  parentRunId?: string;
  projectId: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
}

export interface LangSmithFeedback {
  id: string;
  runId: string;
  key: string;
  score?: number;
  value?: string;
  comment?: string;
  createdAt: string;
  userId?: string;
}

export interface CreateRunOptions {
  name: string;
  runType: RunType;
  inputs: Record<string, unknown>;
  projectId?: string;
  parentRunId?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
}

export interface UpdateRunOptions {
  runId: string;
  outputs?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface EndRunOptions {
  runId: string;
  status: 'completed' | 'failed' | 'error';
  outputs?: Record<string, unknown>;
  error?: string;
}

export interface ListRunsOptions {
  projectId?: string;
  sessionId?: string;
  status?: RunStatus;
  runType?: RunType;
  parentRunId?: string;
  limit?: number;
  offset?: number;
}

// ============================================================================
// Mock Data Store
// ============================================================================

class MockLangSmithStore {
  private runs: Map<string, LangSmithRun> = new Map();
  private feedback: Map<string, LangSmithFeedback[]> = new Map();
  private nextId = 1;

  generateRunId(): string {
    return `run-${Date.now()}-${this.nextId++}`;
  }

  generateFeedbackId(): string {
    return `fb-${Date.now()}-${this.nextId++}`;
  }

  saveRun(run: LangSmithRun): void {
    this.runs.set(run.id, run);
  }

  getRun(id: string): LangSmithRun | undefined {
    return this.runs.get(id);
  }

  listRuns(options: ListRunsOptions = {}): LangSmithRun[] {
    let runsList = Array.from(this.runs.values());

    if (options.projectId) {
      runsList = runsList.filter((r) => r.projectId === options.projectId);
    }

    if (options.sessionId) {
      runsList = runsList.filter((r) => r.sessionId === options.sessionId);
    }

    if (options.status) {
      runsList = runsList.filter((r) => r.status === options.status);
    }

    if (options.runType) {
      runsList = runsList.filter((r) => r.runType === options.runType);
    }

    if (options.parentRunId) {
      runsList = runsList.filter((r) => r.parentRunId === options.parentRunId);
    }

    // Sort by startTime desc
    runsList.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

    if (options.offset) {
      runsList = runsList.slice(options.offset);
    }

    if (options.limit) {
      runsList = runsList.slice(0, options.limit);
    }

    return runsList;
  }

  saveFeedback(feedbackItem: LangSmithFeedback): void {
    const list = this.feedback.get(feedbackItem.runId) || [];
    list.push(feedbackItem);
    this.feedback.set(feedbackItem.runId, list);
  }

  getFeedback(runId: string): LangSmithFeedback[] {
    return this.feedback.get(runId) || [];
  }

  clear(): void {
    this.runs.clear();
    this.feedback.clear();
    this.nextId = 1;
  }
}

const store = new MockLangSmithStore();

// ============================================================================
// LangSmith Client
// ============================================================================

export interface LangSmithClientConfig {
  apiKey: string;
  baseUrl?: string;
  projectId?: string;
}

export class LangSmithClient {
  private config: LangSmithClientConfig;
  private connected = false;

  constructor(config: LangSmithClientConfig) {
    this.config = {
      baseUrl: 'https://api.smith.langchain.com',
      ...config,
    };
  }

  /**
   * Connect to LangSmith API (mock)
   */
  async connect(): Promise<boolean> {
    // Simulate connection delay
    await new Promise((resolve) => setTimeout(resolve, 50));

    if (!this.config.apiKey) {
      throw new Error('LangSmith API key is required');
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
   * Create a new run/trace
   */
  async createRun(options: CreateRunOptions): Promise<LangSmithRun> {
    this.ensureConnected();

    const run: LangSmithRun = {
      id: store.generateRunId(),
      name: options.name,
      runType: options.runType,
      inputs: options.inputs,
      status: 'running',
      startTime: new Date().toISOString(),
      projectId: options.projectId || this.config.projectId || 'default-project',
      parentRunId: options.parentRunId,
      sessionId: options.sessionId,
      metadata: options.metadata,
      tags: options.tags,
    };

    store.saveRun(run);

    return run;
  }

  /**
   * Update run with outputs
   */
  async updateRun(options: UpdateRunOptions): Promise<LangSmithRun> {
    this.ensureConnected();

    const run = store.getRun(options.runId);
    if (!run) {
      throw new Error(`Run not found: ${options.runId}`);
    }

    if (options.outputs) {
      run.outputs = { ...run.outputs, ...options.outputs };
    }

    if (options.metadata) {
      run.metadata = { ...run.metadata, ...options.metadata };
    }

    store.saveRun(run);

    return run;
  }

  /**
   * Mark run as complete/failed
   */
  async endRun(options: EndRunOptions): Promise<LangSmithRun> {
    this.ensureConnected();

    const run = store.getRun(options.runId);
    if (!run) {
      throw new Error(`Run not found: ${options.runId}`);
    }

    run.status = options.status;
    run.endTime = new Date().toISOString();

    if (options.outputs) {
      run.outputs = { ...run.outputs, ...options.outputs };
    }

    if (options.error) {
      run.error = options.error;
    }

    store.saveRun(run);

    return run;
  }

  /**
   * List runs with filtering
   */
  async listRuns(options: ListRunsOptions = {}): Promise<LangSmithRun[]> {
    this.ensureConnected();

    return store.listRuns(options);
  }

  /**
   * Get a specific run by ID
   */
  async getRun(id: string): Promise<LangSmithRun | null> {
    this.ensureConnected();

    return store.getRun(id) || null;
  }

  /**
   * Get feedback for a run
   */
  async getFeedback(runId: string): Promise<LangSmithFeedback[]> {
    this.ensureConnected();

    const run = store.getRun(runId);
    if (!run) {
      throw new Error(`Run not found: ${runId}`);
    }

    return store.getFeedback(runId);
  }

  /**
   * Add feedback to a run (for testing purposes)
   */
  async addFeedback(
    runId: string,
    feedback: Omit<LangSmithFeedback, 'id' | 'runId' | 'createdAt'>
  ): Promise<LangSmithFeedback> {
    this.ensureConnected();

    const run = store.getRun(runId);
    if (!run) {
      throw new Error(`Run not found: ${runId}`);
    }

    const feedbackItem: LangSmithFeedback = {
      id: store.generateFeedbackId(),
      runId,
      key: feedback.key,
      score: feedback.score,
      value: feedback.value,
      comment: feedback.comment,
      createdAt: new Date().toISOString(),
      userId: feedback.userId,
    };

    store.saveFeedback(feedbackItem);

    return feedbackItem;
  }

  private ensureConnected(): void {
    if (!this.connected) {
      throw new Error('LangSmith client not connected. Call connect() first.');
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let globalClient: LangSmithClient | null = null;

export function getLangSmithClient(config?: LangSmithClientConfig): LangSmithClient {
  if (!globalClient && config) {
    globalClient = new LangSmithClient(config);
  }

  if (!globalClient) {
    throw new Error('LangSmith client not initialized. Provide config on first call.');
  }

  return globalClient;
}

export function resetLangSmithClient(): void {
  globalClient = null;
  store.clear();
}

export function createLangSmithClient(config: LangSmithClientConfig): LangSmithClient {
  return new LangSmithClient(config);
}
