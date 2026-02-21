// Agent Harness Types Tests - Property-based tests for serialization
// Spec: .kiro/specs/agent-harnesses/tasks.md

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  HarnessStateSchema,
  HarnessConfigSchema,
  ExecutionPlanSchema,
  ToolCallRecordSchema,
  serializeHarnessState,
  deserializeHarnessState,
} from './schemas.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Arbitrary Generators for fast-check
// ═══════════════════════════════════════════════════════════════════════════════

const HarnessPriorityArb = fc.constantFrom('low', 'normal', 'high', 'critical');
const HarnessStatusArb = fc.constantFrom(
  'created',
  'starting',
  'running',
  'paused',
  'stopping',
  'stopped',
  'completed',
  'failed'
);
const StepStatusArb = fc.constantFrom(
  'pending',
  'ready',
  'running',
  'completed',
  'failed',
  'blocked'
);

const HarnessConfigArb = fc.record({
  id: fc.string({ minLength: 1 }),
  name: fc.string({ minLength: 1 }),
  agentId: fc.string({ minLength: 1 }),
  task: fc.string({ minLength: 1 }),
  priority: HarnessPriorityArb,
  timeoutMs: fc.integer({ min: 0, max: 10000000 }),
  maxRetries: fc.integer({ min: 0, max: 10 }),
  autonomyLevel: fc.integer({ min: 1, max: 5 }),
  parentId: fc.option(fc.string()),
  maxDepth: fc.integer({ min: 0, max: 5 }),
  depth: fc.integer({ min: 0, max: 5 }),
  allowedTools: fc.array(fc.string()),
  budget: fc.record({
    maxToolCalls: fc.integer({ min: 0 }),
    maxTokens: fc.integer({ min: 0 }),
    maxCost: fc.float({ min: 0 }),
  }),
  checkpointIntervalMs: fc.integer({ min: 1000 }),
  dreamModeEnabled: fc.boolean(),
  overnightEvolutionEnabled: fc.boolean(),
});

const ToolCallRecordArb = fc.record({
  id: fc.string(),
  toolName: fc.string(),
  arguments: fc.dictionary(fc.string(), fc.anything()),
  result: fc.option(fc.anything()),
  error: fc.option(fc.string()),
  timestamp: fc.integer({ min: 0 }),
  durationMs: fc.integer({ min: 0 }),
  retryCount: fc.integer({ min: 0 }),
  cost: fc.float({ min: 0 }),
  success: fc.boolean(),
});

const ExecutionStepArb = fc.record({
  id: fc.string(),
  description: fc.string(),
  agentId: fc.string(),
  status: StepStatusArb,
  dependencies: fc.array(fc.string()),
  isCritical: fc.boolean(),
  estimatedDurationMs: fc.integer({ min: 0 }),
  startedAt: fc.option(fc.integer({ min: 0 })),
  completedAt: fc.option(fc.integer({ min: 0 })),
  output: fc.option(fc.string()),
  error: fc.option(fc.string()),
  toolCalls: fc.array(ToolCallRecordArb),
  subAgentId: fc.option(fc.string()),
});

const ExecutionPlanArb = fc.record({
  id: fc.string(),
  version: fc.integer({ min: 1 }),
  createdAt: fc.integer({ min: 0 }),
  steps: fc.array(ExecutionStepArb),
  status: fc.constantFrom('pending', 'in_progress', 'completed', 'failed'),
});

const HarnessErrorArb = fc.record({
  code: fc.string(),
  message: fc.string(),
  stack: fc.option(fc.string()),
  timestamp: fc.integer({ min: 0 }),
});

const HarnessStateArb = fc.record({
  schemaVersion: fc.constant(1),
  config: HarnessConfigArb,
  status: HarnessStatusArb,
  createdAt: fc.integer({ min: 0 }),
  startedAt: fc.option(fc.integer({ min: 0 })),
  completedAt: fc.option(fc.integer({ min: 0 })),
  pausedAt: fc.option(fc.integer({ min: 0 })),
  executionPlan: fc.option(ExecutionPlanArb),
  currentStepIndex: fc.integer({ min: 0 }),
  toolCallHistory: fc.array(ToolCallRecordArb),
  subAgentIds: fc.array(fc.string()),
  toolCallCount: fc.integer({ min: 0 }),
  tokenCount: fc.integer({ min: 0 }),
  cost: fc.float({ min: 0 }),
  retryCount: fc.integer({ min: 0 }),
  error: fc.option(HarnessErrorArb),
  lastCheckpointAt: fc.option(fc.integer({ min: 0 })),
  context: fc.dictionary(fc.string(), fc.anything()),
});

// ═══════════════════════════════════════════════════════════════════════════════
// Property Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('HarnessState Serialization', () => {
  it('should round-trip serialize and deserialize any valid harness state', () => {
    fc.assert(
      fc.property(HarnessStateArb, (state) => {
        // Serialize
        const serialized = JSON.stringify(state);
        // Deserialize and validate
        const parsed = JSON.parse(serialized);
        const result = HarnessStateSchema.safeParse(parsed);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.schemaVersion).toBe(state.schemaVersion);
          expect(result.data.config.id).toBe(state.config.id);
          expect(result.data.status).toBe(state.status);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('should reject invalid harness states', () => {
    fc.assert(
      fc.property(
        fc.record({
          schemaVersion: fc.integer({ min: 2, max: 100 }), // Invalid version
          config: HarnessConfigArb,
          status: HarnessStatusArb,
          createdAt: fc.integer({ min: 0 }),
          currentStepIndex: fc.integer({ min: 0 }),
          toolCallHistory: fc.array(ToolCallRecordArb),
          subAgentIds: fc.array(fc.string()),
          toolCallCount: fc.integer({ min: 0 }),
          tokenCount: fc.integer({ min: 0 }),
          cost: fc.float({ min: 0 }),
          retryCount: fc.integer({ min: 0 }),
          context: fc.dictionary(fc.string(), fc.anything()),
        }),
        (invalidState) => {
          const result = HarnessStateSchema.safeParse(invalidState);
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 50 }
    );
  });
});

describe('HarnessConfig Validation', () => {
  it('should validate any valid harness config', () => {
    fc.assert(
      fc.property(HarnessConfigArb, (config) => {
        const result = HarnessConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('should reject configs with invalid autonomy levels', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.string({ minLength: 1 }),
          name: fc.string({ minLength: 1 }),
          agentId: fc.string({ minLength: 1 }),
          task: fc.string({ minLength: 1 }),
          priority: HarnessPriorityArb,
          timeoutMs: fc.integer({ min: 0 }),
          maxRetries: fc.integer({ min: 0, max: 10 }),
          autonomyLevel: fc.integer({ min: 6, max: 100 }), // Invalid: > 5
          maxDepth: fc.integer({ min: 0, max: 5 }),
          depth: fc.integer({ min: 0, max: 5 }),
          allowedTools: fc.array(fc.string()),
          budget: fc.record({
            maxToolCalls: fc.integer({ min: 0 }),
            maxTokens: fc.integer({ min: 0 }),
            maxCost: fc.float({ min: 0 }),
          }),
          checkpointIntervalMs: fc.integer({ min: 1000 }),
          dreamModeEnabled: fc.boolean(),
          overnightEvolutionEnabled: fc.boolean(),
        }),
        (invalidConfig) => {
          const result = HarnessConfigSchema.safeParse(invalidConfig);
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 50 }
    );
  });
});

describe('ExecutionPlan Validation', () => {
  it('should validate valid execution plans', () => {
    fc.assert(
      fc.property(ExecutionPlanArb, (plan) => {
        const result = ExecutionPlanSchema.safeParse(plan);
        expect(result.success).toBe(true);
      }),
      { numRuns: 100 }
    );
  });
});

describe('ToolCallRecord Validation', () => {
  it('should validate valid tool call records', () => {
    fc.assert(
      fc.property(ToolCallRecordArb, (record) => {
        const result = ToolCallRecordSchema.safeParse(record);
        expect(result.success).toBe(true);
      }),
      { numRuns: 100 }
    );
  });
});

describe('serializeHarnessState / deserializeHarnessState', () => {
  it('should round-trip via dedicated functions', () => {
    fc.assert(
      fc.property(HarnessStateArb, (state) => {
        const serialized = serializeHarnessState(state);
        expect(typeof serialized).toBe('string');
        
        const deserialized = deserializeHarnessState(serialized);
        expect(deserialized).toBeDefined();
        
        // Verify key fields preserved
        const parsed = deserialized as typeof state;
        expect(parsed.schemaVersion).toBe(state.schemaVersion);
        expect(parsed.config.id).toBe(state.config.id);
        expect(parsed.status).toBe(state.status);
      }),
      { numRuns: 100 }
    );
  });

  it('should throw on invalid JSON during deserialization', () => {
    expect(() => deserializeHarnessState('not valid json')).toThrow();
  });

  it('should throw on valid JSON with invalid schema', () => {
    const invalidState = {
      schemaVersion: 999, // Invalid
      config: {},
      status: 'running',
    };
    expect(() => deserializeHarnessState(JSON.stringify(invalidState))).toThrow();
  });
});

describe('State Transition Validation', () => {
  const validTransitions: Record<string, string[]> = {
    created: ['starting', 'stopped'],
    starting: ['running', 'paused', 'failed', 'stopped'],
    running: ['paused', 'completed', 'failed', 'stopping'],
    paused: ['running', 'stopped'],
    stopping: ['stopped', 'failed'],
    stopped: [],
    completed: [],
    failed: [],
  };

  it('should accept all valid status values', () => {
    const validStatuses = Object.keys(validTransitions);
    for (const status of validStatuses) {
      const state = {
        schemaVersion: 1,
        config: {
          id: 'test',
          name: 'Test',
          agentId: 'agent-1',
          task: 'test task',
          priority: 'normal',
          timeoutMs: 0,
          maxRetries: 3,
          autonomyLevel: 3,
          maxDepth: 3,
          depth: 0,
          allowedTools: [],
          budget: { maxToolCalls: 100, maxTokens: 10000, maxCost: 10 },
          checkpointIntervalMs: 300000,
          dreamModeEnabled: false,
          overnightEvolutionEnabled: false,
        },
        status,
        createdAt: Date.now(),
        currentStepIndex: 0,
        toolCallHistory: [],
        subAgentIds: [],
        toolCallCount: 0,
        tokenCount: 0,
        cost: 0,
        retryCount: 0,
        context: {},
      };
      const result = HarnessStateSchema.safeParse(state);
      expect(result.success).toBe(true);
    }
  });
});
