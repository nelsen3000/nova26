// Checkpoint Manager Tests
// Spec: .kiro/specs/agent-harnesses/tasks.md

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CheckpointManager } from './checkpoint.js';
import { RecoveryManager } from './recovery.js';
import type { HarnessState, HarnessConfig } from './types.js';

// Test configuration
const TEST_CONFIG: HarnessConfig = {
  id: 'test-harness',
  name: 'Test Harness',
  agentId: 'test-agent',
  task: 'Test task',
  priority: 'normal',
  timeoutMs: 60000,
  maxRetries: 3,
  autonomyLevel: 3,
  maxDepth: 3,
  depth: 0,
  allowedTools: [],
  budget: { maxToolCalls: 100, maxTokens: 10000, maxCost: 10 },
  checkpointIntervalMs: 300000,
  dreamModeEnabled: false,
  overnightEvolutionEnabled: false,
};

const TEST_STATE: HarnessState = {
  schemaVersion: 1,
  config: TEST_CONFIG,
  status: 'running',
  createdAt: Date.now(),
  startedAt: Date.now(),
  currentStepIndex: 0,
  toolCallHistory: [],
  subAgentIds: [],
  toolCallCount: 5,
  tokenCount: 1000,
  cost: 0.5,
  retryCount: 0,
  context: { key: 'value' },
};

describe('CheckpointManager', () => {
  let manager: CheckpointManager;

  beforeEach(() => {
    manager = new CheckpointManager({ baseDir: './test-checkpoints' });
  });

  afterEach(async () => {
    await manager.deleteAll('test-harness');
  });

  it('should save and restore a checkpoint', async () => {
    const checkpoint = await manager.save('test-harness', TEST_STATE);
    
    expect(checkpoint.harnessId).toBe('test-harness');
    expect(checkpoint.state).toBeDefined();
    expect(checkpoint.hash).toBeDefined();

    const restored = await manager.restore(checkpoint.id);
    expect(restored.config.id).toBe(TEST_STATE.config.id);
    expect(restored.status).toBe(TEST_STATE.status);
    expect(restored.context.key).toBe('value');
  });

  it('should list checkpoints for a harness', async () => {
    await manager.save('test-harness', TEST_STATE);
    await manager.save('test-harness', { ...TEST_STATE, tokenCount: 2000 });

    const checkpoints = await manager.list('test-harness');
    expect(checkpoints.length).toBe(2);
  });

  it('should get latest checkpoint', async () => {
    await manager.save('test-harness', TEST_STATE);
    await new Promise(r => setTimeout(r, 10));
    await manager.save('test-harness', { ...TEST_STATE, tokenCount: 3000 });

    const latest = await manager.getLatest('test-harness');
    expect(latest).toBeDefined();
    expect(latest!.state).toBeDefined();
  });

  it('should prune old checkpoints', async () => {
    await manager.save('test-harness', TEST_STATE, { maxRetained: 5 });
    await manager.save('test-harness', { ...TEST_STATE, tokenCount: 100 }, { maxRetained: 5 });
    await manager.save('test-harness', { ...TEST_STATE, tokenCount: 200 }, { maxRetained: 5 });

    const pruned = await manager.prune('test-harness', 2);
    expect(pruned).toBe(1);

    const remaining = await manager.list('test-harness');
    expect(remaining.length).toBe(2);
  });

  it('should auto-save checkpoints', async () => {
    let callCount = 0;
    
    manager.startAutoCheckpoint(
      'test-harness',
      () => {
        callCount++;
        return TEST_STATE;
      },
      50
    );

    await new Promise(r => setTimeout(r, 150));
    manager.stopAutoCheckpoint('test-harness');

    expect(callCount).toBeGreaterThanOrEqual(2);
  });
});

describe('RecoveryManager', () => {
  let checkpointManager: CheckpointManager;
  let recoveryManager: RecoveryManager;

  beforeEach(async () => {
    checkpointManager = new CheckpointManager({ baseDir: './test-checkpoints' });
    recoveryManager = new RecoveryManager({ checkpointManager });
    
    // Save a checkpoint for recovery
    await checkpointManager.save('test-harness', TEST_STATE);
  });

  afterEach(async () => {
    await checkpointManager.deleteAll('test-harness');
  });

  it('should recover from checkpoint', async () => {
    const result = await recoveryManager.attemptRecovery('test-harness', 'test failure');
    
    expect(result.success).toBe(true);
    expect(result.state).toBeDefined();
    expect(result.state!.config.id).toBe('test-harness');
  });

  it('should retry with exponential backoff', async () => {
    const startTime = Date.now();
    
    // First attempt
    await recoveryManager.attemptRecovery('test-harness', 'failure 1', {
      type: 'retry',
      maxAttempts: 3,
      backoffMs: 100,
      exponentialBackoff: true,
    });

    const afterFirst = Date.now();
    
    // Second attempt
    await recoveryManager.attemptRecovery('test-harness', 'failure 2', {
      type: 'retry',
      maxAttempts: 3,
      backoffMs: 100,
      exponentialBackoff: true,
    });

    const afterSecond = Date.now();

    // Second attempt should have ~200ms delay (100 * 2^1)
    expect(afterSecond - afterFirst).toBeGreaterThanOrEqual(150);
  });

  it('should track retry attempts', async () => {
    await recoveryManager.attemptRecovery('test-harness', 'failure');
    expect(recoveryManager.getRetryCount('test-harness')).toBe(1);

    await recoveryManager.attemptRecovery('test-harness', 'failure');
    expect(recoveryManager.getRetryCount('test-harness')).toBe(2);

    recoveryManager.resetRetryCount('test-harness');
    expect(recoveryManager.getRetryCount('test-harness')).toBe(0);
  });

  it('should move to dead letter after max attempts', async () => {
    for (let i = 0; i < 4; i++) {
      await recoveryManager.attemptRecovery('no-checkpoint-harness', 'failure', {
        type: 'retry',
        maxAttempts: 3,
        backoffMs: 10,
        exponentialBackoff: false,
      });
    }

    const deadLetters = recoveryManager.listDeadLetters();
    expect(deadLetters.length).toBeGreaterThan(0);
  });

  it('should degrade autonomy level on degrade strategy', async () => {
    const result = await recoveryManager.attemptRecovery('test-harness', 'failure', {
      type: 'degrade',
      maxAttempts: 3,
      backoffMs: 100,
      exponentialBackoff: false,
    });

    expect(result.success).toBe(true);
    expect(result.state!.config.autonomyLevel).toBe(2); // Degraded from 3
  });
});
