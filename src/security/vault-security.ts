// KIMI-INFRA-03: Security and Privacy Layer for NOVA26
// Security layer between Taste Vault and Global Wisdom Pipeline

import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from 'fs';
import { join } from 'path';
import { z } from 'zod';

// ============================================================================
// Types
// ============================================================================

export type AuditAction =
  | 'promote_global'
  | 'demote_global'
  | 'delete_data'
  | 'flag_harmful'
  | 'export_vault'
  | 'encrypt_node'
  | 'decrypt_node';

export interface AuditLogEntry {
  id: string;
  userId: string;
  action: AuditAction;
  nodeId?: string;
  details: string;
  timestamp: string;
  success: boolean;
}

export interface EncryptedNode {
  id: string;
  encryptedContent: string;
  iv: string;
  authTag: string;
  algorithm: 'aes-256-gcm';
  keyId: string;
  encryptedAt: string;
}

export interface GraphNode {
  id: string;
  content: string;
  helpfulCount: number;
  createdAt: string;
  tags?: string[];
  language?: string;
}

// ============================================================================
// Zod Schema
// ============================================================================

const AuditLogEntrySchema = z.object({
  id: z.string(),
  userId: z.string(),
  action: z.enum([
    'promote_global',
    'demote_global',
    'delete_data',
    'flag_harmful',
    'export_vault',
    'encrypt_node',
    'decrypt_node',
  ]),
  nodeId: z.string().optional(),
  details: z.string(),
  timestamp: z.string(),
  success: z.boolean(),
});

type ValidatedAuditLogEntry = z.infer<typeof AuditLogEntrySchema>;

// ============================================================================
// Constants
// ============================================================================

const NOVA_DIR = join(process.cwd(), '.nova');
const TASTE_VAULT_DIR = join(NOVA_DIR, 'taste-vault');
const ACE_PROFILES_DIR = join(NOVA_DIR, 'ace', 'profiles');
const SIMILARITY_DIR = join(NOVA_DIR, 'similarity');
const SECURITY_DIR = join(NOVA_DIR, 'security');
const AUDIT_LOG_FILE = join(SECURITY_DIR, 'audit.jsonl');

// ============================================================================
// VaultSecurity Class
// ============================================================================

/**
 * VaultSecurity - Security and privacy layer between Taste Vault and Global Wisdom Pipeline
 */
export class VaultSecurity {
  private readonly algorithm = 'aes-256-gcm';
  private readonly ivLength = 12;

  constructor() {
    this.ensureDirectories();
  }

  private ensureDirectories(): void {
    if (!existsSync(SECURITY_DIR)) {
      mkdirSync(SECURITY_DIR, { recursive: true });
    }
  }

  /**
   * Derive a 32-byte key from a key string using SHA-256
   */
  private deriveKey(key: string): Buffer {
    return createHash('sha256').update(key).digest();
  }

  /**
   * Encrypt a node using AES-256-GCM
   * @param node - The node to encrypt
   * @param key - The encryption key string
   * @returns EncryptedNode with Base64-encoded fields
   */
  encryptNode(node: GraphNode, key: string): EncryptedNode {
    const derivedKey = this.deriveKey(key);
    const iv = randomBytes(this.ivLength);

    const cipher = createCipheriv(this.algorithm, derivedKey, iv);
    const encrypted = Buffer.concat([
      cipher.update(node.content, 'utf-8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return {
      id: node.id,
      encryptedContent: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      algorithm: this.algorithm,
      keyId: createHash('sha256').update(key).digest('hex').slice(0, 16),
      encryptedAt: new Date().toISOString(),
    };
  }

  /**
   * Decrypt an encrypted node
   * @param encrypted - The encrypted node
   * @param key - The decryption key string
   * @returns Object with id and decrypted content
   * @throws Error if decryption fails
   */
  decryptNode(encrypted: EncryptedNode, key: string): { id: string; content: string } {
    try {
      const derivedKey = this.deriveKey(key);
      const iv = Buffer.from(encrypted.iv, 'base64');
      const authTag = Buffer.from(encrypted.authTag, 'base64');
      const encryptedContent = Buffer.from(encrypted.encryptedContent, 'base64');

      const decipher = createDecipheriv(this.algorithm, derivedKey, iv);
      decipher.setAuthTag(authTag);

      const decrypted = Buffer.concat([
        decipher.update(encryptedContent),
        decipher.final(),
      ]);

      return {
        id: encrypted.id,
        content: decrypted.toString('utf-8'),
      };
    } catch (error) {
      throw new Error('VaultSecurity: decryption failed');
    }
  }

  /**
   * Strip sensitive data from a node
   * Enhanced version of GlobalWisdomPipeline.stripSensitiveData()
   * Returns a NEW node object, never mutates input
   */
  stripSensitiveData(node: GraphNode): GraphNode {
    let content = node.content;

    // IMPORTANT: Apply more specific patterns BEFORE generic patterns
    // to prevent over-matching

    // NEW: Private key markers (apply FIRST, before generic "key" patterns)
    content = content.replace(
      /-----BEGIN [A-Z ]+-----[\s\S]+?-----END [A-Z ]+-----/g,
      '[KEY_REDACTED]'
    );

    // NEW: JWT tokens (apply BEFORE generic 32+ char token regex)
    content = content.replace(
      /eyJ[a-zA-Z0-9\-_]+\.[a-zA-Z0-9\-_]+\.[a-zA-Z0-9\-_]+/g,
      '[JWT_REDACTED]'
    );

    // NEW: IP addresses
    content = content.replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[IP_REDACTED]');

    // NEW: Email addresses
    content = content.replace(
      /\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b/g,
      '[EMAIL_REDACTED]'
    );

    // NEW: Hex strings 32+ chars (hashes, keys) - apply BEFORE generic 32+ char
    content = content.replace(/\b[0-9a-fA-F]{32,}\b/g, '[HASH_REDACTED]');

    // Existing regexes from GlobalWisdomPipeline:
    // Remove absolute file paths (Unix-style)
    content = content.replace(/\/([a-zA-Z0-9_\-]+\/)+[a-zA-Z0-9_\-\.]+/g, '[PATH_REDACTED]');

    // Remove relative file paths (./path and ../path)
    content = content.replace(/\.\.?\/([a-zA-Z0-9_\-\.]+\/)*[a-zA-Z0-9_\-\.]+/g, '[PATH_REDACTED]');

    // Remove Windows file paths
    content = content.replace(/[A-Za-z]:\\[a-zA-Z0-9_\\\.\-\s]+/g, '[PATH_REDACTED]');

    // Remove secrets (key, secret, token, password patterns) - but NOT if already redacted
    content = content.replace(
      /(key|secret|token|password|api[_-]?key|auth[_-]?token)\s*[:=]\s*["']?[a-zA-Z0-9_\-\.]+["']?/gi,
      '$1: [REDACTED]'
    );

    // Remove user-specific variables (username, email, userId patterns)
    content = content.replace(
      /(username|user[_-]?id|email|user[_-]?name)\s*[:=]\s*["']?[^"'\s,;]+["']?/gi,
      '$1: [REDACTED]'
    );

    // Remove potential API keys and tokens (long alphanumeric strings, but not already redacted)
    // Use negative lookahead to avoid matching inside already-redacted markers
    content = content.replace(/\b[a-zA-Z0-9]{32,}\b/g, '[TOKEN_REDACTED]');

    return {
      ...node,
      content,
    };
  }

  /**
   * Ensure user owns the node
   * @throws Error if ownership check fails
   */
  ensureOwnership(userId: string, nodeOwnerId: string): void {
    if (userId !== nodeOwnerId) {
      throw new Error(`VaultSecurity: user ${userId} does not own this node`);
    }
  }

  /**
   * Delete all user data (GDPR-style right to erasure)
   * @param userId - The user whose data should be deleted
   * @returns Counts of deleted items
   */
  async deleteAllUserData(userId: string): Promise<{
    nodesDeleted: number;
    auditEntriesDeleted: number;
  }> {
    let nodesDeleted = 0;
    let auditEntriesDeleted = 0;

    // Delete .nova/taste-vault/{userId}.json if exists
    const vaultFile = join(TASTE_VAULT_DIR, `${userId}.json`);
    if (existsSync(vaultFile)) {
      const vaultData = readFileSync(vaultFile, 'utf-8');
      const vault = JSON.parse(vaultData);
      nodesDeleted = vault.nodes?.length || 0;
      // Use write empty to effectively delete without fs.unlink
      writeFileSync(vaultFile, JSON.stringify({ nodes: [], edges: [], deleted: true, deletedAt: new Date().toISOString() }, null, 2));
    }

    // Delete .nova/ace/profiles/{userId}.json if exists
    const profileFile = join(ACE_PROFILES_DIR, `${userId}.json`);
    if (existsSync(profileFile)) {
      writeFileSync(profileFile, JSON.stringify({ deleted: true, deletedAt: new Date().toISOString() }, null, 2));
    }

    // Remove entries from .nova/similarity/embeddings.json (best-effort)
    const embeddingsFile = join(SIMILARITY_DIR, 'embeddings.json');
    if (existsSync(embeddingsFile)) {
      try {
        const embeddingsData = readFileSync(embeddingsFile, 'utf-8');
        const embeddings = JSON.parse(embeddingsData);
        const originalCount = embeddings.length || 0;
        const filtered = (embeddings || []).filter((e: { userId?: string }) => e.userId !== userId);
        const removedCount = originalCount - filtered.length;
        nodesDeleted += removedCount;
        writeFileSync(embeddingsFile, JSON.stringify(filtered, null, 2));
      } catch {
        // Best-effort: ignore errors
      }
    }

    // Delete audit log entries for this user and log the deletion action
    const auditResult = this.deleteUserAuditEntries(userId);
    auditEntriesDeleted = auditResult.deletedCount;

    // Log the deletion action
    this.logAction(userId, 'delete_data', `Deleted all user data: ${nodesDeleted} nodes, ${auditEntriesDeleted} audit entries`, undefined, true);

    return {
      nodesDeleted,
      auditEntriesDeleted,
    };
  }

  /**
   * Delete audit log entries for a specific user
   */
  private deleteUserAuditEntries(userId: string): { deletedCount: number } {
    if (!existsSync(AUDIT_LOG_FILE)) {
      return { deletedCount: 0 };
    }

    try {
      const content = readFileSync(AUDIT_LOG_FILE, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());
      let deletedCount = 0;
      const keptLines: string[] = [];

      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          if (entry.userId === userId) {
            deletedCount++;
          } else {
            keptLines.push(line);
          }
        } catch {
          // Invalid line, keep it (conservative approach)
          keptLines.push(line);
        }
      }

      writeFileSync(AUDIT_LOG_FILE, keptLines.join('\n') + (keptLines.length > 0 ? '\n' : ''));
      return { deletedCount };
    } catch {
      return { deletedCount: 0 };
    }
  }

  /**
   * Log an action to the audit log
   */
  logAction(
    userId: string,
    action: AuditAction,
    details: string,
    nodeId?: string,
    success = true
  ): void {
    this.ensureDirectories();

    const entry: AuditLogEntry = {
      id: this.generateId(),
      userId,
      action,
      nodeId,
      details,
      timestamp: new Date().toISOString(),
      success,
    };

    const line = JSON.stringify(entry) + '\n';
    appendFileSync(AUDIT_LOG_FILE, line);
  }

  /**
   * Read the audit log
   * @param userId - Optional user ID to filter by
   * @param limit - Maximum number of entries to return (default 100)
   * @returns Array of audit log entries
   */
  readAuditLog(userId?: string, limit = 100): ValidatedAuditLogEntry[] {
    if (!existsSync(AUDIT_LOG_FILE)) {
      return [];
    }

    try {
      const content = readFileSync(AUDIT_LOG_FILE, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());
      const entries: AuditLogEntry[] = [];

      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          const result = AuditLogEntrySchema.safeParse(parsed);
          if (result.success) {
            // Filter by userId if provided
            if (!userId || result.data.userId === userId) {
              entries.push(result.data as AuditLogEntry);
            }
          }
        } catch {
          // Skip invalid entries
        }
      }

      // Sort by timestamp desc and limit
      entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      return entries.slice(0, limit);
    } catch {
      return [];
    }
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  /**
   * Reset audit log (for testing)
   */
  resetAuditLog(): void {
    if (existsSync(AUDIT_LOG_FILE)) {
      writeFileSync(AUDIT_LOG_FILE, '');
    }
  }
}

// ============================================================================
// Singleton Factory
// ============================================================================

let vaultSecurityInstance: VaultSecurity | null = null;

/**
 * Get the singleton VaultSecurity instance
 */
export function getVaultSecurity(): VaultSecurity {
  if (!vaultSecurityInstance) {
    vaultSecurityInstance = new VaultSecurity();
  }
  return vaultSecurityInstance;
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetVaultSecurity(): void {
  vaultSecurityInstance = null;
}
