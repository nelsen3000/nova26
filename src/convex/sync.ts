// MEGA-04: Convex Real-Time Sync Layer for NOVA26
// Wire the existing Convex backend into the orchestrator for real-time cloud dashboard sync

import type { Task } from '../types/index.js';
import { getConfig } from '../config/config.js';

// ============================================================================
// Type Definitions
// ============================================================================

export interface ConvexSyncOptions {
  url?: string;
  enabled?: boolean;
  maxRetries?: number;
  retryDelayMs?: number;
}

export interface ConvexSyncClient {
  enabled: boolean;
  buildId: string | null;

  startBuild(prdName: string): Promise<string>;           // returns buildId
  logTask(task: Task, status: string): Promise<void>;
  logExecution(taskId: string, model: string, tokens: number, duration: number): Promise<void>;
  completeBuild(success: boolean): Promise<void>;
  logLearning(agent: string, pattern: string): Promise<void>;
}

interface ConvexMutationRequest {
  path: string;
  args: Record<string, unknown>;
}

interface ConvexMutationResponse {
  success: boolean;
  result?: unknown;
  error?: string;
}

interface BuildInfo {
  buildId: string;
  prdId: string;
  prdName: string;
  startedAt: string;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate a unique build ID
 */
export function generateBuildId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `build-${timestamp}-${random}`;
}

/**
 * Retry a function with delay between attempts
 * Failed calls retry once after delay, then give up (never block the build)
 */
export async function retryWithDelay<T>(
  fn: () => Promise<T>,
  retries: number,
  delayMs: number
): Promise<T | null> {
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt < retries) {
        // Log retry attempt
        if (process.env.NOVA26_VERBOSE === 'true') {
          console.log(`[ConvexSync] Retry ${attempt + 1}/${retries} after ${delayMs}ms: ${lastError.message}`);
        }
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  
  // All retries exhausted - log error but don't throw
  console.error(`[ConvexSync] Failed after ${retries + 1} attempts: ${lastError?.message}`);
  return null;
}

// ============================================================================
// Convex HTTP Client
// ============================================================================

/**
 * Make a mutation call to the Convex HTTP API
 */
async function callConvexMutation(
  baseUrl: string,
  path: string,
  args: Record<string, unknown>
): Promise<ConvexMutationResponse> {
  const url = `${baseUrl}/api/mutation`;
  
  const request: ConvexMutationRequest = { path, args };
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }
  
  const data = await response.json() as ConvexMutationResponse;
  return data;
}

// ============================================================================
// Convex Sync Client Factory
// ============================================================================

let disabledLogged = false;

/**
 * Create a Convex sync client
 * If no URL configured, all methods silently no-op
 */
export function createConvexSyncClient(options?: ConvexSyncOptions): ConvexSyncClient {
  // Determine configuration priority: options > config > env
  const config = getConfig();
  
  const url = options?.url ?? config.convex.url ?? process.env.CONVEX_URL ?? null;
  const enabled = options?.enabled ?? config.convex.syncEnabled ?? false;
  const maxRetries = options?.maxRetries ?? 1;
  const retryDelayMs = options?.retryDelayMs ?? 1000;
  
  // If no URL or disabled, return no-op client
  if (!url || !enabled) {
    if (!disabledLogged) {
      console.log('[ConvexSync] Convex sync disabled (no URL configured or sync disabled)');
      disabledLogged = true;
    }
    
    return createNoOpClient();
  }
  
  // Build info for this session
  const buildInfo: BuildInfo = {
    buildId: generateBuildId(),
    prdId: generateBuildId(), // Generate a unique PRD ID for this build
    prdName: 'unknown',
    startedAt: new Date().toISOString(),
  };
  
  // Track task mappings (taskId -> convex task doc id)
  const taskMapping = new Map<string, string>();
  
  return {
    enabled: true,
    buildId: buildInfo.buildId,
    
    async startBuild(prdName: string): Promise<string> {
      buildInfo.prdName = prdName;
      buildInfo.startedAt = new Date().toISOString();
      
      const result = await retryWithDelay(
        async () => {
          const response = await callConvexMutation(url, 'atlas:startBuild', {
            prdId: buildInfo.prdId,
            prdName: prdName,
            startedAt: buildInfo.startedAt,
          });
          
          if (!response.success) {
            throw new Error(response.error || 'startBuild failed');
          }
          
          return response.result as { buildId: string };
        },
        maxRetries,
        retryDelayMs
      );
      
      if (result && typeof result === 'object' && 'buildId' in result) {
        buildInfo.buildId = result.buildId as string;
        this.buildId = buildInfo.buildId;
      }
      
      if (process.env.NOVA26_VERBOSE === 'true') {
        console.log(`[ConvexSync] Started build: ${buildInfo.buildId}`);
      }
      
      return buildInfo.buildId;
    },
    
    async logTask(task: Task, status: string): Promise<void> {
      await retryWithDelay(
        async () => {
          const response = await callConvexMutation(url, 'atlas:logTask', {
            buildId: buildInfo.buildId,
            taskId: task.id,
            title: task.title,
            agent: task.agent,
            status: status,
            dependencies: task.dependencies,
            phase: task.phase,
            attempts: task.attempts,
            createdAt: task.createdAt,
            output: task.output,
            error: task.error,
          });
          
          if (!response.success) {
            throw new Error(response.error || 'logTask failed');
          }
          
          // Store the Convex task document ID for execution logging
          if (response.result && typeof response.result === 'object' && 'taskDocId' in response.result) {
            taskMapping.set(task.id, response.result.taskDocId as string);
          }
          
          return response.result;
        },
        maxRetries,
        retryDelayMs
      );
      
      if (process.env.NOVA26_VERBOSE === 'true') {
        console.log(`[ConvexSync] Logged task: ${task.id} (${status})`);
      }
    },
    
    async logExecution(taskId: string, model: string, tokens: number, duration: number): Promise<void> {
      await retryWithDelay(
        async () => {
          const convexTaskId = taskMapping.get(taskId);
          
          const response = await callConvexMutation(url, 'atlas:logExecution', {
            buildId: buildInfo.buildId,
            taskId: taskId,
            convexTaskId: convexTaskId,
            model: model,
            tokens: tokens,
            duration: duration,
            timestamp: new Date().toISOString(),
          });
          
          if (!response.success) {
            throw new Error(response.error || 'logExecution failed');
          }
          
          return response.result;
        },
        maxRetries,
        retryDelayMs
      );
      
      if (process.env.NOVA26_VERBOSE === 'true') {
        console.log(`[ConvexSync] Logged execution for task: ${taskId}`);
      }
    },
    
    async completeBuild(success: boolean): Promise<void> {
      await retryWithDelay(
        async () => {
          const response = await callConvexMutation(url, 'atlas:completeBuild', {
            prdId: buildInfo.prdId,
            status: success ? 'completed' : 'failed',
            completedAt: new Date().toISOString(),
          });
          
          if (!response.success) {
            throw new Error(response.error || 'completeBuild failed');
          }
          
          return response.result;
        },
        maxRetries,
        retryDelayMs
      );
      
      if (process.env.NOVA26_VERBOSE === 'true') {
        console.log(`[ConvexSync] Completed build: ${buildInfo.buildId} (${success ? 'success' : 'failed'})`);
      }
    },
    
    async logLearning(agent: string, pattern: string): Promise<void> {
      await retryWithDelay(
        async () => {
          const response = await callConvexMutation(url, 'atlas:logLearning', {
            prdId: buildInfo.prdId,
            taskId: buildInfo.buildId,
            agent: agent,
            pattern: pattern,
            insight: `Learned pattern from ${agent}`,
            createdAt: new Date().toISOString(),
          });
          
          if (!response.success) {
            throw new Error(response.error || 'logLearning failed');
          }
          
          return response.result;
        },
        maxRetries,
        retryDelayMs
      );
      
      if (process.env.NOVA26_VERBOSE === 'true') {
        console.log(`[ConvexSync] Logged learning: ${agent} - ${pattern}`);
      }
    },
  };
}

/**
 * Create a no-op client when Convex sync is disabled
 */
function createNoOpClient(): ConvexSyncClient {
  return {
    enabled: false,
    buildId: null,
    
    async startBuild(_prdName: string): Promise<string> {
      return 'disabled';
    },
    
    async logTask(_task: Task, _status: string): Promise<void> {
      // No-op
    },
    
    async logExecution(_taskId: string, _model: string, _tokens: number, _duration: number): Promise<void> {
      // No-op
    },
    
    async completeBuild(_success: boolean): Promise<void> {
      // No-op
    },
    
    async logLearning(_agent: string, _pattern: string): Promise<void> {
      // No-op
    },
  };
}

// ============================================================================
// Reset disabled logged flag (for testing)
// ============================================================================

export function resetDisabledLogged(): void {
  disabledLogged = false;
}
