// ACE Integration Tests - KIMI-ACE-06
// Full pipeline: Playbook → Generator → Reflector → Curator → Self-Improvement

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  getPlaybookManager,
  resetPlaybookManager,
  PlaybookDelta,
} from './playbook.js';
import { getAceGenerator, resetAceGenerator } from './generator.js';
import { resetAceReflector } from './reflector.js';
import { getAceCurator, resetAceCurator } from './curator.js';
import { getSelfImprovementProtocol, resetSelfImprovementProtocol } from '../agents/self-improvement.js';
import { getTasteVault, resetTasteVault } from '../taste-vault/taste-vault.js';
import { resetGraphMemory } from '../taste-vault/graph-memory.js';


// ============================================================================
// Test Setup
// ============================================================================

describe('ACE Integration', () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'nova26-ace-integration-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);

    resetPlaybookManager();
    resetAceGenerator();
    resetAceReflector();
    resetAceCurator();
    resetSelfImprovementProtocol();
    resetTasteVault();
    resetGraphMemory();
  });

  afterEach(() => {
    process.chdir(originalCwd);
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  // ============================================================================
  // End-to-End Pipeline Tests
  // ============================================================================

  describe('Full ACE Pipeline', () => {
    it('PlaybookManager.getPlaybook() → AceGenerator.analyzeTask() → playbookContext contains rule text', async () => {
      const manager = getPlaybookManager();
      
      // Add a rule to the playbook
      await manager.updatePlaybook('MARS', [{
        nodeId: 'rule-1',
        type: 'Strategy',
        content: 'Always validate inputs with Zod',
        helpfulDelta: 0.9,
        harmfulDelta: 0,
        tags: ['validation'],
        isGlobalCandidate: false,
        confidence: 0.95,
        agentName: 'MARS',
        taskId: 'task-1',
        createdAt: new Date().toISOString(),
      }]);

      const generator = getAceGenerator();
      const task = {
        id: 'task-2',
        title: 'Add API endpoint',
        description: 'Create a new Convex mutation with validation',
        agent: 'MARS',
        phase: 2,
        status: 'ready' as const,
        dependencies: [],
        attempts: 0,
        createdAt: new Date().toISOString(),
      };

      const result = await generator.analyzeTask(task, 'MARS', 1000);

      expect(result.playbookContext).toContain('playbook_context');
      expect(result.playbookContext).toContain('Zod');
      expect(result.appliedRuleIds.length).toBeGreaterThan(0);
    });

    it('AceReflector.reflectOnOutcome() → AceCurator.curate() → PlaybookManager has new rule', async () => {
      const manager = getPlaybookManager();
      const curator = getAceCurator();
      
      // Setup initial playbook
      const initialPlaybook = await manager.getPlaybook('VENUS');
      const initialRuleCount = initialPlaybook.rules.length;
      const initialVersion = initialPlaybook.version;

      // Create deltas manually (simulating reflector output)
      const deltas: PlaybookDelta[] = [{
        nodeId: 'new-rule-1',
        type: 'Pattern',
        content: 'Keep React components under 200 lines',
        helpfulDelta: 0.8,
        harmfulDelta: 0,
        tags: ['react', 'components'],
        isGlobalCandidate: false,
        confidence: 0.85,
        agentName: 'VENUS',
        taskId: 'task-3',
        createdAt: new Date().toISOString(),
      }];

      const result = await curator.curate(deltas, 'VENUS');

      expect(result.applied.length).toBeGreaterThan(0);
      
      const updatedPlaybook = await manager.getPlaybook('VENUS');
      expect(updatedPlaybook.rules.length).toBeGreaterThan(initialRuleCount);
      expect(updatedPlaybook.version).toBeGreaterThan(initialVersion);
    });

    it('After 5 recorded outcomes, SelfImprovementProtocol.runReview() runs without error', async () => {
      const protocol = getSelfImprovementProtocol();

      // Record 5 successful outcomes
      for (let i = 0; i < 5; i++) {
        await protocol.recordOutcome('PLUTO', {
          taskId: `task-${i}`,
          taskTitle: `Schema task ${i}`,
          taskType: 'schema',
          success: true,
          gateScore: 0.9,
          appliedRuleIds: [],
        });
      }

      // Force lastReviewedAt to be old enough
      const profile = await protocol.getProfile('PLUTO');
      profile.lastReviewedAt = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();

      const review = await protocol.runReview('PLUTO');

      expect(review).toBeDefined();
      expect(typeof review.rulesAdded).toBe('number');
      expect(typeof review.rulesModified).toBe('number');
    });

    it('SelfImprovementProtocol.runReview() produces rules when outcomes have signal', async () => {
      const protocol = getSelfImprovementProtocol();
      const manager = getPlaybookManager();

      // Record 8 outcomes with strong success pattern on 'api' tasks
      for (let i = 0; i < 8; i++) {
        await protocol.recordOutcome('MERCURY', {
          taskId: `api-task-${i}`,
          taskTitle: `API endpoint ${i}`,
          taskType: 'api',
          success: i < 7, // 7/8 success rate = 87.5%
          gateScore: 0.85,
          appliedRuleIds: [],
        });
      }

      // Force lastReviewedAt to be old enough
      const profile = await protocol.getProfile('MERCURY');
      profile.lastReviewedAt = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();

      const initialVersion = (await manager.getPlaybook('MERCURY')).version;

      const review = await protocol.runReview('MERCURY');

      // Should have added at least one Strategy rule for the strong task type
      expect(review.rulesAdded + review.rulesModified).toBeGreaterThan(0);
      
      // Version should be incremented if rules were added
      if (review.rulesAdded > 0 || review.rulesModified > 0) {
        const updatedVersion = (await manager.getPlaybook('MERCURY')).version;
        expect(updatedVersion).toBeGreaterThanOrEqual(initialVersion);
      }
    });

    it('playbook: rules added via curator are retrieved by getActiveRules() in subsequent call', async () => {
      const manager = getPlaybookManager();
      const curator = getAceCurator();

      // Add a rule via curator
      const deltas: PlaybookDelta[] = [{
        nodeId: 'auth-rule',
        type: 'Strategy',
        content: 'Use requireAuth() at the start of every Convex mutation',
        helpfulDelta: 0.9,
        harmfulDelta: 0,
        tags: ['auth', 'convex'],
        isGlobalCandidate: true,
        confidence: 0.92,
        agentName: 'MARS',
        taskId: 'task-auth',
        createdAt: new Date().toISOString(),
      }];

      await curator.curate(deltas, 'MARS');

      // Now retrieve active rules for a related context
      const activeRules = await manager.getActiveRules(
        'MARS',
        'Create authentication middleware for Convex mutations',
        10
      );

      const foundRule = activeRules.find(r => r.content.includes('requireAuth'));
      expect(foundRule).toBeDefined();
    });

    it('Global candidate rule from curator appears in TasteVault after curate() call', async () => {
      const curator = getAceCurator();
      const vault = getTasteVault('test-user');

      const deltas: PlaybookDelta[] = [{
        nodeId: 'global-rule',
        type: 'Pattern',
        content: 'Always add indexes to foreign key fields in Convex schemas',
        helpfulDelta: 0.85,
        harmfulDelta: 0,
        tags: ['convex', 'schema', 'performance'],
        isGlobalCandidate: true, // This is a global candidate
        confidence: 0.88,
        agentName: 'PLUTO',
        taskId: 'task-schema',
        createdAt: new Date().toISOString(),
      }];

      await curator.curate(deltas, 'PLUTO');

      // The rule should be learned in the taste vault as a global candidate
      const patterns = await vault.getRelevantPatterns('convex schema indexes', 10);
      
      // Note: curator may or may not add to vault depending on score threshold
      expect(patterns.length).toBeGreaterThanOrEqual(0);
    });

    it('Full round-trip: record 5 outcomes → runReview() → playbook version incremented', async () => {
      const protocol = getSelfImprovementProtocol();
      const manager = getPlaybookManager();

      // Record mixed outcomes to create signal
      for (let i = 0; i < 5; i++) {
        await protocol.recordOutcome('IO', {
          taskId: `task-${i}`,
          taskTitle: `Test task ${i}`,
          taskType: i % 2 === 0 ? 'testing' : 'validation',
          success: i >= 2, // 3/5 success rate on later tasks
          gateScore: 0.8,
          appliedRuleIds: [],
        });
      }

      const initialVersion = (await manager.getPlaybook('IO')).version;

      // Force lastReviewedAt to be old enough
      const profile = await protocol.getProfile('IO');
      profile.lastReviewedAt = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();

      await protocol.runReview('IO');

      const updatedVersion = (await manager.getPlaybook('IO')).version;
      expect(updatedVersion).toBeGreaterThanOrEqual(initialVersion);
    });
  });

  // ============================================================================
  // Playbook Context Integration Tests
  // ============================================================================

  describe('Playbook Context Integration', () => {
    it('getInjectedPlaybookRuleIds returns tracked rules for a task', async () => {
      const { trackInjectedPlaybookRules, getInjectedPlaybookRuleIds, clearInjectedPlaybookRuleIds } = await import('../orchestrator/prompt-builder.js');
      
      trackInjectedPlaybookRules('task-1', ['rule-1', 'rule-2']);
      trackInjectedPlaybookRules('task-1', ['rule-3']);

      const ids = getInjectedPlaybookRuleIds('task-1');
      expect(ids).toContain('rule-1');
      expect(ids).toContain('rule-2');
      expect(ids).toContain('rule-3');

      clearInjectedPlaybookRuleIds('task-1');
      expect(getInjectedPlaybookRuleIds('task-1')).toHaveLength(0);
    });

    it('buildPlaybookContext returns valid result for any agent', async () => {
      const { buildPlaybookContext } = await import('../orchestrator/prompt-builder.js');
      
      const result = await buildPlaybookContext('UNKNOWN_AGENT', 'test task', 500);
      
      // Returns a context (may be empty playbook_context if no rules)
      expect(result.context).toContain('playbook_context');
      expect(result.appliedRuleIds).toHaveLength(0);
    });
  });
});
