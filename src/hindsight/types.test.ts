// Hindsight Property Tests - Task K3-01
// Spec: .kiro/specs/hindsight-persistent-memory/tasks.md

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { MemoryFragment, MemoryFragmentInput, HindsightConfig } from './types.js';
import {
  serializeMemoryFragment,
  deserializeMemoryFragment,
  createMemoryFragment,
  HindsightConfigSchema,
  MemoryTypeSchema,
} from './schemas.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Arbitraries
// ═══════════════════════════════════════════════════════════════════════════════

const embeddingArb = fc.array(fc.integer({ min: -1000, max: 1000 }).map(n => n / 100), { minLength: 384, maxLength: 384 });

const memoryTypeArb = fc.constantFrom('episodic', 'procedural', 'semantic');

const memoryFragmentInputArb = fc.record<MemoryFragmentInput>({
  content: fc.string({ minLength: 1, maxLength: 1000 }),
  type: memoryTypeArb,
  agentId: fc.string({ minLength: 1, maxLength: 50 }),
  projectId: fc.string({ minLength: 1, maxLength: 50 }),
  relevance: fc.option(fc.double({ min: 0, max: 1 }).filter(n => Number.isFinite(n)), { nil: undefined }),
  confidence: fc.option(fc.double({ min: 0, max: 1 }).filter(n => Number.isFinite(n)), { nil: undefined }),
  embedding: fc.option(embeddingArb, { nil: undefined }),
  tags: fc.option(fc.array(fc.string({ minLength: 1 }), { maxLength: 10 }), { nil: undefined }),
  isPinned: fc.option(fc.boolean(), { nil: undefined }),
  expiresAt: fc.option(fc.integer({ min: 0 }), { nil: undefined }),
});

const hindsightConfigArb = fc.record<HindsightConfig>({
  storageType: fc.constantFrom('sqlite', 'convex', 'memory'),
  storagePath: fc.option(fc.string(), { nil: undefined }),
  embeddingDimension: fc.integer({ min: 128, max: 1536 }),
  similarityThreshold: fc.double({ min: 0, max: 1 }).filter(n => Number.isFinite(n)),
  consolidationIntervalMs: fc.integer({ min: 60000, max: 86400000 }),
  dedupSimilarityThreshold: fc.double({ min: 0.8, max: 1 }).filter(n => Number.isFinite(n)),
  decayRate: fc.double({ min: 0.001, max: 0.1 }).filter(n => Number.isFinite(n)),
  archiveThreshold: fc.double({ min: 0, max: 0.5 }).filter(n => Number.isFinite(n)),
  maxFragmentsBeforeCompression: fc.integer({ min: 1000, max: 100000 }),
  defaultTopK: fc.integer({ min: 1, max: 100 }),
  tokenBudget: fc.integer({ min: 500, max: 8000 }),
  recencyWeight: fc.double({ min: 0, max: 1 }).filter(n => Number.isFinite(n)),
  frequencyWeight: fc.double({ min: 0, max: 1 }).filter(n => Number.isFinite(n)),
  similarityWeight: fc.double({ min: 0, max: 1 }).filter(n => Number.isFinite(n)),
  defaultNamespace: fc.string({ minLength: 1 }),
  enableNamespaceIsolation: fc.boolean(),
  healthCheckIntervalMs: fc.integer({ min: 10000, max: 300000 }),
});

// ═══════════════════════════════════════════════════════════════════════════════
// Property 4: JSON Serialization Round-Trip
// ═══════════════════════════════════════════════════════════════════════════════

describe('MemoryFragment serialization', () => {
  it('should round-trip serialize and deserialize', () => {
    fc.assert(
      fc.property(
        memoryFragmentInputArb,
        embeddingArb,
        (input, embedding) => {
          const fragment = createMemoryFragment(input, embedding);
          const serialized = serializeMemoryFragment(fragment);
          const deserialized = deserializeMemoryFragment(serialized);

          expect(deserialized.id).toBe(fragment.id);
          expect(deserialized.content).toBe(fragment.content);
          expect(deserialized.type).toBe(fragment.type);
          expect(deserialized.agentId).toBe(fragment.agentId);
          expect(deserialized.projectId).toBe(fragment.projectId);
          expect(deserialized.embedding).toEqual(fragment.embedding);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should reject unknown schema versions', () => {
    const invalidData = {
      schemaVersion: 999,
      data: { id: 'test', content: 'test' },
      checksum: 'abc',
    };

    expect(() => deserializeMemoryFragment(JSON.stringify(invalidData))).toThrow(
      'schema version'
    );
  });

  it('should reject corrupted data (checksum mismatch)', () => {
    const input: MemoryFragmentInput = {
      content: 'test content',
      type: 'episodic',
      agentId: 'agent1',
      projectId: 'project1',
    };
    const fragment = createMemoryFragment(input, new Array(384).fill(0));
    const serialized = serializeMemoryFragment(fragment);
    const parsed = JSON.parse(serialized);
    parsed.checksum = 'tampered';
    const tampered = JSON.stringify(parsed);

    expect(() => deserializeMemoryFragment(tampered)).toThrow('Checksum');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Property: Invalid Config Rejection
// ═══════════════════════════════════════════════════════════════════════════════

describe('HindsightConfig validation', () => {
  it('should accept valid configs', () => {
    fc.assert(
      fc.property(hindsightConfigArb, (config) => {
        const validated = HindsightConfigSchema.parse(config);
        expect(validated.storageType).toBe(config.storageType);
        expect(validated.embeddingDimension).toBe(config.embeddingDimension);
      }),
      { numRuns: 30 }
    );
  });

  it('should reject invalid storage type', () => {
    const invalidConfig = {
      storageType: 'invalid',
      embeddingDimension: 384,
      similarityThreshold: 0.7,
    };

    expect(() => HindsightConfigSchema.parse(invalidConfig)).toThrow();
  });

  it('should reject negative embedding dimension', () => {
    const invalidConfig = {
      storageType: 'sqlite',
      embeddingDimension: -100,
      similarityThreshold: 0.7,
    };

    expect(() => HindsightConfigSchema.parse(invalidConfig)).toThrow();
  });

  it('should reject similarity threshold > 1', () => {
    const invalidConfig = {
      storageType: 'sqlite',
      embeddingDimension: 384,
      similarityThreshold: 1.5,
    };

    expect(() => HindsightConfigSchema.parse(invalidConfig)).toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Property: Fragment Creation Completeness
// ═══════════════════════════════════════════════════════════════════════════════

describe('MemoryFragment creation', () => {
  it('should create fragments with all required fields', () => {
    fc.assert(
      fc.property(
        memoryFragmentInputArb,
        embeddingArb,
        (input, embedding) => {
          const fragment = createMemoryFragment(input, embedding);

          // Required fields
          expect(fragment.id).toBeDefined();
          expect(fragment.id.startsWith('frag-')).toBe(true);
          expect(fragment.content).toBe(input.content);
          expect(fragment.type).toBe(input.type);
          expect(fragment.namespace).toBe(`${input.projectId}:${input.agentId}`);
          expect(fragment.agentId).toBe(input.agentId);
          expect(fragment.projectId).toBe(input.projectId);
          expect(fragment.embedding).toEqual(embedding);
          expect(fragment.accessCount).toBe(0);
          expect(fragment.isArchived).toBe(false);
          expect(fragment.tags).toBeDefined();
          expect(fragment.provenance).toBeDefined();
          expect(fragment.provenance.agentId).toBe(input.agentId);

          // Timestamps
          expect(fragment.createdAt).toBeGreaterThan(0);
          expect(fragment.updatedAt).toBeGreaterThan(0);
          expect(fragment.lastAccessedAt).toBeGreaterThan(0);

          // Defaults for optional fields
          expect(fragment.relevance).toBeGreaterThanOrEqual(0);
          expect(fragment.relevance).toBeLessThanOrEqual(1);
          expect(fragment.confidence).toBeGreaterThanOrEqual(0);
          expect(fragment.confidence).toBeLessThanOrEqual(1);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should use provided optional values', () => {
    const input: MemoryFragmentInput = {
      content: 'test',
      type: 'semantic',
      agentId: 'agent1',
      projectId: 'project1',
      relevance: 0.9,
      confidence: 0.8,
      isPinned: true,
      tags: ['tag1', 'tag2'],
    };
    const embedding = new Array(384).fill(0.1);

    const fragment = createMemoryFragment(input, embedding);

    expect(fragment.relevance).toBe(0.9);
    expect(fragment.confidence).toBe(0.8);
    expect(fragment.isPinned).toBe(true);
    expect(fragment.tags).toEqual(['tag1', 'tag2']);
  });

  it('should apply defaults for missing optional values', () => {
    const input: MemoryFragmentInput = {
      content: 'test',
      type: 'episodic',
      agentId: 'agent1',
      projectId: 'project1',
    };
    const embedding = new Array(384).fill(0);

    const fragment = createMemoryFragment(input, embedding);

    expect(fragment.relevance).toBe(0.5);
    expect(fragment.confidence).toBe(0.5);
    expect(fragment.isPinned).toBe(false);
    expect(fragment.tags).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Memory Type Validation
// ═══════════════════════════════════════════════════════════════════════════════

describe('MemoryType validation', () => {
  it('should accept valid memory types', () => {
    const validTypes = ['episodic', 'procedural', 'semantic'];
    for (const type of validTypes) {
      expect(() => MemoryTypeSchema.parse(type)).not.toThrow();
    }
  });

  it('should reject invalid memory types', () => {
    const invalidTypes = ['invalid', 'unknown', ''];
    for (const type of invalidTypes) {
      expect(() => MemoryTypeSchema.parse(type)).toThrow();
    }
  });
});
