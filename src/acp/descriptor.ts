/**
 * ACP (Agent Client Protocol) Agent Descriptor Builder
 * 
 * Builds ACP agent descriptors for Nova26 R21-02 agents.
 * Defines capabilities for all 21 Nova26 agent categories.
 */

import {
  type ACPAgentDescriptor,
  type ACPCapability,
} from './types.js';

/**
 * Nova26 version
 */
const NOVA26_VERSION = 'R21-02';

/**
 * Nova26 author
 */
const NOVA26_AUTHOR = 'Nova26 Team';

/**
 * Create a capability definition
 * @param id - Capability ID
 * @param name - Human-readable name
 * @param description - Capability description
 * @param agentSource - Source agent identifier
 * @param tags - Capability tags
 * @param requiresConfirmation - Whether confirmation is required
 * @returns Capability definition
 */
function createCapability(
  id: string,
  name: string,
  description: string,
  agentSource: string,
  tags: string[] = [],
  requiresConfirmation = false
): ACPCapability {
  return {
    id,
    name,
    description,
    agentSource,
    inputSchema: {}, // Would contain JSON Schema in production
    outputSchema: {}, // Would contain JSON Schema in production
    tags,
    requiresConfirmation,
  };
}

/**
 * Create the Nova26 Orchestrator agent descriptor
 * @returns Orchestrator descriptor
 */
function createOrchestratorDescriptor(): ACPAgentDescriptor {
  const agentSource = 'nova26-orchestrator';
  
  return {
    id: agentSource,
    name: 'Nova26 Orchestrator',
    version: NOVA26_VERSION,
    description: 'Central coordination agent for Nova26 - manages task delegation, workflow orchestration, and agent selection',
    author: NOVA26_AUTHOR,
    capabilities: [
      createCapability(
        'orchestrate.task-delegate',
        'Task Delegation',
        'Delegate tasks to appropriate specialized agents',
        agentSource,
        ['orchestration', 'delegation', 'coordination']
      ),
      createCapability(
        'orchestrate.workflow',
        'Workflow Management',
        'Manage complex multi-agent workflows',
        agentSource,
        ['orchestration', 'workflow', 'coordination']
      ),
      createCapability(
        'orchestrate.agent-select',
        'Agent Selection',
        'Select the best agent for a given task',
        agentSource,
        ['orchestration', 'selection', 'routing']
      ),
      createCapability(
        'orchestrate.plan-approval',
        'Plan Approval',
        'Coordinate plan approval workflows',
        agentSource,
        ['orchestration', 'approval', 'planning'],
        true
      ),
    ],
  };
}

/**
 * Create the Nova26 ACE (Auto-Code Evolution) agent descriptor
 * @returns ACE descriptor
 */
function createACEDescriptor(): ACPAgentDescriptor {
  const agentSource = 'nova26-ace';
  
  return {
    id: agentSource,
    name: 'Nova26 ACE',
    version: NOVA26_VERSION,
    description: 'Auto-Code Evolution agent - self-improving code generation and refinement',
    author: NOVA26_AUTHOR,
    capabilities: [
      createCapability(
        'ace.generate',
        'ACE Code Generation',
        'Generate code using ACE methodology',
        agentSource,
        ['code', 'generation', 'ace']
      ),
      createCapability(
        'ace.reflect',
        'ACE Reflection',
        'Reflect on generated code for improvements',
        agentSource,
        ['code', 'reflection', 'improvement']
      ),
      createCapability(
        'ace.curate',
        'ACE Curation',
        'Curate and validate code patterns',
        agentSource,
        ['code', 'curation', 'patterns']
      ),
    ],
  };
}

/**
 * Create the Nova26 Atlas agent descriptor
 * @returns Atlas descriptor
 */
function createAtlasDescriptor(): ACPAgentDescriptor {
  const agentSource = 'nova26-atlas';
  
  return {
    id: agentSource,
    name: 'Nova26 Atlas',
    version: NOVA26_VERSION,
    description: 'Knowledge graph and memory management agent - maintains project context and learnings',
    author: NOVA26_AUTHOR,
    capabilities: [
      createCapability(
        'atlas.query',
        'Atlas Query',
        'Query the knowledge graph for information',
        agentSource,
        ['knowledge', 'query', 'graph']
      ),
      createCapability(
        'atlas.store',
        'Atlas Store',
        'Store new knowledge in the graph',
        agentSource,
        ['knowledge', 'storage', 'graph']
      ),
      createCapability(
        'atlas.retrospective',
        'Atlas Retrospective',
        'Generate retrospectives from project history',
        agentSource,
        ['knowledge', 'retrospective', 'learning']
      ),
    ],
  };
}

/**
 * Create the Nova26 TasteVault agent descriptor
 * @returns TasteVault descriptor
 */
function createTasteVaultDescriptor(): ACPAgentDescriptor {
  const agentSource = 'nova26-taste-vault';
  
  return {
    id: agentSource,
    name: 'Nova26 TasteVault',
    version: NOVA26_VERSION,
    description: 'Personal preference and style learning agent - captures user taste patterns',
    author: NOVA26_AUTHOR,
    capabilities: [
      createCapability(
        'taste.capture',
        'Taste Capture',
        'Capture user preferences and style choices',
        agentSource,
        ['taste', 'preferences', 'learning']
      ),
      createCapability(
        'taste.apply',
        'Taste Apply',
        'Apply learned tastes to new code',
        agentSource,
        ['taste', 'application', 'style']
      ),
      createCapability(
        'taste.analyze',
        'Taste Analysis',
        'Analyze taste patterns from user actions',
        agentSource,
        ['taste', 'analysis', 'patterns']
      ),
    ],
  };
}

/**
 * Create the Nova26 Gates agent descriptor
 * @returns Gates descriptor
 */
function createGatesDescriptor(): ACPAgentDescriptor {
  const agentSource = 'nova26-gates';
  
  return {
    id: agentSource,
    name: 'Nova26 Gates',
    version: NOVA26_VERSION,
    description: 'Quality gates and validation agent - ensures code meets standards',
    author: NOVA26_AUTHOR,
    capabilities: [
      createCapability(
        'gates.typescript',
        'TypeScript Gate',
        'Validate TypeScript compilation',
        agentSource,
        ['validation', 'typescript', 'quality']
      ),
      createCapability(
        'gates.tests',
        'Test Gate',
        'Run and validate test suites',
        agentSource,
        ['validation', 'testing', 'quality']
      ),
      createCapability(
        'gates.lint',
        'Lint Gate',
        'Run linting and style checks',
        agentSource,
        ['validation', 'linting', 'style']
      ),
    ],
  };
}

/**
 * Create the Nova26 Rehearsal agent descriptor
 * @returns Rehearsal descriptor
 */
function createRehearsalDescriptor(): ACPAgentDescriptor {
  const agentSource = 'nova26-rehearsal';
  
  return {
    id: agentSource,
    name: 'Nova26 Rehearsal',
    version: NOVA26_VERSION,
    description: 'Safe experimentation agent - tries changes in isolated branches',
    author: NOVA26_AUTHOR,
    capabilities: [
      createCapability(
        'rehearsal.create',
        'Create Rehearsal',
        'Create a rehearsal branch for experimentation',
        agentSource,
        ['experimentation', 'branching', 'safety']
      ),
      createCapability(
        'rehearsal.score',
        'Score Rehearsal',
        'Score rehearsal results for viability',
        agentSource,
        ['experimentation', 'scoring', 'evaluation']
      ),
      createCapability(
        'rehearsal.merge',
        'Merge Rehearsal',
        'Merge successful rehearsal to main',
        agentSource,
        ['experimentation', 'merging', 'git'],
        true
      ),
    ],
  };
}

/**
 * Create the Nova26 Recovery agent descriptor
 * @returns Recovery descriptor
 */
function createRecoveryDescriptor(): ACPAgentDescriptor {
  const agentSource = 'nova26-recovery';
  
  return {
    id: agentSource,
    name: 'Nova26 Recovery',
    version: NOVA26_VERSION,
    description: 'Failure recovery and rollback agent - handles errors gracefully',
    author: NOVA26_AUTHOR,
    capabilities: [
      createCapability(
        'recovery.analyze',
        'Analyze Failure',
        'Analyze failures and suggest recovery actions',
        agentSource,
        ['recovery', 'analysis', 'error-handling']
      ),
      createCapability(
        'recovery.rollback',
        'Rollback',
        'Perform rollback to previous state',
        agentSource,
        ['recovery', 'rollback', 'safety'],
        true
      ),
      createCapability(
        'recovery.repair',
        'Auto Repair',
        'Attempt automatic repair of issues',
        agentSource,
        ['recovery', 'repair', 'automation']
      ),
    ],
  };
}

/**
 * Create the Nova26 Memory agent descriptor
 * @returns Memory descriptor
 */
function createMemoryDescriptor(): ACPAgentDescriptor {
  const agentSource = 'nova26-memory';
  
  return {
    id: agentSource,
    name: 'Nova26 Memory',
    version: NOVA26_VERSION,
    description: 'Session memory and context management agent - maintains conversation state',
    author: NOVA26_AUTHOR,
    capabilities: [
      createCapability(
        'memory.store',
        'Store Memory',
        'Store session memory and context',
        agentSource,
        ['memory', 'storage', 'context']
      ),
      createCapability(
        'memory.retrieve',
        'Retrieve Memory',
        'Retrieve previous session memories',
        agentSource,
        ['memory', 'retrieval', 'context']
      ),
      createCapability(
        'memory.summarize',
        'Summarize Session',
        'Summarize session for long-term storage',
        agentSource,
        ['memory', 'summarization', 'context']
      ),
    ],
  };
}

/**
 * Create the Nova26 Analytics agent descriptor
 * @returns Analytics descriptor
 */
function createAnalyticsDescriptor(): ACPAgentDescriptor {
  const agentSource = 'nova26-analytics';
  
  return {
    id: agentSource,
    name: 'Nova26 Analytics',
    version: NOVA26_VERSION,
    description: 'Usage analytics and insights agent - tracks performance and patterns',
    author: NOVA26_AUTHOR,
    capabilities: [
      createCapability(
        'analytics.track',
        'Track Event',
        'Track usage events and metrics',
        agentSource,
        ['analytics', 'tracking', 'metrics']
      ),
      createCapability(
        'analytics.report',
        'Generate Report',
        'Generate analytics reports',
        agentSource,
        ['analytics', 'reporting', 'insights']
      ),
      createCapability(
        'analytics.reflect',
        'Reflection Analysis',
        'Analyze patterns for self-improvement',
        agentSource,
        ['analytics', 'reflection', 'improvement']
      ),
    ],
  };
}

/**
 * Create the Nova26 Debt agent descriptor
 * @returns Debt descriptor
 */
function createDebtDescriptor(): ACPAgentDescriptor {
  const agentSource = 'nova26-debt';
  
  return {
    id: agentSource,
    name: 'Nova26 Debt',
    version: NOVA26_VERSION,
    description: 'Technical debt tracking agent - identifies and manages code debt',
    author: NOVA26_AUTHOR,
    capabilities: [
      createCapability(
        'debt.identify',
        'Identify Debt',
        'Identify technical debt in codebase',
        agentSource,
        ['debt', 'analysis', 'code-quality']
      ),
      createCapability(
        'debt.prioritize',
        'Prioritize Debt',
        'Prioritize debt items for resolution',
        agentSource,
        ['debt', 'prioritization', 'planning']
      ),
      createCapability(
        'debt.track',
        'Track Debt',
        'Track debt reduction over time',
        agentSource,
        ['debt', 'tracking', 'metrics']
      ),
    ],
  };
}

/**
 * Create the Nova26 Health agent descriptor
 * @returns Health descriptor
 */
function createHealthDescriptor(): ACPAgentDescriptor {
  const agentSource = 'nova26-health';
  
  return {
    id: agentSource,
    name: 'Nova26 Health',
    version: NOVA26_VERSION,
    description: 'Codebase health monitoring agent - tracks overall project health',
    author: NOVA26_AUTHOR,
    capabilities: [
      createCapability(
        'health.check',
        'Health Check',
        'Run comprehensive health checks',
        agentSource,
        ['health', 'monitoring', 'diagnostics']
      ),
      createCapability(
        'health.score',
        'Health Score',
        'Calculate codebase health score',
        agentSource,
        ['health', 'scoring', 'metrics']
      ),
      createCapability(
        'health.report',
        'Health Report',
        'Generate detailed health reports',
        agentSource,
        ['health', 'reporting', 'diagnostics']
      ),
    ],
  };
}

/**
 * Create the Nova26 Security agent descriptor
 * @returns Security descriptor
 */
function createSecurityDescriptor(): ACPAgentDescriptor {
  const agentSource = 'nova26-security';
  
  return {
    id: agentSource,
    name: 'Nova26 Security',
    version: NOVA26_VERSION,
    description: 'Security scanning and validation agent - ensures code security',
    author: NOVA26_AUTHOR,
    capabilities: [
      createCapability(
        'security.scan',
        'Security Scan',
        'Scan code for security vulnerabilities',
        agentSource,
        ['security', 'scanning', 'vulnerabilities']
      ),
      createCapability(
        'security.vault',
        'Vault Security',
        'Manage secrets and secure storage',
        agentSource,
        ['security', 'secrets', 'vault'],
        true
      ),
      createCapability(
        'security.audit',
        'Security Audit',
        'Perform security audits',
        agentSource,
        ['security', 'audit', 'compliance']
      ),
    ],
  };
}

/**
 * Create the Nova26 LLM agent descriptor
 * @returns LLM descriptor
 */
function createLLMDescriptor(): ACPAgentDescriptor {
  const agentSource = 'nova26-llm';
  
  return {
    id: agentSource,
    name: 'Nova26 LLM',
    version: NOVA26_VERSION,
    description: 'Language model routing and management agent - handles LLM interactions',
    author: NOVA26_AUTHOR,
    capabilities: [
      createCapability(
        'llm.route',
        'Route Request',
        'Route requests to optimal LLM',
        agentSource,
        ['llm', 'routing', 'optimization']
      ),
      createCapability(
        'llm.structured',
        'Structured Output',
        'Generate structured LLM outputs',
        agentSource,
        ['llm', 'structured', 'output']
      ),
      createCapability(
        'llm.cache',
        'Cache Response',
        'Cache and retrieve LLM responses',
        agentSource,
        ['llm', 'cache', 'optimization']
      ),
    ],
  };
}

/**
 * Create the Nova26 Testing agent descriptor
 * @returns Testing descriptor
 */
function createTestingDescriptor(): ACPAgentDescriptor {
  const agentSource = 'nova26-testing';
  
  return {
    id: agentSource,
    name: 'Nova26 Testing',
    version: NOVA26_VERSION,
    description: 'Test generation and execution agent - comprehensive testing support',
    author: NOVA26_AUTHOR,
    capabilities: [
      createCapability(
        'testing.generate',
        'Generate Tests',
        'Generate tests for code',
        agentSource,
        ['testing', 'generation', 'automation']
      ),
      createCapability(
        'testing.run',
        'Run Tests',
        'Execute test suites',
        agentSource,
        ['testing', 'execution', 'validation']
      ),
      createCapability(
        'testing.property',
        'Property Tests',
        'Generate property-based tests',
        agentSource,
        ['testing', 'property', 'fuzzing']
      ),
    ],
  };
}

/**
 * Create the Nova26 Review agent descriptor
 * @returns Review descriptor
 */
function createReviewDescriptor(): ACPAgentDescriptor {
  const agentSource = 'nova26-review';
  
  return {
    id: agentSource,
    name: 'Nova26 Review',
    version: NOVA26_VERSION,
    description: 'Code review agent - automated and assisted code reviews',
    author: NOVA26_AUTHOR,
    capabilities: [
      createCapability(
        'review.code',
        'Code Review',
        'Perform automated code review',
        agentSource,
        ['review', 'code', 'quality']
      ),
      createCapability(
        'review.pr',
        'PR Review',
        'Review pull requests',
        agentSource,
        ['review', 'pr', 'git']
      ),
      createCapability(
        'review.style',
        'Style Review',
        'Review code style and patterns',
        agentSource,
        ['review', 'style', 'consistency']
      ),
    ],
  };
}

/**
 * Create the Nova26 Debug agent descriptor
 * @returns Debug descriptor
 */
function createDebugDescriptor(): ACPAgentDescriptor {
  const agentSource = 'nova26-debug';
  
  return {
    id: agentSource,
    name: 'Nova26 Debug',
    version: NOVA26_VERSION,
    description: 'Debugging and diagnostics agent - helps troubleshoot issues',
    author: NOVA26_AUTHOR,
    capabilities: [
      createCapability(
        'debug.analyze',
        'Analyze Error',
        'Analyze errors and suggest fixes',
        agentSource,
        ['debug', 'analysis', 'troubleshooting']
      ),
      createCapability(
        'debug.trace',
        'Trace Execution',
        'Trace code execution paths',
        agentSource,
        ['debug', 'tracing', 'diagnostics']
      ),
      createCapability(
        'debug.reproduce',
        'Reproduce Issue',
        'Attempt to reproduce reported issues',
        agentSource,
        ['debug', 'reproduction', 'testing']
      ),
    ],
  };
}

/**
 * Create the Nova26 Optimization agent descriptor
 * @returns Optimization descriptor
 */
function createOptimizationDescriptor(): ACPAgentDescriptor {
  const agentSource = 'nova26-optimization';
  
  return {
    id: agentSource,
    name: 'Nova26 Optimization',
    version: NOVA26_VERSION,
    description: 'Performance optimization agent - improves code performance',
    author: NOVA26_AUTHOR,
    capabilities: [
      createCapability(
        'optimization.analyze',
        'Analyze Performance',
        'Analyze code for performance issues',
        agentSource,
        ['optimization', 'performance', 'analysis']
      ),
      createCapability(
        'optimization.suggest',
        'Suggest Optimizations',
        'Suggest performance improvements',
        agentSource,
        ['optimization', 'suggestions', 'performance']
      ),
      createCapability(
        'optimization.bundle',
        'Bundle Optimization',
        'Optimize bundle size and loading',
        agentSource,
        ['optimization', 'bundle', 'performance']
      ),
    ],
  };
}

/**
 * Create the Nova26 Migrate agent descriptor
 * @returns Migrate descriptor
 */
function createMigrateDescriptor(): ACPAgentDescriptor {
  const agentSource = 'nova26-migrate';
  
  return {
    id: agentSource,
    name: 'Nova26 Migrate',
    version: NOVA26_VERSION,
    description: 'Code migration agent - assists with framework and version migrations',
    author: NOVA26_AUTHOR,
    capabilities: [
      createCapability(
        'migrate.analyze',
        'Analyze Migration',
        'Analyze migration requirements',
        agentSource,
        ['migration', 'analysis', 'planning']
      ),
      createCapability(
        'migrate.execute',
        'Execute Migration',
        'Execute code migrations',
        agentSource,
        ['migration', 'execution', 'automation'],
        true
      ),
      createCapability(
        'migrate.verify',
        'Verify Migration',
        'Verify migration success',
        agentSource,
        ['migration', 'verification', 'validation']
      ),
    ],
  };
}

/**
 * Create the Nova26 Generative UI agent descriptor
 * @returns Generative UI descriptor
 */
function createGenerativeUIDescriptor(): ACPAgentDescriptor {
  const agentSource = 'nova26-generative-ui';
  
  return {
    id: agentSource,
    name: 'Nova26 Generative UI',
    version: NOVA26_VERSION,
    description: 'UI generation agent - creates user interfaces from specifications',
    author: NOVA26_AUTHOR,
    capabilities: [
      createCapability(
        'ui.generate',
        'Generate UI',
        'Generate UI components from specs',
        agentSource,
        ['ui', 'generation', 'components']
      ),
      createCapability(
        'ui.style',
        'Style UI',
        'Apply styles and themes to UI',
        agentSource,
        ['ui', 'styling', 'themes']
      ),
      createCapability(
        'ui.a11y',
        'Accessibility Check',
        'Check UI accessibility compliance',
        agentSource,
        ['ui', 'accessibility', 'a11y']
      ),
    ],
  };
}

/**
 * Create the Nova26 Design Pipeline agent descriptor
 * @returns Design Pipeline descriptor
 */
function createDesignPipelineDescriptor(): ACPAgentDescriptor {
  const agentSource = 'nova26-design-pipeline';
  
  return {
    id: agentSource,
    name: 'Nova26 Design Pipeline',
    version: NOVA26_VERSION,
    description: 'Design-to-code pipeline agent - converts designs to implementation',
    author: NOVA26_AUTHOR,
    capabilities: [
      createCapability(
        'design.parse',
        'Parse Design',
        'Parse design files and extract specs',
        agentSource,
        ['design', 'parsing', 'specs']
      ),
      createCapability(
        'design.tokens',
        'Generate Tokens',
        'Generate design tokens from designs',
        agentSource,
        ['design', 'tokens', 'system']
      ),
      createCapability(
        'design.implement',
        'Implement Design',
        'Implement designs as code',
        agentSource,
        ['design', 'implementation', 'codegen']
      ),
    ],
  };
}

/**
 * Create the complete Nova26 agent descriptor
 * @returns Nova26 master descriptor
 */
export function createNova26Descriptor(): ACPAgentDescriptor {
  const allAgents = [
    createOrchestratorDescriptor(),
    createACEDescriptor(),
    createAtlasDescriptor(),
    createTasteVaultDescriptor(),
    createGatesDescriptor(),
    createRehearsalDescriptor(),
    createRecoveryDescriptor(),
    createMemoryDescriptor(),
    createAnalyticsDescriptor(),
    createDebtDescriptor(),
    createHealthDescriptor(),
    createSecurityDescriptor(),
    createLLMDescriptor(),
    createTestingDescriptor(),
    createReviewDescriptor(),
    createDebugDescriptor(),
    createOptimizationDescriptor(),
    createMigrateDescriptor(),
    createGenerativeUIDescriptor(),
    createDesignPipelineDescriptor(),
  ];

  // Collect all capabilities from all agents
  const allCapabilities: ACPCapability[] = allAgents.flatMap(agent => agent.capabilities);

  return {
    id: 'nova26',
    name: 'Nova26 R21-02',
    version: NOVA26_VERSION,
    description: 'Nova26 Agent Platform - A comprehensive AI-assisted development environment with 21 specialized agents',
    author: NOVA26_AUTHOR,
    website: 'https://nova26.dev',
    icon: '🚀',
    capabilities: allCapabilities,
  };
}

/**
 * Get all Nova26 agent descriptors
 * @returns Array of all agent descriptors
 */
export function getAllNova26Agents(): ACPAgentDescriptor[] {
  return [
    createOrchestratorDescriptor(),
    createACEDescriptor(),
    createAtlasDescriptor(),
    createTasteVaultDescriptor(),
    createGatesDescriptor(),
    createRehearsalDescriptor(),
    createRecoveryDescriptor(),
    createMemoryDescriptor(),
    createAnalyticsDescriptor(),
    createDebtDescriptor(),
    createHealthDescriptor(),
    createSecurityDescriptor(),
    createLLMDescriptor(),
    createTestingDescriptor(),
    createReviewDescriptor(),
    createDebugDescriptor(),
    createOptimizationDescriptor(),
    createMigrateDescriptor(),
    createGenerativeUIDescriptor(),
    createDesignPipelineDescriptor(),
  ];
}

/**
 * Get a specific Nova26 agent descriptor by ID
 * @param agentId - Agent ID
 * @returns Agent descriptor or undefined
 */
export function getNova26Agent(agentId: string): ACPAgentDescriptor | undefined {
  const agents: Record<string, () => ACPAgentDescriptor> = {
    'nova26-orchestrator': createOrchestratorDescriptor,
    'nova26-ace': createACEDescriptor,
    'nova26-atlas': createAtlasDescriptor,
    'nova26-taste-vault': createTasteVaultDescriptor,
    'nova26-gates': createGatesDescriptor,
    'nova26-rehearsal': createRehearsalDescriptor,
    'nova26-recovery': createRecoveryDescriptor,
    'nova26-memory': createMemoryDescriptor,
    'nova26-analytics': createAnalyticsDescriptor,
    'nova26-debt': createDebtDescriptor,
    'nova26-health': createHealthDescriptor,
    'nova26-security': createSecurityDescriptor,
    'nova26-llm': createLLMDescriptor,
    'nova26-testing': createTestingDescriptor,
    'nova26-review': createReviewDescriptor,
    'nova26-debug': createDebugDescriptor,
    'nova26-optimization': createOptimizationDescriptor,
    'nova26-migrate': createMigrateDescriptor,
    'nova26-generative-ui': createGenerativeUIDescriptor,
    'nova26-design-pipeline': createDesignPipelineDescriptor,
  };

  const factory = agents[agentId];
  return factory ? factory() : undefined;
}
