// KMS-26: Piston Client Tests

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PistonClient, getPistonClient } from '../piston-client.js';

describe('PistonClient', () => {
  let client: PistonClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new PistonClient('http://localhost:2000');
  });

  describe('constructor', () => {
    it('should create with default URL', () => {
      const defaultClient = new PistonClient();
      expect(defaultClient).toBeDefined();
    });

    it('should create with custom URL', () => {
      const customClient = new PistonClient('http://custom:3000');
      expect(customClient).toBeDefined();
    });
  });

  describe('isAvailable', () => {
    it('should return true when Piston is available', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
      });

      const result = await client.isAvailable();
      expect(result).toBe(true);
    });

    it('should return false when Piston returns error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
      });

      const result = await client.isAvailable();
      expect(result).toBe(false);
    });

    it('should return false on network error', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await client.isAvailable();
      expect(result).toBe(false);
    });

    it('should return false when fetch hangs', async () => {
      // Mock fetch to never resolve - the AbortController should timeout after 5s
      // We use a shorter timeout in the test by mocking AbortController
      const originalAbortController = global.AbortController;
      
      // Mock AbortController to abort immediately
      global.AbortController = vi.fn().mockImplementation(() => ({
        signal: { addEventListener: vi.fn() },
        abort: vi.fn(),
      })) as any;
      
      // Restore original setTimeout temporarily to let the function timeout quickly
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = vi.fn((cb: () => void) => originalSetTimeout(cb, 0)) as any;

      global.fetch = vi.fn().mockRejectedValue({ name: 'AbortError' });

      const result = await client.isAvailable();
      expect(result).toBe(false);
      
      // Restore
      global.AbortController = originalAbortController;
      global.setTimeout = originalSetTimeout;
    });
  });

  describe('getRuntimes', () => {
    it('should return runtimes on success', async () => {
      const mockRuntimes = [
        { language: 'typescript', version: '5.0.0', aliases: ['ts'] },
        { language: 'python', version: '3.11', aliases: ['py'] },
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockRuntimes),
      });

      const result = await client.getRuntimes();
      expect(result).toEqual(mockRuntimes);
    });

    it('should return empty array on error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
      });

      const result = await client.getRuntimes();
      expect(result).toEqual([]);
    });

    it('should return empty array on network error', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await client.getRuntimes();
      expect(result).toEqual([]);
    });
  });

  describe('execute', () => {
    it('should execute code successfully', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          run: { stdout: 'Hello World', stderr: '', code: 0 },
        }),
      });

      const result = await client.execute('typescript', 'console.log("Hello World")');
      expect(result.stdout).toBe('Hello World');
      expect(result.exitCode).toBe(0);
    });

    it('should handle compilation output', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          compile: { stdout: '', stderr: '', code: 0 },
          run: { stdout: 'output', stderr: '', code: 0 },
        }),
      });

      const result = await client.execute('typescript', 'const x = 1;');
      expect(result.exitCode).toBe(0);
    });

    it('should handle API error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const result = await client.execute('typescript', 'code');
      expect(result.exitCode).toBe(-1);
      expect(result.stderr).toContain('Piston API error');
    });

    it('should handle timeout', async () => {
      global.fetch = vi.fn().mockRejectedValue({ name: 'AbortError' });

      const result = await client.execute('typescript', 'code', 100);
      expect(result.exitCode).toBe(-1);
      expect(result.stderr).toBe('Execution timed out');
    });

    it('should handle network error', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'));

      const result = await client.execute('typescript', 'code');
      expect(result.exitCode).toBe(-1);
      expect(result.stderr).toContain('Piston unavailable');
    });

    it('should include correct file extension for TypeScript', async () => {
      let requestBody: string = '';
      global.fetch = vi.fn().mockImplementation((_, options) => {
        requestBody = options.body;
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ run: { stdout: '', stderr: '', code: 0 } }),
        });
      });

      await client.execute('typescript', 'const x = 1;');
      expect(requestBody).toContain('main.ts');
    });

    it('should include correct file extension for Python', async () => {
      let requestBody: string = '';
      global.fetch = vi.fn().mockImplementation((_, options) => {
        requestBody = options.body;
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ run: { stdout: '', stderr: '', code: 0 } }),
        });
      });

      await client.execute('python', 'print("hello")');
      expect(requestBody).toContain('main.py');
    });

    it('should use txt extension for unknown languages', async () => {
      let requestBody: string = '';
      global.fetch = vi.fn().mockImplementation((_, options) => {
        requestBody = options.body;
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ run: { stdout: '', stderr: '', code: 0 } }),
        });
      });

      await client.execute('unknown-lang', 'code');
      expect(requestBody).toContain('main.txt');
    });
  });

  describe('executeTypeScript', () => {
    it('should execute TypeScript code', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          run: { stdout: 'TS output', stderr: '', code: 0 },
        }),
      });

      const result = await client.executeTypeScript('const x: number = 1;');
      expect(result.stdout).toBe('TS output');
    });
  });

  describe('executeJavaScript', () => {
    it('should execute JavaScript code', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          run: { stdout: 'JS output', stderr: '', code: 0 },
        }),
      });

      const result = await client.executeJavaScript('console.log("hello");');
      expect(result.stdout).toBe('JS output');
    });
  });

  describe('executePython', () => {
    it('should execute Python code', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          run: { stdout: 'Python output', stderr: '', code: 0 },
        }),
      });

      const result = await client.executePython('print("hello")');
      expect(result.stdout).toBe('Python output');
    });
  });

  describe('singleton', () => {
    it('should return same instance', () => {
      const c1 = getPistonClient();
      const c2 = getPistonClient();
      expect(c1).toBe(c2);
    });
  });
});
