// RLM Property Tests
// Spec: .kiro/specs/recursive-language-models/tasks.md

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import type {
  ContextSegment,
  ContextWindow,
  ScratchpadMessage,
} from './types.js';
import {
  serialize as serializeContextWindow,
  deserialize as deserializeContextWindow,
  createContextWindow,
  filterSegments,
  mergeContextWindows,
  getRelevanceDistribution,
  estimateTokenCount,
} from './context-window.js';
import {
  selectReaderModel,
  hasCapability,
  validateCapabilities,
  CONTEXT_COMPRESSION_CAPABILITY,
} from './model-selection.js';
import { createMockLLMCaller, compressWithReader } from './reader-adapter.js';
import { RlmPipeline, createRlmPipeline } from './rlm-pipeline.js';
import { computeDriftScore, createAuditEntry, AuditHistory } from './audit.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Arbitraries
// ═══════════════════════════════════════════════════════════════════════════════

const contextSegmentArb = fc.record<ContextSegment>({
  id: fc.string({ minLength: 1, maxLength: 50 }),
  role: fc.constantFrom('user', 'assistant', 'tool', 'system'),
  content: fc.string({ minLength: 1, maxLength: 500 }),
  originalTokens: fc.integer({ min: 0, max: 1000 }),
  compressedTokens: fc.integer({ min: 0, max: 1000 }),
  relevanceScore: fc.float({ min: 0, max: 1, noNaN: true }),
  sourceMessageIds: fc.array(fc.string({ minLength: 1 }), { maxLength: 5 }),
  metadata: fc.option(fc.dictionary(fc.string(), fc.anything()), { nil: undefined }),
});

const scratchpadMessageArb = fc.record<ScratchpadMessage>({
  id: fc.string({ minLength: 1, maxLength: 50 }),
  role: fc.constantFrom('user', 'assistant', 'tool', 'system'),
  content: fc.string({ minLength: 1, maxLength: 500 }),
  timestamp: fc.integer({ min: 0 }),
  metadata: fc.option(fc.dictionary(fc.string(), fc.anything()), { nil: undefined }),
});

// ═══════════════════════════════════════════════════════════════════════════════
// Property 18: ContextWindow Serialization Round-Trip
// ═══════════════════════════════════════════════════════════════════════════════

describe('ContextWindow serialization', () => {
  it('should round-trip serialize and deserialize', () => {
    fc.assert(
      fc.property(
        fc.array(contextSegmentArb, { minLength: 0, maxLength: 20 }),
        fc.string({ minLength: 1 }),
        (segments, readerModelId) => {
          const window = createContextWindow(segments, readerModelId);
          const serialized = serializeContextWindow(window);
          const deserialized = deserializeContextWindow(serialized);

          expect(deserialized.readerModelId).toBe(window.readerModelId);
          expect(deserialized.segments.length).toBe(window.segments.length);
          expect(deserialized.totalOriginalTokens).toBe(window.totalOriginalTokens);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should reject unknown schema versions', () => {
    const invalidData = {
      schemaVersion: 999,
      data: JSON.stringify({ segments: [] }),
      checksum: 'abc123',
    };

    expect(() => deserializeContextWindow(JSON.stringify(invalidData))).toThrow(
      'schema version'
    );
  });

  it('should reject corrupted data (checksum mismatch)', () => {
    const window = createContextWindow(
      [
        {
          id: 'seg1',
          role: 'user',
          content: 'test content',
          originalTokens: 10,
          compressedTokens: 5,
          relevanceScore: 0.8,
          sourceMessageIds: ['msg1'],
        },
      ],
      'test-model'
    );

    const serialized = serializeContextWindow(window);
    const parsed = JSON.parse(serialized);
    parsed.checksum = 'tampered';
    const tampered = JSON.stringify(parsed);

    expect(() => deserializeContextWindow(tampered)).toThrow('checksum');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Property 2: Segment Relevance Scores Present
// ═══════════════════════════════════════════════════════════════════════════════

describe('Segment relevance', () => {
  it('should preserve relevance scores in context window', () => {
    fc.assert(
      fc.property(
        fc.array(contextSegmentArb, { minLength: 1, maxLength: 10 }),
        fc.string({ minLength: 1 }),
        (segments, readerModelId) => {
          const window = createContextWindow(segments, readerModelId);

          for (const segment of window.segments) {
            expect(segment.relevanceScore).toBeGreaterThanOrEqual(0);
            expect(segment.relevanceScore).toBeLessThanOrEqual(1);
          }

          const distribution = getRelevanceDistribution(window.segments);
          const totalSegments = window.segments.length;
          expect(distribution.high + distribution.medium + distribution.low).toBe(
            totalSegments
          );
        }
      ),
      { numRuns: 50 }
    );
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // Property 3: High-Relevance Segment Preservation
  // ═════════════════════════════════════════════════════════════════════════════

  it('should always keep high-relevance segments', () => {
    fc.assert(
      fc.property(
        fc.array(contextSegmentArb, { minLength: 5, maxLength: 20 }),
        fc.float({ min: 0.25, max: 0.5, noNaN: true }), // threshold
        fc.float({ min: 0.75, max: 1, noNaN: true }), // high threshold
        fc.integer({ min: 500, max: 5000 }), // max tokens
        (segments, threshold, highThreshold, maxTokens) => {
          const filtered = filterSegments(
            segments,
            threshold,
            highThreshold,
            maxTokens
          );

          // All high-relevance segments should be preserved
          const highRelevanceSegments = segments.filter(
            s => s.relevanceScore >= highThreshold
          );
          for (const highSeg of highRelevanceSegments) {
            expect(filtered.some(f => f.id === highSeg.id)).toBe(true);
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Property 5 & 6: Model Selection
// ═══════════════════════════════════════════════════════════════════════════════

describe('Model selection', () => {
  it('should auto-select cheapest model with capability', () => {
    const result = selectReaderModel();

    expect(result.modelId).toBeDefined();
    expect(result.model).toBeDefined();
    expect(result.model.capabilities).toContain(CONTEXT_COMPRESSION_CAPABILITY);
    expect(result.autoSelected).toBe(true);
  });

  it('should validate model capabilities', () => {
    const result = validateCapabilities('ollama-qwen2.5:7b', [
      CONTEXT_COMPRESSION_CAPABILITY,
    ]);

    expect(result.valid).toBe(true);
    expect(result.missing).toHaveLength(0);
  });

  it('should reject models without required capabilities', () => {
    const result = validateCapabilities('ollama-qwen2.5:7b', [
      'non-existent-capability',
    ]);

    expect(result.valid).toBe(false);
    expect(result.missing).toContain('non-existent-capability');
  });

  it('should use preferred model when specified', () => {
    const result = selectReaderModel({
      preferredModelId: 'ollama-qwen2.5:7b',
    });

    expect(result.modelId).toBe('ollama-qwen2.5:7b');
    expect(result.autoSelected).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Property 1: Pipeline Activation
// ═══════════════════════════════════════════════════════════════════════════════

describe('RLM Pipeline', () => {
  let pipeline: RlmPipeline;

  beforeEach(() => {
    const mockCaller = createMockLLMCaller({
      delayMs: 10,
      successRate: 1.0,
      compressionRatio: 0.5,
    });
    pipeline = createRlmPipeline(mockCaller);
  });

  it('should activate when enabled', async () => {
    const messages: ScratchpadMessage[] = [
      { id: 'msg1', role: 'user', content: 'Hello', timestamp: Date.now() },
      { id: 'msg2', role: 'assistant', content: 'Hi there', timestamp: Date.now() },
    ];

    const result = await pipeline.compress(messages, { enabled: true });

    expect(result.success).toBe(true);
    expect(result.contextWindow).toBeDefined();
    expect(result.compressionTimeMs).toBeGreaterThanOrEqual(0);
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // Property 9: Bypass when disabled
  // ═════════════════════════════════════════════════════════════════════════════

  it('should bypass compression when disabled', async () => {
    const messages: ScratchpadMessage[] = [
      { id: 'msg1', role: 'user', content: 'Hello', timestamp: Date.now() },
    ];

    const result = await pipeline.compress(messages, { enabled: false });

    expect(result.success).toBe(true);
    expect(result.contextWindow.segments.length).toBe(messages.length);
    expect(result.contextWindow.segments[0].content).toBe('Hello');
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // Property 4: Fallback on reader failure
  // ═════════════════════════════════════════════════════════════════════════════

  it('should fallback on reader failure', async () => {
    const failingCaller = createMockLLMCaller({
      delayMs: 10,
      successRate: 0, // Always fail
    });
    const failingPipeline = createRlmPipeline(failingCaller);

    const messages: ScratchpadMessage[] = [
      { id: 'msg1', role: 'user', content: 'Hello', timestamp: Date.now() },
    ];

    const result = await failingPipeline.compress(messages);

    expect(result.success).toBe(true);
    expect(result.fallbackUsed).toBe(true);
    expect(result.contextWindow.segments[0].content).toBe('Hello');
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // Property 7: Runtime reconfiguration
  // ═════════════════════════════════════════════════════════════════════════════

  it('should support runtime reconfiguration', () => {
    const initialConfig = pipeline.getConfig();
    expect(initialConfig.enabled).toBe(true);

    pipeline.updateConfig({ enabled: false });
    const updatedConfig = pipeline.getConfig();
    expect(updatedConfig.enabled).toBe(false);

    // Other config values should be preserved
    expect(updatedConfig.relevanceThreshold).toBe(initialConfig.relevanceThreshold);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Audit & Drift Detection
// ═══════════════════════════════════════════════════════════════════════════════

describe('Audit and drift detection', () => {
  it('should compute drift score', () => {
    fc.assert(
      fc.property(
        fc.array(scratchpadMessageArb, { minLength: 1, maxLength: 10 }),
        fc.array(contextSegmentArb, { minLength: 0, maxLength: 10 }),
        (messages, segments) => {
          const window = createContextWindow(segments, 'test-model');
          const driftScore = computeDriftScore(messages, window);

          expect(driftScore).toBeGreaterThanOrEqual(0);
          expect(driftScore).toBeLessThanOrEqual(1);
        }
      ),
      { numRuns: 50 }
    );
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // Property 16: Audit entry completeness
  // ═════════════════════════════════════════════════════════════════════════════

  it('should create complete audit entries', () => {
    const messages: ScratchpadMessage[] = [
      { id: 'msg1', role: 'user', content: 'Hello world', timestamp: Date.now() },
    ];
    const segments: ContextSegment[] = [
      {
        id: 'seg1',
        role: 'user',
        content: 'Hello',
        originalTokens: 10,
        compressedTokens: 5,
        relevanceScore: 0.8,
        sourceMessageIds: ['msg1'],
      },
    ];
    const window = createContextWindow(segments, 'test-model');
    const entry = createAuditEntry('turn-1', 'test-model', messages, window);

    expect(entry.turnId).toBe('turn-1');
    expect(entry.readerModelId).toBe('test-model');
    expect(entry.timestamp).toBeGreaterThan(0);
    expect(entry.compressionRatio).toBeDefined();
    expect(entry.driftScore).toBeGreaterThanOrEqual(0);
    expect(entry.driftScore).toBeLessThanOrEqual(1);
    expect(entry.relevanceDistribution).toBeDefined();
    expect(entry.relevanceDistribution.high).toBeGreaterThanOrEqual(0);
    expect(entry.relevanceDistribution.medium).toBeGreaterThanOrEqual(0);
    expect(entry.relevanceDistribution.low).toBeGreaterThanOrEqual(0);
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // Property 17: Drift warning emission
  // ═════════════════════════════════════════════════════════════════════════════

  it('should emit drift warnings when threshold exceeded', () => {
    const audit = new AuditHistory({
      driftThreshold: 0.3,
      enableWarnings: true,
    });

    const warnings: Array<{ driftScore: number }> = [];
    audit.on('drift_warning', (warning) => {
      warnings.push(warning);
    });

    const highDriftEntry = {
      turnId: 'turn-1',
      timestamp: Date.now(),
      readerModelId: 'test',
      compressionRatio: 2.0,
      driftScore: 0.5, // Above threshold
      relevanceDistribution: { high: 1, medium: 0, low: 0 },
      totalOriginalTokens: 100,
      totalCompressedTokens: 50,
    };

    audit.add(highDriftEntry);

    expect(warnings.length).toBe(1);
    expect(warnings[0].driftScore).toBe(0.5);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Token Estimation
// ═══════════════════════════════════════════════════════════════════════════════

describe('Token estimation', () => {
  it('should estimate tokens based on content length', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 1000 }), (content) => {
        const estimated = estimateTokenCount(content);
        // Rough check: should be proportional to length
        expect(estimated).toBeGreaterThanOrEqual(Math.floor(content.length / 4));
        expect(estimated).toBeLessThanOrEqual(Math.ceil(content.length / 4) + 1);
      }),
      { numRuns: 50 }
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Context Window Merging
// ═══════════════════════════════════════════════════════════════════════════════

describe('Context window merging', () => {
  it('should merge windows without duplicate segments', () => {
    fc.assert(
      fc.property(
        fc.array(contextSegmentArb, { minLength: 1, maxLength: 5 }),
        fc.array(contextSegmentArb, { minLength: 1, maxLength: 5 }),
        fc.string({ minLength: 1 }),
        (segments1, segments2, readerModelId) => {
          const window1 = createContextWindow(segments1, readerModelId);
          const window2 = createContextWindow(segments2, readerModelId);

          const merged = mergeContextWindows(
            [window1, window2],
            readerModelId
          );

          // No duplicate IDs
          const ids = merged.segments.map(s => s.id);
          expect(new Set(ids).size).toBe(ids.length);
        }
      ),
      { numRuns: 30 }
    );
  });
});
