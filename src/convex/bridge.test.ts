import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ConvexBridge,
  getConvexBridge,
  resetConvexBridge,
  BuildResultSchema,
  TaskResultSchema,
  ExecutionLogSchema,
  ActivityEventSchema,
  AgentStatusSchema,
} from './bridge.js';
import { BridgeError, ValidationError, ConnectionError } from './error-types.js';

// ============================================================================
// Helpers
// ============================================================================

function mockFetchOk(body: unknown = { status: 'ok' }) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
    status: 200,
  });
}

function mockFetchError(status: number, body = 'Internal error') {
  return vi.fn().mockResolvedValue({
    ok: false,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(body),
    status,
  });
}

function mockFetchNetworkFailure(message = 'Network error') {
  return vi.fn().mockRejectedValue(new Error(message));
}

const CONVEX_URL = 'https://test.convex.cloud';

function makeBridge(overrides: Record<string, unknown> = {}) {
  return new ConvexBridge({
    url: CONVEX_URL,
    maxRetries: 1,
    retryDelayMs: 0,
    ...overrides,
  });
}

function validBuild() {
  return {
    prdId: 'prd-1',
    prdName: 'My App',
    status: 'running' as const,
    startedAt: new Date().toISOString(),
  };
}

function validTask() {
  return {
    buildId: 'build-1',
    taskId: 'task-1',
    title: 'Create API',
    agent: 'EARTH',
    status: 'running' as const,
    dependencies: [],
    phase: 1,
    attempts: 1,
    createdAt: new Date().toISOString(),
  };
}

function validExecution() {
  return {
    taskId: 'task-1',
    agent: 'EARTH',
    model: 'claude-sonnet-4-6',
    prompt: 'Build an API',
    response: 'Here is the API...',
    gatesPassed: true,
    duration: 2500,
    timestamp: new Date().toISOString(),
  };
}

function validActivity() {
  return {
    type: 'task_completed' as const,
    buildId: 'build-1',
    taskId: 'task-1',
    timestamp: new Date().toISOString(),
  };
}

function validAgentStatus() {
  return {
    agentId: 'EARTH',
    status: 'active' as const,
    idleMinutes: 0,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('ConvexBridge', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = mockFetchOk();
    vi.stubGlobal('fetch', fetchSpy);
    resetConvexBridge();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetConvexBridge();
  });

  // --------------------------------------------------------------------------
  // Constructor / factory
  // --------------------------------------------------------------------------

  it('throws ConnectionError if URL is empty', () => {
    expect(() => new ConvexBridge({ url: '' })).toThrow(ConnectionError);
  });

  it('getConvexBridge returns null when no URL configured', () => {
    const bridge = getConvexBridge({ url: undefined });
    expect(bridge).toBeNull();
  });

  it('getConvexBridge returns ConvexBridge when URL is provided', () => {
    const bridge = getConvexBridge({ url: CONVEX_URL });
    expect(bridge).toBeInstanceOf(ConvexBridge);
  });

  it('getConvexBridge is a singleton', () => {
    const a = getConvexBridge({ url: CONVEX_URL });
    const b = getConvexBridge({ url: CONVEX_URL });
    expect(a).toBe(b);
  });

  it('resetConvexBridge clears the singleton', () => {
    const a = getConvexBridge({ url: CONVEX_URL });
    resetConvexBridge();
    const b = getConvexBridge({ url: CONVEX_URL });
    expect(a).not.toBe(b);
  });

  // --------------------------------------------------------------------------
  // logBuild
  // --------------------------------------------------------------------------

  it('logBuild calls dashboard:createBuild mutation', async () => {
    const bridge = makeBridge();
    await bridge.logBuild(validBuild());

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [_url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.path).toBe('dashboard:createBuild');
    expect(body.args.prdId).toBe('prd-1');
  });

  it('logBuild throws ValidationError for missing prdId', async () => {
    const bridge = makeBridge();
    await expect(
      bridge.logBuild({ ...validBuild(), prdId: '' })
    ).rejects.toThrow(ValidationError);
  });

  it('logBuild throws ValidationError for invalid status', async () => {
    const bridge = makeBridge();
    await expect(
      bridge.logBuild({ ...validBuild(), status: 'unknown' as never })
    ).rejects.toThrow(ValidationError);
  });

  // --------------------------------------------------------------------------
  // logTask
  // --------------------------------------------------------------------------

  it('logTask calls dashboard:createTask mutation', async () => {
    const bridge = makeBridge();
    await bridge.logTask(validTask());

    const body = JSON.parse((fetchSpy.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.path).toBe('dashboard:createTask');
    expect(body.args.taskId).toBe('task-1');
  });

  it('logTask throws ValidationError for missing buildId', async () => {
    const bridge = makeBridge();
    await expect(
      bridge.logTask({ ...validTask(), buildId: '' })
    ).rejects.toThrow(ValidationError);
  });

  // --------------------------------------------------------------------------
  // logExecution
  // --------------------------------------------------------------------------

  it('logExecution calls dashboard:logExecution mutation', async () => {
    const bridge = makeBridge();
    await bridge.logExecution(validExecution());

    const body = JSON.parse((fetchSpy.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.path).toBe('dashboard:logExecution');
    expect(body.args.gatesPassed).toBe(true);
  });

  it('logExecution throws ValidationError for negative duration', async () => {
    const bridge = makeBridge();
    await expect(
      bridge.logExecution({ ...validExecution(), duration: -1 })
    ).rejects.toThrow(ValidationError);
  });

  // --------------------------------------------------------------------------
  // logActivity
  // --------------------------------------------------------------------------

  it('logActivity calls realtime:logActivity mutation', async () => {
    const bridge = makeBridge();
    await bridge.logActivity(validActivity());

    const body = JSON.parse((fetchSpy.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.path).toBe('realtime:logActivity');
  });

  it('logActivity throws ValidationError for unknown event type', async () => {
    const bridge = makeBridge();
    await expect(
      bridge.logActivity({ ...validActivity(), type: 'bad_type' as never })
    ).rejects.toThrow(ValidationError);
  });

  // --------------------------------------------------------------------------
  // syncAgentStatus
  // --------------------------------------------------------------------------

  it('syncAgentStatus calls dashboard:updateAgentStatus mutation', async () => {
    const bridge = makeBridge();
    await bridge.syncAgentStatus('EARTH', validAgentStatus());

    const body = JSON.parse((fetchSpy.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.path).toBe('dashboard:updateAgentStatus');
    expect(body.args.agentId).toBe('EARTH');
  });

  // --------------------------------------------------------------------------
  // Error handling & retries
  // --------------------------------------------------------------------------

  it('retries once on HTTP error and then logs (does not throw)', async () => {
    vi.stubGlobal('fetch', mockFetchError(500, 'Server error'));
    const bridge = makeBridge();
    // Should not throw — just silently fail after retries
    await expect(bridge.logBuild(validBuild())).resolves.toBeUndefined();
  });

  it('retries once on network failure', async () => {
    const failFetch = mockFetchNetworkFailure('Network timeout');
    vi.stubGlobal('fetch', failFetch);
    const bridge = makeBridge();
    await expect(bridge.logBuild(validBuild())).resolves.toBeUndefined();
    // Called twice: original + 1 retry
    expect(failFetch).toHaveBeenCalledTimes(2);
  });

  it('queues writes when enableQueue is true and server is down', async () => {
    vi.stubGlobal('fetch', mockFetchNetworkFailure('Network timeout'));
    const bridge = makeBridge({ enableQueue: true });
    await bridge.logBuild(validBuild());
    expect(bridge.queueLength).toBe(1);
  });

  it('flushes the queue on reconnect', async () => {
    vi.stubGlobal('fetch', mockFetchNetworkFailure('Network timeout'));
    const bridge = makeBridge({ enableQueue: true });
    await bridge.logBuild(validBuild());
    expect(bridge.queueLength).toBe(1);

    // Restore network
    vi.stubGlobal('fetch', mockFetchOk());
    await bridge.flushQueue();
    expect(bridge.queueLength).toBe(0);
  });

  // --------------------------------------------------------------------------
  // batchWrite
  // --------------------------------------------------------------------------

  it('batchWrite calls all mutations concurrently', async () => {
    const bridge = makeBridge();
    await bridge.batchWrite([
      { mutation: 'dashboard:createBuild', args: validBuild() },
      { mutation: 'dashboard:createTask', args: validTask() },
    ]);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  // --------------------------------------------------------------------------
  // Zod schema unit tests
  // --------------------------------------------------------------------------

  it('BuildResultSchema rejects unknown status values', () => {
    const result = BuildResultSchema.safeParse({ ...validBuild(), status: 'paused' });
    expect(result.success).toBe(false);
  });

  it('TaskResultSchema sets empty dependencies by default', () => {
    const { dependencies: _d, ...noDepTask } = validTask();
    const result = TaskResultSchema.safeParse(noDepTask);
    expect(result.success).toBe(true);
    expect(result.data?.dependencies).toEqual([]);
  });

  it('AgentStatusSchema rejects negative idleMinutes', () => {
    const result = AgentStatusSchema.safeParse({ ...validAgentStatus(), idleMinutes: -5 });
    expect(result.success).toBe(false);
  });
});
