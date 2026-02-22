// RLM Integration Tests for Agent Loop
// K4-19: Verify RLM pipeline integration with AgentLoop

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentLoop } from '../agent-loop.js';
import { ToolRegistry, resetToolRegistry } from '../../tools/tool-registry.js';
import { registerCoreTools } from '../../tools/core-tools.js';
import { invalidateRepoMap } from '../../tools/repo-map.js';

// Mock LLM client
vi.mock('../../llm/ollama-client.js', () => ({
  callLLM: vi.fn(),
}));

import { callLLM } from '../../llm/ollama-client.js';

describe('Agent Loop RLM Integration', () => {
  let registry: ToolRegistry;
  let mockCallLLM: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    resetToolRegistry();
    invalidateRepoMap(process.cwd());
    registry = new ToolRegistry();
    registerCoreTools(registry);
    mockCallLLM = vi.mocked(callLLM);
    mockCallLLM.mockReset();
  });

  describe('Token Budget Tracking', () => {
    it('should track tokens in result', async () => {
      mockCallLLM.mockResolvedValueOnce({
        content: '<final_output>Result</final_output>',
        model: 'test',
        duration: 100,
        tokens: 200,
      });

      const loop = new AgentLoop(registry, {
        maxTurns: 5,
        enableTools: false,
        confidenceThreshold: 0.5, // Match default confidence
      });

      const result = await loop.run('MARS', 'You are a test agent', 'Task', 'task-1');

      expect(result.totalTokens).toBe(200);
      expect(result.output).toBe('Result');
    });

    it('should accumulate tokens across turns', async () => {
      mockCallLLM
        .mockResolvedValueOnce({
          content: 'Step 1',
          model: 'test',
          duration: 100,
          tokens: 100,
        })
        .mockResolvedValueOnce({
          content: '<final_output>Done</final_output>',
          model: 'test',
          duration: 100,
          tokens: 150,
        });

      const loop = new AgentLoop(registry, {
        maxTurns: 5,
        enableTools: false,
        confidenceThreshold: 0.5,
      });

      const result = await loop.run('MARS', 'You are a test agent', 'Task', 'task-1');

      expect(result.totalTokens).toBe(250);
      expect(result.turns).toBe(2);
    });
  });

  describe('Model Selection', () => {
    it('should use thinking model', async () => {
      mockCallLLM.mockResolvedValueOnce({
        content: '<final_output>Done</final_output>',
        model: 'test',
        duration: 100,
        tokens: 100,
      });

      const loop = new AgentLoop(registry, {
        thinkingModel: 'qwen2.5:7b',
        enableTools: false,
        confidenceThreshold: 0.5,
      });

      await loop.run('MARS', 'You are a test agent', 'Task', 'task-1');

      expect(mockCallLLM).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        'MARS',
        expect.objectContaining({
          model: 'qwen2.5:7b',
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle LLM errors', async () => {
      mockCallLLM.mockRejectedValueOnce(new Error('Service down'));

      const loop = new AgentLoop(registry, {
        maxTurns: 5,
        enableTools: false,
      });

      const result = await loop.run('MARS', 'You are a test agent', 'Task', 'task-1');

      expect(result.stoppedBecause).toBe('error');
      expect(result.confidence).toBe(0);
    });
  });
});
