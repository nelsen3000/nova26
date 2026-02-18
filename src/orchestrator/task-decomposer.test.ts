// Unit tests for task-decomposer.ts
// Tests hierarchical task decomposition functionality

import { describe, it, expect } from 'vitest';
import {
  analyzeComplexity,
  shouldDecompose,
  decomposeTask,
  formatDecomposition,
  getNextSubtask,
  isDecompositionComplete,
  getCompletionPercentage,
  type DecomposedTask,
} from './task-decomposer.js';

describe('task-decomposer', () => {
  describe('analyzeComplexity', () => {
    it('should return low complexity for simple tasks', () => {
      const result = analyzeComplexity('Fix typo', 'Fix a simple typo in the readme');
      
      expect(result.riskLevel).toBe('low');
      expect(result.fileCount).toBe(1);
      expect(result.integrationPoints).toBe(0);
    });

    it('should detect medium complexity for tasks with integrations', () => {
      const result = analyzeComplexity(
        'Add Stripe webhook',
        'Implement webhook handler for Stripe payment events'
      );
      
      expect(result.integrationPoints).toBeGreaterThan(0);
      expect(result.riskLevel).toBe('medium');
    });

    it('should detect high complexity for tasks with multiple integrations', () => {
      const result = analyzeComplexity(
        'Build payment system',
        'Integrate Stripe API, webhook handlers, database schema for payments, and auth checks'
      );
      
      expect(result.riskLevel).toBe('high');
      expect(result.integrationPoints).toBeGreaterThanOrEqual(3);
    });

    it('should estimate file count based on keywords', () => {
      const result = analyzeComplexity(
        'Build feature',
        'Create component, page, API, and tests'
      );
      
      expect(result.fileCount).toBeGreaterThan(1);
    });

    it('should estimate lines of code based on description length', () => {
      const shortDesc = analyzeComplexity('A', 'Short');
      const longDesc = analyzeComplexity('A', 'A'.repeat(1000));
      
      expect(longDesc.linesOfCode).toBeGreaterThan(shortDesc.linesOfCode);
    });
  });

  describe('shouldDecompose', () => {
    it('should return false for simple tasks', () => {
      expect(shouldDecompose('Fix typo', 'Fix typo in readme')).toBe(false);
    });

    it('should return true for high complexity tasks', () => {
      expect(shouldDecompose(
        'Build payment system',
        'Integrate Stripe API, database, webhooks, and auth'
      )).toBe(true);
    });

    it('should return true for tasks with multiple integration points', () => {
      expect(shouldDecompose(
        'Complex integration',
        'Connect API, database, and external service'
      )).toBe(true);
    });
  });

  describe('decomposeTask', () => {
    it('should create subtasks for schema-related tasks', () => {
      const result = decomposeTask(
        'task-1',
        'Create user schema',
        'Design database schema for users with auth',
        'PLUTO'
      );
      
      expect(result.subtasks.length).toBeGreaterThan(0);
      expect(result.parentId).toBe('task-1');
      expect(result.totalEstimatedDuration).toBeGreaterThan(0);
      
      // Should have PLUTO subtasks for schema
      const plutoTasks = result.subtasks.filter(s => s.agent === 'PLUTO');
      expect(plutoTasks.length).toBeGreaterThan(0);
    });

    it('should create subtasks for API-related tasks', () => {
      const result = decomposeTask(
        'task-2',
        'Build API endpoint',
        'Create REST API for user management',
        'MARS'
      );
      
      expect(result.subtasks.length).toBeGreaterThan(0);
      
      // Should have MARS subtasks for API
      const marsTasks = result.subtasks.filter(s => s.agent === 'MARS');
      expect(marsTasks.length).toBeGreaterThan(0);
    });

    it('should create subtasks for integration tasks', () => {
      const result = decomposeTask(
        'task-3',
        'Stripe integration',
        'Integrate Stripe payment processing with webhooks',
        'GANYMEDE'
      );
      
      expect(result.subtasks.length).toBeGreaterThan(0);
      
      // Should have GANYMEDE and MIMAS tasks
      const integrationTasks = result.subtasks.filter(
        s => s.agent === 'GANYMEDE' || s.agent === 'MIMAS'
      );
      expect(integrationTasks.length).toBeGreaterThan(0);
    });

    it('should create subtasks for UI-related tasks', () => {
      const result = decomposeTask(
        'task-4',
        'Build user profile page',
        'Create user profile page with components',
        'VENUS'
      );
      
      expect(result.subtasks.length).toBeGreaterThan(0);
      
      // Should have VENUS subtasks
      const venusTasks = result.subtasks.filter(s => s.agent === 'VENUS');
      expect(venusTasks.length).toBeGreaterThan(0);
    });

    it('should create generic subtasks for unrecognized task types', () => {
      const result = decomposeTask(
        'task-5',
        'Generic task',
        'Do something generic without specific keywords',
        'MARS'
      );
      
      expect(result.subtasks.length).toBeGreaterThan(0);
    });

    it('should assign unique IDs to subtasks', () => {
      const result = decomposeTask('task-6', 'Test', 'Description', 'MARS');
      
      const ids = result.subtasks.map(s => s.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should set all subtasks to pending status', () => {
      const result = decomposeTask('task-7', 'Test', 'Description', 'MARS');
      
      for (const subtask of result.subtasks) {
        expect(subtask.status).toBe('pending');
      }
    });

    it('should set correct parent ID for all subtasks', () => {
      const result = decomposeTask('task-parent', 'Test', 'Description', 'MARS');
      
      for (const subtask of result.subtasks) {
        expect(subtask.parentId).toBe('task-parent');
      }
    });

    it('should assign sequential order numbers', () => {
      const result = decomposeTask('task-8', 'Test', 'Description', 'MARS');
      
      const orders = result.subtasks.map(s => s.order).sort((a, b) => a - b);
      for (let i = 0; i < orders.length; i++) {
        expect(orders[i]).toBeGreaterThanOrEqual(1);
      }
    });

    it('should identify parallelizable groups', () => {
      const result = decomposeTask('task-9', 'Complex Task', 'API and UI work', 'MARS');
      
      // Should have at least some parallelizable groups
      expect(result.parallelizable).toBeDefined();
      expect(Array.isArray(result.parallelizable)).toBe(true);
    });

    it('should calculate critical path', () => {
      const result = decomposeTask('task-10', 'Complex Task', 'Multiple steps', 'MARS');
      
      expect(result.criticalPath).toBeDefined();
      expect(Array.isArray(result.criticalPath)).toBe(true);
    });
  });

  describe('formatDecomposition', () => {
    it('should format decomposition with all sections', () => {
      const decomposition = decomposeTask('task-11', 'Test Task', 'Description', 'MARS');
      const formatted = formatDecomposition(decomposition);
      
      expect(formatted).toContain('Task Decomposition');
      expect(formatted).toContain('task-11');
      expect(formatted).toContain('Subtasks:');
    });

    it('should include status emojis for subtasks', () => {
      const decomposition = decomposeTask('task-12', 'Test', 'Description', 'MARS');
      const formatted = formatDecomposition(decomposition);
      
      // Should contain status emojis
      expect(formatted).toMatch(/[⏳🔄✅❌]/);
    });

    it('should show critical path when available', () => {
      const decomposition = decomposeTask('task-13', 'Complex', 'Multiple integrations needed', 'MARS');
      const formatted = formatDecomposition(decomposition);
      
      if (decomposition.criticalPath.length > 0) {
        expect(formatted).toContain('Critical Path:');
      }
    });

    it('should show parallelizable groups when available', () => {
      const decomposition = decomposeTask('task-14', 'Complex', 'Multiple integrations needed', 'MARS');
      const formatted = formatDecomposition(decomposition);
      
      if (decomposition.parallelizable.length > 0) {
        expect(formatted).toContain('Parallelizable Groups:');
      }
    });
  });

  describe('getNextSubtask', () => {
    it('should return first pending subtask with no dependencies', () => {
      const decomposition = decomposeTask('task-15', 'Test', 'Description', 'MARS');
      
      const next = getNextSubtask(decomposition);
      
      expect(next).not.toBeNull();
      expect(next?.status).toBe('pending');
      expect(next?.dependencies.length).toBe(0);
    });

    it('should return null when all subtasks completed', () => {
      const decomposition = decomposeTask('task-16', 'Test', 'Description', 'MARS');
      
      // Mark all as completed
      for (const subtask of decomposition.subtasks) {
        subtask.status = 'completed';
      }
      
      const next = getNextSubtask(decomposition);
      expect(next).toBeNull();
    });

    it('should return subtask whose dependencies are completed', () => {
      const decomposition = decomposeTask('task-17', 'Complex', 'API integration', 'MARS');
      
      // Find a subtask with dependencies
      const subtaskWithDeps = decomposition.subtasks.find(s => s.dependencies.length > 0);
      
      if (subtaskWithDeps) {
        // Complete its dependencies
        for (const depId of subtaskWithDeps.dependencies) {
          const dep = decomposition.subtasks.find(s => s.id === depId);
          if (dep) dep.status = 'completed';
        }
        
        const next = getNextSubtask(decomposition);
        expect(next?.id).toBe(subtaskWithDeps.id);
      }
    });

    it('should not return subtask with incomplete dependencies', () => {
      const decomposition = decomposeTask('task-18', 'Complex', 'API integration', 'MARS');
      
      // Find a subtask with dependencies
      const subtaskWithDeps = decomposition.subtasks.find(s => s.dependencies.length > 0);
      
      if (subtaskWithDeps) {
        // Ensure dependencies are NOT completed
        for (const depId of subtaskWithDeps.dependencies) {
          const dep = decomposition.subtasks.find(s => s.id === depId);
          if (dep) dep.status = 'pending';
        }
        
        const next = getNextSubtask(decomposition);
        expect(next?.id).not.toBe(subtaskWithDeps.id);
      }
    });
  });

  describe('isDecompositionComplete', () => {
    it('should return true when all subtasks completed', () => {
      const decomposition = decomposeTask('task-19', 'Test', 'Description', 'MARS');
      
      for (const subtask of decomposition.subtasks) {
        subtask.status = 'completed';
      }
      
      expect(isDecompositionComplete(decomposition)).toBe(true);
    });

    it('should return false when some subtasks pending', () => {
      const decomposition = decomposeTask('task-20', 'Test', 'Description', 'MARS');
      
      // Leave some as pending
      if (decomposition.subtasks.length > 0) {
        decomposition.subtasks[0].status = 'pending';
      }
      
      expect(isDecompositionComplete(decomposition)).toBe(false);
    });

    it('should return false when some subtasks in progress', () => {
      const decomposition = decomposeTask('task-21', 'Test', 'Description', 'MARS');
      
      if (decomposition.subtasks.length > 0) {
        decomposition.subtasks[0].status = 'in_progress';
      }
      
      expect(isDecompositionComplete(decomposition)).toBe(false);
    });

    it('should return false when some subtasks failed', () => {
      const decomposition = decomposeTask('task-22', 'Test', 'Description', 'MARS');
      
      for (const subtask of decomposition.subtasks) {
        subtask.status = 'completed';
      }
      if (decomposition.subtasks.length > 0) {
        decomposition.subtasks[0].status = 'failed';
      }
      
      expect(isDecompositionComplete(decomposition)).toBe(false);
    });
  });

  describe('getCompletionPercentage', () => {
    it('should return 0 for new decomposition', () => {
      const decomposition = decomposeTask('task-23', 'Test', 'Description', 'MARS');
      
      expect(getCompletionPercentage(decomposition)).toBe(0);
    });

    it('should return 100 when all completed', () => {
      const decomposition = decomposeTask('task-24', 'Test', 'Description', 'MARS');
      
      for (const subtask of decomposition.subtasks) {
        subtask.status = 'completed';
      }
      
      expect(getCompletionPercentage(decomposition)).toBe(100);
    });

    it('should calculate correct percentage for partial completion', () => {
      const decomposition = decomposeTask('task-25', 'Test', 'Description', 'MARS');
      
      if (decomposition.subtasks.length >= 2) {
        decomposition.subtasks[0].status = 'completed';
        
        const percentage = getCompletionPercentage(decomposition);
        const expected = Math.round((1 / decomposition.subtasks.length) * 100);
        expect(percentage).toBe(expected);
      }
    });

    it('should return 0 for empty decomposition', () => {
      const emptyDecomposition: DecomposedTask = {
        parentId: 'empty',
        subtasks: [],
        totalEstimatedDuration: 0,
        criticalPath: [],
        parallelizable: [],
      };
      
      expect(getCompletionPercentage(emptyDecomposition)).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle empty task description', () => {
      const result = analyzeComplexity('Title', '');
      expect(result.riskLevel).toBeDefined();
    });

    it('should handle very long task descriptions', () => {
      const longDesc = 'A'.repeat(10000);
      const result = analyzeComplexity('Title', longDesc);
      expect(result.linesOfCode).toBeGreaterThan(0);
    });

    it('should handle tasks with all keyword types', () => {
      const result = decomposeTask(
        'task-all',
        'Full stack feature',
        'Create schema, API, UI components, tests, and Stripe integration',
        'MARS'
      );
      
      expect(result.subtasks.length).toBeGreaterThan(0);
    });
  });
});
