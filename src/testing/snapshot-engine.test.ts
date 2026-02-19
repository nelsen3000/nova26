// Tests for Snapshot Manager & Comparison Engine
// KIMI-TESTING-03

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  SnapshotHasher,
  SnapshotComparator,
  FileSystemSnapshotStore,
  SnapshotManager,
  createSnapshotManager,
  SnapshotSchema,
  SnapshotComparisonSchema,
} from './snapshot-engine.js';

describe('SnapshotHasher', () => {
  it('computes consistent hash', () => {
    const content = 'test content';
    const hash1 = SnapshotHasher.compute(content);
    const hash2 = SnapshotHasher.compute(content);
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // SHA-256 hex
  });

  it('computes different hashes for different content', () => {
    const hash1 = SnapshotHasher.compute('content1');
    const hash2 = SnapshotHasher.compute('content2');
    expect(hash1).not.toBe(hash2);
  });

  it('verifies matching hash', () => {
    const content = 'test';
    const hash = SnapshotHasher.compute(content);
    expect(SnapshotHasher.verify(content, hash)).toBe(true);
  });

  it('rejects non-matching hash', () => {
    expect(SnapshotHasher.verify('content', 'wronghash')).toBe(false);
  });
});

describe('SnapshotComparator', () => {
  const comparator = new SnapshotComparator();

  const createSnapshot = (content: string, format: 'json' | 'text' = 'text') => ({
    id: 'test',
    name: 'test',
    content,
    format,
    hash: 'hash',
    createdAt: new Date().toISOString(),
  });

  it('returns identical for same content', () => {
    const snap1 = createSnapshot('hello world');
    const snap2 = createSnapshot('hello world');

    const result = comparator.compare(snap1, snap2);
    expect(result.identical).toBe(true);
    expect(result.similarity).toBe(100);
    expect(result.additions).toBe(0);
    expect(result.deletions).toBe(0);
  });

  it('detects additions', () => {
    const snap1 = createSnapshot('line1');
    const snap2 = createSnapshot('line1\nline2');

    const result = comparator.compare(snap1, snap2);
    expect(result.identical).toBe(false);
    expect(result.additions).toBe(1);
  });

  it('detects deletions', () => {
    const snap1 = createSnapshot('line1\nline2');
    const snap2 = createSnapshot('line1');

    const result = comparator.compare(snap1, snap2);
    expect(result.deletions).toBe(1);
  });

  it('ignores whitespace when option set', () => {
    const snap1 = createSnapshot('hello world');
    const snap2 = createSnapshot('hello   world');

    const result = comparator.compare(snap1, snap2, { ignoreWhitespace: true });
    expect(result.identical).toBe(true);
  });

  it('ignores case when option set', () => {
    const snap1 = createSnapshot('HELLO');
    const snap2 = createSnapshot('hello');

    const result = comparator.compare(snap1, snap2, { ignoreCase: true });
    expect(result.identical).toBe(true);
  });

  it('ignores JSON fields when specified', () => {
    const snap1 = createSnapshot('{"name": "test", "id": 1}', 'json');
    const snap2 = createSnapshot('{"name": "test", "id": 2}', 'json');

    const result = comparator.compare(snap1, snap2, { ignoreFields: ['id'] });
    expect(result.identical).toBe(true);
  });

  it('calculates similarity percentage', () => {
    const snap1 = createSnapshot('abcdef');
    const snap2 = createSnapshot('abcxyz');

    const result = comparator.compare(snap1, snap2);
    expect(result.similarity).toBeGreaterThan(0);
    expect(result.similarity).toBeLessThan(100);
  });

  it('includes diff output', () => {
    const snap1 = createSnapshot('old line');
    const snap2 = createSnapshot('new line');

    const result = comparator.compare(snap1, snap2);
    expect(result.diff).toContain('- old line');
    expect(result.diff).toContain('+ new line');
  });
});

describe('FileSystemSnapshotStore', () => {
  let tempDir: string;
  let store: FileSystemSnapshotStore;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `snapshots-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
    store = new FileSystemSnapshotStore(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  const createTestSnapshot = (id: string, name: string): import('./snapshot-engine.js').Snapshot => ({
    id,
    name,
    content: 'test content',
    format: 'text',
    hash: 'abc123',
    createdAt: new Date().toISOString(),
  });

  it('saves and loads snapshot', async () => {
    const snapshot = createTestSnapshot('snap1', 'Test Snapshot');
    await store.save(snapshot);

    const loaded = await store.load('snap1');
    expect(loaded).not.toBeNull();
    expect(loaded?.name).toBe('Test Snapshot');
    expect(loaded?.content).toBe('test content');
  });

  it('loads by name', async () => {
    const snapshot = createTestSnapshot('snap1', 'Find Me');
    await store.save(snapshot);

    const loaded = await store.loadByName('Find Me');
    expect(loaded?.id).toBe('snap1');
  });

  it('returns null for non-existent snapshot', async () => {
    const loaded = await store.load('nonexistent');
    expect(loaded).toBeNull();
  });

  it('lists all snapshots', async () => {
    await store.save(createTestSnapshot('snap1', 'First'));
    await store.save(createTestSnapshot('snap2', 'Second'));

    const list = await store.list();
    expect(list).toHaveLength(2);
    expect(list.map(s => s.name)).toContain('First');
    expect(list.map(s => s.name)).toContain('Second');
  });

  it('deletes snapshot', async () => {
    await store.save(createTestSnapshot('snap1', 'To Delete'));
    expect(await store.load('snap1')).not.toBeNull();

    const deleted = await store.delete('snap1');
    expect(deleted).toBe(true);
    expect(await store.load('snap1')).toBeNull();
  });

  it('returns false when deleting non-existent', async () => {
    const result = await store.delete('nonexistent');
    expect(result).toBe(false);
  });

  it('clears all snapshots', async () => {
    await store.save(createTestSnapshot('snap1', 'First'));
    await store.save(createTestSnapshot('snap2', 'Second'));

    await store.clear();

    const list = await store.list();
    expect(list).toHaveLength(0);
  });
});

describe('SnapshotManager', () => {
  let tempDir: string;
  let manager: SnapshotManager;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `snap-manager-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
    manager = createSnapshotManager(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('captures snapshot', async () => {
    const snapshot = await manager.capture('test-snap', 'content', 'text', { key: 'value' });

    expect(snapshot.name).toBe('test-snap');
    expect(snapshot.content).toBe('content');
    expect(snapshot.format).toBe('text');
    expect(snapshot.metadata).toEqual({ key: 'value' });
    expect(snapshot.hash).toBeDefined();
  });

  it('captures JSON snapshot', async () => {
    const data = { name: 'test', value: 123 };
    const snapshot = await manager.captureJson('json-snap', data);

    expect(snapshot.format).toBe('json');
    expect(JSON.parse(snapshot.content)).toEqual(data);
  });

  it('matches existing snapshot', async () => {
    await manager.capture('match-test', 'exact content');

    const { pass, comparison } = await manager.match('match-test', 'exact content');
    expect(pass).toBe(true);
    expect(comparison?.identical).toBe(true);
  });

  it('fails match for different content', async () => {
    await manager.capture('match-test', 'original content');

    const { pass, comparison } = await manager.match('match-test', 'different content');
    expect(pass).toBe(false);
    expect(comparison?.identical).toBe(false);
  });

  it('returns pass:false for non-existent snapshot', async () => {
    const { pass } = await manager.match('nonexistent', 'content');
    expect(pass).toBe(false);
  });

  it('matchOrCapture creates new snapshot', async () => {
    const { pass, isNew } = await manager.matchOrCapture('new-snap', 'new content');
    expect(pass).toBe(true);
    expect(isNew).toBe(true);

    const loaded = await manager.listSnapshots();
    expect(loaded).toHaveLength(1);
  });

  it('matchOrCapture matches existing', async () => {
    await manager.capture('existing', 'content');

    const { pass, isNew } = await manager.matchOrCapture('existing', 'content');
    expect(pass).toBe(true);
    expect(isNew).toBe(false);
  });

  it('updates snapshot', async () => {
    const original = await manager.capture('update-test', 'original');
    const updated = await manager.update('update-test', 'updated content');

    expect(updated).not.toBeNull();
    expect(updated?.content).toBe('updated content');
    expect(updated?.id).toBe(original.id);
  });

  it('returns null when updating non-existent', async () => {
    const result = await manager.update('nonexistent', 'content');
    expect(result).toBeNull();
  });

  it('compares two snapshots', async () => {
    const snap1 = await manager.capture('snap1', 'content A');
    const snap2 = await manager.capture('snap2', 'content B');

    const comparison = await manager.compareSnapshots(snap1.id, snap2.id);
    expect(comparison).not.toBeNull();
    expect(comparison?.identical).toBe(false);
  });

  it('lists snapshots', async () => {
    await manager.capture('snap1', 'content1');
    await manager.capture('snap2', 'content2');

    const list = await manager.listSnapshots();
    expect(list).toHaveLength(2);
  });

  it('deletes snapshot', async () => {
    const snapshot = await manager.capture('to-delete', 'content');
    
    const deleted = await manager.deleteSnapshot(snapshot.id);
    expect(deleted).toBe(true);

    const list = await manager.listSnapshots();
    expect(list).toHaveLength(0);
  });

  it('clears all snapshots', async () => {
    await manager.capture('snap1', 'content1');
    await manager.capture('snap2', 'content2');

    await manager.clearAll();

    const list = await manager.listSnapshots();
    expect(list).toHaveLength(0);
  });
});

describe('Zod Schemas', () => {
  it('validates valid snapshot', () => {
    const snapshot = {
      id: 'test',
      name: 'Test',
      content: 'content',
      format: 'text',
      hash: 'hash123',
      createdAt: new Date().toISOString(),
    };
    const result = SnapshotSchema.safeParse(snapshot);
    expect(result.success).toBe(true);
  });

  it('rejects invalid format', () => {
    const snapshot = {
      id: 'test',
      name: 'Test',
      content: 'content',
      format: 'invalid',
      hash: 'hash',
      createdAt: new Date().toISOString(),
    };
    const result = SnapshotSchema.safeParse(snapshot);
    expect(result.success).toBe(false);
  });

  it('validates valid comparison', () => {
    const comparison = {
      identical: true,
      additions: 0,
      deletions: 0,
      modifications: 0,
      diff: '',
      similarity: 100,
    };
    const result = SnapshotComparisonSchema.safeParse(comparison);
    expect(result.success).toBe(true);
  });

  it('rejects invalid similarity', () => {
    const comparison = {
      identical: true,
      additions: 0,
      deletions: 0,
      modifications: 0,
      diff: '',
      similarity: 150, // Invalid: > 100
    };
    const result = SnapshotComparisonSchema.safeParse(comparison);
    expect(result.success).toBe(false);
  });
});
