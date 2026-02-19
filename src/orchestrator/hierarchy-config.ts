// Hierarchy Configuration — R20-01
// Config validation, defaults, and backward compatibility

import type {
  OrchestratorHierarchyConfig,
  LayerConfig,
  EscalationPolicy,
} from './hierarchy-types.js';

export const DEFAULT_HIERARCHY_CONFIG: OrchestratorHierarchyConfig = {
  enabled: false,
  layers: [
    {
      level: 0,
      supervisorAgent: 'sun',
      workers: ['sun'],
      maxConcurrency: 1,
      timeoutMs: 30000,
      maxRetries: 2,
    },
    {
      level: 1,
      supervisorAgent: 'sun',
      workers: ['sun', 'jupiter', 'mercury'],
      maxConcurrency: 3,
      timeoutMs: 60000,
      maxRetries: 2,
    },
    {
      level: 2,
      supervisorAgent: 'mercury',
      workers: ['mercury', 'venus', 'mars', 'saturn'],
      maxConcurrency: 5,
      timeoutMs: 120000,
      maxRetries: 3,
    },
    {
      level: 3,
      supervisorAgent: 'mercury',
      workers: ['sandbox'],
      maxConcurrency: 10,
      timeoutMs: 30000,
      maxRetries: 5,
    },
  ],
  escalationPolicy: 'threshold-based',
  defaultMaxRetries: 3,
  globalTimeoutMs: 300000,
  backwardCompatibilityMode: true,
  observabilityLevel: 'standard',
};

export const DEFAULT_ESCALATION_POLICY: EscalationPolicy = {
  mode: 'threshold-based',
  thresholds: {
    maxRetriesPerLayer: 3,
    confidenceThreshold: 0.7,
    successRateThreshold: 0.5,
  },
  autoEscalateOn: ['timeout', 'failure'],
};

export function validateHierarchyConfig(
  config: Partial<OrchestratorHierarchyConfig>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check layers
  if (config.layers !== undefined) {
    if (!Array.isArray(config.layers)) {
      errors.push('layers must be an array');
    } else {
      // Check for duplicate levels
      const levels = config.layers.map(l => l.level);
      const uniqueLevels = new Set(levels);
      if (uniqueLevels.size !== levels.length) {
        errors.push('duplicate layer levels detected');
      }

      // Check each layer
      for (const layer of config.layers) {
        if (![0, 1, 2, 3].includes(layer.level)) {
          errors.push(`invalid layer level: ${layer.level}`);
        }
        if (!layer.supervisorAgent) {
          errors.push(`layer ${layer.level} missing supervisorAgent`);
        }
        if (!Array.isArray(layer.workers) || layer.workers.length === 0) {
          errors.push(`layer ${layer.level} must have at least one worker`);
        }
        if (layer.maxConcurrency <= 0) {
          errors.push(`layer ${layer.level} maxConcurrency must be positive`);
        }
        if (layer.timeoutMs <= 0) {
          errors.push(`layer ${layer.level} timeoutMs must be positive`);
        }
      }

      // Check for missing layer levels
      for (const expectedLevel of [0, 1, 2, 3] as const) {
        if (!levels.includes(expectedLevel)) {
          errors.push(`missing layer level: ${expectedLevel}`);
        }
      }
    }
  }

  // Check escalation policy
  if (config.escalationPolicy !== undefined) {
    const validPolicies = ['auto', 'manual', 'threshold-based'];
    if (!validPolicies.includes(config.escalationPolicy)) {
      errors.push(`invalid escalationPolicy: ${config.escalationPolicy}`);
    }
  }

  // Check observability level
  if (config.observabilityLevel !== undefined) {
    const validLevels = ['minimal', 'standard', 'verbose'];
    if (!validLevels.includes(config.observabilityLevel)) {
      errors.push(`invalid observabilityLevel: ${config.observabilityLevel}`);
    }
  }

  // Check timeout values
  if (config.globalTimeoutMs !== undefined && config.globalTimeoutMs <= 0) {
    errors.push('globalTimeoutMs must be positive');
  }

  if (config.defaultMaxRetries !== undefined && config.defaultMaxRetries < 0) {
    errors.push('defaultMaxRetries must be non-negative');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function mergeHierarchyConfig(
  userConfig: Partial<OrchestratorHierarchyConfig>
): OrchestratorHierarchyConfig {
  return {
    ...DEFAULT_HIERARCHY_CONFIG,
    ...userConfig,
    layers: userConfig.layers ?? DEFAULT_HIERARCHY_CONFIG.layers,
  };
}

export function getLayerConfig(
  config: OrchestratorHierarchyConfig,
  level: number
): LayerConfig | undefined {
  return config.layers.find(l => l.level === level);
}

export function isLayerEnabled(
  config: OrchestratorHierarchyConfig,
  level: number
): boolean {
  if (config.backwardCompatibilityMode) {
    // In backward compat mode, only L2 is used
    return level === 2;
  }
  return config.enabled && config.layers.some(l => l.level === level);
}

export function shouldUseFlatMode(config: OrchestratorHierarchyConfig): boolean {
  return config.backwardCompatibilityMode || !config.enabled;
}

export function createFlatModeConfig(): OrchestratorHierarchyConfig {
  return {
    ...DEFAULT_HIERARCHY_CONFIG,
    enabled: false,
    backwardCompatibilityMode: true,
    layers: DEFAULT_HIERARCHY_CONFIG.layers.filter(l => l.level === 2),
  };
}
