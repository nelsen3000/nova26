// MX-12: Lazy Module Initialization
// Wraps lifecycle adapter handlers with lazy initialization.
// Modules don't initialize until their first lifecycle hook fires, reducing startup time.

import type { FeatureLifecycleHandlers } from './lifecycle-wiring.js';
import type {
  BuildContext,
  TaskContext,
  TaskResult,
  HandoffContext,
  BuildResult,
} from './lifecycle-hooks.js';

// ============================================================================
// Types
// ============================================================================

export type AdapterFactory = () => FeatureLifecycleHandlers;

// ============================================================================
// LazyAdapter
// ============================================================================

export class LazyAdapter {
  private factory: AdapterFactory;
  private instance: FeatureLifecycleHandlers | null = null;
  private moduleName: string;
  private initialized: boolean = false;
  private failed: boolean = false;

  constructor(moduleName: string, factory: AdapterFactory) {
    this.moduleName = moduleName;
    this.factory = factory;
  }

  /**
   * Ensure the real adapter is initialized. Called on first handler invocation.
   * Returns the cached instance, or null if initialization failed.
   */
  private ensureInitialized(): FeatureLifecycleHandlers | null {
    if (this.initialized) {
      return this.instance;
    }

    if (this.failed) {
      return null;
    }

    try {
      this.instance = this.factory();
      this.initialized = true;
      return this.instance;
    } catch (error) {
      this.failed = true;
      const message = error instanceof Error ? error.message : String(error);
      console.error(
        `[LazyAdapter] Failed to initialize module "${this.moduleName}":`,
        message
      );
      return null;
    }
  }

  /**
   * Returns wrapped handlers that lazily init on first call.
   * Each handler delegates to the real adapter after lazy initialization.
   */
  getHandlers(): FeatureLifecycleHandlers {
    return {
      onBeforeBuild: async (context: BuildContext): Promise<void> => {
        const adapter = this.ensureInitialized();
        if (adapter?.onBeforeBuild) {
          await adapter.onBeforeBuild(context);
        }
      },
      onBeforeTask: async (context: TaskContext): Promise<void> => {
        const adapter = this.ensureInitialized();
        if (adapter?.onBeforeTask) {
          await adapter.onBeforeTask(context);
        }
      },
      onAfterTask: async (context: TaskResult): Promise<void> => {
        const adapter = this.ensureInitialized();
        if (adapter?.onAfterTask) {
          await adapter.onAfterTask(context);
        }
      },
      onTaskError: async (context: TaskResult): Promise<void> => {
        const adapter = this.ensureInitialized();
        if (adapter?.onTaskError) {
          await adapter.onTaskError(context);
        }
      },
      onHandoff: async (context: HandoffContext): Promise<void> => {
        const adapter = this.ensureInitialized();
        if (adapter?.onHandoff) {
          await adapter.onHandoff(context);
        }
      },
      onBuildComplete: async (context: BuildResult): Promise<void> => {
        const adapter = this.ensureInitialized();
        if (adapter?.onBuildComplete) {
          await adapter.onBuildComplete(context);
        }
      },
    };
  }

  /**
   * Returns whether the adapter has been initialized (factory has been called).
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Returns the module name this adapter wraps.
   */
  getModuleName(): string {
    return this.moduleName;
  }

  /**
   * Force re-initialization on next handler call.
   * Clears the cached instance and resets failure state.
   */
  reset(): void {
    this.instance = null;
    this.initialized = false;
    this.failed = false;
  }
}

// ============================================================================
// LazyAdapterRegistry
// ============================================================================

export class LazyAdapterRegistry {
  private adapters: Map<string, LazyAdapter> = new Map();

  /**
   * Register a module with a lazy adapter factory.
   */
  register(moduleName: string, factory: AdapterFactory): void {
    const adapter = new LazyAdapter(moduleName, factory);
    this.adapters.set(moduleName, adapter);
  }

  /**
   * Get the lazy adapter for a module.
   */
  getAdapter(moduleName: string): LazyAdapter | undefined {
    return this.adapters.get(moduleName);
  }

  /**
   * Get names of modules whose adapters have been initialized.
   */
  getInitializedModules(): string[] {
    const result: string[] = [];
    for (const adapter of this.adapters.values()) {
      if (adapter.isInitialized()) {
        result.push(adapter.getModuleName());
      }
    }
    return result;
  }

  /**
   * Get names of modules whose adapters have NOT been initialized.
   */
  getUninitializedModules(): string[] {
    const result: string[] = [];
    for (const adapter of this.adapters.values()) {
      if (!adapter.isInitialized()) {
        result.push(adapter.getModuleName());
      }
    }
    return result;
  }

  /**
   * Get all registered module names.
   */
  getAllModules(): string[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * Reset all adapters, forcing re-initialization on next use.
   */
  resetAll(): void {
    for (const adapter of this.adapters.values()) {
      adapter.reset();
    }
  }

  /**
   * Remove all registered adapters.
   */
  clear(): void {
    this.adapters.clear();
  }
}

// ============================================================================
// Singleton
// ============================================================================

let globalLazyAdapterRegistry: LazyAdapterRegistry | null = null;

/**
 * Get the global lazy adapter registry singleton.
 */
export function getLazyAdapterRegistry(): LazyAdapterRegistry {
  if (!globalLazyAdapterRegistry) {
    globalLazyAdapterRegistry = new LazyAdapterRegistry();
  }
  return globalLazyAdapterRegistry;
}

/**
 * Reset the global lazy adapter registry singleton.
 */
export function resetLazyAdapterRegistry(): void {
  globalLazyAdapterRegistry = null;
}
