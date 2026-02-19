// Build Snapshot Tests — R17-01 Advanced Error Recovery
// 18 tests covering create, load, list, compare, prune, hash, compatibility

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BuildSnapshotManager, simpleHash } from './build-snapshot.js';
import type { BuildSnapshot } from './build-snapshot.js';

describe('BuildSnapshotManager', () => {
  let manager: BuildSnapshotManager;
  let mockFs: {
    writeFile: ReturnType<typeof vi.fn>;
    readFile: ReturnType<typeof vi.fn>;
    listFiles: ReturnType<typeof vi.fn>;
    exists: ReturnType<typeof vi.fn>;
    mkdir: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    mockFs = {
      writeFile: vi.fn(),
      readFile: vi.fn().mockReturnValue('{}'),
      listFiles: vi.fn().mockReturnValue([]),
      exists: vi.fn().mockReturnValue(false),
      mkdir: vi.fn(),
      remove: vi.fn(),
    };
    manager = new BuildSnapshotManager({ maxSnapshots: 5 }, mockFs);
  });

  // 1
  it('createSnapshot returns a snapshot with UUID id', () => {
    const snap = manager.createSnapshot('build-1', { 'a.ts': 'abc' }, { typescript: '5.0.0' });
    expect(snap.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(snap.buildId).toBe('build-1');
  });

  // 2
  it('createSnapshot stores ISO 8601 createdAt', () => {
    vi.setSystemTime(new Date('2026-01-15T10:00:00.000Z'));
    const snap = manager.createSnapshot('build-1', {}, {});
    expect(snap.createdAt).toBe('2026-01-15T10:00:00.000Z');
  });

  // 3
  it('createSnapshot persists to disk via fsOps', () => {
    manager.createSnapshot('build-1', { 'a.ts': 'hash1' }, {});
    expect(mockFs.mkdir).toHaveBeenCalledWith('.nova/snapshots');
    expect(mockFs.writeFile).toHaveBeenCalledTimes(1);
    const callArgs = mockFs.writeFile.mock.calls[0];
    expect(callArgs[0]).toMatch(/\.nova\/snapshots\/.*\.json$/);
  });

  // 4
  it('loadSnapshot returns in-memory snapshot', () => {
    const snap = manager.createSnapshot('build-1', {}, {});
    const loaded = manager.loadSnapshot(snap.id);
    expect(loaded).not.toBeNull();
    expect(loaded?.id).toBe(snap.id);
  });

  // 5
  it('loadSnapshot returns null for unknown id when file not found', () => {
    mockFs.exists.mockReturnValue(false);
    const loaded = manager.loadSnapshot('nonexistent-id');
    expect(loaded).toBeNull();
  });

  // 6
  it('loadSnapshot loads from disk if not in memory', () => {
    const diskSnap: BuildSnapshot = {
      id: 'disk-snap-1',
      buildId: 'build-disk',
      createdAt: '2026-01-01T00:00:00.000Z',
      files: { 'x.ts': 'h1' },
      dependencies: {},
      environmentHash: 'abc',
      metadata: {},
    };
    mockFs.exists.mockReturnValue(true);
    mockFs.readFile.mockReturnValue(JSON.stringify(diskSnap));

    const freshManager = new BuildSnapshotManager({}, mockFs);
    const loaded = freshManager.loadSnapshot('disk-snap-1');
    expect(loaded).not.toBeNull();
    expect(loaded?.buildId).toBe('build-disk');
  });

  // 7
  it('getLatestSnapshot returns the newest snapshot', () => {
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    manager.createSnapshot('build-1', {}, {});
    vi.setSystemTime(new Date('2026-01-02T00:00:00Z'));
    const latest = manager.createSnapshot('build-1', {}, {});

    const result = manager.getLatestSnapshot();
    expect(result?.id).toBe(latest.id);
  });

  // 8
  it('getLatestSnapshot filters by buildId', () => {
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const snapA = manager.createSnapshot('build-A', {}, {});
    vi.setSystemTime(new Date('2026-01-02T00:00:00Z'));
    manager.createSnapshot('build-B', {}, {});

    const result = manager.getLatestSnapshot('build-A');
    expect(result?.id).toBe(snapA.id);
  });

  // 9
  it('getLatestSnapshot returns null when empty', () => {
    expect(manager.getLatestSnapshot()).toBeNull();
  });

  // 10
  it('listSnapshots returns all sorted by createdAt desc', () => {
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    manager.createSnapshot('b1', {}, {});
    vi.setSystemTime(new Date('2026-01-03T00:00:00Z'));
    manager.createSnapshot('b1', {}, {});
    vi.setSystemTime(new Date('2026-01-02T00:00:00Z'));
    manager.createSnapshot('b1', {}, {});

    const list = manager.listSnapshots();
    expect(list).toHaveLength(3);
    expect(new Date(list[0].createdAt).getTime()).toBeGreaterThanOrEqual(
      new Date(list[1].createdAt).getTime(),
    );
    expect(new Date(list[1].createdAt).getTime()).toBeGreaterThanOrEqual(
      new Date(list[2].createdAt).getTime(),
    );
  });

  // 11
  it('listSnapshots filters by buildId', () => {
    manager.createSnapshot('alpha', {}, {});
    manager.createSnapshot('beta', {}, {});
    manager.createSnapshot('alpha', {}, {});

    const alphaSnaps = manager.listSnapshots('alpha');
    expect(alphaSnaps).toHaveLength(2);
    expect(alphaSnaps.every(s => s.buildId === 'alpha')).toBe(true);
  });

  // 12
  it('compareSnapshots detects added, removed, modified, unchanged', () => {
    const a: BuildSnapshot = {
      id: 'a', buildId: 'b', createdAt: '', environmentHash: '',
      files: { 'keep.ts': 'h1', 'modify.ts': 'old', 'remove.ts': 'h3' },
      dependencies: {}, metadata: {},
    };
    const b: BuildSnapshot = {
      id: 'b', buildId: 'b', createdAt: '', environmentHash: '',
      files: { 'keep.ts': 'h1', 'modify.ts': 'new', 'add.ts': 'h4' },
      dependencies: {}, metadata: {},
    };

    const diff = manager.compareSnapshots(a, b);
    expect(diff.added).toEqual(['add.ts']);
    expect(diff.removed).toEqual(['remove.ts']);
    expect(diff.modified).toEqual(['modify.ts']);
    expect(diff.unchangedCount).toBe(1);
  });

  // 13
  it('compareSnapshots returns empty diff for identical snapshots', () => {
    const snap: BuildSnapshot = {
      id: 'a', buildId: 'b', createdAt: '', environmentHash: '',
      files: { 'a.ts': 'h1', 'b.ts': 'h2' },
      dependencies: {}, metadata: {},
    };

    const diff = manager.compareSnapshots(snap, snap);
    expect(diff.added).toHaveLength(0);
    expect(diff.removed).toHaveLength(0);
    expect(diff.modified).toHaveLength(0);
    expect(diff.unchangedCount).toBe(2);
  });

  // 14
  it('pruneOldSnapshots removes snapshots beyond maxSnapshots', () => {
    const mgr = new BuildSnapshotManager({ maxSnapshots: 2 }, mockFs);
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    mgr.createSnapshot('b1', {}, {});
    vi.setSystemTime(new Date('2026-01-02T00:00:00Z'));
    mgr.createSnapshot('b1', {}, {});
    vi.setSystemTime(new Date('2026-01-03T00:00:00Z'));
    mgr.createSnapshot('b1', {}, {});

    const pruned = mgr.pruneOldSnapshots();
    expect(pruned).toBe(1);
    expect(mgr.listSnapshots()).toHaveLength(2);
  });

  // 15
  it('pruneOldSnapshots removes snapshots older than maxAge', () => {
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    manager.createSnapshot('b1', {}, {});
    vi.setSystemTime(new Date('2026-01-10T00:00:00Z'));
    manager.createSnapshot('b1', {}, {});

    // maxAge of 5 days in ms
    const pruned = manager.pruneOldSnapshots(5 * 24 * 60 * 60 * 1000);
    expect(pruned).toBe(1);
    expect(manager.listSnapshots()).toHaveLength(1);
  });

  // 16
  it('computeEnvironmentHash is deterministic', () => {
    const deps = { typescript: '5.0.0', vitest: '1.0.0' };
    const hash1 = manager.computeEnvironmentHash(deps);
    const hash2 = manager.computeEnvironmentHash(deps);
    expect(hash1).toBe(hash2);
  });

  // 17
  it('computeEnvironmentHash produces different hashes for different deps', () => {
    const hash1 = manager.computeEnvironmentHash({ typescript: '5.0.0' });
    const hash2 = manager.computeEnvironmentHash({ typescript: '5.1.0' });
    expect(hash1).not.toBe(hash2);
  });

  // 18
  it('isCompatible returns true for same environment hash', () => {
    const deps = { typescript: '5.0.0' };
    const s1 = manager.createSnapshot('b1', {}, deps);
    const s2 = manager.createSnapshot('b2', {}, deps);
    expect(manager.isCompatible(s1, s2)).toBe(true);

    const s3 = manager.createSnapshot('b3', {}, { typescript: '6.0.0' });
    expect(manager.isCompatible(s1, s3)).toBe(false);
  });
});

describe('simpleHash', () => {
  it('returns a hex string', () => {
    const hash = simpleHash('hello');
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  it('returns empty string hash for empty input', () => {
    const hash = simpleHash('');
    expect(hash).toBe('0');
  });
});
