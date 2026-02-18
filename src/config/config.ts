// MEGA-02: Configuration System for NOVA26
// Provides hierarchical configuration with validation using Zod

import { z } from 'zod';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';

// ============================================================================
// Zod Schema Definition
// ============================================================================

const OllamaSchema = z.object({
  host: z.string().default('http://localhost:11434'),
  timeout: z.number().default(120000),
});

const ModelsSchema = z.object({
  default: z.string().default('qwen2.5:7b'),
  tier: z.enum(['free', 'paid', 'hybrid']).default('free'),
  agentOverrides: z.record(z.string()).default({}),
});

const BudgetSchema = z.object({
  daily: z.number().nullable().default(null),
  weekly: z.number().nullable().default(null),
  monthly: z.number().nullable().default(null),
});

const CacheSchema = z.object({
  enabled: z.boolean().default(true),
  maxAgeHours: z.number().default(24),
  maxSizeMB: z.number().default(500),
});

const GitSchema = z.object({
  enabled: z.boolean().default(false),
  branchPrefix: z.string().default('nova26/'),
  autoCommit: z.boolean().default(true),
  autoPR: z.boolean().default(false),
});

const SecuritySchema = z.object({
  scanOnBuild: z.boolean().default(false),
  blockOnCritical: z.boolean().default(true),
});

const ConvexSchema = z.object({
  url: z.string().nullable().default(null),
  syncEnabled: z.boolean().default(false),
});

const UISchema = z.object({
  verbose: z.boolean().default(false),
  theme: z.enum(['dark', 'light', 'auto']).default('auto'),
});

const ConfigSchema = z.object({
  ollama: OllamaSchema.default({}),
  models: ModelsSchema.default({}),
  budget: BudgetSchema.default({}),
  cache: CacheSchema.default({}),
  git: GitSchema.default({}),
  security: SecuritySchema.default({}),
  convex: ConvexSchema.default({}),
  ui: UISchema.default({}),
});

export type NovaConfig = z.infer<typeof ConfigSchema>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PartialNovaConfig = Record<string, any>;

// ============================================================================
// Configuration Cache
// ============================================================================

let cachedConfig: NovaConfig | null = null;
let cachedWithOverrides: WeakMap<object, NovaConfig> | null = null;

// ============================================================================
// Default Configuration
// ============================================================================

export function getDefaultConfig(): NovaConfig {
  return ConfigSchema.parse({});
}

// ============================================================================
// Deep Merge Utility
// ============================================================================

/**
 * Deep merge multiple partial config sources into a single config.
 * Later sources override earlier ones.
 */
export function mergeConfigs(...sources: PartialNovaConfig[]): NovaConfig {
  const merged: Record<string, unknown> = {};

  for (const source of sources) {
    deepMerge(merged, source as Record<string, unknown>);
  }

  // Validate with Zod - applies defaults for any missing fields
  const result = ConfigSchema.safeParse(merged);
  
  if (!result.success) {
    const issues = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
    throw new Error(`Configuration validation failed: ${issues}`);
  }

  return result.data;
}

function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): void {
  for (const key in source) {
    if (source[key] === undefined) continue;
    
    if (source[key] === null) {
      // Null explicitly overrides (set to null)
      target[key] = null;
    } else if (
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      !(source[key] instanceof Date) &&
      target[key] !== null &&
      typeof target[key] === 'object' &&
      !Array.isArray(target[key])
    ) {
      // Recursively merge objects
      if (!target[key]) target[key] = {};
      deepMerge(target[key] as Record<string, unknown>, source[key] as Record<string, unknown>);
    } else {
      // Primitive value or array - overwrite
      target[key] = source[key];
    }
  }
}

// ============================================================================
// Environment Variable Parsing
// ============================================================================

/**
 * Parse environment variables into a partial config object.
 * Supports: NOVA26_OLLAMA_HOST, NOVA26_TIER, NOVA26_BUDGET_DAILY, etc.
 */
export function getConfigFromEnv(): PartialNovaConfig {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const env: Record<string, any> = {};

  // Ollama settings
  if (process.env.NOVA26_OLLAMA_HOST) {
    env.ollama = env.ollama || {};
    env.ollama.host = process.env.NOVA26_OLLAMA_HOST;
  }
  if (process.env.NOVA26_OLLAMA_TIMEOUT) {
    const timeout = parseInt(process.env.NOVA26_OLLAMA_TIMEOUT, 10);
    if (!isNaN(timeout)) {
      env.ollama = env.ollama || {};
      env.ollama.timeout = timeout;
    }
  }

  // Model settings
  if (process.env.NOVA26_MODEL) {
    env.models = env.models || {};
    env.models.default = process.env.NOVA26_MODEL;
  }
  if (process.env.NOVA26_TIER) {
    const tier = process.env.NOVA26_TIER;
    if (tier === 'free' || tier === 'paid' || tier === 'hybrid') {
      env.models = env.models || {};
      env.models.tier = tier;
    }
  }
  // Parse agent overrides: NOVA26_AGENT_SUN=gpt-4o
  const agentOverrides: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith('NOVA26_AGENT_') && value) {
      const agentName = key.replace('NOVA26_AGENT_', '');
      agentOverrides[agentName] = value;
    }
  }
  if (Object.keys(agentOverrides).length > 0) {
    env.models = env.models || {};
    env.models.agentOverrides = agentOverrides;
  }

  // Budget settings
  if (process.env.NOVA26_BUDGET_DAILY) {
    const daily = parseFloat(process.env.NOVA26_BUDGET_DAILY);
    if (!isNaN(daily)) {
      env.budget = env.budget || {};
      env.budget.daily = daily;
    }
  }
  if (process.env.NOVA26_BUDGET_WEEKLY) {
    const weekly = parseFloat(process.env.NOVA26_BUDGET_WEEKLY);
    if (!isNaN(weekly)) {
      env.budget = env.budget || {};
      env.budget.weekly = weekly;
    }
  }
  if (process.env.NOVA26_BUDGET_MONTHLY) {
    const monthly = parseFloat(process.env.NOVA26_BUDGET_MONTHLY);
    if (!isNaN(monthly)) {
      env.budget = env.budget || {};
      env.budget.monthly = monthly;
    }
  }

  // Cache settings
  if (process.env.NOVA26_CACHE_ENABLED !== undefined) {
    env.cache = env.cache || {};
    env.cache.enabled = process.env.NOVA26_CACHE_ENABLED === 'true';
  }
  if (process.env.NOVA26_CACHE_MAX_AGE_HOURS) {
    const maxAgeHours = parseInt(process.env.NOVA26_CACHE_MAX_AGE_HOURS, 10);
    if (!isNaN(maxAgeHours)) {
      env.cache = env.cache || {};
      env.cache.maxAgeHours = maxAgeHours;
    }
  }
  if (process.env.NOVA26_CACHE_MAX_SIZE_MB) {
    const maxSizeMB = parseInt(process.env.NOVA26_CACHE_MAX_SIZE_MB, 10);
    if (!isNaN(maxSizeMB)) {
      env.cache = env.cache || {};
      env.cache.maxSizeMB = maxSizeMB;
    }
  }

  // Git settings
  if (process.env.NOVA26_GIT_ENABLED !== undefined) {
    env.git = env.git || {};
    env.git.enabled = process.env.NOVA26_GIT_ENABLED === 'true';
  }
  if (process.env.NOVA26_GIT_BRANCH_PREFIX) {
    env.git = env.git || {};
    env.git.branchPrefix = process.env.NOVA26_GIT_BRANCH_PREFIX;
  }
  if (process.env.NOVA26_GIT_AUTO_COMMIT !== undefined) {
    env.git = env.git || {};
    env.git.autoCommit = process.env.NOVA26_GIT_AUTO_COMMIT === 'true';
  }
  if (process.env.NOVA26_GIT_AUTO_PR !== undefined) {
    env.git = env.git || {};
    env.git.autoPR = process.env.NOVA26_GIT_AUTO_PR === 'true';
  }

  // Security settings
  if (process.env.NOVA26_SECURITY_SCAN_ON_BUILD !== undefined) {
    env.security = env.security || {};
    env.security.scanOnBuild = process.env.NOVA26_SECURITY_SCAN_ON_BUILD === 'true';
  }
  if (process.env.NOVA26_SECURITY_BLOCK_ON_CRITICAL !== undefined) {
    env.security = env.security || {};
    env.security.blockOnCritical = process.env.NOVA26_SECURITY_BLOCK_ON_CRITICAL === 'true';
  }

  // Convex settings
  if (process.env.NOVA26_CONVEX_URL) {
    env.convex = env.convex || {};
    env.convex.url = process.env.NOVA26_CONVEX_URL;
  }
  if (process.env.NOVA26_CONVEX_SYNC_ENABLED !== undefined) {
    env.convex = env.convex || {};
    env.convex.syncEnabled = process.env.NOVA26_CONVEX_SYNC_ENABLED === 'true';
  }

  // UI settings
  if (process.env.NOVA26_VERBOSE !== undefined) {
    env.ui = env.ui || {};
    env.ui.verbose = process.env.NOVA26_VERBOSE === 'true';
  }
  if (process.env.NOVA26_THEME) {
    const theme = process.env.NOVA26_THEME;
    if (theme === 'dark' || theme === 'light' || theme === 'auto') {
      env.ui = env.ui || {};
      env.ui.theme = theme;
    }
  }

  return env as PartialNovaConfig;
}

// ============================================================================
// File Loading
// ============================================================================

let customProjectConfigPath: string | null = null;

export const PROJECT_CONFIG_PATH = join(process.cwd(), '.nova', 'config.json');
export const USER_CONFIG_DIR = join(homedir(), '.nova26');
export const USER_CONFIG_PATH = join(USER_CONFIG_DIR, 'config.json');

/**
 * Set a custom path for the project config (used for testing).
 * Set to null to reset to default.
 */
export function setProjectConfigPath(path: string | null): void {
  customProjectConfigPath = path;
  // Clear cache when config path changes
  resetConfig();
}

/**
 * Get the effective project config path.
 */
function getProjectConfigPath(): string {
  return customProjectConfigPath ?? PROJECT_CONFIG_PATH;
}

/**
 * Load a JSON config file from the specified path.
 * Returns empty object if file doesn't exist or is invalid.
 */
export function loadConfigFile(path: string): PartialNovaConfig {
  if (!existsSync(path)) {
    return {};
  }

  try {
    const content = readFileSync(path, 'utf-8');
    const parsed = JSON.parse(content) as PartialNovaConfig;
    return parsed;
  } catch {
    // Return empty object on parse error - individual validation happens in mergeConfigs
    return {};
  }
}

/**
 * Load project config from .nova/config.json
 */
function loadProjectConfig(): PartialNovaConfig {
  return loadConfigFile(getProjectConfigPath());
}

/**
 * Load user config from ~/.nova26/config.json
 */
function loadUserConfig(): PartialNovaConfig {
  return loadConfigFile(USER_CONFIG_PATH);
}

// ============================================================================
// Main Configuration API
// ============================================================================

/**
 * Get the merged configuration with the following priority (high to low):
 * 1. Runtime overrides (provided as argument)
 * 2. Environment variables (NOVA26_*)
 * 3. Project config (.nova/config.json)
 * 4. User config (~/.nova26/config.json)
 * 5. Built-in defaults
 * 
 * Result is cached after first load. Use resetConfig() to clear cache.
 */
export function getConfig(overrides?: PartialNovaConfig): NovaConfig {
  // If we have cached config and no overrides, return cached
  if (cachedConfig && !overrides) {
    return cachedConfig;
  }

  // Check if we've already computed this exact override set
  if (overrides && cachedWithOverrides) {
    const cached = cachedWithOverrides.get(overrides);
    if (cached) {
      return cached;
    }
  }

  // Load configs in priority order (lowest to highest)
  const defaults = getDefaultConfig();
  const userConfig = loadUserConfig();
  const projectConfig = loadProjectConfig();
  const envConfig = getConfigFromEnv();

  // Merge from lowest to highest priority
  const merged = mergeConfigs(
    defaults,
    userConfig,
    projectConfig,
    envConfig,
    overrides || {}
  );

  // Cache the result
  if (!overrides) {
    cachedConfig = merged;
  } else {
    if (!cachedWithOverrides) {
      cachedWithOverrides = new WeakMap();
    }
    cachedWithOverrides.set(overrides, merged);
  }

  return merged;
}

/**
 * Reset the configuration cache. Useful for testing.
 */
export function resetConfig(): void {
  cachedConfig = null;
  cachedWithOverrides = null;
}

/**
 * Save configuration to the project config file (.nova/config.json).
 * Creates the .nova directory if it doesn't exist.
 */
export function saveProjectConfig(config: PartialNovaConfig): void {
  const configPath = getProjectConfigPath();
  const configDir = dirname(configPath);
  
  // Create .nova directory if needed
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }

  // Write config as formatted JSON
  const content = JSON.stringify(config, null, 2) + '\n';
  writeFileSync(configPath, content, 'utf-8');
}

/**
 * Save configuration to the user config file (~/.nova26/config.json).
 * Creates the ~/.nova26 directory if it doesn't exist.
 */
export function saveUserConfig(config: PartialNovaConfig): void {
  // Create ~/.nova26 directory if needed
  if (!existsSync(USER_CONFIG_DIR)) {
    mkdirSync(USER_CONFIG_DIR, { recursive: true });
  }

  // Write config as formatted JSON
  const content = JSON.stringify(config, null, 2) + '\n';
  writeFileSync(USER_CONFIG_PATH, content, 'utf-8');
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get the effective configuration without caching.
 * Useful for debugging configuration issues.
 */
export function getConfigUncached(overrides?: PartialNovaConfig): NovaConfig {
  const defaults = getDefaultConfig();
  const userConfig = loadUserConfig();
  const projectConfig = loadProjectConfig();
  const envConfig = getConfigFromEnv();

  return mergeConfigs(
    defaults,
    userConfig,
    projectConfig,
    envConfig,
    overrides || {}
  );
}

/**
 * Get the configuration source info for debugging.
 * Returns an object showing which sources are active.
 */
export function getConfigSources(): {
  hasProjectConfig: boolean;
  hasUserConfig: boolean;
  projectConfigPath: string;
  userConfigPath: string;
  envVars: string[];
} {
  const envVars = Object.keys(process.env).filter(key => 
    key.startsWith('NOVA26_')
  );

  return {
    hasProjectConfig: existsSync(PROJECT_CONFIG_PATH),
    hasUserConfig: existsSync(USER_CONFIG_PATH),
    projectConfigPath: PROJECT_CONFIG_PATH,
    userConfigPath: USER_CONFIG_PATH,
    envVars,
  };
}

// PROJECT_CONFIG_PATH and USER_CONFIG_PATH are already exported above
