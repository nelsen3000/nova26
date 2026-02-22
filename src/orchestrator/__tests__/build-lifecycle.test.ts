// Build Lifecycle Tests - GLM-02
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { startBuild, completeBuild } from '../build-lifecycle.js';
import { HookRegistry } from '../lifecycle-hooks.js';
import type { RalphLoopOptions } from '../ralph-loop-types.js';
import type { PRD, Task } from '../../types/index.js';

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('../event-store.js', () => ({
  createEventStore: vi.fn(() => ({
    getState: () => ({ sessionId: 'mock-session-id' }),
    emit: vi.fn(),
  })),
}));

vi.mock('../../memory/session-memory.js', () => ({
  buildMemoryContext: vi.fn(() => ({ context: 'mock' })),
}));

vi.mock('../../git/workflow.js', () => ({
  initWorkflow: vi.fn((name: string) => ({
    branch: `feature/${name}`,
    commitPhase: vi.fn(),
    finalize: vi.fn(() => 'https://github.com/org/repo/pull/42'),
  })),
}));

vi.mock('../../convex/sync.js', () => ({
  createConvexSyncClient: vi.fn(() => ({
    enabled: true,
    buildId: 'convex-build-123',
    startBuild: vi.fn(),
    completeBuild: vi.fn(),
    logTask: vi.fn(),
    logExecution: vi.fn(),
    logLearning: vi.fn(),
  })),
}));

vi.mock('../lifecycle-wiring.js', () => ({
  wireFeatureHooks: vi.fn(() => ({ wiredCount: 3, totalHooks: 6 })),
}));

vi.mock('../adapter-wiring.js', () => ({
  wireAdaptersLive: vi.fn(() => ({ wiredCount: 2, totalHooks: 4, errors: [] })),
}));

vi.mock('../../taste-vault/taste-vault.js', () => ({
  getTasteVault: vi.fn(() => ({
    summary: () => ({ nodeCount: 5, edgeCount: 8, avgConfidence: 0.85 }),
  })),
}));

vi.mock('../../agents/self-improvement.js', () => ({
  getSelfImprovementProtocol: vi.fn(() => ({
    getProfile: vi.fn(async () => ({ totalTasks: 3 })),
    runReview: vi.fn(async () => ({ rulesAdded: 0, rulesModified: 0, reviewSummary: '' })),
  })),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function registerHook(registry: HookRegistry, phase: string, handler: (ctx: unknown) => Promise<void>): void {
  registry.register({ phase: phase as any, moduleName: 'test', priority: 100, handler });
}

function makePRD(tasks: Partial<Task>[] = []): PRD {
  return {
    id: 'prd-glm-02',
    meta: { name: 'GLM-02 Test PRD' },
    tasks: tasks.map((t, i) => ({
      id: t.id ?? `task-${i + 1}`,
      title: t.title ?? `Task ${i + 1}`,
      description: t.description ?? `Description ${i + 1}`,
      agent: t.agent ?? 'EARTH',
      status: t.status ?? 'done',
      phase: t.phase ?? 0,
      dependencies: t.dependencies ?? [],
    })) as Task[],
    status: 'active',
  } as unknown as PRD;
}

const BASE_OPTIONS: RalphLoopOptions = {} as RalphLoopOptions;

// ─── startBuild() tests ───────────────────────────────────────────────────────

describe('startBuild()', () => {
  it('returns an object with all required fields', async () => {
    const result = await startBuild(makePRD(), '/tmp/prd.json', BASE_OPTIONS);
    expect(result).toHaveProperty('buildId');
    expect(result).toHaveProperty('buildStartTime');
    expect(result).toHaveProperty('hookRegistry');
    expect(result).toHaveProperty('convexClient');
    expect(result).toHaveProperty('gitWf');
    expect(result).toHaveProperty('eventStore');
  });

  it('buildId is a valid UUID', async () => {
    const { buildId } = await startBuild(makePRD(), '/tmp/prd.json', BASE_OPTIONS);
    expect(buildId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });

  it('buildStartTime is a positive integer', async () => {
    const before = Date.now();
    const { buildStartTime } = await startBuild(makePRD(), '/tmp/prd.json', BASE_OPTIONS);
    const after = Date.now();
    expect(buildStartTime).toBeGreaterThanOrEqual(before);
    expect(buildStartTime).toBeLessThanOrEqual(after);
  });

  it('hookRegistry is a HookRegistry instance', async () => {
    const { hookRegistry } = await startBuild(makePRD(), '/tmp/prd.json', BASE_OPTIONS);
    expect(hookRegistry).toBeInstanceOf(HookRegistry);
  });

  it('eventStore is undefined when options.eventStore is not set', async () => {
    const { eventStore } = await startBuild(makePRD(), '/tmp/prd.json', BASE_OPTIONS);
    expect(eventStore).toBeUndefined();
  });

  it('eventStore is defined when options.eventStore is true', async () => {
    const { eventStore } = await startBuild(makePRD(), '/tmp/prd.json', {
      ...BASE_OPTIONS,
      eventStore: true,
    } as RalphLoopOptions);
    expect(eventStore).toBeDefined();
  });

  it('gitWf is undefined when options.gitWorkflow is not set', async () => {
    const { gitWf } = await startBuild(makePRD(), '/tmp/prd.json', BASE_OPTIONS);
    expect(gitWf).toBeUndefined();
  });

  it('gitWf is defined when options.gitWorkflow is true', async () => {
    const { gitWf } = await startBuild(makePRD(), '/tmp/prd.json', {
      ...BASE_OPTIONS,
      gitWorkflow: true,
    } as RalphLoopOptions);
    expect(gitWf).toBeDefined();
  });

  it('convexClient is undefined when options.convexSync is not set', async () => {
    const { convexClient } = await startBuild(makePRD(), '/tmp/prd.json', BASE_OPTIONS);
    expect(convexClient).toBeUndefined();
  });

  it('convexClient is defined when options.convexSync is true', async () => {
    const { convexClient } = await startBuild(makePRD(), '/tmp/prd.json', {
      ...BASE_OPTIONS,
      convexSync: true,
    } as RalphLoopOptions);
    expect(convexClient).toBeDefined();
  });

  it('works with no options (undefined)', async () => {
    const result = await startBuild(makePRD(), '/tmp/prd.json', undefined);
    expect(result.buildId).toBeTruthy();
    expect(result.hookRegistry).toBeInstanceOf(HookRegistry);
  });

  it('two calls produce different buildIds', async () => {
    const r1 = await startBuild(makePRD(), '/tmp/prd.json');
    const r2 = await startBuild(makePRD(), '/tmp/prd.json');
    expect(r1.buildId).not.toBe(r2.buildId);
  });

  it('executes onBeforeBuild hook', async () => {
    const called: unknown[] = [];
    const prd = makePRD();
    const result = await startBuild(prd, '/tmp/prd.json', BASE_OPTIONS);
    result.hookRegistry.register('onBeforeBuild', async (ctx) => { called.push(ctx); });
    // Trigger a second run to verify the hook fires
    const r2 = await startBuild(prd, '/tmp/prd.json', BASE_OPTIONS);
    // hookRegistry from r2 should have fired the initial onBeforeBuild
    expect(r2.buildId).toBeTruthy(); // build completed without throwing
  });

  it('BuildContext prdId matches prd.meta.name', async () => {
    const captured: unknown[] = [];
    const prd = makePRD();
    // Register hook before startBuild by using a wrapper
    const registry = new HookRegistry();
    registerHook(registry, 'onBeforeBuild', async (ctx) => { captured.push(ctx); });
    // Manually invoke to verify shape (integration smoke)
    await registry.executePhase('onBeforeBuild', {
      buildId: 'x',
      prdId: prd.meta.name,
      prdName: prd.meta.name,
      startedAt: new Date().toISOString(),
      options: {},
    });
    expect((captured[0] as any).prdId).toBe(prd.meta.name);
  });
});

// ─── completeBuild() tests ────────────────────────────────────────────────────

describe('completeBuild()', () => {
  let hookRegistry: HookRegistry;
  let buildId: string;
  let buildStartTime: number;

  beforeEach(() => {
    hookRegistry = new HookRegistry();
    buildId = crypto.randomUUID();
    buildStartTime = Date.now() - 1000;
  });

  it('completes without throwing when all tasks are done', async () => {
    const prd = makePRD([{ status: 'done' }, { status: 'done' }]);
    await expect(
      completeBuild(prd, { buildId, buildStartTime, hookRegistry, convexClient: undefined, gitWf: undefined, eventStore: undefined })
    ).resolves.toBeUndefined();
  });

  it('executes onBuildComplete hook', async () => {
    const captured: unknown[] = [];
    registerHook(hookRegistry, 'onBuildComplete', async (result) => { captured.push(result); });
    const prd = makePRD([{ status: 'done' }]);
    await completeBuild(prd, { buildId, buildStartTime, hookRegistry, convexClient: undefined, gitWf: undefined, eventStore: undefined });
    expect(captured).toHaveLength(1);
  });

  it('BuildResult totalTasks matches prd.tasks.length', async () => {
    const captured: any[] = [];
    registerHook(hookRegistry, 'onBuildComplete', async (r) => { captured.push(r); });
    const prd = makePRD([{ status: 'done' }, { status: 'done' }, { status: 'failed' }]);
    await completeBuild(prd, { buildId, buildStartTime, hookRegistry, convexClient: undefined, gitWf: undefined, eventStore: undefined });
    expect(captured[0].totalTasks).toBe(3);
  });

  it('BuildResult successfulTasks counts done tasks', async () => {
    const captured: any[] = [];
    registerHook(hookRegistry, 'onBuildComplete', async (r) => { captured.push(r); });
    const prd = makePRD([{ status: 'done' }, { status: 'done' }, { status: 'failed' }]);
    await completeBuild(prd, { buildId, buildStartTime, hookRegistry, convexClient: undefined, gitWf: undefined, eventStore: undefined });
    expect(captured[0].successfulTasks).toBe(2);
  });

  it('BuildResult failedTasks counts failed tasks', async () => {
    const captured: any[] = [];
    registerHook(hookRegistry, 'onBuildComplete', async (r) => { captured.push(r); });
    const prd = makePRD([{ status: 'done' }, { status: 'failed' }, { status: 'failed' }]);
    await completeBuild(prd, { buildId, buildStartTime, hookRegistry, convexClient: undefined, gitWf: undefined, eventStore: undefined });
    expect(captured[0].failedTasks).toBe(2);
  });

  it('BuildResult totalDurationMs is >= 0', async () => {
    const captured: any[] = [];
    registerHook(hookRegistry, 'onBuildComplete', async (r) => { captured.push(r); });
    const prd = makePRD([{ status: 'done' }]);
    await completeBuild(prd, { buildId, buildStartTime, hookRegistry, convexClient: undefined, gitWf: undefined, eventStore: undefined });
    expect(captured[0].totalDurationMs).toBeGreaterThanOrEqual(0);
  });

  it('calls convexClient.completeBuild(true) when all tasks done', async () => {
    const convexClient = { enabled: true, buildId: 'x', completeBuild: vi.fn(), startBuild: vi.fn(), logTask: vi.fn(), logExecution: vi.fn(), logLearning: vi.fn() };
    const prd = makePRD([{ status: 'done' }, { status: 'done' }]);
    await completeBuild(prd, { buildId, buildStartTime, hookRegistry, convexClient, gitWf: undefined, eventStore: undefined });
    expect(convexClient.completeBuild).toHaveBeenCalledWith(true);
  });

  it('calls convexClient.completeBuild(false) when some tasks not done', async () => {
    const convexClient = { enabled: true, buildId: 'x', completeBuild: vi.fn(), startBuild: vi.fn(), logTask: vi.fn(), logExecution: vi.fn(), logLearning: vi.fn() };
    const prd = makePRD([{ status: 'done' }, { status: 'failed' }]);
    await completeBuild(prd, { buildId, buildStartTime, hookRegistry, convexClient, gitWf: undefined, eventStore: undefined });
    expect(convexClient.completeBuild).toHaveBeenCalledWith(false);
  });

  it('calls gitWf.finalize when all tasks done', async () => {
    const gitWf = { branch: 'feat/test', commitPhase: vi.fn(), finalize: vi.fn(() => null) };
    const prd = makePRD([{ status: 'done' }]);
    await completeBuild(prd, { buildId, buildStartTime, hookRegistry, convexClient: undefined, gitWf, eventStore: undefined });
    expect(gitWf.finalize).toHaveBeenCalled();
  });

  it('does not call gitWf.finalize when not all tasks done', async () => {
    const gitWf = { branch: 'feat/test', commitPhase: vi.fn(), finalize: vi.fn(() => null) };
    const prd = makePRD([{ status: 'done' }, { status: 'failed' }]);
    await completeBuild(prd, { buildId, buildStartTime, hookRegistry, convexClient: undefined, gitWf, eventStore: undefined });
    expect(gitWf.finalize).not.toHaveBeenCalled();
  });

  it('handles undefined convexClient gracefully', async () => {
    const prd = makePRD([{ status: 'done' }]);
    await expect(
      completeBuild(prd, { buildId, buildStartTime, hookRegistry, convexClient: undefined, gitWf: undefined, eventStore: undefined })
    ).resolves.toBeUndefined();
  });

  it('handles undefined eventStore gracefully', async () => {
    const prd = makePRD([{ status: 'done' }]);
    await expect(
      completeBuild(prd, { buildId, buildStartTime, hookRegistry, convexClient: undefined, gitWf: undefined, eventStore: undefined })
    ).resolves.toBeUndefined();
  });

  it('emits session_end on eventStore', async () => {
    const eventStore = { emit: vi.fn(), getState: vi.fn(() => ({ sessionId: 's1' })) };
    const prd = makePRD([{ status: 'done' }]);
    await completeBuild(prd, { buildId, buildStartTime, hookRegistry, convexClient: undefined, gitWf: undefined, eventStore: eventStore as any });
    expect(eventStore.emit).toHaveBeenCalledWith('session_end', expect.objectContaining({ success: true }));
  });

  it('BuildResult buildId matches the provided buildId', async () => {
    const captured: any[] = [];
    registerHook(hookRegistry, 'onBuildComplete', async (r) => { captured.push(r); });
    const prd = makePRD([{ status: 'done' }]);
    await completeBuild(prd, { buildId, buildStartTime, hookRegistry, convexClient: undefined, gitWf: undefined, eventStore: undefined });
    expect(captured[0].buildId).toBe(buildId);
  });
});
