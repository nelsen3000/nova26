import { AgentName, ModelConfig } from '../types/index.js';

/**
 * Model configuration for the orchestrator
 */
export const MODEL_CONFIG: ModelConfig = {
  // Agents that need precise, deterministic output
  precisionAgents: [
    'MARS',
    'PLUTO',
    'SATURN',
    'ENCELADUS',
    'MERCURY',
    'JUPITER',
    'TITAN',
    'MIMAS',
    'IO',
  ],
  // Agents that need creative, exploratory output
  creativeAgents: [
    'EARTH',
    'VENUS',
    'ANDROMEDA',
    'NEPTUNE',
    'CALLISTO',
  ],
  // Default model for Phase 0
  defaultModel: 'qwen2.5:7b',
  // Temperature settings
  temperature: {
    precision: 0.3,
    creative: 0.7,
  },
};

/**
 * Select the appropriate model for an agent and task
 * 
 * For Phase 0: always returns the default local model
 * Future phases will route to different models based on task type
 */
export function selectModel(agent: AgentName, _task: { id: string; description: string }): string {
  // Phase 0: always use the default local model
  return MODEL_CONFIG.defaultModel;
}

/**
 * Get the temperature setting for an agent
 */
export function getTemperature(agent: AgentName): number {
  if (MODEL_CONFIG.precisionAgents.includes(agent)) {
    return MODEL_CONFIG.temperature.precision;
  }
  
  if (MODEL_CONFIG.creativeAgents.includes(agent)) {
    return MODEL_CONFIG.temperature.creative;
  }
  
  // Default temperature for agents not explicitly listed
  return MODEL_CONFIG.temperature.precision;
}

/**
 * Check if an agent is a precision agent (code, data, security)
 */
export function isPrecisionAgent(agent: AgentName): boolean {
  return MODEL_CONFIG.precisionAgents.includes(agent);
}

/**
 * Check if an agent is a creative agent (design, content, analysis)
 */
export function isCreativeAgent(agent: AgentName): boolean {
  return MODEL_CONFIG.creativeAgents.includes(agent);
}

/**
 * Get all available models (for future cloud escalation)
 * This is a stub for Phase 0
 */
export function getAvailableModels(): string[] {
  return [MODEL_CONFIG.defaultModel];
}

/**
 * Route to a specific model provider (stub for Phase 1+)
 */
export function routeToProvider(
  agent: AgentName,
  task: { id: string; description: string }
): { provider: 'local' | 'cloud'; model: string } {
  // Phase 0: always local
  return {
    provider: 'local',
    model: selectModel(agent, task),
  };
}
