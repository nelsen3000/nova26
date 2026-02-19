// Vault Security Tests

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  VaultSecurity,
  getVaultSecurity,
  resetVaultSecurity,
  type GraphNode,
  type EncryptedNode,
  type AuditLogEntry,
} from './vault-security.js';

describe('VaultSecurity', () => {
  let security: VaultSecurity;

  beforeEach(() => {
    resetVaultSecurity();
    security = getVaultSecurity();
    security.resetAuditLog();
  });

  afterEach(() => {
    security.resetAuditLog();
    resetVaultSecurity();
  });

  // ============================================================================
  // Encryption/Decryption Tests
  // ============================================================================

  describe('encryptNode', () => {
    it('should encrypt node content using AES-256-GCM', () => {
      const node: GraphNode = {
        id: 'node-1',
        content: 'Sensitive data here',
        helpfulCount: 5,
        createdAt: new Date().toISOString(),
      };

      const encrypted = security.encryptNode(node, 'my-secret-key');

      expect(encrypted.id).toBe('node-1');
      expect(encrypted.algorithm).toBe('aes-256-gcm');
      expect(encrypted.encryptedContent).toBeDefined();
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.authTag).toBeDefined();
      expect(encrypted.keyId).toBeDefined();
      expect(encrypted.encryptedAt).toBeDefined();
    });

    it('should generate different IVs for each encryption', () => {
      const node: GraphNode = {
        id: 'node-1',
        content: 'Same content',
        helpfulCount: 5,
        createdAt: new Date().toISOString(),
      };

      const encrypted1 = security.encryptNode(node, 'key');
      const encrypted2 = security.encryptNode(node, 'key');

      expect(encrypted1.iv).not.toBe(encrypted2.iv);
      expect(encrypted1.encryptedContent).not.toBe(encrypted2.encryptedContent);
    });

    it('should produce Base64-encoded fields', () => {
      const node: GraphNode = {
        id: 'node-1',
        content: 'Test content',
        helpfulCount: 5,
        createdAt: new Date().toISOString(),
      };

      const encrypted = security.encryptNode(node, 'key');

      // Base64 regex pattern
      const base64Pattern = /^[A-Za-z0-9+/]*={0,2}$/;
      expect(encrypted.encryptedContent).toMatch(base64Pattern);
      expect(encrypted.iv).toMatch(base64Pattern);
      expect(encrypted.authTag).toMatch(base64Pattern);
    });
  });

  describe('decryptNode', () => {
    it('should decrypt encrypted content correctly', () => {
      const node: GraphNode = {
        id: 'node-1',
        content: 'My secret message',
        helpfulCount: 5,
        createdAt: new Date().toISOString(),
      };

      const encrypted = security.encryptNode(node, 'my-key');
      const decrypted = security.decryptNode(encrypted, 'my-key');

      expect(decrypted.id).toBe('node-1');
      expect(decrypted.content).toBe('My secret message');
    });

    it('should throw error on wrong key', () => {
      const node: GraphNode = {
        id: 'node-1',
        content: 'Secret',
        helpfulCount: 5,
        createdAt: new Date().toISOString(),
      };

      const encrypted = security.encryptNode(node, 'correct-key');

      expect(() => security.decryptNode(encrypted, 'wrong-key')).toThrow(
        'VaultSecurity: decryption failed'
      );
    });

    it('should throw error on tampered authTag', () => {
      const node: GraphNode = {
        id: 'node-1',
        content: 'Secret',
        helpfulCount: 5,
        createdAt: new Date().toISOString(),
      };

      const encrypted = security.encryptNode(node, 'key');
      encrypted.authTag = Buffer.from('tamperedtag!!!').toString('base64');

      expect(() => security.decryptNode(encrypted, 'key')).toThrow(
        'VaultSecurity: decryption failed'
      );
    });

    it('should throw error on tampered content', () => {
      const node: GraphNode = {
        id: 'node-1',
        content: 'Secret',
        helpfulCount: 5,
        createdAt: new Date().toISOString(),
      };

      const encrypted = security.encryptNode(node, 'key');
      encrypted.encryptedContent = Buffer.from('tampered content').toString('base64');

      expect(() => security.decryptNode(encrypted, 'key')).toThrow(
        'VaultSecurity: decryption failed'
      );
    });

    it('should handle unicode content correctly', () => {
      const node: GraphNode = {
        id: 'node-1',
        content: 'Hello 世界 🌍 ñoño',
        helpfulCount: 5,
        createdAt: new Date().toISOString(),
      };

      const encrypted = security.encryptNode(node, 'key');
      const decrypted = security.decryptNode(encrypted, 'key');

      expect(decrypted.content).toBe('Hello 世界 🌍 ñoño');
    });

    it('should handle empty content', () => {
      const node: GraphNode = {
        id: 'node-1',
        content: '',
        helpfulCount: 5,
        createdAt: new Date().toISOString(),
      };

      const encrypted = security.encryptNode(node, 'key');
      const decrypted = security.decryptNode(encrypted, 'key');

      expect(decrypted.content).toBe('');
    });
  });

  // ============================================================================
  // stripSensitiveData Tests
  // ============================================================================

  describe('stripSensitiveData', () => {
    it('should not mutate original node', () => {
      const original: GraphNode = {
        id: 'node-1',
        content: 'Contains /path/to/file.txt',
        helpfulCount: 5,
        createdAt: new Date().toISOString(),
      };

      const stripped = security.stripSensitiveData(original);

      expect(stripped).not.toBe(original);
      expect(original.content).toBe('Contains /path/to/file.txt');
    });

    it('should redact IP addresses', () => {
      const node: GraphNode = {
        id: 'node-1',
        content: 'Server at 192.168.1.1 and 10.0.0.1',
        helpfulCount: 5,
        createdAt: new Date().toISOString(),
      };

      const stripped = security.stripSensitiveData(node);

      expect(stripped.content).not.toContain('192.168.1.1');
      expect(stripped.content).not.toContain('10.0.0.1');
      expect(stripped.content).toContain('[IP_REDACTED]');
    });

    it('should redact email addresses', () => {
      const node: GraphNode = {
        id: 'node-1',
        content: 'Contact john.doe@example.com or admin+test@site.org',
        helpfulCount: 5,
        createdAt: new Date().toISOString(),
      };

      const stripped = security.stripSensitiveData(node);

      expect(stripped.content).not.toContain('john.doe@example.com');
      expect(stripped.content).not.toContain('admin+test@site.org');
      expect(stripped.content).toContain('[EMAIL_REDACTED]');
    });

    it('should redact JWT tokens', () => {
      const node: GraphNode = {
        id: 'node-1',
        content: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U',
        helpfulCount: 5,
        createdAt: new Date().toISOString(),
      };

      const stripped = security.stripSensitiveData(node);

      expect(stripped.content).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
      expect(stripped.content).toContain('[JWT_REDACTED]');
    });

    it('should redact hex strings 32+ chars', () => {
      const node: GraphNode = {
        id: 'node-1',
        content: 'Hash: a3f5c8d2e9b1047f6a8e5d3c2b1a9f8e7d6c5b4a3928170654433221100',
        helpfulCount: 5,
        createdAt: new Date().toISOString(),
      };

      const stripped = security.stripSensitiveData(node);

      expect(stripped.content).not.toContain('a3f5c8d2e9b1047f6a8e5d3c2b1a9f8e');
      expect(stripped.content).toContain('[HASH_REDACTED]');
    });

    it('should redact private keys', () => {
      const node: GraphNode = {
        id: 'node-1',
        content: `Key: -----BEGIN RSA PRIVATE KEY-----
MIIEpQIBAAKCAQEA0Z3VS5JJcds3xfn/ygWyF8PbnGy0AHB7MhgwMbRvI0MBZhpJ
-----END RSA PRIVATE KEY-----`,
        helpfulCount: 5,
        createdAt: new Date().toISOString(),
      };

      const stripped = security.stripSensitiveData(node);

      expect(stripped.content).not.toContain('BEGIN RSA PRIVATE KEY');
      expect(stripped.content).toContain('[KEY_REDACTED]');
    });

    it('should still redact paths (from GlobalWisdomPipeline)', () => {
      const node: GraphNode = {
        id: 'node-1',
        content: 'Check /home/user/config.json',
        helpfulCount: 5,
        createdAt: new Date().toISOString(),
      };

      const stripped = security.stripSensitiveData(node);

      expect(stripped.content).not.toContain('/home/user/config.json');
      expect(stripped.content).toContain('[PATH_REDACTED]');
    });

    it('should still redact secrets (from GlobalWisdomPipeline)', () => {
      const node: GraphNode = {
        id: 'node-1',
        content: 'api_key=secret12345',
        helpfulCount: 5,
        createdAt: new Date().toISOString(),
      };

      const stripped = security.stripSensitiveData(node);

      expect(stripped.content).not.toContain('secret12345');
      expect(stripped.content).toContain('[REDACTED]');
    });
  });

  // ============================================================================
  // Ownership Tests
  // ============================================================================

  describe('ensureOwnership', () => {
    it('should not throw when user owns the node', () => {
      expect(() => security.ensureOwnership('user-1', 'user-1')).not.toThrow();
    });

    it('should throw when user does not own the node', () => {
      expect(() => security.ensureOwnership('user-1', 'user-2')).toThrow(
        'VaultSecurity: user user-1 does not own this node'
      );
    });
  });

  // ============================================================================
  // Audit Log Tests
  // ============================================================================

  describe('logAction', () => {
    it('should append entry to audit log', () => {
      security.logAction('user-1', 'encrypt_node', 'Encrypted node-1', 'node-1', true);

      const logs = security.readAuditLog();
      expect(logs).toHaveLength(1);
      expect(logs[0].userId).toBe('user-1');
      expect(logs[0].action).toBe('encrypt_node');
      expect(logs[0].details).toBe('Encrypted node-1');
      expect(logs[0].nodeId).toBe('node-1');
      expect(logs[0].success).toBe(true);
    });

    it('should generate unique IDs for each entry', () => {
      security.logAction('user-1', 'encrypt_node', 'First');
      security.logAction('user-1', 'decrypt_node', 'Second');

      const logs = security.readAuditLog();
      expect(logs[0].id).not.toBe(logs[1].id);
    });

    it('should set timestamp for each entry', () => {
      const before = Date.now();
      security.logAction('user-1', 'encrypt_node', 'Test');
      const after = Date.now();

      const logs = security.readAuditLog();
      const logTime = new Date(logs[0].timestamp).getTime();
      expect(logTime).toBeGreaterThanOrEqual(before);
      expect(logTime).toBeLessThanOrEqual(after);
    });
  });

  describe('readAuditLog', () => {
    it('should return empty array when no log exists', () => {
      security.resetAuditLog();
      const logs = security.readAuditLog();
      expect(logs).toEqual([]);
    });

    it('should filter by userId when provided', () => {
      security.logAction('user-1', 'encrypt_node', 'Action 1');
      security.logAction('user-2', 'decrypt_node', 'Action 2');
      security.logAction('user-1', 'delete_data', 'Action 3');

      const user1Logs = security.readAuditLog('user-1');
      expect(user1Logs).toHaveLength(2);
      expect(user1Logs.every(log => log.userId === 'user-1')).toBe(true);
    });

    it('should return all entries when no userId filter', () => {
      security.logAction('user-1', 'encrypt_node', 'Action 1');
      security.logAction('user-2', 'decrypt_node', 'Action 2');

      const logs = security.readAuditLog();
      expect(logs).toHaveLength(2);
    });

    it('should sort by timestamp descending', () => {
      security.logAction('user-1', 'encrypt_node', 'Older');
      // Small delay to ensure different timestamps
      const start = Date.now();
      while (Date.now() - start < 10) { /* busy wait */ }
      security.logAction('user-1', 'decrypt_node', 'Newer');

      const logs = security.readAuditLog();
      expect(logs[0].details).toBe('Newer');
      expect(logs[1].details).toBe('Older');
    });

    it('should respect limit parameter', () => {
      for (let i = 0; i < 150; i++) {
        security.logAction('user-1', 'encrypt_node', `Action ${i}`);
      }

      const logs = security.readAuditLog(undefined, 50);
      expect(logs).toHaveLength(50);
    });

    it('should use default limit of 100', () => {
      for (let i = 0; i < 150; i++) {
        security.logAction('user-1', 'encrypt_node', `Action ${i}`);
      }

      const logs = security.readAuditLog();
      expect(logs).toHaveLength(100);
    });

    it('should skip invalid JSON lines', () => {
      // Manually append invalid line
      const fs = require('fs');
      const path = require('path');
      const auditFile = path.join(process.cwd(), '.nova', 'security', 'audit.jsonl');
      fs.appendFileSync(auditFile, 'invalid json here\n');

      security.logAction('user-1', 'encrypt_node', 'Valid');

      const logs = security.readAuditLog();
      expect(logs).toHaveLength(1);
      expect(logs[0].details).toBe('Valid');
    });
  });

  // ============================================================================
  // Singleton Tests
  // ============================================================================

  describe('getVaultSecurity', () => {
    it('should return same instance on multiple calls', () => {
      const instance1 = getVaultSecurity();
      const instance2 = getVaultSecurity();
      expect(instance1).toBe(instance2);
    });
  });

  describe('resetVaultSecurity', () => {
    it('should create new instance after reset', () => {
      const instance1 = getVaultSecurity();
      resetVaultSecurity();
      const instance2 = getVaultSecurity();
      expect(instance1).not.toBe(instance2);
    });
  });
});
