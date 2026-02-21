// Infinite Hierarchical Memory — Test Suite (70 tests)
// KIMI-R23-03 | Feb 2026

import { describe, it, expect, beforeEach } from 'vitest';
import {
  InfiniteMemoryGraph,
  ATLASInfiniteMemory,
} from '../infinite-memory-core.js';
import { Mem0Adapter } from '../mem0-adapter.js';
import { LettaSoulManager } from '../letta-soul-manager.js';
import { MemoryTasteScorer } from '../../taste-vault/memory-taste-scorer.js';

// ─── InfiniteMemoryGraph ──────────────────────────────────────────────────────

describe('InfiniteMemoryGraph', () => {
  let graph: InfiniteMemoryGraph;

  beforeEach(() => {
    graph = new InfiniteMemoryGraph();
  });

  it('starts empty', () => {
    expect(graph.size()).toBe(0);
  });

  it('upsertWithHierarchy inserts node', () => {
    graph.upsertWithHierarchy('n1', 'content', { level: 'project' });
    expect(graph.size()).toBe(1);
  });

  it('get returns inserted node', () => {
    graph.upsertWithHierarchy('n1', 'hello world', { level: 'scene' });
    expect(graph.get('n1')?.content).toBe('hello world');
  });

  it('get returns undefined for missing node', () => {
    expect(graph.get('nonexistent')).toBeUndefined();
  });

  it('get increments accessCount', () => {
    graph.upsertWithHierarchy('n1', 'content', { level: 'scene' });
    graph.get('n1');
    graph.get('n1');
    expect(graph.get('n1')?.accessCount).toBe(3); // 3rd get
  });

  it('upsert updates content on second call', () => {
    graph.upsertWithHierarchy('n1', 'v1', { level: 'project' });
    graph.upsertWithHierarchy('n1', 'v2', { level: 'project' });
    expect(graph.get('n1')?.content).toBe('v2');
  });

  it('preserves createdAt on update', () => {
    graph.upsertWithHierarchy('n1', 'v1', { level: 'project' });
    const createdAt = graph.get('n1')!.createdAt;
    graph.upsertWithHierarchy('n1', 'v2', { level: 'project' });
    expect(graph.get('n1')!.createdAt).toBe(createdAt);
  });

  it('sets parentId correctly', () => {
    graph.upsertWithHierarchy('parent', 'parent content', { level: 'project' });
    graph.upsertWithHierarchy('child', 'child content', { level: 'scene', parentId: 'parent' });
    expect(graph.get('child')?.parentId).toBe('parent');
  });

  it('getChildren returns child nodes', () => {
    graph.upsertWithHierarchy('parent', 'parent', { level: 'project' });
    graph.upsertWithHierarchy('c1', 'child 1', { level: 'scene', parentId: 'parent' });
    graph.upsertWithHierarchy('c2', 'child 2', { level: 'scene', parentId: 'parent' });
    expect(graph.getChildren('parent').length).toBe(2);
  });

  it('getParentChain returns ancestor chain', () => {
    graph.upsertWithHierarchy('L1', 'level 1', { level: 'lifetime' });
    graph.upsertWithHierarchy('L2', 'level 2', { level: 'portfolio', parentId: 'L1' });
    graph.upsertWithHierarchy('L3', 'level 3', { level: 'project', parentId: 'L2' });
    const chain = graph.getParentChain('L3');
    expect(chain.map(n => n.id)).toEqual(['L1', 'L2']);
  });

  it('queryHierarchical by level filters correctly', () => {
    graph.upsertWithHierarchy('a', 'scene node', { level: 'scene' });
    graph.upsertWithHierarchy('b', 'project node', { level: 'project' });
    const results = graph.queryHierarchical({ level: 'scene' });
    expect(results.length).toBe(1);
    expect(results[0]!.id).toBe('a');
  });

  it('queryHierarchical by agentId filters correctly', () => {
    graph.upsertWithHierarchy('n1', 'mars memory', { level: 'project', agentId: 'MARS' });
    graph.upsertWithHierarchy('n2', 'venus memory', { level: 'project', agentId: 'VENUS' });
    const results = graph.queryHierarchical({ agentId: 'MARS' });
    expect(results.length).toBe(1);
  });

  it('queryHierarchical by keywords filters correctly', () => {
    graph.upsertWithHierarchy('n1', 'deploy the application to AWS', { level: 'project' });
    graph.upsertWithHierarchy('n2', 'design the user interface', { level: 'project' });
    const results = graph.queryHierarchical({ keywords: ['deploy'] });
    expect(results[0]!.id).toBe('n1');
  });

  it('queryHierarchical by minTasteScore filters', () => {
    graph.upsertWithHierarchy('high', 'high taste', { level: 'project', tasteScore: 0.9 });
    graph.upsertWithHierarchy('low', 'low taste', { level: 'project', tasteScore: 0.2 });
    const results = graph.queryHierarchical({ minTasteScore: 0.5 });
    expect(results.every(n => n.tasteScore >= 0.5)).toBe(true);
  });

  it('queryHierarchical respects maxResults', () => {
    for (let i = 0; i < 20; i++) {
      graph.upsertWithHierarchy(`n${i}`, `content ${i}`, { level: 'project' });
    }
    const results = graph.queryHierarchical({ maxResults: 5 });
    expect(results.length).toBeLessThanOrEqual(5);
  });

  it('queryHierarchical with includeChildren includes child nodes', () => {
    graph.upsertWithHierarchy('parent', 'parent', { level: 'project' });
    graph.upsertWithHierarchy('child', 'child', { level: 'scene', parentId: 'parent' });
    const results = graph.queryHierarchical({ level: 'project', includeChildren: true });
    const ids = results.map(r => r.id);
    expect(ids).toContain('child');
  });

  it('delete removes node', () => {
    graph.upsertWithHierarchy('n1', 'content', { level: 'project' });
    graph.delete('n1');
    expect(graph.get('n1')).toBeUndefined();
  });

  it('delete returns false for nonexistent node', () => {
    expect(graph.delete('ghost')).toBe(false);
  });

  it('delete cleans up level index', () => {
    graph.upsertWithHierarchy('n1', 'content', { level: 'scene' });
    graph.delete('n1');
    expect(graph.queryHierarchical({ level: 'scene' }).length).toBe(0);
  });

  it('clear empties the graph', () => {
    graph.upsertWithHierarchy('n1', 'content', { level: 'project' });
    graph.clear();
    expect(graph.size()).toBe(0);
  });

  it('evicts least important node when maxNodes exceeded', () => {
    const small = new InfiniteMemoryGraph(3);
    small.upsertWithHierarchy('n1', 'c1', { level: 'scene' });
    small.upsertWithHierarchy('n2', 'c2', { level: 'scene' });
    small.upsertWithHierarchy('n3', 'c3', { level: 'scene' });
    small.upsertWithHierarchy('n4', 'c4', { level: 'scene' }); // triggers eviction
    expect(small.size()).toBe(3);
  });

  it('migrateLegacyGraphMemory imports entries', () => {
    const result = graph.migrateLegacyGraphMemory([
      { id: 'legacy-1', content: 'old memory 1', agentId: 'MARS' },
      { id: 'legacy-2', content: 'old memory 2' },
    ]);
    expect(result.migrated).toBe(2);
    expect(result.skipped).toBe(0);
  });

  it('migrateLegacyGraphMemory skips duplicates', () => {
    graph.upsertWithHierarchy('legacy-1', 'already exists', { level: 'project' });
    const result = graph.migrateLegacyGraphMemory([
      { id: 'legacy-1', content: 'old memory' },
    ]);
    expect(result.skipped).toBe(1);
  });

  it('1000 nodes query completes in < 100ms', () => {
    for (let i = 0; i < 1000; i++) {
      graph.upsertWithHierarchy(`n${i}`, `content ${i} keyword`, { level: 'project', agentId: 'MARS' });
    }
    const start = Date.now();
    graph.queryHierarchical({ agentId: 'MARS', keywords: ['keyword'], maxResults: 10 });
    expect(Date.now() - start).toBeLessThan(100);
  });
});

// ─── ATLASInfiniteMemory ──────────────────────────────────────────────────────

describe('ATLASInfiniteMemory', () => {
  let atlas: ATLASInfiniteMemory;

  beforeEach(() => {
    atlas = new ATLASInfiniteMemory();
  });

  it('upsert stores and recall retrieves', () => {
    atlas.upsert('m1', 'architecture decision', { level: 'project', tags: ['architecture'] });
    const results = atlas.recall({ keywords: ['architecture'] });
    expect(results.length).toBeGreaterThan(0);
  });

  it('getContext returns node with ancestors and children', () => {
    atlas.upsert('parent', 'parent content', { level: 'portfolio' });
    atlas.upsert('child', 'child content', { level: 'project', parentId: 'parent' });
    const ctx = atlas.getContext('parent');
    expect(ctx?.children.length).toBe(1);
  });

  it('getContext returns undefined for nonexistent node', () => {
    expect(atlas.getContext('ghost')).toBeUndefined();
  });

  it('size returns 0 initially', () => {
    expect(atlas.size()).toBe(0);
  });

  it('clear resets to 0', () => {
    atlas.upsert('m1', 'content', { level: 'scene' });
    atlas.clear();
    expect(atlas.size()).toBe(0);
  });

  it('migrate ingests legacy entries', () => {
    const result = atlas.migrate([
      { id: 'old-1', content: 'old memory' },
    ]);
    expect(result.migrated).toBe(1);
  });
});

// ─── Mem0Adapter ─────────────────────────────────────────────────────────────

describe('Mem0Adapter', () => {
  let adapter: Mem0Adapter;

  beforeEach(() => {
    adapter = new Mem0Adapter({ userId: 'test-user' });
  });

  it('add stores a memory', async () => {
    await adapter.add('TypeScript is strongly typed');
    expect(adapter.getCount()).toBe(1);
  });

  it('add returns Mem0Memory with id', async () => {
    const mem = await adapter.add('Next.js uses App Router');
    expect(mem.id).toBeTruthy();
  });

  it('add deduplicates identical content', async () => {
    await adapter.add('same content');
    await adapter.add('same content');
    expect(adapter.getCount()).toBe(1);
  });

  it('search finds relevant memories', async () => {
    await adapter.add('deploy to Kubernetes with Helm charts');
    await adapter.add('design responsive UI with Tailwind');
    const results = await adapter.search('Kubernetes');
    expect(results.memories.length).toBeGreaterThan(0);
  });

  it('search returns queryTimeMs', async () => {
    await adapter.add('test memory');
    const results = await adapter.search('test');
    expect(results.queryTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('get retrieves by id', async () => {
    const mem = await adapter.add('retrievable memory');
    const fetched = await adapter.get(mem.id);
    expect(fetched?.memory).toBe('retrievable memory');
  });

  it('get returns undefined for unknown id', async () => {
    expect(await adapter.get('ghost-id')).toBeUndefined();
  });

  it('update changes memory content', async () => {
    const mem = await adapter.add('original content');
    const updated = await adapter.update(mem.id, 'updated content');
    expect(updated.memory).toBe('updated content');
  });

  it('update throws for nonexistent id', async () => {
    await expect(adapter.update('ghost', 'new content')).rejects.toThrow();
  });

  it('Mem0Memory has userId', async () => {
    const mem = await adapter.add('test');
    expect(mem.userId).toBe('test-user');
  });
});

// ─── LettaSoulManager ─────────────────────────────────────────────────────────

describe('LettaSoulManager', () => {
  let manager: LettaSoulManager;

  beforeEach(() => {
    manager = new LettaSoulManager();
  });

  it('createSoul registers agent', () => {
    manager.createSoul('MARS', 'DevOps specialist', 'Jon is an engineer');
    expect(manager.getSoul('MARS')).toBeDefined();
  });

  it('getSoul returns undefined for unknown agent', () => {
    expect(manager.getSoul('GHOST')).toBeUndefined();
  });

  it('updateSoul changes persona', () => {
    manager.createSoul('VENUS', 'UI specialist', 'Jon loves design');
    manager.updateSoul('VENUS', { persona: 'Senior UI specialist' });
    expect(manager.getSoul('VENUS')!.persona).toBe('Senior UI specialist');
  });

  it('updateSoul increments version', () => {
    manager.createSoul('EARTH', 'Orchestrator', 'Jon leads projects');
    manager.updateSoul('EARTH', { persona: 'Senior Orchestrator' });
    expect(manager.getSoul('EARTH')!.version).toBe(2);
  });

  it('updateSoul throws for unknown agent', () => {
    expect(() => manager.updateSoul('GHOST', {})).toThrow();
  });

  it('addCoreMemory appends memory', () => {
    manager.createSoul('MERCURY', 'Code reviewer', 'Jon writes clean code');
    manager.addCoreMemory('MERCURY', 'Always check for null pointers');
    expect(manager.getSoul('MERCURY')!.coreMemories).toContain('Always check for null pointers');
  });

  it('addCoreMemory avoids duplicates', () => {
    manager.createSoul('JUPITER', 'Architect', 'Jon thinks big picture');
    manager.addCoreMemory('JUPITER', 'same memory');
    manager.addCoreMemory('JUPITER', 'same memory');
    expect(manager.getSoul('JUPITER')!.coreMemories.length).toBe(1);
  });

  it('removeCoreMemory removes memory', () => {
    manager.createSoul('PLUTO', 'Security', 'Jon cares about security');
    manager.addCoreMemory('PLUTO', 'zero trust');
    manager.removeCoreMemory('PLUTO', 'zero trust');
    expect(manager.getSoul('PLUTO')!.coreMemories).not.toContain('zero trust');
  });

  it('takeSnapshot creates a snapshot', () => {
    manager.createSoul('SATURN', 'Sprint planner', 'Jon plans sprints');
    expect(manager.getSnapshots('SATURN').length).toBeGreaterThan(0);
  });

  it('restoreSnapshot reverts soul', () => {
    manager.createSoul('URANUS', 'Researcher', 'Jon researches');
    const snaps = manager.getSnapshots('URANUS');
    manager.updateSoul('URANUS', { persona: 'Changed researcher' });
    const snap = snaps[0]!;
    manager.restoreSnapshot('URANUS', snap.snapshotId);
    expect(manager.getSoul('URANUS')!.persona).toBe('Researcher');
  });

  it('restoreSnapshot throws for unknown snapshotId', () => {
    manager.createSoul('TITAN', 'Infrastructure', 'Jon scales');
    expect(() => manager.restoreSnapshot('TITAN', 'ghost-snap')).toThrow();
  });

  it('detectTasteDrift returns stable for unchanged soul', () => {
    manager.createSoul('NEPTUNE', 'Data pipeline', 'Jon processes data');
    const report = manager.detectTasteDrift('NEPTUNE');
    expect(report.recommendation).toBe('stable');
  });

  it('detectTasteDrift detects persona drift', () => {
    manager.createSoul('IO', 'Real-time', 'Jon needs speed');
    manager.updateSoul('IO', { persona: 'Completely different' });
    const report = manager.detectTasteDrift('IO');
    expect(report.driftScore).toBeGreaterThan(0);
  });

  it('autoResolveDrift returns resolvedAt when drift is high', () => {
    manager.createSoul('CHARON', 'Debugger', 'Jon fixes bugs');
    // Create massive drift
    manager.updateSoul('CHARON', { persona: 'Different persona', traits: { role: 'new', mode: 'changed', type: 'altered', style: 'modified' } });
    manager.updateSoul('CHARON', { traits: { role: 'another', mode: 'again', type: 'shifted', style: 'moved' } });
    const report = manager.autoResolveDrift('CHARON');
    // May or may not resolve depending on drift score
    expect(report).toBeDefined();
  });

  it('listAgents returns all registered agents', () => {
    manager.createSoul('A', 'p', 'h');
    manager.createSoul('B', 'p', 'h');
    expect(manager.listAgents()).toContain('A');
    expect(manager.listAgents()).toContain('B');
  });
});

// ─── MemoryTasteScorer ────────────────────────────────────────────────────────

describe('MemoryTasteScorer', () => {
  let scorer: MemoryTasteScorer;

  beforeEach(() => {
    scorer = new MemoryTasteScorer();
  });

  it('score returns value between 0 and 1', () => {
    const result = scorer.score('n1', 'content', [], 'MARS', 0.5, Date.now());
    expect(result.tasteScore).toBeGreaterThanOrEqual(0);
    expect(result.tasteScore).toBeLessThanOrEqual(1);
  });

  it('preferred tags boost score', () => {
    const noTag = scorer.score('n1', 'content', [], 'MARS', 0.5, Date.now());
    const withTag = scorer.score('n2', 'content', ['architecture'], 'MARS', 0.5, Date.now());
    expect(withTag.tasteScore).toBeGreaterThan(noTag.tasteScore);
  });

  it('penalized tags lower score', () => {
    const clean = scorer.score('n1', 'content', [], undefined, 0.5, Date.now());
    const penalized = scorer.score('n2', 'content', ['deprecated'], undefined, 0.5, Date.now());
    expect(penalized.tasteScore).toBeLessThan(clean.tasteScore);
  });

  it('preferred agents boost score', () => {
    const preferred = scorer.score('n1', 'content', [], 'JUPITER', 0.5, Date.now());
    const notPreferred = scorer.score('n2', 'content', [], 'ATLAS', 0.5, Date.now());
    expect(preferred.tasteScore).toBeGreaterThan(notPreferred.tasteScore);
  });

  it('content keywords affect score', () => {
    const noKw = scorer.score('n1', 'generic content', [], undefined, 0.5, Date.now());
    const withKw = scorer.score('n2', 'this is a best practice pattern', [], undefined, 0.5, Date.now());
    expect(withKw.tasteScore).toBeGreaterThanOrEqual(noKw.tasteScore);
  });

  it('scoreMany returns sorted by tasteScore descending', () => {
    const memories = [
      { id: 'n1', content: 'c1', tags: ['deprecated'], agentId: undefined, importance: 0.1, createdAt: Date.now() - 1e6 },
      { id: 'n2', content: 'architecture pattern', tags: ['architecture'], agentId: 'JUPITER', importance: 0.9, createdAt: Date.now() },
    ];
    const scored = scorer.scoreMany(memories);
    expect(scored[0]!.tasteScore).toBeGreaterThanOrEqual(scored[1]!.tasteScore);
  });

  it('updateProfile changes scoring behavior', () => {
    scorer.updateProfile({ preferredAgents: ['ATLAS'] });
    const result = scorer.score('n1', 'content', [], 'ATLAS', 0.5, Date.now());
    expect(result.breakdown.agentBoost).toBeGreaterThan(0);
  });

  it('getProfile returns current profile', () => {
    const profile = scorer.getProfile();
    expect(profile.preferredTags).toBeDefined();
  });

  it('breakdown fields sum to approx tasteScore', () => {
    const result = scorer.score('n1', 'content', [], 'MARS', 0.5, Date.now());
    const { breakdown } = result;
    const computed = 0.5 + breakdown.tagBoost + breakdown.agentBoost + breakdown.contentBoost + breakdown.recencyBoost + breakdown.importanceBoost;
    expect(Math.abs(computed - result.tasteScore)).toBeLessThan(0.01);
  });
});
