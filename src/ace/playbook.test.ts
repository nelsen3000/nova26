import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  PlaybookManager,
  getPlaybookManager,
  resetPlaybookManager,
  setPlaybookManager,
  type PlaybookDelta,
  type DeltaType,
} from './playbook.js';
import { rmSync, mkdirSync, existsSync, writeFileSync } from 'fs';

const TEST_PLAYBOOKS_DIR = '.nova/ace/playbooks';

describe('PlaybookManager', () => {
  let manager: PlaybookManager;

  beforeEach(() => {
    // Clean up test directory
    if (existsSync(TEST_PLAYBOOKS_DIR)) {
      rmSync(TEST_PLAYBOOKS_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEST_PLAYBOOKS_DIR, { recursive: true });

    // Reset singleton and create fresh manager
    resetPlaybookManager();
    manager = getPlaybookManager();
    manager.setPersistEnabled(false); // Disable persistence for most tests
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(TEST_PLAYBOOKS_DIR)) {
      rmSync(TEST_PLAYBOOKS_DIR, { recursive: true, force: true });
    }
    resetPlaybookManager();
  });

  // ==========================================================================
  // getPlaybook tests
  // ==========================================================================

  describe('getPlaybook', () => {
    it('should return default playbook for new agent', () => {
      const playbook = manager.getPlaybook('TestAgent');

      expect(playbook.agentName).toBe('TestAgent');
      expect(playbook.rules).toEqual([]);
      expect(playbook.version).toBe(0);
      expect(playbook.totalTasksApplied).toBe(0);
      expect(playbook.successRate).toBe(0);
      expect(playbook.id).toBeDefined();
      expect(playbook.lastUpdated).toBeDefined();
    });

    it('should return cached playbook on second call', () => {
      const playbook1 = manager.getPlaybook('TestAgent');
      const playbook2 = manager.getPlaybook('TestAgent');

      expect(playbook1).toBe(playbook2);
      expect(playbook1.id).toBe(playbook2.id);
    });

    it('should return different playbooks for different agents', () => {
      const playbook1 = manager.getPlaybook('AgentA');
      const playbook2 = manager.getPlaybook('AgentB');

      expect(playbook1.agentName).toBe('AgentA');
      expect(playbook2.agentName).toBe('AgentB');
      expect(playbook1.id).not.toBe(playbook2.id);
    });
  });

  // ==========================================================================
  // getActiveRules tests
  // ==========================================================================

  describe('getActiveRules', () => {
    it('should return empty array for playbook with no rules', () => {
      const rules = manager.getActiveRules('TestAgent', 'some context');
      expect(rules).toEqual([]);
    });

    it('should return rules sorted by relevance score', () => {
      const delta1: PlaybookDelta = {
        nodeId: 'node1',
        type: 'Strategy',
        content: 'Always use TypeScript for type safety',
        helpfulDelta: 1,
        harmfulDelta: 0,
        tags: ['typescript', 'types'],
        isGlobalCandidate: false,
        confidence: 0.9,
        agentName: 'TestAgent',
        taskId: 'task1',
        createdAt: new Date().toISOString(),
      };

      const delta2: PlaybookDelta = {
        nodeId: 'node2',
        type: 'Strategy',
        content: 'Use descriptive variable names',
        helpfulDelta: 1,
        harmfulDelta: 0,
        tags: ['naming', 'readability'],
        isGlobalCandidate: false,
        confidence: 0.5,
        agentName: 'TestAgent',
        taskId: 'task2',
        createdAt: new Date().toISOString(),
      };

      manager.updatePlaybook('TestAgent', [delta1, delta2]);

      // Simulate some successful applications
      const playbook = manager.getPlaybook('TestAgent');
      manager.incrementApplied('TestAgent', [playbook.rules[0].id]);
      manager.recordSuccess('TestAgent', [playbook.rules[0].id]);

      const rules = manager.getActiveRules('TestAgent', 'typescript context');
      expect(rules).toHaveLength(2);
      // The high confidence rule with TypeScript tag should rank higher
      expect(rules[0].content).toContain('TypeScript');
    });

    it('should respect the limit parameter', () => {
      const deltas: PlaybookDelta[] = Array.from({ length: 10 }, (_, i) => ({
        nodeId: `node${i}`,
        type: 'Strategy' as DeltaType,
        content: `Rule ${i} content`,
        helpfulDelta: 1,
        harmfulDelta: 0,
        tags: [`tag${i}`],
        isGlobalCandidate: false,
        confidence: 0.5 + i * 0.05,
        agentName: 'TestAgent',
        taskId: `task${i}`,
        createdAt: new Date().toISOString(),
      }));

      manager.updatePlaybook('TestAgent', deltas);

      const rules = manager.getActiveRules('TestAgent', 'context', 5);
      expect(rules).toHaveLength(5);
    });

    it('should prioritize rules with keyword overlap', () => {
      const delta1: PlaybookDelta = {
        nodeId: 'node1',
        type: 'Strategy',
        content: 'Use React hooks for state management',
        helpfulDelta: 1,
        harmfulDelta: 0,
        tags: ['react', 'hooks'],
        isGlobalCandidate: false,
        confidence: 0.7,
        agentName: 'TestAgent',
        taskId: 'task1',
        createdAt: new Date().toISOString(),
      };

      const delta2: PlaybookDelta = {
        nodeId: 'node2',
        type: 'Strategy',
        content: 'Use Vue composition API',
        helpfulDelta: 1,
        harmfulDelta: 0,
        tags: ['vue', 'composition'],
        isGlobalCandidate: false,
        confidence: 0.7,
        agentName: 'TestAgent',
        taskId: 'task2',
        createdAt: new Date().toISOString(),
      };

      manager.updatePlaybook('TestAgent', [delta1, delta2]);

      const rules = manager.getActiveRules('TestAgent', 'I need help with React components');
      expect(rules[0].content).toContain('React');
    });
  });

  // ==========================================================================
  // updatePlaybook tests
  // ==========================================================================

  describe('updatePlaybook', () => {
    it('should create new rules from deltas', () => {
      const delta: PlaybookDelta = {
        nodeId: 'node1',
        type: 'Strategy',
        content: 'Always write tests first',
        helpfulDelta: 1,
        harmfulDelta: 0,
        tags: ['testing', 'tdd'],
        isGlobalCandidate: false,
        confidence: 0.8,
        agentName: 'TestAgent',
        taskId: 'task1',
        createdAt: new Date().toISOString(),
      };

      const playbook = manager.updatePlaybook('TestAgent', [delta]);

      expect(playbook.rules).toHaveLength(1);
      expect(playbook.rules[0].content).toBe('Always write tests first');
      expect(playbook.rules[0].source).toBe('learned');
      expect(playbook.rules[0].confidence).toBe(0.8);
      expect(playbook.rules[0].tags).toEqual(['testing', 'tdd']);
    });

    it('should increment version on each update', () => {
      const delta1: PlaybookDelta = {
        nodeId: 'node1',
        type: 'Strategy',
        content: 'Rule 1',
        helpfulDelta: 1,
        harmfulDelta: 0,
        tags: ['tag1'],
        isGlobalCandidate: false,
        confidence: 0.5,
        agentName: 'TestAgent',
        taskId: 'task1',
        createdAt: new Date().toISOString(),
      };

      const delta2: PlaybookDelta = {
        nodeId: 'node2',
        type: 'Mistake',
        content: 'Rule 2',
        helpfulDelta: 1,
        harmfulDelta: 0,
        tags: ['tag2'],
        isGlobalCandidate: false,
        confidence: 0.5,
        agentName: 'TestAgent',
        taskId: 'task2',
        createdAt: new Date().toISOString(),
      };

      const playbook1 = manager.updatePlaybook('TestAgent', [delta1]);
      expect(playbook1.version).toBe(1);

      const playbook2 = manager.updatePlaybook('TestAgent', [delta2]);
      expect(playbook2.version).toBe(2);
    });

    it('should update existing rule with similar content', () => {
      const delta1: PlaybookDelta = {
        nodeId: 'node1',
        type: 'Strategy',
        content: 'Always use async await',
        helpfulDelta: 1,
        harmfulDelta: 0,
        tags: ['async', 'javascript'],
        isGlobalCandidate: false,
        confidence: 0.7,
        agentName: 'TestAgent',
        taskId: 'task1',
        createdAt: new Date().toISOString(),
      };

      manager.updatePlaybook('TestAgent', [delta1]);

      const delta2: PlaybookDelta = {
        nodeId: 'node2',
        type: 'Strategy',
        content: 'Always use async await',
        helpfulDelta: 1,
        harmfulDelta: 0,
        tags: ['promises', 'javascript'],
        isGlobalCandidate: false,
        confidence: 0.2,
        agentName: 'TestAgent',
        taskId: 'task2',
        createdAt: new Date().toISOString(),
      };

      const playbook = manager.updatePlaybook('TestAgent', [delta2]);

      expect(playbook.rules).toHaveLength(1);
      expect(playbook.rules[0].confidence).toBeGreaterThan(0.7);
      expect(playbook.rules[0].tags).toContain('promises');
      expect(playbook.rules[0].tags).toContain('async');
    });

    it('should track task types from deltas', () => {
      const deltas: PlaybookDelta[] = [
        {
          nodeId: 'node1',
          type: 'Strategy',
          content: 'Rule 1',
          helpfulDelta: 1,
          harmfulDelta: 0,
          tags: [],
          isGlobalCandidate: false,
          confidence: 0.5,
          agentName: 'TestAgent',
          taskId: 'task1',
          createdAt: new Date().toISOString(),
        },
        {
          nodeId: 'node2',
          type: 'Mistake',
          content: 'Rule 2',
          helpfulDelta: 1,
          harmfulDelta: 0,
          tags: [],
          isGlobalCandidate: false,
          confidence: 0.5,
          agentName: 'TestAgent',
          taskId: 'task2',
          createdAt: new Date().toISOString(),
        },
      ];

      const playbook = manager.updatePlaybook('TestAgent', deltas);

      expect(playbook.taskTypes).toContain('Strategy');
      expect(playbook.taskTypes).toContain('Mistake');
    });
  });

  // ==========================================================================
  // incrementApplied tests
  // ==========================================================================

  describe('incrementApplied', () => {
    it('should increment appliedCount for specified rules', () => {
      const delta: PlaybookDelta = {
        nodeId: 'node1',
        type: 'Strategy',
        content: 'Test rule',
        helpfulDelta: 1,
        harmfulDelta: 0,
        tags: ['test'],
        isGlobalCandidate: false,
        confidence: 0.5,
        agentName: 'TestAgent',
        taskId: 'task1',
        createdAt: new Date().toISOString(),
      };

      manager.updatePlaybook('TestAgent', [delta]);
      const playbook = manager.getPlaybook('TestAgent');
      const ruleId = playbook.rules[0].id;

      expect(playbook.rules[0].appliedCount).toBe(0);

      manager.incrementApplied('TestAgent', [ruleId]);

      const updatedPlaybook = manager.getPlaybook('TestAgent');
      expect(updatedPlaybook.rules[0].appliedCount).toBe(1);
    });

    it('should handle multiple rule IDs', () => {
      const deltas: PlaybookDelta[] = [
        {
          nodeId: 'node1',
          type: 'Strategy',
          content: 'Rule 1',
          helpfulDelta: 1,
          harmfulDelta: 0,
          tags: ['tag1'],
          isGlobalCandidate: false,
          confidence: 0.5,
          agentName: 'TestAgent',
          taskId: 'task1',
          createdAt: new Date().toISOString(),
        },
        {
          nodeId: 'node2',
          type: 'Strategy',
          content: 'Rule 2',
          helpfulDelta: 1,
          harmfulDelta: 0,
          tags: ['tag2'],
          isGlobalCandidate: false,
          confidence: 0.5,
          agentName: 'TestAgent',
          taskId: 'task2',
          createdAt: new Date().toISOString(),
        },
      ];

      manager.updatePlaybook('TestAgent', deltas);
      const playbook = manager.getPlaybook('TestAgent');
      const ruleIds = playbook.rules.map((r) => r.id);

      manager.incrementApplied('TestAgent', ruleIds);

      const updated = manager.getPlaybook('TestAgent');
      expect(updated.rules[0].appliedCount).toBe(1);
      expect(updated.rules[1].appliedCount).toBe(1);
    });
  });

  // ==========================================================================
  // recordSuccess tests
  // ==========================================================================

  describe('recordSuccess', () => {
    it('should increment successCount for specified rules', () => {
      const delta: PlaybookDelta = {
        nodeId: 'node1',
        type: 'Strategy',
        content: 'Test rule',
        helpfulDelta: 1,
        harmfulDelta: 0,
        tags: ['test'],
        isGlobalCandidate: false,
        confidence: 0.5,
        agentName: 'TestAgent',
        taskId: 'task1',
        createdAt: new Date().toISOString(),
      };

      manager.updatePlaybook('TestAgent', [delta]);
      const playbook = manager.getPlaybook('TestAgent');
      const ruleId = playbook.rules[0].id;

      manager.incrementApplied('TestAgent', [ruleId]);
      manager.recordSuccess('TestAgent', [ruleId]);

      const updated = manager.getPlaybook('TestAgent');
      expect(updated.rules[0].successCount).toBe(1);
    });

    it('should update playbook successRate', () => {
      const deltas: PlaybookDelta[] = [
        {
          nodeId: 'node1',
          type: 'Strategy',
          content: 'Rule 1',
          helpfulDelta: 1,
          harmfulDelta: 0,
          tags: ['tag1'],
          isGlobalCandidate: false,
          confidence: 0.5,
          agentName: 'TestAgent',
          taskId: 'task1',
          createdAt: new Date().toISOString(),
        },
        {
          nodeId: 'node2',
          type: 'Strategy',
          content: 'Rule 2',
          helpfulDelta: 1,
          harmfulDelta: 0,
          tags: ['tag2'],
          isGlobalCandidate: false,
          confidence: 0.5,
          agentName: 'TestAgent',
          taskId: 'task2',
          createdAt: new Date().toISOString(),
        },
      ];

      manager.updatePlaybook('TestAgent', deltas);
      const playbook = manager.getPlaybook('TestAgent');
      const ruleIds = playbook.rules.map((r) => r.id);

      // Apply both rules
      manager.incrementApplied('TestAgent', ruleIds);
      // Only one succeeds
      manager.recordSuccess('TestAgent', [ruleIds[0]]);

      const updated = manager.getPlaybook('TestAgent');
      expect(updated.successRate).toBe(0.5);
    });
  });

  // ==========================================================================
  // recordTaskApplied tests
  // ==========================================================================

  describe('recordTaskApplied', () => {
    it('should increment totalTasksApplied', () => {
      manager.getPlaybook('TestAgent');

      expect(manager.getPlaybook('TestAgent').totalTasksApplied).toBe(0);

      manager.recordTaskApplied('TestAgent');
      expect(manager.getPlaybook('TestAgent').totalTasksApplied).toBe(1);

      manager.recordTaskApplied('TestAgent');
      expect(manager.getPlaybook('TestAgent').totalTasksApplied).toBe(2);
    });
  });

  // ==========================================================================
  // getGlobalCandidates tests
  // ==========================================================================

  describe('getGlobalCandidates', () => {
    it('should return empty array when no rules meet criteria', () => {
      const delta: PlaybookDelta = {
        nodeId: 'node1',
        type: 'Strategy',
        content: 'Low confidence rule',
        helpfulDelta: 1,
        harmfulDelta: 0,
        tags: ['test'],
        isGlobalCandidate: false,
        confidence: 0.5, // Below 0.85 threshold
        agentName: 'TestAgent',
        taskId: 'task1',
        createdAt: new Date().toISOString(),
      };

      manager.updatePlaybook('TestAgent', [delta]);
      const candidates = manager.getGlobalCandidates('TestAgent');
      expect(candidates).toEqual([]);
    });

    it('should return rules meeting all criteria', () => {
      const delta: PlaybookDelta = {
        nodeId: 'node1',
        type: 'Strategy',
        content: 'High quality rule',
        helpfulDelta: 1,
        harmfulDelta: 0,
        tags: ['quality'],
        isGlobalCandidate: true,
        confidence: 0.9,
        agentName: 'TestAgent',
        taskId: 'task1',
        createdAt: new Date().toISOString(),
      };

      manager.updatePlaybook('TestAgent', [delta]);
      const playbook = manager.getPlaybook('TestAgent');
      const ruleId = playbook.rules[0].id;

      // Apply 5 times
      for (let i = 0; i < 5; i++) {
        manager.incrementApplied('TestAgent', [ruleId]);
      }
      // Succeed 3 times
      for (let i = 0; i < 3; i++) {
        manager.recordSuccess('TestAgent', [ruleId]);
      }

      const candidates = manager.getGlobalCandidates('TestAgent');
      expect(candidates).toHaveLength(1);
      expect(candidates[0].content).toBe('High quality rule');
    });

    it('should exclude global source rules', () => {
      // Create a manual rule first (not from delta)
      const delta: PlaybookDelta = {
        nodeId: 'node1',
        type: 'Strategy',
        content: 'Test rule',
        helpfulDelta: 1,
        harmfulDelta: 0,
        tags: ['test'],
        isGlobalCandidate: false,
        confidence: 0.9,
        agentName: 'TestAgent',
        taskId: 'task1',
        createdAt: new Date().toISOString(),
      };

      manager.updatePlaybook('TestAgent', [delta]);
      const playbook = manager.getPlaybook('TestAgent');
      playbook.rules[0].source = 'global';

      // Try to make it a candidate
      const ruleId = playbook.rules[0].id;
      for (let i = 0; i < 5; i++) {
        manager.incrementApplied('TestAgent', [ruleId]);
      }
      for (let i = 0; i < 3; i++) {
        manager.recordSuccess('TestAgent', [ruleId]);
      }

      const candidates = manager.getGlobalCandidates('TestAgent');
      expect(candidates).toHaveLength(0);
    });
  });

  // ==========================================================================
  // persist and load tests
  // ==========================================================================

  describe('persist and load', () => {
    it('should persist playbook to disk', () => {
      manager.setPersistEnabled(true);

      const delta: PlaybookDelta = {
        nodeId: 'node1',
        type: 'Strategy',
        content: 'Persisted rule',
        helpfulDelta: 1,
        harmfulDelta: 0,
        tags: ['persist'],
        isGlobalCandidate: false,
        confidence: 0.8,
        agentName: 'TestAgent',
        taskId: 'task1',
        createdAt: new Date().toISOString(),
      };

      manager.updatePlaybook('PersistAgent', [delta]);

      const path = `${TEST_PLAYBOOKS_DIR}/PersistAgent.json`;
      expect(existsSync(path)).toBe(true);
    });

    it('should load playbook from disk', () => {
      manager.setPersistEnabled(true);

      const delta: PlaybookDelta = {
        nodeId: 'node1',
        type: 'Strategy',
        content: 'Loaded rule',
        helpfulDelta: 1,
        harmfulDelta: 0,
        tags: ['load'],
        isGlobalCandidate: false,
        confidence: 0.8,
        agentName: 'TestAgent',
        taskId: 'task1',
        createdAt: new Date().toISOString(),
      };

      manager.updatePlaybook('LoadAgent', [delta]);
      const originalId = manager.getPlaybook('LoadAgent').id;

      // Clear cache and reload
      manager.clear('LoadAgent');
      const loaded = manager.load('LoadAgent');

      expect(loaded).not.toBeNull();
      expect(loaded!.id).toBe(originalId);
      expect(loaded!.rules[0].content).toBe('Loaded rule');
    });

    it('should return null when loading non-existent playbook', () => {
      const loaded = manager.load('NonExistentAgent');
      expect(loaded).toBeNull();
    });
  });

  // ==========================================================================
  // clear tests
  // ==========================================================================

  describe('clear', () => {
    it('should remove playbook from cache', () => {
      manager.getPlaybook('TestAgent');
      expect(manager.getPlaybook('TestAgent')).toBeDefined();

      manager.clear('TestAgent');

      // After clearing, should create new default playbook
      const newPlaybook = manager.getPlaybook('TestAgent');
      expect(newPlaybook.version).toBe(0);
      expect(newPlaybook.rules).toEqual([]);
    });
  });

  // ==========================================================================
  // Singleton tests
  // ==========================================================================

  describe('singleton', () => {
    it('getPlaybookManager should return same instance', () => {
      const manager1 = getPlaybookManager();
      const manager2 = getPlaybookManager();
      expect(manager1).toBe(manager2);
    });

    it('resetPlaybookManager should create new instance on next call', () => {
      const manager1 = getPlaybookManager();
      resetPlaybookManager();
      const manager2 = getPlaybookManager();
      expect(manager1).not.toBe(manager2);
    });

    it('setPlaybookManager should override the instance', () => {
      const customManager = new PlaybookManager();
      setPlaybookManager(customManager);
      expect(getPlaybookManager()).toBe(customManager);
    });
  });

  // ==========================================================================
  // Zod validation tests
  // ==========================================================================

  describe('validation', () => {
    it('should return null for invalid JSON', () => {
      manager.setPersistEnabled(true);

      // Create invalid JSON file manually
      const path = `${TEST_PLAYBOOKS_DIR}/InvalidAgent.json`;
      mkdirSync(TEST_PLAYBOOKS_DIR, { recursive: true });
      writeFileSync(path, 'not valid json', 'utf-8');

      const loaded = manager.load('InvalidAgent');
      expect(loaded).toBeNull();
    });

    it('should return null for playbook with missing required fields', () => {
      manager.setPersistEnabled(true);

      const path = `${TEST_PLAYBOOKS_DIR}/IncompleteAgent.json`;
      mkdirSync(TEST_PLAYBOOKS_DIR, { recursive: true });
      writeFileSync(
        path,
        JSON.stringify({ agentName: 'IncompleteAgent', version: 0 }), // Missing many fields
        'utf-8'
      );

      const loaded = manager.load('IncompleteAgent');
      expect(loaded).toBeNull();
    });
  });

  // ==========================================================================
  // Edge case tests
  // ==========================================================================

  describe('edge cases', () => {
    it('should handle empty delta array', () => {
      const playbook = manager.updatePlaybook('TestAgent', []);
      expect(playbook.version).toBe(1);
      expect(playbook.rules).toHaveLength(0);
    });

    it('should handle incrementApplied for non-existent rule IDs', () => {
      manager.getPlaybook('TestAgent');

      // Should not throw
      expect(() => {
        manager.incrementApplied('TestAgent', ['non-existent-id']);
      }).not.toThrow();
    });

    it('should handle recordSuccess with no applied rules', () => {
      const delta: PlaybookDelta = {
        nodeId: 'node1',
        type: 'Strategy',
        content: 'Test rule',
        helpfulDelta: 1,
        harmfulDelta: 0,
        tags: ['test'],
        isGlobalCandidate: false,
        confidence: 0.5,
        agentName: 'TestAgent',
        taskId: 'task1',
        createdAt: new Date().toISOString(),
      };

      manager.updatePlaybook('TestAgent', [delta]);
      const playbook = manager.getPlaybook('TestAgent');
      const ruleId = playbook.rules[0].id;

      // Success without apply
      manager.recordSuccess('TestAgent', [ruleId]);

      const updated = manager.getPlaybook('TestAgent');
      expect(updated.rules[0].successCount).toBe(1);
      // successRate is 0 because appliedCount is 0 (success without apply doesn't count in rate calculation)
      expect(updated.successRate).toBe(0);
    });
  });
});
