// Workflow Engine Tests
// Spec: .nova/specs/grok-r24-immortal-omniverse.md (R24-02)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkflowEngine, type ExecutionContext, type Workflow } from './engine';

describe('WorkflowEngine', () => {
  let engine: WorkflowEngine;

  beforeEach(() => {
    engine = new WorkflowEngine();
  });

  describe('Workflow Registration', () => {
    it('should register a workflow', () => {
      const workflow: Workflow = {
        id: 'test-workflow',
        name: 'Test Workflow',
        description: 'A test workflow',
        nodes: [
          {
            id: 'node1',
            type: 'agent',
            name: 'Test Node',
            config: {},
            position: { x: 0, y: 0 },
          },
        ],
        edges: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      engine.register(workflow);
      expect(engine.getWorkflow('test-workflow')).toBeDefined();
    });

    it('should list all workflows', () => {
      const workflow1: Workflow = {
        id: 'wf1',
        name: 'Workflow 1',
        description: '',
        nodes: [],
        edges: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      const workflow2: Workflow = {
        id: 'wf2',
        name: 'Workflow 2',
        description: '',
        nodes: [],
        edges: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      engine.register(workflow1);
      engine.register(workflow2);

      const workflows = engine.listWorkflows();
      expect(workflows.length).toBe(2);
      expect(workflows.map(w => w.id)).toContain('wf1');
      expect(workflows.map(w => w.id)).toContain('wf2');
    });

    it('should delete a workflow', () => {
      const workflow: Workflow = {
        id: 'to-delete',
        name: 'To Delete',
        description: '',
        nodes: [],
        edges: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      engine.register(workflow);
      expect(engine.deleteWorkflow('to-delete')).toBe(true);
      expect(engine.getWorkflow('to-delete')).toBeUndefined();
    });
  });

  describe('Workflow Execution', () => {
    it('should execute a simple workflow', async () => {
      const workflow: Workflow = {
        id: 'simple-workflow',
        name: 'Simple Workflow',
        description: '',
        nodes: [
          {
            id: 'trigger',
            type: 'trigger',
            name: 'Start',
            config: {},
            position: { x: 0, y: 0 },
          },
          {
            id: 'agent1',
            type: 'agent',
            name: 'Agent 1',
            config: {},
            position: { x: 100, y: 0 },
          },
        ],
        edges: [{ id: 'e1', source: 'trigger', target: 'agent1' }],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      engine.register(workflow);

      // Register a mock executor
      const executor = vi.fn(async (node, ctx) => ({
        ...ctx,
        [node.id]: 'executed',
      }));
      engine.registerExecutor('agent', executor);
      engine.registerExecutor('trigger', async (node, ctx) => ctx);

      const runId = await engine.start('simple-workflow', { input: 'test' });
      const result = await engine.waitForCompletion(runId);

      expect(result.state).toBe('completed');
      expect(result.context.agent1).toBe('executed');
      expect(executor).toHaveBeenCalledTimes(1);
    });

    it('should throw for non-existent workflow', async () => {
      await expect(engine.start('non-existent')).rejects.toThrow(
        'Workflow not found'
      );
    });

    it('should fail when no executor registered', async () => {
      const workflow: Workflow = {
        id: 'no-executor',
        name: 'No Executor',
        description: '',
        nodes: [
          {
            id: 'agent1',
            type: 'agent',
            name: 'Agent 1',
            config: {},
            position: { x: 0, y: 0 },
          },
        ],
        edges: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      engine.register(workflow);
      const runId = await engine.start('no-executor');
      const result = await engine.waitForCompletion(runId);

      expect(result.state).toBe('failed');
      expect(result.error).toContain('No executor');
    });

    it('should handle decision branches', async () => {
      const workflow: Workflow = {
        id: 'decision-workflow',
        name: 'Decision Workflow',
        description: '',
        nodes: [
          {
            id: 'decision',
            type: 'decision',
            name: 'Decision',
            config: {},
            position: { x: 0, y: 0 },
          },
          {
            id: 'path-a',
            type: 'agent',
            name: 'Path A',
            config: {},
            position: { x: 100, y: -50 },
          },
          {
            id: 'path-b',
            type: 'agent',
            name: 'Path B',
            config: {},
            position: { x: 100, y: 50 },
          },
        ],
        edges: [
          {
            id: 'e1',
            source: 'decision',
            target: 'path-a',
            condition: 'context.takeA === true',
          },
          {
            id: 'e2',
            source: 'decision',
            target: 'path-b',
            condition: 'context.takeA === false',
          },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      engine.register(workflow);

      const executor = vi.fn(async (node, ctx) => ({
        ...ctx,
        executed: node.id,
      }));
      engine.registerExecutor('decision', async (node, ctx) => ctx);
      engine.registerExecutor('agent', executor);

      // Test path A
      const runIdA = await engine.start('decision-workflow', { takeA: true });
      const resultA = await engine.waitForCompletion(runIdA);
      expect(resultA.context.executed).toBe('path-a');

      // Test path B
      const runIdB = await engine.start('decision-workflow', { takeA: false });
      const resultB = await engine.waitForCompletion(runIdB);
      expect(resultB.context.executed).toBe('path-b');
    });

    it('should call state change callback', async () => {
      const stateChanges: string[] = [];
      const onStateChange = vi.fn((run) => {
        stateChanges.push(run.state);
      });
      engine = new WorkflowEngine({ onStateChange });

      const workflow: Workflow = {
        id: 'callback-test',
        name: 'Callback Test',
        description: '',
        nodes: [
          {
            id: 'agent1',
            type: 'agent',
            name: 'Agent 1',
            config: {},
            position: { x: 0, y: 0 },
          },
        ],
        edges: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      engine.register(workflow);
      engine.registerExecutor('agent', async (node, ctx) => {
        // Add delay to ensure we capture running state
        await new Promise(resolve => setTimeout(resolve, 50));
        return ctx;
      });

      const runId = await engine.start('callback-test');

      // Check that running was captured immediately
      expect(stateChanges).toContain('running');

      // Wait for execution to complete
      await engine.waitForCompletion(runId);

      expect(onStateChange).toHaveBeenCalled();
      expect(stateChanges).toContain('completed');
    });
  });

  describe('Run Control', () => {
    it('should cancel a running workflow', async () => {
      const workflow: Workflow = {
        id: 'cancel-test',
        name: 'Cancel Test',
        description: '',
        nodes: [
          {
            id: 'wait',
            type: 'wait',
            name: 'Wait',
            config: { durationMs: 10000 },
            position: { x: 0, y: 0 },
          },
        ],
        edges: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      engine.register(workflow);
      engine.registerExecutor('wait', async (node, ctx) => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return ctx;
      });

      const runId = await engine.start('cancel-test');

      // Small delay to let execution start
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(engine.cancel(runId)).toBe(true);

      const run = engine.getRun(runId);
      expect(run?.state).toBe('cancelled');
    });

    it('should pause and resume a workflow', async () => {
      const workflow: Workflow = {
        id: 'pause-test',
        name: 'Pause Test',
        description: '',
        nodes: [
          {
            id: 'wait',
            type: 'wait',
            name: 'Wait',
            config: { durationMs: 500 },
            position: { x: 0, y: 0 },
          },
        ],
        edges: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      engine.register(workflow);
      engine.registerExecutor('wait', async (node, ctx) => {
        // Long running task
        await new Promise(resolve => setTimeout(resolve, 200));
        return ctx;
      });

      const runId = await engine.start('pause-test');

      // Wait for execution to start
      await new Promise(resolve => setTimeout(resolve, 20));

      expect(engine.pause(runId)).toBe(true);

      let run = engine.getRun(runId);
      expect(run?.state).toBe('paused');

      // Resume and wait for completion
      engine.resume(runId);
      await engine.waitForCompletion(runId);

      run = engine.getRun(runId);
      expect(run?.state).toBe('completed');
    });

    it('should list workflow runs', async () => {
      const workflow: Workflow = {
        id: 'list-test',
        name: 'List Test',
        description: '',
        nodes: [
          {
            id: 'agent1',
            type: 'agent',
            name: 'Agent 1',
            config: {},
            position: { x: 0, y: 0 },
          },
        ],
        edges: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      engine.register(workflow);
      engine.registerExecutor('agent', async (node, ctx) => ctx);

      const runId1 = await engine.start('list-test');
      const runId2 = await engine.start('list-test');

      const runs = engine.getRuns('list-test');
      expect(runs.length).toBe(2);
      expect(runs.map(r => r.id)).toContain(runId1);
      expect(runs.map(r => r.id)).toContain(runId2);
    });
  });
});
