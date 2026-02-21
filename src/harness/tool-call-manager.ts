// Tool Call Manager - K3-28
// Permission checking, retry with exponential backoff, timeout, budget enforcement
// Spec: .kiro/specs/agent-harnesses/tasks.md

import type { HarnessConfig, ToolCallRecord, ToolPermission } from './types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════════════════

export interface ToolCallManagerConfig {
  maxRetries: number;
  baseBackoffMs: number;
  maxBackoffMs: number;
  timeoutMs: number;
  permissions: ToolPermission[];
}

export const DEFAULT_TOOL_CONFIG: ToolCallManagerConfig = {
  maxRetries: 3,
  baseBackoffMs: 500,
  maxBackoffMs: 10000,
  timeoutMs: 30000,
  permissions: [],
};

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════================================================================

export interface ToolCallOptions {
  toolName: string;
  args: Record<string, unknown>;
  timeoutMs?: number;
  skipRetry?: boolean;
}

export interface ToolCallResult<T = unknown> {
  success: boolean;
  result?: T;
  error?: string;
  durationMs: number;
  retryCount: number;
  cost: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tool Call Manager
// ═══════════════════════════════════════════════════════════════════════════════

export class ToolCallManager {
  private config: ToolCallManagerConfig;
  private harnessConfig: HarnessConfig;
  private callHistory: ToolCallRecord[] = [];
  private totalCallCount = 0;
  private totalCost = 0;

  constructor(harnessConfig: HarnessConfig, config?: Partial<ToolCallManagerConfig>) {
    this.harnessConfig = harnessConfig;
    this.config = {
      ...DEFAULT_TOOL_CONFIG,
      ...config,
      // Use harness allowed tools to build default permissions
      permissions: config?.permissions ?? harnessConfig.allowedTools.map(name => ({
        toolName: name,
        allowed: true,
        requiresApproval: false,
      })),
    };
  }

  /**
   * Check if a tool is permitted.
   */
  isPermitted(toolName: string): boolean {
    const perm = this.config.permissions.find(p => p.toolName === toolName);
    if (perm) return perm.allowed;

    // If not in permissions list, check allowedTools
    return this.harnessConfig.allowedTools.includes(toolName);
  }

  /**
   * Check if a tool requires human approval.
   */
  requiresApproval(toolName: string): boolean {
    const perm = this.config.permissions.find(p => p.toolName === toolName);
    return perm?.requiresApproval ?? false;
  }

  /**
   * Execute a tool call with retry, backoff, timeout, and budget enforcement.
   * The actual tool execution is provided via the `executor` callback.
   */
  async executeToolCall<T>(
    options: ToolCallOptions,
    executor: () => Promise<T>
  ): Promise<ToolCallResult<T>> {
    const startTime = Date.now();
    let lastError: string | undefined;
    let retryCount = 0;

    // Permission check
    if (!this.isPermitted(options.toolName)) {
      return {
        success: false,
        error: `Tool "${options.toolName}" is not permitted`,
        durationMs: 0,
        retryCount: 0,
        cost: 0,
      };
    }

    // Budget check
    if (this.totalCallCount >= this.harnessConfig.budget.maxToolCalls) {
      return {
        success: false,
        error: 'Tool call budget exceeded',
        durationMs: 0,
        retryCount: 0,
        cost: 0,
      };
    }

    const maxAttempts = options.skipRetry ? 1 : this.config.maxRetries + 1;
    const timeoutMs = options.timeoutMs ?? this.config.timeoutMs;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (attempt > 0) {
        // Exponential backoff with jitter
        const backoff = Math.min(
          this.config.baseBackoffMs * Math.pow(2, attempt - 1) + Math.random() * 100,
          this.config.maxBackoffMs
        );
        await this.sleep(backoff);
        retryCount++;
      }

      try {
        let result: T;

        // Timeout wrapper
        if (timeoutMs > 0) {
          result = await this.withTimeout(executor(), timeoutMs);
        } else {
          result = await executor();
        }

        const durationMs = Date.now() - startTime;
        const cost = this.estimateCost(options.toolName, durationMs);

        this.recordCall({
          toolName: options.toolName,
          args: options.args,
          result,
          durationMs,
          retryCount,
          cost,
          success: true,
        });

        return { success: true, result, durationMs, retryCount, cost };
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
      }
    }

    // All attempts failed
    const durationMs = Date.now() - startTime;
    this.recordCall({
      toolName: options.toolName,
      args: options.args,
      error: lastError,
      durationMs,
      retryCount,
      cost: 0,
      success: false,
    });

    return { success: false, error: lastError, durationMs, retryCount, cost: 0 };
  }

  /**
   * Get all tool call records.
   */
  getHistory(): ToolCallRecord[] {
    return [...this.callHistory];
  }

  /**
   * Get total calls made.
   */
  getTotalCalls(): number {
    return this.totalCallCount;
  }

  /**
   * Get total cost.
   */
  getTotalCost(): number {
    return this.totalCost;
  }

  /**
   * Get remaining budget.
   */
  getRemainingBudget(): { toolCalls: number; tokens: number; cost: number } {
    return {
      toolCalls: Math.max(0, this.harnessConfig.budget.maxToolCalls - this.totalCallCount),
      tokens: this.harnessConfig.budget.maxTokens,
      cost: Math.max(0, this.harnessConfig.budget.maxCost - this.totalCost),
    };
  }

  /**
   * Set or update a tool permission.
   */
  setPermission(permission: ToolPermission): void {
    const idx = this.config.permissions.findIndex(p => p.toolName === permission.toolName);
    if (idx >= 0) {
      this.config.permissions[idx] = permission;
    } else {
      this.config.permissions.push(permission);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Private Helpers
  // ═══════════════════════════════════════════════════════════════════════════

  private recordCall(call: {
    toolName: string;
    args: Record<string, unknown>;
    result?: unknown;
    error?: string;
    durationMs: number;
    retryCount: number;
    cost: number;
    success: boolean;
  }): void {
    const record: ToolCallRecord = {
      id: `tool-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      ...call,
    };
    this.callHistory.push(record);
    this.totalCallCount++;
    this.totalCost += call.cost;
  }

  private estimateCost(toolName: string, _durationMs: number): number {
    // Simple heuristic: 0.001 per call
    return 0.001;
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Tool call timed out after ${timeoutMs}ms`)), timeoutMs)
      ),
    ]);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Factory Function
// ═══════════════════════════════════════════════════════════════════════════════

export function createToolCallManager(
  harnessConfig: HarnessConfig,
  config?: Partial<ToolCallManagerConfig>
): ToolCallManager {
  return new ToolCallManager(harnessConfig, config);
}
