// KIMI-W-02: Lifecycle Hooks Tests

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  HookRegistry,
  getGlobalHookRegistry,
  resetGlobalHookRegistry,
  createBuildContextSchema,
  createTaskContextSchema,
  createTaskResultSchema,
  createHandoffContextSchema,
  createBuildResultSchema,
  createLifecycleHookSchema,
  type BuildContext,
  type TaskContext,
  type TaskResult,
  type HandoffContext,
  type BuildResult,
  type LifecycleHook,
} from './lifecycle-hooks.js';

describe('lifecycle-hooks', () => {
  beforeEach(() => {
    resetGlobalHookRegistry();
  });

  describe('HookRegistry', () => {
    describe('register()', () => {
      it('should register a hook and return unique id', () => {
        const registry = new HookRegistry();
        const handler = vi.fn().mockResolvedValue(undefined);
        
        const id1 = registry.register({
          phase: 'onBeforeBuild',
          moduleName: 'test-module',
          priority: 100,
          handler,
        });
        
        const id2 = registry.register({
          phase: 'onBeforeBuild',
          moduleName: 'test-module',
          priority: 100,
          handler,
        });
        
        expect(id1).toBeDefined();
        expect(id2).toBeDefined();
        expect(id1).not.toBe(id2);
      });

      it('should use provided priority', () => {
        const registry = new HookRegistry();
        const handler = vi.fn().mockResolvedValue(undefined);
        
        registry.register({
          phase: 'onBeforeBuild',
          moduleName: 'test-module',
          priority: 50,
          handler,
        });
        
        const hooks = registry.getHooksForPhase('onBeforeBuild');
        expect(hooks[0].priority).toBe(50);
      });
    });

    describe('unregister()', () => {
      it('should remove a registered hook', () => {
        const registry = new HookRegistry();
        const handler = vi.fn().mockResolvedValue(undefined);
        
        const id = registry.register({
          phase: 'onBeforeBuild',
          moduleName: 'test-module',
          priority: 100,
          handler,
        });
        
        expect(registry.getHookCount()).toBe(1);
        expect(registry.unregister(id)).toBe(true);
        expect(registry.getHookCount()).toBe(0);
      });

      it('should return false for non-existent hook', () => {
        const registry = new HookRegistry();
        expect(registry.unregister('non-existent-id')).toBe(false);
      });
    });

    describe('getHooksForPhase()', () => {
      it('should return empty array when no hooks registered', () => {
        const registry = new HookRegistry();
        expect(registry.getHooksForPhase('onBeforeBuild')).toEqual([]);
      });

      it('should return hooks for specific phase only', () => {
        const registry = new HookRegistry();
        const handler = vi.fn().mockResolvedValue(undefined);
        
        registry.register({
          phase: 'onBeforeBuild',
          moduleName: 'test-module',
          priority: 100,
          handler,
        });
        
        registry.register({
          phase: 'onAfterTask',
          moduleName: 'test-module',
          priority: 100,
          handler,
        });
        
        expect(registry.getHooksForPhase('onBeforeBuild')).toHaveLength(1);
        expect(registry.getHooksForPhase('onAfterTask')).toHaveLength(1);
        expect(registry.getHooksForPhase('onTaskError')).toHaveLength(0);
      });

      it('should sort hooks by priority (lower first)', () => {
        const registry = new HookRegistry();
        const handler = vi.fn().mockResolvedValue(undefined);
        
        registry.register({
          phase: 'onBeforeBuild',
          moduleName: 'module-c',
          priority: 300,
          handler,
        });
        
        registry.register({
          phase: 'onBeforeBuild',
          moduleName: 'module-a',
          priority: 100,
          handler,
        });
        
        registry.register({
          phase: 'onBeforeBuild',
          moduleName: 'module-b',
          priority: 200,
          handler,
        });
        
        const hooks = registry.getHooksForPhase('onBeforeBuild');
        expect(hooks.map(h => h.moduleName)).toEqual(['module-a', 'module-b', 'module-c']);
      });
    });

    describe('executePhase()', () => {
      it('should execute all hooks for a phase in order', async () => {
        const registry = new HookRegistry();
        const order: string[] = [];
        
        registry.register({
          phase: 'onBeforeBuild',
          moduleName: 'second',
          priority: 200,
          handler: async () => { order.push('second'); },
        });
        
        registry.register({
          phase: 'onBeforeBuild',
          moduleName: 'first',
          priority: 100,
          handler: async () => { order.push('first'); },
        });
        
        await registry.executePhase('onBeforeBuild', {});
        expect(order).toEqual(['first', 'second']);
      });

      it('should pass context to handlers', async () => {
        const registry = new HookRegistry();
        const handler = vi.fn().mockResolvedValue(undefined);
        const context: BuildContext = {
          buildId: 'build-123',
          prdId: 'prd-456',
          prdName: 'Test PRD',
          startedAt: new Date().toISOString(),
          options: {},
        };
        
        registry.register({
          phase: 'onBeforeBuild',
          moduleName: 'test-module',
          priority: 100,
          handler,
        });
        
        await registry.executePhase('onBeforeBuild', context);
        expect(handler).toHaveBeenCalledWith(context);
      });

      it('should continue if a hook fails', async () => {
        const registry = new HookRegistry();
        const errorHandler = vi.fn().mockRejectedValue(new Error('Hook failed'));
        const successHandler = vi.fn().mockResolvedValue(undefined);
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
        
        registry.register({
          phase: 'onBeforeBuild',
          moduleName: 'failing-module',
          priority: 100,
          handler: errorHandler,
        });
        
        registry.register({
          phase: 'onBeforeBuild',
          moduleName: 'success-module',
          priority: 200,
          handler: successHandler,
        });
        
        await registry.executePhase('onBeforeBuild', {});
        
        expect(errorHandler).toHaveBeenCalled();
        expect(successHandler).toHaveBeenCalled();
        expect(consoleError).toHaveBeenCalled();
        
        consoleError.mockRestore();
      });

      it('should work when no hooks registered', async () => {
        const registry = new HookRegistry();
        await expect(registry.executePhase('onBeforeBuild', {})).resolves.not.toThrow();
      });
    });

    describe('getRegisteredModules()', () => {
      it('should return unique module names', () => {
        const registry = new HookRegistry();
        const handler = vi.fn().mockResolvedValue(undefined);
        
        registry.register({
          phase: 'onBeforeBuild',
          moduleName: 'module-a',
          priority: 100,
          handler,
        });
        
        registry.register({
          phase: 'onAfterTask',
          moduleName: 'module-a',
          priority: 100,
          handler,
        });
        
        registry.register({
          phase: 'onBuildComplete',
          moduleName: 'module-b',
          priority: 100,
          handler,
        });
        
        const modules = registry.getRegisteredModules();
        expect(modules).toContain('module-a');
        expect(modules).toContain('module-b');
        expect(modules).toHaveLength(2);
      });

      it('should return empty array when no hooks', () => {
        const registry = new HookRegistry();
        expect(registry.getRegisteredModules()).toEqual([]);
      });
    });

    describe('clear()', () => {
      it('should remove all hooks', () => {
        const registry = new HookRegistry();
        const handler = vi.fn().mockResolvedValue(undefined);
        
        registry.register({
          phase: 'onBeforeBuild',
          moduleName: 'test-module',
          priority: 100,
          handler,
        });
        
        registry.register({
          phase: 'onAfterTask',
          moduleName: 'test-module',
          priority: 100,
          handler,
        });
        
        expect(registry.getHookCount()).toBe(2);
        registry.clear();
        expect(registry.getHookCount()).toBe(0);
      });
    });

    describe('getHookCount()', () => {
      it('should return total number of hooks', () => {
        const registry = new HookRegistry();
        const handler = vi.fn().mockResolvedValue(undefined);
        
        expect(registry.getHookCount()).toBe(0);
        
        registry.register({ phase: 'onBeforeBuild', moduleName: 'm1', priority: 100, handler });
        expect(registry.getHookCount()).toBe(1);
        
        registry.register({ phase: 'onAfterTask', moduleName: 'm2', priority: 100, handler });
        expect(registry.getHookCount()).toBe(2);
      });
    });

    describe('getAllHooks()', () => {
      it('should return copy of all hooks', () => {
        const registry = new HookRegistry();
        const handler = vi.fn().mockResolvedValue(undefined);
        
        registry.register({
          phase: 'onBeforeBuild',
          moduleName: 'test-module',
          priority: 100,
          handler,
        });
        
        const hooks = registry.getAllHooks();
        expect(hooks).toHaveLength(1);
        
        // Should be a copy
        hooks.pop();
        expect(registry.getHookCount()).toBe(1);
      });
    });
  });

  describe('Global Registry', () => {
    it('should return same instance', () => {
      const registry1 = getGlobalHookRegistry();
      const registry2 = getGlobalHookRegistry();
      expect(registry1).toBe(registry2);
    });

    it('should create new instance after reset', () => {
      const registry1 = getGlobalHookRegistry();
      resetGlobalHookRegistry();
      const registry2 = getGlobalHookRegistry();
      expect(registry1).not.toBe(registry2);
    });
  });

  describe('Zod Schemas', () => {
    describe('createBuildContextSchema', () => {
      it('should validate valid build context', async () => {
        const context: BuildContext = {
          buildId: 'build-123',
          prdId: 'prd-456',
          prdName: 'Test PRD',
          startedAt: new Date().toISOString(),
          options: { fastMode: true },
        };
        
        const schema = await createBuildContextSchema();
        expect(schema.safeParse(context).success).toBe(true);
      });

      it('should reject missing required fields', async () => {
        const context = {
          buildId: 'build-123',
          // missing prdId
        };
        
        const schema = await createBuildContextSchema();
        expect(schema.safeParse(context).success).toBe(false);
      });
    });

    describe('createTaskContextSchema', () => {
      it('should validate valid task context', async () => {
        const context: TaskContext = {
          taskId: 'task-123',
          title: 'Implement feature',
          agentName: 'vanguard',
          dependencies: ['task-001', 'task-002'],
        };
        
        const schema = await createTaskContextSchema();
        expect(schema.safeParse(context).success).toBe(true);
      });

      it('should validate empty dependencies', async () => {
        const context: TaskContext = {
          taskId: 'task-123',
          title: 'Implement feature',
          agentName: 'vanguard',
          dependencies: [],
        };
        
        const schema = await createTaskContextSchema();
        expect(schema.safeParse(context).success).toBe(true);
      });
    });

    describe('createTaskResultSchema', () => {
      it('should validate successful result', async () => {
        const result: TaskResult = {
          taskId: 'task-123',
          agentName: 'vanguard',
          success: true,
          output: 'Task completed',
          durationMs: 5000,
          aceScore: 0.95,
        };
        
        const schema = await createTaskResultSchema();
        expect(schema.safeParse(result).success).toBe(true);
      });

      it('should validate failed result', async () => {
        const result: TaskResult = {
          taskId: 'task-123',
          agentName: 'vanguard',
          success: false,
          error: 'Something went wrong',
          durationMs: 1000,
        };
        
        const schema = await createTaskResultSchema();
        expect(schema.safeParse(result).success).toBe(true);
      });
    });

    describe('createHandoffContextSchema', () => {
      it('should validate valid handoff', async () => {
        const context: HandoffContext = {
          fromAgent: 'vanguard',
          toAgent: 'sentinel',
          taskId: 'task-123',
          payload: { data: 'test' },
        };
        
        const schema = await createHandoffContextSchema();
        expect(schema.safeParse(context).success).toBe(true);
      });
    });

    describe('createBuildResultSchema', () => {
      it('should validate valid build result', async () => {
        const result: BuildResult = {
          buildId: 'build-123',
          prdId: 'prd-456',
          totalTasks: 10,
          successfulTasks: 9,
          failedTasks: 1,
          totalDurationMs: 30000,
          averageAceScore: 0.85,
        };
        
        const schema = await createBuildResultSchema();
        expect(schema.safeParse(result).success).toBe(true);
      });
    });

    describe('createLifecycleHookSchema', () => {
      it('should reject invalid phase', async () => {
        const hook = {
          id: 'hook-123',
          phase: 'invalidPhase',
          moduleName: 'test-module',
          priority: 100,
          handler: async () => {},
        };
        
        const schema = await createLifecycleHookSchema();
        expect(schema.safeParse(hook).success).toBe(false);
      });

      it('should validate valid phase', async () => {
        const hook = {
          id: 'hook-123',
          phase: 'onBeforeBuild',
          moduleName: 'test-module',
          priority: 100,
          handler: async () => {},
        };
        
        const schema = await createLifecycleHookSchema();
        expect(schema.safeParse(hook).success).toBe(true);
      });
    });
  });

  describe('Integration - All Phases', () => {
    it('should handle all 6 phases independently', async () => {
      const registry = new HookRegistry();
      const handlers: Record<string, ReturnType<typeof vi.fn>> = {
        onBeforeBuild: vi.fn().mockResolvedValue(undefined),
        onBeforeTask: vi.fn().mockResolvedValue(undefined),
        onAfterTask: vi.fn().mockResolvedValue(undefined),
        onTaskError: vi.fn().mockResolvedValue(undefined),
        onHandoff: vi.fn().mockResolvedValue(undefined),
        onBuildComplete: vi.fn().mockResolvedValue(undefined),
      };
      
      const phases = [
        'onBeforeBuild',
        'onBeforeTask',
        'onAfterTask',
        'onTaskError',
        'onHandoff',
        'onBuildComplete',
      ] as const;
      
      for (const phase of phases) {
        registry.register({
          phase,
          moduleName: 'test-module',
          priority: 100,
          handler: handlers[phase],
        });
      }
      
      // Execute each phase
      await registry.executePhase('onBeforeBuild', { buildId: '1' });
      await registry.executePhase('onBeforeTask', { taskId: '1' });
      await registry.executePhase('onAfterTask', { taskId: '1', success: true });
      await registry.executePhase('onTaskError', { taskId: '1', success: false });
      await registry.executePhase('onHandoff', { fromAgent: 'a', toAgent: 'b' });
      await registry.executePhase('onBuildComplete', { buildId: '1' });
      
      for (const phase of phases) {
        expect(handlers[phase]).toHaveBeenCalled();
      }
    });
  });
});
