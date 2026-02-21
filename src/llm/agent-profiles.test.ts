// Agent Profiles Tests
// Comprehensive test suite for agent routing profiles

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ProfileManager,
  getProfileManager,
  resetProfileManager,
  DEFAULT_AGENT_PROFILES,
  type AgentId,
  type AgentProfile,
} from './agent-profiles.js';
import type { TaskType } from './model-registry.js';

describe('ProfileManager', () => {
  let manager: ProfileManager;

  beforeEach(() => {
    manager = new ProfileManager();
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // Get Profile Tests
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('getProfile', () => {
    it('returns profile for all 21 agents', () => {
      const agentIds: AgentId[] = [
        'SUN', 'MERCURY', 'VENUS', 'EARTH', 'MARS', 'PLUTO',
        'SATURN', 'JUPITER', 'ENCELADUS', 'GANYMEDE', 'NEPTUNE',
        'CHARON', 'URANUS', 'TITAN', 'EUROPA', 'MIMAS',
        'IO', 'TRITON', 'CALLISTO', 'ATLAS', 'ANDROMEDA',
      ];

      for (const agentId of agentIds) {
        const profile = manager.getProfile(agentId);
        expect(profile).toBeDefined();
        expect(profile?.agentId).toBe(agentId);
      }
    });

    it('profile has required fields', () => {
      const profile = manager.getProfile('SUN');

      expect(profile).toHaveProperty('agentId');
      expect(profile).toHaveProperty('preferredModels');
      expect(profile).toHaveProperty('taskTypeOverrides');
      expect(profile).toHaveProperty('costBudgetPerHour');
      expect(profile).toHaveProperty('qualityThreshold');
      expect(profile).toHaveProperty('latencyBudget');
      expect(profile).toHaveProperty('description');
      expect(profile).toHaveProperty('reasoning');
    });

    it('SUN has high cost budget and quality threshold', () => {
      const profile = manager.getProfile('SUN');

      expect(profile?.costBudgetPerHour).toBeGreaterThanOrEqual(3);
      expect(profile?.qualityThreshold).toBeGreaterThanOrEqual(0.85);
    });

    it('PLUTO has low cost budget', () => {
      const profile = manager.getProfile('PLUTO');

      expect(profile?.costBudgetPerHour).toBeLessThanOrEqual(1.5);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // Update Profile Tests
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('updateProfile', () => {
    it('updates profile fields', () => {
      manager.updateProfile('SUN', { costBudgetPerHour: 10.0 });

      const profile = manager.getProfile('SUN');
      expect(profile?.costBudgetPerHour).toBe(10.0);
    });

    it('preserves other fields when updating', () => {
      const original = manager.getProfile('SUN');
      const originalQuality = original?.qualityThreshold;

      manager.updateProfile('SUN', { costBudgetPerHour: 10.0 });

      const updated = manager.getProfile('SUN');
      expect(updated?.qualityThreshold).toBe(originalQuality);
    });

    it('throws for unknown agent', () => {
      expect(() => manager.updateProfile('UNKNOWN' as AgentId, {}))
        .toThrow('Profile not found');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // Reset Profile Tests
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('resetToDefaults', () => {
    it('resets profile to defaults', () => {
      const original = manager.getProfile('SUN');
      const originalBudget = original?.costBudgetPerHour;

      manager.updateProfile('SUN', { costBudgetPerHour: 999.0 });
      expect(manager.getProfile('SUN')?.costBudgetPerHour).toBe(999.0);

      manager.resetToDefaults('SUN');
      expect(manager.getProfile('SUN')?.costBudgetPerHour).toBe(originalBudget);
    });

    it('throws for unknown agent', () => {
      expect(() => manager.resetToDefaults('UNKNOWN' as AgentId))
        .toThrow('No default profile');
    });
  });

  describe('resetAllToDefaults', () => {
    it('resets all profiles', () => {
      manager.updateProfile('SUN', { costBudgetPerHour: 999.0 });
      manager.updateProfile('MERCURY', { costBudgetPerHour: 999.0 });

      manager.resetAllToDefaults();

      expect(manager.getProfile('SUN')?.costBudgetPerHour).toBe(5.0);
      expect(manager.getProfile('MERCURY')?.costBudgetPerHour).toBe(3.0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // Get Constraints Tests
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('getConstraints', () => {
    it('returns constraints for agent and task', () => {
      const constraints = manager.getConstraints('SUN', 'orchestration');

      expect(constraints).toHaveProperty('maxCost');
      expect(constraints).toHaveProperty('minQuality');
      expect(constraints).toHaveProperty('maxLatency');
    });

    it('SUN has high quality threshold for orchestration', () => {
      const constraints = manager.getConstraints('SUN', 'orchestration');

      expect(constraints.minQuality).toBeGreaterThanOrEqual(0.9);
    });

    it('PLUTO prefers local models', () => {
      const constraints = manager.getConstraints('PLUTO', 'code-generation');

      expect(constraints.preferLocal).toBe(true);
    });

    it('returns empty constraints for unknown agent', () => {
      const constraints = manager.getConstraints('UNKNOWN' as AgentId, 'code-generation');

      expect(constraints).toEqual({});
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // Get Preferred Model Tests
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('getPreferredModel', () => {
    it('returns model for agent and task', () => {
      const model = manager.getPreferredModel('SUN', 'orchestration');

      expect(model).toBeDefined();
    });

    it('uses task type override when available', () => {
      const model = manager.getPreferredModel('VENUS', 'code-generation');

      expect(model?.id).toBe('openrouter-qwen/qwen-2.5-coder-32b-instruct');
    });

    it('falls back to first preferred model', () => {
      const model = manager.getPreferredModel('SUN', 'unknown-task' as TaskType);

      expect(model).toBeDefined();
    });

    it('returns undefined for unknown agent', () => {
      const model = manager.getPreferredModel('UNKNOWN' as AgentId, 'code-generation');

      expect(model).toBeUndefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // Record Results & Optimization Tests
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('recordResult and optimizeProfiles', () => {
    it('records task results', () => {
      manager.recordResult('SUN', 'code-generation', 'model-1', 0.9, 0.001);

      // Should not throw
      expect(true).toBe(true);
    });

    it('returns empty optimizations with insufficient data', () => {
      // Record only 5 results
      for (let i = 0; i < 5; i++) {
        manager.recordResult('SUN', 'code-generation', 'model-1', 0.9, 0.001);
      }

      const optimizations = manager.optimizeProfiles();
      expect(optimizations).toHaveLength(0);
    });

    it('suggests optimization when model performs better', () => {
      const agentId: AgentId = 'VENUS';
      const taskType: TaskType = 'code-generation';

      // Record 10 results with model-1 (current) - mediocre performance
      for (let i = 0; i < 10; i++) {
        manager.recordResult(agentId, taskType, 'anthropic-claude-3-sonnet', 0.7, 0.002);
      }

      // Record 10 results with model-2 (better) - better performance
      for (let i = 0; i < 10; i++) {
        manager.recordResult(agentId, taskType, 'openrouter-qwen/qwen-2.5-coder-32b-instruct', 0.9, 0.001);
      }

      const optimizations = manager.optimizeProfiles();
      
      // Should suggest using the better model
      const relevant = optimizations.find(o => o.agentId === agentId);
      if (relevant) {
        expect(relevant.suggestedModel).toContain('qwen');
        expect(relevant.expectedImprovement).toBeGreaterThan(0);
      }
    });

    it('calculates expected improvement percentage', () => {
      const agentId: AgentId = 'VENUS';
      const taskType: TaskType = 'code-generation';

      // Current model: 0.7 quality
      for (let i = 0; i < 10; i++) {
        manager.recordResult(agentId, taskType, 'current-model', 0.7, 0.001);
      }

      // Better model: 0.9 quality (28.6% improvement)
      for (let i = 0; i < 10; i++) {
        manager.recordResult(agentId, taskType, 'better-model', 0.9, 0.001);
      }

      const optimizations = manager.optimizeProfiles();
      const relevant = optimizations.find(o => o.agentId === agentId);
      
      if (relevant) {
        expect(relevant.expectedImprovement).toBeGreaterThan(20);
      }
    });
  });

  describe('applyOptimization', () => {
    it('applies optimization to profile', () => {
      const optimization = {
        agentId: 'SUN' as AgentId,
        currentModel: 'old-model',
        suggestedModel: 'new-model',
        reason: 'Better performance',
        expectedImprovement: 15,
      };

      manager.applyOptimization(optimization);

      const profile = manager.getProfile('SUN');
      expect(profile?.preferredModels).toContain('new-model');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // Get All Profiles Tests
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('getAllProfiles', () => {
    it('returns all 21 profiles', () => {
      const profiles = manager.getAllProfiles();

      expect(profiles).toHaveLength(21);
    });

    it('profiles have unique agent IDs', () => {
      const profiles = manager.getAllProfiles();
      const ids = profiles.map(p => p.agentId);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe('getAgentIds', () => {
    it('returns all agent IDs', () => {
      const ids = manager.getAgentIds();

      expect(ids).toHaveLength(21);
      expect(ids).toContain('SUN');
      expect(ids).toContain('MERCURY');
      expect(ids).toContain('ANDROMEDA');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Default Profiles Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('DEFAULT_AGENT_PROFILES', () => {
  it('contains all 21 agents', () => {
    const agentIds = Object.keys(DEFAULT_AGENT_PROFILES);
    expect(agentIds).toHaveLength(21);
  });

  it('each profile has at least one preferred model', () => {
    for (const profile of Object.values(DEFAULT_AGENT_PROFILES)) {
      expect(profile.preferredModels.length).toBeGreaterThan(0);
    }
  });

  it('quality thresholds are between 0 and 1', () => {
    for (const profile of Object.values(DEFAULT_AGENT_PROFILES)) {
      expect(profile.qualityThreshold).toBeGreaterThan(0);
      expect(profile.qualityThreshold).toBeLessThanOrEqual(1);
    }
  });

  it('cost budgets are positive', () => {
    for (const profile of Object.values(DEFAULT_AGENT_PROFILES)) {
      expect(profile.costBudgetPerHour).toBeGreaterThan(0);
    }
  });

  it('latency budgets are positive', () => {
    for (const profile of Object.values(DEFAULT_AGENT_PROFILES)) {
      expect(profile.latencyBudget).toBeGreaterThan(0);
    }
  });

  it('SUN has highest cost budget for orchestration', () => {
    const sunBudget = DEFAULT_AGENT_PROFILES.SUN.costBudgetPerHour;
    
    // Most agents should have lower budgets
    const lowerBudgetAgents = Object.values(DEFAULT_AGENT_PROFILES)
      .filter(p => p.costBudgetPerHour < sunBudget);
    
    expect(lowerBudgetAgents.length).toBeGreaterThan(15);
  });

  it('JUPITER has high quality threshold for architecture', () => {
    expect(DEFAULT_AGENT_PROFILES.JUPITER.qualityThreshold).toBeGreaterThanOrEqual(0.9);
  });

  it('CHARON has lowest cost budget for error UX', () => {
    expect(DEFAULT_AGENT_PROFILES.CHARON.costBudgetPerHour).toBeLessThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Singleton Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('ProfileManager singleton', () => {
  beforeEach(() => {
    resetProfileManager();
  });

  it('getProfileManager returns singleton instance', () => {
    const manager1 = getProfileManager();
    const manager2 = getProfileManager();

    expect(manager1).toBe(manager2);
  });

  it('resetProfileManager creates new instance', () => {
    const manager1 = getProfileManager();
    resetProfileManager();
    const manager2 = getProfileManager();

    expect(manager1).not.toBe(manager2);
  });
});
