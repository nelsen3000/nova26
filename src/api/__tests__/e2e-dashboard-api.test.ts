// SN-25: Dashboard API Integration Test
// E2E tests for all dashboard API routes with realistic mock data

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the analytics/performance modules before importing dashboard-api
vi.mock('../../analytics/build-metrics.js', () => {
  const MOCK_BUILDS: Record<string, unknown> = {
    'build-001': {
      buildId: 'build-001',
      duration: 12000,
      taskCount: { total: 5, completed: 5, failed: 0 },
      passRate: 1.0,
      agentUtilization: [
        { agent: 'EARTH', tasks: 2, successRate: 1.0, avgDuration: 2000 },
        { agent: 'MARS', tasks: 3, successRate: 1.0, avgDuration: 2500 },
      ],
      costEstimate: 0.15,
      tokensUsed: 15000,
      startTime: '2026-02-20T10:00:00Z',
      endTime: '2026-02-20T10:00:12Z',
    },
    'build-002': {
      buildId: 'build-002',
      duration: 25000,
      taskCount: { total: 8, completed: 6, failed: 2 },
      passRate: 0.75,
      agentUtilization: [
        { agent: 'EARTH', tasks: 3, successRate: 0.67, avgDuration: 3000 },
        { agent: 'VENUS', tasks: 5, successRate: 0.8, avgDuration: 2800 },
      ],
      costEstimate: 0.32,
      tokensUsed: 32000,
      startTime: '2026-02-20T11:00:00Z',
      endTime: '2026-02-20T11:00:25Z',
    },
    'build-003': {
      buildId: 'build-003',
      duration: 5000,
      taskCount: { total: 3, completed: 0, failed: 3 },
      passRate: 0.0,
      agentUtilization: [
        { agent: 'JUPITER', tasks: 3, successRate: 0.0, avgDuration: 1500 },
      ],
      costEstimate: 0.05,
      tokensUsed: 5000,
      startTime: '2026-02-20T12:00:00Z',
      endTime: '2026-02-20T12:00:05Z',
    },
  };

  return {
    calculateBuildMetrics: (buildId: string) => MOCK_BUILDS[buildId] ?? null,
    getAllBuildIds: () => Object.keys(MOCK_BUILDS),
  };
});

vi.mock('../../analytics/build-comparison.js', () => ({
  compareBuilds: (id1: string, id2: string) => ({
    build1Id: id1,
    build2Id: id2,
    durationDiff: 13000,
    passRateDiff: 0.25,
    taskCountDiff: { total: 3, completed: 1, failed: 2 },
    improvements: ['Faster task execution'],
    regressions: ['More failures'],
  }),
}));

vi.mock('../../agents/performance-tracker.js', () => ({
  getPerformanceTracker: () => ({
    calculateRankings: () => [
      { agentName: 'EARTH', rank: 1, score: 95, totalTasks: 10, successRate: 0.95, avgDuration: 2000 },
      { agentName: 'MARS', rank: 2, score: 88, totalTasks: 8, successRate: 0.88, avgDuration: 2500 },
      { agentName: 'VENUS', rank: 3, score: 82, totalTasks: 6, successRate: 0.83, avgDuration: 3000 },
    ],
    getPerformanceSummary: () => ({
      totalAgents: 3,
      totalTasks: 24,
      overallSuccessRate: 0.89,
      avgDuration: 2500,
      topAgent: 'EARTH',
      bottomAgent: 'VENUS',
    }),
  }),
}));

vi.mock('../../orchestrator/module-health.js', () => ({
  getModuleHealthChecker: () => ({
    checkAll: async () => ({
      timestamp: Date.now(),
      totalModules: 7,
      healthy: 6,
      degraded: 1,
      unhealthy: 0,
      disabled: 0,
      overallStatus: 'degraded',
      modules: [
        { moduleName: 'model-routing', status: 'healthy', latencyMs: 2, message: 'OK', lastChecked: Date.now() },
        { moduleName: 'perplexity', status: 'degraded', latencyMs: 150, message: 'Slow', lastChecked: Date.now() },
      ],
      totalCheckDurationMs: 152,
    }),
  }),
}));

import {
  listBuilds,
  getBuildDetail,
  compareBuildsApi,
  listAgents,
  getHealth,
  routeRequest,
  createGetRequest,
  isSuccess,
  type ApiRequest,
  type ApiResponse,
} from '../dashboard-api.js';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('E2E Dashboard API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/builds — list builds', () => {
    it('should return all builds sorted by start time', () => {
      const response = listBuilds(createGetRequest('/api/builds'));

      expect(response.status).toBe(200);
      expect(response.data).toBeDefined();
      expect(response.data!.total).toBe(3);
      expect(response.data!.builds).toHaveLength(3);
      // Newest first
      expect(response.data!.builds[0].buildId).toBe('build-003');
    });

    it('should include correct status for each build', () => {
      const response = listBuilds(createGetRequest('/api/builds'));
      const builds = response.data!.builds;

      const build001 = builds.find(b => b.buildId === 'build-001');
      const build002 = builds.find(b => b.buildId === 'build-002');
      const build003 = builds.find(b => b.buildId === 'build-003');

      expect(build001!.status).toBe('success');    // 100% pass rate
      expect(build002!.status).toBe('partial');     // 75% pass rate
      expect(build003!.status).toBe('failed');      // 0% pass rate
    });

    it('should include task counts and pass rates', () => {
      const response = listBuilds(createGetRequest('/api/builds'));
      const build = response.data!.builds.find(b => b.buildId === 'build-001')!;

      expect(build.taskCount.total).toBe(5);
      expect(build.taskCount.completed).toBe(5);
      expect(build.taskCount.failed).toBe(0);
      expect(build.passRate).toBe(1.0);
    });

    it('should reject non-GET methods', () => {
      const response = listBuilds({ method: 'POST', path: '/api/builds' });
      expect(response.status).toBe(405);
      expect(response.error).toBe('Method not allowed');
    });

    it('should pass isSuccess check for valid response', () => {
      const response = listBuilds(createGetRequest('/api/builds'));
      expect(isSuccess(response)).toBe(true);
    });
  });

  describe('GET /api/builds/:id — build detail', () => {
    it('should return build detail for valid ID', () => {
      const response = getBuildDetail({
        method: 'GET', path: '/api/builds/build-001',
        params: { id: 'build-001' },
      });

      expect(response.status).toBe(200);
      expect(response.data).toBeDefined();
      expect(response.data!.buildId).toBe('build-001');
      expect(response.data!.status).toBe('success');
    });

    it('should return 404 for unknown build ID', () => {
      const response = getBuildDetail({
        method: 'GET', path: '/api/builds/nonexistent',
        params: { id: 'nonexistent' },
      });

      expect(response.status).toBe(404);
      expect(response.error).toContain('Build not found');
    });

    it('should return 400 when build ID is missing', () => {
      const response = getBuildDetail({ method: 'GET', path: '/api/builds/' });
      expect(response.status).toBe(400);
      expect(response.error).toContain('Build ID is required');
    });

    it('should reject non-GET methods', () => {
      const response = getBuildDetail({
        method: 'DELETE', path: '/api/builds/build-001',
        params: { id: 'build-001' },
      });
      expect(response.status).toBe(405);
    });

    it('should include agent utilization in detail', () => {
      const response = getBuildDetail({
        method: 'GET', path: '/api/builds/build-001',
        params: { id: 'build-001' },
      });
      expect(response.data!.agentUtilization).toHaveLength(2);
      expect(response.data!.agentUtilization[0].agent).toBe('EARTH');
    });

    it('should classify partial builds correctly', () => {
      const response = getBuildDetail({
        method: 'GET', path: '/api/builds/build-002',
        params: { id: 'build-002' },
      });
      expect(response.data!.status).toBe('partial');
    });

    it('should classify failed builds correctly', () => {
      const response = getBuildDetail({
        method: 'GET', path: '/api/builds/build-003',
        params: { id: 'build-003' },
      });
      expect(response.data!.status).toBe('failed');
    });
  });

  describe('GET /api/builds/:id/compare/:otherId — comparison', () => {
    it('should compare two builds', () => {
      const response = compareBuildsApi({
        method: 'GET',
        path: '/api/builds/build-001/compare/build-002',
        params: { id: 'build-001', otherId: 'build-002' },
      });

      expect(response.status).toBe(200);
      expect(response.data).toBeDefined();
      expect(response.data!.build1Id).toBe('build-001');
      expect(response.data!.build2Id).toBe('build-002');
    });

    it('should include diffs in comparison', () => {
      const response = compareBuildsApi({
        method: 'GET',
        path: '/api/builds/build-001/compare/build-002',
        params: { id: 'build-001', otherId: 'build-002' },
      });

      expect(response.data!.durationDiff).toBe(13000);
      expect(response.data!.passRateDiff).toBe(0.25);
    });

    it('should return 400 when missing build IDs', () => {
      const response = compareBuildsApi({
        method: 'GET',
        path: '/api/builds//compare/',
        params: {},
      });
      expect(response.status).toBe(400);
    });

    it('should reject non-GET methods', () => {
      const response = compareBuildsApi({
        method: 'PUT',
        path: '/api/builds/build-001/compare/build-002',
        params: { id: 'build-001', otherId: 'build-002' },
      });
      expect(response.status).toBe(405);
    });
  });

  describe('GET /api/agents — agent rankings', () => {
    it('should return agent rankings', () => {
      const response = listAgents(createGetRequest('/api/agents'));

      expect(response.status).toBe(200);
      expect(response.data).toBeDefined();
      expect(response.data!.rankings).toHaveLength(3);
    });

    it('should rank agents by score', () => {
      const response = listAgents(createGetRequest('/api/agents'));
      const rankings = response.data!.rankings;

      expect(rankings[0].agentName).toBe('EARTH');
      expect(rankings[0].rank).toBe(1);
      expect(rankings[0].score).toBe(95);
    });

    it('should include performance summary', () => {
      const response = listAgents(createGetRequest('/api/agents'));
      const summary = response.data!.summary;

      expect(summary.totalAgents).toBe(3);
      expect(summary.totalTasks).toBe(24);
      expect(summary.overallSuccessRate).toBe(0.89);
      expect(summary.topAgent).toBe('EARTH');
    });

    it('should reject non-GET methods', () => {
      const response = listAgents({ method: 'POST', path: '/api/agents' });
      expect(response.status).toBe(405);
    });
  });

  describe('GET /api/health — module health', () => {
    it('should return health report', async () => {
      const response = await getHealth(createGetRequest('/api/health'));

      expect(response.status).toBe(200);
      expect(response.data).toBeDefined();
      expect(response.data!.totalModules).toBe(7);
    });

    it('should include module statuses', async () => {
      const response = await getHealth(createGetRequest('/api/health'));
      const modules = response.data!.modules;

      expect(modules).toHaveLength(2);
      expect(modules[0].moduleName).toBe('model-routing');
      expect(modules[0].status).toBe('healthy');
      expect(modules[1].moduleName).toBe('perplexity');
      expect(modules[1].status).toBe('degraded');
    });

    it('should report overall status', async () => {
      const response = await getHealth(createGetRequest('/api/health'));
      expect(response.data!.overallStatus).toBe('degraded');
    });

    it('should reject non-GET methods', async () => {
      const response = await getHealth({ method: 'POST', path: '/api/health' });
      expect(response.status).toBe(405);
    });
  });

  describe('Router — routeRequest()', () => {
    it('should route /api/builds to listBuilds', async () => {
      const response = await routeRequest(createGetRequest('/api/builds'));
      expect(response.status).toBe(200);
    });

    it('should route /api/builds/:id to getBuildDetail', async () => {
      const response = await routeRequest(createGetRequest('/api/builds/build-001'));
      expect(response.status).toBe(200);
    });

    it('should route /api/builds/:id/compare/:otherId to compareBuildsApi', async () => {
      const response = await routeRequest(
        createGetRequest('/api/builds/build-001/compare/build-002')
      );
      expect(response.status).toBe(200);
    });

    it('should route /api/agents to listAgents', async () => {
      const response = await routeRequest(createGetRequest('/api/agents'));
      expect(response.status).toBe(200);
    });

    it('should route /api/health to getHealth', async () => {
      const response = await routeRequest(createGetRequest('/api/health'));
      expect(response.status).toBe(200);
    });

    it('should return 404 for unknown routes', async () => {
      const response = await routeRequest(createGetRequest('/api/unknown'));
      expect(response.status).toBe(404);
    });
  });

  describe('Response shape validation', () => {
    it('should have correct ListBuildsResponse shape', () => {
      const response = listBuilds(createGetRequest('/api/builds'));
      const data = response.data!;

      expect(typeof data.total).toBe('number');
      expect(Array.isArray(data.builds)).toBe(true);
      for (const build of data.builds) {
        expect(typeof build.buildId).toBe('string');
        expect(typeof build.startTime).toBe('string');
        expect(typeof build.duration).toBe('number');
        expect(typeof build.passRate).toBe('number');
        expect(['success', 'partial', 'failed']).toContain(build.status);
      }
    });

    it('should have correct AgentsResponse shape', () => {
      const response = listAgents(createGetRequest('/api/agents'));
      const data = response.data!;

      expect(Array.isArray(data.rankings)).toBe(true);
      for (const r of data.rankings) {
        expect(typeof r.agentName).toBe('string');
        expect(typeof r.rank).toBe('number');
        expect(typeof r.score).toBe('number');
      }
      expect(typeof data.summary.totalAgents).toBe('number');
    });
  });
});
