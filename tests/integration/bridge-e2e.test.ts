/**
 * Integration tests: ConvexBridge end-to-end flow
 * Tests the full path from engine events → Convex mutations
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ConvexBridge,
  getConvexBridge,
  resetConvexBridge,
} from '../../src/convex/bridge.js';
import { ValidationError, ConnectionError } from '../../src/convex/error-types.js';

const CONVEX_URL = 'https://test.convex.cloud';

function mockFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });
}

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch(200, { status: 'ok' }));
  resetConvexBridge();
});

afterEach(() => {
  vi.unstubAllGlobals();
  resetConvexBridge();
});

// ============================================================================
// End-to-End Bridge Flow
// ============================================================================

describe('Engine build completion → Convex mutation → dashboard', () => {
  it('full build flow: start → tasks → complete logs to correct mutations', async () => {
    const fetchMock = mockFetch(200, { id: 'conv-build-1' });
    vi.stubGlobal('fetch', fetchMock);

    const bridge = new ConvexBridge({ url: CONVEX_URL, maxRetries: 0, retryDelayMs: 0 });

    // 1. Log build start
    await bridge.logBuild({
      prdId: 'prd-nova-dashboard',
      prdName: 'Nova Dashboard',
      status: 'running',
      startedAt: new Date().toISOString(),
    });

    // 2. Log a task
    await bridge.logTask({
      buildId: 'build-1',
      taskId: 'task-auth',
      title: 'Set up authentication',
      agent: 'EARTH',
      status: 'done',
      dependencies: [],
      phase: 1,
      attempts: 1,
      createdAt: new Date().toISOString(),
    });

    // 3. Log execution
    await bridge.logExecution({
      taskId: 'task-auth',
      agent: 'EARTH',
      model: 'claude-sonnet-4-6',
      prompt: 'Set up Convex auth',
      response: 'Done.',
      gatesPassed: true,
      duration: 1800,
      timestamp: new Date().toISOString(),
    });

    // 4. Complete build
    await bridge.logBuild({
      prdId: 'prd-nova-dashboard',
      prdName: 'Nova Dashboard',
      status: 'completed',
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    });

    // Verify 4 mutations were called with correct paths
    expect(fetchMock).toHaveBeenCalledTimes(4);
    const mutations = fetchMock.mock.calls.map((call) => {
      const body = JSON.parse((call[1] as RequestInit).body as string);
      return body.path;
    });
    expect(mutations).toEqual([
      'dashboard:createBuild',
      'dashboard:createTask',
      'dashboard:logExecution',
      'dashboard:createBuild',
    ]);
  });

  it('activity events are fired at build lifecycle transitions', async () => {
    const fetchMock = mockFetch(200, {});
    vi.stubGlobal('fetch', fetchMock);
    const bridge = new ConvexBridge({ url: CONVEX_URL, maxRetries: 0, retryDelayMs: 0 });

    const now = new Date().toISOString();
    await bridge.logActivity({ type: 'build_started', buildId: 'b1', timestamp: now });
    await bridge.logActivity({ type: 'task_completed', taskId: 't1', timestamp: now });
    await bridge.logActivity({ type: 'build_completed', buildId: 'b1', timestamp: now });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const paths = fetchMock.mock.calls.map(
      (c) => JSON.parse((c[1] as RequestInit).body as string).path
    );
    expect(paths).toEqual([
      'realtime:logActivity',
      'realtime:logActivity',
      'realtime:logActivity',
    ]);
  });

  it('syncAgentStatus updates all 3 agent status fields', async () => {
    const fetchMock = mockFetch(200, {});
    vi.stubGlobal('fetch', fetchMock);
    const bridge = new ConvexBridge({ url: CONVEX_URL, maxRetries: 0, retryDelayMs: 0 });

    await bridge.syncAgentStatus('VENUS', {
      agentId: 'VENUS',
      status: 'idle',
      currentTaskId: undefined,
      idleMinutes: 15,
    });

    const body = JSON.parse(
      (fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string
    );
    expect(body.args.status).toBe('idle');
    expect(body.args.idleMinutes).toBe(15);
  });
});

// ============================================================================
// Error resilience
// ============================================================================

describe('Bridge error resilience', () => {
  it('does not throw when Convex returns 500', async () => {
    vi.stubGlobal('fetch', mockFetch(500, {}));
    const bridge = new ConvexBridge({ url: CONVEX_URL, maxRetries: 0, retryDelayMs: 0 });
    // Must not throw — bridge swallows errors to never block the build
    await expect(bridge.logBuild({
      prdId: 'prd-1',
      prdName: 'Test',
      status: 'running',
      startedAt: new Date().toISOString(),
    })).resolves.toBeUndefined();
  });

  it('does not throw when network is completely down', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));
    const bridge = new ConvexBridge({ url: CONVEX_URL, maxRetries: 0, retryDelayMs: 0 });
    await expect(bridge.logActivity({
      type: 'build_started',
      timestamp: new Date().toISOString(),
    })).resolves.toBeUndefined();
  });

  it('validation errors throw immediately (before any HTTP call)', async () => {
    const fetchMock = mockFetch(200, {});
    vi.stubGlobal('fetch', fetchMock);
    const bridge = new ConvexBridge({ url: CONVEX_URL, maxRetries: 0, retryDelayMs: 0 });

    await expect(
      bridge.logTask({
        buildId: '',  // invalid — fails validation
        taskId: 'task-1',
        title: 'Test',
        agent: 'EARTH',
        status: 'running',
        dependencies: [],
        phase: 1,
        attempts: 1,
        createdAt: new Date().toISOString(),
      })
    ).rejects.toThrow(ValidationError);

    // fetch was never called
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('bridge factory returns null when CONVEX_URL env var not set', () => {
    const original = process.env.CONVEX_URL;
    const originalNext = process.env.NEXT_PUBLIC_CONVEX_URL;
    delete process.env.CONVEX_URL;
    delete process.env.NEXT_PUBLIC_CONVEX_URL;

    resetConvexBridge();
    const bridge = getConvexBridge();
    expect(bridge).toBeNull();

    process.env.CONVEX_URL = original;
    if (originalNext) process.env.NEXT_PUBLIC_CONVEX_URL = originalNext;
  });

  it('ConnectionError thrown when URL is empty string', () => {
    expect(() => new ConvexBridge({ url: '' })).toThrow(ConnectionError);
  });
});

// ============================================================================
// Batch writes
// ============================================================================

describe('batchWrite concurrency', () => {
  it('fires all mutations and resolves when all succeed', async () => {
    const fetchMock = mockFetch(200, {});
    vi.stubGlobal('fetch', fetchMock);
    const bridge = new ConvexBridge({ url: CONVEX_URL, maxRetries: 0, retryDelayMs: 0 });

    await bridge.batchWrite([
      { mutation: 'dashboard:createBuild', args: { prdId: 'a', prdName: 'A', status: 'running', startedAt: new Date().toISOString() } },
      { mutation: 'dashboard:createBuild', args: { prdId: 'b', prdName: 'B', status: 'running', startedAt: new Date().toISOString() } },
      { mutation: 'realtime:logActivity', args: { type: 'build_started', timestamp: new Date().toISOString() } },
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('batchWrite does not throw if some mutations fail', async () => {
    let callCount = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      callCount++;
      return Promise.resolve({
        ok: callCount % 2 === 1,  // odd calls succeed, even calls fail
        status: callCount % 2 === 1 ? 200 : 500,
        json: () => Promise.resolve({}),
        text: () => Promise.resolve('error'),
      });
    }));

    const bridge = new ConvexBridge({ url: CONVEX_URL, maxRetries: 0, retryDelayMs: 0 });
    await expect(
      bridge.batchWrite([
        { mutation: 'a', args: {} },
        { mutation: 'b', args: {} },
      ])
    ).resolves.toBeUndefined();
  });
});
