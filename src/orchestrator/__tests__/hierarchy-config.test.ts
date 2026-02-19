import { describe, it, expect } from 'vitest';
import type {
  OrchestratorHierarchyConfig,
  LayerConfig,
} from '../hierarchy-types.js';
import {
  validateHierarchyConfig,
  mergeHierarchyConfig,
  getLayerConfig,
  isLayerEnabled,
  shouldUseFlatMode,
  createFlatModeConfig,
  DEFAULT_HIERARCHY_CONFIG,
  DEFAULT_ESCALATION_POLICY,
} from '../hierarchy-config.js';

describe('Hierarchy Config Validation', () => {
  it('returns valid for good config', () => {
    const validLayers: LayerConfig[] = [
      { level: 0, supervisorAgent: 'sun', workers: ['sun'], maxConcurrency: 1, timeoutMs: 30000, maxRetries: 2 },
      { level: 1, supervisorAgent: 'sun', workers: ['sun', 'jupiter'], maxConcurrency: 3, timeoutMs: 60000, maxRetries: 2 },
      { level: 2, supervisorAgent: 'mercury', workers: ['mercury', 'venus'], maxConcurrency: 5, timeoutMs: 120000, maxRetries: 3 },
      { level: 3, supervisorAgent: 'mercury', workers: ['sandbox'], maxConcurrency: 10, timeoutMs: 30000, maxRetries: 5 },
    ];

    const config: Partial<OrchestratorHierarchyConfig> = {
      enabled: true,
      layers: validLayers,
      escalationPolicy: 'threshold-based',
    };

    const result = validateHierarchyConfig(config);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('detects duplicate layer levels', () => {
    const duplicateLayers: LayerConfig[] = [
      { level: 0, supervisorAgent: 'sun', workers: ['sun'], maxConcurrency: 1, timeoutMs: 30000, maxRetries: 2 },
      { level: 0, supervisorAgent: 'sun', workers: ['sun'], maxConcurrency: 1, timeoutMs: 30000, maxRetries: 2 },
      { level: 2, supervisorAgent: 'mercury', workers: ['mercury'], maxConcurrency: 5, timeoutMs: 120000, maxRetries: 3 },
      { level: 3, supervisorAgent: 'mercury', workers: ['sandbox'], maxConcurrency: 10, timeoutMs: 30000, maxRetries: 5 },
    ];

    const config: Partial<OrchestratorHierarchyConfig> = {
      layers: duplicateLayers,
    };

    const result = validateHierarchyConfig(config);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('duplicate layer levels detected');
  });

  it('detects missing layers', () => {
    const incompleteLayers: LayerConfig[] = [
      { level: 0, supervisorAgent: 'sun', workers: ['sun'], maxConcurrency: 1, timeoutMs: 30000, maxRetries: 2 },
      { level: 2, supervisorAgent: 'mercury', workers: ['mercury'], maxConcurrency: 5, timeoutMs: 120000, maxRetries: 3 },
      { level: 3, supervisorAgent: 'mercury', workers: ['sandbox'], maxConcurrency: 10, timeoutMs: 30000, maxRetries: 5 },
    ];

    const config: Partial<OrchestratorHierarchyConfig> = {
      layers: incompleteLayers,
    };

    const result = validateHierarchyConfig(config);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('missing layer level: 1');
  });

  it('validates escalation policy', () => {
    const validLayers: LayerConfig[] = [
      { level: 0, supervisorAgent: 'sun', workers: ['sun'], maxConcurrency: 1, timeoutMs: 30000, maxRetries: 2 },
      { level: 1, supervisorAgent: 'sun', workers: ['sun'], maxConcurrency: 3, timeoutMs: 60000, maxRetries: 2 },
      { level: 2, supervisorAgent: 'mercury', workers: ['mercury'], maxConcurrency: 5, timeoutMs: 120000, maxRetries: 3 },
      { level: 3, supervisorAgent: 'mercury', workers: ['sandbox'], maxConcurrency: 10, timeoutMs: 30000, maxRetries: 5 },
    ];

    const configWithInvalidPolicy: Partial<OrchestratorHierarchyConfig> = {
      layers: validLayers,
      escalationPolicy: 'invalid-policy' as 'auto' | 'manual' | 'threshold-based',
    };

    const result = validateHierarchyConfig(configWithInvalidPolicy);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('invalid escalationPolicy: invalid-policy');
  });
});

describe('Hierarchy Config Defaults', () => {
  it('DEFAULT_HIERARCHY_CONFIG has all 4 layers', () => {
    expect(DEFAULT_HIERARCHY_CONFIG.layers).toHaveLength(4);

    const levels = DEFAULT_HIERARCHY_CONFIG.layers.map(l => l.level);
    expect(levels).toContain(0);
    expect(levels).toContain(1);
    expect(levels).toContain(2);
    expect(levels).toContain(3);

    expect(DEFAULT_HIERARCHY_CONFIG.layers[0].level).toBe(0);
    expect(DEFAULT_HIERARCHY_CONFIG.layers[1].level).toBe(1);
    expect(DEFAULT_HIERARCHY_CONFIG.layers[2].level).toBe(2);
    expect(DEFAULT_HIERARCHY_CONFIG.layers[3].level).toBe(3);
  });

  it('mergeHierarchyConfig applies user config', () => {
    const userConfig: Partial<OrchestratorHierarchyConfig> = {
      enabled: true,
      globalTimeoutMs: 600000,
      observabilityLevel: 'verbose',
    };

    const merged = mergeHierarchyConfig(userConfig);

    expect(merged.enabled).toBe(true);
    expect(merged.globalTimeoutMs).toBe(600000);
    expect(merged.observabilityLevel).toBe('verbose');
    expect(merged.layers).toEqual(DEFAULT_HIERARCHY_CONFIG.layers);
    expect(merged.backwardCompatibilityMode).toBe(DEFAULT_HIERARCHY_CONFIG.backwardCompatibilityMode);
  });

  it('respects backwardCompatibilityMode', () => {
    const userConfig: Partial<OrchestratorHierarchyConfig> = {
      backwardCompatibilityMode: false,
      enabled: true,
    };

    const merged = mergeHierarchyConfig(userConfig);

    expect(merged.backwardCompatibilityMode).toBe(false);
    expect(merged.enabled).toBe(true);
  });
});

describe('Backward Compatibility', () => {
  it('shouldUseFlatMode returns true for backwardCompat', () => {
    const backwardCompatConfig: OrchestratorHierarchyConfig = {
      ...DEFAULT_HIERARCHY_CONFIG,
      backwardCompatibilityMode: true,
      enabled: false,
    };

    expect(shouldUseFlatMode(backwardCompatConfig)).toBe(true);
  });

  it('shouldUseFlatMode returns true when hierarchy is disabled', () => {
    const disabledConfig: OrchestratorHierarchyConfig = {
      ...DEFAULT_HIERARCHY_CONFIG,
      backwardCompatibilityMode: false,
      enabled: false,
    };

    expect(shouldUseFlatMode(disabledConfig)).toBe(true);
  });

  it('shouldUseFlatMode returns false when hierarchy is enabled and not backwardCompat', () => {
    const enabledConfig: OrchestratorHierarchyConfig = {
      ...DEFAULT_HIERARCHY_CONFIG,
      backwardCompatibilityMode: false,
      enabled: true,
    };

    expect(shouldUseFlatMode(enabledConfig)).toBe(false);
  });

  it('createFlatModeConfig returns L2 only', () => {
    const flatConfig = createFlatModeConfig();

    expect(flatConfig.layers).toHaveLength(1);
    expect(flatConfig.layers[0].level).toBe(2);
    expect(flatConfig.enabled).toBe(false);
    expect(flatConfig.backwardCompatibilityMode).toBe(true);
  });

  it('isLayerEnabled returns false for non-L2 in flat mode', () => {
    const flatConfig = createFlatModeConfig();

    expect(isLayerEnabled(flatConfig, 0)).toBe(false);
    expect(isLayerEnabled(flatConfig, 1)).toBe(false);
    expect(isLayerEnabled(flatConfig, 2)).toBe(true);
    expect(isLayerEnabled(flatConfig, 3)).toBe(false);
  });

  it('enabled flag works correctly in flat mode', () => {
    const flatConfig = createFlatModeConfig();

    expect(flatConfig.enabled).toBe(false);
    expect(shouldUseFlatMode(flatConfig)).toBe(true);
  });
});

describe('Layer Config', () => {
  it('getLayerConfig finds correct layer', () => {
    const layer0 = getLayerConfig(DEFAULT_HIERARCHY_CONFIG, 0);
    expect(layer0).toBeDefined();
    expect(layer0?.level).toBe(0);
    expect(layer0?.supervisorAgent).toBe('sun');

    const layer2 = getLayerConfig(DEFAULT_HIERARCHY_CONFIG, 2);
    expect(layer2).toBeDefined();
    expect(layer2?.level).toBe(2);
    expect(layer2?.supervisorAgent).toBe('mercury');
  });

  it('getLayerConfig returns undefined for invalid level', () => {
    const invalidLayer = getLayerConfig(DEFAULT_HIERARCHY_CONFIG, 999);
    expect(invalidLayer).toBeUndefined();

    const negativeLayer = getLayerConfig(DEFAULT_HIERARCHY_CONFIG, -1);
    expect(negativeLayer).toBeUndefined();
  });

  it('validates layer structure', () => {
    const validLayers: LayerConfig[] = [
      { level: 0, supervisorAgent: 'sun', workers: ['sun'], maxConcurrency: 1, timeoutMs: 30000, maxRetries: 2 },
      { level: 1, supervisorAgent: 'sun', workers: ['sun', 'jupiter'], maxConcurrency: 3, timeoutMs: 60000, maxRetries: 2 },
      { level: 2, supervisorAgent: 'mercury', workers: ['mercury', 'venus', 'mars', 'saturn'], maxConcurrency: 5, timeoutMs: 120000, maxRetries: 3 },
      { level: 3, supervisorAgent: 'mercury', workers: ['sandbox'], maxConcurrency: 10, timeoutMs: 30000, maxRetries: 5 },
    ];

    validLayers.forEach(layer => {
      expect(layer.level).toBeGreaterThanOrEqual(0);
      expect(layer.level).toBeLessThanOrEqual(3);
      expect(typeof layer.supervisorAgent).toBe('string');
      expect(layer.supervisorAgent.length).toBeGreaterThan(0);
      expect(Array.isArray(layer.workers)).toBe(true);
      expect(layer.workers.length).toBeGreaterThan(0);
      expect(layer.maxConcurrency).toBeGreaterThan(0);
      expect(layer.timeoutMs).toBeGreaterThan(0);
      expect(layer.maxRetries).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('DEFAULT_ESCALATION_POLICY', () => {
  it('has correct default values', () => {
    expect(DEFAULT_ESCALATION_POLICY.mode).toBe('threshold-based');
    expect(DEFAULT_ESCALATION_POLICY.thresholds.maxRetriesPerLayer).toBe(3);
    expect(DEFAULT_ESCALATION_POLICY.thresholds.confidenceThreshold).toBe(0.7);
    expect(DEFAULT_ESCALATION_POLICY.thresholds.successRateThreshold).toBe(0.5);
    expect(DEFAULT_ESCALATION_POLICY.autoEscalateOn).toContain('timeout');
    expect(DEFAULT_ESCALATION_POLICY.autoEscalateOn).toContain('failure');
  });
});
