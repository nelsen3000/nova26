// Ollama LLM Client

import type { LLMResponse, ModelConfig } from '../types/index.js';

const DEFAULT_MODEL = 'qwen2.5:7b';
export { DEFAULT_MODEL };
const OLLAMA_HOST = 'http://localhost:11434';

// Function type for LLM calls (allows mocking in tests)
export type LLMCaller = (
  systemPrompt: string,
  userPrompt: string,
  agentName?: string
) => Promise<LLMResponse>;

const modelConfigs: Record<string, ModelConfig> = {
  'qwen2.5:7b': {
    name: 'qwen2.5:7b',
    temperature: 0.7,
    maxTokens: 4096,
    timeout: 120000
  },
  'qwen2.5:14b': {
    name: 'qwen2.5:14b',
    temperature: 0.7,
    maxTokens: 8192,
    timeout: 180000
  },
  'llama3:8b': {
    name: 'llama3:8b',
    temperature: 0.7,
    maxTokens: 4096,
    timeout: 120000
  }
};

export async function callLLM(
  systemPrompt: string,
  userPrompt: string,
  agentName?: string
): Promise<LLMResponse> {
  const startTime = Date.now();
  
  // Determine which model to use
  const model = getModelForAgent(agentName || 'default');
  const config = modelConfigs[model] || modelConfigs[DEFAULT_MODEL];
  
  const payload = {
    model: model,
    messages: [
      {
        role: 'system',
        content: systemPrompt
      },
      {
        role: 'user',
        content: userPrompt
      }
    ],
    temperature: config.temperature,
    max_tokens: config.maxTokens,
    stream: false
  };
  
  try {
    const response = await fetch(`${OLLAMA_HOST}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json() as { message?: { content?: string }, eval_count?: number };
    const duration = Date.now() - startTime;
    
    return {
      content: data.message?.content || '',
      model: model,
      duration: duration,
      tokens: data.eval_count || 0
    };
  } catch (error: any) {
    if (error.code === 'ECONNREFUSED') {
      throw new Error('Ollama is not running. Start it with: ollama serve');
    }
    throw error;
  }
}

export function getModelForAgent(agentName: string): string {
  // Map agents to specific models if needed
  const agentModels: Record<string, string> = {
    SUN: 'qwen2.5:14b',
    JUPITER: 'qwen2.5:14b',
    PLUTO: 'qwen2.5:7b',
    MERCURY: 'qwen2.5:7b',
    EARTH: 'qwen2.5:7b',
    MARS: 'qwen2.5:7b',
    VENUS: 'qwen2.5:7b'
  };
  
  return agentModels[agentName] || DEFAULT_MODEL;
}

export function listAvailableModels(): string[] {
  return Object.keys(modelConfigs);
}

export async function checkOllamaConnection(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(`${OLLAMA_HOST}/api/tags`, {
      method: 'GET',
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}
