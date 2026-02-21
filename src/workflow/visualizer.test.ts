// Workflow Visualizer Tests
// Spec: .nova/specs/grok-r24-immortal-omniverse.md (R24-02)

import { describe, it, expect } from 'vitest';
import { WorkflowVisualizer } from './visualizer';
import { createAgentTaskTemplate, createCodeReviewTemplate } from './templates';
import type { Workflow, WorkflowRun } from './types';

describe('WorkflowVisualizer', () => {
  const visualizer = new WorkflowVisualizer();

  describe('toGraphviz', () => {
    it('should generate valid DOT format', () => {
      const workflow = createAgentTaskTemplate('Test Workflow');
      const dot = visualizer.toGraphviz(workflow);

      expect(dot).toContain('digraph workflow {');
      expect(dot).toContain('}');
      expect(dot).toContain('rankdir=TB');
    });

    it('should include workflow name as label', () => {
      const workflow = createAgentTaskTemplate('My Workflow');
      const dot = visualizer.toGraphviz(workflow);

      expect(dot).toContain('label="My Workflow"');
    });

    it('should include all nodes', () => {
      const workflow = createAgentTaskTemplate('Test');
      const dot = visualizer.toGraphviz(workflow);

      for (const node of workflow.nodes) {
        expect(dot).toContain(`${node.id} [`);
      }
    });

    it('should include all edges', () => {
      const workflow = createAgentTaskTemplate('Test');
      const dot = visualizer.toGraphviz(workflow);

      for (const edge of workflow.edges) {
        expect(dot).toContain(`${edge.source} -> ${edge.target}`);
      }
    });

    it('should handle decision nodes with conditions', () => {
      const workflow = createCodeReviewTemplate('Review');
      const dot = visualizer.toGraphviz(workflow);

      const decisionNode = workflow.nodes.find(n => n.type === 'decision');
      expect(decisionNode).toBeDefined();

      // Decision nodes should have diamond shape
      expect(dot).toContain('shape=diamond');
    });

    it('should support different directions', () => {
      const workflow = createAgentTaskTemplate('Test');

      const tb = visualizer.toGraphviz(workflow, { direction: 'TB' });
      const lr = visualizer.toGraphviz(workflow, { direction: 'LR' });

      expect(tb).toContain('rankdir=TB');
      expect(lr).toContain('rankdir=LR');
    });

    it('should escape special characters in labels', () => {
      const workflow: Workflow = {
        id: 'escape-test',
        name: 'Test "Workflow"',
        description: '',
        nodes: [
          {
            id: 'node1',
            type: 'agent',
            name: 'Node with "quotes"',
            config: {},
            position: { x: 0, y: 0 },
          },
        ],
        edges: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const dot = visualizer.toGraphviz(workflow);
      expect(dot).toContain('\\"');
    });
  });

  describe('toMermaid', () => {
    it('should generate valid Mermaid syntax', () => {
      const workflow = createAgentTaskTemplate('Test Workflow');
      const mermaid = visualizer.toMermaid(workflow);

      expect(mermaid).toContain('flowchart TD');
      expect(mermaid).toContain('%% Test Workflow');
    });

    it('should include all nodes', () => {
      const workflow = createAgentTaskTemplate('Test');
      const mermaid = visualizer.toMermaid(workflow);

      for (const node of workflow.nodes) {
        expect(mermaid).toContain(node.id);
      }
    });

    it('should include all edges', () => {
      const workflow = createAgentTaskTemplate('Test');
      const mermaid = visualizer.toMermaid(workflow);

      for (const edge of workflow.edges) {
        expect(mermaid).toContain(`${edge.source} -->`);
      }
    });

    it('should use correct shapes for node types', () => {
      const workflow = createCodeReviewTemplate('Review');
      const mermaid = visualizer.toMermaid(workflow);

      // Trigger should use circle
      expect(mermaid).toContain('(("');
      // Decision should use diamond
      expect(mermaid).toContain('{');
    });

    it('should include styling classes', () => {
      const workflow = createAgentTaskTemplate('Test');
      const mermaid = visualizer.toMermaid(workflow);

      expect(mermaid).toContain('classDef');
    });
  });

  describe('generateTrace', () => {
    it('should generate execution trace', () => {
      const workflow = createAgentTaskTemplate('Test');
      const run: WorkflowRun = {
        id: 'run-1',
        workflowId: workflow.id,
        state: 'completed',
        currentNodeId: null,
        context: { result: 'done' },
        startedAt: Date.now() - 1000,
        completedAt: Date.now(),
      };

      const trace = visualizer.generateTrace(workflow, run);

      expect(trace.runId).toBe('run-1');
      expect(trace.nodes).toHaveLength(workflow.nodes.length);
      expect(trace.edges).toHaveLength(workflow.edges.length);
    });

    it('should mark nodes as completed for finished runs', () => {
      const workflow = createAgentTaskTemplate('Test');
      const run: WorkflowRun = {
        id: 'run-1',
        workflowId: workflow.id,
        state: 'completed',
        currentNodeId: null,
        context: {},
        startedAt: Date.now(),
        completedAt: Date.now(),
      };

      const trace = visualizer.generateTrace(workflow, run);

      expect(trace.nodes.every(n => n.status === 'completed')).toBe(true);
    });

    it('should identify current node for running workflows', () => {
      const workflow = createAgentTaskTemplate('Test');
      const run: WorkflowRun = {
        id: 'run-1',
        workflowId: workflow.id,
        state: 'running',
        currentNodeId: workflow.nodes[1].id,
        context: {},
        startedAt: Date.now(),
      };

      const trace = visualizer.generateTrace(workflow, run);

      expect(trace.currentNodeId).toBe(workflow.nodes[1].id);

      const currentNode = trace.nodes.find(n => n.id === workflow.nodes[1].id);
      expect(currentNode?.status).toBe('running');
    });

    it('should calculate duration', () => {
      const workflow = createAgentTaskTemplate('Test');
      const startTime = Date.now() - 5000;
      const run: WorkflowRun = {
        id: 'run-1',
        workflowId: workflow.id,
        state: 'completed',
        currentNodeId: null,
        context: {},
        startedAt: startTime,
        completedAt: Date.now(),
      };

      const trace = visualizer.generateTrace(workflow, run);

      expect(trace.durationMs).toBeGreaterThanOrEqual(4900);
      expect(trace.durationMs).toBeLessThanOrEqual(5100);
    });
  });

  describe('traceToGraphviz', () => {
    it('should generate DOT for execution trace', () => {
      const workflow = createAgentTaskTemplate('Test');
      const run: WorkflowRun = {
        id: 'run-1',
        workflowId: workflow.id,
        state: 'completed',
        currentNodeId: null,
        context: {},
        startedAt: Date.now() - 1000,
        completedAt: Date.now(),
      };

      const trace = visualizer.generateTrace(workflow, run);
      const dot = visualizer.traceToGraphviz(trace);

      expect(dot).toContain('digraph execution_trace {');
      expect(dot).toContain('fillcolor');
    });

    it('should highlight current node', () => {
      const workflow = createAgentTaskTemplate('Test');
      const run: WorkflowRun = {
        id: 'run-1',
        workflowId: workflow.id,
        state: 'running',
        currentNodeId: workflow.nodes[0].id,
        context: {},
        startedAt: Date.now(),
      };

      const trace = visualizer.generateTrace(workflow, run);
      const dot = visualizer.traceToGraphviz(trace);

      expect(dot).toContain('[penwidth=3');
      expect(dot).toContain('color="#FF5722"');
    });

    it('should style untraversed edges as dashed', () => {
      const workflow = createCodeReviewTemplate('Test');
      const run: WorkflowRun = {
        id: 'run-1',
        workflowId: workflow.id,
        state: 'running',
        currentNodeId: workflow.nodes[1].id,
        context: {},
        startedAt: Date.now(),
      };

      const trace = visualizer.generateTrace(workflow, run);
      const dot = visualizer.traceToGraphviz(trace);

      expect(dot).toContain('style=dashed');
    });
  });
});
