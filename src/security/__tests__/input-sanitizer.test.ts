// Input Sanitizer Tests - GLM-04
import { describe, it, expect } from 'vitest';
import {
  sanitizeTaskDescription,
  sanitizeFilePath,
  sanitizeConfigValue,
  sanitizeTaskInputs,
} from '../input-sanitizer.js';

// ─── sanitizeTaskDescription() ───────────────────────────────────────────────

describe('sanitizeTaskDescription()', () => {
  it('accepts a normal description', () => {
    const r = sanitizeTaskDescription('Build a login form');
    expect(r.ok).toBe(true);
    expect(r.value).toBe('Build a login form');
  });

  it('trims leading and trailing whitespace', () => {
    const r = sanitizeTaskDescription('  hello world  ');
    expect(r.ok).toBe(true);
    expect(r.value).toBe('hello world');
  });

  it('rejects empty string', () => {
    const r = sanitizeTaskDescription('');
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/empty/i);
  });

  it('rejects whitespace-only string', () => {
    const r = sanitizeTaskDescription('   ');
    expect(r.ok).toBe(false);
  });

  it('rejects string containing null bytes', () => {
    const r = sanitizeTaskDescription('hello\0world');
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/null/i);
  });

  it('rejects string exceeding maxLength', () => {
    const r = sanitizeTaskDescription('a'.repeat(10_001));
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/maximum length/i);
  });

  it('encodes < and > characters', () => {
    const r = sanitizeTaskDescription('<script>alert(1)</script>');
    expect(r.ok).toBe(true);
    expect(r.value).toContain('&lt;');
    expect(r.value).toContain('&gt;');
    expect(r.value).not.toContain('<script>');
  });

  it('encodes & characters', () => {
    const r = sanitizeTaskDescription('cats & dogs');
    expect(r.ok).toBe(true);
    expect(r.value).toContain('&amp;');
  });

  it('encodes double quotes', () => {
    const r = sanitizeTaskDescription('say "hello"');
    expect(r.ok).toBe(true);
    expect(r.value).toContain('&quot;');
  });

  it('respects custom maxLength', () => {
    const r = sanitizeTaskDescription('a'.repeat(51), 50);
    expect(r.ok).toBe(false);
  });
});

// ─── sanitizeFilePath() ───────────────────────────────────────────────────────

describe('sanitizeFilePath()', () => {
  it('accepts a valid relative path', () => {
    const r = sanitizeFilePath('src/components/Button.tsx');
    expect(r.ok).toBe(true);
    expect(r.value).toBe('src/components/Button.tsx');
  });

  it('rejects absolute paths starting with /', () => {
    const r = sanitizeFilePath('/etc/passwd');
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/absolute/i);
  });

  it('rejects paths with ../ traversal', () => {
    const r = sanitizeFilePath('../../etc/passwd');
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/traversal/i);
  });

  it('rejects paths with ..\\  traversal', () => {
    const r = sanitizeFilePath('..\\..\\windows\\system32');
    expect(r.ok).toBe(false);
  });

  it('rejects empty path', () => {
    const r = sanitizeFilePath('');
    expect(r.ok).toBe(false);
  });

  it('rejects path with null bytes', () => {
    const r = sanitizeFilePath('foo\0bar.ts');
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/null/i);
  });

  it('rejects path containing shell metacharacters', () => {
    const r = sanitizeFilePath('src/$(rm -rf /).ts');
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/invalid characters/i);
  });

  it('normalizes backslashes to forward slashes', () => {
    const r = sanitizeFilePath('src\\components\\Button.tsx');
    expect(r.ok).toBe(true);
    expect(r.value).toBe('src/components/Button.tsx');
  });

  it('accepts deeply nested relative path', () => {
    const r = sanitizeFilePath('a/b/c/d/e/f.ts');
    expect(r.ok).toBe(true);
  });
});

// ─── sanitizeConfigValue() ───────────────────────────────────────────────────

describe('sanitizeConfigValue()', () => {
  it('accepts a valid agent name', () => {
    const r = sanitizeConfigValue('MARS');
    expect(r.ok).toBe(true);
    expect(r.value).toBe('MARS');
  });

  it('rejects empty config value', () => {
    const r = sanitizeConfigValue('');
    expect(r.ok).toBe(false);
  });

  it('rejects value containing semicolon', () => {
    const r = sanitizeConfigValue('agent; rm -rf /');
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/invalid characters/i);
  });

  it('rejects value containing backtick', () => {
    const r = sanitizeConfigValue('agent`whoami`');
    expect(r.ok).toBe(false);
  });

  it('rejects value containing pipe', () => {
    const r = sanitizeConfigValue('agent | cat /etc/passwd');
    expect(r.ok).toBe(false);
  });

  it('rejects value containing dollar sign', () => {
    const r = sanitizeConfigValue('agent$HOME');
    expect(r.ok).toBe(false);
  });

  it('rejects value containing null byte', () => {
    const r = sanitizeConfigValue('agent\0name');
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/null/i);
  });

  it('rejects value exceeding maxLength', () => {
    const r = sanitizeConfigValue('a'.repeat(513));
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/maximum length/i);
  });

  it('trims whitespace from config value', () => {
    const r = sanitizeConfigValue('  VENUS  ');
    expect(r.ok).toBe(true);
    expect(r.value).toBe('VENUS');
  });

  it('accepts model ID with hyphens and numbers', () => {
    const r = sanitizeConfigValue('claude-sonnet-4-6');
    expect(r.ok).toBe(true);
    expect(r.value).toBe('claude-sonnet-4-6');
  });
});

// ─── sanitizeTaskInputs() ─────────────────────────────────────────────────────

describe('sanitizeTaskInputs()', () => {
  it('returns ok:true for valid task inputs', () => {
    const r = sanitizeTaskInputs({
      title: 'Build login form',
      description: 'Create a login form with email and password fields',
      agent: 'VENUS',
    });
    expect(r.ok).toBe(true);
    expect(r.errors).toHaveLength(0);
    expect(r.sanitized).toBeDefined();
  });

  it('sanitized output contains HTML-encoded description', () => {
    const r = sanitizeTaskInputs({
      title: 'Test',
      description: 'Handle <script> tags in input',
      agent: 'MARS',
    });
    expect(r.ok).toBe(true);
    expect(r.sanitized?.description).toContain('&lt;script&gt;');
  });

  it('returns ok:false with error list when title is invalid', () => {
    const r = sanitizeTaskInputs({
      title: '',
      description: 'Some description',
      agent: 'EARTH',
    });
    expect(r.ok).toBe(false);
    expect(r.errors.some(e => e.includes('title'))).toBe(true);
  });

  it('returns multiple errors when multiple fields invalid', () => {
    const r = sanitizeTaskInputs({
      title: '',
      description: '',
      agent: '',
    });
    expect(r.ok).toBe(false);
    expect(r.errors.length).toBeGreaterThanOrEqual(2);
  });

  it('validates outputPath when provided', () => {
    const r = sanitizeTaskInputs({
      title: 'Task',
      description: 'Description',
      agent: 'MARS',
      outputPath: '../../etc/passwd',
    });
    expect(r.ok).toBe(false);
    expect(r.errors.some(e => e.includes('outputPath'))).toBe(true);
  });

  it('omits sanitized.outputPath when not provided', () => {
    const r = sanitizeTaskInputs({
      title: 'Task',
      description: 'Description',
      agent: 'MARS',
    });
    expect(r.ok).toBe(true);
    expect(r.sanitized?.outputPath).toBeUndefined();
  });
});
