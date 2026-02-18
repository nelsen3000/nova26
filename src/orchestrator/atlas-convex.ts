// ATLAS Convex Integration Client
// Provides a typed interface to the ATLAS Convex backend
// for build tracking, pattern storage, and execution logging
// Gracefully handles when Convex is unavailable

import { convexClient } from './convex-client.js';

/**
 * Initialize a new build in Convex and return the build ID
 * Returns null if Convex is unavailable
 */
export async function startConvexBuild(prdId: string, prdName: string): Promise<string | null> {
  try {
    const client = convexClient;
    const buildId = await client.mutation<string>('atlas:startBuild', {
      prdId,
      prdName,
    });
    return buildId;
  } catch (error) {
    console.warn('Convex unavailable, skipping build tracking:', error);
    return null;
  }
}

/**
 * Mark a build as completed or failed
 */
export async function completeConvexBuild(
  buildId: string,
  status: 'completed' | 'failed',
  error?: string
): Promise<void> {
  try {
    const client = convexClient;
    await client.mutation('atlas:completeBuild', {
      buildId,
      status,
      error,
    });
  } catch (err) {
    console.warn('Convex unavailable, skipping build completion:', err);
  }
}

/**
 * Get build status
 * Returns null if Convex is unavailable
 */
export async function getConvexBuild(buildId: string): Promise<any | null> {
  try {
    const client = convexClient;
    return await client.query('atlas:getBuild', { buildId });
  } catch (err) {
    console.warn('Convex unavailable, returning null for build:', err);
    return null;
  }
}

/**
 * List builds with optional status filter
 * Returns empty array if Convex is unavailable
 */
export async function listConvexBuilds(status?: 'running' | 'completed' | 'failed'): Promise<any[]> {
  try {
    const client = convexClient;
    return await client.query('atlas:listBuilds', { status });
  } catch (err) {
    console.warn('Convex unavailable, returning empty build list:', err);
    return [];
  }
}

/**
 * Log a task execution to Convex
 * Returns null if Convex is unavailable
 */
export async function logConvexTask(
  buildId: string,
  taskId: string,
  title: string,
  agent: string,
  status: 'pending' | 'ready' | 'running' | 'done' | 'failed' | 'blocked',
  dependencies: string[],
  phase: number
): Promise<string | null> {
  try {
    const client = convexClient;
    const convexTaskId = await client.mutation<string>('atlas:createTask', {
      buildId,
      taskId,
      title,
      agent,
      status,
      dependencies,
      phase,
      attempts: 0,
      createdAt: new Date().toISOString(),
    });
    return convexTaskId;
  } catch (err) {
    console.warn('Convex unavailable, skipping task log:', err);
    return null;
  }
}

/**
 * Update task status in Convex
 */
export async function updateConvexTask(
  taskId: string,
  updates: {
    status?: string;
    output?: string;
    error?: string;
    attempts?: number;
  }
): Promise<void> {
  try {
    const client = convexClient;
    await client.mutation('atlas:updateTask', {
      taskId,
      ...updates,
    });
  } catch (err) {
    console.warn('Convex unavailable, skipping task update:', err);
  }
}

/**
 * Log an execution (LLM call) to Convex
 * Returns null if Convex is unavailable
 */
export async function logConvexExecution(
  taskId: string,
  agent: string,
  model: string,
  prompt: string,
  response: string,
  gatesPassed: boolean,
  duration: number,
  error?: string
): Promise<string | null> {
  try {
    const client = convexClient;
    const executionId = await client.mutation<string>('atlas:logExecution', {
      taskId,
      agent,
      model,
      prompt,
      response,
      gatesPassed,
      duration,
      timestamp: new Date().toISOString(),
      error,
    });
    return executionId;
  } catch (err) {
    console.warn('Convex unavailable, skipping execution log:', err);
    return null;
  }
}

/**
 * Store a learned pattern in Convex
 * Returns null if Convex is unavailable
 */
export async function storeConvexPattern(
  name: string,
  description: string,
  code: string,
  language: string,
  tags: string[]
): Promise<string | null> {
  try {
    const client = convexClient;
    const patternId = await client.mutation<string>('atlas:storePattern', {
      name,
      description,
      code,
      language,
      tags,
      createdAt: new Date().toISOString(),
    });
    return patternId;
  } catch (err) {
    console.warn('Convex unavailable, skipping pattern storage:', err);
    return null;
  }
}

/**
 * Log a learning insight to Convex
 * Returns null if Convex is unavailable
 */
export async function logConvexLearning(
  buildId: string,
  taskId: string,
  pattern: string,
  insight: string,
  code?: string
): Promise<string | null> {
  try {
    const client = convexClient;
    const learningId = await client.mutation<string>('atlas:logLearning', {
      buildId,
      taskId,
      pattern,
      insight,
      code,
      createdAt: new Date().toISOString(),
    });
    return learningId;
  } catch (err) {
    console.warn('Convex unavailable, skipping learning log:', err);
    return null;
  }
}

/**
 * Query patterns from Convex
 * Returns empty array if Convex is unavailable
 */
export async function queryConvexPatterns(language?: string, tags?: string[]): Promise<any[]> {
  try {
    const client = convexClient;
    return await client.query('atlas:queryPatterns', { language, tags });
  } catch (err) {
    console.warn('Convex unavailable, returning empty patterns list:', err);
    return [];
  }
}

/**
 * Query learnings from Convex
 * Returns empty array if Convex is unavailable
 */
export async function queryConvexLearnings(buildId?: string): Promise<any[]> {
  try {
    const client = convexClient;
    return await client.query('atlas:queryLearnings', { buildId });
  } catch (err) {
    console.warn('Convex unavailable, returning empty learnings list:', err);
    return [];
  }
}
