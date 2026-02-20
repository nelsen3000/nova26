// KMS-26: Test Runner Gate Tests

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { testRunnerGate } from '../test-runner-gate.js';
import * as pistonClient from '../piston-client.js';
import type { LLMResponse, Task, GateResult } from '../../types/index.js';

describe('testRunnerGate', () => {
  let mockPistonClient: {
    isAvailable: ReturnType<typeof vi.fn>;
    executeTypeScript: ReturnType<typeof vi.fn>;
    executeJavaScript: ReturnType<typeof vi.fn>;
    executePython: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockPistonClient = {
      isAvailable: vi.fn().mockResolvedValue(true),
      executeTypeScript: vi.fn(),
      executeJavaScript: vi.fn(),
      executePython: vi.fn(),
    };

    vi.spyOn(pistonClient, 'getPistonClient').mockReturnValue(mockPistonClient as any);
  });

  describe('agent filtering', () => {
    it('should skip for non-MARS/VENUS agents', async () => {
      const response: LLMResponse = { content: '```typescript\nconsole.log("test");\n```' };
      const task: Task = { agent: 'EARTH', id: '1', title: 'Test' } as Task;

      const result = await testRunnerGate(response, task);

      expect(result.passed).toBe(true);
      expect(result.message).toContain('skipping');
    });

    it('should run for MARS agent', async () => {
      mockPistonClient.executeTypeScript.mockResolvedValue({
        stdout: 'SMOKE_TEST_PASSED',
        stderr: '',
        exitCode: 0,
      });

      const response: LLMResponse = { content: '```typescript\nconsole.log("test");\n```' };
      const task: Task = { agent: 'MARS', id: '1', title: 'Test' } as Task;

      const result = await testRunnerGate(response, task);

      expect(mockPistonClient.executeTypeScript).toHaveBeenCalled();
    });

    it('should run for VENUS agent', async () => {
      mockPistonClient.executeJavaScript.mockResolvedValue({
        stdout: 'SMOKE_TEST_PASSED',
        stderr: '',
        exitCode: 0,
      });

      const response: LLMResponse = { content: '```javascript\nconsole.log("test");\n```' };
      const task: Task = { agent: 'VENUS', id: '1', title: 'Test' } as Task;

      const result = await testRunnerGate(response, task);

      expect(mockPistonClient.executeJavaScript).toHaveBeenCalled();
    });
  });

  describe('Piston availability', () => {
    it('should skip when Piston is not available', async () => {
      mockPistonClient.isAvailable.mockResolvedValue(false);

      const response: LLMResponse = { content: '```typescript\nconsole.log("test");\n```' };
      const task: Task = { agent: 'MARS', id: '1', title: 'Test' } as Task;

      const result = await testRunnerGate(response, task);

      expect(result.passed).toBe(true);
      expect(result.message).toContain('Piston not available');
    });
  });

  describe('code extraction', () => {
    it('should skip when no code blocks found', async () => {
      const response: LLMResponse = { content: 'Some text without code' };
      const task: Task = { agent: 'MARS', id: '1', title: 'Test' } as Task;

      const result = await testRunnerGate(response, task);

      expect(result.passed).toBe(true);
      expect(result.message).toContain('No executable code blocks');
    });

    it('should extract TypeScript code blocks', async () => {
      mockPistonClient.executeTypeScript.mockResolvedValue({
        stdout: 'SMOKE_TEST_PASSED',
        stderr: '',
        exitCode: 0,
      });

      const response: LLMResponse = { content: '```typescript\nconst x = 1;\n```' };
      const task: Task = { agent: 'MARS', id: '1', title: 'Test' } as Task;

      await testRunnerGate(response, task);

      expect(mockPistonClient.executeTypeScript).toHaveBeenCalled();
      expect(mockPistonClient.executeTypeScript.mock.calls[0][0]).toContain('const x = 1;');
    });

    it('should extract JavaScript code blocks', async () => {
      mockPistonClient.executeJavaScript.mockResolvedValue({
        stdout: 'SMOKE_TEST_PASSED',
        stderr: '',
        exitCode: 0,
      });

      const response: LLMResponse = { content: '```javascript\nconsole.log("test");\n```' };
      const task: Task = { agent: 'MARS', id: '1', title: 'Test' } as Task;

      await testRunnerGate(response, task);

      expect(mockPistonClient.executeJavaScript).toHaveBeenCalled();
    });

    it('should extract Python code blocks', async () => {
      mockPistonClient.executePython.mockResolvedValue({
        stdout: 'SMOKE_TEST_PASSED',
        stderr: '',
        exitCode: 0,
      });

      const response: LLMResponse = { content: '```python\nprint("hello")\n```' };
      const task: Task = { agent: 'MARS', id: '1', title: 'Test' } as Task;

      await testRunnerGate(response, task);

      expect(mockPistonClient.executePython).toHaveBeenCalled();
    });

    it('should extract multiple code blocks', async () => {
      mockPistonClient.executeTypeScript.mockResolvedValue({
        stdout: 'SMOKE_TEST_PASSED',
        stderr: '',
        exitCode: 0,
      });

      const response: LLMResponse = {
        content: '```typescript\nconst a = 1;\n```\n\n```typescript\nconst b = 2;\n```',
      };
      const task: Task = { agent: 'MARS', id: '1', title: 'Test' } as Task;

      await testRunnerGate(response, task);

      expect(mockPistonClient.executeTypeScript).toHaveBeenCalledTimes(2);
    });
  });

  describe('smoke test execution', () => {
    it('should pass when smoke test passes', async () => {
      mockPistonClient.executeTypeScript.mockResolvedValue({
        stdout: 'SMOKE_TEST_PASSED',
        stderr: '',
        exitCode: 0,
      });

      const response: LLMResponse = { content: '```typescript\nconsole.log("test");\n```' };
      const task: Task = { agent: 'MARS', id: '1', title: 'Test' } as Task;

      const result = await testRunnerGate(response, task);

      expect(result.passed).toBe(true);
      expect(result.message).toContain('Smoke tests passed');
    });

    it('should fail when smoke test fails', async () => {
      mockPistonClient.executeTypeScript.mockResolvedValue({
        stdout: '',
        stderr: 'ReferenceError: x is not defined',
        exitCode: 1,
      });

      const response: LLMResponse = { content: '```typescript\nconsole.log(x);\n```' };
      const task: Task = { agent: 'MARS', id: '1', title: 'Test' } as Task;

      const result = await testRunnerGate(response, task);

      expect(result.passed).toBe(false);
      expect(result.message).toContain('Smoke test failed');
    });

    it('should include code in smoke test wrapper', async () => {
      mockPistonClient.executeTypeScript.mockResolvedValue({
        stdout: 'SMOKE_TEST_PASSED',
        stderr: '',
        exitCode: 0,
      });

      const response: LLMResponse = { content: '```typescript\nconst test = 42;\n```' };
      const task: Task = { agent: 'MARS', id: '1', title: 'Test' } as Task;

      await testRunnerGate(response, task);

      const smokeTestCode = mockPistonClient.executeTypeScript.mock.calls[0][0];
      expect(smokeTestCode).toContain('try {');
      expect(smokeTestCode).toContain('const test = 42;');
      expect(smokeTestCode).toContain('SMOKE_TEST_PASSED');
    });

    it('should create Python smoke test wrapper', async () => {
      mockPistonClient.executePython.mockResolvedValue({
        stdout: 'SMOKE_TEST_PASSED',
        stderr: '',
        exitCode: 0,
      });

      const response: LLMResponse = { content: '```python\nx = 1\n```' };
      const task: Task = { agent: 'MARS', id: '1', title: 'Test' } as Task;

      await testRunnerGate(response, task);

      const smokeTestCode = mockPistonClient.executePython.mock.calls[0][0];
      expect(smokeTestCode).toContain('try:');
      expect(smokeTestCode).toContain('x = 1');
    });
  });

  describe('error handling', () => {
    it('should handle Piston execution error', async () => {
      mockPistonClient.executeTypeScript.mockRejectedValue(new Error('Network error'));

      const response: LLMResponse = { content: '```typescript\nconsole.log("test");\n```' };
      const task: Task = { agent: 'MARS', id: '1', title: 'Test' } as Task;

      // Should not throw, but handle gracefully
      await expect(testRunnerGate(response, task)).rejects.toThrow();
    });
  });

  describe('result format', () => {
    it('should return correct GateResult structure on pass', async () => {
      mockPistonClient.executeTypeScript.mockResolvedValue({
        stdout: 'SMOKE_TEST_PASSED',
        stderr: '',
        exitCode: 0,
      });

      const response: LLMResponse = { content: '```typescript\nconsole.log("test");\n```' };
      const task: Task = { agent: 'MARS', id: '1', title: 'Test' } as Task;

      const result = await testRunnerGate(response, task);

      expect(result).toHaveProperty('gate', 'test-runner');
      expect(result).toHaveProperty('passed');
      expect(result).toHaveProperty('message');
    });

    it('should return correct GateResult structure on fail', async () => {
      mockPistonClient.executeTypeScript.mockResolvedValue({
        stdout: '',
        stderr: 'Error',
        exitCode: 1,
      });

      const response: LLMResponse = { content: '```typescript\nthrow new Error();\n```' };
      const task: Task = { agent: 'MARS', id: '1', title: 'Test' } as Task;

      const result = await testRunnerGate(response, task);

      expect(result).toHaveProperty('gate', 'test-runner');
      expect(result.passed).toBe(false);
    });
  });
});
