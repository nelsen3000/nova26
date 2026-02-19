// L3 Tool Layer — R20-01
// Sandboxed tool execution, backoff retry

import type {
  ToolRequest,
  ToolResult,
  SandboxedExecution,
} from '../hierarchy-types.js';

export interface L3Config {
  sandboxEnabled: boolean;
  maxBackoffRetries: number;
  initialBackoffMs: number;
  maxBackoffMs: number;
  sandboxTimeoutMs: number;
  allowedTools: string[];
  blockedTools: string[];
}

export const DEFAULT_L3_CONFIG: L3Config = {
  sandboxEnabled: true,
  maxBackoffRetries: 5,
  initialBackoffMs: 1000,
  maxBackoffMs: 30000,
  sandboxTimeoutMs: 30000,
  allowedTools: ['read_file', 'write_file', 'search', 'execute_command'],
  blockedTools: ['delete_file', 'system_call', 'network_request'],
};

export interface ToolExecutor {
  execute(request: ToolRequest): Promise<ToolResult>;
}

export class L3ToolLayer {
  private config: L3Config;
  private executor: ToolExecutor;
  private executions: Map<string, SandboxedExecution> = new Map();

  constructor(executor: ToolExecutor, config: Partial<L3Config> = {}) {
    this.executor = executor;
    this.config = { ...DEFAULT_L3_CONFIG, ...config };
  }

  /**
   * Execute a tool request with sandboxing and backoff retry
   */
  async execute(request: ToolRequest): Promise<ToolResult> {
    // Validate tool is allowed
    if (!this.isToolAllowed(request.toolName)) {
      return {
        success: false,
        output: ``,
        exitCode: 403,
        executionTimeMs: 0,
        resourceUsage: { memoryMb: 0, cpuMs: 0 },
      };
    }

    const executionId = this.generateExecutionId();
    const execution: SandboxedExecution = {
      id: executionId,
      request,
      status: 'pending',
      retryCount: 0,
    };

    this.executions.set(executionId, execution);

    try {
      const result = await this.executeWithBackoff(execution);
      return result;
    } finally {
      // Cleanup
      this.executions.delete(executionId);
    }
  }

  /**
   * Execute multiple tools in sequence
   */
  async executeSequence(requests: ToolRequest[]): Promise<ToolResult[]> {
    const results: ToolResult[] = [];
    
    for (const request of requests) {
      const result = await this.execute(request);
      results.push(result);
      
      // Stop on failure unless configured to continue
      if (!result.success) {
        break;
      }
    }

    return results;
  }

  /**
   * Check if a tool is allowed to execute
   */
  isToolAllowed(toolName: string): boolean {
    // Check blocked list first
    if (this.config.blockedTools.includes(toolName)) {
      return false;
    }

    // If allowed list is empty, allow all non-blocked
    if (this.config.allowedTools.length === 0) {
      return true;
    }

    return this.config.allowedTools.includes(toolName);
  }

  /**
   * Validate tool request before execution
   */
  validateRequest(request: ToolRequest): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!request.toolName) {
      errors.push('Tool name is required');
    }

    if (!this.isToolAllowed(request.toolName)) {
      errors.push(`Tool '${request.toolName}' is not allowed`);
    }

    if (request.timeoutMs && request.timeoutMs <= 0) {
      errors.push('Timeout must be positive');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get execution status
   */
  getExecution(executionId: string): SandboxedExecution | undefined {
    return this.executions.get(executionId);
  }

  /**
   * Get all active executions
   */
  getActiveExecutions(): SandboxedExecution[] {
    return Array.from(this.executions.values()).filter(
      e => e.status === 'running' || e.status === 'pending'
    );
  }

  /**
   * Abort an execution
   */
  async abortExecution(executionId: string): Promise<boolean> {
    const execution = this.executions.get(executionId);
    if (!execution) return false;

    execution.status = 'failed';
    return true;
  }

  /**
   * Calculate backoff delay with exponential backoff and jitter
   */
  calculateBackoff(attempt: number): number {
    const exponentialDelay = this.config.initialBackoffMs * Math.pow(2, attempt);
    const cappedDelay = Math.min(exponentialDelay, this.config.maxBackoffMs);
    const jitter = Math.random() * 0.3 * cappedDelay; // 30% jitter
    return Math.floor(cappedDelay + jitter);
  }

  private async executeWithBackoff(
    execution: SandboxedExecution
  ): Promise<ToolResult> {
    let lastResult: ToolResult | null = null;

    for (let attempt = 0; attempt <= this.config.maxBackoffRetries; attempt++) {
      execution.status = 'running';
      execution.retryCount = attempt;

      try {
        const result = await this.runSandboxed(execution.request);
        
        if (result.success) {
          execution.status = 'completed';
          execution.result = result;
          return result;
        }

        // Check if retryable
        if (!this.isRetryableError(result) || attempt >= this.config.maxBackoffRetries) {
          execution.status = 'failed';
          return result;
        }

        lastResult = result;
        
        // Backoff before retry
        const delayMs = this.calculateBackoff(attempt);
        await this.delay(delayMs);
      } catch (error) {
        if (attempt >= this.config.maxBackoffRetries) {
          execution.status = 'failed';
          return {
            success: false,
            output: '',
            exitCode: 500,
            executionTimeMs: 0,
            resourceUsage: { memoryMb: 0, cpuMs: 0 },
          };
        }

        // Retry on exception
        const delayMs = this.calculateBackoff(attempt);
        await this.delay(delayMs);
      }
    }

    execution.status = 'failed';
    return lastResult ?? {
      success: false,
      output: '',
      exitCode: 500,
      executionTimeMs: 0,
      resourceUsage: { memoryMb: 0, cpuMs: 0 },
    };
  }

  private async runSandboxed(request: ToolRequest): Promise<ToolResult> {
    const timeoutMs = request.timeoutMs ?? this.config.sandboxTimeoutMs;

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Tool execution timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.executor
        .execute(request)
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  private isRetryableError(result: ToolResult): boolean {
    // Retry on timeout, rate limit, or transient errors
    if (result.exitCode === 408 || result.exitCode === 429) return true;
    if (result.exitCode && result.exitCode >= 500 && result.exitCode < 600) return true;
    return false;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private generateExecutionId(): string {
    return `exec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }
}

// Mock tool executor for testing
export class MockToolExecutor implements ToolExecutor {
  private shouldFail: Set<string> = new Set();
  private failCount: Map<string, number> = new Map();
  private delayMs: number = 0;

  setShouldFail(toolName: string, failCount: number = 1): void {
    this.shouldFail.add(toolName);
    this.failCount.set(toolName, failCount);
  }

  setDelay(ms: number): void {
    this.delayMs = ms;
  }

  async execute(request: ToolRequest): Promise<ToolResult> {
    if (this.delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, this.delayMs));
    }

    if (this.shouldFail.has(request.toolName)) {
      const remainingFailures = this.failCount.get(request.toolName) ?? 0;
      
      if (remainingFailures > 0) {
        this.failCount.set(request.toolName, remainingFailures - 1);
        return {
          success: false,
          output: `Tool ${request.toolName} failed`,
          exitCode: 500,
          executionTimeMs: this.delayMs,
          resourceUsage: { memoryMb: 10, cpuMs: 100 },
        };
      }
    }

    return {
      success: true,
      output: `Tool ${request.toolName} executed successfully`,
      executionTimeMs: this.delayMs,
      resourceUsage: { memoryMb: 10, cpuMs: 100 },
    };
  }
}

export function createL3ToolLayer(
  executor: ToolExecutor,
  config?: Partial<L3Config>
): L3ToolLayer {
  return new L3ToolLayer(executor, config);
}
