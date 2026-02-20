// Agent Capability Matrix - Maps all 21 agents to their capabilities
// Provides query/filter functions for agent selection


/**
 * Capability categories for agents
 */
export type AgentCapability =
  | 'code'           // Code generation and editing
  | 'design'         // UI/UX design, visual design
  | 'test'           // Testing, test generation
  | 'deploy'         // Deployment, infrastructure
  | 'review'         // Code review, analysis
  | 'debug'          // Debugging, troubleshooting
  | 'document'       // Documentation generation
  | 'architect'      // System architecture, planning
  | 'optimize'       // Performance optimization
  | 'security'       // Security analysis, scanning
  | 'refactor'       // Code refactoring
  | 'analyze'        // Code analysis, metrics
  | 'integrate'      // Integration tasks
  | 'migrate';       // Migration tasks

/**
 * Agent metadata and capabilities
 */
export interface AgentDefinition {
  id: string;
  name: string;
  description: string;
  capabilities: AgentCapability[];
  preferredModels: string[];
  maxConcurrency: number;
  averageTaskDurationMs: number;
  tags: string[];
}

/**
 * Filter options for querying agents
 */
export interface AgentFilter {
  capabilities?: AgentCapability[];
  requireAllCapabilities?: boolean;
  tags?: string[];
  maxDurationMs?: number;
  minConcurrency?: number;
}

/**
 * Performance metrics for an agent
 */
export interface AgentMetrics {
  id: string;
  tasksCompleted: number;
  averageDurationMs: number;
  successRate: number;
  lastUsed: string | null;
}

// ============================================================================
// Agent Registry - All 21 Nova26 Agents
// ============================================================================

export const AGENT_REGISTRY: AgentDefinition[] = [
  // Core Development Agents
  {
    id: 'EARTH',
    name: 'Earth',
    description: 'Foundation agent for core code generation and TypeScript/JavaScript development',
    capabilities: ['code', 'refactor', 'document'],
    preferredModels: ['gpt-4o', 'claude-3-sonnet', 'qwen2.5:14b'],
    maxConcurrency: 5,
    averageTaskDurationMs: 45000,
    tags: ['core', 'typescript', 'javascript', 'frontend'],
  },
  {
    id: 'MARS',
    name: 'Mars',
    description: 'Backend specialist focused on APIs, databases, and server-side logic',
    capabilities: ['code', 'architect', 'deploy', 'integrate'],
    preferredModels: ['gpt-4o', 'claude-3-sonnet', 'deepseek-coder:6.7b'],
    maxConcurrency: 4,
    averageTaskDurationMs: 60000,
    tags: ['backend', 'api', 'database', 'server'],
  },
  {
    id: 'VENUS',
    name: 'Venus',
    description: 'Design-focused agent for UI/UX, styling, and visual components',
    capabilities: ['design', 'code', 'optimize'],
    preferredModels: ['claude-3-sonnet', 'gpt-4o', 'qwen2.5:7b'],
    maxConcurrency: 3,
    averageTaskDurationMs: 40000,
    tags: ['design', 'ui', 'ux', 'css', 'styling'],
  },
  {
    id: 'MERCURY',
    name: 'Mercury',
    description: 'Fast iteration agent for quick fixes, small features, and rapid prototyping',
    capabilities: ['code', 'debug', 'refactor'],
    preferredModels: ['gpt-4o-mini', 'qwen2.5:7b', 'llama3:8b'],
    maxConcurrency: 8,
    averageTaskDurationMs: 20000,
    tags: ['fast', 'prototype', 'quick-fix', 'iteration'],
  },
  {
    id: 'JUPITER',
    name: 'Jupiter',
    description: 'Architecture and planning agent for system design and large-scale decisions',
    capabilities: ['architect', 'analyze', 'review', 'document'],
    preferredModels: ['claude-3-opus', 'gpt-4o', 'o1-mini'],
    maxConcurrency: 2,
    averageTaskDurationMs: 120000,
    tags: ['architecture', 'planning', 'system-design', 'leadership'],
  },

  // Testing & Quality Agents
  {
    id: 'SATURN',
    name: 'Saturn',
    description: 'Testing specialist for unit tests, integration tests, and test coverage',
    capabilities: ['test', 'code', 'analyze', 'review'],
    preferredModels: ['gpt-4o', 'claude-3-sonnet', 'codellama:7b'],
    maxConcurrency: 4,
    averageTaskDurationMs: 50000,
    tags: ['testing', 'quality', 'coverage', 'tdd', 'test'],
  },
  {
    id: 'NEPTUNE',
    name: 'Neptune',
    description: 'Quality assurance agent for end-to-end testing and validation',
    capabilities: ['test', 'review', 'analyze', 'debug'],
    preferredModels: ['gpt-4o', 'claude-3-sonnet', 'qwen2.5:14b'],
    maxConcurrency: 3,
    averageTaskDurationMs: 90000,
    tags: ['qa', 'e2e', 'validation', 'quality', 'test'],
  },

  // DevOps & Infrastructure Agents
  {
    id: 'URANUS',
    name: 'Uranus',
    description: 'Infrastructure and deployment agent for CI/CD and cloud configuration',
    capabilities: ['deploy', 'architect', 'integrate', 'security'],
    preferredModels: ['gpt-4o', 'claude-3-sonnet', 'qwen2.5:14b'],
    maxConcurrency: 3,
    averageTaskDurationMs: 75000,
    tags: ['devops', 'ci-cd', 'infrastructure', 'cloud'],
  },
  {
    id: 'PLUTO',
    name: 'Pluto',
    description: 'Security and compliance agent for vulnerability scanning and security reviews',
    capabilities: ['security', 'review', 'analyze', 'test'],
    preferredModels: ['claude-3-opus', 'gpt-4o', 'o1-mini'],
    maxConcurrency: 2,
    averageTaskDurationMs: 100000,
    tags: ['security', 'compliance', 'audit', 'vulnerability'],
  },

  // Specialized Agents
  {
    id: 'IO',
    name: 'Io',
    description: 'Performance optimization agent for code efficiency and speed improvements',
    capabilities: ['optimize', 'analyze', 'refactor', 'code'],
    preferredModels: ['gpt-4o', 'claude-3-sonnet', 'deepseek-coder:6.7b'],
    maxConcurrency: 3,
    averageTaskDurationMs: 80000,
    tags: ['performance', 'optimization', 'profiling', 'speed'],
  },
  {
    id: 'EUROPA',
    name: 'Europa',
    description: 'Documentation specialist for READMEs, API docs, and technical writing',
    capabilities: ['document', 'review', 'analyze'],
    preferredModels: ['claude-3-sonnet', 'gpt-4o', 'qwen2.5:7b'],
    maxConcurrency: 4,
    averageTaskDurationMs: 35000,
    tags: ['documentation', 'writing', 'readme', 'api-docs'],
  },
  {
    id: 'GANYMEDE',
    name: 'Ganymede',
    description: 'Migration specialist for framework upgrades and code migrations',
    capabilities: ['migrate', 'refactor', 'code', 'architect'],
    preferredModels: ['gpt-4o', 'claude-3-opus', 'qwen2.5:14b'],
    maxConcurrency: 2,
    averageTaskDurationMs: 150000,
    tags: ['migration', 'upgrade', 'refactoring', 'modernization'],
  },
  {
    id: 'CALLISTO',
    name: 'Callisto',
    description: 'Integration specialist for third-party APIs and service integration',
    capabilities: ['integrate', 'code', 'test', 'debug'],
    preferredModels: ['gpt-4o', 'claude-3-sonnet', 'deepseek-coder:6.7b'],
    maxConcurrency: 4,
    averageTaskDurationMs: 70000,
    tags: ['integration', 'api', 'third-party', 'services'],
  },

  // Analysis & Review Agents
  {
    id: 'TITAN',
    name: 'Titan',
    description: 'Code review specialist for PR reviews and code quality assessment',
    capabilities: ['review', 'analyze', 'document'],
    preferredModels: ['claude-3-opus', 'gpt-4o', 'o1-mini'],
    maxConcurrency: 3,
    averageTaskDurationMs: 85000,
    tags: ['review', 'pr', 'quality', 'assessment'],
  },
  {
    id: 'ENCELADUS',
    name: 'Enceladus',
    description: 'Debugging specialist for error analysis and troubleshooting',
    capabilities: ['debug', 'analyze', 'code', 'test'],
    preferredModels: ['o1-mini', 'claude-3-opus', 'gpt-4o'],
    maxConcurrency: 4,
    averageTaskDurationMs: 55000,
    tags: ['debugging', 'troubleshooting', 'error-analysis', 'fixing', 'test'],
  },
  {
    id: 'TETHYS',
    name: 'Tethys',
    description: 'Analytics agent for metrics, monitoring, and data analysis',
    capabilities: ['analyze', 'optimize', 'document'],
    preferredModels: ['gpt-4o', 'claude-3-sonnet', 'qwen2.5:14b'],
    maxConcurrency: 3,
    averageTaskDurationMs: 65000,
    tags: ['analytics', 'metrics', 'monitoring', 'data'],
  },

  // AI/ML Specialized Agents
  {
    id: 'TRITON',
    name: 'Triton',
    description: 'AI/ML integration agent for model deployment and ML pipeline setup',
    capabilities: ['integrate', 'deploy', 'architect', 'code'],
    preferredModels: ['claude-3-opus', 'gpt-4o', 'o1-mini'],
    maxConcurrency: 2,
    averageTaskDurationMs: 110000,
    tags: ['ml', 'ai', 'model-deployment', 'pipeline'],
  },
  {
    id: 'RHEA',
    name: 'Rhea',
    description: 'Database optimization and schema design specialist',
    capabilities: ['optimize', 'architect', 'code', 'migrate'],
    preferredModels: ['gpt-4o', 'claude-3-sonnet', 'deepseek-coder:6.7b'],
    maxConcurrency: 3,
    averageTaskDurationMs: 80000,
    tags: ['database', 'schema', 'optimization', 'sql'],
  },
  {
    id: 'DIONE',
    name: 'Dione',
    description: 'Frontend framework specialist for React, Vue, Angular components',
    capabilities: ['code', 'design', 'optimize', 'refactor'],
    preferredModels: ['gpt-4o', 'claude-3-sonnet', 'qwen2.5:14b'],
    maxConcurrency: 4,
    averageTaskDurationMs: 50000,
    tags: ['frontend', 'react', 'vue', 'angular', 'components'],
  },
  {
    id: 'IAPETUS',
    name: 'Iapetus',
    description: 'Legacy code maintenance and technical debt management',
    capabilities: ['refactor', 'migrate', 'analyze', 'document'],
    preferredModels: ['claude-3-opus', 'gpt-4o', 'qwen2.5:14b'],
    maxConcurrency: 3,
    averageTaskDurationMs: 95000,
    tags: ['legacy', 'maintenance', 'technical-debt', 'cleanup'],
  },
  {
    id: 'OBERON',
    name: 'Oberon',
    description: 'Mobile development specialist for iOS and Android applications',
    capabilities: ['code', 'design', 'test', 'integrate'],
    preferredModels: ['gpt-4o', 'claude-3-sonnet', 'qwen2.5:14b'],
    maxConcurrency: 3,
    averageTaskDurationMs: 70000,
    tags: ['mobile', 'ios', 'android', 'react-native'],
  },
];

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Get all agents in the registry
 */
export function getAllAgents(): AgentDefinition[] {
  return [...AGENT_REGISTRY];
}

/**
 * Get an agent by its ID
 */
export function getAgentById(id: string): AgentDefinition | undefined {
  return AGENT_REGISTRY.find(agent => agent.id === id);
}

/**
 * Get agents by name (case-insensitive partial match)
 */
export function getAgentsByName(name: string): AgentDefinition[] {
  const lowerName = name.toLowerCase();
  return AGENT_REGISTRY.filter(agent =>
    agent.name.toLowerCase().includes(lowerName)
  );
}

/**
 * Get agents by capability
 */
export function getAgentsByCapability(capability: AgentCapability): AgentDefinition[] {
  return AGENT_REGISTRY.filter(agent =>
    agent.capabilities.includes(capability)
  );
}

/**
 * Get agents by tag
 */
export function getAgentsByTag(tag: string): AgentDefinition[] {
  const lowerTag = tag.toLowerCase();
  return AGENT_REGISTRY.filter(agent =>
    agent.tags.some(t => t.toLowerCase().includes(lowerTag))
  );
}

/**
 * Filter agents based on multiple criteria
 */
export function filterAgents(filter: AgentFilter): AgentDefinition[] {
  return AGENT_REGISTRY.filter(agent => {
    // Filter by capabilities
    if (filter.capabilities && filter.capabilities.length > 0) {
      if (filter.requireAllCapabilities) {
        // Agent must have ALL specified capabilities
        const hasAll = filter.capabilities.every(cap =>
          agent.capabilities.includes(cap)
        );
        if (!hasAll) return false;
      } else {
        // Agent must have at least ONE specified capability
        const hasAny = filter.capabilities.some(cap =>
          agent.capabilities.includes(cap)
        );
        if (!hasAny) return false;
      }
    }

    // Filter by tags
    if (filter.tags && filter.tags.length > 0) {
      const hasTag = filter.tags.some(tag =>
        agent.tags.some(t => t.toLowerCase().includes(tag.toLowerCase()))
      );
      if (!hasTag) return false;
    }

    // Filter by max duration
    if (filter.maxDurationMs !== undefined) {
      if (agent.averageTaskDurationMs > filter.maxDurationMs) return false;
    }

    // Filter by min concurrency
    if (filter.minConcurrency !== undefined) {
      if (agent.maxConcurrency < filter.minConcurrency) return false;
    }

    return true;
  });
}

/**
 * Find the best agent for a specific task based on capabilities and performance
 */
export function findBestAgentForTask(
  requiredCapabilities: AgentCapability[],
  options: {
    preferFastest?: boolean;
    preferHighConcurrency?: boolean;
    excludeAgents?: string[];
  } = {}
): AgentDefinition | undefined {
  const { preferFastest = false, preferHighConcurrency = false, excludeAgents = [] } = options;

  // Filter agents that have all required capabilities
  const candidates = AGENT_REGISTRY.filter(agent => {
    if (excludeAgents.includes(agent.id)) return false;
    return requiredCapabilities.every(cap => agent.capabilities.includes(cap));
  });

  if (candidates.length === 0) return undefined;

  // Sort based on preferences
  return candidates.sort((a, b) => {
    // If preferFastest, sort by duration ascending
    if (preferFastest) {
      return a.averageTaskDurationMs - b.averageTaskDurationMs;
    }

    // If preferHighConcurrency, sort by concurrency descending
    if (preferHighConcurrency) {
      return b.maxConcurrency - a.maxConcurrency;
    }

    // Default: balance of capability match and efficiency
    const aMatchScore = requiredCapabilities.filter(cap =>
      a.capabilities.includes(cap)
    ).length;
    const bMatchScore = requiredCapabilities.filter(cap =>
      b.capabilities.includes(cap)
    ).length;

    // Prefer agents where these capabilities are primary (earlier in their list)
    const aPrimaryScore = requiredCapabilities.reduce((sum, cap) => {
      const index = a.capabilities.indexOf(cap);
      return sum + (index === -1 ? 100 : index);
    }, 0);
    const bPrimaryScore = requiredCapabilities.reduce((sum, cap) => {
      const index = b.capabilities.indexOf(cap);
      return sum + (index === -1 ? 100 : index);
    }, 0);

    if (aMatchScore !== bMatchScore) {
      return bMatchScore - aMatchScore;
    }

    return aPrimaryScore - bPrimaryScore;
  })[0];
}

/**
 * Get all available capabilities across all agents
 */
export function getAllCapabilities(): AgentCapability[] {
  const capabilities = new Set<AgentCapability>();
  for (const agent of AGENT_REGISTRY) {
    for (const cap of agent.capabilities) {
      capabilities.add(cap);
    }
  }
  return Array.from(capabilities).sort();
}

/**
 * Get all tags used across all agents
 */
export function getAllTags(): string[] {
  const tags = new Set<string>();
  for (const agent of AGENT_REGISTRY) {
    for (const tag of agent.tags) {
      tags.add(tag);
    }
  }
  return Array.from(tags).sort();
}

/**
 * Check if an agent has a specific capability
 */
export function agentHasCapability(
  agentId: string,
  capability: AgentCapability
): boolean {
  const agent = getAgentById(agentId);
  if (!agent) return false;
  return agent.capabilities.includes(capability);
}

/**
 * Get recommended agents for a specific task type
 */
export function getRecommendedAgentsForTaskType(
  taskType: string
): AgentDefinition[] {
  const taskCapabilityMap: Record<string, AgentCapability[]> = {
    'code-generation': ['code'],
    'bug-fix': ['debug', 'code'],
    'feature-development': ['code', 'architect'],
    'refactoring': ['refactor', 'code'],
    'testing': ['test'],
    'code-review': ['review'],
    'documentation': ['document'],
    'deployment': ['deploy'],
    'security-audit': ['security'],
    'performance-optimization': ['optimize'],
    'design': ['design'],
    'architecture': ['architect'],
    'integration': ['integrate'],
    'migration': ['migrate'],
  };

  const capabilities = taskCapabilityMap[taskType.toLowerCase()];
  if (!capabilities) {
    return [];
  }

  return filterAgents({
    capabilities,
    requireAllCapabilities: false,
  });
}

/**
 * Calculate average task duration for a set of agents
 */
export function calculateAverageDuration(agentIds: string[]): number {
  if (agentIds.length === 0) return 0;

  let totalDuration = 0;
  let validCount = 0;

  for (const id of agentIds) {
    const agent = getAgentById(id);
    if (agent) {
      totalDuration += agent.averageTaskDurationMs;
      validCount++;
    }
  }

  return validCount > 0 ? Math.round(totalDuration / validCount) : 0;
}

/**
 * Get agent capabilities comparison matrix
 */
export function getCapabilitiesMatrix(): Record<string, AgentCapability[]> {
  const matrix: Record<string, AgentCapability[]> = {};
  for (const agent of AGENT_REGISTRY) {
    matrix[agent.id] = [...agent.capabilities];
  }
  return matrix;
}

/**
 * Validate that all agents have required fields
 */
export function validateAgentRegistry(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const agent of AGENT_REGISTRY) {
    if (!agent.id || agent.id.trim() === '') {
      errors.push('Agent missing ID');
    }
    if (!agent.name || agent.name.trim() === '') {
      errors.push(`Agent ${agent.id}: missing name`);
    }
    if (!agent.description || agent.description.trim() === '') {
      errors.push(`Agent ${agent.id}: missing description`);
    }
    if (!agent.capabilities || agent.capabilities.length === 0) {
      errors.push(`Agent ${agent.id}: no capabilities defined`);
    }
    if (!agent.preferredModels || agent.preferredModels.length === 0) {
      errors.push(`Agent ${agent.id}: no preferred models defined`);
    }
    if (agent.maxConcurrency <= 0) {
      errors.push(`Agent ${agent.id}: invalid maxConcurrency (${agent.maxConcurrency})`);
    }
    if (agent.averageTaskDurationMs <= 0) {
      errors.push(`Agent ${agent.id}: invalid averageTaskDurationMs (${agent.averageTaskDurationMs})`);
    }
    if (!agent.tags || agent.tags.length === 0) {
      errors.push(`Agent ${agent.id}: no tags defined`);
    }
  }

  // Check for duplicate IDs
  const ids = AGENT_REGISTRY.map(a => a.id);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicates.length > 0) {
    errors.push(`Duplicate agent IDs: ${[...new Set(duplicates)].join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// Metrics Tracking
// ============================================================================

const agentMetrics: Map<string, AgentMetrics> = new Map();

/**
 * Initialize metrics for an agent
 */
export function initializeAgentMetrics(agentId: string): AgentMetrics {
  const metrics: AgentMetrics = {
    id: agentId,
    tasksCompleted: 0,
    averageDurationMs: 0,
    successRate: 1.0,
    lastUsed: null,
  };
  agentMetrics.set(agentId, metrics);
  return metrics;
}

/**
 * Get metrics for an agent
 */
export function getAgentMetrics(agentId: string): AgentMetrics | undefined {
  return agentMetrics.get(agentId);
}

/**
 * Record a task completion for metrics
 */
export function recordTaskCompletion(
  agentId: string,
  durationMs: number,
  success: boolean
): void {
  let metrics = agentMetrics.get(agentId);
  if (!metrics) {
    metrics = initializeAgentMetrics(agentId);
  }

  metrics.tasksCompleted++;
  metrics.lastUsed = new Date().toISOString();

  // Update rolling average duration
  metrics.averageDurationMs =
    (metrics.averageDurationMs * (metrics.tasksCompleted - 1) + durationMs) /
    metrics.tasksCompleted;

  // Update success rate
  const successValue = success ? 1 : 0;
  metrics.successRate =
    (metrics.successRate * (metrics.tasksCompleted - 1) + successValue) /
    metrics.tasksCompleted;
}

/**
 * Get all agent metrics
 */
export function getAllAgentMetrics(): AgentMetrics[] {
  return Array.from(agentMetrics.values());
}

/**
 * Clear all metrics (for testing)
 */
export function clearAllMetrics(): void {
  agentMetrics.clear();
}

// Initialize metrics for all agents on module load
for (const agent of AGENT_REGISTRY) {
  initializeAgentMetrics(agent.id);
}
