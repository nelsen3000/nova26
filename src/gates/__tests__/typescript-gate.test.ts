// KMS-26: TypeScript Gate Tests

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { typescriptCheckGate } from '../typescript-gate.js';
import * as pistonClient from '../piston-client.js';
import type { LLMResponse, Task, GateResult } from '../../types/index.js';

describe('typescriptCheckGate', () => {
  let mockPistonClient: {
    isAvailable: ReturnType<typeof vi.fn>;
    getRuntimes: ReturnType<typeof vi.fn>;
    executeTypeScript: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockPistonClient = {
      isAvailable: vi.fn().mockResolvedValue(true),
      getRuntimes: vi.fn().mockResolvedValue([
        { language: 'typescript', version: '5.0', aliases: ['ts'] },
        { language: 'javascript', version: '18', aliases: ['js'] },
      ]),
      executeTypeScript: vi.fn(),
    };

    vi.spyOn(pistonClient, 'getPistonClient').mockReturnValue(mockPistonClient as any);
  });

  describe('Piston availability', () => {
    it('should skip when Piston is not available', async () => {
      mockPistonClient.isAvailable.mockResolvedValue(false);

      const response: LLMResponse = { content: '```typescript\nconst x = 1;\n```' };
      const task: Task = { agent: 'MARS', id: '1', title: 'Test' } as Task;

      const result = await typescriptCheckGate(response, task);

      expect(result.passed).toBe(true);
      expect(result.message).toContain('Piston not available');
    });

    it('should skip when TypeScript runtime is not supported', async () => {
      mockPistonClient.getRuntimes.mockResolvedValue([
        { language: 'python', version: '3.11', aliases: ['py'] },
      ]);

      const response: LLMResponse = { content: '```typescript\nconst x = 1;\n```' };
      const task: Task = { agent: 'MARS', id: '1', title: 'Test' } as Task;

      const result = await typescriptCheckGate(response, task);

      expect(result.passed).toBe(true);
      expect(result.message).toContain('TypeScript runtime not installed');
    });
  });

  describe('TypeScript runtime detection', () => {
    it('should detect TypeScript by language name', async () => {
      mockPistonClient.getRuntimes.mockResolvedValue([
        { language: 'typescript', version: '5.0', aliases: [] },
      ]);
      mockPistonClient.executeTypeScript.mockResolvedValue({
        stdout: '', stderr: '', exitCode: 0,
      });

      const response: LLMResponse = { content: '```typescript\nconst x = 1;\n```' };
      const task: Task = { agent: 'MARS', id: '1', title: 'Test' } as Task;

      await typescriptCheckGate(response, task);

      expect(mockPistonClient.executeTypeScript).toHaveBeenCalled();
    });

    it('should detect TypeScript by ts alias', async () => {
      mockPistonClient.getRuntimes.mockResolvedValue([
        { language: 'typescript', version: '5.0', aliases: ['ts'] },
      ]);
      mockPistonClient.executeTypeScript.mockResolvedValue({
        stdout: '', stderr: '', exitCode: 0,
      });

      const response: LLMResponse = { content: '```typescript\nconst x = 1;\n```' };
      const task: Task = { agent: 'MARS', id: '1', title: 'Test' } as Task;

      await typescriptCheckGate(response, task);

      expect(mockPistonClient.executeTypeScript).toHaveBeenCalled();
    });
  });

  describe('code extraction', () => {
    it('should skip when no TypeScript code found', async () => {
      mockPistonClient.executeTypeScript.mockResolvedValue({
        stdout: '', stderr: '', exitCode: 0,
      });

      const response: LLMResponse = { content: 'Some text without code' };
      const task: Task = { agent: 'MARS', id: '1', title: 'Test' } as Task;

      const result = await typescriptCheckGate(response, task);

      expect(result.passed).toBe(true);
      expect(result.message).toContain('No TypeScript code blocks found');
    });

    it('should extract ```typescript blocks', async () => {
      mockPistonClient.executeTypeScript.mockResolvedValue({
        stdout: '', stderr: '', exitCode: 0,
      });

      const response: LLMResponse = { content: '```typescript\nconst x: number = 1;\n```' };
      const task: Task = { agent: 'MARS', id: '1', title: 'Test' } as Task;

      await typescriptCheckGate(response, task);

      expect(mockPistonClient.executeTypeScript).toHaveBeenCalled();
      const code = mockPistonClient.executeTypeScript.mock.calls[0][0];
      expect(code).toContain('const x: number = 1;');
    });

    it('should extract ```ts blocks', async () => {
      mockPistonClient.executeTypeScript.mockResolvedValue({
        stdout: '', stderr: '', exitCode: 0,
      });

      const response: LLMResponse = { content: '```ts\nlet y: string = "test";\n```' };
      const task: Task = { agent: 'MARS', id: '1', title: 'Test' } as Task;

      await typescriptCheckGate(response, task);

      expect(mockPistonClient.executeTypeScript).toHaveBeenCalled();
      const code = mockPistonClient.executeTypeScript.mock.calls[0][0];
      expect(code).toContain('let y: string = "test";');
    });

    it('should extract ```javascript blocks', async () => {
      mockPistonClient.executeTypeScript.mockResolvedValue({
        stdout: '', stderr: '', exitCode: 0,
      });

      const response: LLMResponse = { content: '```javascript\nconst z = 3;\n```' };
      const task: Task = { agent: 'MARS', id: '1', title: 'Test' } as Task;

      await typescriptCheckGate(response, task);

      expect(mockPistonClient.executeTypeScript).toHaveBeenCalled();
    });

    it('should extract multiple blocks', async () => {
      mockPistonClient.executeTypeScript.mockResolvedValue({
        stdout: '', stderr: '', exitCode: 0,
      });

      const response: LLMResponse = {
        content: '```typescript\nconst a = 1;\n```\n\n```typescript\nconst b = 2;\n```',
      };
      const task: Task = { agent: 'MARS', id: '1', title: 'Test' } as Task;

      await typescriptCheckGate(response, task);

      expect(mockPistonClient.executeTypeScript).toHaveBeenCalledTimes(2);
    });
  });

  describe('TypeScript validation', () => {
    it('should pass when all blocks compile', async () => {
      mockPistonClient.executeTypeScript.mockResolvedValue({
        stdout: '', stderr: '', exitCode: 0,
      });

      const response: LLMResponse = { content: '```typescript\nconst x = 1;\n```' };
      const task: Task = { agent: 'MARS', id: '1', title: 'Test' } as Task;

      const result = await typescriptCheckGate(response, task);

      expect(result.passed).toBe(true);
      expect(result.message).toContain('TypeScript validation passed');
    });

    it('should fail when compilation fails', async () => {
      mockPistonClient.executeTypeScript.mockResolvedValue({
        stdout: '',
        stderr: 'error TS2345: Argument of type',
        exitCode: 1,
      });

      const response: LLMResponse = { content: '```typescript\nconst x: string = 1;\n```' };
      const task: Task = { agent: 'MARS', id: '1', title: 'Test' } as Task;

      const result = await typescriptCheckGate(response, task);

      expect(result.passed).toBe(false);
      expect(result.message).toContain('TypeScript validation failed');
    });

    it('should report block number in error', async () => {
      mockPistonClient.executeTypeScript.mockResolvedValue({
        stdout: '',
        stderr: 'error TS1234: Test error',
        exitCode: 2,
      });

      const response: LLMResponse = { content: '```typescript\ninvalid code\n```' };
      const task: Task = { agent: 'MARS', id: '1', title: 'Test' } as Task;

      const result = await typescriptCheckGate(response, task);

      expect(result.message).toContain('Block 1:');
    });
  });

  describe('error parsing', () => {
    it('should parse TypeScript compiler errors', async () => {
      mockPistonClient.executeTypeScript.mockResolvedValue({
        stdout: '',
        stderr: 'main.ts(3,5): error TS2345: Argument of type number is not assignable to parameter of type string',
        exitCode: 1,
      });

      const response: LLMResponse = { content: '```typescript\nfunc(1);\n```' };
      const task: Task = { agent: 'MARS', id: '1', title: 'Test' } as Task;

      const result = await typescriptCheckGate(response, task);

      expect(result.message).toContain('TS2345');
      expect(result.message).toContain('3,5');
    });

    it('should handle non-TS errors', async () => {
      mockPistonClient.executeTypeScript.mockResolvedValue({
        stdout: '',
        stderr: 'Some generic error',
        exitCode: 1,
      });

      const response: LLMResponse = { content: '```typescript\ncode\n```' };
      const task: Task = { agent: 'MARS', id: '1', title: 'Test' } as Task;

      const result = await typescriptCheckGate(response, task);

      expect(result.passed).toBe(false);
      expect(result.message).toContain('Block 1:');
    });

    it('should handle stdout output on failure', async () => {
      mockPistonClient.executeTypeScript.mockResolvedValue({
        stdout: 'Runtime output here',
        stderr: '',
        exitCode: 1,
      });

      const response: LLMResponse = { content: '```typescript\ncode\n```' };
      const task: Task = { agent: 'MARS', id: '1', title: 'Test' } as Task;

      const result = await typescriptCheckGate(response, task);

      expect(result.message).toContain('runtime output');
    });
  });

  describe('result format', () => {
    it('should return correct GateResult on pass', async () => {
      mockPistonClient.executeTypeScript.mockResolvedValue({
        stdout: '', stderr: '', exitCode: 0,
      });

      const response: LLMResponse = { content: '```typescript\nconst x = 1;\n```' };
      const task: Task = { agent: 'MARS', id: '1', title: 'Test' } as Task;

      const result = await typescriptCheckGate(response, task);

      expect(result).toHaveProperty('gate', 'typescript-check');
      expect(result).toHaveProperty('passed', true);
      expect(result).toHaveProperty('message');
    });

    it('should return correct GateResult on fail', async () => {
      mockPistonClient.executeTypeScript.mockResolvedValue({
        stdout: '', stderr: 'error', exitCode: 1,
      });

      const response: LLMResponse = { content: '```typescript\ninvalid\n```' };
      const task: Task = { agent: 'MARS', id: '1', title: 'Test' } as Task;

      const result = await typescriptCheckGate(response, task);

      expect(result).toHaveProperty('gate', 'typescript-check');
      expect(result).toHaveProperty('passed', false);
      expect(result).toHaveProperty('message');
    });

    it('should include block count in success message', async () => {
      mockPistonClient.executeTypeScript.mockResolvedValue({
        stdout: '', stderr: '', exitCode: 0,
      });

      const response: LLMResponse = {
        content: '```typescript\nconst a = 1;\n```\n\n```typescript\nconst b = 2;\n```',
      };
      const task: Task = { agent: 'MARS', id: '1', title: 'Test' } as Task;

      const result = await typescriptCheckGate(response, task);

      expect(result.message).toContain('2 block(s)');
    });
  });
});
