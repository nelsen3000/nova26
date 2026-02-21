// Workflow Templates - Pre-built workflow templates
// Spec: .nova/specs/grok-r24-immortal-omniverse.md (R24-02)

import { type Workflow, WorkflowSchema } from './types';

// ═══════════════════════════════════════════════════════════════════════════════
// Template Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface TemplateMetadata {
  id: string;
  name: string;
  description: string;
  category: 'development' | 'review' | 'testing' | 'deployment' | 'custom';
  tags: string[];
  complexity: 'simple' | 'medium' | 'complex';
}

// ═══════════════════════════════════════════════════════════════════════════════
// Pre-built Templates
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Simple agent task template
 * Trigger → Agent → Complete
 */
export function createAgentTaskTemplate(
  name: string = 'Agent Task',
  agentId: string = 'default-agent'
): Workflow {
  const timestamp = Date.now();
  return WorkflowSchema.parse({
    id: `template-agent-task-${timestamp}`,
    name,
    description: 'Execute a single agent task',
    nodes: [
      {
        id: 'trigger',
        type: 'trigger',
        name: 'Start',
        config: { type: 'manual' },
        position: { x: 100, y: 100 },
      },
      {
        id: 'agent',
        type: 'agent',
        name: 'Execute Agent',
        config: { agentId, taskType: 'execute' },
        position: { x: 300, y: 100 },
      },
    ],
    edges: [
      {
        id: 'edge-1',
        source: 'trigger',
        target: 'agent',
      },
    ],
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

/**
 * Code review workflow
 * Trigger → Review Agent → Decision (pass/fail) → Complete
 */
export function createCodeReviewTemplate(
  name: string = 'Code Review'
): Workflow {
  const timestamp = Date.now();
  return WorkflowSchema.parse({
    id: `template-code-review-${timestamp}`,
    name,
    description: 'Automated code review workflow',
    nodes: [
      {
        id: 'trigger',
        type: 'trigger',
        name: 'PR Created',
        config: { type: 'webhook', event: 'pull_request' },
        position: { x: 100, y: 200 },
      },
      {
        id: 'review',
        type: 'agent',
        name: 'Code Review',
        config: { agentId: 'mercury', taskType: 'review' },
        position: { x: 300, y: 200 },
      },
      {
        id: 'decision',
        type: 'decision',
        name: 'Pass?',
        config: {
          condition: 'context.reviewPassed',
          branches: [
            { label: 'Yes', expression: 'context.reviewPassed === true' },
            { label: 'No', expression: 'context.reviewPassed === false' },
          ],
        },
        position: { x: 500, y: 200 },
      },
      {
        id: 'approve',
        type: 'agent',
        name: 'Approve PR',
        config: { agentId: 'sun', taskType: 'approve' },
        position: { x: 700, y: 100 },
      },
      {
        id: 'reject',
        type: 'agent',
        name: 'Request Changes',
        config: { agentId: 'sun', taskType: 'reject' },
        position: { x: 700, y: 300 },
      },
    ],
    edges: [
      { id: 'edge-1', source: 'trigger', target: 'review' },
      { id: 'edge-2', source: 'review', target: 'decision' },
      {
        id: 'edge-3',
        source: 'decision',
        target: 'approve',
        label: 'Yes',
        condition: 'context.reviewPassed === true',
      },
      {
        id: 'edge-4',
        source: 'decision',
        target: 'reject',
        label: 'No',
        condition: 'context.reviewPassed === false',
      },
    ],
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

/**
 * Multi-agent swarm workflow
 * Trigger → Parallel Agents → Consensus → Complete
 */
export function createMultiAgentSwarmTemplate(
  name: string = 'Multi-Agent Swarm'
): Workflow {
  const timestamp = Date.now();
  return WorkflowSchema.parse({
    id: `template-swarm-${timestamp}`,
    name,
    description: 'Execute multiple agents in parallel and aggregate results',
    nodes: [
      {
        id: 'trigger',
        type: 'trigger',
        name: 'Start',
        config: { type: 'manual' },
        position: { x: 100, y: 200 },
      },
      {
        id: 'parallel',
        type: 'parallel',
        name: 'Parallel Execution',
        config: {
          branches: [
            ['agent1'],
            ['agent2'],
            ['agent3'],
          ],
          joinStrategy: 'all',
        },
        position: { x: 300, y: 200 },
      },
      {
        id: 'agent1',
        type: 'agent',
        name: 'Agent A',
        config: { agentId: 'venus', taskType: 'analyze' },
        position: { x: 500, y: 100 },
      },
      {
        id: 'agent2',
        type: 'agent',
        name: 'Agent B',
        config: { agentId: 'mars', taskType: 'analyze' },
        position: { x: 500, y: 200 },
      },
      {
        id: 'agent3',
        type: 'agent',
        name: 'Agent C',
        config: { agentId: 'jupiter', taskType: 'analyze' },
        position: { x: 500, y: 300 },
      },
      {
        id: 'consensus',
        type: 'agent',
        name: 'Consensus',
        config: { agentId: 'sun', taskType: 'aggregate' },
        position: { x: 700, y: 200 },
      },
    ],
    edges: [
      { id: 'edge-1', source: 'trigger', target: 'parallel' },
      { id: 'edge-2', source: 'parallel', target: 'agent1' },
      { id: 'edge-3', source: 'parallel', target: 'agent2' },
      { id: 'edge-4', source: 'parallel', target: 'agent3' },
      { id: 'edge-5', source: 'agent1', target: 'consensus' },
      { id: 'edge-6', source: 'agent2', target: 'consensus' },
      { id: 'edge-7', source: 'agent3', target: 'consensus' },
    ],
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

/**
 * Iterative refinement workflow
 * Trigger → Agent → Decision → (Loop back or Complete)
 */
export function createIterativeRefinementTemplate(
  name: string = 'Iterative Refinement'
): Workflow {
  const timestamp = Date.now();
  return WorkflowSchema.parse({
    id: `template-iterative-${timestamp}`,
    name,
    description: 'Iteratively refine output until quality threshold is met',
    nodes: [
      {
        id: 'trigger',
        type: 'trigger',
        name: 'Start',
        config: { type: 'manual' },
        position: { x: 100, y: 200 },
      },
      {
        id: 'agent',
        type: 'agent',
        name: 'Generate',
        config: { agentId: 'venus', taskType: 'generate' },
        position: { x: 300, y: 200 },
      },
      {
        id: 'review',
        type: 'agent',
        name: 'Review',
        config: { agentId: 'mercury', taskType: 'review' },
        position: { x: 500, y: 200 },
      },
      {
        id: 'decision',
        type: 'decision',
        name: 'Quality OK?',
        config: {
          condition: 'context.quality >= 0.8',
          branches: [
            { label: 'Yes', expression: 'context.quality >= 0.8' },
            { label: 'No', expression: 'context.quality < 0.8' },
          ],
        },
        position: { x: 700, y: 200 },
      },
    ],
    edges: [
      { id: 'edge-1', source: 'trigger', target: 'agent' },
      { id: 'edge-2', source: 'agent', target: 'review' },
      { id: 'edge-3', source: 'review', target: 'decision' },
      {
        id: 'edge-4',
        source: 'decision',
        target: 'agent',
        label: 'Retry',
        condition: 'context.quality < 0.8',
      },
    ],
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

/**
 * Sequential pipeline workflow
 * Trigger → Step 1 → Step 2 → Step 3 → Complete
 */
export function createSequentialPipelineTemplate(
  name: string = 'Sequential Pipeline',
  steps: { name: string; agentId: string }[] = []
): Workflow {
  const timestamp = Date.now();

  // Default steps if not provided
  const defaultSteps = [
    { name: 'Analyze', agentId: 'jupiter' },
    { name: 'Design', agentId: 'venus' },
    { name: 'Implement', agentId: 'mars' },
    { name: 'Test', agentId: 'saturn' },
  ];

  const pipelineSteps = steps.length > 0 ? steps : defaultSteps;

  const nodes = [
    {
      id: 'trigger',
      type: 'trigger' as const,
      name: 'Start',
      config: { type: 'manual' as const },
      position: { x: 100, y: 100 },
    },
    ...pipelineSteps.map((step, index) => ({
      id: `step-${index}`,
      type: 'agent' as const,
      name: step.name,
      config: { agentId: step.agentId, taskType: 'execute' },
      position: { x: 300 + index * 200, y: 100 },
    })),
  ];

  const edges = [
    { id: 'edge-trigger', source: 'trigger', target: 'step-0' },
    ...pipelineSteps.slice(0, -1).map((_, index) => ({
      id: `edge-${index}`,
      source: `step-${index}`,
      target: `step-${index + 1}`,
    })),
  ];

  return WorkflowSchema.parse({
    id: `template-pipeline-${timestamp}`,
    name,
    description: 'Execute sequential pipeline of agent tasks',
    nodes,
    edges,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Template Registry
// ═══════════════════════════════════════════════════════════════════════════════

export class TemplateRegistry {
  private templates: Map<string, TemplateMetadata> = new Map();

  constructor() {
    // Register built-in templates
    this.register({
      id: 'agent-task',
      name: 'Agent Task',
      description: 'Execute a single agent task',
      category: 'development',
      tags: ['simple', 'single-agent'],
      complexity: 'simple',
    });

    this.register({
      id: 'code-review',
      name: 'Code Review',
      description: 'Automated code review workflow',
      category: 'review',
      tags: ['review', 'decision'],
      complexity: 'medium',
    });

    this.register({
      id: 'multi-agent-swarm',
      name: 'Multi-Agent Swarm',
      description: 'Execute multiple agents in parallel and aggregate results',
      category: 'development',
      tags: ['parallel', 'multi-agent', 'swarm'],
      complexity: 'complex',
    });

    this.register({
      id: 'iterative-refinement',
      name: 'Iterative Refinement',
      description: 'Iteratively refine output until quality threshold is met',
      category: 'development',
      tags: ['loop', 'quality', 'refinement'],
      complexity: 'medium',
    });

    this.register({
      id: 'sequential-pipeline',
      name: 'Sequential Pipeline',
      description: 'Execute sequential pipeline of agent tasks',
      category: 'development',
      tags: ['pipeline', 'sequential'],
      complexity: 'medium',
    });
  }

  /**
   * Register a template
   */
  register(metadata: TemplateMetadata): void {
    this.templates.set(metadata.id, metadata);
  }

  /**
   * Get template metadata
   */
  get(id: string): TemplateMetadata | undefined {
    return this.templates.get(id);
  }

  /**
   * List all templates
   */
  list(filters?: {
    category?: string;
    complexity?: string;
    tags?: string[];
  }): TemplateMetadata[] {
    let templates = Array.from(this.templates.values());

    if (filters?.category) {
      templates = templates.filter(t => t.category === filters.category);
    }

    if (filters?.complexity) {
      templates = templates.filter(t => t.complexity === filters.complexity);
    }

    if (filters?.tags) {
      templates = templates.filter(t =>
        filters.tags!.some(tag => t.tags.includes(tag))
      );
    }

    return templates;
  }

  /**
   * Instantiate a template
   */
  instantiate(templateId: string, name?: string): Workflow {
    const metadata = this.templates.get(templateId);
    if (!metadata) {
      throw new Error(`Template not found: ${templateId}`);
    }

    const workflowName = name ?? metadata.name;

    switch (templateId) {
      case 'agent-task':
        return createAgentTaskTemplate(workflowName);
      case 'code-review':
        return createCodeReviewTemplate(workflowName);
      case 'multi-agent-swarm':
        return createMultiAgentSwarmTemplate(workflowName);
      case 'iterative-refinement':
        return createIterativeRefinementTemplate(workflowName);
      case 'sequential-pipeline':
        return createSequentialPipelineTemplate(workflowName);
      default:
        throw new Error(`Unknown template: ${templateId}`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Singleton
// ═══════════════════════════════════════════════════════════════════════════════

let globalRegistry: TemplateRegistry | null = null;

export function getTemplateRegistry(): TemplateRegistry {
  if (!globalRegistry) {
    globalRegistry = new TemplateRegistry();
  }
  return globalRegistry;
}

export function resetTemplateRegistry(): void {
  globalRegistry = null;
}
