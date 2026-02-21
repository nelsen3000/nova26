// ConvexBridge — links the ralph-loop engine (local) to Convex (cloud persistence).
// Uses ConvexHttpClient from convex/browser for type-safe HTTP mutations.

import { ConvexHttpClient } from 'convex/browser';
import { z } from 'zod';
import { BridgeError, ConnectionError, ValidationError, toError } from './error-types.js';

// ============================================================================
// Input Schemas (Zod validation at system boundary)
// ============================================================================

export const BuildResultSchema = z.object({
  prdId: z.string().min(1),
  prdName: z.string().min(1),
  status: z.enum(['running', 'completed', 'failed']),
  startedAt: z.string(),
  completedAt: z.string().optional(),
  error: z.string().optional(),
});

export const TaskResultSchema = z.object({
  buildId: z.string().min(1),
  taskId: z.string().min(1),
  title: z.string().min(1),
  agent: z.string().min(1),
  status: z.enum(['pending', 'ready', 'running', 'done', 'failed', 'blocked']),
  dependencies: z.array(z.string()).default([]),
  phase: z.number().int().min(0),
  attempts: z.number().int().min(0),
  createdAt: z.string(),
  output: z.string().optional(),
  error: z.string().optional(),
});

export const ExecutionLogSchema = z.object({
  taskId: z.string().min(1),
  agent: z.string().min(1),
  model: z.string().min(1),
  prompt: z.string(),
  response: z.string(),
  gatesPassed: z.boolean(),
  duration: z.number().min(0),
  timestamp: z.string(),
  error: z.string().optional(),
});

export const ActivityEventSchema = z.object({
  type: z.enum([
    'build_started',
    'build_completed',
    'build_failed',
    'task_started',
    'task_completed',
    'task_failed',
    'agent_status_changed',
  ]),
  buildId: z.string().optional(),
  taskId: z.string().optional(),
  agentId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  timestamp: z.string(),
});

export const AgentStatusSchema = z.object({
  agentId: z.string().min(1),
  status: z.enum(['active', 'idle', 'suspended']),
  currentTaskId: z.string().optional(),
  idleMinutes: z.number().min(0).optional(),
});

// ============================================================================
// Types
// ============================================================================

export type BuildResult = z.infer<typeof BuildResultSchema>;
export type TaskResult = z.infer<typeof TaskResultSchema>;
export type ExecutionLog = z.infer<typeof ExecutionLogSchema>;
export type ActivityEvent = z.infer<typeof ActivityEventSchema>;
export type AgentStatus = z.infer<typeof AgentStatusSchema>;

export interface ConvexBridgeOptions {
  url: string;
  /** Number of times to retry a failed write before giving up. Default: 1 */
  maxRetries?: number;
  /** Delay between retries in ms. Default: 1000 */
  retryDelayMs?: number;
  /** If true, failed writes are queued in memory for later retry. Default: false */
  enableQueue?: boolean;
}

interface QueuedWrite {
  mutation: string;
  args: Record<string, unknown>;
  attempts: number;
}

// ============================================================================
// ConvexBridge Class
// ============================================================================

export class ConvexBridge {
  private client: ConvexHttpClient;
  private readonly url: string;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;
  private readonly enableQueue: boolean;
  private writeQueue: QueuedWrite[] = [];
  private isFlushingQueue = false;

  constructor(options: ConvexBridgeOptions) {
    const { url, maxRetries = 1, retryDelayMs = 1000, enableQueue = false } = options;

    if (!url) {
      throw new ConnectionError('Convex URL is required', url);
    }

    this.url = url;
    this.maxRetries = maxRetries;
    this.retryDelayMs = retryDelayMs;
    this.enableQueue = enableQueue;
    this.client = new ConvexHttpClient(url);
  }

  // --------------------------------------------------------------------------
  // Public API
  // --------------------------------------------------------------------------

  /** Log a build start/update to Convex. */
  async logBuild(build: BuildResult): Promise<void> {
    const validated = this.validate(BuildResultSchema, build, 'logBuild');
    await this.callMutation('dashboard:createBuild', validated);
  }

  /** Log a task status update to Convex. */
  async logTask(task: TaskResult): Promise<void> {
    const validated = this.validate(TaskResultSchema, task, 'logTask');
    await this.callMutation('dashboard:createTask', validated);
  }

  /** Log a single LLM execution record. */
  async logExecution(exec: ExecutionLog): Promise<void> {
    const validated = this.validate(ExecutionLogSchema, exec, 'logExecution');
    await this.callMutation('dashboard:logExecution', validated);
  }

  /** Fire an activity event (build started, task failed, etc.). */
  async logActivity(event: ActivityEvent): Promise<void> {
    const validated = this.validate(ActivityEventSchema, event, 'logActivity');
    await this.callMutation('realtime:logActivity', validated);
  }

  /** Sync an agent's current status to Convex. */
  async syncAgentStatus(agentId: string, status: AgentStatus): Promise<void> {
    const validated = this.validate(AgentStatusSchema, { ...status, agentId }, 'syncAgentStatus');
    await this.callMutation('dashboard:updateAgentStatus', validated);
  }

  /** Batch multiple mutations concurrently (independent writes). */
  async batchWrite(writes: Array<{ mutation: string; args: Record<string, unknown> }>): Promise<void> {
    await Promise.all(
      writes.map(({ mutation, args }) => this.callMutation(mutation, args))
    );
  }

  /** Flush the in-memory write queue (call on reconnect). */
  async flushQueue(): Promise<void> {
    if (this.isFlushingQueue || this.writeQueue.length === 0) return;
    this.isFlushingQueue = true;

    const pending = [...this.writeQueue];
    this.writeQueue = [];

    await Promise.allSettled(
      pending.map(({ mutation, args }) => this.callMutation(mutation, args))
    );

    this.isFlushingQueue = false;
  }

  get queueLength(): number {
    return this.writeQueue.length;
  }

  // --------------------------------------------------------------------------
  // Private helpers
  // --------------------------------------------------------------------------

  private validate<T>(schema: z.ZodType<T>, data: unknown, context: string): T {
    const result = schema.safeParse(data);
    if (!result.success) {
      const message = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
      throw new ValidationError(`[ConvexBridge:${context}] Validation failed: ${message}`);
    }
    return result.data;
  }

  private async callMutation(
    mutation: string,
    args: Record<string, unknown>,
    attempt = 1
  ): Promise<unknown> {
    try {
      // ConvexHttpClient.mutation() requires an api reference; we use a raw fetch
      // because the _generated API may not exist yet.
      const response = await fetch(`${this.url}/api/mutation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: mutation, args }),
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new BridgeError(
          `HTTP ${response.status}: ${body}`,
          mutation,
          attempt
        );
      }

      return response.json();
    } catch (error) {
      // Retry once on network failures
      if (attempt <= this.maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, this.retryDelayMs));
        return this.callMutation(mutation, args, attempt + 1);
      }

      // After all retries: queue if enabled, otherwise log and give up
      const err = toError(error);
      if (this.enableQueue) {
        this.writeQueue.push({ mutation, args, attempts: attempt });
      } else {
        // Never block the build — just log
        console.error(`[ConvexBridge] Failed after ${attempt} attempts: ${err.message}`);
      }
      return null;
    }
  }
}

// ============================================================================
// Factory — create bridge from env or return no-op
// ============================================================================

let _bridge: ConvexBridge | null = null;

export function getConvexBridge(options?: Partial<ConvexBridgeOptions>): ConvexBridge | null {
  const url = options?.url ?? process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL;

  if (!url) {
    return null;
  }

  if (!_bridge) {
    _bridge = new ConvexBridge({
      url,
      maxRetries: options?.maxRetries ?? 1,
      retryDelayMs: options?.retryDelayMs ?? 1000,
      enableQueue: options?.enableQueue ?? false,
    });
  }

  return _bridge;
}

/** Reset the singleton (for testing). */
export function resetConvexBridge(): void {
  _bridge = null;
}
