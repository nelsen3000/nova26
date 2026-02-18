// MEGA-03: nova26 init Setup Command Tests

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  init,
  detectOllama,
  createDirectoryStructure,
  copyAgentTemplates,
  generateSamplePRD,
  formatWelcomeBanner,
  formatSuccessMessage,
  parseInitArgs,
  type InitOptions,
} from './init.js';

// ============================================================================
// Test Setup
// ============================================================================

describe('nova26 init', () => {
  let tempDir: string;
  let originalCwd: string;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Create a temp directory for test files
    tempDir = mkdtempSync(join(tmpdir(), 'nova26-init-test-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);

    // Clean up NOVA26_ env vars
    for (const key of Object.keys(process.env)) {
      if (key.startsWith('NOVA26_')) {
        delete process.env[key];
      }
    }
  });

  afterEach(() => {
    // Restore original cwd
    process.chdir(originalCwd);

    // Clean up temp directory
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }

    // Restore original env
    process.env = { ...originalEnv };

    // Reset all mocks
    vi.restoreAllMocks();
  });

  // ============================================================================
  // Banner Formatting Tests
  // ============================================================================

  describe('formatWelcomeBanner', () => {
    it('should return a formatted welcome banner', () => {
      const banner = formatWelcomeBanner();
      
      expect(banner).toContain('NOVA26');
      expect(banner).toContain('🚀');
      expect(banner).toContain('AI-Powered Development Environment');
    });

    it('should include box drawing characters', () => {
      const banner = formatWelcomeBanner();
      
      expect(banner).toContain('╔');
      expect(banner).toContain('╗');
      expect(banner).toContain('╚');
      expect(banner).toContain('╝');
    });
  });

  describe('formatSuccessMessage', () => {
    it('should return a formatted success message', () => {
      const message = formatSuccessMessage('/path/to/config.json', '/path/to/sample-prd.json');
      
      expect(message).toContain('Setup Complete');
      expect(message).toContain('✅');
      expect(message).toContain('/path/to/config.json');
      expect(message).toContain('/path/to/sample-prd.json');
    });

    it('should include next steps', () => {
      const message = formatSuccessMessage('/path/to/config.json', '/path/to/sample-prd.json');
      
      expect(message).toContain('Next Steps');
      expect(message).toContain('nova26 generate');
      expect(message).toContain('nova26 run');
    });
  });

  // ============================================================================
  // Argument Parsing Tests
  // ============================================================================

  describe('parseInitArgs', () => {
    it('should parse --yes flag', () => {
      const options = parseInitArgs(['--yes']);
      expect(options.yes).toBe(true);
    });

    it('should parse -y flag', () => {
      const options = parseInitArgs(['-y']);
      expect(options.yes).toBe(true);
    });

    it('should parse --tier option', () => {
      const options = parseInitArgs(['--tier', 'paid']);
      expect(options.tier).toBe('paid');
    });

    it('should parse --ollama-host option', () => {
      const options = parseInitArgs(['--ollama-host', 'http://custom:11434']);
      expect(options.ollamaHost).toBe('http://custom:11434');
    });

    it('should parse multiple options', () => {
      const options = parseInitArgs(['--yes', '--tier', 'hybrid', '--ollama-host', 'http://ollama:11434']);
      expect(options.yes).toBe(true);
      expect(options.tier).toBe('hybrid');
      expect(options.ollamaHost).toBe('http://ollama:11434');
    });

    it('should return empty options for no args', () => {
      const options = parseInitArgs([]);
      expect(options).toEqual({});
    });
  });

  // ============================================================================
  // Directory Structure Tests
  // ============================================================================

  describe('createDirectoryStructure', () => {
    it('should create all required directories', () => {
      createDirectoryStructure();

      expect(existsSync('.nova/agents')).toBe(true);
      expect(existsSync('.nova/output')).toBe(true);
      expect(existsSync('.nova/cache')).toBe(true);
      expect(existsSync('.nova/config')).toBe(true);
      expect(existsSync('.nova/events')).toBe(true);
      expect(existsSync('.nova/data')).toBe(true);
    });

    it('should be idempotent (not fail if directories exist)', () => {
      // Create directories first
      createDirectoryStructure();
      
      // Should not throw when called again
      expect(() => createDirectoryStructure()).not.toThrow();
      
      // Directories should still exist
      expect(existsSync('.nova/agents')).toBe(true);
      expect(existsSync('.nova/output')).toBe(true);
    });
  });

  // ============================================================================
  // Agent Templates Tests
  // ============================================================================

  describe('copyAgentTemplates', () => {
    it('should return zero counts when no source agents exist', () => {
      const result = copyAgentTemplates();
      
      expect(result.copied).toBe(0);
      expect(result.skipped).toBe(0);
    });

    it('should copy agent templates when source exists', () => {
      // Create source agent files in a separate source directory
      const sourceDir = join(tempDir, 'source-agents');
      mkdirSync(sourceDir, { recursive: true });
      writeFileSync(join(sourceDir, 'SUN.md'), '# SUN Agent', 'utf-8');
      writeFileSync(join(sourceDir, 'MARS.md'), '# MARS Agent', 'utf-8');

      const result = copyAgentTemplates(sourceDir);
      
      expect(result.copied).toBe(2);
      expect(result.skipped).toBe(0);
      expect(existsSync(join(tempDir, '.nova', 'agents', 'SUN.md'))).toBe(true);
      expect(existsSync(join(tempDir, '.nova', 'agents', 'MARS.md'))).toBe(true);
    });

    it('should skip existing files (idempotent)', () => {
      // Create source and pre-populate target
      const sourceDir = join(tempDir, '.nova', 'agents');
      const targetDir = join(tempDir, '.nova', 'agents');
      mkdirSync(sourceDir, { recursive: true });
      mkdirSync(targetDir, { recursive: true });
      
      writeFileSync(join(sourceDir, 'SUN.md'), '# SUN Agent', 'utf-8');
      writeFileSync(join(targetDir, 'SUN.md'), '# Existing SUN Agent', 'utf-8');

      const result = copyAgentTemplates();
      
      expect(result.copied).toBe(0);
      expect(result.skipped).toBe(1);
      
      // Original content should be preserved
      const content = readFileSync(join(targetDir, 'SUN.md'), 'utf-8');
      expect(content).toBe('# Existing SUN Agent');
    });
  });

  // ============================================================================
  // Sample PRD Tests
  // ============================================================================

  describe('generateSamplePRD', () => {
    it('should generate a valid PRD structure', () => {
      const prd = generateSamplePRD();
      
      expect(prd.meta).toBeDefined();
      expect(prd.meta.name).toBe('Hello World Example');
      expect(prd.meta.version).toBe('1.0.0');
      expect(prd.meta.createdAt).toBeDefined();
    });

    it('should generate exactly 3 tasks', () => {
      const prd = generateSamplePRD();
      
      expect(prd.tasks).toHaveLength(3);
    });

    it('should have tasks with correct structure', () => {
      const prd = generateSamplePRD();
      const task = prd.tasks[0];
      
      expect(task.id).toBeDefined();
      expect(task.title).toBeDefined();
      expect(task.description).toBeDefined();
      expect(task.agent).toBeDefined();
      expect(task.status).toBeDefined();
      expect(task.dependencies).toBeDefined();
      expect(task.phase).toBeDefined();
      expect(task.attempts).toBe(0);
      expect(task.createdAt).toBeDefined();
    });

    it('should have first task in ready status', () => {
      const prd = generateSamplePRD();
      
      expect(prd.tasks[0].status).toBe('ready');
      expect(prd.tasks[0].phase).toBe(0);
    });

    it('should have dependent tasks in pending status', () => {
      const prd = generateSamplePRD();
      
      expect(prd.tasks[1].status).toBe('pending');
      expect(prd.tasks[1].dependencies).toContain('task-001');
    });
  });

  // ============================================================================
  // Ollama Detection Tests
  // ============================================================================

  describe('detectOllama', () => {
    it('should detect unavailable Ollama when fetch fails', async () => {
      // Mock fetch to fail
      global.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'));

      const result = await detectOllama('http://localhost:11434');
      
      expect(result.available).toBe(false);
      expect(result.models).toEqual([]);
      expect(result.error).toContain('Connection refused');
    });

    it('should detect unavailable Ollama on non-200 status', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      } as Response);

      const result = await detectOllama('http://localhost:11434');
      
      expect(result.available).toBe(false);
      expect(result.error).toContain('404');
    });

    it('should detect available Ollama with models', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          models: [
            { name: 'qwen2.5:7b' },
            { name: 'llama3:8b' },
          ],
        }),
      } as unknown as Response);

      const result = await detectOllama('http://localhost:11434');
      
      expect(result.available).toBe(true);
      expect(result.models).toEqual(['qwen2.5:7b', 'llama3:8b']);
    });

    it('should handle empty models array', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ models: [] }),
      } as unknown as Response);

      const result = await detectOllama('http://localhost:11434');
      
      expect(result.available).toBe(true);
      expect(result.models).toEqual([]);
    });

    it('should use custom host when provided', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ models: [] }),
      } as unknown as Response);
      global.fetch = fetchMock;

      await detectOllama('http://custom-host:11434');
      
      expect(fetchMock).toHaveBeenCalledWith(
        'http://custom-host:11434/api/tags',
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });
  });

  // ============================================================================
  // Init Integration Tests
  // ============================================================================

  describe('init (integration)', () => {
    it('should create all required files in non-interactive mode', async () => {
      // Mock Ollama detection
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ models: [{ name: 'qwen2.5:7b' }] }),
      } as unknown as Response);

      const options: InitOptions = { yes: true, tier: 'free' };
      await init(options);

      // Check directories created
      expect(existsSync('.nova/agents')).toBe(true);
      expect(existsSync('.nova/output')).toBe(true);
      expect(existsSync('.nova/cache')).toBe(true);

      // Check config created
      expect(existsSync('.nova/config.json')).toBe(true);

      // Check sample PRD created
      expect(existsSync('.nova/sample-prd.json')).toBe(true);
    });

    it('should create valid config.json', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ models: [{ name: 'llama3:8b' }] }),
      } as unknown as Response);

      await init({ yes: true, tier: 'hybrid' });

      const configContent = readFileSync('.nova/config.json', 'utf-8');
      const config = JSON.parse(configContent);

      expect(config.models.tier).toBe('hybrid');
      expect(config.models.default).toBe('llama3:8b');
      expect(config.ollama.host).toBe('http://localhost:11434');
    });

    it('should be idempotent when run twice', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ models: [] }),
      } as unknown as Response);

      // First run
      await init({ yes: true, tier: 'free' });

      // Second run
      await init({ yes: true, tier: 'paid' });

      // Config should be merged, not replaced
      expect(existsSync('.nova/config.json')).toBe(true);

      // Sample PRD should still exist
      expect(existsSync('.nova/sample-prd.json')).toBe(true);
    });

    it('should create .novaignore if not exists', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ models: [] }),
      } as unknown as Response);

      await init({ yes: true });

      expect(existsSync('.novaignore')).toBe(true);
      
      const content = readFileSync('.novaignore', 'utf-8');
      expect(content).toContain('node_modules');
      expect(content).toContain('.env');
    });

    it('should preserve existing .novaignore', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ models: [] }),
      } as unknown as Response);

      // Create existing .novaignore
      writeFileSync('.novaignore', '# Custom ignore\n*.custom\n', 'utf-8');

      await init({ yes: true });

      const content = readFileSync('.novaignore', 'utf-8');
      expect(content).toContain('# Custom ignore');
      expect(content).toContain('*.custom');
    });

    it('should handle Ollama detection failure gracefully', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'));

      // Should not throw
      await expect(init({ yes: true })).resolves.not.toThrow();

      // Should still create config
      expect(existsSync('.nova/config.json')).toBe(true);
    });

    it('should create valid sample PRD', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ models: [] }),
      } as unknown as Response);

      await init({ yes: true });

      const prdContent = readFileSync('.nova/sample-prd.json', 'utf-8');
      const prd = JSON.parse(prdContent);

      expect(prd.meta).toBeDefined();
      expect(prd.tasks).toBeInstanceOf(Array);
      expect(prd.tasks).toHaveLength(3);
    });

    it('should respect custom ollama host', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ models: [] }),
      } as unknown as Response);
      global.fetch = fetchMock;

      await init({ yes: true, ollamaHost: 'http://custom:11434' });

      const configContent = readFileSync('.nova/config.json', 'utf-8');
      const config = JSON.parse(configContent);

      expect(config.ollama.host).toBe('http://custom:11434');
    });
  });
});
