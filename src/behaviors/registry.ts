// Behavior Registry - Registration and Management
// KIMI-W-03: Behavior system registry

import type {
  Behavior,
  BehaviorConfig,
  BehaviorContext,
  BehaviorResult,
  BehaviorChain,
} from './types.js';

/**
 * Error thrown when a behavior is not found
 */
export class BehaviorNotFoundError extends Error {
  constructor(name: string) {
    super(`Behavior "${name}" not found in registry`);
    this.name = 'BehaviorNotFoundError';
  }
}

/**
 * Error thrown when behavior execution fails
 */
export class BehaviorExecutionError extends Error {
  constructor(
    public readonly behaviorName: string,
    public readonly cause: Error
  ) {
    super(`Behavior "${behaviorName}" execution failed: ${cause.message}`);
    this.name = 'BehaviorExecutionError';
  }
}

/**
 * Central registry for behaviors
 */
export class BehaviorRegistry {
  private behaviors: Map<string, Behavior> = new Map();
  private defaultBehaviors: string[] = [];

  /**
   * Register a behavior
   * @param behavior - The behavior to register
   * @param isDefault - Whether this should be applied by default
   */
  register<TConfig extends BehaviorConfig>(behavior: Behavior<TConfig>, isDefault = false): void {
    this.behaviors.set(behavior.name, behavior as Behavior);
    
    if (isDefault && !this.defaultBehaviors.includes(behavior.name)) {
      this.defaultBehaviors.push(behavior.name);
    }
  }

  /**
   * Unregister a behavior
   * @param name - Behavior name to unregister
   * @returns True if unregistered, false if not found
   */
  unregister(name: string): boolean {
    const existed = this.behaviors.delete(name);
    const index = this.defaultBehaviors.indexOf(name);
    if (index >= 0) {
      this.defaultBehaviors.splice(index, 1);
    }
    return existed;
  }

  /**
   * Get a registered behavior
   * @param name - Behavior name
   * @returns The behavior instance
   * @throws BehaviorNotFoundError if not found
   */
  get(name: string): Behavior {
    const behavior = this.behaviors.get(name);
    if (!behavior) {
      throw new BehaviorNotFoundError(name);
    }
    return behavior;
  }

  /**
   * Check if a behavior is registered
   * @param name - Behavior name
   * @returns True if registered
   */
  has(name: string): boolean {
    return this.behaviors.has(name);
  }

  /**
   * Get all registered behavior names
   * @returns Array of behavior names
   */
  getRegisteredNames(): string[] {
    return Array.from(this.behaviors.keys());
  }

  /**
   * Get all default behavior names
   * @returns Array of default behavior names
   */
  getDefaultNames(): string[] {
    return [...this.defaultBehaviors];
  }

  /**
   * Execute an operation with a specific behavior
   * @param behaviorName - Name of behavior to use
   * @param operation - Operation to wrap
   * @param context - Optional context override
   * @returns Behavior result
   */
  async executeWith<T>(
    behaviorName: string,
    operation: (ctx: BehaviorContext) => Promise<T>,
    context?: Partial<BehaviorContext>
  ): Promise<BehaviorResult<T>> {
    const behavior = this.get(behaviorName);
    const fullContext = this.createContext(context);
    
    try {
      return await behavior.execute(operation, fullContext) as BehaviorResult<T>;
    } catch (error) {
      if (error instanceof Error) {
        throw new BehaviorExecutionError(behaviorName, error);
      }
      throw error;
    }
  }

  /**
   * Execute with multiple behaviors in sequence
   * @param behaviorNames - Names of behaviors to chain
   * @param operation - Operation to wrap
   * @param context - Optional context
   * @returns Final behavior result
   */
  async executeChain<T>(
    behaviorNames: string[],
    operation: (ctx: BehaviorContext) => Promise<T>,
    context?: Partial<BehaviorContext>
  ): Promise<BehaviorResult<T>> {
    if (behaviorNames.length === 0) {
      // No behaviors, just execute operation
      const startTime = Date.now();
      const fullContext = this.createContext(context);
      try {
        const data = await operation(fullContext);
        return {
          success: true,
          data,
          durationMs: Date.now() - startTime,
          attempts: 1,
          metadata: {},
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
          durationMs: Date.now() - startTime,
          attempts: 1,
          metadata: {},
        };
      }
    }

    // Build chain from last to first
    let currentOp = operation;
    const behaviors = behaviorNames.map(name => this.get(name)).reverse();

    for (const behavior of behaviors) {
      const wrappedOp = currentOp;
      currentOp = async (ctx: BehaviorContext) => {
        const result = await behavior.execute(wrappedOp, ctx);
        if (!result.success) {
          throw result.error ?? new Error('Behavior execution failed');
        }
        return result.data as T;
      };
    }

    const startTime = Date.now();
    const fullContext = this.createContext(context);
    
    try {
      const data = await currentOp(fullContext);
      return {
        success: true,
        data,
        durationMs: Date.now() - startTime,
        attempts: 1,
        metadata: { chain: behaviorNames },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        durationMs: Date.now() - startTime,
        attempts: 1,
        metadata: { chain: behaviorNames },
      };
    }
  }

  /**
   * Execute with all default behaviors
   * @param operation - Operation to wrap
   * @param context - Optional context
   * @returns Behavior result
   */
  async executeWithDefaults<T>(
    operation: (ctx: BehaviorContext) => Promise<T>,
    context?: Partial<BehaviorContext>
  ): Promise<BehaviorResult<T>> {
    return this.executeChain(this.defaultBehaviors, operation, context);
  }

  /**
   * Reset all registered behaviors
   */
  resetAll(): void {
    for (const behavior of this.behaviors.values()) {
      behavior.reset();
    }
  }

  /**
   * Clear all registrations
   */
  clear(): void {
    this.behaviors.clear();
    this.defaultBehaviors = [];
  }

  /**
   * Get count of registered behaviors
   */
  get count(): number {
    return this.behaviors.size;
  }

  /**
   * Create a behavior chain
   * @param behaviorNames - Names to include in chain
   * @returns BehaviorChain instance
   */
  createChain(behaviorNames: string[]): BehaviorChain {
    const behaviors = behaviorNames.map(name => this.get(name));
    
    return {
      behaviors,
      execute: async <T>(
        operation: (ctx: BehaviorContext) => Promise<T>,
        context?: Partial<BehaviorContext>
      ): Promise<BehaviorResult<T>> => {
        return this.executeChain(behaviorNames, operation, context);
      },
    };
  }

  /**
   * Create full context from partial
   */
  private createContext(partial?: Partial<BehaviorContext>): BehaviorContext {
    return {
      executionId: partial?.executionId ?? crypto.randomUUID(),
      agentName: partial?.agentName ?? 'unknown',
      taskId: partial?.taskId,
      attempt: partial?.attempt ?? 1,
      startedAt: partial?.startedAt ?? new Date().toISOString(),
      metadata: partial?.metadata ?? {},
    };
  }
}

// Global registry instance
let globalRegistry: BehaviorRegistry | null = null;

/**
 * Get the global behavior registry
 */
export function getGlobalBehaviorRegistry(): BehaviorRegistry {
  if (!globalRegistry) {
    globalRegistry = new BehaviorRegistry();
  }
  return globalRegistry;
}

/**
 * Reset the global registry
 */
export function resetGlobalBehaviorRegistry(): void {
  globalRegistry = null;
}
