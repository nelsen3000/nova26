// MX-04: Event Bus Integration Tests
// Verifies that lifecycle adapters correctly emit events via the event bus

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  EventBus,
  getGlobalEventBus,
  resetGlobalEventBus,
  type ModelSelectedEvent,
  type MemoryStoredEvent,
  type WorkflowTransitionedEvent,
  type SpanCreatedEvent,
  type CollaborationChangedEvent,
  type ResearchCompletedEvent,
  type EventName,
} from '../event-bus.js';

// ============================================================================
// Mocks — All external I/O dependencies stubbed
// ============================================================================

// Model Routing adapter dependencies
vi.mock('../../model-routing/router.js', () => {
  class MockModelRouter {
    route() {
      return {
        agentId: 'EARTH',
        selectedModel: {
          name: 'gpt-4o',
          family: 'openai',
          strength: 'power',
          quant: 'FP16',
          contextWindow: 128000,
          tokensPerSec: 50,
          costFactor: 1.0,
          speculativeDraft: null,
        },
        fallbackChain: [],
        useSpeculativeDecoding: false,
        estimatedTokensPerSec: 50,
        estimatedCost: 0.1,
        confidence: 0.85,
      };
    }
    shouldEscalate() { return false; }
  }
  return { ModelRouter: MockModelRouter };
});

vi.mock('../../model-routing/model-registry.js', () => {
  class MockModelRegistry {}
  return { ModelRegistry: MockModelRegistry };
});

vi.mock('../../model-routing/hardware-detector.js', () => {
  class MockHardwareDetector {
    detect() {
      return { id: 'test-tier', vramGB: 8, ramGB: 16 };
    }
  }
  return { HardwareDetector: MockHardwareDetector };
});

vi.mock('../../model-routing/speculative-decoder.js', () => {
  class MockSpeculativeDecoder {}
  return { SpeculativeDecoder: MockSpeculativeDecoder };
});

// Atlas adapter dependencies
vi.mock('../../atlas/infinite-memory-core.js', () => {
  class MockATLASInfiniteMemory {
    async upsertWithHierarchy() { return 'node-abc-123'; }
    getStats() { return { totalNodes: 5, byLevel: { scene: 5 }, avgTasteScore: 0.7 }; }
    async pruneStale() { return 0; }
  }
  return { ATLASInfiniteMemory: MockATLASInfiniteMemory };
});

// Workflow engine adapter dependencies
vi.mock('../../workflow-engine/ralph-visual-engine.js', () => {
  class MockRalphVisualWorkflowEngine {
    async startWorkflow() { return undefined; }
    getStats() { return { totalNodes: 0, completedNodes: 0, failedNodes: 0, avgExecutionTimeMs: 0, totalExecutionTimeMs: 0 }; }
    getWorkflow() { return null; }
    dispose() {}
    createCheckpoint() {}
  }
  class MockWorkflowEngineError extends Error {}
  return { RalphVisualWorkflowEngine: MockRalphVisualWorkflowEngine, WorkflowEngineError: MockWorkflowEngineError };
});

vi.mock('../../workflow-engine/ralph-loop-visual-adapter.js', () => {
  class MockRalphLoopVisualAdapter {
    convertPRDToWorkflow() {
      return { id: 'wf-1', nodes: [], edges: [], metadata: {} };
    }
  }
  return { RalphLoopVisualAdapter: MockRalphLoopVisualAdapter };
});

// Observability adapter dependencies
vi.mock('../../observability/cinematic-core.js', () => {
  class MockCinematicObservability {}
  return {
    CinematicObservability: MockCinematicObservability,
    createCinematicObservability: vi.fn().mockReturnValue({
      recordSpan: vi.fn().mockReturnValue('span-001'),
      endSpan: vi.fn(),
      getSpan: vi.fn().mockReturnValue(null),
      getStats: vi.fn().mockReturnValue({
        totalSpans: 2,
        completedSpans: 1,
        failedSpans: 0,
        remediationCount: 0,
      }),
      getTraceTree: vi.fn().mockReturnValue([]),
      getHierarchicalTrace: vi.fn().mockReturnValue([]),
    }),
    resetCinematicObservability: vi.fn(),
  };
});

vi.mock('../../observability/braintrust-adapter.js', () => {
  class MockBraintrustAdapter {}
  return {
    BraintrustAdapter: MockBraintrustAdapter,
    createBraintrustAdapter: vi.fn(),
    resetBraintrustAdapter: vi.fn(),
  };
});

vi.mock('../../observability/langsmith-bridge.js', () => {
  class MockLangSmithBridge {}
  return {
    LangSmithBridge: MockLangSmithBridge,
    createLangSmithBridge: vi.fn(),
    resetLangSmithBridge: vi.fn(),
  };
});

// Collaboration adapter dependencies
vi.mock('../../collaboration/crdt-core.js', () => {
  class MockRealTimeCRDTOrchestrator {}
  return {
    RealTimeCRDTOrchestrator: MockRealTimeCRDTOrchestrator,
    createCRDTOrchestrator: vi.fn().mockReturnValue({
      createDocument: vi.fn().mockReturnValue({
        id: 'doc-1',
        type: 'code',
        version: 1,
        content: new Uint8Array(),
        conflictCount: 0,
        participants: [],
        lastModified: new Date().toISOString(),
      }),
      joinSession: vi.fn().mockResolvedValue(undefined),
      applyChange: vi.fn().mockResolvedValue(undefined),
      getChanges: vi.fn().mockReturnValue([]),
    }),
  };
});

// Perplexity adapter dependencies
vi.mock('../../tools/perplexity/perplexity-agent.js', () => {
  class MockPerplexityAgent {}
  return {
    PerplexityAgent: MockPerplexityAgent,
    createPerplexityAgent: vi.fn().mockReturnValue({
      research: vi.fn().mockResolvedValue({
        queryId: 'q-1',
        novaRelevanceScore: 85,
        keyFindings: ['finding1'],
        sources: [{ url: 'https://example.com', title: 'Example' }],
        tags: ['ai'],
      }),
    }),
  };
});

// Models adapter dependencies
vi.mock('../../models/ai-model-vault.js', () => {
  class MockAIModelVault {}
  const mockModel = {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    family: 'gpt-4',
    version: '2024-05',
    capabilities: { code: 90, reasoning: 85, multimodal: 70, speed: 80, cost: 60, localAvailable: false, quantizations: [] as string[] },
    contextWindow: 128000,
    pricing: { inputPerMToken: 5, outputPerMToken: 15 },
    benchmarks: {} as Record<string, number>,
    lastUpdated: '2024-05-01',
  };
  return {
    AIModelVault: MockAIModelVault,
    getAIModelVault: vi.fn().mockReturnValue({
      listModels: vi.fn().mockReturnValue([]),
      syncFromProvider: vi.fn().mockResolvedValue({ added: 0, updated: 0 }),
      semanticSelect: vi.fn().mockResolvedValue({
        agentId: 'EARTH',
        taskType: 'code-generation',
        selectedModel: mockModel,
        confidence: 0.92,
        reasoning: 'Best model for code generation',
        alternatives: [],
      }),
      getModel: vi.fn().mockReturnValue(mockModel),
    }),
  };
});

vi.mock('../../models/model-router.js', () => {
  class MockModelRouter {
    updateTasteProfile() {}
  }
  return { ModelRouter: MockModelRouter };
});

// ============================================================================
// Adapter imports (after mocks)
// ============================================================================

import { createModelRoutingLifecycleHooks, resetBuildState as resetModelRoutingState } from '../../model-routing/lifecycle-adapter.js';
import { createInfiniteMemoryLifecycleHooks, initializeInfiniteMemoryForBuild, resetBuildState as resetAtlasState } from '../../atlas/lifecycle-adapter.js';
import { createWorkflowEngineLifecycleHooks, resetBuildState as resetWorkflowState } from '../../workflow-engine/lifecycle-adapter.js';
import { createCinematicObservabilityLifecycleHooks, resetBuildState as resetObservabilityState } from '../../observability/lifecycle-adapter.js';
import { createCRDTLifecycleHooks, resetBuildState as resetCollaborationState } from '../../collaboration/lifecycle-adapter.js';
import { createPerplexityLifecycleHooks, resetBuildState as resetPerplexityState } from '../../tools/perplexity/lifecycle-adapter.js';
import { createAIModelDatabaseLifecycleHooks, resetBuildState as resetModelsState } from '../../models/lifecycle-adapter.js';

// ============================================================================
// Test Fixtures
// ============================================================================

function makeBuildContext() {
  return {
    buildId: 'build-test-001',
    prdId: 'prd-001',
    prdName: 'Test PRD',
    startedAt: new Date().toISOString(),
    options: {} as Record<string, unknown>,
  };
}

function makeTaskContext() {
  return {
    taskId: 'task-001',
    title: 'Research and implement feature',
    agentName: 'EARTH',
    dependencies: [],
  };
}

function makeTaskResult() {
  return {
    taskId: 'task-001',
    agentName: 'EARTH',
    success: true,
    output: 'Task completed successfully with comprehensive output that exceeds the minimum threshold.',
    durationMs: 1500,
    aceScore: 0.88,
  };
}

// ============================================================================
// Category 1: Model Routing Adapter — model:selected emission
// ============================================================================

describe('Model Routing Adapter → model:selected', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetGlobalEventBus();
    resetModelRoutingState();
  });

  it('emits model:selected when onBeforeTask routes a task', async () => {
    const bus = getGlobalEventBus();
    const received: ModelSelectedEvent[] = [];
    bus.on('model:selected', (payload) => { received.push(payload); }, 'test');

    const hooks = createModelRoutingLifecycleHooks({ enabled: true });
    await hooks.onBeforeBuild!(makeBuildContext());
    await hooks.onBeforeTask!(makeTaskContext());

    // Allow async emit to settle
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(received.length).toBe(1);
    expect(received[0]!.taskId).toBe('task-001');
    expect(received[0]!.agentName).toBe('EARTH');
  });

  it('payload contains modelId and modelName', async () => {
    const bus = getGlobalEventBus();
    const received: ModelSelectedEvent[] = [];
    bus.on('model:selected', (payload) => { received.push(payload); }, 'test');

    const hooks = createModelRoutingLifecycleHooks({ enabled: true });
    await hooks.onBeforeBuild!(makeBuildContext());
    await hooks.onBeforeTask!(makeTaskContext());
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(received[0]!.modelId).toBe('gpt-4o');
    expect(received[0]!.modelName).toBe('gpt-4o');
  });

  it('payload contains routingReason', async () => {
    const bus = getGlobalEventBus();
    const received: ModelSelectedEvent[] = [];
    bus.on('model:selected', (payload) => { received.push(payload); }, 'test');

    const hooks = createModelRoutingLifecycleHooks({ enabled: true });
    await hooks.onBeforeBuild!(makeBuildContext());
    await hooks.onBeforeTask!(makeTaskContext());
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(received[0]!.routingReason).toContain('confidence=');
  });

  it('does not emit when adapter is disabled', async () => {
    const bus = getGlobalEventBus();
    const received: ModelSelectedEvent[] = [];
    bus.on('model:selected', (payload) => { received.push(payload); }, 'test');

    const hooks = createModelRoutingLifecycleHooks({ enabled: false });
    await hooks.onBeforeTask!(makeTaskContext());
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(received.length).toBe(0);
  });
});

// ============================================================================
// Category 2: Atlas Adapter — memory:stored emission
// ============================================================================

describe('Atlas Adapter → memory:stored', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetGlobalEventBus();
    resetAtlasState();
  });

  it('emits memory:stored when onAfterTask stores a memory node', async () => {
    const bus = getGlobalEventBus();
    const received: MemoryStoredEvent[] = [];
    bus.on('memory:stored', (payload) => { received.push(payload); }, 'test');

    await initializeInfiniteMemoryForBuild('build-test-001', { enabled: true });
    const hooks = createInfiniteMemoryLifecycleHooks({ enabled: true });
    await hooks.onAfterTask!(makeTaskResult());
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(received.length).toBe(1);
    expect(received[0]!.taskId).toBe('task-001');
  });

  it('payload contains nodeId and level', async () => {
    const bus = getGlobalEventBus();
    const received: MemoryStoredEvent[] = [];
    bus.on('memory:stored', (payload) => { received.push(payload); }, 'test');

    await initializeInfiniteMemoryForBuild('build-test-001', { enabled: true });
    const hooks = createInfiniteMemoryLifecycleHooks({ enabled: true });
    await hooks.onAfterTask!(makeTaskResult());
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(received[0]!.nodeId).toBe('node-abc-123');
    expect(received[0]!.level).toBe('scene');
  });

  it('payload contains agentName and tasteScore', async () => {
    const bus = getGlobalEventBus();
    const received: MemoryStoredEvent[] = [];
    bus.on('memory:stored', (payload) => { received.push(payload); }, 'test');

    await initializeInfiniteMemoryForBuild('build-test-001', { enabled: true });
    const hooks = createInfiniteMemoryLifecycleHooks({ enabled: true });
    await hooks.onAfterTask!(makeTaskResult());
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(received[0]!.agentName).toBe('EARTH');
    expect(typeof received[0]!.tasteScore).toBe('number');
  });
});

// ============================================================================
// Category 3: Workflow Engine Adapter — workflow:transitioned emission
// ============================================================================

describe('Workflow Engine Adapter → workflow:transitioned', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetGlobalEventBus();
    resetWorkflowState();
  });

  it('emits workflow:transitioned when onAfterTask processes a result', async () => {
    const bus = getGlobalEventBus();
    const received: WorkflowTransitionedEvent[] = [];
    bus.on('workflow:transitioned', (payload) => { received.push(payload); }, 'test');

    const hooks = createWorkflowEngineLifecycleHooks();
    await hooks.onBeforeBuild!(makeBuildContext());
    await hooks.onAfterTask!(makeTaskResult());
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(received.length).toBe(1);
    expect(received[0]!.taskId).toBe('task-001');
  });

  it('payload contains fromStatus and toStatus', async () => {
    const bus = getGlobalEventBus();
    const received: WorkflowTransitionedEvent[] = [];
    bus.on('workflow:transitioned', (payload) => { received.push(payload); }, 'test');

    const hooks = createWorkflowEngineLifecycleHooks();
    await hooks.onBeforeBuild!(makeBuildContext());
    await hooks.onAfterTask!(makeTaskResult());
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(received[0]!.fromStatus).toBe('pending');
    expect(received[0]!.toStatus).toBe('completed');
  });

  it('payload contains nodeId matching taskId', async () => {
    const bus = getGlobalEventBus();
    const received: WorkflowTransitionedEvent[] = [];
    bus.on('workflow:transitioned', (payload) => { received.push(payload); }, 'test');

    const hooks = createWorkflowEngineLifecycleHooks();
    await hooks.onBeforeBuild!(makeBuildContext());
    await hooks.onAfterTask!(makeTaskResult());
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(received[0]!.nodeId).toBe('task-001');
  });
});

// ============================================================================
// Category 4: Observability Adapter — span:created emission
// ============================================================================

describe('Observability Adapter → span:created', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetGlobalEventBus();
    resetObservabilityState();
  });

  it('emits span:created when onBeforeTask creates a span', async () => {
    const bus = getGlobalEventBus();
    const received: SpanCreatedEvent[] = [];
    bus.on('span:created', (payload) => { received.push(payload); }, 'test');

    const hooks = createCinematicObservabilityLifecycleHooks({ enabled: true });
    await hooks.onBeforeBuild!(makeBuildContext());
    await hooks.onBeforeTask!(makeTaskContext());
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(received.length).toBe(1);
    expect(received[0]!.spanId).toBe('span-001');
  });

  it('payload contains parentSpanId and operationName', async () => {
    const bus = getGlobalEventBus();
    const received: SpanCreatedEvent[] = [];
    bus.on('span:created', (payload) => { received.push(payload); }, 'test');

    const hooks = createCinematicObservabilityLifecycleHooks({ enabled: true });
    await hooks.onBeforeBuild!(makeBuildContext());
    await hooks.onBeforeTask!(makeTaskContext());
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(received[0]!.parentSpanId).toBe('span-001');
    expect(received[0]!.operationName).toBe('Research and implement feature');
  });

  it('payload contains moduleName set to observability', async () => {
    const bus = getGlobalEventBus();
    const received: SpanCreatedEvent[] = [];
    bus.on('span:created', (payload) => { received.push(payload); }, 'test');

    const hooks = createCinematicObservabilityLifecycleHooks({ enabled: true });
    await hooks.onBeforeBuild!(makeBuildContext());
    await hooks.onBeforeTask!(makeTaskContext());
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(received[0]!.moduleName).toBe('observability');
  });
});

// ============================================================================
// Category 5: Collaboration Adapter — collaboration:changed emission
// ============================================================================

describe('Collaboration Adapter → collaboration:changed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetGlobalEventBus();
    resetCollaborationState();
  });

  it('emits collaboration:changed when onAfterTask merges a change', async () => {
    const bus = getGlobalEventBus();
    const received: CollaborationChangedEvent[] = [];
    bus.on('collaboration:changed', (payload) => { received.push(payload); }, 'test');

    const hooks = createCRDTLifecycleHooks({ enabled: true });
    await hooks.onBeforeBuild!(makeBuildContext());
    await hooks.onAfterTask!(makeTaskResult());
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(received.length).toBe(1);
    expect(received[0]!.changeType).toBe('merge');
  });

  it('payload contains sessionId and participantCount', async () => {
    const bus = getGlobalEventBus();
    const received: CollaborationChangedEvent[] = [];
    bus.on('collaboration:changed', (payload) => { received.push(payload); }, 'test');

    const hooks = createCRDTLifecycleHooks({ enabled: true });
    await hooks.onBeforeBuild!(makeBuildContext());
    await hooks.onAfterTask!(makeTaskResult());
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(received[0]!.sessionId).toBe('doc-1');
    expect(typeof received[0]!.participantCount).toBe('number');
  });

  it('payload contains documentVersion', async () => {
    const bus = getGlobalEventBus();
    const received: CollaborationChangedEvent[] = [];
    bus.on('collaboration:changed', (payload) => { received.push(payload); }, 'test');

    const hooks = createCRDTLifecycleHooks({ enabled: true });
    await hooks.onBeforeBuild!(makeBuildContext());
    await hooks.onAfterTask!(makeTaskResult());
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(typeof received[0]!.documentVersion).toBe('number');
  });
});

// ============================================================================
// Category 6: Perplexity Adapter — research:completed emission
// ============================================================================

describe('Perplexity Adapter → research:completed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetGlobalEventBus();
    resetPerplexityState();
  });

  it('emits research:completed when research was performed for a task', async () => {
    const bus = getGlobalEventBus();
    const received: ResearchCompletedEvent[] = [];
    bus.on('research:completed', (payload) => { received.push(payload); }, 'test');

    const hooks = createPerplexityLifecycleHooks({ enabled: true, enableLogging: false });
    // onBeforeTask triggers research for "Research and implement feature" (contains "research" keyword)
    await hooks.onBeforeTask!(makeTaskContext());
    await hooks.onAfterTask!(makeTaskResult());
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(received.length).toBe(1);
    expect(received[0]!.taskId).toBe('task-001');
  });

  it('payload contains queryCount and relevanceScore', async () => {
    const bus = getGlobalEventBus();
    const received: ResearchCompletedEvent[] = [];
    bus.on('research:completed', (payload) => { received.push(payload); }, 'test');

    const hooks = createPerplexityLifecycleHooks({ enabled: true, enableLogging: false });
    await hooks.onBeforeTask!(makeTaskContext());
    await hooks.onAfterTask!(makeTaskResult());
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(typeof received[0]!.queryCount).toBe('number');
    expect(received[0]!.relevanceScore).toBe(85);
  });

  it('does not emit when no research was performed', async () => {
    const bus = getGlobalEventBus();
    const received: ResearchCompletedEvent[] = [];
    bus.on('research:completed', (payload) => { received.push(payload); }, 'test');

    const hooks = createPerplexityLifecycleHooks({ enabled: true, enableLogging: false });
    // Task title without research keywords
    await hooks.onBeforeTask!({
      taskId: 'task-002',
      title: 'Build UI component',
      agentName: 'MARS',
      dependencies: [],
    });
    await hooks.onAfterTask!({
      taskId: 'task-002',
      agentName: 'MARS',
      success: true,
      durationMs: 500,
    });
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(received.length).toBe(0);
  });
});

// ============================================================================
// Category 7: Models Adapter — model:selected emission
// ============================================================================

describe('Models Adapter → model:selected', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetGlobalEventBus();
    resetModelsState();
  });

  it('emits model:selected when onBeforeTask selects a model', async () => {
    const bus = getGlobalEventBus();
    const received: ModelSelectedEvent[] = [];
    bus.on('model:selected', (payload) => { received.push(payload); }, 'test');

    const hooks = createAIModelDatabaseLifecycleHooks({});
    await hooks.onBeforeBuild!(makeBuildContext());
    await hooks.onBeforeTask!(makeTaskContext());
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(received.length).toBe(1);
    expect(received[0]!.taskId).toBe('task-001');
  });

  it('payload contains modelId and modelName from vault', async () => {
    const bus = getGlobalEventBus();
    const received: ModelSelectedEvent[] = [];
    bus.on('model:selected', (payload) => { received.push(payload); }, 'test');

    const hooks = createAIModelDatabaseLifecycleHooks({});
    await hooks.onBeforeBuild!(makeBuildContext());
    await hooks.onBeforeTask!(makeTaskContext());
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(received[0]!.modelId).toBe('gpt-4o');
    expect(received[0]!.modelName).toBe('GPT-4o');
  });

  it('payload contains routingReason from semantic select', async () => {
    const bus = getGlobalEventBus();
    const received: ModelSelectedEvent[] = [];
    bus.on('model:selected', (payload) => { received.push(payload); }, 'test');

    const hooks = createAIModelDatabaseLifecycleHooks({});
    await hooks.onBeforeBuild!(makeBuildContext());
    await hooks.onBeforeTask!(makeTaskContext());
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(received[0]!.routingReason).toBe('Best model for code generation');
  });
});

// ============================================================================
// Category 8: Cross-Module Event Flows
// ============================================================================

describe('Cross-Module Event Flows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetGlobalEventBus();
    resetModelRoutingState();
    resetObservabilityState();
    resetAtlasState();
  });

  it('model routing emit is received by observability subscriber', async () => {
    const bus = getGlobalEventBus();
    const observabilityReceived: ModelSelectedEvent[] = [];
    bus.on('model:selected', (payload) => {
      observabilityReceived.push(payload);
    }, 'observability');

    const routingHooks = createModelRoutingLifecycleHooks({ enabled: true });
    await routingHooks.onBeforeBuild!(makeBuildContext());
    await routingHooks.onBeforeTask!(makeTaskContext());
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(observabilityReceived.length).toBe(1);
    expect(observabilityReceived[0]!.agentName).toBe('EARTH');
  });

  it('multiple adapters emit different events on same bus', async () => {
    const bus = getGlobalEventBus();
    const allEvents: Array<{ type: string }> = [];
    bus.on('model:selected', () => { allEvents.push({ type: 'model:selected' }); }, 'test');
    bus.on('span:created', () => { allEvents.push({ type: 'span:created' }); }, 'test');

    // Model routing adapter
    const routingHooks = createModelRoutingLifecycleHooks({ enabled: true });
    await routingHooks.onBeforeBuild!(makeBuildContext());
    await routingHooks.onBeforeTask!(makeTaskContext());

    // Observability adapter
    const obsHooks = createCinematicObservabilityLifecycleHooks({ enabled: true });
    await obsHooks.onBeforeBuild!(makeBuildContext());
    await obsHooks.onBeforeTask!(makeTaskContext());

    await new Promise(resolve => setTimeout(resolve, 10));

    expect(allEvents.some(e => e.type === 'model:selected')).toBe(true);
    expect(allEvents.some(e => e.type === 'span:created')).toBe(true);
  });

  it('event history records events from all adapters', async () => {
    const bus = getGlobalEventBus();

    // Model routing
    const routingHooks = createModelRoutingLifecycleHooks({ enabled: true });
    await routingHooks.onBeforeBuild!(makeBuildContext());
    await routingHooks.onBeforeTask!(makeTaskContext());

    // Observability
    const obsHooks = createCinematicObservabilityLifecycleHooks({ enabled: true });
    await obsHooks.onBeforeBuild!(makeBuildContext());
    await obsHooks.onBeforeTask!(makeTaskContext());

    await new Promise(resolve => setTimeout(resolve, 10));

    const history = bus.getHistory();
    const eventNames = history.map(e => e.eventName);
    expect(eventNames).toContain('model:selected');
    expect(eventNames).toContain('span:created');
  });
});

// ============================================================================
// Category 9: Error Resilience
// ============================================================================

describe('Error Resilience — event bus failures do not crash adapters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetGlobalEventBus();
    resetModelRoutingState();
    resetObservabilityState();
    resetAtlasState();
    resetWorkflowState();
    resetCollaborationState();
    resetPerplexityState();
    resetModelsState();
  });

  it('model routing adapter survives throwing event handler', async () => {
    const bus = getGlobalEventBus();
    bus.on('model:selected', () => { throw new Error('handler explosion'); }, 'bad-handler');

    const hooks = createModelRoutingLifecycleHooks({ enabled: true });
    await hooks.onBeforeBuild!(makeBuildContext());

    // Should not throw
    await expect(hooks.onBeforeTask!(makeTaskContext())).resolves.toBeUndefined();
  });

  it('atlas adapter survives throwing event handler', async () => {
    const bus = getGlobalEventBus();
    bus.on('memory:stored', () => { throw new Error('handler explosion'); }, 'bad-handler');

    await initializeInfiniteMemoryForBuild('build-test-001', { enabled: true });
    const hooks = createInfiniteMemoryLifecycleHooks({ enabled: true });

    await expect(hooks.onAfterTask!(makeTaskResult())).resolves.toBeUndefined();
  });

  it('observability adapter survives throwing event handler', async () => {
    const bus = getGlobalEventBus();
    bus.on('span:created', () => { throw new Error('handler explosion'); }, 'bad-handler');

    const hooks = createCinematicObservabilityLifecycleHooks({ enabled: true });
    await hooks.onBeforeBuild!(makeBuildContext());

    await expect(hooks.onBeforeTask!(makeTaskContext())).resolves.toBeUndefined();
  });

  it('collaboration adapter survives throwing event handler', async () => {
    const bus = getGlobalEventBus();
    bus.on('collaboration:changed', () => { throw new Error('handler explosion'); }, 'bad-handler');

    const hooks = createCRDTLifecycleHooks({ enabled: true });
    await hooks.onBeforeBuild!(makeBuildContext());

    await expect(hooks.onAfterTask!(makeTaskResult())).resolves.toBeUndefined();
  });
});

// ============================================================================
// Category 10: Module Source Identification
// ============================================================================

describe('Module Source Identification in Events', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetGlobalEventBus();
    resetObservabilityState();
    resetModelRoutingState();
    resetModelsState();
  });

  it('observability span:created includes moduleName=observability', async () => {
    const bus = getGlobalEventBus();
    const received: SpanCreatedEvent[] = [];
    bus.on('span:created', (payload) => { received.push(payload); }, 'test');

    const hooks = createCinematicObservabilityLifecycleHooks({ enabled: true });
    await hooks.onBeforeBuild!(makeBuildContext());
    await hooks.onBeforeTask!(makeTaskContext());
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(received[0]!.moduleName).toBe('observability');
  });

  it('model routing event includes agentName identifying the source context', async () => {
    const bus = getGlobalEventBus();
    const received: ModelSelectedEvent[] = [];
    bus.on('model:selected', (payload) => { received.push(payload); }, 'test');

    const hooks = createModelRoutingLifecycleHooks({ enabled: true });
    await hooks.onBeforeBuild!(makeBuildContext());
    await hooks.onBeforeTask!(makeTaskContext());
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(received[0]!.agentName).toBe('EARTH');
  });

  it('models adapter event includes agentName identifying the source context', async () => {
    const bus = getGlobalEventBus();
    const received: ModelSelectedEvent[] = [];
    bus.on('model:selected', (payload) => { received.push(payload); }, 'test');

    const hooks = createAIModelDatabaseLifecycleHooks({});
    await hooks.onBeforeBuild!(makeBuildContext());
    await hooks.onBeforeTask!(makeTaskContext());
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(received[0]!.agentName).toBe('EARTH');
  });
});
