// Tests for KIMI-AUTO-03: Interactive Plan Approval System

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  requestApproval,
  writePendingApproval,
  readApprovalResponse,
  pollForApproval,
  cancelApproval,
  formatPlanForApproval,
  getDefaultTimeoutForTask,
  writeApprovalResponse,
  getActivePollIds,
  clearAllPolls,
  type PlanApprovalOptions,
} from './plan-approval.js';
import type { Task } from '../types/index.js';
import { mkdirSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

// ═══════════════════════════════════════════════════════════════════════════════
// Test Helpers
// ═══════════════════════════════════════════════════════════════════════════════

const TEST_DIR = join(process.cwd(), '.nova-test', randomUUID());
const TEST_PLAN_FILE = join(TEST_DIR, 'pending-approval.json');
const TEST_RESPONSE_FILE = join(TEST_DIR, 'approval-response.json');

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'TEST-001',
    title: 'Test Task',
    description: 'A test task for plan approval',
    agent: 'EARTH',
    status: 'ready',
    dependencies: [],
    phase: 1,
    attempts: 0,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function getTestOptions(overrides: Partial<PlanApprovalOptions> = {}): PlanApprovalOptions {
  return {
    pollIntervalMs: 50, // Fast polling for tests
    planFilePath: TEST_PLAN_FILE,
    responseFilePath: TEST_RESPONSE_FILE,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Setup & Teardown
// ═══════════════════════════════════════════════════════════════════════════════

describe('plan-approval', () => {
  beforeEach(() => {
    // Create test directory
    if (!existsSync(TEST_DIR)) {
      mkdirSync(TEST_DIR, { recursive: true });
    }
    // Clear any active polls
    clearAllPolls();
  });

  afterEach(() => {
    // Clean up test directory
    clearAllPolls();
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
    // Clean up default location too
    const defaultDir = join(process.cwd(), '.nova');
    if (existsSync(defaultDir)) {
      try {
        const pendingFile = join(defaultDir, 'pending-approval.json');
        const responseFile = join(defaultDir, 'approval-response.json');
        if (existsSync(pendingFile)) rmSync(pendingFile);
        if (existsSync(responseFile)) rmSync(responseFile);
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // writePendingApproval Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('writePendingApproval', () => {
    it('creates a pending approval file with correct structure', () => {
      const task = makeTask();
      const plan = '1. First step\n2. Second step';

      const pending = writePendingApproval(plan, task, TEST_PLAN_FILE);

      expect(pending.id).toBeDefined();
      expect(pending.id.startsWith('approval-')).toBe(true);
      expect(pending.taskId).toBe('TEST-001');
      expect(pending.plan).toBe(plan);
      expect(pending.status).toBe('pending');
      expect(pending.timestamp).toBeDefined();
      expect(Date.parse(pending.timestamp)).not.toBeNaN();
    });

    it('writes the file to the specified path', () => {
      const task = makeTask();
      const plan = 'Test plan content';

      writePendingApproval(plan, task, TEST_PLAN_FILE);

      expect(existsSync(TEST_PLAN_FILE)).toBe(true);
      const content = JSON.parse(readFileSync(TEST_PLAN_FILE, 'utf-8'));
      expect(content.taskId).toBe('TEST-001');
      expect(content.plan).toBe(plan);
      expect(content.status).toBe('pending');
    });

    it('creates directories if they do not exist', () => {
      const nestedDir = join(TEST_DIR, 'nested', 'deep');
      const nestedFile = join(nestedDir, 'approval.json');
      const task = makeTask();

      writePendingApproval('plan', task, nestedFile);

      expect(existsSync(nestedFile)).toBe(true);
    });

    it('generates unique IDs for each call', () => {
      const task = makeTask();

      const pending1 = writePendingApproval('plan1', task, TEST_PLAN_FILE);
      const pending2 = writePendingApproval('plan2', task, TEST_PLAN_FILE + '2');

      expect(pending1.id).not.toBe(pending2.id);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // readApprovalResponse Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('readApprovalResponse', () => {
    it('returns null when response file does not exist', () => {
      const result = readApprovalResponse('approval-123', TEST_RESPONSE_FILE);
      expect(result).toBeNull();
    });

    it('returns null when response is for different approval ID', () => {
      writeApprovalResponse('approval-different', { type: 'approved' }, TEST_RESPONSE_FILE);

      const result = readApprovalResponse('approval-123', TEST_RESPONSE_FILE);
      expect(result).toBeNull();
    });

    it('parses approved response correctly', () => {
      const approvalId = 'approval-test-1';
      writeApprovalResponse(approvalId, { type: 'approved' }, TEST_RESPONSE_FILE);

      const result = readApprovalResponse(approvalId, TEST_RESPONSE_FILE);

      expect(result).toEqual({ type: 'approved' });
    });

    it('parses rejected response with reason correctly', () => {
      const approvalId = 'approval-test-2';
      writeApprovalResponse(
        approvalId,
        { type: 'rejected', reason: 'Plan is too complex' },
        TEST_RESPONSE_FILE
      );

      const result = readApprovalResponse(approvalId, TEST_RESPONSE_FILE);

      expect(result).toEqual({ type: 'rejected', reason: 'Plan is too complex' });
    });

    it('parses modified response with new plan correctly', () => {
      const approvalId = 'approval-test-3';
      const modifiedPlan = '1. Modified step\n2. Another step';
      writeApprovalResponse(
        approvalId,
        { type: 'modified', plan: modifiedPlan },
        TEST_RESPONSE_FILE
      );

      const result = readApprovalResponse(approvalId, TEST_RESPONSE_FILE);

      expect(result).toEqual({ type: 'modified', plan: modifiedPlan });
    });

    it('returns null for invalid JSON', () => {
      const fs = require('fs');
      fs.writeFileSync(TEST_RESPONSE_FILE, 'invalid json');

      const result = readApprovalResponse('approval-123', TEST_RESPONSE_FILE);
      expect(result).toBeNull();
    });

    it('handles missing reason in rejected response', () => {
      const approvalId = 'approval-test-4';
      const fs = require('fs');
      fs.writeFileSync(
        TEST_RESPONSE_FILE,
        JSON.stringify({ approvalId, result: 'rejected', timestamp: new Date().toISOString() })
      );

      const result = readApprovalResponse(approvalId, TEST_RESPONSE_FILE);

      expect(result).toEqual({ type: 'rejected', reason: 'No reason provided' });
    });

    it('handles missing modifiedPlan in modified response', () => {
      const approvalId = 'approval-test-5';
      const fs = require('fs');
      fs.writeFileSync(
        TEST_RESPONSE_FILE,
        JSON.stringify({ approvalId, result: 'modified', timestamp: new Date().toISOString() })
      );

      const result = readApprovalResponse(approvalId, TEST_RESPONSE_FILE);

      expect(result).toEqual({ type: 'modified', plan: '' });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // pollForApproval Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('pollForApproval', () => {
    it('resolves immediately when response file already exists', async () => {
      const pending = writePendingApproval('plan', makeTask(), TEST_PLAN_FILE);
      writeApprovalResponse(pending.id, { type: 'approved' }, TEST_RESPONSE_FILE);

      const options = getTestOptions({ timeoutMs: 1000 });
      const result = await pollForApproval(pending.id, options);

      expect(result).toEqual({ type: 'approved' });
    });

    it('waits for response and returns approved result', async () => {
      const pending = writePendingApproval('plan', makeTask(), TEST_PLAN_FILE);
      const options = getTestOptions({ timeoutMs: 5000 });

      // Write response after a short delay
      setTimeout(() => {
        writeApprovalResponse(pending.id, { type: 'approved' }, TEST_RESPONSE_FILE);
      }, 100);

      const result = await pollForApproval(pending.id, options);

      expect(result).toEqual({ type: 'approved' });
    });

    it('waits for response and returns rejected result', async () => {
      const pending = writePendingApproval('plan', makeTask(), TEST_PLAN_FILE);
      const options = getTestOptions({ timeoutMs: 5000 });

      setTimeout(() => {
        writeApprovalResponse(
          pending.id,
          { type: 'rejected', reason: 'Too risky' },
          TEST_RESPONSE_FILE
        );
      }, 100);

      const result = await pollForApproval(pending.id, options);

      expect(result).toEqual({ type: 'rejected', reason: 'Too risky' });
    });

    it('waits for response and returns modified result', async () => {
      const pending = writePendingApproval('plan', makeTask(), TEST_PLAN_FILE);
      const options = getTestOptions({ timeoutMs: 5000 });

      const modifiedPlan = 'Modified plan content';
      setTimeout(() => {
        writeApprovalResponse(
          pending.id,
          { type: 'modified', plan: modifiedPlan },
          TEST_RESPONSE_FILE
        );
      }, 100);

      const result = await pollForApproval(pending.id, options);

      expect(result).toEqual({ type: 'modified', plan: modifiedPlan });
    });

    it('auto-approves when timeout is reached', async () => {
      const pending = writePendingApproval('plan', makeTask(), TEST_PLAN_FILE);
      const options = getTestOptions({ timeoutMs: 100 }); // Short timeout

      const startTime = Date.now();
      const result = await pollForApproval(pending.id, options);
      const elapsed = Date.now() - startTime;

      expect(result).toEqual({ type: 'approved' });
      expect(elapsed).toBeGreaterThanOrEqual(90);
      expect(elapsed).toBeLessThan(300);
    });

    it('uses infinite timeout when timeoutMs is 0', async () => {
      const pending = writePendingApproval('plan', makeTask(), TEST_PLAN_FILE);
      const options = getTestOptions({ timeoutMs: 0 });

      // Write response after a short delay
      setTimeout(() => {
        writeApprovalResponse(pending.id, { type: 'approved' }, TEST_RESPONSE_FILE);
      }, 100);

      const result = await pollForApproval(pending.id, options);
      expect(result).toEqual({ type: 'approved' });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // cancelApproval Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('cancelApproval', () => {
    it('rejects the poll promise when cancelled', async () => {
      const pending = writePendingApproval('plan', makeTask(), TEST_PLAN_FILE);
      const options = getTestOptions({ timeoutMs: 0 });

      const pollPromise = pollForApproval(pending.id, options);

      // Cancel after a short delay
      setTimeout(() => {
        cancelApproval(pending.id);
      }, 50);

      await expect(pollPromise).rejects.toThrow('cancelled');
    });

    it('removes the poll from active polls', async () => {
      const pending = writePendingApproval('plan', makeTask(), TEST_PLAN_FILE);
      const options = getTestOptions({ timeoutMs: 0 });

      // Start polling but don't await
      pollForApproval(pending.id, options).catch(() => {});

      // Wait for poll to be registered
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(getActivePollIds()).toContain(pending.id);

      cancelApproval(pending.id);

      expect(getActivePollIds()).not.toContain(pending.id);
    });

    it('does nothing for non-existent approval ID', () => {
      expect(() => cancelApproval('non-existent-id')).not.toThrow();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // requestApproval Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('requestApproval', () => {
    it('returns approved result when approved', async () => {
      const task = makeTask();
      const plan = 'Test plan';
      const options = getTestOptions({ timeoutMs: 5000 });

      // Write response after a delay
      setTimeout(() => {
        writeApprovalResponse(
          // The ID will be generated, so we need to capture it
          // We'll use a workaround by checking the file
          JSON.parse(readFileSync(TEST_PLAN_FILE, 'utf-8')).id,
          { type: 'approved' },
          TEST_RESPONSE_FILE
        );
      }, 100);

      const result = await requestApproval(plan, task, options);
      expect(result.type).toBe('approved');
    });

    it('returns rejected result when rejected', async () => {
      const task = makeTask();
      const plan = 'Test plan';
      const options = getTestOptions({ timeoutMs: 5000 });

      // Start approval request in background
      const approvalPromise = requestApproval(plan, task, options);

      // Wait for plan file to be created, then write response
      await new Promise(resolve => setTimeout(resolve, 50));
      const pendingContent = JSON.parse(readFileSync(TEST_PLAN_FILE, 'utf-8'));
      writeApprovalResponse(
        pendingContent.id,
        { type: 'rejected', reason: 'Not good enough' },
        TEST_RESPONSE_FILE
      );

      const result = await approvalPromise;
      expect(result).toEqual({ type: 'rejected', reason: 'Not good enough' });
    });

    it('cleans up files after completion', async () => {
      const task = makeTask();
      const options = getTestOptions({ timeoutMs: 100 });

      await requestApproval('plan', task, options);

      // Files should be cleaned up
      expect(existsSync(TEST_PLAN_FILE)).toBe(false);
      expect(existsSync(TEST_RESPONSE_FILE)).toBe(false);
    });

    it('cleans up files even on error', async () => {
      const task = makeTask();
      const options = getTestOptions({ timeoutMs: 0 });

      const promise = requestApproval('plan', task, options);

      // Cancel to trigger error
      setTimeout(() => {
        try {
          const content = readFileSync(TEST_PLAN_FILE, 'utf-8');
          const { id } = JSON.parse(content);
          cancelApproval(id);
        } catch {
          // Ignore
        }
      }, 50);

      await expect(promise).rejects.toThrow();

      // Files should still be cleaned up
      expect(existsSync(TEST_PLAN_FILE)).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // formatPlanForApproval Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('formatPlanForApproval', () => {
    it('includes task ID in header', () => {
      const task = makeTask({ id: 'TASK-123' });
      const formatted = formatPlanForApproval('Plan text', task);
      expect(formatted).toContain('TASK-123');
    });

    it('includes task title', () => {
      const task = makeTask({ title: 'My Special Task' });
      const formatted = formatPlanForApproval('Plan text', task);
      expect(formatted).toContain('My Special Task');
    });

    it('includes task agent', () => {
      const task = makeTask({ agent: 'MARS' });
      const formatted = formatPlanForApproval('Plan text', task);
      expect(formatted).toContain('MARS');
    });

    it('includes task description', () => {
      const task = makeTask({ description: 'This is a detailed description' });
      const formatted = formatPlanForApproval('Plan text', task);
      expect(formatted).toContain('This is a detailed description');
    });

    it('includes the plan content', () => {
      const plan = '1. First step\n2. Second step\n3. Third step';
      const formatted = formatPlanForApproval(plan, makeTask());
      expect(formatted).toContain('1. First step');
      expect(formatted).toContain('2. Second step');
      expect(formatted).toContain('3. Third step');
    });

    it('includes action instructions', () => {
      const formatted = formatPlanForApproval('Plan', makeTask());
      expect(formatted).toContain('[APPROVE]');
      expect(formatted).toContain('[REJECT]');
      expect(formatted).toContain('[MODIFY]');
    });

    it('wraps long descriptions', () => {
      const longDescription = 'A'.repeat(200);
      const task = makeTask({ description: longDescription });
      const formatted = formatPlanForApproval('Plan', task);
      // Should be formatted in box style
      expect(formatted).toContain('║');
    });

    it('wraps long plan lines', () => {
      const longPlan = 'A'.repeat(200);
      const formatted = formatPlanForApproval(longPlan, makeTask());
      expect(formatted).toContain('║');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getDefaultTimeoutForTask Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getDefaultTimeoutForTask', () => {
    const originalEnv = process.env.NOVA26_AUTONOMY_LEVEL;

    afterEach(() => {
      process.env.NOVA26_AUTONOMY_LEVEL = originalEnv;
    });

    it('returns 0 (infinite) for level 1', () => {
      process.env.NOVA26_AUTONOMY_LEVEL = '1';
      const task = makeTask();
      expect(getDefaultTimeoutForTask(task)).toBe(0);
    });

    it('returns 0 (infinite) for level 2', () => {
      process.env.NOVA26_AUTONOMY_LEVEL = '2';
      const task = makeTask();
      expect(getDefaultTimeoutForTask(task)).toBe(0);
    });

    it('returns 5 minutes for level 3', () => {
      process.env.NOVA26_AUTONOMY_LEVEL = '3';
      const task = makeTask();
      expect(getDefaultTimeoutForTask(task)).toBe(5 * 60 * 1000);
    });

    it('returns 1 minute for level 4', () => {
      process.env.NOVA26_AUTONOMY_LEVEL = '4';
      const task = makeTask();
      expect(getDefaultTimeoutForTask(task)).toBe(60 * 1000);
    });

    it('returns 1 minute for level 5', () => {
      process.env.NOVA26_AUTONOMY_LEVEL = '5';
      const task = makeTask();
      expect(getDefaultTimeoutForTask(task)).toBe(60 * 1000);
    });

    it('defaults to level 3 when env is not set', () => {
      delete process.env.NOVA26_AUTONOMY_LEVEL;
      const task = makeTask();
      expect(getDefaultTimeoutForTask(task)).toBe(5 * 60 * 1000);
    });

    it('defaults to level 3 when env is invalid', () => {
      process.env.NOVA26_AUTONOMY_LEVEL = 'invalid';
      const task = makeTask();
      expect(getDefaultTimeoutForTask(task)).toBe(5 * 60 * 1000);
    });

    it('uses task context autonomy level when provided', () => {
      process.env.NOVA26_AUTONOMY_LEVEL = '5'; // Would be 1 minute
      const task = makeTask({ context: { autonomyLevel: 1 } }); // But task says infinite
      expect(getDefaultTimeoutForTask(task)).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // writeApprovalResponse Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('writeApprovalResponse', () => {
    it('writes approved response correctly', () => {
      writeApprovalResponse('approval-1', { type: 'approved' }, TEST_RESPONSE_FILE);

      const content = JSON.parse(readFileSync(TEST_RESPONSE_FILE, 'utf-8'));
      expect(content.approvalId).toBe('approval-1');
      expect(content.result).toBe('approved');
      expect(content.timestamp).toBeDefined();
    });

    it('writes rejected response with reason', () => {
      writeApprovalResponse(
        'approval-2',
        { type: 'rejected', reason: 'Too complex' },
        TEST_RESPONSE_FILE
      );

      const content = JSON.parse(readFileSync(TEST_RESPONSE_FILE, 'utf-8'));
      expect(content.approvalId).toBe('approval-2');
      expect(content.result).toBe('rejected');
      expect(content.reason).toBe('Too complex');
    });

    it('writes modified response with plan', () => {
      writeApprovalResponse(
        'approval-3',
        { type: 'modified', plan: 'New plan' },
        TEST_RESPONSE_FILE
      );

      const content = JSON.parse(readFileSync(TEST_RESPONSE_FILE, 'utf-8'));
      expect(content.approvalId).toBe('approval-3');
      expect(content.result).toBe('modified');
      expect(content.modifiedPlan).toBe('New plan');
    });

    it('creates directories if needed', () => {
      const nestedFile = join(TEST_DIR, 'deeply', 'nested', 'response.json');
      writeApprovalResponse('approval-4', { type: 'approved' }, nestedFile);
      expect(existsSync(nestedFile)).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Integration Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('integration', () => {
    it('handles full approval workflow', async () => {
      const task = makeTask({ id: 'INT-001' });
      const plan = '1. Analyze\n2. Design\n3. Implement';
      const options = getTestOptions({ timeoutMs: 5000 });

      // Start approval request
      const approvalPromise = requestApproval(plan, task, options);

      // Simulate user approval after a short delay
      await new Promise(resolve => setTimeout(resolve, 100));
      const pendingContent = JSON.parse(readFileSync(TEST_PLAN_FILE, 'utf-8'));
      writeApprovalResponse(pendingContent.id, { type: 'approved' }, TEST_RESPONSE_FILE);

      const result = await approvalPromise;

      expect(result).toEqual({ type: 'approved' });
      // Files should be cleaned up
      expect(existsSync(TEST_PLAN_FILE)).toBe(false);
      expect(existsSync(TEST_RESPONSE_FILE)).toBe(false);
    });

    it('handles full rejection workflow', async () => {
      const task = makeTask({ id: 'INT-002' });
      const plan = 'Some plan';
      const options = getTestOptions({ timeoutMs: 5000 });

      const approvalPromise = requestApproval(plan, task, options);

      await new Promise(resolve => setTimeout(resolve, 100));
      const pendingContent = JSON.parse(readFileSync(TEST_PLAN_FILE, 'utf-8'));
      writeApprovalResponse(
        pendingContent.id,
        { type: 'rejected', reason: 'Security concerns' },
        TEST_RESPONSE_FILE
      );

      const result = await approvalPromise;

      expect(result).toEqual({ type: 'rejected', reason: 'Security concerns' });
    });

    it('handles full modification workflow', async () => {
      const task = makeTask({ id: 'INT-003' });
      const plan = 'Original plan';
      const modifiedPlan = 'Modified plan with improvements';
      const options = getTestOptions({ timeoutMs: 5000 });

      const approvalPromise = requestApproval(plan, task, options);

      await new Promise(resolve => setTimeout(resolve, 100));
      const pendingContent = JSON.parse(readFileSync(TEST_PLAN_FILE, 'utf-8'));
      writeApprovalResponse(
        pendingContent.id,
        { type: 'modified', plan: modifiedPlan },
        TEST_RESPONSE_FILE
      );

      const result = await approvalPromise;

      expect(result).toEqual({ type: 'modified', plan: modifiedPlan });
    });

    it('handles timeout with auto-approval', async () => {
      const task = makeTask({ id: 'INT-004' });
      const plan = 'Auto-approve plan';
      const options = getTestOptions({ timeoutMs: 100 }); // Very short timeout

      const result = await requestApproval(plan, task, options);

      expect(result).toEqual({ type: 'approved' });
    });
  });
});
