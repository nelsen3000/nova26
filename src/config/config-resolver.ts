// MX-07: Config Resolver — merges env vars → config file → RalphLoopOptions defaults
// Type-safe configuration cascade with Zod validation

import { z } from 'zod';
import type { RalphLoopOptions } from '../orchestrator/ralph-loop-types.js';
import {
  ModelRoutingConfigSchema,
  PerplexityToolConfigSchema,
  WorkflowEngineOptionsSchema,
  InfiniteMemoryModuleConfigSchema,
  CinematicConfigSchema,
  AIModelDatabaseModuleConfigSchema,
  CRDTCollaborationModuleConfigSchema,
} from './module-schemas.js';

// ============================================================================
// Config Source Types
// ============================================================================

export type ConfigSource = 'env' | 'file' | 'defaults';

export interface ConfigResolution<T> {
  value: T;
  source: ConfigSource;
  key: string;
}

export interface ConfigValidationError {
  module: string;
  field: string;
  message: string;
  source: ConfigSource;
}

export interface ConfigResolverResult {
  options: Partial<RalphLoopOptions>;
  resolutions: ConfigResolution<unknown>[];
  errors: ConfigValidationError[];
  sources: { env: number; file: number; defaults: number };
}

// ============================================================================
// Environment Variable Mapping
// ============================================================================

const ENV_PREFIX = 'NOVA26_';

interface EnvMapping {
  envKey: string;
  optionsPath: string;
  type: 'boolean' | 'number' | 'string';
}

const ENV_MAPPINGS: EnvMapping[] = [
  // Feature enablement flags
  { envKey: `${ENV_PREFIX}MODEL_ROUTING`, optionsPath: 'modelRoutingEnabled', type: 'boolean' },
  { envKey: `${ENV_PREFIX}PERPLEXITY`, optionsPath: 'perplexityEnabled', type: 'boolean' },
  { envKey: `${ENV_PREFIX}WORKFLOW_ENGINE`, optionsPath: 'workflowEngineEnabled', type: 'boolean' },
  { envKey: `${ENV_PREFIX}INFINITE_MEMORY`, optionsPath: 'infiniteMemoryEnabled', type: 'boolean' },
  { envKey: `${ENV_PREFIX}CINEMATIC_OBSERVABILITY`, optionsPath: 'cinematicObservabilityEnabled', type: 'boolean' },
  { envKey: `${ENV_PREFIX}AI_MODEL_DATABASE`, optionsPath: 'aiModelDatabaseEnabled', type: 'boolean' },
  { envKey: `${ENV_PREFIX}CRDT_COLLABORATION`, optionsPath: 'crdtCollaborationEnabled', type: 'boolean' },
  { envKey: `${ENV_PREFIX}PORTFOLIO`, optionsPath: 'portfolioEnabled', type: 'boolean' },
  { envKey: `${ENV_PREFIX}AGENT_MEMORY`, optionsPath: 'agentMemoryEnabled', type: 'boolean' },
  { envKey: `${ENV_PREFIX}GENERATIVE_UI`, optionsPath: 'generativeUIEnabled', type: 'boolean' },
  { envKey: `${ENV_PREFIX}AUTONOMOUS_TESTING`, optionsPath: 'autonomousTestingEnabled', type: 'boolean' },
  { envKey: `${ENV_PREFIX}WELLBEING`, optionsPath: 'wellbeingEnabled', type: 'boolean' },
  { envKey: `${ENV_PREFIX}ADVANCED_RECOVERY`, optionsPath: 'advancedRecoveryEnabled', type: 'boolean' },
  { envKey: `${ENV_PREFIX}ADVANCED_INIT`, optionsPath: 'advancedInitEnabled', type: 'boolean' },

  // Core options
  { envKey: `${ENV_PREFIX}PARALLEL_MODE`, optionsPath: 'parallelMode', type: 'boolean' },
  { envKey: `${ENV_PREFIX}CONCURRENCY`, optionsPath: 'concurrency', type: 'number' },
  { envKey: `${ENV_PREFIX}AUTO_TEST_FIX`, optionsPath: 'autoTestFix', type: 'boolean' },
  { envKey: `${ENV_PREFIX}MAX_TEST_RETRIES`, optionsPath: 'maxTestRetries', type: 'number' },
  { envKey: `${ENV_PREFIX}PLAN_APPROVAL`, optionsPath: 'planApproval', type: 'boolean' },
  { envKey: `${ENV_PREFIX}BUDGET_LIMIT`, optionsPath: 'budgetLimit', type: 'number' },
  { envKey: `${ENV_PREFIX}COST_TRACKING`, optionsPath: 'costTracking', type: 'boolean' },
  { envKey: `${ENV_PREFIX}GIT_WORKFLOW`, optionsPath: 'gitWorkflow', type: 'boolean' },
];

// ============================================================================
// Default Options
// ============================================================================

export const DEFAULT_RALPH_LOOP_OPTIONS: Partial<RalphLoopOptions> = {
  parallelMode: false,
  concurrency: 1,
  autoTestFix: true,
  maxTestRetries: 3,
  planApproval: true,
  costTracking: false,
  gitWorkflow: true,
  modelRoutingEnabled: false,
  perplexityEnabled: false,
  workflowEngineEnabled: false,
  infiniteMemoryEnabled: false,
  cinematicObservabilityEnabled: false,
  aiModelDatabaseEnabled: false,
  crdtCollaborationEnabled: false,
  portfolioEnabled: false,
  agentMemoryEnabled: false,
  generativeUIEnabled: false,
  autonomousTestingEnabled: false,
  wellbeingEnabled: false,
  advancedRecoveryEnabled: false,
  advancedInitEnabled: false,
};

// ============================================================================
// Environment Parser
// ============================================================================

function parseEnvValue(value: string, type: 'boolean' | 'number' | 'string'): boolean | number | string | undefined {
  switch (type) {
    case 'boolean': {
      const lower = value.toLowerCase();
      if (lower === 'true' || lower === '1' || lower === 'yes') return true;
      if (lower === 'false' || lower === '0' || lower === 'no') return false;
      return undefined;
    }
    case 'number': {
      const num = Number(value);
      return Number.isFinite(num) ? num : undefined;
    }
    case 'string':
      return value;
  }
}

/**
 * Read RalphLoopOptions overrides from environment variables.
 */
export function readEnvOverrides(env: Record<string, string | undefined> = process.env): {
  overrides: Partial<RalphLoopOptions>;
  resolutions: ConfigResolution<unknown>[];
} {
  const overrides: Record<string, unknown> = {};
  const resolutions: ConfigResolution<unknown>[] = [];

  for (const mapping of ENV_MAPPINGS) {
    const raw = env[mapping.envKey];
    if (raw === undefined) continue;

    const parsed = parseEnvValue(raw, mapping.type);
    if (parsed === undefined) continue;

    overrides[mapping.optionsPath] = parsed;
    resolutions.push({
      value: parsed,
      source: 'env',
      key: mapping.envKey,
    });
  }

  return { overrides: overrides as Partial<RalphLoopOptions>, resolutions };
}

// ============================================================================
// Config File Parser
// ============================================================================

export interface NovaConfigFile {
  options?: Partial<RalphLoopOptions>;
  modelRoutingConfig?: unknown;
  perplexityConfig?: unknown;
  workflowEngineConfig?: unknown;
  infiniteMemoryConfig?: unknown;
  cinematicObservabilityConfig?: unknown;
  aiModelDatabaseConfig?: unknown;
  crdtCollaborationConfig?: unknown;
}

const NovaConfigFileSchema = z.object({
  options: z.record(z.unknown()).optional(),
  modelRoutingConfig: z.unknown().optional(),
  perplexityConfig: z.unknown().optional(),
  workflowEngineConfig: z.unknown().optional(),
  infiniteMemoryConfig: z.unknown().optional(),
  cinematicObservabilityConfig: z.unknown().optional(),
  aiModelDatabaseConfig: z.unknown().optional(),
  crdtCollaborationConfig: z.unknown().optional(),
}).passthrough();

/**
 * Parse a config file object (already loaded as JSON).
 * Does NOT read from disk — caller provides the parsed JSON.
 */
export function parseConfigFile(raw: unknown): {
  config: NovaConfigFile;
  resolutions: ConfigResolution<unknown>[];
  errors: ConfigValidationError[];
} {
  const resolutions: ConfigResolution<unknown>[] = [];
  const errors: ConfigValidationError[] = [];

  const parseResult = NovaConfigFileSchema.safeParse(raw);
  if (!parseResult.success) {
    errors.push({
      module: 'config-file',
      field: 'root',
      message: parseResult.error.message,
      source: 'file',
    });
    return { config: {}, resolutions, errors };
  }

  const config = parseResult.data as NovaConfigFile;

  // Validate module-specific configs if present
  const moduleValidations: Array<{
    key: keyof NovaConfigFile;
    schema: z.ZodType<unknown>;
    moduleName: string;
  }> = [
    { key: 'modelRoutingConfig', schema: ModelRoutingConfigSchema as z.ZodType<unknown>, moduleName: 'model-routing' },
    { key: 'perplexityConfig', schema: PerplexityToolConfigSchema as z.ZodType<unknown>, moduleName: 'perplexity' },
    { key: 'workflowEngineConfig', schema: WorkflowEngineOptionsSchema as z.ZodType<unknown>, moduleName: 'workflow-engine' },
    { key: 'infiniteMemoryConfig', schema: InfiniteMemoryModuleConfigSchema as z.ZodType<unknown>, moduleName: 'infinite-memory' },
    { key: 'cinematicObservabilityConfig', schema: CinematicConfigSchema as z.ZodType<unknown>, moduleName: 'cinematic-observability' },
    { key: 'aiModelDatabaseConfig', schema: AIModelDatabaseModuleConfigSchema as z.ZodType<unknown>, moduleName: 'ai-model-database' },
    { key: 'crdtCollaborationConfig', schema: CRDTCollaborationModuleConfigSchema as z.ZodType<unknown>, moduleName: 'crdt-collaboration' },
  ];

  for (const { key, schema, moduleName } of moduleValidations) {
    const value = config[key];
    if (value === undefined) continue;

    const result = schema.safeParse(value);
    if (result.success) {
      resolutions.push({
        value: result.data,
        source: 'file',
        key: String(key),
      });
    } else {
      errors.push({
        module: moduleName,
        field: String(key),
        message: result.error.message,
        source: 'file',
      });
    }
  }

  // Track options overrides
  if (config.options) {
    for (const [key, value] of Object.entries(config.options)) {
      resolutions.push({
        value,
        source: 'file',
        key,
      });
    }
  }

  return { config, resolutions, errors };
}

// ============================================================================
// Config Resolver
// ============================================================================

/**
 * Resolve final RalphLoopOptions by merging 3 sources (highest priority first):
 * 1. Environment variables (NOVA26_*)
 * 2. Config file (.nova/config.json)
 * 3. Hardcoded defaults
 *
 * @param fileConfig - Parsed config file content (null if no file found)
 * @param env - Environment variables (defaults to process.env)
 * @returns Resolved options with source tracking
 */
export function resolveConfig(
  fileConfig: unknown | null = null,
  env: Record<string, string | undefined> = process.env
): ConfigResolverResult {
  const allResolutions: ConfigResolution<unknown>[] = [];
  const allErrors: ConfigValidationError[] = [];
  const sources = { env: 0, file: 0, defaults: 0 };

  // Layer 1: Start with defaults
  let merged: Partial<RalphLoopOptions> = { ...DEFAULT_RALPH_LOOP_OPTIONS };

  // Count defaults
  sources.defaults = Object.keys(DEFAULT_RALPH_LOOP_OPTIONS).length;

  // Layer 2: Merge config file
  if (fileConfig !== null) {
    const { config, resolutions, errors } = parseConfigFile(fileConfig);
    allResolutions.push(...resolutions);
    allErrors.push(...errors);

    if (config.options) {
      merged = { ...merged, ...config.options };
      sources.file = Object.keys(config.options).length;
    }

    // Map module configs to RalphLoopOptions fields
    if (config.modelRoutingConfig) {
      merged.modelRoutingConfig = config.modelRoutingConfig as RalphLoopOptions['modelRoutingConfig'];
    }
    if (config.perplexityConfig) {
      merged.perplexityConfig = config.perplexityConfig as RalphLoopOptions['perplexityConfig'];
    }
    if (config.workflowEngineConfig) {
      merged.workflowEngineConfig = config.workflowEngineConfig as RalphLoopOptions['workflowEngineConfig'];
    }
    if (config.infiniteMemoryConfig) {
      merged.infiniteMemoryConfig = config.infiniteMemoryConfig as RalphLoopOptions['infiniteMemoryConfig'];
    }
    if (config.cinematicObservabilityConfig) {
      merged.cinematicObservabilityConfig = config.cinematicObservabilityConfig as RalphLoopOptions['cinematicObservabilityConfig'];
    }
    if (config.aiModelDatabaseConfig) {
      merged.aiModelDatabaseConfig = config.aiModelDatabaseConfig as RalphLoopOptions['aiModelDatabaseConfig'];
    }
    if (config.crdtCollaborationConfig) {
      merged.crdtCollaborationConfig = config.crdtCollaborationConfig as RalphLoopOptions['crdtCollaborationConfig'];
    }
  }

  // Layer 3: Merge env vars (highest priority)
  const { overrides, resolutions: envResolutions } = readEnvOverrides(env);
  allResolutions.push(...envResolutions);
  sources.env = envResolutions.length;

  merged = { ...merged, ...overrides };

  return {
    options: merged,
    resolutions: allResolutions,
    errors: allErrors,
    sources,
  };
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Get a human-readable summary of the resolved configuration.
 */
export function getConfigSummary(result: ConfigResolverResult): string {
  const lines: string[] = [];
  lines.push('=== Nova26 Config Resolution ===');
  lines.push(`Sources: ${result.sources.env} env, ${result.sources.file} file, ${result.sources.defaults} defaults`);
  lines.push(`Errors: ${result.errors.length}`);
  lines.push('');

  // Enabled features
  const features = [
    'modelRoutingEnabled', 'perplexityEnabled', 'workflowEngineEnabled',
    'infiniteMemoryEnabled', 'cinematicObservabilityEnabled',
    'aiModelDatabaseEnabled', 'crdtCollaborationEnabled',
  ] as const;

  lines.push('Features:');
  for (const feat of features) {
    const val = result.options[feat];
    lines.push(`  ${feat}: ${val ? 'ON' : 'OFF'}`);
  }

  if (result.errors.length > 0) {
    lines.push('');
    lines.push('Errors:');
    for (const err of result.errors) {
      lines.push(`  [${err.source}] ${err.module}.${err.field}: ${err.message}`);
    }
  }

  return lines.join('\n');
}

/**
 * Get list of enabled feature module names.
 */
export function getEnabledFeatures(options: Partial<RalphLoopOptions>): string[] {
  const features: Array<{ key: keyof RalphLoopOptions; name: string }> = [
    { key: 'modelRoutingEnabled', name: 'model-routing' },
    { key: 'perplexityEnabled', name: 'perplexity' },
    { key: 'workflowEngineEnabled', name: 'workflow-engine' },
    { key: 'infiniteMemoryEnabled', name: 'infinite-memory' },
    { key: 'cinematicObservabilityEnabled', name: 'cinematic-observability' },
    { key: 'aiModelDatabaseEnabled', name: 'ai-model-database' },
    { key: 'crdtCollaborationEnabled', name: 'crdt-collaboration' },
    { key: 'portfolioEnabled', name: 'portfolio' },
    { key: 'agentMemoryEnabled', name: 'agent-memory' },
    { key: 'generativeUIEnabled', name: 'generative-ui' },
    { key: 'autonomousTestingEnabled', name: 'autonomous-testing' },
    { key: 'wellbeingEnabled', name: 'wellbeing' },
    { key: 'advancedRecoveryEnabled', name: 'advanced-recovery' },
    { key: 'advancedInitEnabled', name: 'advanced-init' },
  ];

  return features
    .filter(f => options[f.key] === true)
    .map(f => f.name);
}
