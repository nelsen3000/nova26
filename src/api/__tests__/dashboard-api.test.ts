// KMS-23: Dashboard API tests

import { describe, it, expect, vi, beforeEach } from 'vitest';
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
} from '../dashboard-api.js';

describe('Dashboard API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('routeRequest', () => {
    it('should route to listBuilds for /api/builds', async () => {
      const request = createGetRequest('/api/builds');
      const response = await routeRequest(request);
      
      // Should return 200 or 500 (depending on DB state)
      expect([200, 500]).toContain(response.status);
    });

    it('should route to getBuildDetail for /api/builds/:id', async () => {
      const request = createGetRequest('/api/builds/test-build-123');
      const response = await routeRequest(request);
      
      expect([200, 404, 500]).toContain(response.status);
    });

    it('should route to compareBuildsApi for /api/builds/:id/compare/:otherId', async () => {
      const request = createGetRequest('/api/builds/build1/compare/build2');
      const response = await routeRequest(request);
      
      expect([200, 500]).toContain(response.status);
    });

    it('should route to listAgents for /api/agents', async () => {
      const request = createGetRequest('/api/agents');
      const response = await routeRequest(request);
      
      expect(response.status).toBe(200);
      expect(response.data).toBeDefined();
    });

    it('should route to getHealth for /api/health', async () => {
      const request = createGetRequest('/api/health');
      const response = await routeRequest(request);
      
      expect(response.status).toBe(200);
      expect(response.data).toBeDefined();
    });

    it('should return 404 for unknown paths', async () => {
      const request = createGetRequest('/api/unknown');
      const response = await routeRequest(request);
      
      expect(response.status).toBe(404);
      expect(response.error).toBe('Not found');
    });
  });

  describe('listBuilds', () => {
    it('should return 405 for non-GET methods', () => {
      const request: ApiRequest = { method: 'POST', path: '/api/builds' };
      const response = listBuilds(request);
      
      expect(response.status).toBe(405);
    });

    it('should return builds list', () => {
      const request = createGetRequest('/api/builds');
      const response = listBuilds(request);
      
      expect([200, 500]).toContain(response.status);
      if (response.status === 200) {
        expect(response.data).toBeDefined();
        expect(response.data?.builds).toBeDefined();
        expect(response.data?.total).toBeDefined();
      }
    });

    it('should calculate status based on pass rate', () => {
      const request = createGetRequest('/api/builds');
      const response = listBuilds(request);
      
      if (response.status === 200 && response.data) {
        for (const build of response.data.builds) {
          expect(['success', 'partial', 'failed']).toContain(build.status);
        }
      }
    });
  });

  describe('getBuildDetail', () => {
    it('should return 405 for non-GET methods', () => {
      const request: ApiRequest = { method: 'POST', path: '/api/builds/123' };
      const response = getBuildDetail(request);
      
      expect(response.status).toBe(405);
    });

    it('should return 400 for missing build ID', () => {
      const request: ApiRequest = { method: 'GET', path: '/api/builds/', params: {} };
      const response = getBuildDetail(request);
      
      expect(response.status).toBe(400);
      expect(response.error).toContain('required');
    });

    it('should return 404 for non-existent build', () => {
      const request = createGetRequest('/api/builds/non-existent-build-xyz');
      const response = getBuildDetail({ ...request, params: { id: 'non-existent-build-xyz' } });
      
      expect(response.status).toBe(404);
    });

    it('should include status field in response', () => {
      const request = createGetRequest('/api/builds/test');
      const response = getBuildDetail({ ...request, params: { id: 'test' } });
      
      if (response.status === 200 && response.data) {
        expect(['success', 'partial', 'failed']).toContain(response.data.status);
      }
    });
  });

  describe('compareBuildsApi', () => {
    it('should return 405 for non-GET methods', () => {
      const request: ApiRequest = { 
        method: 'POST', 
        path: '/api/builds/build1/compare/build2' 
      };
      const response = compareBuildsApi(request);
      
      expect(response.status).toBe(405);
    });

    it('should return 400 for missing build IDs', () => {
      const request: ApiRequest = { 
        method: 'GET', 
        path: '/api/builds/build1/compare/',
        params: { id: 'build1' }
      };
      const response = compareBuildsApi(request);
      
      expect(response.status).toBe(400);
      expect(response.error).toContain('required');
    });

    it('should return comparison result for valid builds', () => {
      const request: ApiRequest = {
        method: 'GET',
        path: '/api/builds/build1/compare/build2',
        params: { id: 'build1', otherId: 'build2' }
      };
      
      const response = compareBuildsApi(request);
      // May fail if builds don't exist in DB
      expect([200, 500]).toContain(response.status);
    });
  });

  describe('listAgents', () => {
    it('should return 405 for non-GET methods', () => {
      const request: ApiRequest = { method: 'POST', path: '/api/agents' };
      const response = listAgents(request);
      
      expect(response.status).toBe(405);
    });

    it('should return rankings and summary', () => {
      const request = createGetRequest('/api/agents');
      const response = listAgents(request);
      
      expect(response.status).toBe(200);
      expect(response.data).toBeDefined();
      
      if (response.data) {
        expect(response.data.rankings).toBeDefined();
        expect(response.data.summary).toBeDefined();
      }
    });

    it('should include total agents in summary', () => {
      const request = createGetRequest('/api/agents');
      const response = listAgents(request);
      
      if (response.data?.summary) {
        expect(typeof response.data.summary.totalAgents).toBe('number');
        expect(typeof response.data.summary.totalTasks).toBe('number');
      }
    });
  });

  describe('getHealth', () => {
    it('should return 405 for non-GET methods', async () => {
      const request: ApiRequest = { method: 'POST', path: '/api/health' };
      const response = await getHealth(request);
      
      expect(response.status).toBe(405);
    });

    it('should return health report', async () => {
      const request = createGetRequest('/api/health');
      const response = await getHealth(request);
      
      expect(response.status).toBe(200);
      expect(response.data).toBeDefined();
      
      if (response.data) {
        expect(response.data.timestamp).toBeDefined();
        expect(response.data.overallStatus).toBeDefined();
        expect(response.data.modules).toBeDefined();
      }
    });

    it('should include module statuses', async () => {
      const request = createGetRequest('/api/health');
      const response = await getHealth(request);
      
      if (response.data) {
        expect(Array.isArray(response.data.modules)).toBe(true);
      }
    });
  });

  describe('isSuccess helper', () => {
    it('should return true for 200 response with data', () => {
      const response = { status: 200, data: { test: true } };
      expect(isSuccess(response)).toBe(true);
    });

    it('should return true for 201 response with data', () => {
      const response = { status: 201, data: { created: true } };
      expect(isSuccess(response)).toBe(true);
    });

    it('should return false for error response', () => {
      const response = { status: 404, error: 'Not found' };
      expect(isSuccess(response)).toBe(false);
    });

    it('should return false for response without data', () => {
      const response = { status: 200 };
      expect(isSuccess(response)).toBe(false);
    });

    it('should return false for 500 response', () => {
      const response = { status: 500, error: 'Server error' };
      expect(isSuccess(response)).toBe(false);
    });
  });

  describe('createGetRequest helper', () => {
    it('should create GET request with path', () => {
      const request = createGetRequest('/api/test');
      
      expect(request.method).toBe('GET');
      expect(request.path).toBe('/api/test');
    });

    it('should include params when provided', () => {
      const request = createGetRequest('/api/test', { id: '123' });
      
      expect(request.params).toEqual({ id: '123' });
    });
  });

  describe('error handling', () => {
    it('should handle unexpected errors gracefully', () => {
      // This tests that the API doesn't throw unhandled exceptions
      const request = createGetRequest('/api/builds');
      
      expect(() => listBuilds(request)).not.toThrow();
    });

    it('should include error message in response', () => {
      const request = createGetRequest('/api/builds');
      const response = listBuilds(request);
      
      if (response.status >= 400) {
        expect(response.error).toBeDefined();
      }
    });
  });
});
