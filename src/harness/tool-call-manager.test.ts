// Tool Call Manager Tests - K3-28
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ToolCallManager,
  createToolCallManager,
  DEFAULT_TOOL_CONFIG,
} from './tool-call-manager.js';
import type { HarnessConfig } from './types.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeHarnessConfig(overrides: Partial<HarnessConfig> = {}): HarnessConfig {
  return {
    id: 'h1',
    name: 'TCM Test',
    agentId: 'agent-tcm',
    task: 'test',
    priority: 'normal',
    timeoutMs: 0,
    maxRetries: 3,
    autonomyLevel: 3,
    maxDepth: 1,
    depth: 0,
    allowedTools: ['bash', 'read', 'write'],
    budget: { maxToolCalls: 5, maxTokens: 1000, maxCost: 10 },
    checkpointIntervalMs: 30000,
    dreamModeEnabled: false,
    overnightEvolutionEnabled: false,
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ToolCallManager', () => {
  let manager: ToolCallManager;

  beforeEach(() => {
    manager = createToolCallManager(makeHarnessConfig(), {
      maxRetries: 0,
      baseBackoffMs: 10,
      maxBackoffMs: 100,
      timeoutMs: 5000,
    });
  });

  describe('isPermitted()', () => {
    it('permits tools in allowedTools list', () => {
      expect(manager.isPermitted('bash')).toBe(true);
      expect(manager.isPermitted('read')).toBe(true);
    });

    it('denies tools not in allowedTools', () => {
      expect(manager.isPermitted('dangerous-tool')).toBe(false);
    });
  });

  describe('requiresApproval()', () => {
    it('returns false by default (no explicit permission config)', () => {
      expect(manager.requiresApproval('bash')).toBe(false);
    });

    it('returns true when permission has requiresApproval=true', () => {
      manager.setPermission({ toolName: 'bash', allowed: true, requiresApproval: true });
      expect(manager.requiresApproval('bash')).toBe(true);
    });
  });

  describe('setPermission()', () => {
    it('adds a new permission', () => {
      manager.setPermission({ toolName: 'new-tool', allowed: true, requiresApproval: false });
      expect(manager.isPermitted('new-tool')).toBe(true);
    });

    it('updates existing permission', () => {
      manager.setPermission({ toolName: 'bash', allowed: false, requiresApproval: false });
      expect(manager.isPermitted('bash')).toBe(false);
    });
  });

  describe('executeToolCall()', () => {
    it('executes a permitted tool successfully', async () => {
      const result = await manager.executeToolCall(
        { toolName: 'bash', args: { cmd: 'ls' } },
        async () => 'file-list'
      );
      expect(result.success).toBe(true);
      expect(result.result).toBe('file-list');
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('returns error for denied tool', async () => {
      const result = await manager.executeToolCall(
        { toolName: 'blocked', args: {} },
        async () => 'never'
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('not permitted');
    });

    it('tracks total call count', async () => {
      await manager.executeToolCall({ toolName: 'bash', args: {} }, async () => 'ok');
      expect(manager.getTotalCalls()).toBe(1);
    });

    it('enforces budget: stops after maxToolCalls', async () => {
      const cfg = makeHarnessConfig({ budget: { maxToolCalls: 2, maxTokens: 1000, maxCost: 10 } });
      const m = createToolCallManager(cfg, { maxRetries: 0, timeoutMs: 5000 });

      await m.executeToolCall({ toolName: 'bash', args: {} }, async () => 'a');
      await m.executeToolCall({ toolName: 'bash', args: {} }, async () => 'b');
      const over = await m.executeToolCall({ toolName: 'bash', args: {} }, async () => 'c');
      expect(over.success).toBe(false);
      expect(over.error).toContain('budget exceeded');
    });

    it('returns error when executor throws', async () => {
      const result = await manager.executeToolCall(
        { toolName: 'bash', args: {}, skipRetry: true },
        async () => { throw new Error('executor failed'); }
      );
      expect(result.success).toBe(false);
      expect(result.error).toBe('executor failed');
    });

    it('times out when executor takes too long', async () => {
      const m = createToolCallManager(makeHarnessConfig(), { timeoutMs: 50, maxRetries: 0 });
      const result = await m.executeToolCall(
        { toolName: 'bash', args: {} },
        () => new Promise(resolve => setTimeout(() => resolve('late'), 200))
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('timed out');
    });

    it('retries on failure (maxRetries=1)', async () => {
      const m = createToolCallManager(makeHarnessConfig(), {
        maxRetries: 1,
        baseBackoffMs: 5,
        maxBackoffMs: 10,
        timeoutMs: 5000,
      });
      let attempts = 0;
      const result = await m.executeToolCall(
        { toolName: 'bash', args: {} },
        async () => {
          attempts++;
          if (attempts < 2) throw new Error('first fail');
          return 'ok';
        }
      );
      expect(result.success).toBe(true);
      expect(result.retryCount).toBe(1);
    });

    it('skipRetry disables retries', async () => {
      const m = createToolCallManager(makeHarnessConfig(), { maxRetries: 3, baseBackoffMs: 5 });
      let attempts = 0;
      await m.executeToolCall(
        { toolName: 'bash', args: {}, skipRetry: true },
        async () => { attempts++; throw new Error('fail'); }
      );
      expect(attempts).toBe(1);
    });
  });

  describe('getHistory()', () => {
    it('starts empty', () => {
      expect(manager.getHistory()).toEqual([]);
    });

    it('records successful calls', async () => {
      await manager.executeToolCall({ toolName: 'bash', args: {} }, async () => 'res');
      const history = manager.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].toolName).toBe('bash');
      expect(history[0].success).toBe(true);
    });

    it('records failed calls', async () => {
      await manager.executeToolCall(
        { toolName: 'bash', args: {}, skipRetry: true },
        async () => { throw new Error('boom'); }
      );
      const history = manager.getHistory();
      expect(history[0].success).toBe(false);
    });
  });

  describe('getRemainingBudget()', () => {
    it('starts at full budget', () => {
      const budget = manager.getRemainingBudget();
      expect(budget.toolCalls).toBe(5);
    });

    it('decrements with each successful call', async () => {
      await manager.executeToolCall({ toolName: 'bash', args: {} }, async () => 'ok');
      expect(manager.getRemainingBudget().toolCalls).toBe(4);
    });

    it('never goes below zero', async () => {
      const cfg = makeHarnessConfig({ budget: { maxToolCalls: 1, maxTokens: 100, maxCost: 1 } });
      const m = createToolCallManager(cfg, { maxRetries: 0 });
      await m.executeToolCall({ toolName: 'bash', args: {} }, async () => 'ok');
      await m.executeToolCall({ toolName: 'bash', args: {} }, async () => 'ok'); // over budget
      expect(m.getRemainingBudget().toolCalls).toBe(0);
    });
  });

  describe('DEFAULT_TOOL_CONFIG', () => {
    it('has sensible defaults', () => {
      expect(DEFAULT_TOOL_CONFIG.maxRetries).toBeGreaterThan(0);
      expect(DEFAULT_TOOL_CONFIG.baseBackoffMs).toBeGreaterThan(0);
      expect(DEFAULT_TOOL_CONFIG.timeoutMs).toBeGreaterThan(0);
    });
  });
});
