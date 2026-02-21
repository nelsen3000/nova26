// Inference Queue — Priority queue with Taste Vault weight
// KIMI-R22-01 | Feb 2026

import type { QueuedInferenceTask, InferenceResult } from './types.js';

export interface QueueStats {
  depth: number;
  processingCount: number;
  completedCount: number;
  avgWaitMs: number;
  fairnessScore: number; // 0-1; 1 = perfectly fair
}

export type InferenceFn = (
  agentId: string,
  prompt: string,
  priority: number,
) => Promise<InferenceResult>;

export class InferenceQueue {
  private queue: QueuedInferenceTask[] = [];
  private processing = new Set<string>();
  private maxConcurrent: number;
  private completedCount = 0;
  private totalWaitMs = 0;
  private agentCallCounts = new Map<string, number>();
  private isRunning = false;
  private processFn: InferenceFn | null = null;

  constructor(maxConcurrent = 4) {
    this.maxConcurrent = maxConcurrent;
  }

  setProcessFn(fn: InferenceFn): void {
    this.processFn = fn;
  }

  enqueue(task: Omit<QueuedInferenceTask, 'id' | 'enqueuedAt'>): Promise<InferenceResult> {
    return new Promise<InferenceResult>((resolve, reject) => {
      const fullTask: QueuedInferenceTask = {
        ...task,
        id: `${task.agentId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        enqueuedAt: Date.now(),
        resolve,
        reject,
      };

      this.insertSorted(fullTask);
      this.agentCallCounts.set(task.agentId, (this.agentCallCounts.get(task.agentId) ?? 0) + 1);

      if (!this.isRunning) {
        this.drain();
      }
    });
  }

  private insertSorted(task: QueuedInferenceTask): void {
    // Priority formula: base priority + tasteVaultWeight boost - starvation penalty
    const effectivePriority = this.effectivePriority(task);
    let idx = 0;
    while (idx < this.queue.length && this.effectivePriority(this.queue[idx]!) >= effectivePriority) {
      idx++;
    }
    this.queue.splice(idx, 0, task);
  }

  private effectivePriority(task: QueuedInferenceTask): number {
    const waitMs = Date.now() - task.enqueuedAt;
    // Anti-starvation: boost priority by 1 per 100ms waited
    const starvationBoost = waitMs / 100;
    // Taste Vault weight adds up to 20 priority points
    const tasteBoost = task.tasteVaultWeight * 20;
    return task.priority + tasteBoost + starvationBoost;
  }

  private async drain(): Promise<void> {
    this.isRunning = true;
    while (this.queue.length > 0) {
      if (this.processing.size >= this.maxConcurrent) {
        await sleep(10);
        continue;
      }

      // Fair scheduling: prefer agents that have been called fewer times recently
      const task = this.pickFair();
      if (!task) {
        await sleep(10);
        continue;
      }

      this.processing.add(task.id);
      this.processTask(task);
    }
    this.isRunning = false;
  }

  private pickFair(): QueuedInferenceTask | null {
    if (!this.queue.length) return null;

    // Among the top-3 priority tasks, pick the one from the least-called agent
    const topN = this.queue.slice(0, Math.min(3, this.queue.length));
    topN.sort((a, b) => {
      const callA = this.agentCallCounts.get(a.agentId) ?? 0;
      const callB = this.agentCallCounts.get(b.agentId) ?? 0;
      return callA - callB;
    });

    const chosen = topN[0]!;
    const idx = this.queue.indexOf(chosen);
    this.queue.splice(idx, 1);
    return chosen;
  }

  private async processTask(task: QueuedInferenceTask): Promise<void> {
    const waitMs = Date.now() - task.enqueuedAt;
    this.totalWaitMs += waitMs;

    try {
      if (!this.processFn) {
        throw new Error('No inference function registered');
      }

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Task ${task.id} timed out after ${task.timeoutMs}ms`)), task.timeoutMs),
      );

      const result = await Promise.race([
        this.processFn(task.agentId, task.prompt, task.priority),
        timeoutPromise,
      ]);

      this.completedCount++;
      task.resolve(result);
    } catch (err) {
      task.reject(err instanceof Error ? err : new Error(String(err)));
    } finally {
      this.processing.delete(task.id);
    }
  }

  getStats(): QueueStats {
    const fairness = this.computeFairness();
    return {
      depth: this.queue.length,
      processingCount: this.processing.size,
      completedCount: this.completedCount,
      avgWaitMs: this.completedCount > 0 ? this.totalWaitMs / this.completedCount : 0,
      fairnessScore: fairness,
    };
  }

  private computeFairness(): number {
    if (!this.agentCallCounts.size) return 1;
    const counts = [...this.agentCallCounts.values()];
    const avg = counts.reduce((s, c) => s + c, 0) / counts.length;
    if (avg === 0) return 1;
    const variance = counts.reduce((s, c) => s + (c - avg) ** 2, 0) / counts.length;
    const stdDev = Math.sqrt(variance);
    // Coefficient of variation: lower = fairer; cap at 1
    const cv = stdDev / avg;
    return Math.max(0, 1 - cv);
  }

  getDepth(): number {
    return this.queue.length;
  }

  clear(): void {
    for (const task of this.queue) {
      task.reject(new Error('Queue cleared'));
    }
    this.queue = [];
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}
