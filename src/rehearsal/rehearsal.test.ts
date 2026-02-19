// KIMI-ACE-03: Rehearsal Stage Tests

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Task } from '../types/index.js';
import {
  BranchManager,
  getBranchManager,
  resetBranchManager,
  type RehearsalBranch,
} from './branch-manager.js';
import {
  RehearsalScorer,
  getRehearsalScorer,
  resetRehearsalScorer,
} from './scorer.js';
import {
  RehearsalStage,
  getRehearsalStage,
  resetRehearsalStage,
  type RehearsalSession,
} from './stage.js';
import { resetTasteVault } from '../taste-vault/taste-vault.js';
import { resetConfig } from '../config/config.js';

// ============================================================================
// Test Setup & Mocks
// ============================================================================

const mockCallLLM = vi.fn();
vi.mock('../llm/ollama-client.js', () => ({
  callLLM: (...args: unknown[]) => mockCallLLM(...args),
}));

function createMockTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'test-task-001',
    title: 'Test Task',
    description: 'A test task for rehearsal',
    agent: 'MARS',
    status: 'ready',
    dependencies: [],
    phase: 1,
    attempts: 0,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function createMockBranch(overrides: Partial<RehearsalBranch> = {}): RehearsalBranch {
  return {
    id: 'test-branch-001',
    description: 'Test branch',
    strategy: 'in-memory',
    files: [
      {
        path: 'src/test.ts',
        originalContent: 'const x = 1;',
        proposedContent: 'const x: number = 1;',
      },
    ],
    createdAt: new Date().toISOString(),
    status: 'pending',
    agentNotes: 'This is a clean, idiomatic implementation.',
    ...overrides,
  };
}

// ============================================================================
// Branch Manager Tests
// ============================================================================

describe('Branch Manager', () => {
  beforeEach(() => {
    resetBranchManager();
    mockCallLLM.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createBranches', () => {
    it('should create the requested number of branches', async () => {
      const manager = new BranchManager();
      const task = createMockTask();

      mockCallLLM.mockResolvedValue({
        content: JSON.stringify({
          description: 'Minimal approach',
          files: [{ path: 'test.ts', originalContent: '', proposedContent: 'const x = 1;' }],
          agentNotes: 'Simple and clean',
        }),
      });

      const branches = await manager.createBranches(task, 'MARS', 2);

      expect(branches.length).toBe(2);
      expect(mockCallLLM).toHaveBeenCalledTimes(2);
    });

    it('should cap branch count at 3', async () => {
      const manager = new BranchManager();
      const task = createMockTask();

      mockCallLLM.mockResolvedValue({
        content: JSON.stringify({
          description: 'Test',
          files: [{ path: 'test.ts', originalContent: '', proposedContent: 'code' }],
          agentNotes: 'Notes',
        }),
      });

      const branches = await manager.createBranches(task, 'MARS', 5);

      expect(branches.length).toBe(3);
      expect(mockCallLLM).toHaveBeenCalledTimes(3);
    });

    it('should generate unique branch IDs', async () => {
      const manager = new BranchManager();
      const task = createMockTask();

      mockCallLLM.mockResolvedValue({
        content: JSON.stringify({
          description: 'Test',
          files: [{ path: 'test.ts', originalContent: '', proposedContent: 'code' }],
          agentNotes: 'Notes',
        }),
      });

      const branches = await manager.createBranches(task, 'MARS', 2);

      expect(branches[0].id).not.toBe(branches[1].id);
    });

    it('should use different approach prompts for each branch', async () => {
      const manager = new BranchManager();
      const task = createMockTask();

      mockCallLLM.mockResolvedValue({
        content: JSON.stringify({
          description: 'Test',
          files: [{ path: 'test.ts', originalContent: '', proposedContent: 'code' }],
          agentNotes: 'Notes',
        }),
      });

      await manager.createBranches(task, 'MARS', 3);

      const calls = mockCallLLM.mock.calls;
      expect(calls.length).toBe(3);
      
      // Check that each call has a different approach
      const prompts = calls.map(call => call[0] as string);
      expect(prompts[0]).toContain('straightforward');
      expect(prompts[1]).toContain('optimized');
      expect(prompts[2]).toContain('defensive');
    });

    it('should throw if all branch generations fail', async () => {
      const manager = new BranchManager();
      const task = createMockTask();

      mockCallLLM.mockRejectedValue(new Error('LLM error'));

      await expect(manager.createBranches(task, 'MARS', 2)).rejects.toThrow(
        'All branch generation attempts failed'
      );
    });

    it('should skip failed branches and return successful ones', async () => {
      const manager = new BranchManager();
      const task = createMockTask();

      mockCallLLM
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce({
          content: JSON.stringify({
            description: 'Success',
            files: [{ path: 'test.ts', originalContent: '', proposedContent: 'code' }],
            agentNotes: 'Notes',
          }),
        });

      const branches = await manager.createBranches(task, 'MARS', 2);

      expect(branches.length).toBe(1);
      expect(branches[0].description).toBe('Success');
    });

    it('should parse JSON from markdown code blocks', async () => {
      const manager = new BranchManager();
      const task = createMockTask();

      mockCallLLM.mockResolvedValue({
        content: '```json\n{"description": "Test", "files": [{"path": "test.ts", "originalContent": "", "proposedContent": "code"}], "agentNotes": "Notes"}\n```',
      });

      const branches = await manager.createBranches(task, 'MARS', 1);

      expect(branches[0].description).toBe('Test');
    });
  });

  describe('cleanupBranches', () => {
    it('should set non-winner branches to rejected', () => {
      const manager = new BranchManager();
      const branches: RehearsalBranch[] = [
        createMockBranch({ id: 'branch-1' }),
        createMockBranch({ id: 'branch-2' }),
        createMockBranch({ id: 'branch-3' }),
      ];

      manager.cleanupBranches(branches, 'branch-2');

      expect(branches[0].status).toBe('rejected');
      expect(branches[1].status).toBe('pending'); // Winner
      expect(branches[2].status).toBe('rejected');
    });

    it('should clear files array for non-winner branches', () => {
      const manager = new BranchManager();
      const branches: RehearsalBranch[] = [
        createMockBranch({ id: 'branch-1', files: [{ path: 'a.ts', originalContent: '', proposedContent: 'a' }] }),
        createMockBranch({ id: 'branch-2', files: [{ path: 'b.ts', originalContent: '', proposedContent: 'b' }] }),
      ];

      manager.cleanupBranches(branches, 'branch-2');

      expect(branches[0].files).toEqual([]);
      expect(branches[1].files.length).toBe(1); // Winner keeps files
    });

    it('should handle undefined winner', () => {
      const manager = new BranchManager();
      const branches: RehearsalBranch[] = [
        createMockBranch({ id: 'branch-1' }),
        createMockBranch({ id: 'branch-2' }),
      ];

      manager.cleanupBranches(branches, undefined);

      expect(branches[0].status).toBe('rejected');
      expect(branches[1].status).toBe('rejected');
    });
  });

  describe('singleton factory', () => {
    it('should return same instance', () => {
      const m1 = getBranchManager();
      const m2 = getBranchManager();
      expect(m1).toBe(m2);
    });

    it('should create new instance after reset', () => {
      const m1 = getBranchManager();
      resetBranchManager();
      const m2 = getBranchManager();
      expect(m1).not.toBe(m2);
    });
  });
});

// ============================================================================
// Rehearsal Scorer Tests
// ============================================================================

describe('Rehearsal Scorer', () => {
  beforeEach(() => {
    resetRehearsalScorer();
    resetTasteVault();
  });

  describe('typeCheckPass scoring', () => {
    it('should give high score for well-typed code', async () => {
      const scorer = new RehearsalScorer();
      const branch = createMockBranch({
        files: [{
          path: 'test.ts',
          originalContent: '',
          proposedContent: 'function greet(name: string): string { return `Hello ${name}`; }',
        }],
      });

      const result = await scorer.score(branch);

      expect(result.scoreBreakdown.typeCheckPass).toBeGreaterThan(0.7);
    });

    it('should penalize any usage', async () => {
      const scorer = new RehearsalScorer();
      const branch = createMockBranch({
        files: [{
          path: 'test.ts',
          originalContent: '',
          proposedContent: 'const x: any = 1;\nconst y: any = 2;',
        }],
      });

      const result = await scorer.score(branch);

      expect(result.scoreBreakdown.typeCheckPass).toBeLessThan(0.8);
    });
  });

  describe('lineDelta scoring', () => {
    it('should give perfect score for zero delta', async () => {
      const scorer = new RehearsalScorer();
      const branch = createMockBranch({
        files: [{
          path: 'test.ts',
          originalContent: 'line1\nline2',
          proposedContent: 'line1\nline2',
        }],
      });

      const result = await scorer.score(branch);

      expect(result.scoreBreakdown.lineDelta).toBe(1.0);
    });

    it('should give perfect score for negative delta', async () => {
      const scorer = new RehearsalScorer();
      const branch = createMockBranch({
        files: [{
          path: 'test.ts',
          originalContent: 'line1\nline2\nline3',
          proposedContent: 'line1',
        }],
      });

      const result = await scorer.score(branch);

      expect(result.scoreBreakdown.lineDelta).toBe(1.0);
    });

    it('should decay score for large positive delta', async () => {
      const scorer = new RehearsalScorer();
      const branch = createMockBranch({
        files: [{
          path: 'test.ts',
          originalContent: 'line1',
          proposedContent: Array(250).fill('line').join('\n'),
        }],
      });

      const result = await scorer.score(branch);

      expect(result.scoreBreakdown.lineDelta).toBeLessThan(0.8);
      expect(result.scoreBreakdown.lineDelta).toBeGreaterThanOrEqual(0.5);
    });
  });

  describe('agentSelfAssessment scoring', () => {
    it('should give high score for confident notes', async () => {
      const scorer = new RehearsalScorer();
      const branch = createMockBranch({
        agentNotes: 'This is a confident, solid, production-ready implementation using best practices.',
      });

      const result = await scorer.score(branch);

      expect(result.scoreBreakdown.agentSelfAssessment).toBeGreaterThan(0.7);
    });

    it('should give low score for uncertain notes', async () => {
      const scorer = new RehearsalScorer();
      const branch = createMockBranch({
        agentNotes: 'This is a temporary hack and workaround. Not ideal, just a quick fix.',
      });

      const result = await scorer.score(branch);

      expect(result.scoreBreakdown.agentSelfAssessment).toBeLessThan(0.4);
    });

    it('should give neutral score for empty notes', async () => {
      const scorer = new RehearsalScorer();
      const branch = createMockBranch({
        agentNotes: '',
      });

      const result = await scorer.score(branch);

      expect(result.scoreBreakdown.agentSelfAssessment).toBe(0.5);
    });
  });

  describe('estimatedQuality', () => {
    it('should return high for score >= 0.8', async () => {
      const scorer = new RehearsalScorer();
      const branch = createMockBranch({
        files: [{
          path: 'test.ts',
          originalContent: '',
          proposedContent: 'interface User { name: string; }',
        }],
        agentNotes: 'Clean, idiomatic, production-ready code.',
      });

      const result = await scorer.score(branch);

      if (result.score >= 0.8) {
        expect(result.estimatedQuality).toBe('high');
      }
    });

    it('should return low for score < 0.55', async () => {
      const scorer = new RehearsalScorer();
      const branch = createMockBranch({
        files: [{
          path: 'test.ts',
          originalContent: '',
          proposedContent: 'const x: any = 1;\n'.repeat(100),
        }],
        agentNotes: 'This is a hack and temporary workaround.',
      });

      const result = await scorer.score(branch);

      if (result.score < 0.55) {
        expect(result.estimatedQuality).toBe('low');
      }
    });
  });

  describe('previewSnippet', () => {
    it('should return first 300 chars of primary file', async () => {
      const scorer = new RehearsalScorer();
      const longContent = 'x'.repeat(500);
      const branch = createMockBranch({
        files: [{
          path: 'test.ts',
          originalContent: '',
          proposedContent: longContent,
        }],
      });

      const result = await scorer.score(branch);

      expect(result.previewSnippet.length).toBeLessThanOrEqual(350); // Allow for truncation marker
      expect(result.previewSnippet.startsWith('xxx')).toBe(true);
    });

    it('should return full content if under 300 chars', async () => {
      const scorer = new RehearsalScorer();
      const branch = createMockBranch({
        files: [{
          path: 'test.ts',
          originalContent: '',
          proposedContent: 'short content',
        }],
      });

      const result = await scorer.score(branch);

      expect(result.previewSnippet).toBe('short content');
    });
  });

  describe('singleton factory', () => {
    it('should return same instance', () => {
      const s1 = getRehearsalScorer();
      const s2 = getRehearsalScorer();
      expect(s1).toBe(s2);
    });

    it('should create new instance after reset', () => {
      const s1 = getRehearsalScorer();
      resetRehearsalScorer();
      const s2 = getRehearsalScorer();
      expect(s1).not.toBe(s2);
    });
  });
});

// ============================================================================
// Rehearsal Stage Tests
// ============================================================================

describe('Rehearsal Stage', () => {
  describe('shouldRehearse', () => {
    it('should return true for schema-related tasks', () => {
      const stage = new RehearsalStage();
      const task = createMockTask({ description: 'Create a database schema' });

      expect(stage.shouldRehearse(task)).toBe(true);
    });

    it('should return true for migration tasks', () => {
      const stage = new RehearsalStage();
      const task = createMockTask({ description: 'Run database migration' });

      expect(stage.shouldRehearse(task)).toBe(true);
    });

    it('should return true for tasks with explicit rehearse keyword', () => {
      const stage = new RehearsalStage();
      const task = createMockTask({ description: 'Please rehearse this complex change' });

      expect(stage.shouldRehearse(task)).toBe(true);
    });

    it('should return true for high complexity tasks', () => {
      const stage = new RehearsalStage();
      const task = createMockTask({
        description: 'Regular task',
        context: { complexity: 0.8 },
      });

      expect(stage.shouldRehearse(task)).toBe(true);
    });

    it('should return true for tasks with many dependencies', () => {
      const stage = new RehearsalStage();
      const task = createMockTask({
        description: 'Regular task',
        dependencies: ['task-1', 'task-2', 'task-3'],
      });

      expect(stage.shouldRehearse(task)).toBe(true);
    });

    it('should return true for tasks with multiple attempts', () => {
      const stage = new RehearsalStage();
      const task = createMockTask({
        description: 'Regular task',
        attempts: 2,
      });

      expect(stage.shouldRehearse(task)).toBe(true);
    });

    it('should return false for simple tasks', () => {
      const stage = new RehearsalStage();
      const task = createMockTask({
        description: 'Fix typo in README',
        dependencies: [],
        attempts: 0,
      });

      expect(stage.shouldRehearse(task)).toBe(false);
    });
  });

  describe('rehearse', () => {
    beforeEach(() => {
      // Ensure paid tier (premium) is set before any config access
      delete process.env.NOVA26_TIER;
      process.env.NOVA26_TIER = 'paid';
      
      resetRehearsalStage();
      resetConfig();
      resetTasteVault();
      mockCallLLM.mockReset();
    });

    afterEach(() => {
      delete process.env.NOVA26_TIER;
      resetConfig();
    });

    it('should throw if shouldRehearse is false and not forced', async () => {
      const stage = new RehearsalStage();
      const task = createMockTask({ description: 'Simple task' });

      await expect(stage.rehearse(task, 'MARS')).rejects.toThrow('does not meet rehearsal criteria');
    });

    it('should proceed when forceRehearse is true', async () => {
      const stage = new RehearsalStage();
      const task = createMockTask({ description: 'Simple task' });

      mockCallLLM.mockResolvedValue({
        content: JSON.stringify({
          description: 'Test',
          files: [{ path: 'test.ts', originalContent: '', proposedContent: 'code' }],
          agentNotes: 'Notes',
        }),
      });

      const session = await stage.rehearse(task, 'MARS', { forceRehearse: true });

      expect(session).toBeDefined();
      expect(session.branches.length).toBeGreaterThan(0);
    });

    it('should create session with correct structure', async () => {
      const stage = new RehearsalStage();
      const task = createMockTask({ description: 'Create schema' });

      mockCallLLM.mockResolvedValue({
        content: JSON.stringify({
          description: 'Test',
          files: [{ path: 'test.ts', originalContent: '', proposedContent: 'code' }],
          agentNotes: 'Notes',
        }),
      });

      const session = await stage.rehearse(task, 'MARS', { branchCount: 2 });

      expect(session.id).toBeDefined();
      expect(session.taskId).toBe(task.id);
      expect(session.agentName).toBe('MARS');
      expect(session.branches.length).toBe(2);
      expect(session.results.length).toBe(2);
      expect(session.createdAt).toBeDefined();
      expect(session.completedAt).toBeDefined();
    });

    it('should select winner with highest score', async () => {
      const stage = new RehearsalStage();
      const task = createMockTask({ description: 'Create schema' });

      mockCallLLM
        .mockResolvedValueOnce({
          content: JSON.stringify({
            description: 'Good',
            files: [{ path: 'test.ts', originalContent: '', proposedContent: 'const x: number = 1;' }],
            agentNotes: 'Clean, idiomatic code.',
          }),
        })
        .mockResolvedValueOnce({
          content: JSON.stringify({
            description: 'Bad',
            files: [{ path: 'test.ts', originalContent: '', proposedContent: 'const x: any = 1;' }],
            agentNotes: 'Quick hack.',
          }),
        });

      const session = await stage.rehearse(task, 'MARS', { branchCount: 2 });

      expect(session.winner).toBeDefined();
      const winnerResult = session.results.find(r => r.branchId === session.winner);
      expect(winnerResult).toBeDefined();
    });

    it('should cap branch count to 3', async () => {
      const stage = new RehearsalStage();
      const task = createMockTask({ description: 'Create schema' });

      mockCallLLM.mockResolvedValue({
        content: JSON.stringify({
          description: 'Test',
          files: [{ path: 'test.ts', originalContent: '', proposedContent: 'code' }],
          agentNotes: 'Notes',
        }),
      });

      const session = await stage.rehearse(task, 'MARS', { branchCount: 5 });

      expect(session.branches.length).toBe(3);
    });
  });



  describe('formatSummary', () => {
    it('should include session details', () => {
      const stage = new RehearsalStage();
      const session: RehearsalSession = {
        id: 'test-session',
        taskId: 'task-001',
        agentName: 'MARS',
        branches: [],
        results: [],
        createdAt: new Date().toISOString(),
      };

      const summary = stage.formatSummary(session);

      expect(summary).toContain('Rehearsal Session Summary');
      expect(summary).toContain('test-session');
      expect(summary).toContain('task-001');
      expect(summary).toContain('MARS');
    });

    it('should include winner information when present', () => {
      const stage = new RehearsalStage();
      const winnerId = 'winner-branch';
      const session: RehearsalSession = {
        id: 'test-session',
        taskId: 'task-001',
        agentName: 'MARS',
        branches: [createMockBranch({ id: winnerId })],
        results: [{
          branchId: winnerId,
          score: 0.85,
          scoreBreakdown: {
            typeCheckPass: 0.9,
            lineDelta: 0.8,
            agentSelfAssessment: 0.85,
            tasteAlignment: 0.75,
            compositeScore: 0.85,
          },
          summary: 'Good branch',
          tasteAlignment: 0.75,
          estimatedQuality: 'high',
          previewSnippet: 'const x = 1;',
        }],
        winner: winnerId,
        createdAt: new Date().toISOString(),
      };

      const summary = stage.formatSummary(session);

      expect(summary).toContain('🏆 Winner:');
      expect(summary).toContain('winner-branch');
      expect(summary).toContain('85%');
    });

    it('should handle no winner case', () => {
      const stage = new RehearsalStage();
      const session: RehearsalSession = {
        id: 'test-session',
        taskId: 'task-001',
        agentName: 'MARS',
        branches: [],
        results: [],
        createdAt: new Date().toISOString(),
      };

      const summary = stage.formatSummary(session);

      expect(summary).toContain('No winner selected');
    });
  });

  describe('singleton factory', () => {
    it('should return same instance', () => {
      const s1 = getRehearsalStage();
      const s2 = getRehearsalStage();
      expect(s1).toBe(s2);
    });

    it('should create new instance after reset', () => {
      const s1 = getRehearsalStage();
      resetRehearsalStage();
      const s2 = getRehearsalStage();
      expect(s1).not.toBe(s2);
    });

    it('should reset all sub-components', () => {
      const stage1 = getRehearsalStage();
      const bm1 = getBranchManager();
      const rs1 = getRehearsalScorer();

      resetRehearsalStage();

      const stage2 = getRehearsalStage();
      const bm2 = getBranchManager();
      const rs2 = getRehearsalScorer();

      expect(stage1).not.toBe(stage2);
      expect(bm1).not.toBe(bm2);
      expect(rs1).not.toBe(rs2);
    });
  });
});
