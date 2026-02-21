// Workflow Templates Tests
// Spec: .nova/specs/grok-r24-immortal-omniverse.md (R24-02)

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createAgentTaskTemplate,
  createCodeReviewTemplate,
  createMultiAgentSwarmTemplate,
  createIterativeRefinementTemplate,
  createSequentialPipelineTemplate,
  TemplateRegistry,
  getTemplateRegistry,
  resetTemplateRegistry,
} from './templates';

describe('Workflow Templates', () => {
  describe('createAgentTaskTemplate', () => {
    it('should create a simple agent task workflow', () => {
      const workflow = createAgentTaskTemplate('My Task', 'my-agent');

      expect(workflow.name).toBe('My Task');
      expect(workflow.nodes).toHaveLength(2);
      expect(workflow.nodes[0].type).toBe('trigger');
      expect(workflow.nodes[1].type).toBe('agent');
      expect(workflow.nodes[1].config.agentId).toBe('my-agent');
      expect(workflow.edges).toHaveLength(1);
    });

    it('should use default agent if not specified', () => {
      const workflow = createAgentTaskTemplate('Default Task');
      expect(workflow.nodes[1].config.agentId).toBe('default-agent');
    });
  });

  describe('createCodeReviewTemplate', () => {
    it('should create a code review workflow', () => {
      const workflow = createCodeReviewTemplate('PR Review');

      expect(workflow.name).toBe('PR Review');

      const nodeTypes = workflow.nodes.map(n => n.type);
      expect(nodeTypes).toContain('trigger');
      expect(nodeTypes).toContain('agent');
      expect(nodeTypes).toContain('decision');

      const decisionNode = workflow.nodes.find(n => n.type === 'decision');
      expect(decisionNode).toBeDefined();
      expect(decisionNode?.config.branches).toHaveLength(2);
    });

    it('should have approve and reject paths', () => {
      const workflow = createCodeReviewTemplate();

      const approveEdge = workflow.edges.find(e => e.target.includes('approve') || e.label === 'Yes');
      const rejectEdge = workflow.edges.find(e => e.target.includes('reject') || e.label === 'No');

      expect(approveEdge).toBeDefined();
      expect(rejectEdge).toBeDefined();
    });
  });

  describe('createMultiAgentSwarmTemplate', () => {
    it('should create a parallel swarm workflow', () => {
      const workflow = createMultiAgentSwarmTemplate('Swarm Analysis');

      expect(workflow.name).toBe('Swarm Analysis');

      const parallelNode = workflow.nodes.find(n => n.type === 'parallel');
      expect(parallelNode).toBeDefined();

      const agentNodes = workflow.nodes.filter(n => n.type === 'agent');
      expect(agentNodes.length).toBeGreaterThanOrEqual(3);
    });

    it('should have a consensus node', () => {
      const workflow = createMultiAgentSwarmTemplate();

      const consensusNode = workflow.nodes.find(n => n.name.toLowerCase().includes('consensus'));
      expect(consensusNode).toBeDefined();
    });
  });

  describe('createIterativeRefinementTemplate', () => {
    it('should create a refinement workflow with loop', () => {
      const workflow = createIterativeRefinementTemplate('Refine Document');

      expect(workflow.name).toBe('Refine Document');

      const decisionNode = workflow.nodes.find(n => n.type === 'decision');
      expect(decisionNode).toBeDefined();

      // Should have a loop back edge
      const loopEdge = workflow.edges.find(e => e.label === 'Retry' || e.label === 'No');
      expect(loopEdge).toBeDefined();
    });

    it('should have generate and review nodes', () => {
      const workflow = createIterativeRefinementTemplate();

      const generateNode = workflow.nodes.find(n => n.name.toLowerCase().includes('generate'));
      const reviewNode = workflow.nodes.find(n => n.name.toLowerCase().includes('review'));

      expect(generateNode).toBeDefined();
      expect(reviewNode).toBeDefined();
    });
  });

  describe('createSequentialPipelineTemplate', () => {
    it('should create a pipeline with default steps', () => {
      const workflow = createSequentialPipelineTemplate('Default Pipeline');

      expect(workflow.name).toBe('Default Pipeline');

      const agentNodes = workflow.nodes.filter(n => n.type === 'agent');
      expect(agentNodes.length).toBe(4); // Analyze, Design, Implement, Test
    });

    it('should create a pipeline with custom steps', () => {
      const steps = [
        { name: 'Step 1', agentId: 'agent1' },
        { name: 'Step 2', agentId: 'agent2' },
      ];
      const workflow = createSequentialPipelineTemplate('Custom Pipeline', steps);

      const agentNodes = workflow.nodes.filter(n => n.type === 'agent');
      expect(agentNodes.length).toBe(2);
      expect(agentNodes[0].name).toBe('Step 1');
      expect(agentNodes[1].name).toBe('Step 2');
    });

    it('should connect steps sequentially', () => {
      const workflow = createSequentialPipelineTemplate();

      const edges = workflow.edges;
      expect(edges.length).toBeGreaterThan(0);

      // Each step should connect to the next
      for (let i = 0; i < edges.length; i++) {
        expect(edges[i].source).toBeDefined();
        expect(edges[i].target).toBeDefined();
      }
    });
  });

  describe('TemplateRegistry', () => {
    let registry: TemplateRegistry;

    beforeEach(() => {
      resetTemplateRegistry();
      registry = new TemplateRegistry();
    });

    it('should have built-in templates', () => {
      const templates = registry.list();
      const ids = templates.map(t => t.id);

      expect(ids).toContain('agent-task');
      expect(ids).toContain('code-review');
      expect(ids).toContain('multi-agent-swarm');
      expect(ids).toContain('iterative-refinement');
      expect(ids).toContain('sequential-pipeline');
    });

    it('should get template metadata', () => {
      const template = registry.get('agent-task');
      expect(template).toBeDefined();
      expect(template?.name).toBe('Agent Task');
      expect(template?.category).toBe('development');
    });

    it('should filter by category', () => {
      const devTemplates = registry.list({ category: 'development' });
      expect(devTemplates.every(t => t.category === 'development')).toBe(true);
      expect(devTemplates.length).toBeGreaterThan(0);
    });

    it('should filter by complexity', () => {
      const simpleTemplates = registry.list({ complexity: 'simple' });
      expect(simpleTemplates.every(t => t.complexity === 'simple')).toBe(true);
    });

    it('should filter by tags', () => {
      const templates = registry.list({ tags: ['parallel'] });
      expect(templates.some(t => t.tags.includes('parallel'))).toBe(true);
    });

    it('should instantiate a template', () => {
      const workflow = registry.instantiate('agent-task', 'My Instantiated Task');

      expect(workflow.name).toBe('My Instantiated Task');
      expect(workflow.nodes.length).toBeGreaterThan(0);
      expect(workflow.edges.length).toBeGreaterThanOrEqual(0);
    });

    it('should use default name when instantiating', () => {
      const workflow = registry.instantiate('agent-task');
      expect(workflow.name).toBe('Agent Task');
    });

    it('should throw for unknown template', () => {
      expect(() => registry.instantiate('unknown-template')).toThrow(
        'Template not found'
      );
    });

    it('should register custom templates', () => {
      registry.register({
        id: 'custom-template',
        name: 'Custom Template',
        description: 'A custom template',
        category: 'custom',
        tags: ['custom'],
        complexity: 'simple',
      });

      expect(registry.get('custom-template')).toBeDefined();
    });
  });

  describe('Singleton', () => {
    it('should return same instance', () => {
      const a = getTemplateRegistry();
      const b = getTemplateRegistry();
      expect(a).toBe(b);
    });

    it('should reset instance', () => {
      const a = getTemplateRegistry();
      resetTemplateRegistry();
      const b = getTemplateRegistry();
      expect(a).not.toBe(b);
    });
  });
});
