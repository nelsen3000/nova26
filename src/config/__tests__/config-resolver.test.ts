import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  resolveConfig,
  readEnvOverrides,
  parseConfigFile,
  getConfigSummary,
  getEnabledFeatures,
  DEFAULT_RALPH_LOOP_OPTIONS,
} from '../config-resolver.js';

describe('Config Resolver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================
  // Default Values
  // ============================================================

  it('should return defaults when no env or file config provided', () => {
    const result = resolveConfig(null, {});

    expect(result.options.parallelMode).toBe(false);
    expect(result.options.concurrency).toBe(1);
    expect(result.options.autoTestFix).toBe(true);
    expect(result.options.maxTestRetries).toBe(3);
    expect(result.options.planApproval).toBe(true);
    expect(result.options.modelRoutingEnabled).toBe(false);
    expect(result.errors).toHaveLength(0);
  });

  it('should have all feature flags disabled by default', () => {
    const result = resolveConfig(null, {});

    expect(result.options.modelRoutingEnabled).toBe(false);
    expect(result.options.perplexityEnabled).toBe(false);
    expect(result.options.workflowEngineEnabled).toBe(false);
    expect(result.options.infiniteMemoryEnabled).toBe(false);
    expect(result.options.cinematicObservabilityEnabled).toBe(false);
    expect(result.options.aiModelDatabaseEnabled).toBe(false);
    expect(result.options.crdtCollaborationEnabled).toBe(false);
  });

  it('should track defaults count in sources', () => {
    const result = resolveConfig(null, {});
    expect(result.sources.defaults).toBe(Object.keys(DEFAULT_RALPH_LOOP_OPTIONS).length);
    expect(result.sources.env).toBe(0);
    expect(result.sources.file).toBe(0);
  });

  // ============================================================
  // Environment Variable Overrides
  // ============================================================

  it('should read boolean env vars (true/false)', () => {
    const env = {
      NOVA26_MODEL_ROUTING: 'true',
      NOVA26_PERPLEXITY: 'false',
    };

    const result = resolveConfig(null, env);
    expect(result.options.modelRoutingEnabled).toBe(true);
    expect(result.options.perplexityEnabled).toBe(false);
  });

  it('should read boolean env vars (1/0)', () => {
    const env = {
      NOVA26_WORKFLOW_ENGINE: '1',
      NOVA26_INFINITE_MEMORY: '0',
    };

    const result = resolveConfig(null, env);
    expect(result.options.workflowEngineEnabled).toBe(true);
    expect(result.options.infiniteMemoryEnabled).toBe(false);
  });

  it('should read boolean env vars (yes/no)', () => {
    const env = {
      NOVA26_CINEMATIC_OBSERVABILITY: 'yes',
      NOVA26_AI_MODEL_DATABASE: 'no',
    };

    const result = resolveConfig(null, env);
    expect(result.options.cinematicObservabilityEnabled).toBe(true);
    expect(result.options.aiModelDatabaseEnabled).toBe(false);
  });

  it('should read numeric env vars', () => {
    const env = {
      NOVA26_CONCURRENCY: '4',
      NOVA26_MAX_TEST_RETRIES: '5',
      NOVA26_BUDGET_LIMIT: '100.50',
    };

    const result = resolveConfig(null, env);
    expect(result.options.concurrency).toBe(4);
    expect(result.options.maxTestRetries).toBe(5);
    expect(result.options.budgetLimit).toBe(100.50);
  });

  it('should ignore invalid numeric env vars', () => {
    const env = {
      NOVA26_CONCURRENCY: 'not-a-number',
    };

    const result = resolveConfig(null, env);
    expect(result.options.concurrency).toBe(1); // Falls back to default
  });

  it('should ignore unknown env vars', () => {
    const env = {
      NOVA26_UNKNOWN_FEATURE: 'true',
      NOT_NOVA26: 'true',
    };

    const result = resolveConfig(null, env);
    expect(result.sources.env).toBe(0);
  });

  it('should track env resolutions', () => {
    const env = {
      NOVA26_MODEL_ROUTING: 'true',
      NOVA26_PARALLEL_MODE: 'true',
    };

    const result = resolveConfig(null, env);
    expect(result.sources.env).toBe(2);
    expect(result.resolutions.filter(r => r.source === 'env')).toHaveLength(2);
  });

  // ============================================================
  // Config File Parsing
  // ============================================================

  it('should parse valid config file options', () => {
    const fileConfig = {
      options: {
        parallelMode: true,
        concurrency: 8,
        modelRoutingEnabled: true,
      },
    };

    const result = resolveConfig(fileConfig, {});
    expect(result.options.parallelMode).toBe(true);
    expect(result.options.concurrency).toBe(8);
    expect(result.options.modelRoutingEnabled).toBe(true);
    expect(result.sources.file).toBe(3);
  });

  it('should validate module configs from file', () => {
    const fileConfig = {
      perplexityConfig: {
        enabled: true,
        model: 'sonar-pro',
        maxTokens: 4096,
        temperature: 0.7,
        cacheEnabled: true,
        cacheTtlSeconds: 3600,
        researchKeywords: ['research', 'analyze'],
      },
    };

    const result = resolveConfig(fileConfig, {});
    expect(result.options.perplexityConfig).toBeDefined();
    expect(result.errors).toHaveLength(0);
  });

  it('should report errors for invalid module configs in file', () => {
    const fileConfig = {
      perplexityConfig: {
        enabled: 'not-a-boolean', // Invalid type
        maxTokens: -1, // Must be positive
      },
    };

    const result = resolveConfig(fileConfig, {});
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].module).toBe('perplexity');
    expect(result.errors[0].source).toBe('file');
  });

  it('should handle empty config file', () => {
    const result = resolveConfig({}, {});
    expect(result.options.parallelMode).toBe(false); // Falls back to default
    expect(result.errors).toHaveLength(0);
  });

  it('should handle null config file gracefully', () => {
    const result = resolveConfig(null, {});
    expect(result.options).toBeDefined();
    expect(result.errors).toHaveLength(0);
  });

  it('should report error for completely invalid config file', () => {
    // A non-object value
    const result = parseConfigFile('not-an-object');
    expect(result.errors.length).toBeGreaterThan(0);
  });

  // ============================================================
  // Priority Ordering: Env > File > Defaults
  // ============================================================

  it('should let env override file config', () => {
    const fileConfig = {
      options: {
        parallelMode: false,
        concurrency: 2,
      },
    };
    const env = {
      NOVA26_PARALLEL_MODE: 'true',
      NOVA26_CONCURRENCY: '16',
    };

    const result = resolveConfig(fileConfig, env);
    expect(result.options.parallelMode).toBe(true);  // Env wins
    expect(result.options.concurrency).toBe(16);       // Env wins
  });

  it('should let file override defaults', () => {
    const fileConfig = {
      options: {
        maxTestRetries: 10,
        planApproval: false,
      },
    };

    const result = resolveConfig(fileConfig, {});
    expect(result.options.maxTestRetries).toBe(10);   // File wins over default 3
    expect(result.options.planApproval).toBe(false);   // File wins over default true
  });

  it('should let env override file override defaults', () => {
    const fileConfig = {
      options: {
        concurrency: 4,       // File overrides default (1)
        autoTestFix: false,    // File overrides default (true)
      },
    };
    const env = {
      NOVA26_CONCURRENCY: '8', // Env overrides file (4) and default (1)
    };

    const result = resolveConfig(fileConfig, env);
    expect(result.options.concurrency).toBe(8);       // Env wins
    expect(result.options.autoTestFix).toBe(false);    // File wins over default
    expect(result.options.maxTestRetries).toBe(3);     // Default used
  });

  // ============================================================
  // readEnvOverrides (standalone)
  // ============================================================

  it('should extract env overrides as standalone function', () => {
    const env = {
      NOVA26_MODEL_ROUTING: 'true',
      NOVA26_CONCURRENCY: '4',
      UNRELATED_VAR: 'ignored',
    };

    const { overrides, resolutions } = readEnvOverrides(env);
    expect(overrides.modelRoutingEnabled).toBe(true);
    expect(overrides.concurrency).toBe(4);
    expect(resolutions).toHaveLength(2);
  });

  // ============================================================
  // parseConfigFile (standalone)
  // ============================================================

  it('should parse config file with module configs', () => {
    const raw = {
      options: { parallelMode: true },
      infiniteMemoryConfig: {
        enabled: true,
        maxNodes: 5000,
        pruneAfterDays: 7,
        defaultTasteScore: 0.6,
        autoClassify: true,
        enableHierarchy: true,
        maxQueryTimeMs: 40,
        defaultTasteThreshold: 0.5,
      },
    };

    const { config, resolutions, errors } = parseConfigFile(raw);
    expect(config.options).toEqual({ parallelMode: true });
    expect(errors).toHaveLength(0);
    expect(resolutions.length).toBeGreaterThan(0);
  });

  // ============================================================
  // getConfigSummary
  // ============================================================

  it('should generate human-readable config summary', () => {
    const result = resolveConfig(null, {
      NOVA26_MODEL_ROUTING: 'true',
      NOVA26_CINEMATIC_OBSERVABILITY: 'true',
    });

    const summary = getConfigSummary(result);
    expect(summary).toContain('Nova26 Config Resolution');
    expect(summary).toContain('modelRoutingEnabled: ON');
    expect(summary).toContain('cinematicObservabilityEnabled: ON');
    expect(summary).toContain('perplexityEnabled: OFF');
  });

  it('should include errors in summary when present', () => {
    const result = resolveConfig({
      perplexityConfig: { enabled: 'invalid' },
    }, {});

    const summary = getConfigSummary(result);
    expect(summary).toContain('Errors:');
    expect(summary).toContain('perplexity');
  });

  // ============================================================
  // getEnabledFeatures
  // ============================================================

  it('should return list of enabled features', () => {
    const result = resolveConfig(null, {
      NOVA26_MODEL_ROUTING: 'true',
      NOVA26_PERPLEXITY: 'true',
      NOVA26_WELLBEING: 'true',
    });

    const enabled = getEnabledFeatures(result.options);
    expect(enabled).toContain('model-routing');
    expect(enabled).toContain('perplexity');
    expect(enabled).toContain('wellbeing');
    expect(enabled).not.toContain('workflow-engine');
  });

  it('should return empty list when no features enabled', () => {
    const result = resolveConfig(null, {});
    const enabled = getEnabledFeatures(result.options);
    expect(enabled).toHaveLength(0);
  });
});
