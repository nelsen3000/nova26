// Ollama LLM Client — with response caching and streaming support

import type { LLMResponse, ModelConfig } from '../types/index.js';
import { getCachedResponse, cacheResponse } from './response-cache.js';
import { getConfig } from '../config/config.js';

const DEFAULT_MODEL = 'qwen2.5:7b';
export { DEFAULT_MODEL };

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

export interface CallLLMOptions {
  cache?: boolean;        // Enable response caching (default: true)
  cacheMaxAgeHours?: number; // Cache TTL in hours (default: 24)
}

export async function callLLM(
  systemPrompt: string,
  userPrompt: string,
  agentName?: string,
  options?: CallLLMOptions
): Promise<LLMResponse> {
  const startTime = Date.now();
  const useCache = options?.cache !== false; // Cache enabled by default

  // Determine which model to use
  const model = getModelForAgent(agentName || 'default');
  const config = modelConfigs[model] || modelConfigs[DEFAULT_MODEL];

  // Cache check — combine prompts for cache key
  if (useCache) {
    const cachePrompt = `${systemPrompt}\n---\n${userPrompt}`;
    const cached = getCachedResponse(cachePrompt, model, config.temperature, options?.cacheMaxAgeHours);
    if (cached) {
      console.log(`Cache hit for ${model} — saved ${cached.tokensUsed} tokens`);
      return {
        content: cached.response,
        model,
        duration: Date.now() - startTime,
        tokens: 0, // No tokens consumed
        fromCache: true,
      };
    }
  }

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
    const configHost = getConfig().ollama.host;
    const response = await fetch(`${configHost}/api/chat`, {
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
    const content = data.message?.content || '';
    const tokens = data.eval_count || 0;

    // Store in cache
    if (useCache && content.length > 0) {
      const cachePrompt = `${systemPrompt}\n---\n${userPrompt}`;
      cacheResponse(cachePrompt, model, config.temperature, content, tokens);
    }

    return {
      content,
      model,
      duration,
      tokens,
    };
  } catch (error: any) {
    if (error.code === 'ECONNREFUSED') {
      throw new Error('Ollama is not running. Start it with: ollama serve');
    }
    throw error;
  }
}

// --- C-02: Streaming response support ---

export interface StreamChunk {
  content: string;
  done: boolean;
  model: string;
  tokens?: number;
}

/**
 * Call Ollama with streaming — returns an async iterator of text chunks.
 * Use for real-time UI feedback during long generations.
 */
export async function* callLLMStream(
  systemPrompt: string,
  userPrompt: string,
  agentName?: string
): AsyncGenerator<StreamChunk> {
  const model = getModelForAgent(agentName || 'default');
  const config = modelConfigs[model] || modelConfigs[DEFAULT_MODEL];

  const payload = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: config.temperature,
    max_tokens: config.maxTokens,
    stream: true,
  };

  const configHost = getConfig().ollama.host;
  const response = await fetch(`${configHost}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
  }

  if (!response.body) {
    throw new Error('No response body for streaming');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Ollama streams NDJSON — one JSON object per line
    const lines = buffer.split('\n');
    buffer = lines.pop() || ''; // Keep incomplete line in buffer

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const chunk = JSON.parse(line) as {
          message?: { content?: string };
          done?: boolean;
          eval_count?: number;
        };
        yield {
          content: chunk.message?.content || '',
          done: chunk.done || false,
          model,
          tokens: chunk.eval_count,
        };
      } catch {
        // Skip malformed JSON lines
      }
    }
  }

  // Process remaining buffer
  if (buffer.trim()) {
    try {
      const chunk = JSON.parse(buffer) as {
        message?: { content?: string };
        done?: boolean;
        eval_count?: number;
      };
      yield {
        content: chunk.message?.content || '',
        done: true,
        model,
        tokens: chunk.eval_count,
      };
    } catch {
      // Skip malformed final chunk
    }
  }
}

/**
 * Convenience: collect a full streaming response into a single LLMResponse.
 * Useful when you want streaming progress but need the final result.
 */
export async function collectStream(
  systemPrompt: string,
  userPrompt: string,
  agentName?: string,
  onChunk?: (text: string) => void
): Promise<LLMResponse> {
  const startTime = Date.now();
  let fullContent = '';
  let finalTokens = 0;
  let model = DEFAULT_MODEL;

  for await (const chunk of callLLMStream(systemPrompt, userPrompt, agentName)) {
    fullContent += chunk.content;
    model = chunk.model;
    if (chunk.tokens) finalTokens = chunk.tokens;
    if (onChunk) onChunk(chunk.content);
  }

  return {
    content: fullContent,
    model,
    duration: Date.now() - startTime,
    tokens: finalTokens,
  };
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
    const configHost = getConfig().ollama.host;
  const response = await fetch(`${configHost}/api/tags`, {
      method: 'GET',
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}
