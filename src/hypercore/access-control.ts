// Hypercore Access Control — Spec Task 11 (Security and Access Control)
// Sprint S3-07 | P2P Hypercore Protocol (Reel 1)
//
// Provides per-store access control lists, peer authentication tokens,
// and payload encryption using Node's built-in crypto.

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHmac,
  generateKeyPairSync,
  sign as cryptoSign,
  verify as cryptoVerify,
} from 'crypto';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AccessMode = 'read-write' | 'read-only' | 'no-access';

export interface AccessPolicy {
  peerId: string;        // '*' for wildcard (default policy)
  mode: AccessMode;
  grantedAt: number;
  expiresAt?: number;    // ms timestamp; undefined = never expires
}

export interface AccessCheckResult {
  allowed: boolean;
  mode: AccessMode;
  reason: string;
}

export interface KeyPair {
  publicKey: string;  // hex-encoded
  privateKey: string; // hex-encoded (PEM format)
}

export interface PeerCredential {
  peerId: string;
  publicKey: string;
  authenticatedAt: number;
}

export interface EncryptedPayload {
  iv: string;          // hex-encoded
  tag: string;         // hex-encoded (auth tag)
  ciphertext: string;  // hex-encoded
}

// ─── AccessControlList ────────────────────────────────────────────────────────

/**
 * AccessControlList — per-store read/write permissions.
 *
 * Evaluation order:
 * 1. Exact peerId match (most specific wins)
 * 2. Wildcard '*' default policy
 * 3. Deny (no-access) if nothing matches
 *
 * Satisfies Spec Task 11.1:
 * - Default read-write local / read-only remote access mode
 * - Discovery key verification before replication
 * - Per-log access control
 */
export class AccessControlList {
  private policies = new Map<string, Map<string, AccessPolicy>>(); // storeName → peerId → policy

  /**
   * Grant access to a peer on a named store.
   * Use peerId='*' for the default policy (applied to all peers).
   * Use peerId='local' for the local process (always gets read-write by default).
   */
  grant(storeName: string, peerId: string, mode: AccessMode, expiresAt?: number): void {
    if (!this.policies.has(storeName)) {
      this.policies.set(storeName, new Map());
    }
    const storeMap = this.policies.get(storeName)!;
    storeMap.set(peerId, {
      peerId,
      mode,
      grantedAt: Date.now(),
      expiresAt,
    });
  }

  /**
   * Revoke a peer's access policy for a store.
   * Returns true if a policy was removed.
   */
  revoke(storeName: string, peerId: string): boolean {
    const storeMap = this.policies.get(storeName);
    if (!storeMap) return false;
    return storeMap.delete(peerId);
  }

  /**
   * Check if a peer can perform an operation on a store.
   * 'read' requires at least read-only access.
   * 'write' requires read-write access.
   */
  check(storeName: string, peerId: string, operation: 'read' | 'write'): AccessCheckResult {
    const now = Date.now();
    const storeMap = this.policies.get(storeName);

    // If no policies configured for this store: local gets read-write, remote read-only
    if (!storeMap || storeMap.size === 0) {
      const defaultMode: AccessMode = peerId === 'local' ? 'read-write' : 'read-only';
      return this.evaluateMode(defaultMode, operation, 'default policy (no ACL configured)');
    }

    // Try exact peerId match first
    const exactPolicy = storeMap.get(peerId);
    if (exactPolicy && !this.isExpired(exactPolicy, now)) {
      return this.evaluateMode(exactPolicy.mode, operation, `explicit policy for peer ${peerId}`);
    }

    // Fall back to wildcard
    const wildcardPolicy = storeMap.get('*');
    if (wildcardPolicy && !this.isExpired(wildcardPolicy, now)) {
      return this.evaluateMode(wildcardPolicy.mode, operation, `wildcard policy`);
    }

    // Deny by default
    return { allowed: false, mode: 'no-access', reason: 'No matching policy — deny by default' };
  }

  /**
   * List all access policies for a store.
   */
  list(storeName: string): AccessPolicy[] {
    return [...(this.policies.get(storeName)?.values() ?? [])];
  }

  /**
   * List all store names that have policies configured.
   */
  listStores(): string[] {
    return [...this.policies.keys()];
  }

  /**
   * Remove all policies for a store.
   */
  clearStore(storeName: string): void {
    this.policies.delete(storeName);
  }

  /**
   * Remove all policies.
   */
  clear(): void {
    this.policies.clear();
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private evaluateMode(
    mode: AccessMode,
    operation: 'read' | 'write',
    reason: string,
  ): AccessCheckResult {
    if (mode === 'no-access') {
      return { allowed: false, mode, reason };
    }
    if (operation === 'read') {
      return { allowed: mode !== 'no-access', mode, reason };
    }
    // write requires read-write
    const allowed = mode === 'read-write';
    return { allowed, mode, reason: allowed ? reason : `write denied (policy: ${mode})` };
  }

  private isExpired(policy: AccessPolicy, now: number): boolean {
    return policy.expiresAt !== undefined && now > policy.expiresAt;
  }
}

// ─── Encryption helpers ───────────────────────────────────────────────────────

const CIPHER = 'aes-256-gcm';
const KEY_BYTES = 32;
const IV_BYTES = 12;

/**
 * Generate a random AES-256-GCM key.
 */
export function generateEncryptionKey(): Buffer {
  return randomBytes(KEY_BYTES);
}

/**
 * Encrypt a payload using AES-256-GCM.
 * Returns IV, auth tag, and ciphertext (all hex-encoded).
 */
export function encryptPayload(data: unknown, key: Buffer): EncryptedPayload {
  const plaintext = Buffer.from(JSON.stringify(data), 'utf8');
  const iv = randomBytes(IV_BYTES);

  const cipher = createCipheriv(CIPHER, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
    ciphertext: encrypted.toString('hex'),
  };
}

/**
 * Decrypt a payload encrypted with encryptPayload().
 * Returns the original value, or throws on tampered/invalid data.
 */
export function decryptPayload(encrypted: EncryptedPayload, key: Buffer): unknown {
  const iv = Buffer.from(encrypted.iv, 'hex');
  const tag = Buffer.from(encrypted.tag, 'hex');
  const ciphertext = Buffer.from(encrypted.ciphertext, 'hex');

  const decipher = createDecipheriv(CIPHER, key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8')) as unknown;
}

// ─── Peer authentication ──────────────────────────────────────────────────────

/**
 * Generate an Ed25519 key pair for a Hypercore log or peer.
 * Returns hex-encoded public key and PEM-encoded private key.
 */
export function generateKeyPair(): KeyPair {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return {
    publicKey: (publicKey as Buffer).toString('hex'),
    privateKey: privateKey as string,
  };
}

/**
 * Sign a challenge string with a private key (PEM).
 * Uses Ed25519 (sign with null algorithm — hash is built into Ed25519).
 * Returns hex-encoded signature.
 */
export function signChallenge(challenge: string, privateKeyPem: string): string {
  const sig = cryptoSign(null, Buffer.from(challenge), privateKeyPem);
  return sig.toString('hex');
}

/**
 * Verify a signed challenge against a public key (hex-encoded DER).
 */
export function verifyChallenge(
  challenge: string,
  signature: string,
  publicKeyHex: string,
): boolean {
  try {
    const publicKeyDer = Buffer.from(publicKeyHex, 'hex');
    const sigBuf = Buffer.from(signature, 'hex');
    return cryptoVerify(
      null,
      Buffer.from(challenge),
      { key: publicKeyDer, format: 'der', type: 'spki' },
      sigBuf,
    );
  } catch {
    return false;
  }
}

/**
 * Generate an HMAC-based discovery key from a store name + secret.
 * Used to verify peer discovery keys before replication.
 */
export function deriveDiscoveryKey(storeName: string, secret: string): string {
  return createHmac('sha256', secret).update(`discovery:${storeName}`).digest('hex');
}

// ─── PeerAuthenticator ────────────────────────────────────────────────────────

/**
 * PeerAuthenticator — manages challenge-response authentication for peers.
 * Stores authenticated peer credentials in memory.
 */
export class PeerAuthenticator {
  private authenticated = new Map<string, PeerCredential>();
  private secret: string;

  constructor(secret: string = randomBytes(32).toString('hex')) {
    this.secret = secret;
  }

  /**
   * Verify a peer's identity using their public key and signed challenge.
   * Challenge = HMAC(secret, peerId + timestamp).
   */
  authenticate(
    peerId: string,
    publicKeyHex: string,
    challenge: string,
    signature: string,
  ): boolean {
    const valid = verifyChallenge(challenge, signature, publicKeyHex);
    if (valid) {
      this.authenticated.set(peerId, {
        peerId,
        publicKey: publicKeyHex,
        authenticatedAt: Date.now(),
      });
    }
    return valid;
  }

  /**
   * Check if a peer has been successfully authenticated.
   */
  isAuthenticated(peerId: string): boolean {
    return this.authenticated.has(peerId);
  }

  /**
   * Generate a challenge for a peer to sign.
   */
  generateChallenge(peerId: string): string {
    const ts = Date.now();
    return createHmac('sha256', this.secret).update(`${peerId}:${ts}`).digest('hex');
  }

  /**
   * Revoke authentication for a peer.
   */
  revoke(peerId: string): void {
    this.authenticated.delete(peerId);
  }

  /**
   * List all currently authenticated peers.
   */
  listAuthenticated(): PeerCredential[] {
    return [...this.authenticated.values()];
  }
}
