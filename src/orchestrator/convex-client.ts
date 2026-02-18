// Convex Client for NOVA26
// Provides a lightweight wrapper around Convex HTTP API
// for connecting the orchestrator to the ATLAS backend

import type { LLMResponse } from '../types/index.js';

const CONVEX_URL = process.env.CONVEX_URL || 'http://localhost:3000';

interface ConvexQueryResponse<T> {
  data?: T;
  error?: string;
}

interface ConvexMutationResponse<T> {
  data?: T;
  error?: string;
}

/**
 * Simple Convex HTTP client
 * Uses Convex's HTTP API for queries and mutations
 */
export class ConvexClient {
  public readonly url: string;
  
  constructor(url: string = CONVEX_URL) {
    this.url = url;
  }
  
  /**
   * Execute a Convex query
   */
  async query<T>(name: string, args: Record<string, any> = {}): Promise<T> {
    const response = await fetch(`${this.url}/api/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        path: name,
        args,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Convex query failed: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json() as ConvexQueryResponse<T>;
    
    if (result.error) {
      throw new Error(`Convex query error: ${result.error}`);
    }
    
    return result.data as T;
  }
  
  /**
   * Execute a Convex mutation
   */
  async mutation<T>(name: string, args: Record<string, any> = {}): Promise<T> {
    const response = await fetch(`${this.url}/api/mutation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        path: name,
        args,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Convex mutation failed: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json() as ConvexMutationResponse<T>;
    
    if (result.error) {
      throw new Error(`Convex mutation error: ${result.error}`);
    }
    
    return result.data as T;
  }
  
  /**
   * Check if Convex is available
   */
  async ping(): Promise<boolean> {
    try {
      const response = await fetch(`${this.url}/api/health`, {
        method: 'GET',
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

// Singleton instance
let convexClientInstance: ConvexClient | null = null;

/**
 * Get the Convex client instance
 */
export function getConvexClient(): ConvexClient {
  if (!convexClientInstance) {
    convexClientInstance = new ConvexClient(CONVEX_URL);
  }
  return convexClientInstance;
}

// Re-export for convenience
export const convexClient = getConvexClient();

/**
 * Check if Convex is configured and available
 */
export async function isConvexAvailable(): Promise<boolean> {
  try {
    return await convexClient.ping();
  } catch {
    return false;
  }
}

/**
 * LLMCaller type for the wrapper
 */
export type { LLMCaller } from '../types/index.js';

/**
 * Create an LLM caller that optionally logs to Convex
 */
export function createConvexLoggingLLM(
  baseCaller: (systemPrompt: string, userPrompt: string, agentName?: string) => Promise<LLMResponse>,
  executionLogger?: (prompt: string, response: string, model: string, duration: number) => Promise<void>
): (systemPrompt: string, userPrompt: string, agentName?: string) => Promise<LLMResponse> {
  return async (
    systemPrompt: string,
    userPrompt: string,
    agentName?: string
  ): Promise<LLMResponse> => {
    const startTime = Date.now();
    
    // Call the base LLM
    const response = await baseCaller(systemPrompt, userPrompt, agentName);
    
    const duration = Date.now() - startTime;
    
    // Log to Convex if logger is provided
    if (executionLogger) {
      try {
        await executionLogger(userPrompt, response.content, response.model, duration);
      } catch (err) {
        console.warn('Failed to log execution to Convex:', err);
      }
    }
    
    return response;
  };
}
