// Checkpoint System Tests — 15 tests
// Mocks: better-sqlite3, fs, path

import { describe, it, expect, beforeEach, vi } from 'vitest';

// --- Mock setup using vi.hoisted to survive hoisting ---

const { mockRun, mockGet, mockAll, mockExec, mockPrepare } = vi.hoisted(() => {
  const mockRun = vi.fn();
  const mockGet = vi.fn();
  const mockAll = vi.fn();
  const mockExec = vi.fn();
  const mockStmt = { run: mockRun, get: mockGet, all: mockAll };
  const mockPrepare = vi.fn(() => mockStmt);
  return { mockRun, mockGet, mockAll, mockExec, mockPrepare };
});

vi.mock('better-sqlite3', () => {
  return {
    default: function Database() {
      return { prepare: mockPrepare, exec: mockExec };
    },
  };
});

vi.mock('fs', () => ({
  mkdirSync: vi.fn(),
}));

vi.mock('path', () => ({
  join: vi.fn((...parts: string[]) => parts.join('/')),
}));

import {
  saveCheckpoint,
  getLatestCheckpoint,
  saveBuildState,
  loadBuildState,
  listSavedBuilds,
  startAutoSave,
  deleteBuild,
} from '../checkpoint-system.js';

describe('Checkpoint System', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrepare.mockReturnValue({ run: mockRun, get: mockGet, all: mockAll });
  });

  // ─── saveCheckpoint ────────────────────────────────────────

  describe('saveCheckpoint', () => {
    it('should call db.prepare with INSERT statement', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      saveCheckpoint({
        id: 'cp-001',
        buildId: 'build-1',
        tasks: [],
        currentPhase: 1,
        metadata: { note: 'test' },
      });

      expect(mockPrepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO checkpoints'),
      );
      consoleSpy.mockRestore();
    });

    it('should pass serialised tasks and metadata to stmt.run', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const tasks = [{ id: 't1', title: 'Task 1', description: '', agent: 'SUN', status: 'pending' as const, dependencies: [], phase: 1, attempts: 0, createdAt: '' }];
      const metadata = { key: 'value' };

      saveCheckpoint({
        id: 'cp-002',
        buildId: 'build-2',
        tasks,
        currentPhase: 2,
        metadata,
      });

      expect(mockRun).toHaveBeenCalledWith(
        'cp-002',
        'build-2',
        JSON.stringify(tasks),
        2,
        JSON.stringify(metadata),
      );
      consoleSpy.mockRestore();
    });

    it('should log the checkpoint id after saving', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      saveCheckpoint({
        id: 'abcdefgh-rest',
        buildId: 'build-3',
        tasks: [],
        currentPhase: 0,
        metadata: {},
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('abcdefgh'),
      );
      consoleSpy.mockRestore();
    });

    it('should call cleanupOldCheckpoints after saving', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      saveCheckpoint({
        id: 'cp-004',
        buildId: 'build-cleanup',
        tasks: [],
        currentPhase: 0,
        metadata: {},
      });

      // cleanupOldCheckpoints internally calls db.prepare with DELETE
      // First call is INSERT, second call is DELETE (cleanup)
      const deleteCall = mockPrepare.mock.calls.find(
        (call: unknown[]) => typeof call[0] === 'string' && (call[0] as string).includes('DELETE FROM checkpoints'),
      );
      expect(deleteCall).toBeDefined();
      consoleSpy.mockRestore();
    });
  });

  // ─── getLatestCheckpoint ───────────────────────────────────

  describe('getLatestCheckpoint', () => {
    it('should return null when no checkpoint exists', () => {
      mockGet.mockReturnValue(undefined);

      const result = getLatestCheckpoint('build-missing');

      expect(result).toBeNull();
    });

    it('should return a parsed Checkpoint object when row exists', () => {
      mockGet.mockReturnValue({
        id: 'cp-10',
        build_id: 'build-10',
        timestamp: '2026-01-01T00:00:00Z',
        tasks: JSON.stringify([{ id: 't1' }]),
        current_phase: 3,
        metadata: JSON.stringify({ env: 'test' }),
      });

      const result = getLatestCheckpoint('build-10');

      expect(result).toEqual({
        id: 'cp-10',
        buildId: 'build-10',
        timestamp: '2026-01-01T00:00:00Z',
        tasks: [{ id: 't1' }],
        currentPhase: 3,
        metadata: { env: 'test' },
      });
    });

    it('should default metadata to empty object when null', () => {
      mockGet.mockReturnValue({
        id: 'cp-11',
        build_id: 'build-11',
        timestamp: '2026-01-01T00:00:00Z',
        tasks: '[]',
        current_phase: 0,
        metadata: null,
      });

      const result = getLatestCheckpoint('build-11');

      expect(result).not.toBeNull();
      expect(result?.metadata).toEqual({});
    });
  });

  // ─── saveBuildState ────────────────────────────────────────

  describe('saveBuildState', () => {
    it('should call db.prepare with INSERT OR REPLACE', () => {
      saveBuildState({
        buildId: 'b-1',
        prdFile: 'prd.md',
        startTime: '2026-01-01',
        tasks: [],
        completedTasks: [],
        failedTasks: [],
        currentPhase: 0,
        logs: [],
      });

      expect(mockPrepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR REPLACE'),
      );
    });

    it('should serialise arrays before passing to stmt.run', () => {
      const tasks = [{ id: 't1' }];
      const completed = ['t1'];
      const failed = ['t2'];
      const logs = [{ id: 'log1' }];

      saveBuildState({
        buildId: 'b-2',
        prdFile: 'prd.md',
        startTime: '2026-01-01',
        tasks: tasks as never[],
        completedTasks: completed,
        failedTasks: failed,
        currentPhase: 2,
        logs: logs as never[],
      });

      expect(mockRun).toHaveBeenCalledWith(
        'b-2',
        'prd.md',
        '2026-01-01',
        JSON.stringify(tasks),
        JSON.stringify(completed),
        JSON.stringify(failed),
        2,
        JSON.stringify(logs),
      );
    });
  });

  // ─── loadBuildState ────────────────────────────────────────

  describe('loadBuildState', () => {
    it('should return null when no build state exists', () => {
      mockGet.mockReturnValue(undefined);

      const result = loadBuildState('missing');

      expect(result).toBeNull();
    });

    it('should return a parsed BuildState when row exists', () => {
      mockGet.mockReturnValue({
        build_id: 'b-10',
        prd_file: 'prd.md',
        start_time: '2026-01-01',
        tasks: JSON.stringify([{ id: 't1' }]),
        completed_tasks: JSON.stringify(['t1']),
        failed_tasks: JSON.stringify([]),
        current_phase: 1,
        logs: JSON.stringify([{ id: 'log1' }]),
      });

      const result = loadBuildState('b-10');

      expect(result).toEqual({
        buildId: 'b-10',
        prdFile: 'prd.md',
        startTime: '2026-01-01',
        tasks: [{ id: 't1' }],
        completedTasks: ['t1'],
        failedTasks: [],
        currentPhase: 1,
        logs: [{ id: 'log1' }],
      });
    });
  });

  // ─── listSavedBuilds ──────────────────────────────────────

  describe('listSavedBuilds', () => {
    it('should return an empty array when no builds exist', () => {
      mockAll.mockReturnValue([]);

      const result = listSavedBuilds();

      expect(result).toEqual([]);
    });

    it('should map database rows to build summaries', () => {
      mockAll.mockReturnValue([
        { build_id: 'b-1', prd_file: 'a.md', start_time: 't1', updated_at: 'u1' },
        { build_id: 'b-2', prd_file: 'b.md', start_time: 't2', updated_at: 'u2' },
      ]);

      const result = listSavedBuilds();

      expect(result).toEqual([
        { buildId: 'b-1', prdFile: 'a.md', startTime: 't1', updatedAt: 'u1' },
        { buildId: 'b-2', prdFile: 'b.md', startTime: 't2', updatedAt: 'u2' },
      ]);
    });
  });

  // ─── startAutoSave ─────────────────────────────────────────

  describe('startAutoSave', () => {
    it('should return a cleanup function', () => {
      vi.useFakeTimers();
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const getState = vi.fn(() => ({
        buildId: 'auto-1',
        tasks: [],
        currentPhase: 0,
        metadata: {},
      }));

      const cleanup = startAutoSave('auto-1', getState, 1000);

      expect(typeof cleanup).toBe('function');

      cleanup();
      consoleSpy.mockRestore();
      vi.useRealTimers();
    });

    it('should call saveCheckpoint at the specified interval', () => {
      vi.useFakeTimers();
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const getState = vi.fn(() => ({
        buildId: 'auto-2',
        tasks: [],
        currentPhase: 1,
        metadata: {},
      }));

      const cleanup = startAutoSave('auto-2', getState, 500);

      // No calls yet
      expect(getState).not.toHaveBeenCalled();

      // Advance past one interval
      vi.advanceTimersByTime(500);
      expect(getState).toHaveBeenCalledTimes(1);

      // Advance past another interval
      vi.advanceTimersByTime(500);
      expect(getState).toHaveBeenCalledTimes(2);

      cleanup();
      consoleSpy.mockRestore();
      vi.useRealTimers();
    });
  });

  // ─── deleteBuild ───────────────────────────────────────────

  describe('deleteBuild', () => {
    it('should delete from checkpoints table', () => {
      deleteBuild('del-1');

      const checkpointDelete = mockPrepare.mock.calls.find(
        (call: unknown[]) => typeof call[0] === 'string' && (call[0] as string).includes('DELETE FROM checkpoints'),
      );
      expect(checkpointDelete).toBeDefined();
    });

    it('should delete from build_states table', () => {
      deleteBuild('del-2');

      const stateDelete = mockPrepare.mock.calls.find(
        (call: unknown[]) => typeof call[0] === 'string' && (call[0] as string).includes('DELETE FROM build_states'),
      );
      expect(stateDelete).toBeDefined();
    });
  });
});
