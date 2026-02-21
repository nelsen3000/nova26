// KMS-29: Plugin System
// Load user plugins from .nova/plugins/ directory

import { readdir, readFile, stat } from 'fs/promises';
import { resolve, join } from 'path';
import { z } from 'zod';
import type { FeatureLifecycleHandlers } from '../orchestrator/lifecycle-wiring.js';

// ============================================================================
// Zod Schema for Plugin Validation
// ============================================================================

// Generic function schema for hooks
const HookFunctionSchema = z.function()
  .args(z.any())
  .returns(z.promise(z.void()))
  .optional();

export const PluginSchema = z.object({
  name: z.string().min(1).max(100),
  version: z.string().regex(/^\d+\.\d+\.\d+.*$/),
  hooks: z.object({
    onBeforeBuild: HookFunctionSchema,
    onBeforeTask: HookFunctionSchema,
    onAfterTask: HookFunctionSchema,
    onTaskError: HookFunctionSchema,
    onHandoff: HookFunctionSchema,
    onBuildComplete: HookFunctionSchema,
  }).optional(),
});

export type Plugin = z.infer<typeof PluginSchema>;

// ============================================================================
// Plugin Load Result
// ============================================================================

export interface PluginLoadResult {
  success: boolean;
  plugin?: Plugin;
  error?: string;
}

export interface PluginLoadSummary {
  loaded: string[];
  failed: Array<{ name: string; error: string }>;
  total: number;
}

// ============================================================================
// Plugin Loader
// ============================================================================

export class PluginLoader {
  private pluginsDir: string;
  private loadedPlugins: Map<string, Plugin> = new Map();

  constructor(pluginsDir: string = '.nova/plugins') {
    this.pluginsDir = resolve(pluginsDir);
  }

  /**
   * Load all plugins from the plugins directory
   */
  async loadAll(): Promise<PluginLoadSummary> {
    const summary: PluginLoadSummary = {
      loaded: [],
      failed: [],
      total: 0,
    };

    try {
      const entries = await readdir(this.pluginsDir);
      
      for (const entry of entries) {
        const fullPath = join(this.pluginsDir, entry);
        const stats = await stat(fullPath);

        if (stats.isDirectory()) {
          const result = await this.loadFromDirectory(fullPath);
          summary.total++;

          if (result.success && result.plugin) {
            this.loadedPlugins.set(result.plugin.name, result.plugin);
            summary.loaded.push(result.plugin.name);
          } else {
            summary.failed.push({ name: entry, error: result.error || 'Unknown error' });
          }
        }
      }
    } catch (error) {
      // Directory doesn't exist or can't be read
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }

    return summary;
  }

  /**
   * Load a plugin from a directory
   */
  async loadFromDirectory(dirPath: string): Promise<PluginLoadResult> {
    try {
      // Try to load plugin.json
      const pluginJsonPath = join(dirPath, 'plugin.json');
      const pluginJson = await readFile(pluginJsonPath, 'utf-8');
      const pluginData = JSON.parse(pluginJson);

      // Validate plugin shape
      const validation = PluginSchema.safeParse(pluginData);
      
      if (!validation.success) {
        return {
          success: false,
          error: `Invalid plugin format: ${validation.error.message}`,
        };
      }

      return {
        success: true,
        plugin: validation.data,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get all loaded plugins
   */
  getAllPlugins(): Plugin[] {
    return Array.from(this.loadedPlugins.values());
  }

  /**
   * Get a specific plugin by name
   */
  getPlugin(name: string): Plugin | undefined {
    return this.loadedPlugins.get(name);
  }

  /**
   * Check if a plugin is loaded
   */
  hasPlugin(name: string): boolean {
    return this.loadedPlugins.has(name);
  }

  /**
   * Unload a plugin
   */
  unloadPlugin(name: string): boolean {
    return this.loadedPlugins.delete(name);
  }

  /**
   * Clear all loaded plugins
   */
  clear(): void {
    this.loadedPlugins.clear();
  }

  /**
   * Get plugin count
   */
  getPluginCount(): number {
    return this.loadedPlugins.size;
  }

  /**
   * Validate a plugin object
   */
  validatePlugin(plugin: unknown): { valid: boolean; error?: string } {
    const result = PluginSchema.safeParse(plugin);
    
    if (result.success) {
      return { valid: true };
    } else {
      return { valid: false, error: result.error.message };
    }
  }

  /**
   * Merge plugin hooks into FeatureLifecycleHandlers
   */
  mergeHooks(base: FeatureLifecycleHandlers, plugin: Plugin): FeatureLifecycleHandlers {
    if (!plugin.hooks) return base;

    return {
      onBeforeBuild: this.chainHandlers(base.onBeforeBuild, plugin.hooks.onBeforeBuild as any),
      onBeforeTask: this.chainHandlers(base.onBeforeTask, plugin.hooks.onBeforeTask as any),
      onAfterTask: this.chainHandlers(base.onAfterTask, plugin.hooks.onAfterTask as any),
      onTaskError: this.chainHandlers(base.onTaskError, plugin.hooks.onTaskError as any),
      onHandoff: this.chainHandlers(base.onHandoff, plugin.hooks.onHandoff as any),
      onBuildComplete: this.chainHandlers(base.onBuildComplete, plugin.hooks.onBuildComplete as any),
    };
  }

  /**
   * Chain two handlers together
   */
  private chainHandlers<T>(
    base: ((ctx: T) => Promise<void>) | undefined,
    plugin: ((ctx: T) => Promise<void>) | undefined
  ): ((ctx: T) => Promise<void>) | undefined {
    if (!base) return plugin;
    if (!plugin) return base;

    return async (ctx: T) => {
      await base(ctx);
      await plugin(ctx);
    };
  }
}

// ============================================================================
// Hook Registry Integration
// ============================================================================

export interface HookRegistry {
  register(handlers: FeatureLifecycleHandlers, priority: number): void;
}

/**
 * Register all loaded plugins into a HookRegistry
 */
export function registerPluginsIntoRegistry(
  loader: PluginLoader,
  registry: HookRegistry
): void {
  const plugins = loader.getAllPlugins();
  
  for (const plugin of plugins) {
    if (plugin.hooks) {
      // Register with lowest priority (runs last)
      registry.register(plugin.hooks as FeatureLifecycleHandlers, 100);
    }
  }
}

// ============================================================================
// Singleton
// ============================================================================

let globalLoader: PluginLoader | null = null;

export function getGlobalPluginLoader(): PluginLoader {
  if (!globalLoader) {
    globalLoader = new PluginLoader();
  }
  return globalLoader;
}

export function resetGlobalPluginLoader(): void {
  globalLoader = null;
}

export function setGlobalPluginLoader(loader: PluginLoader): void {
  globalLoader = loader;
}
