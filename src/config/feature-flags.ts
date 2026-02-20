// KMS-22/MX-09: Feature Flag Registry
// Manages boolean and variant flags from env vars, config files, or programmatically

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// ============================================================================
// Types
// ============================================================================

export type FlagValue = boolean | string | number;

export interface FlagDefinition {
  name: string;
  description: string;
  defaultValue: FlagValue;
  type: 'boolean' | 'string' | 'number';
  allowedValues?: FlagValue[];
}

export interface FlagState {
  value: FlagValue;
  source: 'default' | 'env' | 'file' | 'programmatic';
  lastModified: number;
}

export interface FeatureFlagRegistryConfig {
  configPath?: string;
  envPrefix?: string;
}

// ============================================================================
// Feature Flag Registry
// ============================================================================

export class FeatureFlagRegistry {
  private flags: Map<string, FlagDefinition> = new Map();
  private state: Map<string, FlagState> = new Map();
  private config: FeatureFlagRegistryConfig;

  constructor(config: FeatureFlagRegistryConfig = {}) {
    this.config = {
      envPrefix: 'NOVA26_FF_',
      ...config,
    };
  }

  /**
   * Register a new flag definition.
   */
  register(definition: FlagDefinition): void {
    this.flags.set(definition.name, definition);
    
    // Initialize with default if not already set
    if (!this.state.has(definition.name)) {
      this.state.set(definition.name, {
        value: definition.defaultValue,
        source: 'default',
        lastModified: Date.now(),
      });
    }
  }

  /**
   * Get a flag's current value.
   */
  get<T extends FlagValue>(name: string): T | undefined {
    const state = this.state.get(name);
    return state?.value as T | undefined;
  }

  /**
   * Get a boolean flag value (convenience method).
   */
  getBoolean(name: string): boolean {
    const value = this.get(name);
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value === 'true';
    return false;
  }

  /**
   * Get a string flag value (convenience method).
   */
  getString(name: string): string | undefined {
    const value = this.get(name);
    return typeof value === 'string' ? value : String(value);
  }

  /**
   * Set a flag value programmatically.
   */
  set(name: string, value: FlagValue): boolean {
    const definition = this.flags.get(name);
    if (!definition) return false;

    // Validate type
    if (typeof value !== definition.type && definition.type !== 'string') {
      return false;
    }

    // Validate allowed values if specified
    if (definition.allowedValues && !definition.allowedValues.includes(value)) {
      return false;
    }

    this.state.set(name, {
      value,
      source: 'programmatic',
      lastModified: Date.now(),
    });

    return true;
  }

  /**
   * Reset a flag to its default value.
   */
  reset(name: string): boolean {
    const definition = this.flags.get(name);
    if (!definition) return false;

    this.state.set(name, {
      value: definition.defaultValue,
      source: 'default',
      lastModified: Date.now(),
    });

    return true;
  }

  /**
   * Reset all flags to their default values.
   */
  resetAll(): void {
    for (const [name, definition] of this.flags) {
      this.state.set(name, {
        value: definition.defaultValue,
        source: 'default',
        lastModified: Date.now(),
      });
    }
  }

  /**
   * Check if a flag is registered.
   */
  has(name: string): boolean {
    return this.flags.has(name);
  }

  /**
   * Get all registered flag names.
   */
  getAllNames(): string[] {
    return Array.from(this.flags.keys());
  }

  /**
   * Get all flag states with their sources.
   */
  getAllStates(): Array<{ name: string; value: FlagValue; source: string; description: string }> {
    const result = [];
    for (const [name, definition] of this.flags) {
      const state = this.state.get(name);
      result.push({
        name,
        value: state?.value ?? definition.defaultValue,
        source: state?.source ?? 'default',
        description: definition.description,
      });
    }
    return result;
  }

  /**
   * Load flags from environment variables.
   */
  loadFromEnv(): void {
    const prefix = this.config.envPrefix ?? 'NOVA26_FF_';
    
    for (const [envName, envValue] of Object.entries(process.env)) {
      if (envName?.startsWith(prefix)) {
        const flagName = envName.slice(prefix.length).toLowerCase().replace(/_/g, '-');
        const definition = this.flags.get(flagName);
        
        if (definition) {
          let parsedValue: FlagValue = envValue ?? '';
          
          // Parse based on expected type
          if (definition.type === 'boolean') {
            parsedValue = envValue === 'true' || envValue === '1';
          } else if (definition.type === 'number') {
            parsedValue = Number(envValue) || 0;
          }
          
          this.state.set(flagName, {
            value: parsedValue,
            source: 'env',
            lastModified: Date.now(),
          });
        }
      }
    }
  }

  /**
   * Load flags from a JSON config file.
   */
  loadFromFile(filePath?: string): boolean {
    const path = filePath ?? this.config.configPath;
    if (!path) return false;

    const fullPath = resolve(path);
    if (!existsSync(fullPath)) return false;

    try {
      const content = readFileSync(fullPath, 'utf-8');
      const config = JSON.parse(content) as Record<string, FlagValue>;

      for (const [name, value] of Object.entries(config)) {
        if (this.flags.has(name)) {
          this.state.set(name, {
            value,
            source: 'file',
            lastModified: Date.now(),
          });
        }
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the source of a flag's current value.
   */
  getSource(name: string): string | undefined {
    return this.state.get(name)?.source;
  }

  /**
   * Clear all registered flags.
   */
  clear(): void {
    this.flags.clear();
    this.state.clear();
  }
}

// ============================================================================
// Feature Flag Store (for lifecycle wiring compatibility)
// ============================================================================

export interface FlagStore {
  name: string;
  value: FlagValue;
  enabled: boolean;
}

export class FeatureFlagStore {
  private registry: FeatureFlagRegistry;

  constructor(registry: FeatureFlagRegistry) {
    this.registry = registry;
  }

  /**
   * List all flags as store items.
   */
  listFlags(): FlagStore[] {
    return this.registry.getAllStates().map(state => ({
      name: state.name,
      value: state.value,
      enabled: state.value === true,
    }));
  }

  /**
   * Check if a flag is enabled.
   */
  isEnabled(name: string): boolean {
    return this.registry.getBoolean(name);
  }

  /**
   * Get a flag value.
   */
  get(name: string): FlagValue | undefined {
    return this.registry.get(name);
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let globalRegistry: FeatureFlagRegistry | null = null;
let globalStore: FeatureFlagStore | null = null;

export function getGlobalRegistry(): FeatureFlagRegistry {
  if (!globalRegistry) {
    globalRegistry = new FeatureFlagRegistry();
  }
  return globalRegistry;
}

export function resetGlobalRegistry(): void {
  globalRegistry = null;
}

export function setGlobalRegistry(registry: FeatureFlagRegistry): void {
  globalRegistry = registry;
  globalStore = null; // Reset store so it will be recreated with new registry
}

/**
 * Get the global feature flag store.
 */
export function getFeatureFlagStore(): FeatureFlagStore {
  if (!globalStore) {
    globalStore = new FeatureFlagStore(getGlobalRegistry());
  }
  return globalStore;
}

/**
 * Reset the global feature flag store.
 */
export function resetFeatureFlagStore(): void {
  globalStore = null;
}

// ============================================================================
// Default Nova26 Feature Flags
// ============================================================================

export function registerDefaultFlags(registry: FeatureFlagRegistry): void {
  const defaultFlags: FlagDefinition[] = [
    {
      name: 'model-routing',
      description: 'Enable model routing module',
      defaultValue: true,
      type: 'boolean',
    },
    {
      name: 'perplexity',
      description: 'Enable perplexity research module',
      defaultValue: false,
      type: 'boolean',
    },
    {
      name: 'workflow-engine',
      description: 'Enable workflow engine module',
      defaultValue: true,
      type: 'boolean',
    },
    {
      name: 'infinite-memory',
      description: 'Enable infinite memory module',
      defaultValue: false,
      type: 'boolean',
    },
    {
      name: 'cinematic-observability',
      description: 'Enable observability tracing',
      defaultValue: true,
      type: 'boolean',
    },
    {
      name: 'ai-model-database',
      description: 'Enable AI model database',
      defaultValue: false,
      type: 'boolean',
    },
    {
      name: 'crdt-collaboration',
      description: 'Enable CRDT collaboration',
      defaultValue: false,
      type: 'boolean',
    },
    {
      name: 'experimental-features',
      description: 'Enable experimental features',
      defaultValue: false,
      type: 'boolean',
    },
  ];

  for (const flag of defaultFlags) {
    registry.register(flag);
  }
}
