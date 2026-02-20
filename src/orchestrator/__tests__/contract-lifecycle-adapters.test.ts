// SN-12: Lifecycle Adapter Contract Tests
// Verifies all 7 adapters return correct FeatureLifecycleHandlers shape

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { FeatureLifecycleHandlers } from '../lifecycle-wiring.js';
import type {
  BuildContext,
  TaskContext,
  TaskResult,
  HandoffContext,
  BuildResult,
} from '../lifecycle-hooks.js';

import { createModelRoutingLifecycleHooks } from '../../model-routing/lifecycle-adapter.js';
import { createCinematicObservabilityLifecycleHooks } from '../../observability/lifecycle-adapter.js';
import { createInfiniteMemoryLifecycleHooks } from '../../atlas/lifecycle-adapter.js';
import { createAIModelDatabaseLifecycleHooks } from '../../models/lifecycle-adapter.js';
import { createPerplexityLifecycleHooks } from '../../tools/perplexity/lifecycle-adapter.js';
import { createCRDTLifecycleHooks } from '../../collaboration/lifecycle-adapter.js';
import { createWorkflowEngineLifecycleHooks } from '../../workflow-engine/lifecycle-adapter.js';

// ---------------------------------------------------------------------------
// Test Fixtures
// ---------------------------------------------------------------------------

const VALID_PHASES = [
  'onBeforeBuild',
  'onBeforeTask',
  'onAfterTask',
  'onTaskError',
  'onHandoff',
  'onBuildComplete',
] as const;

function makeBuildContext(): BuildContext {
  return {
    buildId: 'contract-build-001',
    prdId: 'contract-prd',
    prdName: 'Contract Test PRD',
    startedAt: new Date().toISOString(),
    options: {},
  };
}

function makeTaskContext(): TaskContext {
  return {
    taskId: 'contract-task-001',
    title: 'Contract test task',
    agentName: 'EARTH',
    dependencies: [],
  };
}

function makeTaskResult(success = true): TaskResult {
  return {
    taskId: 'contract-task-001',
    agentName: 'EARTH',
    success,
    output: success ? 'task output' : undefined,
    error: success ? undefined : 'task failed',
    durationMs: 100,
  };
}

function makeHandoffContext(): HandoffContext {
  return {
    fromAgent: 'EARTH',
    toAgent: 'MARS',
    taskId: 'contract-task-001',
    payload: {},
  };
}

function makeBuildResult(): BuildResult {
  return {
    buildId: 'contract-build-001',
    prdId: 'contract-prd',
    totalTasks: 5,
    successfulTasks: 4,
    failedTasks: 1,
    totalDurationMs: 5000,
    averageAceScore: 85,
  };
}

// ---------------------------------------------------------------------------
// Adapter factory configs (minimal valid configs)
// ---------------------------------------------------------------------------

interface AdapterEntry {
  name: string;
  factory: () => FeatureLifecycleHandlers;
}

const adapters: AdapterEntry[] = [
  {
    name: 'model-routing',
    factory: () => createModelRoutingLifecycleHooks({ enabled: true }),
  },
  {
    name: 'cinematic-observability',
    factory: () => createCinematicObservabilityLifecycleHooks({ enabled: true }),
  },
  {
    name: 'infinite-memory',
    factory: () => createInfiniteMemoryLifecycleHooks({ enabled: true }),
  },
  {
    name: 'ai-model-database',
    factory: () => createAIModelDatabaseLifecycleHooks({}),
  },
  {
    name: 'perplexity',
    factory: () => createPerplexityLifecycleHooks({ enabled: true }),
  },
  {
    name: 'crdt-collaboration',
    factory: () => createCRDTLifecycleHooks({ enabled: true }),
  },
  {
    name: 'workflow-engine',
    factory: () => createWorkflowEngineLifecycleHooks(),
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Contract: Lifecycle Adapters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Suppress console output from adapters during tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('Return type contract', () => {
    for (const { name, factory } of adapters) {
      it(`${name}: should return an object`, () => {
        const handlers = factory();
        expect(typeof handlers).toBe('object');
        expect(handlers).not.toBeNull();
      });
    }

    for (const { name, factory } of adapters) {
      it(`${name}: should only contain valid phase keys`, () => {
        const handlers = factory();
        const keys = Object.keys(handlers);
        for (const key of keys) {
          expect(VALID_PHASES).toContain(key);
        }
      });
    }

    for (const { name, factory } of adapters) {
      it(`${name}: all defined handlers should be functions`, () => {
        const handlers = factory();
        for (const phase of VALID_PHASES) {
          const handler = handlers[phase];
          if (handler !== undefined) {
            expect(typeof handler).toBe('function');
          }
        }
      });
    }
  });

  describe('Handler invocation contract', () => {
    for (const { name, factory } of adapters) {
      it(`${name}: onBeforeBuild should not throw on valid context`, async () => {
        const handlers = factory();
        if (handlers.onBeforeBuild) {
          await expect(handlers.onBeforeBuild(makeBuildContext())).resolves.not.toThrow();
        }
      });
    }

    for (const { name, factory } of adapters) {
      it(`${name}: onBeforeTask should not throw on valid context`, async () => {
        const handlers = factory();
        // Initialize build state first if needed
        if (handlers.onBeforeBuild) {
          await handlers.onBeforeBuild(makeBuildContext());
        }
        if (handlers.onBeforeTask) {
          await expect(handlers.onBeforeTask(makeTaskContext())).resolves.not.toThrow();
        }
      });
    }

    for (const { name, factory } of adapters) {
      it(`${name}: onAfterTask should not throw on valid context`, async () => {
        const handlers = factory();
        if (handlers.onBeforeBuild) {
          await handlers.onBeforeBuild(makeBuildContext());
        }
        if (handlers.onAfterTask) {
          await expect(handlers.onAfterTask(makeTaskResult(true))).resolves.not.toThrow();
        }
      });
    }

    for (const { name, factory } of adapters) {
      it(`${name}: onBuildComplete should not throw on valid context`, async () => {
        const handlers = factory();
        if (handlers.onBeforeBuild) {
          await handlers.onBeforeBuild(makeBuildContext());
        }
        if (handlers.onBuildComplete) {
          await expect(handlers.onBuildComplete(makeBuildResult())).resolves.not.toThrow();
        }
      });
    }
  });

  describe('Disabled adapter contract', () => {
    it('model-routing: should be a no-op when disabled', async () => {
      const handlers = createModelRoutingLifecycleHooks({ enabled: false });
      if (handlers.onBeforeBuild) {
        await expect(handlers.onBeforeBuild(makeBuildContext())).resolves.not.toThrow();
      }
      if (handlers.onBeforeTask) {
        await expect(handlers.onBeforeTask(makeTaskContext())).resolves.not.toThrow();
      }
    });

    it('cinematic-observability: should be a no-op when disabled', async () => {
      const handlers = createCinematicObservabilityLifecycleHooks({ enabled: false });
      if (handlers.onBeforeBuild) {
        await expect(handlers.onBeforeBuild(makeBuildContext())).resolves.not.toThrow();
      }
    });

    it('infinite-memory: should be a no-op when disabled', async () => {
      const handlers = createInfiniteMemoryLifecycleHooks({ enabled: false });
      if (handlers.onBeforeBuild) {
        await expect(handlers.onBeforeBuild(makeBuildContext())).resolves.not.toThrow();
      }
    });

    it('perplexity: should be a no-op when disabled', async () => {
      const handlers = createPerplexityLifecycleHooks({ enabled: false });
      if (handlers.onBeforeBuild) {
        await expect(handlers.onBeforeBuild(makeBuildContext())).resolves.not.toThrow();
      }
    });

    it('crdt-collaboration: should be a no-op when disabled', async () => {
      const handlers = createCRDTLifecycleHooks({ enabled: false });
      if (handlers.onBeforeBuild) {
        await expect(handlers.onBeforeBuild(makeBuildContext())).resolves.not.toThrow();
      }
    });
  });

  describe('Empty/null input resilience', () => {
    // Adapters that validate context and return early on empty objects
    const resilientAdapters = adapters.filter(a => a.name !== 'workflow-engine');

    for (const { name, factory } of resilientAdapters) {
      it(`${name}: onBeforeBuild should handle empty object gracefully`, async () => {
        const handlers = factory();
        if (handlers.onBeforeBuild) {
          await expect(
            handlers.onBeforeBuild({} as BuildContext),
          ).resolves.not.toThrow();
        }
      });
    }

    it('workflow-engine: onBeforeBuild should handle minimal context without crash', async () => {
      const handlers = createWorkflowEngineLifecycleHooks();
      if (handlers.onBeforeBuild) {
        // workflow-engine requires options.prd — provide minimal valid context
        const minimalCtx: BuildContext = {
          buildId: '',
          prdId: '',
          prdName: '',
          startedAt: '',
          options: {},
        };
        await expect(handlers.onBeforeBuild(minimalCtx)).resolves.not.toThrow();
      }
    });
  });
});
