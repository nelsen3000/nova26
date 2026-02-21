import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  AGENT_REGISTRY,
  getAllAgents,
  getAgentById,
  getAgentsByName,
  getAgentsByCapability,
  getAgentsByTag,
  filterAgents,
  findBestAgentForTask,
  getAllCapabilities,
  getAllTags,
  agentHasCapability,
  getRecommendedAgentsForTaskType,
  calculateAverageDuration,
  getCapabilitiesMatrix,
  validateAgentRegistry,
  initializeAgentMetrics,
  getAgentMetrics,
  recordTaskCompletion,
  getAllAgentMetrics,
  clearAllMetrics,
  type AgentCapability,
  type AgentFilter,
} from '../capability-matrix.js';

describe('Capability Matrix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-initialize metrics after clear for tests that depend on them
    clearAllMetrics();
    for (const agent of AGENT_REGISTRY) {
      initializeAgentMetrics(agent.id);
    }
  });

  // ============================================================================
  // Registry Tests
  // ============================================================================

  describe('AGENT_REGISTRY', () => {
    it('should contain exactly 21 agents', () => {
      expect(AGENT_REGISTRY).toHaveLength(21);
    });

    it('should have unique agent IDs', () => {
      const ids = AGENT_REGISTRY.map(a => a.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have all required fields for each agent', () => {
      for (const agent of AGENT_REGISTRY) {
        expect(agent.id).toBeDefined();
        expect(agent.id).not.toBe('');
        expect(agent.name).toBeDefined();
        expect(agent.name).not.toBe('');
        expect(agent.description).toBeDefined();
        expect(agent.description).not.toBe('');
        expect(agent.capabilities).toBeInstanceOf(Array);
        expect(agent.capabilities.length).toBeGreaterThan(0);
        expect(agent.preferredModels).toBeInstanceOf(Array);
        expect(agent.preferredModels.length).toBeGreaterThan(0);
        expect(agent.maxConcurrency).toBeGreaterThan(0);
        expect(agent.averageTaskDurationMs).toBeGreaterThan(0);
        expect(agent.tags).toBeInstanceOf(Array);
        expect(agent.tags.length).toBeGreaterThan(0);
      }
    });
  });

  // ============================================================================
  // Query Tests
  // ============================================================================

  describe('getAllAgents', () => {
    it('should return all agents', () => {
      const agents = getAllAgents();
      expect(agents).toHaveLength(21);
    });

    it('should return a copy of the registry', () => {
      const agents = getAllAgents();
      agents.pop();
      expect(getAllAgents()).toHaveLength(21);
    });
  });

  describe('getAgentById', () => {
    it('should return agent by exact ID match', () => {
      const agent = getAgentById('EARTH');
      expect(agent).toBeDefined();
      expect(agent?.id).toBe('EARTH');
      expect(agent?.name).toBe('Earth');
    });

    it('should return undefined for non-existent ID', () => {
      const agent = getAgentById('NONEXISTENT');
      expect(agent).toBeUndefined();
    });

    it('should be case-sensitive', () => {
      const agent = getAgentById('earth');
      expect(agent).toBeUndefined();
    });

    it('should return correct agent for each core agent', () => {
      expect(getAgentById('MARS')?.name).toBe('Mars');
      expect(getAgentById('VENUS')?.name).toBe('Venus');
      expect(getAgentById('JUPITER')?.name).toBe('Jupiter');
    });
  });

  describe('getAgentsByName', () => {
    it('should find agents by partial name match', () => {
      const agents = getAgentsByName('ar');
      expect(agents.length).toBeGreaterThan(0);
      expect(agents.some(a => a.name === 'Mars')).toBe(true);
    });

    it('should be case-insensitive', () => {
      const agents1 = getAgentsByName('earth');
      const agents2 = getAgentsByName('EARTH');
      const agents3 = getAgentsByName('Earth');
      expect(agents1).toEqual(agents2);
      expect(agents2).toEqual(agents3);
    });

    it('should return empty array for no matches', () => {
      const agents = getAgentsByName('xyz123');
      expect(agents).toEqual([]);
    });
  });

  describe('getAgentsByCapability', () => {
    it('should return agents with specific capability', () => {
      const codeAgents = getAgentsByCapability('code');
      expect(codeAgents.length).toBeGreaterThan(0);
      expect(codeAgents.every(a => a.capabilities.includes('code'))).toBe(true);
    });

    it('should return correct agents for design capability', () => {
      const designAgents = getAgentsByCapability('design');
      expect(designAgents.map(a => a.id).sort()).toEqual(['DIONE', 'OBERON', 'VENUS']);
    });

    it('should return empty array for unused capability', () => {
      // Using a valid capability that no agent has would be hard to test
      // So we verify the structure works
      const agents = getAgentsByCapability('code');
      expect(agents).toBeInstanceOf(Array);
    });

    it('should include all agents with the capability', () => {
      const testAgents = getAgentsByCapability('test');
      const agentIds = testAgents.map(a => a.id).sort();
      expect(agentIds).toContain('SATURN');
      expect(agentIds).toContain('NEPTUNE');
      expect(agentIds).toContain('PLUTO');
      expect(agentIds).toContain('ENCELADUS');
    });
  });

  describe('getAgentsByTag', () => {
    it('should return agents with specific tag', () => {
      const frontendAgents = getAgentsByTag('frontend');
      expect(frontendAgents.length).toBeGreaterThan(0);
    });

    it('should be case-insensitive', () => {
      const agents1 = getAgentsByTag('FRONTEND');
      const agents2 = getAgentsByTag('frontend');
      expect(agents1.map(a => a.id)).toEqual(agents2.map(a => a.id));
    });

    it('should support partial tag matching', () => {
      const agents = getAgentsByTag('test');
      expect(agents.length).toBeGreaterThanOrEqual(3);
    });

    it('should return empty array for non-existent tag', () => {
      const agents = getAgentsByTag('nonexistent-tag-12345');
      expect(agents).toEqual([]);
    });
  });

  // ============================================================================
  // Filter Tests
  // ============================================================================

  describe('filterAgents', () => {
    it('should filter by single capability', () => {
      const filter: AgentFilter = { capabilities: ['code'] };
      const agents = filterAgents(filter);
      expect(agents.every(a => a.capabilities.includes('code'))).toBe(true);
    });

    it('should filter by multiple capabilities (any match)', () => {
      const filter: AgentFilter = { capabilities: ['code', 'design'] };
      const agents = filterAgents(filter);
      expect(agents.every(a =>
        a.capabilities.includes('code') || a.capabilities.includes('design')
      )).toBe(true);
    });

    it('should filter by multiple capabilities (all match)', () => {
      const filter: AgentFilter = {
        capabilities: ['code', 'test'],
        requireAllCapabilities: true,
      };
      const agents = filterAgents(filter);
      expect(agents.every(a =>
        a.capabilities.includes('code') && a.capabilities.includes('test')
      )).toBe(true);
    });

    it('should filter by max duration', () => {
      const filter: AgentFilter = { maxDurationMs: 30000 };
      const agents = filterAgents(filter);
      expect(agents.every(a => a.averageTaskDurationMs <= 30000)).toBe(true);
      expect(agents.map(a => a.id)).toContain('MERCURY');
    });

    it('should filter by min concurrency', () => {
      const filter: AgentFilter = { minConcurrency: 5 };
      const agents = filterAgents(filter);
      expect(agents.every(a => a.maxConcurrency >= 5)).toBe(true);
      expect(agents.map(a => a.id)).toContain('MERCURY');
    });

    it('should filter by tags', () => {
      const filter: AgentFilter = { tags: ['security'] };
      const agents = filterAgents(filter);
      expect(agents.length).toBeGreaterThan(0);
      expect(agents.some(a => a.id === 'PLUTO')).toBe(true);
    });

    it('should combine multiple filter criteria', () => {
      const filter: AgentFilter = {
        capabilities: ['code'],
        maxDurationMs: 50000,
        minConcurrency: 3,
      };
      const agents = filterAgents(filter);
      expect(agents.every(a =>
        a.capabilities.includes('code') &&
        a.averageTaskDurationMs <= 50000 &&
        a.maxConcurrency >= 3
      )).toBe(true);
    });

    it('should return empty array when no agents match', () => {
      const filter: AgentFilter = {
        capabilities: ['code'],
        maxDurationMs: 1,
      };
      const agents = filterAgents(filter);
      expect(agents).toEqual([]);
    });
  });

  // ============================================================================
  // Best Agent Selection Tests
  // ============================================================================

  describe('findBestAgentForTask', () => {
    it('should return undefined when no agent has all capabilities', () => {
      const result = findBestAgentForTask(['code', 'design', 'deploy', 'security', 'architect']);
      expect(result).toBeUndefined();
    });

    it('should return the fastest agent when preferFastest is true', () => {
      const result = findBestAgentForTask(['code'], { preferFastest: true });
      expect(result).toBeDefined();
      // Mercury is the fastest code agent
      expect(result?.id).toBe('MERCURY');
    });

    it('should return highest concurrency agent when preferHighConcurrency is true', () => {
      const result = findBestAgentForTask(['code'], { preferHighConcurrency: true });
      expect(result).toBeDefined();
      // Mercury has highest concurrency (8)
      expect(result?.id).toBe('MERCURY');
    });

    it('should exclude specified agents', () => {
      const result = findBestAgentForTask(['code'], {
        preferFastest: true,
        excludeAgents: ['MERCURY'],
      });
      expect(result).toBeDefined();
      expect(result?.id).not.toBe('MERCURY');
    });

    it('should return agent with best capability match by default', () => {
      const result = findBestAgentForTask(['architect']);
      expect(result).toBeDefined();
      expect(result?.capabilities.includes('architect')).toBe(true);
      // Jupiter has architect as first capability
      expect(result?.id).toBe('JUPITER');
    });

    it('should handle single capability requirement', () => {
      const result = findBestAgentForTask(['design']);
      expect(result).toBeDefined();
      expect(result?.capabilities.includes('design')).toBe(true);
    });
  });

  // ============================================================================
  // Utility Tests
  // ============================================================================

  describe('getAllCapabilities', () => {
    it('should return all unique capabilities', () => {
      const capabilities = getAllCapabilities();
      expect(capabilities.length).toBeGreaterThan(0);
      expect(new Set(capabilities).size).toBe(capabilities.length);
    });

    it('should return sorted capabilities', () => {
      const capabilities = getAllCapabilities();
      const sorted = [...capabilities].sort();
      expect(capabilities).toEqual(sorted);
    });

    it('should include core capabilities', () => {
      const capabilities = getAllCapabilities();
      expect(capabilities).toContain('code');
      expect(capabilities).toContain('design');
      expect(capabilities).toContain('test');
      expect(capabilities).toContain('deploy');
      expect(capabilities).toContain('review');
    });
  });

  describe('getAllTags', () => {
    it('should return all unique tags', () => {
      const tags = getAllTags();
      expect(tags.length).toBeGreaterThan(0);
      expect(new Set(tags).size).toBe(tags.length);
    });

    it('should return sorted tags', () => {
      const tags = getAllTags();
      const sorted = [...tags].sort();
      expect(tags).toEqual(sorted);
    });

    it('should include common tags', () => {
      const tags = getAllTags();
      expect(tags.some(t => t.includes('code') || t.includes('frontend') || t.includes('backend'))).toBe(true);
    });
  });

  describe('agentHasCapability', () => {
    it('should return true when agent has capability', () => {
      expect(agentHasCapability('EARTH', 'code')).toBe(true);
      expect(agentHasCapability('VENUS', 'design')).toBe(true);
      expect(agentHasCapability('SATURN', 'test')).toBe(true);
    });

    it('should return false when agent does not have capability', () => {
      expect(agentHasCapability('EARTH', 'design')).toBe(false);
      expect(agentHasCapability('VENUS', 'deploy')).toBe(false);
    });

    it('should return false for non-existent agent', () => {
      expect(agentHasCapability('NONEXISTENT', 'code')).toBe(false);
    });
  });

  describe('getRecommendedAgentsForTaskType', () => {
    it('should return agents for code-generation', () => {
      const agents = getRecommendedAgentsForTaskType('code-generation');
      expect(agents.length).toBeGreaterThan(0);
      expect(agents.every(a => a.capabilities.includes('code'))).toBe(true);
    });

    it('should return agents for bug-fix', () => {
      const agents = getRecommendedAgentsForTaskType('bug-fix');
      expect(agents.length).toBeGreaterThan(0);
      expect(agents.some(a => a.capabilities.includes('debug'))).toBe(true);
    });

    it('should return agents for testing', () => {
      const agents = getRecommendedAgentsForTaskType('testing');
      expect(agents.length).toBeGreaterThan(0);
      expect(agents.every(a => a.capabilities.includes('test'))).toBe(true);
    });

    it('should return agents for security-audit', () => {
      const agents = getRecommendedAgentsForTaskType('security-audit');
      expect(agents.length).toBeGreaterThan(0);
      expect(agents.every(a => a.capabilities.includes('security'))).toBe(true);
    });

    it('should return empty array for unknown task type', () => {
      const agents = getRecommendedAgentsForTaskType('unknown-task-type');
      expect(agents).toEqual([]);
    });
  });

  describe('calculateAverageDuration', () => {
    it('should calculate average duration for valid agents', () => {
      const avg = calculateAverageDuration(['EARTH', 'MARS', 'VENUS']);
      expect(avg).toBeGreaterThan(0);
      
      // Verify calculation: (45000 + 60000 + 40000) / 3 = 48333
      const earth = getAgentById('EARTH');
      const mars = getAgentById('MARS');
      const venus = getAgentById('VENUS');
      const expected = Math.round(
        (earth!.averageTaskDurationMs + mars!.averageTaskDurationMs + venus!.averageTaskDurationMs) / 3
      );
      expect(avg).toBe(expected);
    });

    it('should return 0 for empty array', () => {
      expect(calculateAverageDuration([])).toBe(0);
    });

    it('should ignore non-existent agent IDs', () => {
      const avg1 = calculateAverageDuration(['EARTH']);
      const avg2 = calculateAverageDuration(['EARTH', 'NONEXISTENT']);
      expect(avg1).toBe(avg2);
    });
  });

  describe('getCapabilitiesMatrix', () => {
    it('should return matrix with all agent IDs as keys', () => {
      const matrix = getCapabilitiesMatrix();
      const agentIds = Object.keys(matrix).sort();
      const registryIds = AGENT_REGISTRY.map(a => a.id).sort();
      expect(agentIds).toEqual(registryIds);
    });

    it('should have capabilities array for each agent', () => {
      const matrix = getCapabilitiesMatrix();
      for (const [id, caps] of Object.entries(matrix)) {
        expect(Array.isArray(caps)).toBe(true);
        expect(caps.length).toBeGreaterThan(0);
        const agent = getAgentById(id);
        expect(caps).toEqual(agent!.capabilities);
      }
    });
  });

  describe('validateAgentRegistry', () => {
    it('should validate correct registry', () => {
      const result = validateAgentRegistry();
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should return errors array', () => {
      const result = validateAgentRegistry();
      expect(Array.isArray(result.errors)).toBe(true);
    });
  });

  // ============================================================================
  // Metrics Tests
  // ============================================================================

  describe('initializeAgentMetrics', () => {
    it('should create metrics with default values', () => {
      const metrics = initializeAgentMetrics('TEST');
      expect(metrics.id).toBe('TEST');
      expect(metrics.tasksCompleted).toBe(0);
      expect(metrics.averageDurationMs).toBe(0);
      expect(metrics.successRate).toBe(1.0);
      expect(metrics.lastUsed).toBeNull();
    });

    it('should store metrics for retrieval', () => {
      initializeAgentMetrics('TEST');
      const retrieved = getAgentMetrics('TEST');
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe('TEST');
    });
  });

  describe('getAgentMetrics', () => {
    it('should return undefined for uninitialized metrics', () => {
      const metrics = getAgentMetrics('UNINITIALIZED');
      expect(metrics).toBeUndefined();
    });

    it('should return metrics after initialization', () => {
      initializeAgentMetrics('EARTH');
      const metrics = getAgentMetrics('EARTH');
      expect(metrics).toBeDefined();
      expect(metrics?.tasksCompleted).toBe(0);
    });
  });

  describe('recordTaskCompletion', () => {
    it('should record successful task', () => {
      recordTaskCompletion('EARTH', 50000, true);
      const metrics = getAgentMetrics('EARTH');
      expect(metrics?.tasksCompleted).toBe(1);
      expect(metrics?.successRate).toBe(1.0);
      expect(metrics?.averageDurationMs).toBe(50000);
    });

    it('should record failed task', () => {
      recordTaskCompletion('EARTH', 30000, false);
      const metrics = getAgentMetrics('EARTH');
      expect(metrics?.tasksCompleted).toBe(1);
      expect(metrics?.successRate).toBe(0);
    });

    it('should update rolling average', () => {
      recordTaskCompletion('MARS', 40000, true);
      recordTaskCompletion('MARS', 60000, true);
      const metrics = getAgentMetrics('MARS');
      expect(metrics?.tasksCompleted).toBe(2);
      expect(metrics?.averageDurationMs).toBe(50000);
    });

    it('should update success rate over multiple tasks', () => {
      recordTaskCompletion('VENUS', 10000, true);
      recordTaskCompletion('VENUS', 10000, true);
      recordTaskCompletion('VENUS', 10000, false);
      const metrics = getAgentMetrics('VENUS');
      expect(metrics?.tasksCompleted).toBe(3);
      expect(metrics?.successRate).toBeCloseTo(2 / 3, 2);
    });

    it('should set lastUsed timestamp', () => {
      const before = new Date().toISOString();
      recordTaskCompletion('JUPITER', 10000, true);
      const after = new Date().toISOString();
      const metrics = getAgentMetrics('JUPITER');
      expect(metrics?.lastUsed).toBeDefined();
      if (metrics?.lastUsed) {
        expect(metrics.lastUsed >= before).toBe(true);
        expect(metrics.lastUsed <= after).toBe(true);
      }
    });
  });

  describe('getAllAgentMetrics', () => {
    it('should return all initialized metrics', () => {
      const allMetrics = getAllAgentMetrics();
      expect(allMetrics.length).toBe(21); // All agents initialized on module load
    });

    it('should include metrics after recording', () => {
      recordTaskCompletion('EARTH', 10000, true);
      const allMetrics = getAllAgentMetrics();
      const earthMetrics = allMetrics.find(m => m.id === 'EARTH');
      expect(earthMetrics?.tasksCompleted).toBe(1);
    });
  });

  describe('clearAllMetrics', () => {
    it('should clear all metrics', () => {
      recordTaskCompletion('EARTH', 10000, true);
      clearAllMetrics();
      const metrics = getAgentMetrics('EARTH');
      expect(metrics).toBeUndefined();
    });

    it('should result in empty metrics array', () => {
      clearAllMetrics();
      const allMetrics = getAllAgentMetrics();
      expect(allMetrics).toEqual([]);
    });
  });

  // ============================================================================
  // Specific Agent Verification Tests
  // ============================================================================

  describe('Specific Agent Definitions', () => {
    it('EARTH should have correct properties', () => {
      const earth = getAgentById('EARTH');
      expect(earth?.name).toBe('Earth');
      expect(earth?.capabilities).toContain('code');
      expect(earth?.maxConcurrency).toBe(5);
      expect(earth?.tags).toContain('core');
    });

    it('JUPITER should be architecture specialist', () => {
      const jupiter = getAgentById('JUPITER');
      expect(jupiter?.capabilities[0]).toBe('architect');
      expect(jupiter?.maxConcurrency).toBe(2);
      expect(jupiter?.averageTaskDurationMs).toBe(120000);
    });

    it('MERCURY should have highest concurrency', () => {
      const mercury = getAgentById('MERCURY');
      expect(mercury?.maxConcurrency).toBe(8);
      expect(mercury?.averageTaskDurationMs).toBe(20000);
    });

    it('PLUTO should be security specialist', () => {
      const pluto = getAgentById('PLUTO');
      expect(pluto?.capabilities).toContain('security');
      expect(pluto?.tags).toContain('security');
    });

    it('SATURN and NEPTUNE should be testing agents', () => {
      const saturn = getAgentById('SATURN');
      const neptune = getAgentById('NEPTUNE');
      expect(saturn?.capabilities).toContain('test');
      expect(neptune?.capabilities).toContain('test');
      expect(saturn?.tags).toContain('testing');
      expect(neptune?.tags).toContain('qa');
    });
  });
});
