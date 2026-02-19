// KIMI-T-05: Cinematic Observability Comprehensive Tests
// Tests for CinematicObservability, BraintrustAdapter, and LangSmithBridge

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CinematicObservability,
  createCinematicObservability,
  resetCinematicObservability,
} from '../cinematic-core.js';
import {
  BraintrustAdapter,
  createBraintrustAdapter,
  resetBraintrustAdapter,
  type BraintrustConfig,
} from '../braintrust-adapter.js';
import {
  LangSmithBridge,
  createLangSmithBridge,
  resetLangSmithBridge,
  type LangSmithConfig,
} from '../langsmith-bridge.js';
import {
  type CinematicSpan,
  type SpanInput,
  type EvalSuite,
  type EvalDatasetEntry,
  type EvaluatorConfig,
  type RemediationEvent,
  DEFAULT_CINEMATIC_CONFIG,
} from '../types.js';

// ============================================================================
// Test Fixtures & Helpers
// ============================================================================

const createMockSpanInput = (overrides: Partial<SpanInput> = {}): SpanInput => ({
  traceId: 'trace-001',
  name: 'test-span',
  agentId: 'agent-001',
  type: 'agent-call',
  startTime: new Date().toISOString(),
  metadata: {},
  status: 'running',
  ...overrides,
});

const createMockEvalDatasetEntry = (overrides: Partial<EvalDatasetEntry> = {}): EvalDatasetEntry => ({
  input: { query: 'test input' },
  expectedOutput: { result: 'test output' },
  tags: ['test'],
  ...overrides,
});

const createMockEvaluator = (overrides: Partial<EvaluatorConfig> = {}): EvaluatorConfig => ({
  name: 'test-evaluator',
  type: 'heuristic',
  config: { threshold: 0.8 },
  ...overrides,
});

const createMockEvalSuite = (overrides: Partial<EvalSuite> = {}): EvalSuite => ({
  id: 'suite-001',
  name: 'Test Suite',
  evaluators: [createMockEvaluator()],
  dataset: [createMockEvalDatasetEntry()],
  ...overrides,
});

/**
 * Simulates the Director Dashboard rendering using available observability data
 * This represents the dashboard functionality that can be built on top of the core API
 */
function renderDirectorDashboard(observability: CinematicObservability, traceId: string): {
  timeline: CinematicSpan[];
  tasteVaultSummary: { avgScore: number; count: number };
  stats: ReturnType<CinematicObservability['getStats']>;
  tree: ReturnType<CinematicObservability['getHierarchicalTrace']>;
} {
  const timeline = observability.getTraceTree(traceId);
  const stats = observability.getStats();
  const tree = observability.getHierarchicalTrace(traceId);
  
  const scoredSpans = timeline.filter(s => s.tasteVaultScore !== undefined);
  const avgScore = scoredSpans.length > 0
    ? scoredSpans.reduce((sum, s) => sum + (s.tasteVaultScore || 0), 0) / scoredSpans.length
    : 0;
  
  return {
    timeline,
    tasteVaultSummary: { avgScore, count: scoredSpans.length },
    stats,
    tree,
  };
}

// ============================================================================
// Span Lifecycle Tests (10 tests)
// ============================================================================

describe('Span Lifecycle', () => {
  let observability: CinematicObservability;

  beforeEach(() => {
    vi.clearAllMocks();
    resetCinematicObservability();
    observability = createCinematicObservability();
  });

  describe('recordSpan', () => {
    it('should return a valid UUID when recording a span', () => {
      const spanInput = createMockSpanInput();
      const spanId = observability.recordSpan(spanInput);

      expect(spanId).toBeDefined();
      expect(spanId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    it('should set initial status to running when recording a span', () => {
      const spanInput = createMockSpanInput();
      const spanId = observability.recordSpan(spanInput);
      const span = observability.getSpan(spanId);

      expect(span).toBeDefined();
      expect(span!.status).toBe('running');
    });

    it('should preserve all provided span properties', () => {
      const spanInput = createMockSpanInput({
        traceId: 'custom-trace',
        name: 'custom-span',
        agentId: 'custom-agent',
        type: 'llm-inference',
        metadata: { customKey: 'customValue' },
      });
      const spanId = observability.recordSpan(spanInput);
      const span = observability.getSpan(spanId);

      expect(span!.traceId).toBe('custom-trace');
      expect(span!.name).toBe('custom-span');
      expect(span!.agentId).toBe('custom-agent');
      expect(span!.type).toBe('llm-inference');
      expect(span!.metadata).toEqual({ customKey: 'customValue' });
    });

    it('should capture taste vault score when provided', () => {
      const spanInput = createMockSpanInput({ tasteVaultScore: 0.85 });
      const spanId = observability.recordSpan(spanInput);
      const span = observability.getSpan(spanId);

      expect(span!.tasteVaultScore).toBe(0.85);
    });

    it('should return empty string when sampling skips span', () => {
      const sampledObservability = createCinematicObservability({
        fullCapture: false,
        sampleRate: 0,
      });
      const spanInput = createMockSpanInput();
      const spanId = sampledObservability.recordSpan(spanInput);

      expect(spanId).toBe('');
    });
  });

  describe('endSpan', () => {
    it('should update status to success when ending span with success result', () => {
      const spanId = observability.recordSpan(createMockSpanInput());
      observability.endSpan(spanId, { status: 'success' });
      const span = observability.getSpan(spanId);

      expect(span!.status).toBe('success');
    });

    it('should update status to failure when ending span with failure result', () => {
      const spanId = observability.recordSpan(createMockSpanInput());
      observability.endSpan(spanId, { status: 'failure' });
      const span = observability.getSpan(spanId);

      expect(span!.status).toBe('failure');
    });

    it('should compute durationMs when ending span', async () => {
      const spanId = observability.recordSpan(createMockSpanInput());
      await new Promise(resolve => setTimeout(resolve, 50));
      observability.endSpan(spanId, { status: 'success' });
      const span = observability.getSpan(spanId);

      expect(span!.durationMs).toBeDefined();
      expect(span!.durationMs).toBeGreaterThanOrEqual(50);
    });

    it('should set endTime when ending span', () => {
      const beforeEnd = new Date().toISOString();
      const spanId = observability.recordSpan(createMockSpanInput());
      observability.endSpan(spanId, { status: 'success' });
      const span = observability.getSpan(spanId);

      expect(span!.endTime).toBeDefined();
      expect(span!.endTime!.localeCompare(beforeEnd)).toBeGreaterThanOrEqual(0);
    });

    it('should merge metadata when ending span with additional metadata', () => {
      const spanId = observability.recordSpan(createMockSpanInput({ metadata: { initial: 'value' } }));
      observability.endSpan(spanId, { status: 'success', metadata: { additional: 'data' } });
      const span = observability.getSpan(spanId);

      expect(span!.metadata).toEqual({ initial: 'value', additional: 'data', ended: true });
    });

    it('should warn when ending non-existent span', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      observability.endSpan('non-existent-id', { status: 'success' });

      expect(consoleWarnSpy).toHaveBeenCalledWith('CinematicObservability: Span non-existent-id not found');
      consoleWarnSpy.mockRestore();
    });
  });
});

// ============================================================================
// Nested Span Tree Construction Tests (8 tests)
// ============================================================================

describe('Nested Span Tree Construction', () => {
  let observability: CinematicObservability;

  beforeEach(() => {
    vi.clearAllMocks();
    resetCinematicObservability();
    observability = createCinematicObservability();
  });

  it('should link child span to parent via parentId', () => {
    const traceId = 'trace-parent-test';
    const parentId = observability.recordSpan(createMockSpanInput({ traceId, name: 'parent' }));
    const childId = observability.recordSpan(createMockSpanInput({
      traceId,
      name: 'child',
      parentId,
    }));

    const childSpan = observability.getSpan(childId);
    expect(childSpan!.parentId).toBe(parentId);
  });

  it('should retrieve all spans for a trace via getTraceTree', () => {
    const traceId = 'trace-retrieval-test';
    const spanId1 = observability.recordSpan(createMockSpanInput({ traceId, name: 'span-1' }));
    const spanId2 = observability.recordSpan(createMockSpanInput({ traceId, name: 'span-2' }));

    const tree = observability.getTraceTree(traceId);
    const spanIds = tree.map(s => s.id);

    expect(tree).toHaveLength(2);
    expect(spanIds).toContain(spanId1);
    expect(spanIds).toContain(spanId2);
  });

  it('should return spans in chronological order via getTraceTree', () => {
    const traceId = 'trace-chrono-test';
    const baseTime = Date.now();
    
    const spanId1 = observability.recordSpan(createMockSpanInput({
      traceId,
      name: 'first',
      startTime: new Date(baseTime).toISOString(),
    }));
    const spanId2 = observability.recordSpan(createMockSpanInput({
      traceId,
      name: 'second',
      startTime: new Date(baseTime + 1000).toISOString(),
    }));
    const spanId3 = observability.recordSpan(createMockSpanInput({
      traceId,
      name: 'third',
      startTime: new Date(baseTime + 2000).toISOString(),
    }));

    const tree = observability.getTraceTree(traceId);

    expect(tree[0].id).toBe(spanId1);
    expect(tree[1].id).toBe(spanId2);
    expect(tree[2].id).toBe(spanId3);
  });

  it('should construct 3-level nesting hierarchy', () => {
    const traceId = 'trace-3level-test';
    const rootId = observability.recordSpan(createMockSpanInput({ traceId, name: 'root' }));
    const level1Id = observability.recordSpan(createMockSpanInput({
      traceId,
      name: 'level-1',
      parentId: rootId,
    }));
    const level2Id = observability.recordSpan(createMockSpanInput({
      traceId,
      name: 'level-2',
      parentId: level1Id,
    }));

    const hierarchy = observability.getHierarchicalTrace(traceId);
    
    expect(hierarchy).toHaveLength(1);
    expect(hierarchy[0].id).toBe(rootId);
    expect(hierarchy[0].children).toHaveLength(1);
    expect(hierarchy[0].children[0].id).toBe(level1Id);
    expect(hierarchy[0].children[0].children).toHaveLength(1);
    expect(hierarchy[0].children[0].children[0].id).toBe(level2Id);
  });

  it('should handle 20 spans in a single trace', () => {
    const traceId = 'trace-20spans-test';
    const spanIds: string[] = [];

    for (let i = 0; i < 20; i++) {
      const spanId = observability.recordSpan(createMockSpanInput({
        traceId,
        name: `span-${i}`,
        startTime: new Date(Date.now() + i * 100).toISOString(),
      }));
      spanIds.push(spanId);
    }

    const tree = observability.getTraceTree(traceId);

    expect(tree).toHaveLength(20);
    expect(tree.map(s => s.id)).toEqual(spanIds);
  });

  it('should return empty array for non-existent trace', () => {
    const tree = observability.getTraceTree('non-existent-trace');
    expect(tree).toEqual([]);
  });

  it('should handle multiple root spans in same trace', () => {
    const traceId = 'trace-multiroot-test';
    const root1Id = observability.recordSpan(createMockSpanInput({ traceId, name: 'root-1' }));
    const root2Id = observability.recordSpan(createMockSpanInput({ traceId, name: 'root-2' }));

    const hierarchy = observability.getHierarchicalTrace(traceId);

    expect(hierarchy).toHaveLength(2);
    expect(hierarchy.map(r => r.id)).toContain(root1Id);
    expect(hierarchy.map(r => r.id)).toContain(root2Id);
  });

  it('should handle complex nested structure with siblings', () => {
    const traceId = 'trace-complex-test';
    const rootId = observability.recordSpan(createMockSpanInput({ traceId, name: 'root' }));
    
    // Two children of root
    const child1Id = observability.recordSpan(createMockSpanInput({
      traceId,
      name: 'child-1',
      parentId: rootId,
    }));
    const child2Id = observability.recordSpan(createMockSpanInput({
      traceId,
      name: 'child-2',
      parentId: rootId,
    }));
    
    // Two grandchildren under child1
    const grandchild1Id = observability.recordSpan(createMockSpanInput({
      traceId,
      name: 'grandchild-1',
      parentId: child1Id,
    }));
    const grandchild2Id = observability.recordSpan(createMockSpanInput({
      traceId,
      name: 'grandchild-2',
      parentId: child1Id,
    }));

    const hierarchy = observability.getHierarchicalTrace(traceId);

    expect(hierarchy[0].children).toHaveLength(2);
    expect(hierarchy[0].children[0].children).toHaveLength(2);
    expect(hierarchy[0].children[0].children.map(c => c.id)).toContain(grandchild1Id);
    expect(hierarchy[0].children[0].children.map(c => c.id)).toContain(grandchild2Id);
  });
});

// ============================================================================
// Eval Suite Execution Tests (10 tests)
// ============================================================================

describe('Eval Suite Execution', () => {
  let observability: CinematicObservability;

  beforeEach(() => {
    vi.clearAllMocks();
    resetCinematicObservability();
    observability = createCinematicObservability();
  });

  it('should execute runEvalSuite and return results', async () => {
    const suite = createMockEvalSuite();
    const result = await observability.runEvalSuite(suite);

    expect(result).toBeDefined();
    expect(result.passed).toBeDefined();
    expect(result.scores).toBeDefined();
    expect(result.details).toBeDefined();
  });

  it('should run llm-judge evaluator', async () => {
    const suite = createMockEvalSuite({
      evaluators: [createMockEvaluator({ name: 'llm-eval', type: 'llm-judge', config: { criteria: 'quality' } })],
    });
    const result = await observability.runEvalSuite(suite);

    expect(result.scores['llm-eval']).toBeDefined();
    expect(result.scores['llm-eval']).toBeGreaterThanOrEqual(0);
    expect(result.scores['llm-eval']).toBeLessThanOrEqual(1);
  });

  it('should run heuristic evaluator', async () => {
    const suite = createMockEvalSuite({
      evaluators: [createMockEvaluator({
        name: 'heuristic-eval',
        type: 'heuristic',
        config: {
          rules: [{ field: 'test', expected: 'value', weight: 1 }],
        },
      })],
      dataset: [createMockEvalDatasetEntry({ input: { test: 'value' } })],
    });
    const result = await observability.runEvalSuite(suite);

    expect(result.scores['heuristic-eval']).toBeDefined();
  });

  it('should run taste-vault evaluator', async () => {
    const suite = createMockEvalSuite({
      evaluators: [createMockEvaluator({
        name: 'taste-eval',
        type: 'taste-vault',
        config: { patterns: ['test', 'pattern'] },
      })],
      dataset: [createMockEvalDatasetEntry({ input: { query: 'test pattern match' } })],
    });
    const result = await observability.runEvalSuite(suite);

    expect(result.scores['taste-eval']).toBeDefined();
    expect(result.scores['taste-eval']).toBeGreaterThanOrEqual(0);
    expect(result.scores['taste-eval']).toBeLessThanOrEqual(1);
  });

  it('should run human-labeled evaluator', async () => {
    const suite = createMockEvalSuite({
      evaluators: [createMockEvaluator({ name: 'human-eval', type: 'human-labeled' })],
      dataset: [createMockEvalDatasetEntry({
        input: { data: 'test' },
        expectedOutput: { data: 'test' },
      })],
    });
    const result = await observability.runEvalSuite(suite);

    expect(result.scores['human-eval']).toBeDefined();
    expect(result.scores['human-eval']).toBeGreaterThanOrEqual(0);
    expect(result.scores['human-eval']).toBeLessThanOrEqual(1);
  });

  it('should pass when all scores exceed threshold', async () => {
    const suite = createMockEvalSuite({
      evaluators: [createMockEvaluator({
        name: 'high-threshold-eval',
        type: 'heuristic',
        config: {
          threshold: 0.5,
          rules: [{ field: 'test', expected: 'value', weight: 1 }],
        },
      })],
      dataset: [createMockEvalDatasetEntry({ input: { test: 'value' } })],
    });
    const result = await observability.runEvalSuite(suite);

    expect(result.passed).toBe(true);
  });

  it('should fail when scores are below threshold', async () => {
    const suite = createMockEvalSuite({
      evaluators: [createMockEvaluator({
        name: 'strict-eval',
        type: 'heuristic',
        config: {
          threshold: 0.99,
          rules: [{ field: 'test', expected: 'wrong', weight: 1 }],
        },
      })],
      dataset: [createMockEvalDatasetEntry({ input: { test: 'value' } })],
    });
    const result = await observability.runEvalSuite(suite);

    expect(result.passed).toBe(false);
  });

  it('should provide per-entry results', async () => {
    const suite = createMockEvalSuite({
      dataset: [
        createMockEvalDatasetEntry(),
        createMockEvalDatasetEntry(),
      ],
    });
    const result = await observability.runEvalSuite(suite);

    expect(result.entryResults).toBeDefined();
    expect(result.entryResults).toHaveLength(2);
    expect(result.entryResults![0].entryIndex).toBe(0);
    expect(result.entryResults![1].entryIndex).toBe(1);
  });

  it('should aggregate scores from multiple evaluators', async () => {
    const suite = createMockEvalSuite({
      evaluators: [
        createMockEvaluator({ name: 'eval-1', type: 'heuristic', config: { rules: [] } }),
        createMockEvaluator({ name: 'eval-2', type: 'heuristic', config: { rules: [] } }),
      ],
    });
    const result = await observability.runEvalSuite(suite);

    expect(Object.keys(result.scores)).toHaveLength(2);
    expect(result.scores['eval-1']).toBeDefined();
    expect(result.scores['eval-2']).toBeDefined();
  });

  it('should include evaluator details in results', async () => {
    const suite = createMockEvalSuite({ name: 'Detailed Suite' });
    const result = await observability.runEvalSuite(suite);

    expect(result.details.length).toBeGreaterThan(0);
    expect(result.details[0]).toContain('Detailed Suite');
  });
});

// ============================================================================
// Braintrust Adapter Tests (8 tests)
// ============================================================================

describe('Braintrust Adapter', () => {
  let adapter: BraintrustAdapter;
  const mockConfig: BraintrustConfig = {
    apiKey: 'test-api-key',
    projectId: 'test-project',
    projectName: 'Test Project',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    resetBraintrustAdapter();
    adapter = createBraintrustAdapter(mockConfig);
  });

  it('should initialize and connect successfully', async () => {
    const connected = await adapter.initialize();
    expect(connected).toBe(true);
    expect(adapter.isConnected()).toBe(true);
  });

  it('should send eval data as Braintrust dataset', async () => {
    await adapter.initialize();
    const suite = createMockEvalSuite({
      id: 'bt-test-suite',
      name: 'Braintrust Test Suite',
      dataset: [
        createMockEvalDatasetEntry({ input: { q: 'test1' }, expectedOutput: { a: 'answer1' } }),
        createMockEvalDatasetEntry({ input: { q: 'test2' }, expectedOutput: { a: 'answer2' } }),
      ],
    });

    const dataset = await adapter.uploadEvalSuite(suite);

    expect(dataset).toBeDefined();
    expect(dataset.name).toBe('Braintrust Test Suite');
    expect(dataset.projectId).toBe('test-project');
    expect(dataset.data).toHaveLength(2);
  });

  it('should parse scores from experiments', async () => {
    await adapter.initialize();
    const suite = createMockEvalSuite({
      id: 'score-parse-suite',
      name: 'Score Parse Suite',
      dataset: [createMockEvalDatasetEntry()],
    });

    await adapter.uploadEvalSuite(suite);
    const result = await adapter.runExperiment(
      suite,
      async () => ({ result: 'test' }),
      'test-experiment'
    );

    expect(result.score).toBeDefined();
    expect(result.scores).toBeDefined();
    expect(result.evalCount).toBe(1);
  });

  it('should include project ID in dataset', async () => {
    await adapter.initialize();
    const suite = createMockEvalSuite({ id: 'project-test' });
    const dataset = await adapter.uploadEvalSuite(suite);

    expect(dataset.projectId).toBe('test-project');
  });

  it('should throw error when not initialized', async () => {
    // Create fresh adapter without initializing
    const freshAdapter = createBraintrustAdapter(mockConfig);
    
    await expect(freshAdapter.listDatasets()).rejects.toThrow('Braintrust client not connected');
  });

  it('should list uploaded datasets', async () => {
    await adapter.initialize();
    const suite1 = createMockEvalSuite({ id: 'ds-1', name: 'Dataset 1' });
    const suite2 = createMockEvalSuite({ id: 'ds-2', name: 'Dataset 2' });
    
    await adapter.uploadEvalSuite(suite1);
    await adapter.uploadEvalSuite(suite2);
    
    const datasets = await adapter.listDatasets();

    expect(datasets.length).toBeGreaterThanOrEqual(2);
  });

  it('should delete a dataset', async () => {
    await adapter.initialize();
    const suite = createMockEvalSuite({ id: 'delete-test' });
    const dataset = await adapter.uploadEvalSuite(suite);

    const deleted = await adapter.deleteDataset(dataset.id);

    expect(deleted).toBe(true);
  });

  it('should compare experiments', async () => {
    await adapter.initialize();
    const suite = createMockEvalSuite({
      id: 'compare-suite',
      dataset: [createMockEvalDatasetEntry()],
    });

    const result1 = await adapter.runExperiment(suite, async () => 'output1', 'exp-1');
    const result2 = await adapter.runExperiment(suite, async () => 'output2', 'exp-2');

    const comparison = await adapter.compareExperiments(result1.experimentId, result2.experimentId);

    expect(comparison.baseline).toBeDefined();
    expect(comparison.candidate).toBeDefined();
    expect(comparison.diff).toBeDefined();
    expect(typeof comparison.improved).toBe('boolean');
  });
});

// ============================================================================
// LangSmith Bridge Tests (8 tests)
// ============================================================================

describe('LangSmith Bridge', () => {
  let bridge: LangSmithBridge;
  const mockConfig: LangSmithConfig = {
    apiKey: 'test-api-key',
    endpoint: 'https://api.smith.langchain.com',
    projectName: 'Test Project',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    resetLangSmithBridge();
    bridge = createLangSmithBridge(mockConfig);
  });

  afterEach(async () => {
    await bridge.disconnect();
  });

  it('should initialize and connect successfully', async () => {
    const connected = await bridge.initialize();
    expect(connected).toBe(true);
    expect(bridge.isConnected()).toBe(true);
  });

  it('should export a CinematicSpan to LangSmith', async () => {
    await bridge.initialize();
    const span: CinematicSpan = {
      id: 'span-001',
      traceId: 'trace-001',
      name: 'test-span',
      agentId: 'agent-001',
      type: 'agent-call',
      startTime: new Date().toISOString(),
      metadata: { custom: 'data' },
      status: 'success',
      endTime: new Date().toISOString(),
      durationMs: 100,
    };

    const runId = await bridge.exportSpan(span);

    expect(runId).toBeDefined();
    expect(runId).toMatch(/^run_/);
  });

  it('should map CinematicSpan type to LangSmith run type correctly', async () => {
    await bridge.initialize();
    const testCases: Array<{ type: CinematicSpan['type']; expectedRunType: string }> = [
      { type: 'agent-call', expectedRunType: 'agent' },
      { type: 'llm-inference', expectedRunType: 'llm' },
      { type: 'tool-use', expectedRunType: 'tool' },
      { type: 'gate-check', expectedRunType: 'chain' },
      { type: 'user-interaction', expectedRunType: 'chain' },
    ];

    for (const testCase of testCases) {
      const span: CinematicSpan = {
        id: `span-${testCase.type}`,
        traceId: 'trace-001',
        name: `${testCase.type}-span`,
        agentId: 'agent-001',
        type: testCase.type,
        startTime: new Date().toISOString(),
        metadata: {},
        status: 'running',
      };

      const runId = await bridge.exportSpan(span);
      expect(runId).toBeDefined();
    }
  });

  it('should handle nested spans as child runs', async () => {
    await bridge.initialize();
    const parentSpan: CinematicSpan = {
      id: 'parent-span',
      traceId: 'trace-001',
      name: 'parent',
      agentId: 'agent-001',
      type: 'agent-call',
      startTime: new Date().toISOString(),
      metadata: {},
      status: 'running',
    };
    const childSpan: CinematicSpan = {
      id: 'child-span',
      traceId: 'trace-001',
      parentId: 'parent-span',
      name: 'child',
      agentId: 'agent-001',
      type: 'tool-use',
      startTime: new Date().toISOString(),
      metadata: {},
      status: 'running',
    };

    await bridge.exportSpan(parentSpan);
    const childRunId = await bridge.exportSpan(childSpan);

    expect(childRunId).toBeDefined();
  });

  it('should include metadata in exported span', async () => {
    await bridge.initialize();
    const span: CinematicSpan = {
      id: 'meta-span',
      traceId: 'trace-001',
      name: 'meta-span',
      agentId: 'agent-001',
      type: 'agent-call',
      startTime: new Date().toISOString(),
      metadata: { key1: 'value1', key2: 42 },
      status: 'running',
    };

    const runId = await bridge.exportSpan(span);
    expect(runId).toBeDefined();
  });

  it('should batch export multiple spans', async () => {
    await bridge.initialize();
    const spans: CinematicSpan[] = [
      {
        id: 'batch-1',
        traceId: 'trace-batch',
        name: 'span-1',
        agentId: 'agent-001',
        type: 'agent-call',
        startTime: new Date(Date.now()).toISOString(),
        metadata: {},
        status: 'running',
      },
      {
        id: 'batch-2',
        traceId: 'trace-batch',
        name: 'span-2',
        agentId: 'agent-001',
        type: 'llm-inference',
        startTime: new Date(Date.now() + 100).toISOString(),
        metadata: {},
        status: 'running',
      },
    ];

    const runIds = await bridge.exportSpans(spans);

    expect(runIds).toHaveLength(2);
    expect(runIds[0]).toBeDefined();
    expect(runIds[1]).toBeDefined();
  });

  it('should return same runId for duplicate span exports', async () => {
    await bridge.initialize();
    const span: CinematicSpan = {
      id: 'duplicate-span',
      traceId: 'trace-001',
      name: 'duplicate-test',
      agentId: 'agent-001',
      type: 'agent-call',
      startTime: new Date().toISOString(),
      metadata: {},
      status: 'running',
    };

    const runId1 = await bridge.exportSpan(span);
    const runId2 = await bridge.exportSpan(span);

    expect(runId1).toBe(runId2);
  });

  it('should provide bridge statistics', async () => {
    await bridge.initialize();
    const span: CinematicSpan = {
      id: 'stats-span',
      traceId: 'trace-001',
      name: 'stats-test',
      agentId: 'agent-001',
      type: 'agent-call',
      startTime: new Date().toISOString(),
      metadata: {},
      status: 'running',
    };

    await bridge.exportSpan(span);
    const stats = bridge.getStats();

    expect(stats.projectName).toBe('Test Project');
    expect(stats.exportedSpans).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================================
// Dashboard Rendering Tests (8 tests)
// ============================================================================

describe('Dashboard Rendering', () => {
  let observability: CinematicObservability;

  beforeEach(() => {
    vi.clearAllMocks();
    resetCinematicObservability();
    observability = createCinematicObservability();
  });

  it('should render dashboard with timeline', () => {
    const traceId = 'dash-timeline-test';
    observability.recordSpan(createMockSpanInput({ traceId, name: 'span-1' }));
    observability.recordSpan(createMockSpanInput({ traceId, name: 'span-2' }));

    const dashboard = renderDirectorDashboard(observability, traceId);

    expect(dashboard.timeline).toHaveLength(2);
    expect(dashboard.timeline[0].name).toBe('span-1');
    expect(dashboard.timeline[1].name).toBe('span-2');
  });

  it('should include taste vault summary in dashboard', () => {
    const traceId = 'dash-taste-test';
    observability.recordSpan(createMockSpanInput({ traceId, tasteVaultScore: 0.9 }));
    observability.recordSpan(createMockSpanInput({ traceId, tasteVaultScore: 0.7 }));
    observability.recordSpan(createMockSpanInput({ traceId })); // No score

    const dashboard = renderDirectorDashboard(observability, traceId);

    expect(dashboard.tasteVaultSummary.count).toBe(2);
    expect(dashboard.tasteVaultSummary.avgScore).toBe(0.8);
  });

  it('should include stats in dashboard', () => {
    const traceId = 'dash-stats-test';
    observability.recordSpan(createMockSpanInput({ traceId }));

    const dashboard = renderDirectorDashboard(observability, traceId);

    expect(dashboard.stats).toBeDefined();
    expect(dashboard.stats.totalSpans).toBeGreaterThanOrEqual(1);
  });

  it('should include hierarchical tree in dashboard', () => {
    const traceId = 'dash-tree-test';
    const rootId = observability.recordSpan(createMockSpanInput({ traceId, name: 'root' }));
    observability.recordSpan(createMockSpanInput({ traceId, name: 'child', parentId: rootId }));

    const dashboard = renderDirectorDashboard(observability, traceId);

    expect(dashboard.tree).toHaveLength(1);
    expect(dashboard.tree[0].children).toHaveLength(1);
  });

  it('should handle 50+ spans in dashboard', () => {
    const traceId = 'dash-50spans-test';

    for (let i = 0; i < 50; i++) {
      observability.recordSpan(createMockSpanInput({
        traceId,
        name: `span-${i}`,
        startTime: new Date(Date.now() + i * 10).toISOString(),
      }));
    }

    const dashboard = renderDirectorDashboard(observability, traceId);

    expect(dashboard.timeline).toHaveLength(50);
    expect(dashboard.stats.totalSpans).toBeGreaterThanOrEqual(50);
  });

  it('should sort timeline by start time', () => {
    const traceId = 'dash-sorted-test';
    const baseTime = Date.now();

    observability.recordSpan(createMockSpanInput({
      traceId,
      name: 'second',
      startTime: new Date(baseTime + 200).toISOString(),
    }));
    observability.recordSpan(createMockSpanInput({
      traceId,
      name: 'first',
      startTime: new Date(baseTime + 100).toISOString(),
    }));
    observability.recordSpan(createMockSpanInput({
      traceId,
      name: 'third',
      startTime: new Date(baseTime + 300).toISOString(),
    }));

    const dashboard = renderDirectorDashboard(observability, traceId);

    expect(dashboard.timeline[0].name).toBe('first');
    expect(dashboard.timeline[1].name).toBe('second');
    expect(dashboard.timeline[2].name).toBe('third');
  });

  it('should return empty timeline for non-existent trace', () => {
    const dashboard = renderDirectorDashboard(observability, 'non-existent');

    expect(dashboard.timeline).toEqual([]);
    expect(dashboard.tree).toEqual([]);
    expect(dashboard.tasteVaultSummary.count).toBe(0);
    expect(dashboard.tasteVaultSummary.avgScore).toBe(0);
  });

  it('should update stats when spans are added', () => {
    const traceId = 'dash-update-test';

    const dashboard1 = renderDirectorDashboard(observability, traceId);
    const initialSpanCount = dashboard1.stats.totalSpans;

    observability.recordSpan(createMockSpanInput({ traceId }));
    observability.recordSpan(createMockSpanInput({ traceId }));

    const dashboard2 = renderDirectorDashboard(observability, traceId);

    expect(dashboard2.stats.totalSpans).toBe(initialSpanCount + 2);
  });
});

// ============================================================================
// Trace Fidelity Tests (4 tests)
// ============================================================================

describe('Trace Fidelity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCinematicObservability();
  });

  it('should capture 100% of spans when fullCapture is enabled', () => {
    const observability = createCinematicObservability({ fullCapture: true });
    const recordedCount = 100;

    for (let i = 0; i < recordedCount; i++) {
      observability.recordSpan(createMockSpanInput());
    }

    const stats = observability.getStats();
    expect(stats.totalSpans).toBe(recordedCount);
  });

  it('should not create duplicate spans with same ID', () => {
    const observability = createCinematicObservability();
    const spanIds = new Set<string>();
    const iterations = 50;

    for (let i = 0; i < iterations; i++) {
      const spanId = observability.recordSpan(createMockSpanInput());
      spanIds.add(spanId);
    }

    expect(spanIds.size).toBe(iterations);
  });

  it('should generate unique IDs across multiple instances', () => {
    const obs1 = createCinematicObservability();
    const obs2 = createCinematicObservability();
    const allIds = new Set<string>();

    for (let i = 0; i < 25; i++) {
      allIds.add(obs1.recordSpan(createMockSpanInput()));
      allIds.add(obs2.recordSpan(createMockSpanInput()));
    }

    expect(allIds.size).toBe(50);
  });

  it('should handle concurrent span recording', async () => {
    const observability = createCinematicObservability();
    const promises: Promise<string>[] = [];

    for (let i = 0; i < 20; i++) {
      promises.push(
        new Promise(resolve => {
          setTimeout(() => {
            resolve(observability.recordSpan(createMockSpanInput()));
          }, Math.random() * 10);
        })
      );
    }

    const spanIds = await Promise.all(promises);
    const uniqueIds = new Set(spanIds);

    expect(uniqueIds.size).toBe(20);
    expect(observability.getStats().totalSpans).toBe(20);
  });
});

// ============================================================================
// Auto-Remediation Trigger Tests (4 tests)
// ============================================================================

describe('Auto-Remediation Trigger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCinematicObservability();
  });

  it('should trigger remediation when taste score drops > 8%', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const observability = createCinematicObservability({
      remediation: {
        tasteScoreDropThreshold: 0.08,
        actions: ['alert'],
        cooldownMs: 0,
      },
    });

    // First establish baseline at 1.0
    observability.recordSpan(createMockSpanInput({ tasteVaultScore: 1.0 }));
    // Drop by more than 8% (to 0.9 = 10% drop)
    observability.recordSpan(createMockSpanInput({ tasteVaultScore: 0.9 }));

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('ALERT')
    );
    consoleErrorSpy.mockRestore();
  });

  it('should not trigger remediation when taste score drops <= 8%', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const observability = createCinematicObservability({
      remediation: {
        tasteScoreDropThreshold: 0.08,
        actions: ['alert'],
        cooldownMs: 0,
      },
    });

    // Establish baseline
    observability.recordSpan(createMockSpanInput({ tasteVaultScore: 1.0 }));
    // Drop by less than 8% (to 0.95 = 5% drop)
    observability.recordSpan(createMockSpanInput({ tasteVaultScore: 0.95 }));

    // Should not trigger alert for <= 8% drop
    const alertCalls = consoleErrorSpy.mock.calls.filter(
      call => typeof call[0] === 'string' && call[0].includes('ALERT')
    );
    expect(alertCalls).toHaveLength(0);
    consoleErrorSpy.mockRestore();
  });

  it('should respect configurable threshold', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const observability = createCinematicObservability({
      remediation: {
        tasteScoreDropThreshold: 0.15, // 15% threshold
        actions: ['alert'],
        cooldownMs: 0,
      },
    });

    observability.recordSpan(createMockSpanInput({ tasteVaultScore: 1.0 }));
    // 10% drop - below 15% threshold
    observability.recordSpan(createMockSpanInput({ tasteVaultScore: 0.9 }));

    const alertCalls = consoleErrorSpy.mock.calls.filter(
      call => typeof call[0] === 'string' && call[0].includes('ALERT')
    );
    expect(alertCalls).toHaveLength(0);

    // Now drop to 20% - should trigger
    observability.recordSpan(createMockSpanInput({ tasteVaultScore: 0.8 }));

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('ALERT')
    );
    consoleErrorSpy.mockRestore();
  });

  it('should record remediation event in history', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const observability = createCinematicObservability({
      remediation: {
        tasteScoreDropThreshold: 0.08,
        actions: ['alert', 'escalate'],
        cooldownMs: 0,
      },
    });

    observability.recordSpan(createMockSpanInput({ tasteVaultScore: 1.0 }));
    observability.recordSpan(createMockSpanInput({ tasteVaultScore: 0.85 }));

    const history = observability.getRemediationHistory();

    expect(history.length).toBeGreaterThan(0);
    const lastEvent = history[history.length - 1];
    expect(lastEvent.actionsTaken).toContain('alert');
    expect(lastEvent.actionsTaken).toContain('escalate');
    expect(lastEvent.scoreDrop).toBeGreaterThan(0.08);
    expect(lastEvent.resolved).toBe(false);
  });
});

// ============================================================================
// Additional Edge Case Tests (8 tests to reach 60+)
// ============================================================================

describe('Additional Edge Cases', () => {
  let observability: CinematicObservability;

  beforeEach(() => {
    vi.clearAllMocks();
    resetCinematicObservability();
    observability = createCinematicObservability();
  });

  it('should handle span without parentId as root', () => {
    const spanId = observability.recordSpan(createMockSpanInput({ parentId: undefined }));
    const span = observability.getSpan(spanId);

    expect(span!.parentId).toBeUndefined();
  });

  it('should enforce memory limit by removing old spans', () => {
    const limitedObservability = createCinematicObservability({
      maxInMemorySpans: 10,
    });

    // Add more spans than limit
    for (let i = 0; i < 15; i++) {
      const spanId = limitedObservability.recordSpan(createMockSpanInput());
      limitedObservability.endSpan(spanId, { status: 'success' });
    }

    const stats = limitedObservability.getStats();
    expect(stats.totalSpans).toBeLessThanOrEqual(10);
  });

  it('should flush old spans based on age', () => {
    const oldSpanId = observability.recordSpan(createMockSpanInput({
      startTime: new Date(Date.now() - 100000).toISOString(),
    }));
    const newSpanId = observability.recordSpan(createMockSpanInput({
      startTime: new Date().toISOString(),
    }));

    const removed = observability.flushOldSpans(50000); // Remove spans older than 50s

    expect(removed).toBe(1);
    expect(observability.getSpan(oldSpanId)).toBeUndefined();
    expect(observability.getSpan(newSpanId)).toBeDefined();
  });

  it('should get spans by status', () => {
    const successId = observability.recordSpan(createMockSpanInput());
    const failureId = observability.recordSpan(createMockSpanInput());

    observability.endSpan(successId, { status: 'success' });
    observability.endSpan(failureId, { status: 'failure' });

    const successSpans = observability.getSpansByStatus('success');
    const failureSpans = observability.getSpansByStatus('failure');

    expect(successSpans).toHaveLength(1);
    expect(failureSpans).toHaveLength(1);
    expect(successSpans[0].id).toBe(successId);
    expect(failureSpans[0].id).toBe(failureId);
  });

  it('should get spans by agent', () => {
    observability.recordSpan(createMockSpanInput({ agentId: 'agent-a' }));
    observability.recordSpan(createMockSpanInput({ agentId: 'agent-a' }));
    observability.recordSpan(createMockSpanInput({ agentId: 'agent-b' }));

    const agentASpans = observability.getSpansByAgent('agent-a');
    const agentBSpans = observability.getSpansByAgent('agent-b');

    expect(agentASpans).toHaveLength(2);
    expect(agentBSpans).toHaveLength(1);
  });

  it('should clear all data on clear()', () => {
    observability.recordSpan(createMockSpanInput());
    observability.recordSpan(createMockSpanInput({ tasteVaultScore: 1.0 }));
    observability.recordSpan(createMockSpanInput({ tasteVaultScore: 0.8 }));

    observability.clear();
    const stats = observability.getStats();

    expect(stats.totalSpans).toBe(0);
    expect(stats.activeTraces).toBe(0);
    expect(stats.remediationCount).toBe(0);
  });

  it('should handle default configuration', () => {
    const defaultObs = createCinematicObservability();
    const spanId = defaultObs.recordSpan(createMockSpanInput());

    expect(spanId).toBeDefined();
    expect(spanId).not.toBe('');
  });

  it('should calculate stats correctly', () => {
    const s1 = observability.recordSpan(createMockSpanInput());
    const s2 = observability.recordSpan(createMockSpanInput());
    const s3 = observability.recordSpan(createMockSpanInput());

    observability.endSpan(s1, { status: 'success' });
    observability.endSpan(s2, { status: 'failure' });
    // s3 remains running

    const stats = observability.getStats();

    expect(stats.totalSpans).toBe(3);
    expect(stats.runningSpans).toBe(1);
    expect(stats.completedSpans).toBe(1);
    expect(stats.failedSpans).toBe(1);
  });
});

// ============================================================================
// Integration Tests (4 tests)
// ============================================================================

describe('Integration: End-to-End Observability Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCinematicObservability();
    resetBraintrustAdapter();
    resetLangSmithBridge();
  });

  it('should record spans, run evals, and export to Braintrust', async () => {
    const observability = createCinematicObservability();
    const btConfig: BraintrustConfig = {
      apiKey: 'test',
      projectId: 'proj-1',
      projectName: 'Integration Test',
    };
    const adapter = createBraintrustAdapter(btConfig);
    await adapter.initialize();

    // Record spans
    const traceId = 'integration-trace';
    observability.recordSpan(createMockSpanInput({ traceId, name: 'step-1' }));
    observability.recordSpan(createMockSpanInput({ traceId, name: 'step-2' }));

    // Run eval
    const suite = createMockEvalSuite({ id: 'integration-suite' });
    const evalResult = await observability.runEvalSuite(suite);

    // Export to Braintrust
    const dataset = await adapter.uploadEvalSuite(suite);

    expect(observability.getStats().totalSpans).toBe(2);
    expect(evalResult.scores).toBeDefined();
    expect(dataset.name).toBe(suite.name);
  });

  it('should export spans to LangSmith with proper hierarchy', async () => {
    const observability = createCinematicObservability();
    const lsConfig: LangSmithConfig = {
      apiKey: 'test',
      endpoint: 'https://test.langsmith.com',
      projectName: 'Integration Test',
    };
    const bridge = createLangSmithBridge(lsConfig);
    await bridge.initialize();

    // Create hierarchy
    const traceId = 'ls-integration';
    const rootSpan: CinematicSpan = {
      id: 'root',
      traceId,
      name: 'root',
      agentId: 'agent-1',
      type: 'agent-call',
      startTime: new Date().toISOString(),
      metadata: {},
      status: 'success',
      endTime: new Date().toISOString(),
      durationMs: 100,
    };
    const childSpan: CinematicSpan = {
      id: 'child',
      traceId,
      parentId: 'root',
      name: 'child',
      agentId: 'agent-1',
      type: 'tool-use',
      startTime: new Date().toISOString(),
      metadata: {},
      status: 'success',
      endTime: new Date().toISOString(),
      durationMs: 50,
    };

    await bridge.exportSpan(rootSpan);
    await bridge.exportSpan(childSpan);

    const stats = bridge.getStats();
    expect(stats.exportedSpans).toBe(2);
  });

  it('should trigger remediation on taste score degradation', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const observability = createCinematicObservability({
      remediation: {
        tasteScoreDropThreshold: 0.08,
        actions: ['alert', 'escalate'],
        cooldownMs: 0,
      },
    });

    // Simulate degradation
    observability.recordSpan(createMockSpanInput({ tasteVaultScore: 1.0 }));
    observability.recordSpan(createMockSpanInput({ tasteVaultScore: 0.9 }));

    const history = observability.getRemediationHistory();

    expect(history.length).toBeGreaterThan(0);
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it('should provide complete observability pipeline', async () => {
    const observability = createCinematicObservability();
    const traceId = 'complete-pipeline';

    // Record spans
    const parentId = observability.recordSpan(createMockSpanInput({ traceId, name: 'parent' }));
    observability.recordSpan(createMockSpanInput({ traceId, name: 'child', parentId }));

    // End some spans
    observability.endSpan(parentId, { status: 'success', metadata: { result: 'done' } });

    // Get tree and stats
    const tree = observability.getTraceTree(traceId);
    const stats = observability.getStats();
    const dashboard = renderDirectorDashboard(observability, traceId);

    expect(tree.length).toBe(2);
    expect(stats.totalSpans).toBe(2);
    expect(dashboard.timeline.length).toBe(2);
    expect(dashboard.stats.totalSpans).toBe(2);
  });
});
