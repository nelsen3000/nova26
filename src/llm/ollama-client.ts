import { LLMRequest, LLMResponse } from '../types/index.js';
import { error as logError } from '../utils/logger.js';

const OLLAMA_BASE_URL = 'http://localhost:11434';
const OLLAMA_API_CHAT = `${OLLAMA_BASE_URL}/api/chat`;
const REQUEST_TIMEOUT_MS = 30000; // 30 seconds

export interface OllamaError extends Error {
  code?: string;
  status?: number;
}

/**
 * Call Ollama API with a chat request
 */
export async function callOllama(request: LLMRequest): Promise<LLMResponse> {
  const startTime = Date.now();
  
  const payload = {
    model: request.model,
    messages: [
      { role: 'system', content: request.systemPrompt },
      { role: 'user', content: request.userPrompt },
    ],
    stream: false,
    options: {
      temperature: request.temperature ?? 0.3,
    },
  };

  let response: Response;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    
    response = await fetch(OLLAMA_API_CHAT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
  } catch (err) {
    const ollamaError = err as OllamaError;
    
    if (ollamaError.name === 'AbortError') {
      throw new Error(`Ollama request timed out after ${REQUEST_TIMEOUT_MS}ms`);
    }
    
    if ((ollamaError as NodeJS.ErrnoException).code === 'ECONNREFUSED') {
      throw new Error(`Cannot connect to Ollama at ${OLLAMA_BASE_URL}. Is Ollama running?`);
    }
    
    throw new Error(`Failed to call Ollama: ${ollamaError.message}`);
  }

  if (!response.ok) {
    const status = response.status;
    
    if (status === 404) {
      throw new Error(`Model "${request.model}" not found. Pull it with: ollama pull ${request.model}`);
    }
    
    throw new Error(`Ollama API error: ${status} ${response.statusText}`);
  }

  let data: OllamaResponse;
  
  try {
    data = await response.json() as OllamaResponse;
  } catch (err) {
    throw new Error(`Failed to parse Ollama response: ${err}`);
  }

  const durationMs = Date.now() - startTime;
  
  if (!data.message || !data.message.content) {
    throw new Error('Ollama response missing message content');
  }

  return {
    content: data.message.content,
    model: data.model ?? request.model,
    tokensUsed: data.prompt_eval_count ?? data.eval_count,
    durationMs,
  };
}

interface OllamaResponse {
  model: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
  prompt_eval_count?: number;
  eval_count?: number;
  total_duration?: number;
}

/**
 * Check if Ollama is running and accessible
 */
export async function checkOllamaConnection(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get list of available models from Ollama
 */
export async function listOllamaModels(): Promise<string[]> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      return [];
    }
    
    const data = await response.json() as { models: Array<{ name: string }> };
    return data.models?.map(m => m.name) ?? [];
  } catch {
    return [];
  }
}
