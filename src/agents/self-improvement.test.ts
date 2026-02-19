// KIMI-ACE-04: Agent Self-Improvement Protocol Tests

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  getSelfImprovementProtocol,
  resetSelfImprovementProtocol,
} from './self-improvement.js';
import { resetPlaybookManager } from '../ace/playbook.js';
import { resetAceCurator } from '../ace/curator.js';
import { getTasteVault, resetTasteVault } from '../taste-vault/taste-vault.js';
import { resetGraphMemory } from '../taste-vault/graph-memory.js';

// ============================================================================
// Test Setup
// ============================================================================

describe('SelfImprovementProtocol', () => {
  let protocol: ReturnType<typeof getSelfImprovementProtocol>;
  let tempDir: string;
  let originalCwd: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'nova26-self-improvement-test-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);

    // Reset all singletons
    resetSelfImprovementProtocol();
    resetPlaybookManager();
    resetAceCurator();
    resetTasteVault();
    resetGraphMemory();

    protocol = getSelfImprovementProtocol();
  });

  afterEach(() => {
    process.chdir(originalCwd);

    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }

    // Reset singletons
    resetSelfImprovementProtocol();
    resetPlaybookManager();
    resetAceCurator();
    resetTasteVault();
    resetGraphMemory();
  });

  // ============================================================================
  // Test 1: Get Default Profile
  // ============================================================================

  it('should return default profile for new agent', async () => {
    const profile = await protocol.getProfile('TestAgent');

    expect(profile.agentName).toBe('TestAgent');
    expect(profile.totalTasks).toBe(0);
    expect(profile.successRate).toBe(0);
    expect(profile.avgGateScore).toBe(0);
    expect(profile.recentOutcomes).toEqual([]);
  });

  // ============================================================================
  // Test 2: Record Outcome
  // ============================================================================

  it('should record outcome and update profile', async () => {
    await protocol.recordOutcome('TestAgent', {
      taskId: 'task-1',
      taskTitle: 'Test Task',
      taskType: 'coding',
      success: true,
      gateScore: 0.95,
      appliedRuleIds: ['rule-1'],
    });

    const profile = await protocol.getProfile('TestAgent');
    expect(profile.totalTasks).toBe(1);
    expect(profile.successRate).toBe(1);
    expect(profile.recentOutcomes).toHaveLength(1);
    expect(profile.recentOutcomes[0].taskId).toBe('task-1');
    expect(profile.recentOutcomes[0].timestamp).toBeDefined();
  });

  // ============================================================================
  // Test 3: Record Multiple Outcomes
  // ============================================================================

  it('should record multiple outcomes and compute stats', async () => {
    await protocol.recordOutcome('TestAgent', {
      taskId: 'task-1',
      taskTitle: 'Task 1',
      taskType: 'coding',
      success: true,
      gateScore: 0.9,
      appliedRuleIds: [],
    });

    await protocol.recordOutcome('TestAgent', {
      taskId: 'task-2',
      taskTitle: 'Task 2',
      taskType: 'testing',
      success: false,
      gateScore: 0.4,
      appliedRuleIds: [],
    });

    const profile = await protocol.getProfile('TestAgent');
    expect(profile.totalTasks).toBe(2);
    expect(profile.successRate).toBe(0.5);
    expect(profile.avgGateScore).toBe(0.65);
  });

  // ============================================================================
  // Test 4: Cap Recent Outcomes at 20
  // ============================================================================

  it('should cap recent outcomes at 20 entries', async () => {
    // Record 25 outcomes
    for (let i = 0; i < 25; i++) {
      await protocol.recordOutcome('TestAgent', {
        taskId: `task-${i}`,
        taskTitle: `Task ${i}`,
        taskType: 'coding',
        success: i % 2 === 0,
        appliedRuleIds: [],
      });
    }

    const profile = await protocol.getProfile('TestAgent');
    expect(profile.recentOutcomes).toHaveLength(20);
    // Oldest should be dropped (task-5, not task-0)
    expect(profile.recentOutcomes[0].taskId).toBe('task-5');
  });

  // ============================================================================
  // Test 5: Persist and Load Profile
  // ============================================================================

  it('should persist and load profile from disk', async () => {
    await protocol.recordOutcome('TestAgent', {
      taskId: 'task-1',
      taskTitle: 'Test Task',
      taskType: 'coding',
      success: true,
      appliedRuleIds: [],
    });

    await protocol.persist('TestAgent');

    // Create new protocol instance
    resetSelfImprovementProtocol();
    const newProtocol = getSelfImprovementProtocol();

    const loaded = await newProtocol.load('TestAgent');
    expect(loaded).not.toBeNull();
    expect(loaded!.agentName).toBe('TestAgent');
    expect(loaded!.totalTasks).toBe(1);
  });

  // ============================================================================
  // Test 6: Load Returns Null for Non-existent Profile
  // ============================================================================

  it('should return null when loading non-existent profile', async () => {
    const loaded = await protocol.load('NonExistentAgent');
    expect(loaded).toBeNull();
  });

  // ============================================================================
  // Test 7: Run Review - Insufficient Tasks
  // ============================================================================

  it('should skip review if less than 5 tasks', async () => {
    // Record only 3 tasks
    for (let i = 0; i < 3; i++) {
      await protocol.recordOutcome('TestAgent', {
        taskId: `task-${i}`,
        taskTitle: `Task ${i}`,
        taskType: 'coding',
        success: true,
        appliedRuleIds: [],
      });
    }

    const result = await protocol.runReview('TestAgent');
    expect(result.rulesAdded).toBe(0);
    expect(result.rulesModified).toBe(0);
    expect(result.reviewSummary).toContain('insufficient tasks');
  });

  // ============================================================================
  // Test 8: Run Review - Too Soon After Last Review
  // ============================================================================

  it('should skip review if less than 7 days since last review', async () => {
    // Record 5 tasks
    for (let i = 0; i < 5; i++) {
      await protocol.recordOutcome('TestAgent', {
        taskId: `task-${i}`,
        taskTitle: `Task ${i}`,
        taskType: 'coding',
        success: true,
        appliedRuleIds: [],
      });
    }

    // Run first review
    await protocol.runReview('TestAgent');

    // Run second review immediately
    const result = await protocol.runReview('TestAgent');
    expect(result.reviewSummary).toContain('last review was');
  });

  // ============================================================================
  // Test 9: Run Review - Identifies Failing Patterns
  // ============================================================================

  it('should identify failing patterns and create Mistake deltas', async () => {
    // Record 5 tasks with low success rate for 'ui' type
    for (let i = 0; i < 5; i++) {
      await protocol.recordOutcome('TestAgent', {
        taskId: `task-${i}`,
        taskTitle: `Task ${i}`,
        taskType: 'ui',
        success: i === 0, // Only 1 success = 20% success rate
        appliedRuleIds: [],
      });
    }

    // Set lastReviewedAt to past to bypass 7-day check
    const profile = await protocol.getProfile('TestAgent');
    profile.lastReviewedAt = '2020-01-01T00:00:00.000Z';

    const result = await protocol.runReview('TestAgent');
    expect(result.reviewSummary).toContain('Failing patterns');
    expect(result.reviewSummary).toContain('ui');
  });

  // ============================================================================
  // Test 10: Run Review - Identifies Succeeding Patterns
  // ============================================================================

  it('should identify succeeding patterns and create Strategy deltas', async () => {
    // Record 5 tasks with high success rate for 'api' type
    for (let i = 0; i < 5; i++) {
      await protocol.recordOutcome('TestAgent', {
        taskId: `task-${i}`,
        taskTitle: `Task ${i}`,
        taskType: 'api',
        success: true, // 100% success rate
        appliedRuleIds: [],
      });
    }

    // Set lastReviewedAt to past
    const profile = await protocol.getProfile('TestAgent');
    profile.lastReviewedAt = '2020-01-01T00:00:00.000Z';

    const result = await protocol.runReview('TestAgent');
    expect(result.reviewSummary).toContain('Succeeding patterns');
    expect(result.reviewSummary).toContain('api');
  });

  // ============================================================================
  // Test 11: Run Review - Updates Strong and Weak Task Types
  // ============================================================================

  it('should update strong and weak task types after review', async () => {
    // Record tasks with different success rates
    for (let i = 0; i < 3; i++) {
      await protocol.recordOutcome('TestAgent', {
        taskId: `api-task-${i}`,
        taskTitle: `API Task ${i}`,
        taskType: 'api',
        success: true,
        appliedRuleIds: [],
      });
    }

    for (let i = 0; i < 3; i++) {
      await protocol.recordOutcome('TestAgent', {
        taskId: `ui-task-${i}`,
        taskTitle: `UI Task ${i}`,
        taskType: 'ui',
        success: false,
        appliedRuleIds: [],
      });
    }

    // Set lastReviewedAt to past
    const profile = await protocol.getProfile('TestAgent');
    profile.lastReviewedAt = '2020-01-01T00:00:00.000Z';

    await protocol.runReview('TestAgent');

    expect(profile.strongTaskTypes).toContain('api');
    expect(profile.weakTaskTypes).toContain('ui');
  });

  // ============================================================================
  // Test 12: Get Style Adaptations from TasteVault
  // ============================================================================

  it('should get style adaptations from taste vault', async () => {
    const tasteVault = getTasteVault('test-user');

    // Learn some patterns with agent tag
    await tasteVault.learn({
      type: 'Pattern',
      content: 'Use async/await for API calls',
      tags: ['testagent', 'api', 'async'],
      confidence: 0.9,
    });

    await tasteVault.learn({
      type: 'Preference',
      content: 'Prefer functional components',
      tags: ['testagent', 'react', 'functional'],
      confidence: 0.85,
    });

    const adaptations = await protocol.getStyleAdaptations('TestAgent', 'test-user');

    expect(adaptations.length).toBeGreaterThan(0);
    expect(adaptations[0].source).toBe('taste-vault');
    expect(adaptations[0].confidence).toBeGreaterThan(0);
  });

  // ============================================================================
  // Test 13: Style Adaptations Include Self-Observed
  // ============================================================================

  it('should include self-observed adaptations in style adaptations', async () => {
    // Record successful tasks
    for (let i = 0; i < 5; i++) {
      await protocol.recordOutcome('TestAgent', {
        taskId: `task-${i}`,
        taskTitle: `Task ${i}`,
        taskType: 'backend',
        success: true,
        appliedRuleIds: [],
      });
    }

    // Set strong task types directly
    const profile = await protocol.getProfile('TestAgent');
    profile.strongTaskTypes = ['backend'];

    const adaptations = await protocol.getStyleAdaptations('TestAgent', 'test-user');

    const selfObserved = adaptations.find(a => a.source === 'self-observed');
    expect(selfObserved).toBeDefined();
    expect((selfObserved as {preference: string}).preference).toContain('backend');
  });

  // ============================================================================
  // Test 14: Style Adaptations Sorted by Confidence
  // ============================================================================

  it('should sort style adaptations by confidence descending', async () => {
    const tasteVault = getTasteVault('test-user');

    // Learn patterns with different confidences
    await tasteVault.learn({
      type: 'Pattern',
      content: 'Low confidence pattern',
      tags: ['testagent'],
      confidence: 0.5,
    });

    await tasteVault.learn({
      type: 'Pattern',
      content: 'High confidence pattern',
      tags: ['testagent'],
      confidence: 0.95,
    });

    await tasteVault.learn({
      type: 'Pattern',
      content: 'Medium confidence pattern',
      tags: ['testagent'],
      confidence: 0.75,
    });

    const adaptations = await protocol.getStyleAdaptations('TestAgent', 'test-user');

    // Check that adaptations are sorted by confidence descending
    for (let i = 1; i < adaptations.length; i++) {
      expect(adaptations[i - 1].confidence).toBeGreaterThanOrEqual(adaptations[i].confidence);
    }
  });

  // ============================================================================
  // Test 15: Review Summary Format
  // ============================================================================

  it('should generate comprehensive review summary', async () => {
    // Record mixed tasks
    for (let i = 0; i < 3; i++) {
      await protocol.recordOutcome('TestAgent', {
        taskId: `good-${i}`,
        taskTitle: `Good Task ${i}`,
        taskType: 'optimization',
        success: true,
        gateScore: 0.95,
        appliedRuleIds: [],
      });
    }

    for (let i = 0; i < 3; i++) {
      await protocol.recordOutcome('TestAgent', {
        taskId: `bad-${i}`,
        taskTitle: `Bad Task ${i}`,
        taskType: 'refactoring',
        success: false,
        gateScore: 0.3,
        appliedRuleIds: [],
      });
    }

    // Set lastReviewedAt to past
    const profile = await protocol.getProfile('TestAgent');
    profile.lastReviewedAt = '2020-01-01T00:00:00.000Z';

    const result = await protocol.runReview('TestAgent');

    expect(result.reviewSummary).toContain('Review for TestAgent');
    expect(result.reviewSummary).toContain('Total tasks');
    expect(result.reviewSummary).toContain('Overall success rate');
    expect(result.reviewSummary).toContain('Average gate score');
    expect(result.reviewSummary).toContain('Changes applied');
  });
});

// ============================================================================
// Additional Edge Case Tests
// ============================================================================

describe('SelfImprovementProtocol Edge Cases', () => {
  let protocol: ReturnType<typeof getSelfImprovementProtocol>;
  let tempDir: string;
  let originalCwd: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'nova26-self-improvement-edge-test-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);

    resetSelfImprovementProtocol();
    resetPlaybookManager();
    resetAceCurator();
    resetTasteVault();
    resetGraphMemory();

    protocol = getSelfImprovementProtocol();
  });

  afterEach(() => {
    process.chdir(originalCwd);

    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }

    resetSelfImprovementProtocol();
    resetPlaybookManager();
    resetAceCurator();
    resetTasteVault();
    resetGraphMemory();
  });

  it('should handle outcomes without gate scores', async () => {
    await protocol.recordOutcome('TestAgent', {
      taskId: 'task-1',
      taskTitle: 'Task without gate score',
      taskType: 'coding',
      success: true,
      // No gateScore
      appliedRuleIds: [],
    });

    const profile = await protocol.getProfile('TestAgent');
    expect(profile.avgGateScore).toBe(0);
    expect(profile.totalTasks).toBe(1);
  });

  it('should handle multiple agents independently', async () => {
    await protocol.recordOutcome('AgentA', {
      taskId: 'task-a',
      taskTitle: 'Task A',
      taskType: 'coding',
      success: true,
      appliedRuleIds: [],
    });

    await protocol.recordOutcome('AgentB', {
      taskId: 'task-b',
      taskTitle: 'Task B',
      taskType: 'testing',
      success: false,
      appliedRuleIds: [],
    });

    const profileA = await protocol.getProfile('AgentA');
    const profileB = await protocol.getProfile('AgentB');

    expect(profileA.totalTasks).toBe(1);
    expect(profileA.successRate).toBe(1);
    expect(profileB.totalTasks).toBe(1);
    expect(profileB.successRate).toBe(0);
  });

  it('should handle empty style adaptations gracefully', async () => {
    const adaptations = await protocol.getStyleAdaptations('UnknownAgent', 'unknown-user');
    expect(adaptations).toEqual([]);
  });
});
