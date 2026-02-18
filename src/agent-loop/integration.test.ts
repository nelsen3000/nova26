// Integration Tests for Agentic Inner Loop
// Full flow: Task → AgentLoop → Tool calls → Final output

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentLoop } from './agent-loop.js';
import { ToolRegistry, resetToolRegistry } from '../tools/tool-registry.js';
import { registerCoreTools } from '../tools/core-tools.js';
import { Scratchpad } from './scratchpad.js';
import { invalidateRepoMap } from '../tools/repo-map.js';

// Mock LLM client
vi.mock('../llm/ollama-client.js', () => ({
  callLLM: vi.fn(),
}));

import { callLLM } from '../llm/ollama-client.js';

describe('Agentic Integration', () => {
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

  describe('Full Agent Loop Flow', () => {
    it('should return final output when provided directly', async () => {
      // hasFinalOutput() matches <final_output> (no attributes)
      // parseFinalOutput defaults confidence to 0.5 when no attribute is present
      mockCallLLM.mockResolvedValueOnce({
        content: '<final_output>Direct final output</final_output>',
        model: 'test',
        duration: 100,
        tokens: 50,
      });

      // Set confidenceThreshold <= 0.5 so default confidence (0.5) triggers stop
      const loop = new AgentLoop(registry, { maxTurns: 5, enableTools: false, confidenceThreshold: 0.5 });
      const result = await loop.run('MARS', 'You are a test agent', 'Simple task', 'task-1');

      expect(result.output).toBe('Direct final output');
      expect(result.confidence).toBe(0.5);
      expect(result.stoppedBecause).toBe('confidence');
      expect(result.turns).toBe(1);
    });

    it('should handle disabled tools mode', async () => {
      // hasFinalOutput() matches <final_output> (no attributes)
      // parseFinalOutput defaults confidence to 0.5 when no attribute
      mockCallLLM.mockResolvedValueOnce({
        content: '<final_output>Output without tools</final_output>',
        model: 'test',
        duration: 100,
        tokens: 30,
      });

      // Set confidenceThreshold <= 0.5 so default confidence triggers stop
      const loop = new AgentLoop(registry, { enableTools: false, confidenceThreshold: 0.5 });
      const result = await loop.run('MARS', 'You are a test agent', 'Do something', 'task-1');

      expect(result.output).toBe('Output without tools');
      expect(result.toolExecutions).toHaveLength(0);
    });

    it('should stop at max turns', async () => {
      // Mock responses that never provide final output
      mockCallLLM.mockResolvedValue({
        content: 'Still thinking about this...',
        model: 'test',
        duration: 100,
        tokens: 30,
      });

      const loop = new AgentLoop(registry, { maxTurns: 3, enableTools: false });
      const result = await loop.run('MARS', 'You are a test agent', 'Hard task', 'task-1');

      expect(result.stoppedBecause).toBe('max_turns');
      expect(result.turns).toBe(3);
    });
  });

  describe('Scratchpad Integration', () => {
    it('should maintain conversation context across turns', () => {
      const scratchpad = new Scratchpad({ maxTokens: 10000 });
      
      scratchpad.add('user', 'Task: create a button');
      scratchpad.add('assistant', 'Let me explore first.');
      scratchpad.add('tool', 'Found: Button.tsx, Card.tsx', { toolName: 'listFiles' });
      
      const messages = scratchpad.getMessages();
      expect(messages).toHaveLength(3);
      expect(messages[0].role).toBe('user');
      expect(messages[1].role).toBe('assistant');
      expect(messages[2].role).toBe('tool');
    });

    it('should track turn count correctly', () => {
      const scratchpad = new Scratchpad();
      
      scratchpad.add('user', 'Task 1');
      scratchpad.add('assistant', 'Response 1');
      scratchpad.add('assistant', 'Response 2'); // Multiple assistant messages
      
      expect(scratchpad.getTurnCount()).toBe(2);
    });

    it('should truncate oversized tool outputs', () => {
      const scratchpad = new Scratchpad({ maxToolOutputTokens: 10 });
      
      const longOutput = 'a'.repeat(1000); // ~250 tokens
      scratchpad.add('tool', longOutput, { toolName: 'readFile' });
      
      const messages = scratchpad.getMessages();
      expect(messages[0].content).toContain('truncated');
    });
  });

  describe('Tool Registry Integration', () => {
    it('should filter tools by agent permissions', () => {
      // MARS should have readFile, writeFile, searchCode, checkTypes, runTests, listFiles
      const marsTools = registry.listForAgent('MARS');
      const marsToolNames = marsTools.map(t => t.name);
      
      expect(marsToolNames).toContain('readFile');
      expect(marsToolNames).toContain('writeFile');
      expect(marsToolNames).toContain('searchCode');
      
      // SUN should have fewer tools (read-only)
      const sunTools = registry.listForAgent('SUN');
      expect(sunTools.length).toBeLessThanOrEqual(marsTools.length);
    });

    it('should check tool permissions correctly', () => {
      // MARS can use readFile
      const canRead = registry.canCall('MARS', 'readFile', 'task-1');
      expect(canRead.allowed).toBe(true);
      
      // Unknown agent cannot use tools
      const unknown = registry.canCall('UNKNOWN', 'readFile', 'task-1');
      expect(unknown.allowed).toBe(false);
      
      // Non-existent tool
      const notFound = registry.canCall('MARS', 'nonExistent', 'task-1');
      expect(notFound.allowed).toBe(false);
    });

    it('should track call counts for rate limiting', () => {
      // Record some calls
      registry.recordCall('MARS', 'task-1');
      registry.recordCall('MARS', 'task-1');
      registry.recordCall('MARS', 'task-1');
      
      // Calls should still be allowed (MARS has max 20)
      expect(registry.canCall('MARS', 'readFile', 'task-1').allowed).toBe(true);
      
      // Reset should clear counts for this task
      registry.resetCallCounts('task-1');
    });
  });

  describe('AgentLoop Configuration', () => {
    it('should use default config when none provided', () => {
      const loop = new AgentLoop(registry);
      
      // Access internal config for testing
      const config = (loop as any).config;
      expect(config.maxTurns).toBe(8);
      expect(config.confidenceThreshold).toBe(0.85);
      expect(config.enableTools).toBe(true);
    });

    it('should merge custom config with defaults', () => {
      const loop = new AgentLoop(registry, { maxTurns: 5, enableTools: false });
      
      const config = (loop as any).config;
      expect(config.maxTurns).toBe(5);
      expect(config.enableTools).toBe(false);
      expect(config.confidenceThreshold).toBe(0.85); // Default preserved
    });
  });
});
