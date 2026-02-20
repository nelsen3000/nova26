// SN-22: Security Hardening E2E Test
// Tests pattern-based security scanning: XSS, path traversal, injection, secret detection

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SecurityScanner, formatSecurityReport, type ScanResult } from '../security-scanner.js';

// ---------------------------------------------------------------------------
// Helpers — scan a single line through the scanner's pattern engine
// ---------------------------------------------------------------------------

// The SecurityScanner reads files from disk. To unit-test the pattern logic
// we create temporary in-memory "files" and leverage scanDirectory on a temp dir.
// Instead, we test the PATTERNS directly by constructing synthetic inputs and
// checking the scanner's output after scanning a temp directory.

import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'nova26-sec-'));
}

function writeFile(dir: string, name: string, content: string): void {
  writeFileSync(join(dir, name), content, 'utf-8');
}

async function scanContent(content: string, filename = 'test.ts'): Promise<ScanResult> {
  const dir = makeTempDir();
  try {
    writeFile(dir, filename, content);
    const scanner = new SecurityScanner();
    // Override npm audit so we only test patterns
    vi.spyOn(scanner as unknown as Record<string, unknown>, 'runNpmAudit')
      .mockResolvedValue(undefined);
    return await scanner.scanDirectory(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('E2E Security Sweep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('XSS detection', () => {
    it('should detect innerHTML assignment with user input', async () => {
      const result = await scanContent(
        'element.innerHTML = req.body.html;'
      );
      const xss = result.findings.filter(f => f.type === 'xss');
      expect(xss.length).toBeGreaterThan(0);
      expect(xss[0].message).toContain('innerHTML');
    });

    it('should detect eval() usage', async () => {
      const result = await scanContent(
        'const result = eval(userInput);'
      );
      const xss = result.findings.filter(f => f.type === 'xss');
      expect(xss.length).toBeGreaterThan(0);
      expect(xss.some(f => f.message.toLowerCase().includes('eval'))).toBe(true);
    });

    it('should detect document.write()', async () => {
      const result = await scanContent(
        'document.write(unsanitized);'
      );
      const xss = result.findings.filter(f => f.type === 'xss');
      expect(xss.length).toBeGreaterThan(0);
    });

    it('should detect dangerouslySetInnerHTML', async () => {
      const result = await scanContent(
        '<div dangerouslySetInnerHTML={{ __html: content }} />'
      );
      const xss = result.findings.filter(f => f.type === 'xss');
      expect(xss.length).toBeGreaterThan(0);
    });

    it('should not flag safe code without XSS patterns', async () => {
      const result = await scanContent(
        'const text = element.textContent;\nconst safe = JSON.parse(data);'
      );
      const xss = result.findings.filter(f => f.type === 'xss');
      expect(xss).toHaveLength(0);
    });
  });

  describe('Path traversal detection', () => {
    it('should detect file read with user-provided path', async () => {
      const result = await scanContent(
        'fs.readFile(req.params.path, cb);'
      );
      const traversal = result.findings.filter(f => f.type === 'path-traversal');
      expect(traversal.length).toBeGreaterThan(0);
    });

    it('should detect directory traversal sequences', async () => {
      const result = await scanContent(
        'const path = "../../../etc/passwd";'
      );
      const traversal = result.findings.filter(f => f.type === 'path-traversal');
      expect(traversal.length).toBeGreaterThan(0);
    });

    it('should detect sendFile with user input', async () => {
      const result = await scanContent(
        'res.sendFile(request.query.file);'
      );
      const traversal = result.findings.filter(f => f.type === 'path-traversal');
      expect(traversal.length).toBeGreaterThan(0);
    });
  });

  describe('SQL injection detection', () => {
    it('should detect string interpolation in queries', async () => {
      const result = await scanContent(
        'db.query(`SELECT * FROM users WHERE id = ${userId}`);'
      );
      const sql = result.findings.filter(f => f.type === 'sql-injection');
      expect(sql.length).toBeGreaterThan(0);
    });

    it('should detect direct SQL concatenation with request data', async () => {
      const result = await scanContent(
        'const q = "SELECT * FROM users WHERE name=" + req.body.name;'
      );
      const sql = result.findings.filter(f => f.type === 'sql-injection');
      expect(sql.length).toBeGreaterThan(0);
    });

    it('should not flag parameterized queries', async () => {
      const result = await scanContent(
        'db.query("SELECT * FROM users WHERE id = ?", [userId]);'
      );
      const sql = result.findings.filter(f => f.type === 'sql-injection');
      expect(sql).toHaveLength(0);
    });
  });

  describe('Secret detection — AWS keys', () => {
    it('should detect AWS access key pattern', async () => {
      const result = await scanContent(
        'const key = "AKIAIOSFODNN7EXAMPLE";'
      );
      const secrets = result.findings.filter(f => f.type === 'secret');
      expect(secrets.length).toBeGreaterThan(0);
      expect(secrets.some(f => f.message.includes('AWS'))).toBe(true);
    });

    it('should detect AWS secret key pattern', async () => {
      // Pattern: exactly 40 chars of [0-9a-zA-Z/+] in quotes, followed by aws|secret|key
      const result = await scanContent(
        'const x = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY" // aws secret key'
      );
      const secrets = result.findings.filter(f => f.type === 'secret');
      expect(secrets.length).toBeGreaterThan(0);
    });
  });

  describe('Secret detection — GitHub tokens', () => {
    it('should detect GitHub personal access token', async () => {
      const result = await scanContent(
        'const token = "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijkl";'
      );
      const secrets = result.findings.filter(f => f.type === 'secret');
      expect(secrets.length).toBeGreaterThan(0);
      expect(secrets.some(f => f.message.includes('GitHub'))).toBe(true);
    });

    it('should detect GitHub OAuth token', async () => {
      const result = await scanContent(
        'const oauthToken = "gho_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijkl";'
      );
      const secrets = result.findings.filter(f => f.type === 'secret');
      expect(secrets.some(f => f.message.includes('GitHub'))).toBe(true);
    });
  });

  describe('Secret detection — OpenAI keys', () => {
    it('should detect OpenAI API key pattern', async () => {
      const result = await scanContent(
        'const apiKey = "sk-abcdefghijklmnopqrstuvwxyz012345678901234567890123";'
      );
      const secrets = result.findings.filter(f => f.type === 'secret');
      expect(secrets.length).toBeGreaterThan(0);
      expect(secrets.some(f => f.message.includes('OpenAI'))).toBe(true);
    });
  });

  describe('Secret detection — other patterns', () => {
    it('should detect private key headers', async () => {
      const result = await scanContent(
        '-----BEGIN RSA PRIVATE KEY-----'
      );
      const secrets = result.findings.filter(f => f.type === 'secret');
      expect(secrets.length).toBeGreaterThan(0);
      expect(secrets.some(f => f.message.includes('Private Key'))).toBe(true);
    });

    it('should detect Stripe live keys', async () => {
      // Build dynamically to avoid GitHub push protection triggering on test data
      const prefix = 'sk_live_';
      const suffix = 'abcdefghijklmnopqrstuvwx';
      const result = await scanContent(
        `const stripe = "${prefix}${suffix}";`
      );
      const secrets = result.findings.filter(f => f.type === 'secret');
      expect(secrets.length).toBeGreaterThan(0);
      expect(secrets.some(f => f.message.includes('Stripe'))).toBe(true);
    });

    it('should detect passwords in code', async () => {
      const result = await scanContent(
        'const password = "SuperSecret123!";'
      );
      const secrets = result.findings.filter(f => f.type === 'secret');
      expect(secrets.length).toBeGreaterThan(0);
      expect(secrets.some(f => f.message.includes('Password'))).toBe(true);
    });

    it('should detect Slack tokens', async () => {
      // Build dynamically to avoid GitHub push protection triggering on test data
      const prefix = 'xoxb-';
      const mid = '123456789012-1234567890123-';
      const suffix = 'abcdefghijklmnopqrstuvwx';
      const result = await scanContent(
        `const slack = "${prefix}${mid}${suffix}";`
      );
      const secrets = result.findings.filter(f => f.type === 'secret');
      expect(secrets.some(f => f.message.includes('Slack'))).toBe(true);
    });

    it('should detect database connection strings', async () => {
      const result = await scanContent(
        'const db = "postgres://admin:password@localhost/mydb";'
      );
      const secrets = result.findings.filter(f => f.type === 'secret');
      expect(secrets.some(f => f.message.includes('Database'))).toBe(true);
    });
  });

  describe('Full task pipeline: input → scan → report', () => {
    it('should scan file with multiple vulnerability types', async () => {
      const code = [
        'const key = "AKIAIOSFODNN7EXAMPLE";',
        'element.innerHTML = req.body.html;',
        'db.query(`SELECT * FROM users WHERE id = ${id}`);',
        'fs.readFile(req.params.path, cb);',
      ].join('\n');

      const result = await scanContent(code);

      const types = new Set(result.findings.map(f => f.type));
      expect(types.has('secret')).toBe(true);
      expect(types.has('xss')).toBe(true);
      expect(types.has('sql-injection')).toBe(true);
      expect(types.has('path-traversal')).toBe(true);
    });

    it('should mark scan as failed when critical findings exist', async () => {
      const result = await scanContent(
        'const key = "AKIAIOSFODNN7EXAMPLE";'
      );
      expect(result.passed).toBe(false);
    });

    it('should mark scan as passed for clean code', async () => {
      const result = await scanContent(
        'const x = 42;\nconst y = "hello";'
      );
      expect(result.passed).toBe(true);
      expect(result.findings).toHaveLength(0);
    });

    it('should count scanned files', async () => {
      const result = await scanContent('const a = 1;');
      expect(result.scannedFiles).toBe(1);
    });

    it('should measure scan duration', async () => {
      const result = await scanContent('const a = 1;');
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Security report formatting', () => {
    it('should include summary in report', async () => {
      const result = await scanContent(
        'const key = "AKIAIOSFODNN7EXAMPLE";'
      );
      const report = formatSecurityReport(result);

      expect(report).toContain('Security Scan Report');
      expect(report).toContain('Files Scanned: 1');
      expect(report).toContain('FAILED');
    });

    it('should show PASSED for clean scan', async () => {
      const result = await scanContent('const clean = true;');
      const report = formatSecurityReport(result);

      expect(report).toContain('PASSED');
      expect(report).toContain('Findings: 0');
    });

    it('should list findings by severity', async () => {
      const code = [
        'const key = "AKIAIOSFODNN7EXAMPLE";',
        'document.write(x);',
      ].join('\n');
      const result = await scanContent(code);
      const report = formatSecurityReport(result);

      expect(report).toContain('CRITICAL');
    });

    it('should include fix suggestions', async () => {
      const result = await scanContent('eval(userInput);');
      const report = formatSecurityReport(result);

      expect(report).toContain('Fix:');
    });
  });

  describe('Insecure randomness detection', () => {
    it('should detect Math.random for security token generation', async () => {
      // Pattern: Math.random() followed by token|password|key|secret|id on same line
      const result = await scanContent(
        'const sessionToken = Math.random().toString(36) + "token";'
      );
      const findings = result.findings.filter(f => f.type === 'insecure-random');
      expect(findings.length).toBeGreaterThan(0);
    });
  });

  describe('Multi-file scanning', () => {
    it('should scan multiple files in a directory', async () => {
      const dir = makeTempDir();
      try {
        writeFile(dir, 'clean.ts', 'const x = 1;');
        writeFile(dir, 'dirty.ts', 'eval(input);');
        writeFile(dir, 'secret.ts', 'const k = "AKIAIOSFODNN7EXAMPLE";');

        const scanner = new SecurityScanner();
        vi.spyOn(scanner as unknown as Record<string, unknown>, 'runNpmAudit')
          .mockResolvedValue(undefined);
        const result = await scanner.scanDirectory(dir);

        expect(result.scannedFiles).toBe(3);
        expect(result.findings.length).toBeGreaterThanOrEqual(2);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it('should scan subdirectories recursively', async () => {
      const dir = makeTempDir();
      const subdir = join(dir, 'nested');
      try {
        mkdirSync(subdir);
        writeFile(dir, 'root.ts', 'const a = 1;');
        writeFile(subdir, 'child.ts', 'eval(input);');

        const scanner = new SecurityScanner();
        vi.spyOn(scanner as unknown as Record<string, unknown>, 'runNpmAudit')
          .mockResolvedValue(undefined);
        const result = await scanner.scanDirectory(dir);

        expect(result.scannedFiles).toBe(2);
        expect(result.findings.length).toBeGreaterThan(0);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });
});
