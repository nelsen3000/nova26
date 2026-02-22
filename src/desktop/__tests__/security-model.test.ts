// Security Model Tests — R20-02
// CSP generation, allowlist validation, fs scope checking

import { describe, it, expect } from 'vitest';
import { SecurityManager, createSecurityManager } from '../security-model.js';
import type { SecurityModel } from '../types.js';

// Mock security models for testing
const createMockSecurityModel = (overrides: Partial<SecurityModel> = {}): SecurityModel => ({
  allowlist: ['read_file', 'write_file', 'git_status'],
  fsScope: ['/home/user/projects', '/tmp'],
  csp: "default-src 'self'; script-src 'self'; connect-src https://api.example.com https://ws.example.com",
  noShell: true,
  ...overrides,
});

describe('SecurityManager', () => {
  describe('CSP generation', () => {
    it('generateCSP returns configured CSP', () => {
      const model = createMockSecurityModel({
        csp: "default-src 'self'; script-src 'self' 'unsafe-inline'",
      });
      const manager = createSecurityManager(model);

      const csp = manager.generateCSP();

      expect(csp).toBe("default-src 'self'; script-src 'self' 'unsafe-inline'");
    });

    it('getAllowedOrigins extracts origins from CSP', () => {
      const model = createMockSecurityModel({
        csp: "default-src 'self'; connect-src https://api.example.com https://ws.example.com",
      });
      const manager = createSecurityManager(model);

      const origins = manager.getAllowedOrigins();

      expect(origins).toContain('https://api.example.com');
      expect(origins).toContain('https://ws.example.com');
      expect(origins).not.toContain("'self'");
    });

    it('getAllowedOrigins handles multiple directives', () => {
      const model = createMockSecurityModel({
        csp: "default-src 'self'; script-src 'self' https://cdn.example.com; style-src 'self' 'unsafe-inline' https://fonts.example.com; connect-src https://api.example.com",
      });
      const manager = createSecurityManager(model);

      const origins = manager.getAllowedOrigins();

      expect(origins).toContain('https://cdn.example.com');
      expect(origins).toContain('https://fonts.example.com');
      expect(origins).toContain('https://api.example.com');
      expect(origins).not.toContain("'self'");
      expect(origins).not.toContain("'unsafe-inline'");
    });

    it('getAllowedOrigins parses connect-src correctly', () => {
      const model = createMockSecurityModel({
        csp: "default-src 'none'; connect-src https://api1.example.com https://api2.example.com wss://realtime.example.com",
      });
      const manager = createSecurityManager(model);

      const origins = manager.getAllowedOrigins();

      expect(origins).toContain('https://api1.example.com');
      expect(origins).toContain('https://api2.example.com');
      expect(origins).toContain('wss://realtime.example.com');
      expect(origins).toHaveLength(3);
    });
  });

  describe('Allowlist validation', () => {
    it('validateCommand allows listed command', () => {
      const model = createMockSecurityModel();
      const manager = createSecurityManager(model);

      const result = manager.validateCommand('read_file');

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('validateCommand rejects unknown command', () => {
      const model = createMockSecurityModel();
      const manager = createSecurityManager(model);

      const result = manager.validateCommand('malicious_command');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Command 'malicious_command' is not in allowlist");
    });

    it('validateCommand warns on dangerous command', () => {
      const model = createMockSecurityModel({ noShell: false });
      const manager = createSecurityManager(model);

      const result = manager.validateCommand('shell_exec');

      expect(result.warnings).toContain('Potentially dangerous command: shell_exec');
    });

    it('validateCommand blocks when noShell true', () => {
      const model = createMockSecurityModel({ noShell: true });
      const manager = createSecurityManager(model);

      const result = manager.validateCommand('eval_script');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Shell execution is disabled: eval_script');
    });
  });

  describe('Fs scope check', () => {
    it('validateFilePath allows in-scope path', () => {
      const model = createMockSecurityModel();
      const manager = createSecurityManager(model);

      const result = manager.validateFilePath('/home/user/projects/myapp/src/main.ts');

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('validateFilePath rejects out-of-scope path', () => {
      const model = createMockSecurityModel();
      const manager = createSecurityManager(model);

      const result = manager.validateFilePath('/etc/passwd');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Path '/etc/passwd' is outside of allowed filesystem scope");
    });

    it('validateFilePath handles globs', () => {
      const model = createMockSecurityModel({
        fsScope: ['/home/user/projects/**', '/tmp'],
      });
      const manager = createSecurityManager(model);

      const result = manager.validateFilePath('/home/user/projects/nested/deep/file.txt');

      expect(result.valid).toBe(true);
    });

    it('validateFilePath warns on traversal', () => {
      const model = createMockSecurityModel();
      const manager = createSecurityManager(model);

      const result = manager.validateFilePath('/home/user/projects/../../../etc/passwd');

      expect(result.warnings).toContain('Path may contain traversal characters: /home/user/projects/../../../etc/passwd');
    });

    it('sanitizePath normalizes paths', () => {
      const model = createMockSecurityModel();
      const manager = createSecurityManager(model);

      const sanitized = manager.sanitizePath('  \\windows\\path\\to\\file  ');

      expect(sanitized).toBe('/windows/path/to/file');
    });
  });

  describe('NoShell enforcement', () => {
    it('isShellAllowed returns false when noShell', () => {
      const model = createMockSecurityModel({ noShell: true });
      const manager = createSecurityManager(model);

      const allowed = manager.isShellAllowed();

      expect(allowed).toBe(false);
    });

    it('blocks shell commands when noShell true', () => {
      const model = createMockSecurityModel({ noShell: true });
      const manager = createSecurityManager(model);

      const execResult = manager.validateCommand('exec_command');
      const systemResult = manager.validateCommand('system_call');

      expect(execResult.valid).toBe(false);
      expect(execResult.errors).toContain('Shell execution is disabled: exec_command');
      expect(systemResult.valid).toBe(false);
      expect(systemResult.errors).toContain('Shell execution is disabled: system_call');
    });

    it('allows when noShell false', () => {
      const model = createMockSecurityModel({ noShell: false });
      const manager = createSecurityManager(model);

      const allowed = manager.isShellAllowed();

      expect(allowed).toBe(true);
    });
  });

  describe('Env var expansion in normalizeScope', () => {
    it('expands $HOME in fsScope', () => {
      const home = process.env['HOME'] ?? '/home/testuser';
      const model = createMockSecurityModel({ fsScope: ['$HOME/projects'] });
      const manager = createSecurityManager(model);

      const result = manager.validateFilePath(`${home}/projects/foo.ts`);

      expect(result.valid).toBe(true);
    });

    it('expands tilde in fsScope', () => {
      const home = process.env['HOME'] ?? '/home/testuser';
      const model = createMockSecurityModel({ fsScope: ['~/projects'] });
      const manager = createSecurityManager(model);

      const result = manager.validateFilePath(`${home}/projects/foo.ts`);

      expect(result.valid).toBe(true);
    });

    it('expands $TMPDIR in fsScope', () => {
      const tmpdir = (process.env['TMPDIR'] ?? '/tmp').replace(/\/$/, '');
      const model = createMockSecurityModel({ fsScope: ['$TMPDIR/nova26'] });
      const manager = createSecurityManager(model);

      const result = manager.validateFilePath(`${tmpdir}/nova26/cache.json`);

      expect(result.valid).toBe(true);
    });

    it('expands $PWD in fsScope', () => {
      const pwd = process.env['PWD'] ?? process.cwd();
      const model = createMockSecurityModel({ fsScope: ['$PWD/src'] });
      const manager = createSecurityManager(model);

      const result = manager.validateFilePath(`${pwd}/src/main.ts`);

      expect(result.valid).toBe(true);
    });
  });

  describe('Additional methods', () => {
    it('validateModel validates complete security model', () => {
      const model = createMockSecurityModel();
      const manager = createSecurityManager(model);

      const result = manager.validateModel();

      expect(result.valid).toBe(true);
    });

    it('validateModel warns on empty allowlist', () => {
      const model = createMockSecurityModel({ allowlist: [] });
      const manager = createSecurityManager(model);

      const result = manager.validateModel();

      expect(result.warnings).toContain('Allowlist is empty - all commands will be rejected');
    });

    it('sanitizePath removes null bytes', () => {
      const model = createMockSecurityModel();
      const manager = createSecurityManager(model);

      const sanitized = manager.sanitizePath('/path/to/file\0malicious');

      expect(sanitized).toBe('/path/to/filemalicious');
      expect(sanitized).not.toContain('\0');
    });

    it('createSecurityManager factory creates SecurityManager instance', () => {
      const model = createMockSecurityModel();
      const manager = createSecurityManager(model);

      expect(manager).toBeInstanceOf(SecurityManager);
      expect(manager.generateCSP()).toBe(model.csp);
    });
  });
});
