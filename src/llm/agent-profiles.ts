// Agent Profiles - Routing profiles for all 21 NOVA26 agents
// Defines model preferences, task overrides, and budgets per agent

import type { ModelConfig, TaskType } from './model-registry.js';
import { MODEL_REGISTRY, getModelById } from './model-registry.js';
import type { RoutingConstraints } from './model-router.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export type AgentId = 
  | 'SUN' | 'MERCURY' | 'VENUS' | 'EARTH' | 'MARS' | 'PLUTO'
  | 'SATURN' | 'JUPITER' | 'ENCELADUS' | 'GANYMEDE' | 'NEPTUNE'
  | 'CHARON' | 'URANUS' | 'TITAN' | 'EUROPA' | 'MIMAS'
  | 'IO' | 'TRITON' | 'CALLISTO' | 'ATLAS' | 'ANDROMEDA';

export interface AgentProfile {
  agentId: AgentId;
  preferredModels: string[]; // Model IDs
  taskTypeOverrides: Map<TaskType, string>; // Task type -> preferred model ID
  costBudgetPerHour: number; // USD
  qualityThreshold: number; // 0-1
  latencyBudget: number; // ms
  description: string;
  reasoning: string;
}

export interface ProfileOptimization {
  agentId: AgentId;
  currentModel: string;
  suggestedModel: string;
  reason: string;
  expectedImprovement: number; // Percentage
}

// ═══════════════════════════════════════════════════════════════════════════════
// Default Agent Profiles
// ═══════════════════════════════════════════════════════════════════════════════

export const DEFAULT_AGENT_PROFILES: Record<AgentId, AgentProfile> = {
  // ═══════════════════════════════════════════════════════════════════════════════
  // Core Agents
  // ═══════════════════════════════════════════════════════════════════════════════
  SUN: {
    agentId: 'SUN',
    preferredModels: ['anthropic-claude-3-opus', 'anthropic-claude-3-sonnet', 'openai-gpt-4o'],
    taskTypeOverrides: new Map([
      ['orchestration', 'anthropic-claude-3-opus'],
      ['quick-query', 'anthropic-claude-3-sonnet'],
    ]),
    costBudgetPerHour: 5.0,
    qualityThreshold: 0.9,
    latencyBudget: 5000,
    description: 'Orchestrator - Task planning, dispatch, coordination',
    reasoning: 'Needs high reasoning capability for complex orchestration decisions',
  },

  MERCURY: {
    agentId: 'MERCURY',
    preferredModels: ['anthropic-claude-3-sonnet', 'anthropic-claude-3-opus', 'openai-gpt-4o'],
    taskTypeOverrides: new Map([
      ['validation', 'anthropic-claude-3-opus'],
      ['code-analysis', 'anthropic-claude-3-sonnet'],
    ]),
    costBudgetPerHour: 3.0,
    qualityThreshold: 0.88,
    latencyBudget: 4000,
    description: 'Validator - Spec compliance checking',
    reasoning: 'Needs excellent analysis for validation tasks',
  },

  VENUS: {
    agentId: 'VENUS',
    preferredModels: ['openrouter-qwen/qwen-2.5-coder-32b-instruct', 'anthropic-claude-3-sonnet', 'openai-gpt-4o'],
    taskTypeOverrides: new Map([
      ['code-generation', 'openrouter-qwen/qwen-2.5-coder-32b-instruct'],
      ['documentation', 'anthropic-claude-3-haiku'],
    ]),
    costBudgetPerHour: 2.0,
    qualityThreshold: 0.82,
    latencyBudget: 5000,
    description: 'Frontend - React 19, Tailwind, shadcn/ui',
    reasoning: 'Qwen Coder excellent for component generation; cost-effective',
  },

  EARTH: {
    agentId: 'EARTH',
    preferredModels: ['anthropic-claude-3-sonnet', 'anthropic-claude-3-opus', 'openai-gpt-4o'],
    taskTypeOverrides: new Map([
      ['documentation', 'anthropic-claude-3-sonnet'],
      ['research', 'anthropic-claude-3-opus'],
    ]),
    costBudgetPerHour: 2.5,
    qualityThreshold: 0.85,
    latencyBudget: 5000,
    description: 'Product - Specs, user stories, Gherkin',
    reasoning: 'Needs strong writing and analysis for specifications',
  },

  MARS: {
    agentId: 'MARS',
    preferredModels: ['openrouter-qwen/qwen-2.5-coder-32b-instruct', 'anthropic-claude-3-sonnet', 'ollama-qwen2.5:32b'],
    taskTypeOverrides: new Map([
      ['code-generation', 'openrouter-qwen/qwen-2.5-coder-32b-instruct'],
      ['code-analysis', 'anthropic-claude-3-sonnet'],
    ]),
    costBudgetPerHour: 2.0,
    qualityThreshold: 0.85,
    latencyBudget: 6000,
    description: 'Backend - TypeScript, Convex mutations/queries',
    reasoning: 'Qwen Coder for code, Sonnet for complex analysis',
  },

  PLUTO: {
    agentId: 'PLUTO',
    preferredModels: ['anthropic-claude-3-haiku', 'anthropic-claude-3-sonnet', 'ollama-qwen2.5:14b'],
    taskTypeOverrides: new Map([
      ['code-generation', 'ollama-qwen2.5:14b'],
      ['documentation', 'anthropic-claude-3-haiku'],
    ]),
    costBudgetPerHour: 1.0,
    qualityThreshold: 0.75,
    latencyBudget: 4000,
    description: 'Database - Convex schemas, row-level isolation',
    reasoning: 'Fast and cheap for schema design; local preferred',
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // Testing & Quality
  // ═══════════════════════════════════════════════════════════════════════════════
  SATURN: {
    agentId: 'SATURN',
    preferredModels: ['anthropic-claude-3-sonnet', 'openai-gpt-4o', 'anthropic-claude-3-haiku'],
    taskTypeOverrides: new Map([
      ['testing', 'anthropic-claude-3-sonnet'],
      ['code-analysis', 'anthropic-claude-3-sonnet'],
      ['quick-query', 'anthropic-claude-3-haiku'],
    ]),
    costBudgetPerHour: 2.0,
    qualityThreshold: 0.85,
    latencyBudget: 5000,
    description: 'Testing - Vitest, RTL, Playwright',
    reasoning: 'Needs code + reasoning for test generation',
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // Architecture & Strategy
  // ═══════════════════════════════════════════════════════════════════════════════
  JUPITER: {
    agentId: 'JUPITER',
    preferredModels: ['anthropic-claude-3-opus', 'anthropic-claude-3-sonnet', 'openai-gpt-4o'],
    taskTypeOverrides: new Map([
      ['architecture-design', 'anthropic-claude-3-opus'],
      ['research', 'anthropic-claude-3-opus'],
    ]),
    costBudgetPerHour: 4.0,
    qualityThreshold: 0.9,
    latencyBudget: 6000,
    description: 'Architecture - ADRs, component hierarchy',
    reasoning: 'Highest quality needed for architecture decisions',
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // Security & Infrastructure
  // ═══════════════════════════════════════════════════════════════════════════════
  ENCELADUS: {
    agentId: 'ENCELADUS',
    preferredModels: ['anthropic-claude-3-sonnet', 'anthropic-claude-3-opus', 'ollama-qwen2.5:14b'],
    taskTypeOverrides: new Map([
      ['code-analysis', 'anthropic-claude-3-sonnet'],
    ]),
    costBudgetPerHour: 1.5,
    qualityThreshold: 0.85,
    latencyBudget: 5000,
    description: 'Security - Auth, XSS prevention',
    reasoning: 'Security requires careful analysis',
  },

  GANYMEDE: {
    agentId: 'GANYMEDE',
    preferredModels: ['anthropic-claude-3-sonnet', 'openai-gpt-4o', 'anthropic-claude-3-haiku'],
    taskTypeOverrides: new Map([
      ['code-generation', 'openai-gpt-4o'],
      ['quick-query', 'anthropic-claude-3-haiku'],
    ]),
    costBudgetPerHour: 1.5,
    qualityThreshold: 0.8,
    latencyBudget: 5000,
    description: 'API - Stripe, Ollama, integrations',
    reasoning: 'General coding with API focus',
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // Analytics & Observability
  // ═══════════════════════════════════════════════════════════════════════════════
  NEPTUNE: {
    agentId: 'NEPTUNE',
    preferredModels: ['anthropic-claude-3-haiku', 'anthropic-claude-3-sonnet', 'ollama-qwen2.5:7b'],
    taskTypeOverrides: new Map([
      ['summarization', 'anthropic-claude-3-haiku'],
      ['code-generation', 'ollama-qwen2.5:7b'],
    ]),
    costBudgetPerHour: 1.0,
    qualityThreshold: 0.75,
    latencyBudget: 3000,
    description: 'Analytics - Metrics dashboards, recharts',
    reasoning: 'Fast and cheap for dashboard work',
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // UX & Error Handling
  // ═══════════════════════════════════════════════════════════════════════════════
  CHARON: {
    agentId: 'CHARON',
    preferredModels: ['ollama-qwen2.5:7b', 'anthropic-claude-3-haiku', 'ollama-qwen2.5:14b'],
    taskTypeOverrides: new Map([
      ['code-generation', 'ollama-qwen2.5:7b'],
      ['documentation', 'anthropic-claude-3-haiku'],
    ]),
    costBudgetPerHour: 0.5,
    qualityThreshold: 0.7,
    latencyBudget: 3000,
    description: 'Error UX - Fallback screens, empty states',
    reasoning: 'Simple UI work, local models sufficient',
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // Research & Development
  // ═══════════════════════════════════════════════════════════════════════════════
  URANUS: {
    agentId: 'URANUS',
    preferredModels: ['anthropic-claude-3-opus', 'openai-gpt-4o', 'anthropic-claude-3-sonnet'],
    taskTypeOverrides: new Map([
      ['research', 'anthropic-claude-3-opus'],
      ['summarization', 'anthropic-claude-3-sonnet'],
    ]),
    costBudgetPerHour: 2.0,
    qualityThreshold: 0.85,
    latencyBudget: 6000,
    description: 'R&D - Tool evaluation',
    reasoning: 'Research requires high quality analysis',
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // Real-time & Performance
  // ═══════════════════════════════════════════════════════════════════════════════
  TITAN: {
    agentId: 'TITAN',
    preferredModels: ['ollama-qwen2.5:14b', 'anthropic-claude-3-haiku', 'ollama-qwen2.5:7b'],
    taskTypeOverrides: new Map([
      ['code-generation', 'ollama-qwen2.5:14b'],
      ['quick-query', 'ollama-qwen2.5:7b'],
    ]),
    costBudgetPerHour: 1.0,
    qualityThreshold: 0.75,
    latencyBudget: 3000,
    description: 'Real-time - Convex subscriptions',
    reasoning: 'Fast local models for real-time features',
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // Mobile & Platform
  // ═══════════════════════════════════════════════════════════════════════════════
  EUROPA: {
    agentId: 'EUROPA',
    preferredModels: ['ollama-qwen2.5:14b', 'anthropic-claude-3-haiku', 'ollama-qwen2.5:7b'],
    taskTypeOverrides: new Map([
      ['code-generation', 'ollama-qwen2.5:14b'],
      ['documentation', 'anthropic-claude-3-haiku'],
    ]),
    costBudgetPerHour: 1.0,
    qualityThreshold: 0.75,
    latencyBudget: 4000,
    description: 'Mobile - PWA, responsive',
    reasoning: 'Local models for mobile development',
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // Resilience & Reliability
  // ═══════════════════════════════════════════════════════════════════════════════
  MIMAS: {
    agentId: 'MIMAS',
    preferredModels: ['ollama-qwen2.5:7b', 'anthropic-claude-3-haiku', 'ollama-qwen2.5:14b'],
    taskTypeOverrides: new Map([
      ['code-generation', 'ollama-qwen2.5:7b'],
    ]),
    costBudgetPerHour: 0.5,
    qualityThreshold: 0.7,
    latencyBudget: 3000,
    description: 'Resilience - Retry logic, circuit breakers',
    reasoning: 'Simple coding patterns, local models work well',
  },

  IO: {
    agentId: 'IO',
    preferredModels: ['ollama-qwen2.5:7b', 'ollama-qwen2.5:14b', 'anthropic-claude-3-haiku'],
    taskTypeOverrides: new Map([
      ['code-analysis', 'ollama-qwen2.5:14b'],
      ['quick-query', 'ollama-qwen2.5:7b'],
    ]),
    costBudgetPerHour: 0.5,
    qualityThreshold: 0.7,
    latencyBudget: 3000,
    description: 'Performance - FCP/LCP, bundle analysis',
    reasoning: 'Performance analysis can use fast local models',
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // DevOps & Deployment
  // ═══════════════════════════════════════════════════════════════════════════════
  TRITON: {
    agentId: 'TRITON',
    preferredModels: ['ollama-qwen2.5:7b', 'anthropic-claude-3-haiku', 'ollama-qwen2.5:14b'],
    taskTypeOverrides: new Map([
      ['code-generation', 'ollama-qwen2.5:7b'],
      ['documentation', 'anthropic-claude-3-haiku'],
    ]),
    costBudgetPerHour: 0.5,
    qualityThreshold: 0.7,
    latencyBudget: 3000,
    description: 'DevOps - GitHub Actions, Convex deploy',
    reasoning: 'DevOps scripts, local models sufficient',
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // Documentation & Knowledge
  // ═══════════════════════════════════════════════════════════════════════════════
  CALLISTO: {
    agentId: 'CALLISTO',
    preferredModels: ['anthropic-claude-3-haiku', 'ollama-qwen2.5:7b', 'anthropic-claude-3-sonnet'],
    taskTypeOverrides: new Map([
      ['documentation', 'anthropic-claude-3-haiku'],
      ['summarization', 'anthropic-claude-3-haiku'],
    ]),
    costBudgetPerHour: 0.8,
    qualityThreshold: 0.75,
    latencyBudget: 3000,
    description: 'Documentation - READMEs, API docs',
    reasoning: 'Haiku excellent for documentation tasks',
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // Meta & Intelligence
  // ═══════════════════════════════════════════════════════════════════════════════
  ATLAS: {
    agentId: 'ATLAS',
    preferredModels: ['anthropic-claude-3-sonnet', 'openai-gpt-4o', 'anthropic-claude-3-haiku'],
    taskTypeOverrides: new Map([
      ['code-analysis', 'anthropic-claude-3-sonnet'],
      ['summarization', 'anthropic-claude-3-haiku'],
    ]),
    costBudgetPerHour: 1.5,
    qualityThreshold: 0.8,
    latencyBudget: 4000,
    description: 'Meta-learner - Build logs, patterns',
    reasoning: 'Analysis and learning from patterns',
  },

  ANDROMEDA: {
    agentId: 'ANDROMEDA',
    preferredModels: ['anthropic-claude-3-opus', 'anthropic-claude-3-sonnet', 'openai-gpt-4o'],
    taskTypeOverrides: new Map([
      ['research', 'anthropic-claude-3-opus'],
      ['summarization', 'anthropic-claude-3-sonnet'],
    ]),
    costBudgetPerHour: 2.0,
    qualityThreshold: 0.85,
    latencyBudget: 5000,
    description: 'Ideas - Opportunity research',
    reasoning: 'Research requires high quality reasoning',
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// ProfileManager Class
// ═══════════════════════════════════════════════════════════════════════════════

export class ProfileManager {
  private profiles: Map<AgentId, AgentProfile>;
  private historicalResults: Map<string, { model: string; quality: number; cost: number; taskType: TaskType }[]>;

  constructor() {
    this.profiles = new Map();
    this.historicalResults = new Map();
    this.loadDefaults();
  }

  /**
   * Load default profiles
   */
  private loadDefaults(): void {
    for (const [agentId, profile] of Object.entries(DEFAULT_AGENT_PROFILES)) {
      this.profiles.set(agentId as AgentId, { ...profile });
    }
  }

  /**
   * Get profile for an agent
   */
  getProfile(agentId: AgentId): AgentProfile | undefined {
    return this.profiles.get(agentId);
  }

  /**
   * Update profile for an agent
   */
  updateProfile(agentId: AgentId, updates: Partial<Omit<AgentProfile, 'agentId'>>): void {
    const existing = this.profiles.get(agentId);
    if (!existing) {
      throw new Error(`Profile not found for agent: ${agentId}`);
    }

    this.profiles.set(agentId, {
      ...existing,
      ...updates,
      agentId,
    });
  }

  /**
   * Reset profile to defaults for an agent
   */
  resetToDefaults(agentId: AgentId): void {
    const defaultProfile = DEFAULT_AGENT_PROFILES[agentId];
    if (!defaultProfile) {
      throw new Error(`No default profile for agent: ${agentId}`);
    }

    this.profiles.set(agentId, { ...defaultProfile });
  }

  /**
   * Reset all profiles to defaults
   */
  resetAllToDefaults(): void {
    this.loadDefaults();
  }

  /**
   * Get routing constraints for an agent and task
   */
  getConstraints(agentId: AgentId, taskType: TaskType): RoutingConstraints {
    const profile = this.profiles.get(agentId);
    if (!profile) {
      return {};
    }

    // Get preferred model for this task type
    const preferredModelId = profile.taskTypeOverrides.get(taskType) || 
                             profile.preferredModels[0];

    return {
      preferredProviders: undefined,
      excludedModels: undefined,
      maxCost: profile.costBudgetPerHour / 3600 * 1000, // Rough per-request estimate
      minQuality: profile.qualityThreshold,
      maxLatency: profile.latencyBudget,
      preferLocal: profile.costBudgetPerHour < 1.0,
    };
  }

  /**
   * Get preferred model for agent and task
   */
  getPreferredModel(agentId: AgentId, taskType: TaskType): ModelConfig | undefined {
    const profile = this.profiles.get(agentId);
    if (!profile) {
      return undefined;
    }

    // Check task type override first
    const overrideModelId = profile.taskTypeOverrides.get(taskType);
    if (overrideModelId) {
      return getModelById(overrideModelId);
    }

    // Fall back to preferred models list
    for (const modelId of profile.preferredModels) {
      const model = getModelById(modelId);
      if (model) {
        return model;
      }
    }

    return undefined;
  }

  /**
   * Record task result for optimization analysis
   */
  recordResult(
    agentId: AgentId,
    taskType: TaskType,
    model: string,
    quality: number,
    cost: number
  ): void {
    const key = `${agentId}:${taskType}`;
    let results = this.historicalResults.get(key);
    if (!results) {
      results = [];
      this.historicalResults.set(key, results);
    }

    results.push({ model, quality, cost, taskType });

    // Keep only last 100 results
    if (results.length > 100) {
      results.shift();
    }
  }

  /**
   * Analyze historical data and suggest optimizations
   */
  optimizeProfiles(): ProfileOptimization[] {
    const optimizations: ProfileOptimization[] = [];

    for (const [key, results] of this.historicalResults.entries()) {
      if (results.length < 10) {
        continue; // Need enough data
      }

      const [agentId, taskType] = key.split(':') as [AgentId, TaskType];
      const profile = this.profiles.get(agentId);
      if (!profile) continue;

      // Group by model
      const byModel = new Map<string, typeof results>();
      for (const r of results) {
        const list = byModel.get(r.model) || [];
        list.push(r);
        byModel.set(r.model, list);
      }

      // Find best performing model
      let bestModel: string | undefined;
      let bestScore = -Infinity;

      for (const [model, modelResults] of byModel.entries()) {
        const avgQuality = modelResults.reduce((s, r) => s + r.quality, 0) / modelResults.length;
        const avgCost = modelResults.reduce((s, r) => s + r.cost, 0) / modelResults.length;
        const score = avgQuality / (avgCost + 0.0001); // Quality per dollar

        if (score > bestScore) {
          bestScore = score;
          bestModel = model;
        }
      }

      if (bestModel) {
        const currentModel = profile.taskTypeOverrides.get(taskType) || profile.preferredModels[0];
        
        if (bestModel !== currentModel) {
          const bestResults = byModel.get(bestModel)!;
          const currentResults = byModel.get(currentModel) || [];
          
          const bestQuality = bestResults.reduce((s, r) => s + r.quality, 0) / bestResults.length;
          const currentQuality = currentResults.length > 0
            ? currentResults.reduce((s, r) => s + r.quality, 0) / currentResults.length
            : 0;

          const improvement = currentQuality > 0
            ? ((bestQuality - currentQuality) / currentQuality) * 100
            : 0;

          if (improvement > 5) { // Only suggest if >5% improvement
            optimizations.push({
              agentId,
              currentModel,
              suggestedModel: bestModel,
              reason: `${bestModel} shows ${improvement.toFixed(1)}% better quality for ${taskType} tasks`,
              expectedImprovement: improvement,
            });
          }
        }
      }
    }

    // Sort by expected improvement
    optimizations.sort((a, b) => b.expectedImprovement - a.expectedImprovement);

    return optimizations;
  }

  /**
   * Apply optimization suggestion
   */
  applyOptimization(optimization: ProfileOptimization): void {
    const profile = this.profiles.get(optimization.agentId);
    if (!profile) {
      throw new Error(`Profile not found for agent: ${optimization.agentId}`);
    }

    // Parse task type from key (simplified - in real implementation, store task type)
    // For now, add to preferred models if not present
    if (!profile.preferredModels.includes(optimization.suggestedModel)) {
      profile.preferredModels.unshift(optimization.suggestedModel);
    }

    this.profiles.set(optimization.agentId, profile);
  }

  /**
   * Get all profiles
   */
  getAllProfiles(): AgentProfile[] {
    return Array.from(this.profiles.values());
  }

  /**
   * Get agent IDs with profiles
   */
  getAgentIds(): AgentId[] {
    return Array.from(this.profiles.keys());
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Singleton Instance
// ═══════════════════════════════════════════════════════════════════════════════

let globalProfileManager: ProfileManager | null = null;

export function getProfileManager(): ProfileManager {
  if (!globalProfileManager) {
    globalProfileManager = new ProfileManager();
  }
  return globalProfileManager;
}

export function resetProfileManager(): void {
  globalProfileManager = null;
}
