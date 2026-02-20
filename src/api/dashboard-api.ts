// KMS-23: REST API layer for dashboard
// Typed API handlers (no HTTP framework - just typed request/response objects)

import {
  calculateBuildMetrics,
  getAllBuildIds,
  type BuildMetrics,
} from '../analytics/build-metrics.js';

import {
  compareBuilds,
  type BuildComparisonResult,
} from '../analytics/build-comparison.js';

import {
  getPerformanceTracker,
  type AgentRanking,
  type PerformanceSummary,
} from '../agents/performance-tracker.js';

import {
  getModuleHealthChecker,
  type HealthReport,
} from '../orchestrator/module-health.js';

// ============================================================================
// Request/Response Types
// ============================================================================

export interface ApiRequest {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  params?: Record<string, string>;
  query?: Record<string, string>;
  body?: unknown;
}

export interface ApiResponse<T = unknown> {
  status: number;
  data?: T;
  error?: string;
}

export interface ListBuildsResponse {
  builds: Array<{
    buildId: string;
    startTime: string;
    duration: number;
    taskCount: { total: number; completed: number; failed: number };
    passRate: number;
    status: 'success' | 'partial' | 'failed';
  }>;
  total: number;
}

export interface BuildDetailResponse extends BuildMetrics {
  status: 'success' | 'partial' | 'failed';
}

export interface AgentsResponse {
  rankings: AgentRanking[];
  summary: PerformanceSummary;
}

// ============================================================================
// API Handlers
// ============================================================================

/**
 * GET /api/builds - List all builds
 */
export function listBuilds(request: ApiRequest): ApiResponse<ListBuildsResponse> {
  if (request.method !== 'GET') {
    return { status: 405, error: 'Method not allowed' };
  }

  try {
    const buildIds = getAllBuildIds();
    const builds = [];

    for (const buildId of buildIds) {
      const metrics = calculateBuildMetrics(buildId);
      if (metrics) {
        const status: 'success' | 'partial' | 'failed' = metrics.passRate >= 0.9 
          ? 'success' 
          : metrics.passRate >= 0.5 
            ? 'partial' 
            : 'failed';

        builds.push({
          buildId: metrics.buildId,
          startTime: metrics.startTime,
          duration: metrics.duration,
          taskCount: metrics.taskCount,
          passRate: metrics.passRate,
          status,
        });
      }
    }

    // Sort by start time (newest first)
    builds.sort((a, b) => 
      new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );

    return {
      status: 200,
      data: {
        builds,
        total: builds.length,
      },
    };
  } catch (error) {
    return {
      status: 500,
      error: error instanceof Error ? error.message : 'Failed to list builds',
    };
  }
}

/**
 * GET /api/builds/:id - Get build details
 */
export function getBuildDetail(request: ApiRequest): ApiResponse<BuildDetailResponse> {
  if (request.method !== 'GET') {
    return { status: 405, error: 'Method not allowed' };
  }

  const buildId = request.params?.id;
  if (!buildId) {
    return { status: 400, error: 'Build ID is required' };
  }

  try {
    const metrics = calculateBuildMetrics(buildId);
    
    if (!metrics) {
      return { status: 404, error: `Build not found: ${buildId}` };
    }

    const status = metrics.passRate >= 0.9 
      ? 'success' 
      : metrics.passRate >= 0.5 
        ? 'partial' 
        : 'failed';

    return {
      status: 200,
      data: {
        ...metrics,
        status,
      },
    };
  } catch (error) {
    return {
      status: 500,
      error: error instanceof Error ? error.message : 'Failed to get build details',
    };
  }
}

/**
 * GET /api/builds/:id/compare/:otherId - Compare two builds
 */
export function compareBuildsApi(request: ApiRequest): ApiResponse<BuildComparisonResult> {
  if (request.method !== 'GET') {
    return { status: 405, error: 'Method not allowed' };
  }

  const buildId = request.params?.id;
  const otherId = request.params?.otherId;

  if (!buildId || !otherId) {
    return { status: 400, error: 'Both build IDs are required' };
  }

  try {
    const comparison = compareBuilds(buildId, otherId);
    
    return {
      status: 200,
      data: comparison,
    };
  } catch (error) {
    return {
      status: 500,
      error: error instanceof Error ? error.message : 'Failed to compare builds',
    };
  }
}

/**
 * GET /api/agents - Get agent performance rankings
 */
export function listAgents(request: ApiRequest): ApiResponse<AgentsResponse> {
  if (request.method !== 'GET') {
    return { status: 405, error: 'Method not allowed' };
  }

  try {
    const tracker = getPerformanceTracker();
    const rankings = tracker.calculateRankings();
    const summary = tracker.getPerformanceSummary();

    return {
      status: 200,
      data: {
        rankings,
        summary,
      },
    };
  } catch (error) {
    return {
      status: 500,
      error: error instanceof Error ? error.message : 'Failed to get agent rankings',
    };
  }
}

/**
 * GET /api/health - Get module health report
 */
export async function getHealth(request: ApiRequest): Promise<ApiResponse<HealthReport>> {
  if (request.method !== 'GET') {
    return { status: 405, error: 'Method not allowed' };
  }

  try {
    const checker = getModuleHealthChecker();
    const report = await checker.checkAll();

    return {
      status: 200,
      data: report,
    };
  } catch (error) {
    return {
      status: 500,
      error: error instanceof Error ? error.message : 'Failed to get health report',
    };
  }
}

// ============================================================================
// Router
// ============================================================================

/**
 * Route a request to the appropriate handler
 */
export async function routeRequest(request: ApiRequest): Promise<ApiResponse> {
  const path = request.path;

  // GET /api/builds
  if (path === '/api/builds') {
    return listBuilds(request);
  }

  // GET /api/builds/:id
  const buildDetailMatch = path.match(/^\/api\/builds\/([^/]+)$/);
  if (buildDetailMatch) {
    return getBuildDetail({
      ...request,
      params: { ...request.params, id: buildDetailMatch[1] },
    });
  }

  // GET /api/builds/:id/compare/:otherId
  const compareMatch = path.match(/^\/api\/builds\/([^/]+)\/compare\/([^/]+)$/);
  if (compareMatch) {
    return compareBuildsApi({
      ...request,
      params: { 
        ...request.params, 
        id: compareMatch[1], 
        otherId: compareMatch[2] 
      },
    });
  }

  // GET /api/agents
  if (path === '/api/agents') {
    return listAgents(request);
  }

  // GET /api/health
  if (path === '/api/health') {
    return getHealth(request);
  }

  return { status: 404, error: 'Not found' };
}

// ============================================================================
// Convenience functions for common requests
// ============================================================================

/**
 * Create a GET request
 */
export function createGetRequest(path: string, params?: Record<string, string>): ApiRequest {
  return {
    method: 'GET',
    path,
    params,
  };
}

/**
 * Check if a response is successful
 */
export function isSuccess<T>(response: ApiResponse<T>): response is ApiResponse<T> & { data: T } {
  return response.status >= 200 && response.status < 300 && response.data !== undefined;
}
