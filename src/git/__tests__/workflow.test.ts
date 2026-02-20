// KMS-27: Git Workflow Tests

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  isGitRepo,
  isGhAvailable,
  getCurrentBranch,
  getDefaultBranch,
  createBranch,
  commitPhase,
  createPR,
  getDiffSummary,
  initWorkflow,
  type GitWorkflowConfig,
} from '../workflow.js';

// Mock child_process with hoisted function
const mockExecSync = vi.fn();
vi.mock('child_process', () => ({
  execSync: (...args: any[]) => mockExecSync(...args),
}));

describe('Git Workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isGitRepo', () => {
    it('should return true when in a git repository', () => {
      mockExecSync.mockReturnValue('.git');

      expect(isGitRepo()).toBe(true);
    });

    it('should return false when not in a git repository', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Not a git repository');
      });

      expect(isGitRepo()).toBe(false);
    });

    it('should use stdio pipe option', () => {
      mockExecSync.mockReturnValue('.git');

      isGitRepo();

      expect(mockExecSync).toHaveBeenCalledWith('git rev-parse --git-dir', { stdio: 'pipe' });
    });
  });

  describe('isGhAvailable', () => {
    it('should return true when gh CLI is available', () => {
      mockExecSync.mockReturnValue('gh version 2.0.0');

      expect(isGhAvailable()).toBe(true);
    });

    it('should return false when gh CLI is not available', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Command not found');
      });

      expect(isGhAvailable()).toBe(false);
    });
  });

  describe('getCurrentBranch', () => {
    it('should return current branch name', () => {
      mockExecSync.mockReturnValue('feature-branch\n');

      const branch = getCurrentBranch();

      expect(branch).toBe('feature-branch');
    });

    it('should trim whitespace from output', () => {
      mockExecSync.mockReturnValue('  main  \n');

      const branch = getCurrentBranch();

      expect(branch).toBe('main');
    });
  });

  describe('getDefaultBranch', () => {
    it('should return main when HEAD branch is main', () => {
      mockExecSync.mockReturnValue('  HEAD branch: main\n  Remote branches:');

      const branch = getDefaultBranch();

      expect(branch).toBe('main');
    });

    it('should return master when HEAD branch is master', () => {
      mockExecSync.mockReturnValue('  HEAD branch: master\n');

      const branch = getDefaultBranch();

      expect(branch).toBe('master');
    });

    it('should default to main when remote show fails', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('No remote');
      });

      const branch = getDefaultBranch();

      expect(branch).toBe('main');
    });
  });

  describe('createBranch', () => {
    it('should return current branch when not in git repo', () => {
      mockExecSync
        .mockImplementationOnce(() => { // isGitRepo check
          throw new Error('Not a git repo');
        })
        .mockReturnValueOnce('main'); // getCurrentBranch

      const branch = createBranch('My Feature');

      expect(branch).toBe('main');
    });

    it('should return current branch when already on nova branch', () => {
      mockExecSync
        .mockReturnValueOnce(undefined) // isGitRepo
        .mockReturnValueOnce('nova26/existing-feature'); // getCurrentBranch

      const branch = createBranch('My Feature');

      expect(branch).toBe('nova26/existing-feature');
    });

    it('should create branch with sanitized name', () => {
      mockExecSync
        .mockReturnValueOnce(undefined) // isGitRepo
        .mockReturnValueOnce('main') // getCurrentBranch
        .mockReturnValueOnce('') // git status --porcelain
        .mockReturnValueOnce(''); // git checkout -b

      const config: GitWorkflowConfig = {
        branchPrefix: 'nova26/',
        autoCommit: true,
        autoPR: false,
        commitPrefix: 'feat',
      };

      createBranch('My New Feature!', config);

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('nova26/my-new-feature'),
        expect.any(Object)
      );
    });

    it('should stash uncommitted changes before creating branch', () => {
      mockExecSync
        .mockReturnValueOnce(undefined) // isGitRepo
        .mockReturnValueOnce('main') // getCurrentBranch
        .mockReturnValueOnce('M file.ts') // git status --porcelain - has changes
        .mockReturnValueOnce('') // git stash
        .mockReturnValueOnce(''); // git checkout -b

      createBranch('Feature');

      expect(mockExecSync).toHaveBeenCalledWith(
        'git stash push -m "nova26-auto-stash"',
        { stdio: 'pipe' }
      );
    });

    it('should switch to existing branch if creation fails', () => {
      mockExecSync
        .mockReturnValueOnce(undefined) // isGitRepo
        .mockReturnValueOnce('main') // getCurrentBranch
        .mockReturnValueOnce('') // git status
        .mockImplementationOnce(() => { // git checkout -b fails
          throw new Error('Branch exists');
        })
        .mockReturnValueOnce(''); // git checkout succeeds

      const branch = createBranch('Feature');

      expect(branch).toBe('nova26/feature');
    });

    it('should limit branch name length to 50 chars', () => {
      mockExecSync
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce('main')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('');

      const longName = 'a'.repeat(100);
      createBranch(longName);

      const checkoutCall = vi.mocked(mockExecSync).mock.calls.find(
        call => typeof call[0] === 'string' && call[0].includes('git checkout -b')
      );
      const branchArg = checkoutCall?.[0] as string;
      // Extract branch name from the git checkout -b command
      const branchNameMatch = branchArg?.match(/nova26\/([^"]+)/);
      const branchName = branchNameMatch?.[1] || '';
      expect(branchName.length).toBeLessThanOrEqual(50);
    });
  });

  describe('commitPhase', () => {
    it('should return false when not in git repo', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Not a git repo');
      });

      const result = commitPhase('task-1', 'Test Task', 'Sun', 1);

      expect(result).toBe(false);
    });

    it('should return false when autoCommit is disabled', () => {
      const config: GitWorkflowConfig = {
        autoCommit: false,
        autoPR: false,
        branchPrefix: 'nova26/',
        commitPrefix: 'feat',
      };

      const result = commitPhase('task-1', 'Test Task', 'Sun', 1, config);

      expect(result).toBe(false);
      expect(mockExecSync).not.toHaveBeenCalledWith(expect.stringContaining('git add'), expect.any(Object));
    });

    it('should return false when no changes to commit', () => {
      mockExecSync
        .mockReturnValueOnce(undefined) // isGitRepo
        .mockReturnValueOnce(''); // git status --porcelain - no changes

      const result = commitPhase('task-1', 'Test Task', 'Sun', 1);

      expect(result).toBe(false);
    });

    it('should stage and commit with proper message', () => {
      mockExecSync
        .mockReturnValueOnce(undefined) // isGitRepo
        .mockReturnValueOnce('M file.ts') // git status --porcelain - has changes
        .mockReturnValueOnce('') // git add
        .mockReturnValueOnce(''); // git commit

      const config: GitWorkflowConfig = {
        autoCommit: true,
        autoPR: false,
        branchPrefix: 'nova26/',
        commitPrefix: 'feat',
      };

      const result = commitPhase('task-123', 'Add new feature', 'Mercury', 2, config);

      expect(result).toBe(true);
      expect(mockExecSync).toHaveBeenCalledWith(
        'git add .nova/output/',
        { stdio: 'pipe' }
      );
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('feat(mercury): Add new feature'),
        { stdio: 'pipe' }
      );
    });

    it('should escape quotes in commit message', () => {
      mockExecSync
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce('M file.ts')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('');

      commitPhase('task-1', 'Fix "broken" feature', 'Sun', 1);

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('\\"'),
        { stdio: 'pipe' }
      );
    });

    it('should include task, phase, and agent info in commit body', () => {
      mockExecSync
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce('M file.ts')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('');

      commitPhase('TASK-001', 'Test Task', 'Venus', 3);

      const commitCall = vi.mocked(mockExecSync).mock.calls.find(
        call => typeof call[0] === 'string' && call[0].includes('git commit')
      );
      expect(commitCall?.[0]).toContain('Task: TASK-001');
      expect(commitCall?.[0]).toContain('Phase: 3');
      expect(commitCall?.[0]).toContain('Agent: Venus');
    });

    it('should return false when commit fails', () => {
      mockExecSync
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce('M file.ts')
        .mockReturnValueOnce('')
        .mockImplementationOnce(() => {
          throw new Error('Commit failed');
        });

      const result = commitPhase('task-1', 'Test', 'Sun', 1);

      expect(result).toBe(false);
    });
  });

  describe('createPR', () => {
    it('should return null when not in git repo', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Not a git repo');
      });

      const result = createPR('Feature', ['Task 1']);

      expect(result).toBeNull();
    });

    it('should return null when gh CLI is not available', () => {
      mockExecSync
        .mockReturnValueOnce(undefined) // isGitRepo
        .mockImplementationOnce(() => { // isGhAvailable fails
          throw new Error('Command not found');
        });

      const result = createPR('Feature', ['Task 1']);

      expect(result).toBeNull();
    });

    it('should return null when on default branch', () => {
      mockExecSync
        .mockReturnValueOnce(undefined) // isGitRepo
        .mockReturnValueOnce('') // isGhAvailable
        .mockReturnValueOnce('main') // getCurrentBranch
        .mockReturnValueOnce('main'); // getDefaultBranch

      const result = createPR('Feature', ['Task 1']);

      expect(result).toBeNull();
    });

    it('should create PR successfully', () => {
      mockExecSync
        .mockReturnValueOnce(undefined) // isGitRepo
        .mockReturnValueOnce('') // isGhAvailable
        .mockReturnValueOnce('nova26/feature-branch') // getCurrentBranch
        .mockReturnValueOnce('main') // getDefaultBranch
        .mockReturnValueOnce('') // git push
        .mockReturnValueOnce('https://github.com/user/repo/pull/123'); // gh pr create

      const result = createPR('My Feature', ['Task 1', 'Task 2']);

      expect(result).toBe('https://github.com/user/repo/pull/123');
    });

    it('should include task summary in PR body', () => {
      mockExecSync
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce('')
        .mockReturnValueOnce('nova26/feature')
        .mockReturnValueOnce('main')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('https://github.com/pr/1');

      createPR('Feature', ['Implemented X', 'Fixed Y']);

      const prCreateCall = vi.mocked(mockExecSync).mock.calls.find(
        call => typeof call[0] === 'string' && call[0].includes('gh pr create')
      );
      expect(prCreateCall?.[0]).toContain('Implemented X');
      expect(prCreateCall?.[0]).toContain('Fixed Y');
    });

    it('should escape quotes in PR title and body', () => {
      mockExecSync
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce('')
        .mockReturnValueOnce('nova26/feature')
        .mockReturnValueOnce('main')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('https://github.com/pr/1');

      createPR('Feature "with quotes"', ['Task "quoted"']);

      const prCreateCall = vi.mocked(mockExecSync).mock.calls.find(
        call => typeof call[0] === 'string' && call[0].includes('gh pr create')
      );
      expect(prCreateCall?.[0]).toContain('\\"');
    });

    it('should return null when PR creation fails', () => {
      mockExecSync
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce('')
        .mockReturnValueOnce('nova26/feature')
        .mockReturnValueOnce('main')
        .mockReturnValueOnce('')
        .mockImplementationOnce(() => {
          throw new Error('PR creation failed');
        });

      const result = createPR('Feature', ['Task 1']);

      expect(result).toBeNull();
    });
  });

  describe('getDiffSummary', () => {
    it('should return message when not in git repo', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Not a git repo');
      });

      const result = getDiffSummary();

      expect(result).toBe('Not a git repository');
    });

    it('should return staged and unstaged changes', () => {
      mockExecSync
        .mockReturnValueOnce(undefined) // isGitRepo
        .mockReturnValueOnce(' file.ts | 2 +-') // git diff --stat
        .mockReturnValueOnce(' file2.ts | 5 +++'); // git diff --cached --stat

      const result = getDiffSummary();

      expect(result).toContain('Staged:');
      expect(result).toContain('Unstaged:');
      expect(result).toContain('file.ts');
      expect(result).toContain('file2.ts');
    });

    it('should return "No changes" when diff is empty', () => {
      mockExecSync
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce('') // no unstaged
        .mockReturnValueOnce(''); // no staged

      const result = getDiffSummary();

      expect(result).toBe('No changes');
    });

    it('should handle errors gracefully', () => {
      mockExecSync
        .mockReturnValueOnce(undefined)
        .mockImplementationOnce(() => {
          throw new Error('Git error');
        });

      const result = getDiffSummary();

      expect(result).toBe('Unable to get diff');
    });
  });

  describe('initWorkflow', () => {
    it('should return workflow object with branch', () => {
      mockExecSync
        .mockReturnValueOnce(undefined) // isGitRepo
        .mockReturnValueOnce('main') // getCurrentBranch
        .mockReturnValueOnce('') // git status
        .mockReturnValueOnce(''); // git checkout -b

      const workflow = initWorkflow('Test Feature');

      expect(workflow.branch).toBe('nova26/test-feature');
      expect(typeof workflow.commitPhase).toBe('function');
      expect(typeof workflow.finalize).toBe('function');
    });

    it('should merge config with defaults', () => {
      mockExecSync
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce('main')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('');

      const workflow = initWorkflow('Test', { autoPR: true, branchPrefix: 'custom/' });

      expect(workflow.branch).toBe('custom/test');
    });

    it('should create PR when finalize is called', () => {
      mockExecSync
        .mockReturnValueOnce(undefined) // isGitRepo - createBranch
        .mockReturnValueOnce('main') // getCurrentBranch
        .mockReturnValueOnce('') // git status
        .mockReturnValueOnce('') // git checkout -b
        .mockReturnValueOnce(undefined) // isGitRepo - createPR
        .mockReturnValueOnce('') // isGhAvailable
        .mockReturnValueOnce('custom/test') // getCurrentBranch
        .mockReturnValueOnce('main') // getDefaultBranch
        .mockReturnValueOnce('') // git push
        .mockReturnValueOnce('https://github.com/pr/1'); // gh pr create

      const workflow = initWorkflow('Test', { autoPR: true, branchPrefix: 'custom/' });
      const prUrl = workflow.finalize(['Task 1']);

      expect(prUrl).toBe('https://github.com/pr/1');
    });
  });
});
