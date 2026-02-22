// Secret Scanner Tests - GLM-05
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { scanForSecrets, scanTaskOutput } from '../secret-scanner.js';

// ─── scanForSecrets() ─────────────────────────────────────────────────────────

describe('scanForSecrets()', () => {

  it('returns hasSecrets:false for clean text', () => {
    const r = scanForSecrets('This is a normal task description with no secrets.');
    expect(r.hasSecrets).toBe(false);
    expect(r.matches).toHaveLength(0);
  });

  it('returns safe result for empty string', () => {
    const r = scanForSecrets('');
    expect(r.hasSecrets).toBe(false);
  });

  // AWS

  it('detects an AWS access key', () => {
    const r = scanForSecrets('Using key AKIAIOSFODNN7EXAMPLE for auth.');
    expect(r.hasSecrets).toBe(true);
    expect(r.matches[0].kind).toBe('aws_access_key');
  });

  it('detects AWS secret key in assignment', () => {
    const r = scanForSecrets('AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY');
    expect(r.hasSecrets).toBe(true);
    expect(r.matches.some(m => m.kind === 'aws_secret_key')).toBe(true);
  });

  // GitHub

  it('detects a GitHub ghp_ token', () => {
    // Real GitHub tokens: ghp_ + exactly 36 alphanumeric chars
    const r = scanForSecrets('token: ghp_A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8');
    expect(r.hasSecrets).toBe(true);
    expect(r.matches[0].kind).toBe('github_token');
  });

  it('detects a GitHub gho_ token', () => {
    const r = scanForSecrets('gho_A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8');
    expect(r.hasSecrets).toBe(true);
    expect(r.matches[0].kind).toBe('github_token');
  });

  // OpenAI

  it('detects an OpenAI sk- key', () => {
    const r = scanForSecrets('openai_key = sk-proj-abcdefghijklmnopqrstuvwxyz1234');
    expect(r.hasSecrets).toBe(true);
    expect(r.matches.some(m => m.kind === 'openai_key' || m.kind === 'generic_api_key')).toBe(true);
  });

  // Anthropic

  it('detects an Anthropic sk-ant- key', () => {
    const r = scanForSecrets('Using sk-ant-api03-abcdefghijklmnopqrstuvwxyz1234 for claude calls');
    expect(r.hasSecrets).toBe(true);
    expect(r.matches.some(m => m.kind === 'anthropic_key')).toBe(true);
  });

  // JWT

  it('detects a JWT token', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4ifQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    const r = scanForSecrets(`Authorization: Bearer ${jwt}`);
    expect(r.hasSecrets).toBe(true);
    expect(r.matches.some(m => m.kind === 'jwt_token')).toBe(true);
  });

  // PEM

  it('detects a PEM private key header', () => {
    const r = scanForSecrets('-----BEGIN RSA PRIVATE KEY-----\nMIIEow...');
    expect(r.hasSecrets).toBe(true);
    expect(r.matches[0].kind).toBe('private_key_pem');
  });

  it('detects a generic PRIVATE KEY block', () => {
    const r = scanForSecrets('-----BEGIN PRIVATE KEY-----');
    expect(r.hasSecrets).toBe(true);
    expect(r.matches[0].kind).toBe('private_key_pem');
  });

  // Generic

  it('detects a generic api_key assignment', () => {
    const r = scanForSecrets('api_key=supersecretvalue1234567890abcdef');
    expect(r.hasSecrets).toBe(true);
    expect(r.matches.some(m => m.kind === 'generic_api_key')).toBe(true);
  });

  it('does not false-positive on a short random string', () => {
    const r = scanForSecrets('key=abc123');
    expect(r.hasSecrets).toBe(false);
  });

  // Redaction

  it('redacts the matched value (shows first+last 4 chars)', () => {
    const r = scanForSecrets('AKIAIOSFODNN7EXAMPLE and some more text');
    const match = r.matches.find(m => m.kind === 'aws_access_key');
    expect(match).toBeDefined();
    expect(match!.redacted).toContain('****');
    expect(match!.redacted).not.toBe('AKIAIOSFODNN7EXAMPLE');
  });

  it('reports correct offset for the match', () => {
    const prefix = 'This is before: ';
    const r = scanForSecrets(`${prefix}AKIAIOSFODNN7EXAMPLE`);
    const match = r.matches.find(m => m.kind === 'aws_access_key');
    expect(match?.offset).toBe(prefix.length);
  });

  it('detects multiple secrets in one string', () => {
    const text = [
      'AKIAIOSFODNN7EXAMPLE',
      'sk-ant-api03-abcdefghijklmnopqrstuvwxyz1234',
    ].join(' ');
    const r = scanForSecrets(text);
    expect(r.matches.length).toBeGreaterThanOrEqual(2);
  });
});

// ─── scanTaskOutput() ─────────────────────────────────────────────────────────

describe('scanTaskOutput()', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns secretsFound:false for clean output', () => {
    const r = scanTaskOutput('task-1', 'MARS', 'No secrets here, just regular code.');
    expect(r.secretsFound).toBe(false);
    expect(r.matchCount).toBe(0);
    expect(r.kinds).toHaveLength(0);
  });

  it('returns secretsFound:true when AWS key found', () => {
    const r = scanTaskOutput('task-2', 'VENUS', 'key = AKIAIOSFODNN7EXAMPLE in config');
    expect(r.secretsFound).toBe(true);
    expect(r.matchCount).toBeGreaterThanOrEqual(1);
    expect(r.kinds).toContain('aws_access_key');
  });

  it('logs a warning when secrets are detected', () => {
    scanTaskOutput('task-3', 'EARTH', 'AKIAIOSFODNN7EXAMPLE');
    expect(console.warn).toHaveBeenCalled();
  });

  it('does not log a warning for clean output', () => {
    scanTaskOutput('task-4', 'EARTH', 'perfectly safe output');
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('returns all detected kinds in the result', () => {
    const text = 'AKIAIOSFODNN7EXAMPLE and -----BEGIN RSA PRIVATE KEY-----';
    const r = scanTaskOutput('task-5', 'MARS', text);
    expect(r.kinds).toContain('aws_access_key');
    expect(r.kinds).toContain('private_key_pem');
  });
});
