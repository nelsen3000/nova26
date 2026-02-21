// KMS-02: Tests for /workflow CLI command

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  handleWorkflowCommand,
  workflowCommand,
  getWorkflowManager,
  resetWorkflowManager,
} from '../workflow-commands.js';
import {
  RalphVisualWorkflowEngine,
  type PersistentWorkflow,
  type VisualNode,
  type WorkflowEdge,
  type WorkflowState,
  type VisualNodeType,
} from '../../workflow-engine/index.js';

// ============================================================================
// Test Fixtures
// ============================================================================

function createMockNode(
  id: string,
  type: VisualNodeType = 'agent',
  status: 'pending' | 'running' | 'complete' | 'failed' | 'skipped' = 'pending',
  label?: string
): VisualNode {
  return {
    id,
    type,
    config: {
      entryFunction: 'testFunction',
      stateSchema: { input: { type: 'string' } },
      timeoutMs: 5000,
    },
    position: { x: Math.random() * 200, y: Math.random() * 200 },
    status,
    label: label ?? `Node ${id}`,
  };
}

function createMockWorkflow(
  nodes: VisualNode[],
  edges: WorkflowEdge[] = [],
  name = 'Test Workflow'
): PersistentWorkflow {
  const startNode = nodes.find((n) => !edges.some((e) => e.to === n.id)) ?? nodes[0];

  const state: WorkflowState = {
    currentNodeId: startNode?.id ?? '',
    checkpoints: [],
    variables: {},
    globalStatus: 'idle',
  };

  return {
    id: `workflow-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name,
    nodes,
    edges,
    state,
    timeline: [],
    createdAt: new Date().toISOString(),
    lastModified: new Date().toISOString(),
  };
}

function registerMockWorkflow(
  nodes: VisualNode[],
  edges: WorkflowEdge[] = [],
  name = 'Test Workflow'
): { id: string; engine: RalphVisualWorkflowEngine; workflow: PersistentWorkflow } {
  const workflow = createMockWorkflow(nodes, edges, name);
  const engine = new RalphVisualWorkflowEngine(workflow);
  const manager = getWorkflowManager();
  manager.register(workflow.id, engine, workflow);
  return { id: workflow.id, engine, workflow };
}

// ============================================================================
// Test Suite
// ============================================================================

describe('/workflow CLI command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetWorkflowManager();
  });

  // ============================================================================
  // Command Definition (3 tests)
  // ============================================================================

  describe('command definition', () => {
    it('should have correct name', () => {
      expect(workflowCommand.name).toBe('/workflow');
    });

    it('should have description', () => {
      expect(workflowCommand.description).toBeDefined();
      expect(workflowCommand.description.length).toBeGreaterThan(0);
      expect(workflowCommand.description).toContain('Workflow Engine');
    });

    it('should have handler function', () => {
      expect(typeof workflowCommand.handler).toBe('function');
    });
  });

  // ============================================================================
  // Help Command (3 tests)
  // ============================================================================

  describe('help', () => {
    it('should show help with no args', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleWorkflowCommand([]);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('/workflow'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('list'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('show'));
    });

    it('should show help with "help" arg', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleWorkflowCommand(['help']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Workflow Engine'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('graph'));
    });

    it('should show help with "--help" arg', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleWorkflowCommand(['--help']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Usage:'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('export'));
    });
  });

  // ============================================================================
  // List Command (4 tests)
  // ============================================================================

  describe('list', () => {
    it('should show empty message when no workflows', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleWorkflowCommand(['list']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No active workflows'));
    });

    it('should list active workflows', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const node = createMockNode('test-1');
      registerMockWorkflow([node], [], 'My Test Workflow');

      await handleWorkflowCommand(['list']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Active Workflows'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('My Test Workflow'));
    });

    it('should show workflow stats in list', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const nodes = [createMockNode('a'), createMockNode('b'), createMockNode('c')];
      registerMockWorkflow(nodes, [], 'Stats Test');

      await handleWorkflowCommand(['list']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('0/3'));
    });

    it('should show multiple workflows', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      registerMockWorkflow([createMockNode('w1')], [], 'Workflow 1');
      registerMockWorkflow([createMockNode('w2')], [], 'Workflow 2');

      await handleWorkflowCommand(['list']);
      const calls = consoleSpy.mock.calls.flat();
      expect(calls.some((c) => c.includes('Workflow 1'))).toBe(true);
      expect(calls.some((c) => c.includes('Workflow 2'))).toBe(true);
    });
  });

  // ============================================================================
  // Show Command (4 tests)
  // ============================================================================

  describe('show', () => {
    it('should show error when no node id specified', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleWorkflowCommand(['show']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Please specify'));
    });

    it('should show error when no workflows exist', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleWorkflowCommand(['show', 'node-1']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No workflows found'));
    });

    it('should show error for unknown node', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      registerMockWorkflow([createMockNode('existing')], [], 'Test');
      await handleWorkflowCommand(['show', 'unknown-node']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('not found'));
    });

    it('should show node details', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const node = createMockNode('test-node', 'agent', 'pending', 'Test Node Label');
      registerMockWorkflow([node], [], 'Detail Test');

      await handleWorkflowCommand(['show', 'test-node']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('test-node'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Test Node Label'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('agent'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('pending'));
    });
  });

  // ============================================================================
  // Graph Command (3 tests)
  // ============================================================================

  describe('graph', () => {
    it('should show error when no workflows exist', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleWorkflowCommand(['graph']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No workflows found'));
    });

    it('should display graph for linear workflow', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const nodes = [
        createMockNode('start', 'agent'),
        createMockNode('middle', 'agent'),
        createMockNode('end', 'agent'),
      ];
      const edges: WorkflowEdge[] = [
        { from: 'start', to: 'middle' },
        { from: 'middle', to: 'end' },
      ];
      registerMockWorkflow(nodes, edges, 'Linear');

      await handleWorkflowCommand(['graph']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Workflow Graph'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('start'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('end'));
    });

    it('should display graph with branching', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const nodes = [
        createMockNode('root', 'agent'),
        createMockNode('left', 'agent'),
        createMockNode('right', 'agent'),
        createMockNode('merge', 'merge'),
      ];
      const edges: WorkflowEdge[] = [
        { from: 'root', to: 'left' },
        { from: 'root', to: 'right' },
        { from: 'left', to: 'merge' },
        { from: 'right', to: 'merge' },
      ];
      registerMockWorkflow(nodes, edges, 'Branching');

      await handleWorkflowCommand(['graph']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('root'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('left'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('right'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('merge'));
    });
  });

  // ============================================================================
  // Critical Path Command (3 tests)
  // ============================================================================

  describe('critical-path', () => {
    it('should show error when no workflows exist', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleWorkflowCommand(['critical-path']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No workflows found'));
    });

    it('should calculate critical path for simple workflow', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const nodes = [
        createMockNode('A', 'agent'),
        createMockNode('B', 'agent'),
        createMockNode('C', 'agent'),
      ];
      const edges: WorkflowEdge[] = [
        { from: 'A', to: 'B' },
        { from: 'B', to: 'C' },
      ];
      registerMockWorkflow(nodes, edges, 'Simple Path');

      await handleWorkflowCommand(['critical-path']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Critical Path'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('A'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('B'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('C'));
    });

    it('should identify bottlenecks in merge workflows', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const nodes = [
        createMockNode('start1', 'agent'),
        createMockNode('start2', 'agent'),
        createMockNode('bottleneck', 'merge'),
        createMockNode('end', 'agent'),
      ];
      const edges: WorkflowEdge[] = [
        { from: 'start1', to: 'bottleneck' },
        { from: 'start2', to: 'bottleneck' },
        { from: 'bottleneck', to: 'end' },
      ];
      registerMockWorkflow(nodes, edges, 'Bottleneck Test');

      await handleWorkflowCommand(['critical-path']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('bottleneck'));
    });
  });

  // ============================================================================
  // Export Command (4 tests)
  // ============================================================================

  describe('export', () => {
    it('should show error when no workflows exist', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleWorkflowCommand(['export']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No workflows found'));
    });

    it('should export as JSON by default', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const node = createMockNode('json-test');
      registerMockWorkflow([node], [], 'JSON Export');

      await handleWorkflowCommand(['export']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('JSON Export'));
      // Should contain JSON output
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('{'));
    });

    it('should export as Mermaid when specified', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const node = createMockNode('mermaid-test', 'decision');
      registerMockWorkflow([node], [], 'Mermaid Export');

      await handleWorkflowCommand(['export', 'mermaid']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Mermaid'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('flowchart TD'));
    });

    it('should include node details in JSON export', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const node = createMockNode('detailed-node', 'agent', 'complete', 'Detailed');
      registerMockWorkflow([node], [], 'Details');

      await handleWorkflowCommand(['export', 'json']);
      const jsonCall = consoleSpy.mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('detailed-node')
      );
      expect(jsonCall).toBeDefined();
    });
  });

  // ============================================================================
  // Workflow Manager (4 tests)
  // ============================================================================

  describe('workflow manager', () => {
    it('should get singleton instance', () => {
      const manager = getWorkflowManager();
      expect(manager).toBeDefined();
      expect(typeof manager.list).toBe('function');
      expect(typeof manager.register).toBe('function');
    });

    it('should register and retrieve workflows', () => {
      const manager = getWorkflowManager();
      const node = createMockNode('test');
      const { id, engine, workflow } = registerMockWorkflow([node]);

      const retrieved = manager.get(id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.workflow.id).toBe(workflow.id);
      expect(retrieved?.engine).toBe(engine);
    });

    it('should reset instance correctly', () => {
      const manager1 = getWorkflowManager();
      registerMockWorkflow([createMockNode('test')]);

      resetWorkflowManager();

      const manager2 = getWorkflowManager();
      expect(manager2).not.toBe(manager1);
      expect(manager2.size()).toBe(0);
    });

    it('should list all workflows', () => {
      const manager = getWorkflowManager();
      registerMockWorkflow([createMockNode('a')], [], 'Workflow A');
      registerMockWorkflow([createMockNode('b')], [], 'Workflow B');

      const list = manager.list();
      expect(list.length).toBe(2);
    });
  });

  // ============================================================================
  // Error Handling (2 tests)
  // ============================================================================

  describe('error handling', () => {
    it('should handle unknown subcommand', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handleWorkflowCommand(['unknown']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('/workflow'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Usage:'));
    });

    it('should handle WorkflowEngineError gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const manager = getWorkflowManager();

      // Create a workflow with invalid data that might cause errors
      const invalidWorkflow = createMockWorkflow([], [], 'Invalid');
      const engine = new RalphVisualWorkflowEngine(invalidWorkflow);
      manager.register('invalid', engine, invalidWorkflow);

      // Try to get critical path on empty workflow
      await handleWorkflowCommand(['critical-path']);
      // Should not throw, should handle gracefully
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Node Details (2 tests)
  // ============================================================================

  describe('node details display', () => {
    it('should show node with agent ID', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const node = createMockNode('agent-node', 'agent');
      node.agentId = 'my-special-agent';
      registerMockWorkflow([node], [], 'Agent Test');

      await handleWorkflowCommand(['show', 'agent-node']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('my-special-agent'));
    });

    it('should show node with retry policy', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const node = createMockNode('retry-node');
      node.config.retryPolicy = {
        maxRetries: 3,
        backoffMs: 1000,
        strategy: 'exponential',
      };
      registerMockWorkflow([node], [], 'Retry Test');

      await handleWorkflowCommand(['show', 'retry-node']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Retry'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('exponential'));
    });
  });
});
