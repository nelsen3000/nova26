// Checkpoint Manager - Persistence and recovery for harness state
// Spec: .kiro/specs/agent-harnesses/tasks.md

import { writeFile, readFile, mkdir, readdir, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import type { HarnessCheckpoint, HarnessState, CheckpointOptions, RecoveryStrategy, DeadLetterEntry } from './types.js';
import { serializeHarnessState, deserializeHarnessState } from './schemas.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Checkpoint Manager
// ═══════════════════════════════════════════════════════════════════════════════

export interface CheckpointManagerConfig {
  baseDir: string;
  defaultOptions?: Partial<CheckpointOptions>;
}

export class CheckpointManager {
  private config: CheckpointManagerConfig;
  private checkpoints: Map<string, HarnessCheckpoint> = new Map();
  private autoCheckpointIntervals: Map<string, ReturnType<typeof setInterval>> = new Map();

  constructor(config: CheckpointManagerConfig) {
    this.config = {
      defaultOptions: {
        compress: true,
        incremental: false,
        maxRetained: 10,
      },
      ...config,
    };
  }

  /**
   * Save a checkpoint
   */
  async save(
    harnessId: string,
    state: HarnessState,
    options?: Partial<CheckpointOptions>
  ): Promise<HarnessCheckpoint> {
    const opts = { ...this.config.defaultOptions, ...options };
    const checkpointId = `cp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    
    // Serialize state
    const serialized = serializeHarnessState(state);
    const stateBuffer = Buffer.from(serialized, 'utf-8');
    
    // Compress if requested (simple gzip simulation via base64 for now)
    const stateData = opts.compress 
      ? Buffer.from(serialized).toString('base64')
      : serialized;

    // Calculate hash (simple checksum)
    const hash = this.calculateHash(stateData);

    const checkpoint: HarnessCheckpoint = {
      id: checkpointId,
      harnessId,
      timestamp: Date.now(),
      state: stateData,
      hash,
      sizeBytes: stateData.length,
    };

    // Save to disk
    const harnessDir = join(this.config.baseDir, harnessId);
    await mkdir(harnessDir, { recursive: true });
    
    const checkpointPath = join(harnessDir, `${checkpointId}.json`);
    await writeFile(checkpointPath, JSON.stringify(checkpoint, null, 2));

    // Store in memory
    this.checkpoints.set(checkpointId, checkpoint);

    // Prune old checkpoints if needed
    if (opts.maxRetained) {
      await this.prune(harnessId, opts.maxRetained);
    }

    return checkpoint;
  }

  /**
   * Restore from a checkpoint
   */
  async restore(checkpointId: string): Promise<HarnessState> {
    // Try memory first
    let checkpoint = this.checkpoints.get(checkpointId);

    if (!checkpoint) {
      // Load from disk
      const files = await this.listFiles();
      const file = files.find(f => f.includes(checkpointId));
      
      if (!file) {
        throw new Error(`Checkpoint not found: ${checkpointId}`);
      }

      const data = await readFile(file, 'utf-8');
      checkpoint = JSON.parse(data) as HarnessCheckpoint;
    }

    // Verify hash
    if (this.calculateHash(checkpoint.state) !== checkpoint.hash) {
      throw new Error('Checkpoint integrity check failed');
    }

    // Decode if compressed
    const stateData = checkpoint.state.startsWith('{')
      ? checkpoint.state
      : Buffer.from(checkpoint.state, 'base64').toString('utf-8');

    // Deserialize
    return deserializeHarnessState(stateData) as HarnessState;
  }

  /**
   * List checkpoints for a harness
   */
  async list(harnessId: string): Promise<HarnessCheckpoint[]> {
    const harnessDir = join(this.config.baseDir, harnessId);
    
    if (!existsSync(harnessDir)) {
      return [];
    }

    const files = await readdir(harnessDir);
    const checkpoints: HarnessCheckpoint[] = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const data = await readFile(join(harnessDir, file), 'utf-8');
          const checkpoint = JSON.parse(data) as HarnessCheckpoint;
          checkpoints.push(checkpoint);
        } catch {
          // Skip invalid checkpoints
        }
      }
    }

    // Sort by timestamp descending
    return checkpoints.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get latest checkpoint for a harness
   */
  async getLatest(harnessId: string): Promise<HarnessCheckpoint | null> {
    const checkpoints = await this.list(harnessId);
    return checkpoints[0] ?? null;
  }

  /**
   * Prune old checkpoints
   */
  async prune(harnessId: string, maxToKeep: number): Promise<number> {
    const checkpoints = await this.list(harnessId);
    
    if (checkpoints.length <= maxToKeep) {
      return 0;
    }

    const toDelete = checkpoints.slice(maxToKeep);
    const harnessDir = join(this.config.baseDir, harnessId);

    for (const checkpoint of toDelete) {
      try {
        const filePath = join(harnessDir, `${checkpoint.id}.json`);
        await unlink(filePath);
        this.checkpoints.delete(checkpoint.id);
      } catch {
        // Ignore errors
      }
    }

    return toDelete.length;
  }

  /**
   * Start auto-checkpointing
   */
  startAutoCheckpoint(
    harnessId: string,
    getState: () => HarnessState,
    intervalMs: number
  ): void {
    this.stopAutoCheckpoint(harnessId);

    const interval = setInterval(async () => {
      try {
        const state = getState();
        await this.save(harnessId, state);
      } catch {
        // Ignore auto-checkpoint errors
      }
    }, intervalMs);

    this.autoCheckpointIntervals.set(harnessId, interval);
  }

  /**
   * Stop auto-checkpointing
   */
  stopAutoCheckpoint(harnessId: string): void {
    const interval = this.autoCheckpointIntervals.get(harnessId);
    if (interval) {
      clearInterval(interval);
      this.autoCheckpointIntervals.delete(harnessId);
    }
  }

  /**
   * Delete all checkpoints for a harness
   */
  async deleteAll(harnessId: string): Promise<void> {
    this.stopAutoCheckpoint(harnessId);
    
    const harnessDir = join(this.config.baseDir, harnessId);
    if (!existsSync(harnessDir)) {
      return;
    }

    const files = await readdir(harnessDir);
    for (const file of files) {
      if (file.endsWith('.json')) {
        const checkpointId = file.replace('.json', '');
        this.checkpoints.delete(checkpointId);
        await unlink(join(harnessDir, file));
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Private Helpers
  // ═══════════════════════════════════════════════════════════════════════════

  private calculateHash(data: string): string {
    // Simple hash for integrity checking
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(16);
  }

  private async listFiles(): Promise<string[]> {
    const files: string[] = [];
    
    if (!existsSync(this.config.baseDir)) {
      return files;
    }

    try {
      const harnessDirs = await readdir(this.config.baseDir);
      for (const dir of harnessDirs) {
        const harnessDir = join(this.config.baseDir, dir);
        const dirFiles = await readdir(harnessDir);
        for (const file of dirFiles) {
          if (file.endsWith('.json')) {
            files.push(join(harnessDir, file));
          }
        }
      }
    } catch {
      // Ignore errors
    }

    return files;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Recovery Manager
// ═══════════════════════════════════════════════════════════════════════════════

export interface RecoveryManagerConfig {
  checkpointManager: CheckpointManager;
  defaultStrategy?: RecoveryStrategy;
}

export class RecoveryManager {
  private config: RecoveryManagerConfig;
  private deadLetterQueue: Map<string, DeadLetterEntry> = new Map();
  private retryAttempts: Map<string, number> = new Map();

  constructor(config: RecoveryManagerConfig) {
    this.config = {
      defaultStrategy: {
        type: 'retry',
        maxAttempts: 3,
        backoffMs: 1000,
        exponentialBackoff: true,
      },
      ...config,
    };
  }

  /**
   * Attempt recovery for a failed harness
   */
  async attemptRecovery(
    harnessId: string,
    failureReason: string,
    strategy?: RecoveryStrategy
  ): Promise<{ success: boolean; state?: HarnessState; deadLetter?: boolean }> {
    const strat = strategy ?? this.config.defaultStrategy!;
    const attemptKey = `${harnessId}`;
    
    const attempts = (this.retryAttempts.get(attemptKey) ?? 0) + 1;
    this.retryAttempts.set(attemptKey, attempts);

    // Check max attempts
    if (attempts > strat.maxAttempts) {
      // Move to dead letter queue
      await this.moveToDeadLetter(harnessId, failureReason, attempts);
      return { success: false, deadLetter: true };
    }

    // Calculate backoff delay
    const delayMs = strat.exponentialBackoff
      ? strat.backoffMs * Math.pow(2, attempts - 1)
      : strat.backoffMs;

    await this.sleep(delayMs);

    try {
      switch (strat.type) {
        case 'retry':
          return await this.retryFromCheckpoint(harnessId);

        case 'checkpoint':
          return await this.restoreFromLastCheckpoint(harnessId);

        case 'degrade':
          return await this.degradeAndRetry(harnessId);

        case 'escalate':
          return { success: false }; // Requires human intervention

        default:
          return { success: false };
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) } as any;
    }
  }

  /**
   * Get retry count for a harness
   */
  getRetryCount(harnessId: string): number {
    return this.retryAttempts.get(harnessId) ?? 0;
  }

  /**
   * Reset retry count for a harness
   */
  resetRetryCount(harnessId: string): void {
    this.retryAttempts.delete(harnessId);
  }

  /**
   * Get dead letter entry
   */
  getDeadLetter(harnessId: string): DeadLetterEntry | undefined {
    return this.deadLetterQueue.get(harnessId);
  }

  /**
   * List all dead letter entries
   */
  listDeadLetters(): DeadLetterEntry[] {
    return Array.from(this.deadLetterQueue.values());
  }

  /**
   * Retry a dead letter entry
   */
  async retryDeadLetter(harnessId: string): Promise<boolean> {
    const entry = this.deadLetterQueue.get(harnessId);
    if (!entry) {
      return false;
    }

    this.deadLetterQueue.delete(harnessId);
    this.retryAttempts.delete(harnessId);

    return true;
  }

  /**
   * Delete dead letter entry
   */
  deleteDeadLetter(harnessId: string): boolean {
    return this.deadLetterQueue.delete(harnessId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Private Helpers
  // ═══════════════════════════════════════════════════════════════════════════

  private async retryFromCheckpoint(
    harnessId: string
  ): Promise<{ success: boolean; state?: HarnessState }> {
    const checkpoint = await this.config.checkpointManager.getLatest(harnessId);
    
    if (!checkpoint) {
      return { success: false };
    }

    const state = await this.config.checkpointManager.restore(checkpoint.id);
    return { success: true, state };
  }

  private async restoreFromLastCheckpoint(
    harnessId: string
  ): Promise<{ success: boolean; state?: HarnessState }> {
    return this.retryFromCheckpoint(harnessId);
  }

  private async degradeAndRetry(
    harnessId: string
  ): Promise<{ success: boolean; state?: HarnessState }> {
    const result = await this.retryFromCheckpoint(harnessId);
    
    if (result.success && result.state) {
      // Reduce autonomy level as degradation
      if (result.state.config.autonomyLevel > 1) {
        result.state.config.autonomyLevel--;
      }
    }

    return result;
  }

  private async moveToDeadLetter(
    harnessId: string,
    failureReason: string,
    attempts: number
  ): Promise<void> {
    const checkpoint = await this.config.checkpointManager.getLatest(harnessId);
    
    if (checkpoint) {
      const state = await this.config.checkpointManager.restore(checkpoint.id);
      const entry: DeadLetterEntry = {
        id: `dl-${harnessId}-${Date.now()}`,
        state,
        failureReason,
        attempts,
        firstFailureAt: Date.now() - (attempts * 1000), // Estimate
        lastFailureAt: Date.now(),
      };
      
      this.deadLetterQueue.set(harnessId, entry);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Factory Functions
// ═══════════════════════════════════════════════════════════════════════════════

let globalCheckpointManager: CheckpointManager | null = null;
let globalRecoveryManager: RecoveryManager | null = null;

export function getCheckpointManager(config?: CheckpointManagerConfig): CheckpointManager {
  if (!globalCheckpointManager) {
    globalCheckpointManager = new CheckpointManager(config ?? { baseDir: './checkpoints' });
  }
  return globalCheckpointManager;
}

export function getRecoveryManager(config?: RecoveryManagerConfig): RecoveryManager {
  if (!globalRecoveryManager) {
    globalRecoveryManager = new RecoveryManager(config ?? { 
      checkpointManager: getCheckpointManager() 
    });
  }
  return globalRecoveryManager;
}

export function resetCheckpointManager(): void {
  globalCheckpointManager = null;
}

export function resetRecoveryManager(): void {
  globalRecoveryManager = null;
}
