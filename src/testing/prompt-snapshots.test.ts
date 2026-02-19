/**
 * Tests for KIMI-POLISH-03: Prompt Snapshot Testing
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  PromptSnapshotManager,
  getPromptSnapshotManager,
  resetPromptSnapshotManager,
  STANDARD_TASK_TYPES,
  PromptSnapshotSchema,
  type PromptSnapshot,
  type DriftResult,
} from './prompt-snapshots.js';

// ============================================================================
// Test Setup
// ============================================================================

describe('PromptSnapshotManager', () => {
  let tempDir: string;
  let manager: PromptSnapshotManager;

  beforeEach(async () => {
    // Create a unique temp directory for each test
    tempDir = join(tmpdir(), `nova-snapshots-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.mkdir(tempDir, { recursive: true });
    
    manager = new PromptSnapshotManager({
      snapshotDir: tempDir,
      version: '1.0.0',
    });
  });

  afterEach(async () => {
    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    resetPromptSnapshotManager();
  });

  // ==========================================================================
  // captureSnapshot
  // ==========================================================================

  describe('captureSnapshot', () => {
    it('should capture and store a snapshot with computed hash', async () => {
      const prompt = 'Generate code for user authentication';
      const snapshot = await manager.captureSnapshot('EARTH', 'code-generation', prompt);

      expect(snapshot.agent).toBe('EARTH');
      expect(snapshot.taskType).toBe('code-generation');
      expect(snapshot.prompt).toBe(prompt);
      expect(snapshot.promptHash).toBeDefined();
      expect(snapshot.promptHash).toHaveLength(64); // SHA-256 hex length
      expect(snapshot.capturedAt).toBeDefined();
      expect(snapshot.version).toBe('1.0.0');
    });

    it('should write snapshot to disk as JSON', async () => {
      const prompt = 'Test prompt content';
      await manager.captureSnapshot('MARS', 'testing', prompt);

      const filepath = join(tempDir, 'MARS-testing.snap');
      const content = await fs.readFile(filepath, 'utf-8');
      const parsed = JSON.parse(content);

      expect(parsed.agent).toBe('MARS');
      expect(parsed.taskType).toBe('testing');
      expect(parsed.prompt).toBe(prompt);
    });

    it('should sanitize special characters in filenames', async () => {
      await manager.captureSnapshot('agent/with/slashes', 'task.type', 'prompt');
      
      const files = await fs.readdir(tempDir);
      expect(files).toHaveLength(1);
      expect(files[0]).toBe('agent_with_slashes-task_type.snap');
    });
  });

  // ==========================================================================
  // loadSnapshot
  // ==========================================================================

  describe('loadSnapshot', () => {
    it('should load an existing snapshot', async () => {
      const prompt = 'Original prompt';
      await manager.captureSnapshot('VENUS', 'architecture', prompt);

      const loaded = await manager.loadSnapshot('VENUS', 'architecture');
      
      expect(loaded).not.toBeNull();
      expect(loaded?.agent).toBe('VENUS');
      expect(loaded?.taskType).toBe('architecture');
      expect(loaded?.prompt).toBe(prompt);
    });

    it('should return null for non-existent snapshot', async () => {
      const loaded = await manager.loadSnapshot('NONEXISTENT', 'unknown');
      expect(loaded).toBeNull();
    });

    it('should return null for invalid snapshot JSON', async () => {
      // Write invalid content directly
      await fs.writeFile(join(tempDir, 'INVALID-bad.snap'), 'not valid json', 'utf-8');
      
      const loaded = await manager.loadSnapshot('INVALID', 'bad');
      expect(loaded).toBeNull();
    });
  });

  // ==========================================================================
  // detectPromptDrift
  // ==========================================================================

  describe('detectPromptDrift', () => {
    it('should return no drift when prompts match', async () => {
      const prompt = 'Consistent prompt content';
      await manager.captureSnapshot('MERCURY', 'review', prompt);

      const result = await manager.detectPromptDrift('MERCURY', 'review', prompt);
      
      expect(result.drifted).toBe(false);
    });

    it('should detect drift when prompt has changed', async () => {
      const oldPrompt = 'Original prompt version';
      const newPrompt = 'Modified prompt version';
      
      await manager.captureSnapshot('JUPITER', 'debugging', oldPrompt);
      const result = await manager.detectPromptDrift('JUPITER', 'debugging', newPrompt);
      
      expect(result.drifted).toBe(true);
      if (result.drifted) {
        expect(result.agent).toBe('JUPITER');
        expect(result.taskType).toBe('debugging');
        expect(result.oldHash).not.toBe(result.newHash);
        expect(result.diffSummary).toContain('modified');
      }
    });

    it('should return no drift when no snapshot exists', async () => {
      const result = await manager.detectPromptDrift('NEWAGENT', 'newtask', 'prompt');
      expect(result.drifted).toBe(false);
    });

    it('should include line count changes in diff summary', async () => {
      const oldPrompt = 'Line 1\nLine 2\nLine 3';
      const newPrompt = 'Line 1\nModified Line 2\nLine 3\nLine 4';
      
      await manager.captureSnapshot('SATURN', 'code-generation', oldPrompt);
      const result = await manager.detectPromptDrift('SATURN', 'code-generation', newPrompt);
      
      expect(result.drifted).toBe(true);
      if (result.drifted) {
        expect(result.diffSummary).toContain('+1 lines');
        expect(result.diffSummary).toContain('~1 lines modified');
      }
    });
  });

  // ==========================================================================
  // updateSnapshot
  // ==========================================================================

  describe('updateSnapshot', () => {
    it('should overwrite existing snapshot', async () => {
      const oldPrompt = 'First version';
      const newPrompt = 'Second version';
      
      await manager.captureSnapshot('NEPTUNE', 'testing', oldPrompt);
      const firstSnapshot = await manager.loadSnapshot('NEPTUNE', 'testing');
      
      await manager.updateSnapshot('NEPTUNE', 'testing', newPrompt);
      const updatedSnapshot = await manager.loadSnapshot('NEPTUNE', 'testing');
      
      expect(updatedSnapshot?.prompt).toBe(newPrompt);
      expect(updatedSnapshot?.promptHash).not.toBe(firstSnapshot?.promptHash);
    });
  });

  // ==========================================================================
  // detectAllDrift
  // ==========================================================================

  describe('detectAllDrift', () => {
    it('should check all existing snapshots for drift', async () => {
      const prompts: Record<string, string> = {
        'EARTH-code-generation': 'Earth prompt v1',
        'MARS-testing': 'Mars prompt v1',
        'VENUS-architecture': 'Venus prompt v1',
      };

      // Create snapshots
      for (const [key, prompt] of Object.entries(prompts)) {
        const [agent, taskType] = key.split('-');
        await manager.captureSnapshot(agent, taskType, prompt);
      }

      // Mock render function that returns same prompts (no drift)
      const renderPrompt = vi.fn(async (agent: string, taskType: string) => {
        return prompts[`${agent}-${taskType}`];
      });

      const results = await manager.detectAllDrift(renderPrompt);
      
      expect(results).toHaveLength(3);
      expect(results.every(r => !r.drifted)).toBe(true);
    });

    it('should detect drift in multiple snapshots', async () => {
      // Create initial snapshots
      await manager.captureSnapshot('AGENT1', 'task1', 'original 1');
      await manager.captureSnapshot('AGENT2', 'task2', 'original 2');

      // Mock render that returns changed prompts
      let callCount = 0;
      const renderPrompt = vi.fn(async () => {
        callCount++;
        return `modified ${callCount}`;
      });

      const results = await manager.detectAllDrift(renderPrompt);
      
      const driftedResults = results.filter(r => r.drifted);
      expect(driftedResults).toHaveLength(2);
    });
  });

  // ==========================================================================
  // listSnapshots
  // ==========================================================================

  describe('listSnapshots', () => {
    it('should list all stored snapshots', async () => {
      await manager.captureSnapshot('A1', 'type1', 'prompt1');
      await manager.captureSnapshot('A2', 'type2', 'prompt2');
      await manager.captureSnapshot('A3', 'type3', 'prompt3');

      const list = await manager.listSnapshots();
      
      expect(list).toHaveLength(3);
      expect(list).toContainEqual({ agent: 'A1', taskType: 'type1' });
      expect(list).toContainEqual({ agent: 'A2', taskType: 'type2' });
      expect(list).toContainEqual({ agent: 'A3', taskType: 'type3' });
    });

    it('should return empty array when no snapshots exist', async () => {
      const list = await manager.listSnapshots();
      expect(list).toEqual([]);
    });
  });

  // ==========================================================================
  // Singleton Factory
  // ==========================================================================

  describe('getPromptSnapshotManager', () => {
    it('should return singleton instance', () => {
      resetPromptSnapshotManager();
      
      const instance1 = getPromptSnapshotManager();
      const instance2 = getPromptSnapshotManager();
      
      expect(instance1).toBe(instance2);
    });

    it('should create new instance after reset', () => {
      resetPromptSnapshotManager();
      
      const instance1 = getPromptSnapshotManager();
      resetPromptSnapshotManager();
      const instance2 = getPromptSnapshotManager();
      
      expect(instance1).not.toBe(instance2);
    });
  });

  // ==========================================================================
  // STANDARD_TASK_TYPES
  // ==========================================================================

  describe('STANDARD_TASK_TYPES', () => {
    it('should contain expected task types', () => {
      expect(STANDARD_TASK_TYPES).toContain('code-generation');
      expect(STANDARD_TASK_TYPES).toContain('testing');
      expect(STANDARD_TASK_TYPES).toContain('architecture');
      expect(STANDARD_TASK_TYPES).toContain('review');
      expect(STANDARD_TASK_TYPES).toContain('debugging');
    });

    it('should be readonly array', () => {
      // Type check - this should compile
      const types: readonly string[] = STANDARD_TASK_TYPES;
      expect(types).toHaveLength(5);
    });
  });

  // ==========================================================================
  // PromptSnapshotSchema
  // ==========================================================================

  describe('PromptSnapshotSchema', () => {
    it('should validate valid snapshot', () => {
      const valid: PromptSnapshot = {
        agent: 'TEST',
        taskType: 'test',
        prompt: 'test prompt',
        capturedAt: new Date().toISOString(),
        promptHash: 'abc123',
        version: '1.0.0',
      };

      const result = PromptSnapshotSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('should reject invalid snapshot', () => {
      const invalid = {
        agent: 'TEST',
        // missing taskType
        prompt: 'test',
        capturedAt: '2024-01-01',
        promptHash: 'hash',
        version: '1.0.0',
      };

      const result = PromptSnapshotSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });
});
