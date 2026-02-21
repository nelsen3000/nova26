// Formatter tests - K3-07
import { describe, it, expect } from 'vitest';
import {
  formatRetrieval,
  prettyPrint,
  enforceTokenBudget,
  estimateTokenCount,
} from './formatter.js';
import type { MemoryFragment, ScoredFragment } from './types.js';

function makeFragment(overrides: Partial<MemoryFragment> = {}): MemoryFragment {
  const now = Date.now();
  return {
    id: `frag-${Math.random().toString(36).slice(2, 8)}`,
    content: 'Test memory content',
    type: 'semantic',
    namespace: 'proj:agent',
    agentId: 'agent-01',
    projectId: 'proj-01',
    relevance: 0.8,
    confidence: 0.9,
    embedding: [0.1, 0.2, 0.3],
    accessCount: 5,
    lastAccessedAt: now,
    createdAt: now,
    updatedAt: now,
    isPinned: false,
    isArchived: false,
    tags: ['test'],
    provenance: {
      sourceType: 'task',
      sourceId: 'task-001',
      timestamp: now,
      agentId: 'agent-01',
    },
    ...overrides,
  };
}

function makeScored(frag: MemoryFragment, score = 0.9): ScoredFragment {
  return { fragment: frag, score, similarityScore: score, recencyScore: 0.8, frequencyScore: 0.7 };
}

describe('estimateTokenCount', () => {
  it('returns 0 for empty string', () => {
    expect(estimateTokenCount('')).toBe(0);
  });

  it('estimates ~4 chars per token', () => {
    const text = 'a'.repeat(400);
    expect(estimateTokenCount(text)).toBe(100);
  });

  it('rounds up', () => {
    expect(estimateTokenCount('abc')).toBe(1); // ceil(3/4)
  });
});

describe('enforceTokenBudget', () => {
  it('returns empty for zero budget', () => {
    const frags = [makeFragment({ content: 'hello world' })];
    expect(enforceTokenBudget(frags, 0)).toHaveLength(0);
  });

  it('includes fragments within budget', () => {
    const frags = [
      makeFragment({ content: 'a'.repeat(80), relevance: 0.9 }),  // 20 tokens
      makeFragment({ content: 'b'.repeat(80), relevance: 0.5 }),  // 20 tokens
    ];
    const result = enforceTokenBudget(frags, 25);
    expect(result).toHaveLength(1);
    expect(result[0].relevance).toBe(0.9); // higher relevance first
  });

  it('returns all if all fit within budget', () => {
    const frags = [
      makeFragment({ content: 'hi' }),
      makeFragment({ content: 'bye' }),
    ];
    expect(enforceTokenBudget(frags, 10000)).toHaveLength(2);
  });

  it('prioritizes by relevance descending', () => {
    const frags = [
      makeFragment({ content: 'low', relevance: 0.1 }),
      makeFragment({ content: 'high', relevance: 0.99 }),
      makeFragment({ content: 'mid', relevance: 0.5 }),
    ];
    const result = enforceTokenBudget(frags, 3); // ~3 tokens each
    expect(result[0].relevance).toBe(0.99);
  });
});

describe('formatRetrieval', () => {
  it('returns empty context when no fragments', () => {
    const ctx = formatRetrieval([]);
    expect(ctx.fragments).toHaveLength(0);
    expect(ctx.formattedContext).toBe('');
    expect(ctx.tokenCount).toBe(0);
  });

  it('includes relevance scores for all fragments', () => {
    const f = makeFragment();
    const scored = [makeScored(f, 0.95)];
    const ctx = formatRetrieval(scored);
    expect(ctx.relevanceScores[f.id]).toBe(0.95);
  });

  it('respects token budget', () => {
    const bigContent = 'x'.repeat(4000); // ~1000 tokens
    const frags = Array.from({ length: 5 }, (_, i) =>
      makeScored(makeFragment({ content: bigContent, relevance: 1 - i * 0.1 }))
    );
    const ctx = formatRetrieval(frags, { tokenBudget: 1500 });
    expect(ctx.tokenCount).toBeLessThanOrEqual(1500);
  });

  it('formats episodic fragments with date and project', () => {
    const f = makeFragment({ type: 'episodic', content: 'Something happened' });
    const ctx = formatRetrieval([makeScored(f)]);
    expect(ctx.formattedContext).toContain('[EPISODIC]');
    expect(ctx.formattedContext).toContain('proj-01');
  });

  it('formats procedural fragments with agent', () => {
    const f = makeFragment({ type: 'procedural', content: 'Step 1: do this' });
    const ctx = formatRetrieval([makeScored(f)]);
    expect(ctx.formattedContext).toContain('[PROCEDURAL]');
    expect(ctx.formattedContext).toContain('agent-01');
  });

  it('formats semantic fragments with confidence', () => {
    const f = makeFragment({ type: 'semantic', content: 'A known fact', confidence: 0.85 });
    const ctx = formatRetrieval([makeScored(f)], { includeMetadata: true });
    expect(ctx.formattedContext).toContain('[SEMANTIC]');
    expect(ctx.formattedContext).toContain('85%');
  });

  it('sorts by score descending', () => {
    const low = makeFragment({ content: 'low score', relevance: 0.1 });
    const high = makeFragment({ content: 'high score', relevance: 0.9 });
    const ctx = formatRetrieval([makeScored(low, 0.3), makeScored(high, 0.95)]);
    expect(ctx.fragments[0].id).toBe(high.id);
  });
});

describe('prettyPrint', () => {
  it('includes fragment id', () => {
    const f = makeFragment({ id: 'frag-xyz' });
    const output = prettyPrint(f);
    expect(output).toContain('frag-xyz');
  });

  it('includes type, content, agent, project', () => {
    const f = makeFragment({ type: 'episodic', content: 'My event' });
    const output = prettyPrint(f);
    expect(output).toContain('EPISODIC');
    expect(output).toContain('My event');
    expect(output).toContain('agent-01');
    expect(output).toContain('proj-01');
  });

  it('truncates long content', () => {
    const f = makeFragment({ content: 'x'.repeat(300) });
    const output = prettyPrint(f);
    expect(output).toContain('...');
    expect(output.length).toBeLessThan(1000);
  });

  it('shows PINNED marker for pinned fragments', () => {
    const f = makeFragment({ isPinned: true });
    expect(prettyPrint(f)).toContain('PINNED');
  });

  it('shows ARCHIVED marker for archived fragments', () => {
    const f = makeFragment({ isArchived: true });
    expect(prettyPrint(f)).toContain('ARCHIVED');
  });

  it('includes tags when present', () => {
    const f = makeFragment({ tags: ['alpha', 'beta'] });
    const output = prettyPrint(f);
    expect(output).toContain('alpha');
    expect(output).toContain('beta');
  });
});
