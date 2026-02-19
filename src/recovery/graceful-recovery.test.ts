// Graceful Recovery Tests — Comprehensive test coverage for KIMI-POLISH-06

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, rmSync, existsSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  saveCheckpoint,
  loadCheckpoint,
  listResumableCheckpoints,
  deleteCheckpoint,
  isFallbackTrigger,
  selectFallbackModel,
  enqueueConvexEvent,
  flushOfflineQueue,
  offlineQueueSize,
  validateVault,
  formatError,
} from './graceful-recovery.js';

// ============================================================================
// Test Setup
// ============================================================================

const TEST_CHECKPOINTS_DIR = join(process.cwd(), '.nova', 'checkpoints');
const TEST_OFFLINE_QUEUE_FILE = join(process.cwd(), '.nova', 'offline-queue.jsonl');

function cleanup(): void {
  // Clean up checkpoints
  try {
    if (existsSync(TEST_CHECKPOINTS_DIR)) {
      rmSync(TEST_CHECKPOINTS_DIR, { recursive: true });
    }
  } catch {
    // Ignore cleanup errors
  }

  // Clean up offline queue
  try {
    if (existsSync(TEST_OFFLINE_QUEUE_FILE)) {
      rmSync(TEST_OFFLINE_QUEUE_FILE);
    }
  } catch {
    // Ignore cleanup errors
  }
}

// ============================================================================
// Test Suite
// ============================================================================

describe('Graceful Recovery', () => {
  beforeEach(() => {
    cleanup();
    mkdirSync(TEST_CHECKPOINTS_DIR, { recursive: true });
  });

  afterEach(() => {
    cleanup();
  });

  // ============================================================================
  // saveCheckpoint
  // ============================================================================

  describe('saveCheckpoint()', () => {
    it('writes valid JSON file', () => {
      const checkpoint = {
        id: 'test-checkpoint-1',
        buildId: 'build-1',
        checkpointedAt: new Date().toISOString(),
        resumable: true,
        tasks: [{ id: 'task-1', status: 'completed' as const }],
        metadata: { key: 'value' },
      };

      saveCheckpoint(checkpoint);

      const filePath = join(TEST_CHECKPOINTS_DIR, 'test-checkpoint-1.json');
      expect(existsSync(filePath)).toBe(true);

      const content = readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed.id).toBe('test-checkpoint-1');
      expect(parsed.buildId).toBe('build-1');
    });

    it('creates .nova/checkpoints/ directory', () => {
      // Remove directory first
      cleanup();
      
      const checkpoint = {
        id: 'test-checkpoint-1',
        buildId: 'build-1',
        checkpointedAt: new Date().toISOString(),
        resumable: true,
        tasks: [],
        metadata: {},
      };

      saveCheckpoint(checkpoint);

      expect(existsSync(TEST_CHECKPOINTS_DIR)).toBe(true);
    });

    it('overwrites existing checkpoint', () => {
      const id = 'overwrite-test';
      
      const checkpoint1 = {
        id,
        buildId: 'build-1',
        checkpointedAt: new Date().toISOString(),
        resumable: true,
        tasks: [{ id: 'task-1', status: 'pending' as const }],
        metadata: { version: 1 },
      };

      const checkpoint2 = {
        id,
        buildId: 'build-2',
        checkpointedAt: new Date().toISOString(),
        resumable: false,
        tasks: [{ id: 'task-1', status: 'completed' as const }],
        metadata: { version: 2 },
      };

      saveCheckpoint(checkpoint1);
      saveCheckpoint(checkpoint2);

      const loaded = loadCheckpoint(id);
      expect(loaded).not.toBeNull();
      expect(loaded?.buildId).toBe('build-2');
      expect(loaded?.resumable).toBe(false);
      expect(loaded?.tasks[0].status).toBe('completed');
    });
  });

  // ============================================================================
  // loadCheckpoint
  // ============================================================================

  describe('loadCheckpoint()', () => {
    it('returns saved checkpoint', () => {
      const checkpoint = {
        id: 'load-test',
        buildId: 'build-1',
        checkpointedAt: new Date().toISOString(),
        resumable: true,
        tasks: [
          { id: 'task-1', status: 'completed' as const, output: 'done' },
          { id: 'task-2', status: 'running' as const },
        ],
        metadata: { foo: 'bar' },
      };

      saveCheckpoint(checkpoint);
      const loaded = loadCheckpoint('load-test');

      expect(loaded).not.toBeNull();
      expect(loaded?.id).toBe('load-test');
      expect(loaded?.buildId).toBe('build-1');
      expect(loaded?.resumable).toBe(true);
      expect(loaded?.tasks).toHaveLength(2);
      expect(loaded?.metadata).toEqual({ foo: 'bar' });
    });

    it('returns null when no file exists', () => {
      const result = loadCheckpoint('non-existent-checkpoint');
      expect(result).toBeNull();
    });

    it('returns null for invalid JSON', () => {
      const filePath = join(TEST_CHECKPOINTS_DIR, 'invalid.json');
      writeFileSync(filePath, 'not valid json {', 'utf-8');

      const result = loadCheckpoint('invalid');
      expect(result).toBeNull();
    });

    it('returns null for Zod validation failure', () => {
      const filePath = join(TEST_CHECKPOINTS_DIR, 'invalid-schema.json');
      const invalidData = {
        id: 'invalid-schema',
        // Missing required fields
        buildId: 'build-1',
        checkpointedAt: 'not-a-valid-date',
        resumable: 'yes', // Should be boolean
        tasks: 'not-an-array',
        metadata: {},
      };
      writeFileSync(filePath, JSON.stringify(invalidData), 'utf-8');

      const result = loadCheckpoint('invalid-schema');
      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // listResumableCheckpoints
  // ============================================================================

  describe('listResumableCheckpoints()', () => {
    it('returns only resumable=true', () => {
      const now = new Date();
      
      const resumable1 = {
        id: 'resumable-1',
        buildId: 'build-1',
        checkpointedAt: new Date(now.getTime() - 2000).toISOString(),
        resumable: true,
        tasks: [],
        metadata: {},
      };

      const resumable2 = {
        id: 'resumable-2',
        buildId: 'build-1',
        checkpointedAt: new Date(now.getTime() - 1000).toISOString(),
        resumable: true,
        tasks: [],
        metadata: {},
      };

      const notResumable = {
        id: 'not-resumable',
        buildId: 'build-1',
        checkpointedAt: now.toISOString(),
        resumable: false,
        tasks: [],
        metadata: {},
      };

      saveCheckpoint(resumable1);
      saveCheckpoint(notResumable);
      saveCheckpoint(resumable2);

      const result = listResumableCheckpoints();

      expect(result).toHaveLength(2);
      expect(result.map(c => c.id)).toContain('resumable-1');
      expect(result.map(c => c.id)).toContain('resumable-2');
      expect(result.map(c => c.id)).not.toContain('not-resumable');
    });

    it('sorted by checkpointedAt desc', () => {
      const now = new Date();
      
      const checkpoint1 = {
        id: 'older',
        buildId: 'build-1',
        checkpointedAt: new Date(now.getTime() - 2000).toISOString(),
        resumable: true,
        tasks: [],
        metadata: {},
      };

      const checkpoint2 = {
        id: 'newer',
        buildId: 'build-1',
        checkpointedAt: new Date(now.getTime() - 1000).toISOString(),
        resumable: true,
        tasks: [],
        metadata: {},
      };

      const checkpoint3 = {
        id: 'newest',
        buildId: 'build-1',
        checkpointedAt: now.toISOString(),
        resumable: true,
        tasks: [],
        metadata: {},
      };

      saveCheckpoint(checkpoint1);
      saveCheckpoint(checkpoint2);
      saveCheckpoint(checkpoint3);

      const result = listResumableCheckpoints();

      expect(result[0].id).toBe('newest');
      expect(result[1].id).toBe('newer');
      expect(result[2].id).toBe('older');
    });

    it('returns empty array when no checkpoints exist', () => {
      const result = listResumableCheckpoints();
      expect(result).toEqual([]);
    });
  });

  // ============================================================================
  // deleteCheckpoint
  // ============================================================================

  describe('deleteCheckpoint()', () => {
    it('removes file', () => {
      const checkpoint = {
        id: 'to-delete',
        buildId: 'build-1',
        checkpointedAt: new Date().toISOString(),
        resumable: true,
        tasks: [],
        metadata: {},
      };

      saveCheckpoint(checkpoint);
      
      const filePath = join(TEST_CHECKPOINTS_DIR, 'to-delete.json');
      expect(existsSync(filePath)).toBe(true);

      deleteCheckpoint('to-delete');

      expect(existsSync(filePath)).toBe(false);
    });

    it('silent if not exists', () => {
      // Should not throw
      expect(() => deleteCheckpoint('non-existent')).not.toThrow();
    });
  });

  // ============================================================================
  // isFallbackTrigger
  // ============================================================================

  describe('isFallbackTrigger()', () => {
    it("returns true for 'oom'", () => {
      expect(isFallbackTrigger('oom')).toBe(true);
      expect(isFallbackTrigger('OOM error occurred')).toBe(true);
      expect(isFallbackTrigger('Process ran oom')).toBe(true);
    });

    it("returns true for 'out of memory'", () => {
      expect(isFallbackTrigger('out of memory')).toBe(true);
      expect(isFallbackTrigger('System out of memory error')).toBe(true);
    });

    it("returns true for 'timeout'", () => {
      expect(isFallbackTrigger('timeout')).toBe(true);
      expect(isFallbackTrigger('Request timeout')).toBe(true);
    });

    it("returns true for '500'", () => {
      expect(isFallbackTrigger('500')).toBe(true);
      expect(isFallbackTrigger('HTTP 500 error')).toBe(true);
      expect(isFallbackTrigger('Status code: 500')).toBe(true);
    });

    it('is case-insensitive', () => {
      expect(isFallbackTrigger('OOM')).toBe(true);
      expect(isFallbackTrigger('Out Of Memory')).toBe(true);
      expect(isFallbackTrigger('TIMEOUT')).toBe(true);
      expect(isFallbackTrigger('Server Error 500')).toBe(true);
    });

    it('returns false for non-trigger errors', () => {
      expect(isFallbackTrigger('file not found')).toBe(false);
      expect(isFallbackTrigger('permission denied')).toBe(false);
      expect(isFallbackTrigger('network error')).toBe(false);
      expect(isFallbackTrigger('')).toBe(false);
    });
  });

  // ============================================================================
  // selectFallbackModel
  // ============================================================================

  describe('selectFallbackModel()', () => {
    it('returns next tier', () => {
      expect(selectFallbackModel('gpt-4o')).toBe('claude-3-sonnet');
      expect(selectFallbackModel('claude-3-sonnet')).toBe('gpt-4o-mini');
      expect(selectFallbackModel('gpt-4o-mini')).toBe('claude-3-haiku');
    });

    it('returns null at end of chain', () => {
      expect(selectFallbackModel('claude-3-haiku')).toBeNull();
    });

    it('returns null for unknown model', () => {
      expect(selectFallbackModel('unknown-model')).toBeNull();
    });
  });

  // ============================================================================
  // enqueueConvexEvent
  // ============================================================================

  describe('enqueueConvexEvent()', () => {
    it('appends to offline-queue.jsonl', () => {
      enqueueConvexEvent('test-event', { key: 'value' });

      expect(existsSync(TEST_OFFLINE_QUEUE_FILE)).toBe(true);
      
      const content = readFileSync(TEST_OFFLINE_QUEUE_FILE, 'utf-8');
      const lines = content.trim().split('\n');
      expect(lines).toHaveLength(1);

      const event = JSON.parse(lines[0]);
      expect(event.type).toBe('test-event');
      expect(event.payload).toEqual({ key: 'value' });
      expect(event.status).toBe('pending');
      expect(event.attempts).toBe(0);
    });

    it('appends multiple events', () => {
      enqueueConvexEvent('event-1', { data: 1 });
      enqueueConvexEvent('event-2', { data: 2 });

      const content = readFileSync(TEST_OFFLINE_QUEUE_FILE, 'utf-8');
      const lines = content.trim().split('\n');
      expect(lines).toHaveLength(2);

      const event1 = JSON.parse(lines[0]);
      const event2 = JSON.parse(lines[1]);
      
      expect(event1.type).toBe('event-1');
      expect(event2.type).toBe('event-2');
    });
  });

  // ============================================================================
  // flushOfflineQueue
  // ============================================================================

  describe('flushOfflineQueue()', () => {
    it('POSTs to Convex', async () => {
      const mockPost = vi.fn().mockResolvedValue(true);
      
      enqueueConvexEvent('test-event', { key: 'value' });
      
      const result = await flushOfflineQueue(mockPost);
      
      expect(mockPost).toHaveBeenCalledTimes(1);
      expect(mockPost).toHaveBeenCalledWith('test-event', { key: 'value' });
      expect(result.processed).toBe(1);
    });

    it('marks failed after 5 attempts', async () => {
      const mockPost = vi.fn().mockResolvedValue(false);
      
      // Create event with 4 existing attempts
      const event = {
        id: 'event-1',
        type: 'test',
        payload: {},
        attempts: 4,
        status: 'retrying',
        createdAt: new Date().toISOString(),
      };
      
      writeFileSync(TEST_OFFLINE_QUEUE_FILE, JSON.stringify(event) + '\n');
      
      const result = await flushOfflineQueue(mockPost);
      
      expect(result.processed).toBe(0);
      expect(result.failed).toBe(1);
      
      // Verify event marked as failed
      const content = readFileSync(TEST_OFFLINE_QUEUE_FILE, 'utf-8');
      const savedEvent = JSON.parse(content.trim());
      expect(savedEvent.status).toBe('failed');
      expect(savedEvent.attempts).toBe(5);
    });

    it('returns zero when no queue file exists', async () => {
      const mockPost = vi.fn();
      
      const result = await flushOfflineQueue(mockPost);
      
      expect(result.processed).toBe(0);
      expect(result.failed).toBe(0);
      expect(mockPost).not.toHaveBeenCalled();
    });

    it('processes only pending/retrying events', async () => {
      const mockPost = vi.fn().mockResolvedValue(true);
      
      // Create mixed events
      const pendingEvent = {
        id: 'pending',
        type: 'test',
        payload: {},
        attempts: 0,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };
      
      const failedEvent = {
        id: 'failed',
        type: 'test',
        payload: {},
        attempts: 5,
        status: 'failed',
        createdAt: new Date().toISOString(),
      };
      
      const content = JSON.stringify(pendingEvent) + '\n' + JSON.stringify(failedEvent) + '\n';
      writeFileSync(TEST_OFFLINE_QUEUE_FILE, content);
      
      const result = await flushOfflineQueue(mockPost);
      
      expect(mockPost).toHaveBeenCalledTimes(1);
      expect(result.processed).toBe(1);
    });
  });

  // ============================================================================
  // offlineQueueSize
  // ============================================================================

  describe('offlineQueueSize()', () => {
    it('counts pending/retrying events', () => {
      const now = new Date().toISOString();
      
      const event1 = { id: '1', type: 't', payload: {}, attempts: 0, status: 'pending', createdAt: now };
      const event2 = { id: '2', type: 't', payload: {}, attempts: 1, status: 'retrying', createdAt: now };
      const event3 = { id: '3', type: 't', payload: {}, attempts: 5, status: 'failed', createdAt: now };
      
      const content = [event1, event2, event3].map(e => JSON.stringify(e)).join('\n') + '\n';
      writeFileSync(TEST_OFFLINE_QUEUE_FILE, content);
      
      expect(offlineQueueSize()).toBe(2); // pending + retrying, not failed
    });

    it('returns 0 when no file exists', () => {
      expect(offlineQueueSize()).toBe(0);
    });

    it('returns 0 when queue is empty', () => {
      writeFileSync(TEST_OFFLINE_QUEUE_FILE, '');
      expect(offlineQueueSize()).toBe(0);
    });

    it('skips invalid lines', () => {
      writeFileSync(TEST_OFFLINE_QUEUE_FILE, 'invalid json\n' + JSON.stringify({
        id: '1', type: 't', payload: {}, attempts: 0, status: 'pending', createdAt: new Date().toISOString()
      }) + '\n');
      
      expect(offlineQueueSize()).toBe(1);
    });
  });

  // ============================================================================
  // validateVault
  // ============================================================================

  describe('validateVault()', () => {
    it('removes orphan edges', () => {
      const vaultData = JSON.stringify({
        nodes: [
          { id: 'node-1', type: 'file', data: {} },
          { id: 'node-2', type: 'file', data: {} },
        ],
        edges: [
          { from: 'node-1', to: 'node-2', relation: 'imports' },
          { from: 'node-1', to: 'orphan', relation: 'imports' }, // orphan
          { from: 'nonexistent', to: 'node-2', relation: 'imports' }, // orphan
        ],
      });

      const result = validateVault(vaultData);

      expect(result.orphanEdgesRemoved).toBe(2);
      expect(result.isHealthy).toBe(false);
    });

    it('resolves duplicate IDs', () => {
      const vaultData = JSON.stringify({
        nodes: [
          { id: 'dup-1', type: 'file', data: {} },
          { id: 'dup-1', type: 'file', data: {} }, // duplicate
          { id: 'unique', type: 'file', data: {} },
        ],
        edges: [],
      });

      const result = validateVault(vaultData);

      expect(result.duplicateIdsResolved).toBe(1);
      expect(result.isHealthy).toBe(false);
    });

    it('returns isHealthy:false on invalid JSON', () => {
      const result = validateVault('not valid json {');

      expect(result.isHealthy).toBe(false);
      expect(result.errors).toContain('Invalid JSON');
    });

    it('returns isHealthy:true for valid vault', () => {
      const vaultData = JSON.stringify({
        nodes: [
          { id: 'node-1', type: 'file', data: {} },
          { id: 'node-2', type: 'file', data: {} },
        ],
        edges: [
          { from: 'node-1', to: 'node-2', relation: 'imports' },
        ],
      });

      const result = validateVault(vaultData);

      expect(result.isHealthy).toBe(true);
      expect(result.orphanEdgesRemoved).toBe(0);
      expect(result.duplicateIdsResolved).toBe(0);
    });

    it('returns error for missing nodes array', () => {
      const result = validateVault(JSON.stringify({ edges: [] }));
      
      expect(result.isHealthy).toBe(false);
      expect(result.errors).toContain('Missing or invalid nodes array');
    });

    it('returns error for missing edges array', () => {
      const result = validateVault(JSON.stringify({ nodes: [] }));
      
      expect(result.isHealthy).toBe(false);
      expect(result.errors).toContain('Missing or invalid edges array');
    });
  });

  // ============================================================================
  // formatError
  // ============================================================================

  describe('formatError()', () => {
    it('returns user-friendly messages', () => {
      expect(formatError('Connection refused')).toContain('connect');
      expect(formatError('Something went wrong')).toBe('Something went wrong');
    });

    it('never includes "stack"', () => {
      const error = new Error('Test error');
      error.stack = 'Error: Test error\n  at file.ts:1:1\n  at other.ts:2:2';
      
      const result = formatError(error);
      expect(result).not.toContain('stack');
      expect(result).not.toContain('at file.ts');
    });

    it('never includes "Error:" prefix', () => {
      const error = new Error('Something went wrong');
      
      const result = formatError(error);
      expect(result).not.toMatch(/^Error:/);
      expect(result).toBe('Something went wrong');
    });

    it('handles string errors', () => {
      expect(formatError('Plain string error')).toBe('Plain string error');
    });

    it('handles null/undefined', () => {
      expect(formatError(null)).toBe('An unknown error occurred');
      expect(formatError(undefined)).toBe('An unknown error occurred');
    });

    it('translates OOM errors', () => {
      expect(formatError('oom')).toBe('System ran out of memory. Try reducing the task size.');
      expect(formatError('Process ran out of memory')).toBe('System ran out of memory. Try reducing the task size.');
    });

    it('translates timeout errors', () => {
      expect(formatError('timeout')).toBe('The operation timed out. Please try again.');
    });

    it('translates connection errors', () => {
      expect(formatError('connection refused')).toContain('Could not connect');
      expect(formatError('ECONNREFUSED')).toContain('Could not connect');
      expect(formatError('ENOTFOUND')).toContain('Could not resolve');
    });

    it('handles objects with message property', () => {
      const errorObj = { message: 'Custom error object' };
      expect(formatError(errorObj)).toBe('Custom error object');
    });
  });
});
