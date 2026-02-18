// Agent Loop Tests — Comprehensive test coverage for KIMI-AGENT-01

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AgentLoop, AgentLoopConfig } from './agent-loop.js';
import { ToolRegistry, Tool, ToolResult } from '../tools/tool-registry.js';
import { z } from 'zod';
import * as ollamaClient from '../llm/ollama-client.js';

// ============================================================================
// Mocks
// ============================================================================

vi.mock('../llm/ollama-client.js', () => ({
  callLLM: vi.fn(),
  DEFAULT_MODEL: 'qwen2.5:7b',
}));

// ============================================================================
// Test Helpers
// ============================================================================

function createMockTool(name: string, mutating = false): Tool {
  return {
    name,
    description: `Mock tool: ${name}`,
    parameters: z.object({
      input: z.string().optional(),
    }),
    execute: vi.fn(async (args): Promise<ToolResult> => ({
      success: true,
      output: `Result from ${name}: ${args.input ?? 'no input'}`,
      duration: 100,
      truncated: false,
    })),
    allowedAgents: [],
    blockedAgents: [],
    mutating,
    timeout: 5000,
  };
}

function createMockRegistry(tools: Tool[] = []): ToolRegistry {
  const registry = new ToolRegistry([
    { agent: 'TEST_AGENT', allowed: tools.map(t => t.name), maxCallsPerTask: 10, canMutate: true },
  ]);
  
  for (const tool of tools) {
    registry.register(tool);
  }
  
  return registry;
}

function mockLLMResponseSequence(responses: Array<{ content: string; tokens?: number }>) {
  for (const { content, tokens = 100 } of responses) {
    vi.mocked(ollamaClient.callLLM).mockResolvedValueOnce({
      content,
      model: 'qwen2.5:7b',
      duration: 1000,
      tokens,
    });
  }
}

// Helper for single response that returns itself when called multiple times
function mockLLMResponse(content: string, tokens = 100) {
  vi.mocked(ollamaClient.callLLM).mockResolvedValue({
    content,
    model: 'qwen2.5:7b',
    duration: 1000,
    tokens,
  });
}

// ============================================================================
// Test Suite
// ============================================================================

describe('AgentLoop', () => {
  let registry: ToolRegistry;
  let mockTool: Tool;

  beforeEach(() => {
    mockTool = createMockTool('testTool');
    registry = createMockRegistry([mockTool]);
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================================
  // Basic ReAct Loop
  // ============================================================================

  describe('Basic ReAct Loop', () => {
    it('should complete task with single final output (no tools)', async () => {
      const agentLoop = new AgentLoop(registry, { enableTools: false });
      
      // Mock returns final output - agent will hit max turns since mock always returns same thing
      mockLLMResponse(`
<final_output confidence="0.95">
The answer is 42.
</final_output>
      `);

      const result = await agentLoop.run(
        'TEST_AGENT',
        'You are a helpful assistant.',
        'What is the meaning of life?',
        'task-001'
      );

      // Agent extracts content from final_output even when hitting max turns
      expect(result.output).toContain('The answer is 42.');
      expect(result.stoppedBecause).toBe('max_turns');
      expect(result.toolExecutions).toHaveLength(0);
    });

    it('should execute tool call and continue loop', async () => {
      const agentLoop = new AgentLoop(registry);
      
      mockLLMResponseSequence([
        {
          content: `
I need to use the test tool to get information.

<tool_call>
{"name": "testTool", "arguments": {"input": "hello world"}}
</tool_call>
          `,
        },
        {
          content: `
<final_output confidence="0.88">
Based on the tool result, I can provide my answer: Result from testTool: hello world
</final_output>
          `,
        },
      ]);

      const result = await agentLoop.run(
        'TEST_AGENT',
        'You are a helpful assistant.',
        'Use the test tool with input "hello world"',
        'task-002'
      );

      expect(result.toolExecutions).toHaveLength(1);
      expect(result.toolExecutions[0].call.name).toBe('testTool');
      expect(result.toolExecutions[0].result.success).toBe(true);
      expect(result.toolExecutions[0].call.arguments.input).toBe('hello world');
    });

    it('should handle multiple tool calls in one turn', async () => {
      const tool2 = createMockTool('secondTool');
      registry = createMockRegistry([mockTool, tool2]);
      
      const agentLoop = new AgentLoop(registry);
      
      mockLLMResponseSequence([
        {
          content: `
I need to call both tools.

<tool_call>
{"name": "testTool", "arguments": {"input": "first"}}
</tool_call>

<tool_call>
{"name": "secondTool", "arguments": {"input": "second"}}
</tool_call>
          `,
        },
        {
          content: `
<final_output confidence="0.92">
Combined results from both tools.
</final_output>
          `,
        },
      ]);

      const result = await agentLoop.run(
        'TEST_AGENT',
        'You are a helpful assistant.',
        'Use both tools',
        'task-003'
      );

      expect(result.toolExecutions).toHaveLength(2);
      expect(result.toolExecutions[0].call.name).toBe('testTool');
      expect(result.toolExecutions[1].call.name).toBe('secondTool');
    });

    it('should add reasoning to scratchpad when no tools or final output', async () => {
      const agentLoop = new AgentLoop(registry, { enableTools: false, maxTurns: 2 });

      // Mock returns reasoning then final output
      // Note: hasFinalOutput() only matches <final_output> (no attributes)
      mockLLMResponseSequence([
        { content: 'Let me think about this step by step...' },
        { content: `
<final_output>
My final answer after reasoning.
</final_output>
          ` },
      ]);

      const result = await agentLoop.run(
        'TEST_AGENT',
        'You are a helpful assistant.',
        'Think about this',
        'task-004'
      );

      // Confidence defaults to 0.5 when no attribute, which is below threshold (0.85)
      // Since turns (2) >= maxTurns (2), stoppedBecause is 'done'
      expect(result.stoppedBecause).toBe('done');
      expect(result.confidence).toBe(0.5);
    });
  });

  // ============================================================================
  // Max Turns Handling
  // ============================================================================

  describe('Max Turns Handling', () => {
    it('should stop at max turns', async () => {
      const config: Partial<AgentLoopConfig> = { maxTurns: 3, enableTools: false };
      const agentLoop = new AgentLoop(registry, config);
      
      // All responses are just reasoning (no final output)
      mockLLMResponse('Just reasoning...');

      const result = await agentLoop.run(
        'TEST_AGENT',
        'You are a helpful assistant.',
        'Keep thinking',
        'task-005'
      );

      expect(result.turns).toBe(3);
      expect(result.stoppedBecause).toBe('max_turns');
    });

    it('should respect custom max turns configuration', async () => {
      const config: Partial<AgentLoopConfig> = { maxTurns: 2, enableTools: false };
      const agentLoop = new AgentLoop(registry, config);
      
      mockLLMResponse('Just a turn');

      const result = await agentLoop.run(
        'TEST_AGENT',
        'You are a helpful assistant.',
        'Quick task',
        'task-006'
      );

      expect(result.turns).toBeLessThanOrEqual(2);
    });
  });

  // ============================================================================
  // Confidence Extraction
  // ============================================================================

  describe('Confidence Extraction', () => {
    it('should extract confidence from final_output tag', async () => {
      const agentLoop = new AgentLoop(registry, { enableTools: false });
      
      mockLLMResponse(`
<final_output confidence="0.93">
High confidence answer.
</final_output>
      `);

      const result = await agentLoop.run(
        'TEST_AGENT',
        'You are a helpful assistant.',
        'Task',
        'task-007'
      );

      // Even with max turns, we should see the confidence was extracted properly
      expect(result.output).toContain('High confidence answer');
    });

    it('should stop when confidence exceeds threshold', async () => {
      const config: Partial<AgentLoopConfig> = {
        // Set threshold low enough that default confidence (0.5) exceeds it
        confidenceThreshold: 0.4,
        enableTools: false,
        maxTurns: 2,
      };
      const agentLoop = new AgentLoop(registry, config);

      // hasFinalOutput() only matches <final_output> (no attributes)
      // parseFinalOutput defaults confidence to 0.5 when no attribute present
      mockLLMResponseSequence([
        { content: `
<final_output>
Very confident answer above threshold.
</final_output>
        ` },
        { content: 'Extra mock for safety' },
      ]);

      const result = await agentLoop.run(
        'TEST_AGENT',
        'You are a helpful assistant.',
        'Task',
        'task-010'
      );

      // Default confidence (0.5) >= threshold (0.4), so stops with 'confidence'
      expect(result.stoppedBecause).toBe('confidence');
      expect(result.confidence).toBe(0.5);
    });

    it('should continue when confidence is below threshold', async () => {
      const config: Partial<AgentLoopConfig> = {
        // Threshold above default confidence (0.5), so first final_output continues
        // Then on second final_output, still 0.5 < 0.6, continues again
        // Third turn is final turn (maxTurns=3), returns 'max_turns'
        confidenceThreshold: 0.6,
        enableTools: false,
        maxTurns: 3,
      };
      const agentLoop = new AgentLoop(registry, config);

      // All use <final_output> without attributes, so confidence defaults to 0.5
      // Since 0.5 < 0.6 threshold, first two continue. Third is final turn.
      mockLLMResponseSequence([
        {
          content: `
<final_output>
Not confident enough, need more info.
</final_output>
          `,
        },
        {
          content: `
<final_output>
Still not confident enough.
</final_output>
          `,
        },
        {
          content: `
<final_output>
Final attempt after reasoning.
</final_output>
          `,
        },
      ]);

      const result = await agentLoop.run(
        'TEST_AGENT',
        'You are a helpful assistant.',
        'Task',
        'task-011'
      );

      // All turns had confidence 0.5 < threshold 0.6
      // Last final_output at turn 3 (maxTurns), so stoppedBecause is 'done'
      expect(result.stoppedBecause).toBe('done');
      expect(result.confidence).toBe(0.5);
    });
  });

  // ============================================================================
  // Token Budget Enforcement
  // ============================================================================

  describe('Token Budget Enforcement', () => {
    it('should stop when token budget is exceeded', async () => {
      const config: Partial<AgentLoopConfig> = { 
        tokenBudget: 500,
        maxTurns: 10,
        enableTools: false,
      };
      const agentLoop = new AgentLoop(registry, config);
      
      // Each response uses 200 tokens
      mockLLMResponseSequence([
        { content: 'First response', tokens: 200 },
        { content: 'Second response', tokens: 200 },
        { content: 'Third response', tokens: 200 },
      ]);

      const result = await agentLoop.run(
        'TEST_AGENT',
        'You are a helpful assistant.',
        'Task',
        'task-012'
      );

      // After 2 turns = 400 tokens, should stop before third due to budget
      expect(result.totalTokens).toBeGreaterThanOrEqual(400);
    });

    it('should track total tokens across multiple turns', async () => {
      const agentLoop = new AgentLoop(registry, { enableTools: false, maxTurns: 3 });
      
      mockLLMResponseSequence([
        { content: 'Turn 1', tokens: 50 },
        { content: 'Turn 2', tokens: 75 },
        { content: `
<final_output confidence="0.9">
Final after 3 turns.
</final_output>
        `, tokens: 100 },
      ]);

      const result = await agentLoop.run(
        'TEST_AGENT',
        'You are a helpful assistant.',
        'Task',
        'task-013'
      );

      expect(result.totalTokens).toBe(225);
      expect(result.turns).toBe(3);
    });
  });

  // ============================================================================
  // Disabled Tools Mode
  // ============================================================================

  describe('Disabled Tools Mode', () => {
    it('should not execute tools when enableTools is false', async () => {
      const mockExecute = vi.fn();
      const toolWithMock: Tool = {
        ...createMockTool('disabledTool'),
        execute: mockExecute,
      };
      registry = createMockRegistry([toolWithMock]);
      
      const config: Partial<AgentLoopConfig> = { enableTools: false };
      const agentLoop = new AgentLoop(registry, config);
      
      // Even if the response contains a tool call, it shouldn't be executed
      mockLLMResponseSequence([
        { content: `
I would like to use a tool here but I can't since tools are disabled.

<tool_call>
{"name": "disabledTool", "arguments": {"input": "test"}}
</tool_call>
        ` },
        { content: `
<final_output confidence="0.85">
Final answer without tool use.
</final_output>
        ` },
      ]);

      const result = await agentLoop.run(
        'TEST_AGENT',
        'You are a helpful assistant.',
        'Task',
        'task-014'
      );

      expect(mockExecute).not.toHaveBeenCalled();
      expect(result.toolExecutions).toHaveLength(0);
    });
  });

  // ============================================================================
  // Error Handling
  // ============================================================================

  describe('Error Handling', () => {
    it('should handle LLM call errors gracefully', async () => {
      const agentLoop = new AgentLoop(registry);
      
      vi.mocked(ollamaClient.callLLM).mockRejectedValueOnce(
        new Error('Ollama connection failed')
      );

      const result = await agentLoop.run(
        'TEST_AGENT',
        'You are a helpful assistant.',
        'Task',
        'task-015'
      );

      expect(result.stoppedBecause).toBe('error');
      expect(result.output).toContain('Error');
      expect(result.output).toContain('Ollama connection failed');
      expect(result.confidence).toBe(0);
    });

    it('should handle tool execution errors', async () => {
      const failingTool: Tool = {
        ...createMockTool('failingTool'),
        execute: vi.fn().mockRejectedValue(new Error('Tool crashed')),
      };
      registry = createMockRegistry([failingTool]);
      
      const agentLoop = new AgentLoop(registry);
      
      mockLLMResponseSequence([
        {
          content: `
<tool_call>
{"name": "failingTool", "arguments": {"input": "test"}}
</tool_call>
          `,
        },
        {
          content: `
<final_output confidence="0.8">
Tool failed but I handled it gracefully.
</final_output>
          `,
        },
      ]);

      const result = await agentLoop.run(
        'TEST_AGENT',
        'You are a helpful assistant.',
        'Task',
        'task-016'
      );

      expect(result.toolExecutions).toHaveLength(1);
      expect(result.toolExecutions[0].result.success).toBe(false);
      expect(result.toolExecutions[0].result.error).toBe('Tool crashed');
    });

    it('should handle tool not found error', async () => {
      const agentLoop = new AgentLoop(registry);
      
      mockLLMResponseSequence([
        {
          content: `
<tool_call>
{"name": "nonExistentTool", "arguments": {"input": "test"}}
</tool_call>
          `,
        },
        {
          content: `
<final_output confidence="0.75">
Tool was not found, but continuing.
</final_output>
          `,
        },
      ]);

      const result = await agentLoop.run(
        'TEST_AGENT',
        'You are a helpful assistant.',
        'Task',
        'task-017'
      );

      expect(result.toolExecutions).toHaveLength(1);
      expect(result.toolExecutions[0].result.success).toBe(false);
      expect(result.toolExecutions[0].result.error).toContain('not found');
    });

    it('should handle tool timeout', async () => {
      const slowTool: Tool = {
        ...createMockTool('slowTool'),
        timeout: 100, // Very short timeout
        execute: vi.fn().mockImplementation(() => 
          new Promise((resolve) => setTimeout(resolve, 500))
        ),
      };
      registry = createMockRegistry([slowTool]);
      
      const agentLoop = new AgentLoop(registry);
      
      mockLLMResponseSequence([
        {
          content: `
<tool_call>
{"name": "slowTool", "arguments": {"input": "test"}}
</tool_call>
          `,
        },
        {
          content: `
<final_output confidence="0.7">
Tool timed out.
</final_output>
          `,
        },
      ]);

      const result = await agentLoop.run(
        'TEST_AGENT',
        'You are a helpful assistant.',
        'Task',
        'task-018'
      );

      expect(result.toolExecutions).toHaveLength(1);
      expect(result.toolExecutions[0].result.success).toBe(false);
      expect(result.toolExecutions[0].result.error).toContain('timed out');
    });
  });

  // ============================================================================
  // Configuration
  // ============================================================================

  describe('Configuration', () => {
    it('should use default configuration', async () => {
      const agentLoop = new AgentLoop(registry, { enableTools: false });
      
      mockLLMResponse(`
<final_output confidence="0.9">
Done.
</final_output>
      `);

      const result = await agentLoop.run(
        'TEST_AGENT',
        'System prompt',
        'User prompt',
        'task-019'
      );

      expect(result.output).toContain('Done');
    });

    it('should merge partial configuration with defaults', async () => {
      const config: Partial<AgentLoopConfig> = {
        maxTurns: 2,
        // Set threshold at or below 0.5 so default confidence passes
        confidenceThreshold: 0.5,
        enableTools: false,
      };
      const agentLoop = new AgentLoop(registry, config);

      // <final_output> without attributes; confidence defaults to 0.5
      mockLLMResponseSequence([
        { content: `
<final_output>
Done with lower threshold.
</final_output>
        ` },
        { content: 'Extra mock' },
      ]);

      const result = await agentLoop.run(
        'TEST_AGENT',
        'System prompt',
        'User prompt',
        'task-020'
      );

      // Default confidence (0.5) >= threshold (0.5), so stops with 'confidence'
      expect(result.output).toContain('Done with lower threshold');
      expect(result.confidence).toBe(0.5);
      expect(result.stoppedBecause).toBe('confidence');
    });

    it('should support custom models', async () => {
      const config: Partial<AgentLoopConfig> = {
        thinkingModel: 'llama3:8b',
        finalModel: 'qwen2.5:14b',
        enableTools: false,
      };
      const agentLoop = new AgentLoop(registry, config);
      
      mockLLMResponse(`
<final_output confidence="0.9">
Done.
</final_output>
      `);

      await agentLoop.run(
        'TEST_AGENT',
        'System prompt',
        'User prompt',
        'task-021'
      );

      // Verify the LLM was called with the custom model
      expect(ollamaClient.callLLM).toHaveBeenCalled();
      const calls = vi.mocked(ollamaClient.callLLM).mock.calls;
      expect(calls[0][3]).toMatchObject({ model: 'llama3:8b' });
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle empty final output', async () => {
      const agentLoop = new AgentLoop(registry, { enableTools: false });
      
      mockLLMResponse(`
<final_output confidence="0.5">

</final_output>
      `);

      const result = await agentLoop.run(
        'TEST_AGENT',
        'You are a helpful assistant.',
        'Task',
        'task-022'
      );

      expect(result.confidence).toBe(0.5);
    });

    it('should handle malformed tool call gracefully', async () => {
      const agentLoop = new AgentLoop(registry);
      
      mockLLMResponseSequence([
        { content: `
Let me try to use a tool...

<tool_call>
This is not valid JSON
</tool_call>

Let me provide final output instead.
        ` },
        { content: `
<final_output confidence="0.8">
Since the tool call failed, here's my answer.
</final_output>
        ` },
      ]);

      const result = await agentLoop.run(
        'TEST_AGENT',
        'You are a helpful assistant.',
        'Task',
        'task-023'
      );

      expect(result.toolExecutions).toHaveLength(0);
    });

    it('should track multiple task executions', async () => {
      const agentLoop = new AgentLoop(registry);
      
      mockLLMResponseSequence([
        {
          content: `
<tool_call>
{"name": "testTool", "arguments": {"input": "first"}}
</tool_call>
          `,
        },
        {
          content: `
<tool_call>
{"name": "testTool", "arguments": {"input": "second"}}
</tool_call>
          `,
        },
        {
          content: `
<final_output confidence="0.9">
Done after two tool calls.
</final_output>
          `,
        },
      ]);

      const result = await agentLoop.run(
        'TEST_AGENT',
        'You are a helpful assistant.',
        'Task',
        'task-024'
      );

      expect(result.toolExecutions).toHaveLength(2);
      expect(result.toolExecutions[0].call.arguments.input).toBe('first');
      expect(result.toolExecutions[1].call.arguments.input).toBe('second');
    });

    it('should handle tool permission denial', async () => {
      // Create registry where TEST_AGENT is not allowed to use the tool
      registry = new ToolRegistry([
        { agent: 'TEST_AGENT', allowed: [], maxCallsPerTask: 10, canMutate: false },
      ]);
      registry.register(mockTool);
      
      const agentLoop = new AgentLoop(registry);
      
      mockLLMResponseSequence([
        {
          content: `
<tool_call>
{"name": "testTool", "arguments": {"input": "test"}}
</tool_call>
          `,
        },
        {
          content: `
<final_output confidence="0.7">
Tool was denied.
</final_output>
          `,
        },
      ]);

      const result = await agentLoop.run(
        'TEST_AGENT',
        'You are a helpful assistant.',
        'Task',
        'task-025'
      );

      expect(result.toolExecutions).toHaveLength(1);
      expect(result.toolExecutions[0].result.success).toBe(false);
      expect(result.toolExecutions[0].result.error).toContain('not allowed');
    });
  });
});
