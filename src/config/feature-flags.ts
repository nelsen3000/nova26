// MX-09: Feature Flag Registry for NOVA26
// Provides typed feature flag management with env, file, and programmatic sources

import { readFileSync } from 'fs';

// ============================================================================
// Types
// ============================================================================

type FlagSource = 'env' | 'file' | 'default';

interface FlagEntry {
  value: boolean | string;
  source: FlagSource;
}

export interface FeatureFlagRegistry {
  get(flagName: string): boolean;
  getVariant(flagName: string): string | null;
  set(flagName: string, value: boolean | string): void;
  isEnabled(flagName: string): boolean;
  listFlags(): Array<{ name: string; value: boolean | string; source: FlagSource }>;
  loadFromEnv(env?: Record<string, string | undefined>): number;
  loadFromFile(filePath?: string): number;
  reset(): void;
}

// ============================================================================
// Default Flags for All Nova26 Modules
// ============================================================================

const NOVA26_DEFAULT_FLAGS: Record<string, boolean | string> = {
  modelRouting: false,
  perplexity: false,
  workflowEngine: false,
  infiniteMemory: false,
  cinematicObservability: false,
  aiModelDatabase: false,
  crdtCollaboration: false,
};

// ============================================================================
// Environment Variable Prefix
// ============================================================================

const ENV_PREFIX = 'NOVA26_FF_';

// ============================================================================
// Helpers
// ============================================================================

/**
 * Convert an UPPER_SNAKE_CASE env suffix back to camelCase.
 * e.g. "MODEL_ROUTING" -> "modelRouting"
 */
function fromEnvKey(envSuffix: string): string {
  return envSuffix
    .toLowerCase()
    .replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

/**
 * Parse a string value into a boolean or string.
 * "true" / "1" -> true
 * "false" / "0" -> false
 * anything else -> kept as string (variant)
 */
function parseValue(raw: string): boolean | string {
  const lower = raw.toLowerCase();
  if (lower === 'true' || lower === '1') return true;
  if (lower === 'false' || lower === '0') return false;
  return raw;
}

// ============================================================================
// FeatureFlagStore Implementation
// ============================================================================

export class FeatureFlagStore implements FeatureFlagRegistry {
  private flags: Map<string, FlagEntry> = new Map();

  constructor() {
    this.loadDefaults();
  }

  // --------------------------------------------------------------------------
  // Public API
  // --------------------------------------------------------------------------

  get(flagName: string): boolean {
    const entry = this.flags.get(flagName);
    if (!entry) return false;
    if (typeof entry.value === 'boolean') return entry.value;
    // For variant flags, treat any non-empty string as enabled
    return entry.value !== '';
  }

  getVariant(flagName: string): string | null {
    const entry = this.flags.get(flagName);
    if (!entry) return null;
    if (typeof entry.value === 'string') return entry.value;
    return null;
  }

  set(flagName: string, value: boolean | string): void {
    const existing = this.flags.get(flagName);
    // Programmatic set always uses 'default' source, but never overwrites
    // higher-priority sources (env or file).
    // If there's already a value from env or file, do not overwrite it.
    if (existing && (existing.source === 'env' || existing.source === 'file')) {
      return;
    }
    this.flags.set(flagName, { value, source: 'default' });
  }

  isEnabled(flagName: string): boolean {
    return this.get(flagName);
  }

  listFlags(): Array<{ name: string; value: boolean | string; source: FlagSource }> {
    const result: Array<{ name: string; value: boolean | string; source: FlagSource }> = [];
    for (const [name, entry] of this.flags) {
      result.push({ name, value: entry.value, source: entry.source });
    }
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }

  loadFromEnv(env?: Record<string, string | undefined>): number {
    const source = env ?? process.env;
    let loaded = 0;

    for (const [key, rawValue] of Object.entries(source)) {
      if (!key.startsWith(ENV_PREFIX) || rawValue === undefined) continue;

      const envSuffix = key.slice(ENV_PREFIX.length);
      const flagName = fromEnvKey(envSuffix);
      const value = parseValue(rawValue);

      this.flags.set(flagName, { value, source: 'env' });
      loaded++;
    }

    return loaded;
  }

  loadFromFile(filePath?: string): number {
    const path = filePath ?? '.nova/flags.json';
    let loaded = 0;

    try {
      const content = readFileSync(path, 'utf-8');
      const parsed: unknown = JSON.parse(content);

      if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const record = parsed as Record<string, unknown>;
        for (const [flagName, rawValue] of Object.entries(record)) {
          if (typeof rawValue === 'boolean' || typeof rawValue === 'string') {
            // File values never overwrite env values
            const existing = this.flags.get(flagName);
            if (existing && existing.source === 'env') continue;

            this.flags.set(flagName, { value: rawValue, source: 'file' });
            loaded++;
          }
        }
      }
    } catch {
      // File not found or invalid JSON — silently ignore
    }

    return loaded;
  }

  reset(): void {
    this.flags.clear();
    this.loadDefaults();
  }

  // --------------------------------------------------------------------------
  // Private
  // --------------------------------------------------------------------------

  private loadDefaults(): void {
    for (const [name, value] of Object.entries(NOVA26_DEFAULT_FLAGS)) {
      this.flags.set(name, { value, source: 'default' });
    }
  }
}

// ============================================================================
// Singleton
// ============================================================================

let singleton: FeatureFlagStore | null = null;

export function getFeatureFlagStore(): FeatureFlagStore {
  if (!singleton) {
    singleton = new FeatureFlagStore();
  }
  return singleton;
}

export function resetFeatureFlagStore(): void {
  singleton = null;
}
