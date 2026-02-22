// Access Control Tests — Spec Task 11.1
// Sprint S3-07 | P2P Hypercore Protocol (Reel 1)

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import {
  AccessControlList,
  generateEncryptionKey,
  encryptPayload,
  decryptPayload,
  generateKeyPair,
  signChallenge,
  verifyChallenge,
  deriveDiscoveryKey,
  PeerAuthenticator,
} from '../access-control.js';

// ─── AccessControlList ────────────────────────────────────────────────────────

describe('AccessControlList', () => {
  let acl: AccessControlList;

  beforeEach(() => { acl = new AccessControlList(); });

  it('default policy: local gets read-write, remote gets read-only', () => {
    const local = acl.check('store-a', 'local', 'write');
    expect(local.allowed).toBe(true);
    expect(local.mode).toBe('read-write');

    const remote = acl.check('store-a', 'peer-xyz', 'write');
    expect(remote.allowed).toBe(false);

    const remoteRead = acl.check('store-a', 'peer-xyz', 'read');
    expect(remoteRead.allowed).toBe(true);
  });

  it('grant() allows explicit read-write to a peer', () => {
    acl.grant('store-a', 'peer-1', 'read-write');
    const result = acl.check('store-a', 'peer-1', 'write');
    expect(result.allowed).toBe(true);
  });

  it('grant() read-only denies write but allows read', () => {
    acl.grant('store-a', 'peer-1', 'read-only');
    expect(acl.check('store-a', 'peer-1', 'write').allowed).toBe(false);
    expect(acl.check('store-a', 'peer-1', 'read').allowed).toBe(true);
  });

  it('grant() no-access denies everything', () => {
    acl.grant('store-a', 'peer-1', 'no-access');
    expect(acl.check('store-a', 'peer-1', 'read').allowed).toBe(false);
    expect(acl.check('store-a', 'peer-1', 'write').allowed).toBe(false);
  });

  it('wildcard (*) applies to any unmatched peer', () => {
    acl.grant('store-a', '*', 'read-write');
    expect(acl.check('store-a', 'any-peer', 'write').allowed).toBe(true);
  });

  it('exact match takes priority over wildcard', () => {
    acl.grant('store-a', '*', 'read-write');
    acl.grant('store-a', 'restricted-peer', 'read-only');
    expect(acl.check('store-a', 'restricted-peer', 'write').allowed).toBe(false);
    expect(acl.check('store-a', 'other-peer', 'write').allowed).toBe(true);
  });

  it('revoke() removes a peer policy', () => {
    acl.grant('store-a', 'peer-1', 'read-write');
    acl.revoke('store-a', 'peer-1');
    // Falls back to default (no-access since explicit ACL exists now with no wildcard)
    const result = acl.check('store-a', 'peer-1', 'write');
    expect(result.allowed).toBe(false);
  });

  it('revoke() returns false for unknown peer', () => {
    expect(acl.revoke('store-a', 'nobody')).toBe(false);
  });

  it('expired policy is ignored (falls back to wildcard)', () => {
    acl.grant('store-a', 'peer-1', 'read-write', Date.now() - 1000); // expired
    acl.grant('store-a', '*', 'read-only');
    const result = acl.check('store-a', 'peer-1', 'write');
    expect(result.allowed).toBe(false); // wildcard is read-only
  });

  it('list() returns all policies for a store', () => {
    acl.grant('store-a', 'peer-1', 'read-write');
    acl.grant('store-a', 'peer-2', 'read-only');
    expect(acl.list('store-a')).toHaveLength(2);
  });

  it('clearStore() removes all policies for a store', () => {
    acl.grant('store-a', 'peer-1', 'read-write');
    acl.clearStore('store-a');
    expect(acl.list('store-a')).toHaveLength(0);
  });

  it('independent stores have independent policies', () => {
    acl.grant('store-a', 'peer-1', 'no-access');
    acl.grant('store-b', 'peer-1', 'read-write');
    expect(acl.check('store-a', 'peer-1', 'read').allowed).toBe(false);
    expect(acl.check('store-b', 'peer-1', 'read').allowed).toBe(true);
  });
});

// ─── Encryption ───────────────────────────────────────────────────────────────

describe('Payload encryption', () => {
  it('encryptPayload() + decryptPayload() round-trips any JSON value', () => {
    const key = generateEncryptionKey();
    const data = { msg: 'hello', num: 42, nested: { arr: [1, 2, 3] } };

    const encrypted = encryptPayload(data, key);
    const decrypted = decryptPayload(encrypted, key);

    expect(decrypted).toEqual(data);
  });

  it('each encryption produces a different IV', () => {
    const key = generateEncryptionKey();
    const enc1 = encryptPayload('same', key);
    const enc2 = encryptPayload('same', key);
    expect(enc1.iv).not.toBe(enc2.iv);
  });

  it('tampered ciphertext throws on decrypt', () => {
    const key = generateEncryptionKey();
    const encrypted = encryptPayload('secret', key);
    const tampered = { ...encrypted, ciphertext: 'aabbccdd' + encrypted.ciphertext.slice(8) };
    expect(() => decryptPayload(tampered, key)).toThrow();
  });

  it('wrong key throws on decrypt', () => {
    const key1 = generateEncryptionKey();
    const key2 = generateEncryptionKey();
    const encrypted = encryptPayload('secret', key1);
    expect(() => decryptPayload(encrypted, key2)).toThrow();
  });

  it('property: encrypt/decrypt round-trip for strings', () => {
    fc.assert(fc.property(
      fc.string({ minLength: 0, maxLength: 1000 }),
      (s) => {
        const key = generateEncryptionKey();
        const enc = encryptPayload(s, key);
        const dec = decryptPayload(enc, key);
        expect(dec).toBe(s);
      },
    ), { numRuns: 50 });
  });
});

// ─── Key pair + signing ───────────────────────────────────────────────────────

describe('Key pair and signing', () => {
  it('generateKeyPair() returns publicKey and privateKey strings', () => {
    const kp = generateKeyPair();
    expect(typeof kp.publicKey).toBe('string');
    expect(typeof kp.privateKey).toBe('string');
    expect(kp.publicKey.length).toBeGreaterThan(10);
  });

  it('signChallenge() + verifyChallenge() round-trip', () => {
    const kp = generateKeyPair();
    const challenge = 'random-challenge-string';
    const sig = signChallenge(challenge, kp.privateKey);
    expect(verifyChallenge(challenge, sig, kp.publicKey)).toBe(true);
  });

  it('verifyChallenge() rejects tampered signature', () => {
    const kp = generateKeyPair();
    const sig = signChallenge('hello', kp.privateKey);
    expect(verifyChallenge('hello-tampered', sig, kp.publicKey)).toBe(false);
  });

  it('verifyChallenge() rejects wrong public key', () => {
    const kp1 = generateKeyPair();
    const kp2 = generateKeyPair();
    const sig = signChallenge('hello', kp1.privateKey);
    expect(verifyChallenge('hello', sig, kp2.publicKey)).toBe(false);
  });

  it('verifyChallenge() handles invalid hex gracefully (returns false)', () => {
    expect(verifyChallenge('challenge', 'not-hex', 'also-not-hex')).toBe(false);
  });
});

// ─── Discovery key ────────────────────────────────────────────────────────────

describe('deriveDiscoveryKey()', () => {
  it('same store + secret produces same key', () => {
    const k1 = deriveDiscoveryKey('my-store', 'secret');
    const k2 = deriveDiscoveryKey('my-store', 'secret');
    expect(k1).toBe(k2);
  });

  it('different stores produce different keys', () => {
    const k1 = deriveDiscoveryKey('store-a', 'secret');
    const k2 = deriveDiscoveryKey('store-b', 'secret');
    expect(k1).not.toBe(k2);
  });

  it('different secrets produce different keys', () => {
    const k1 = deriveDiscoveryKey('store', 'secret-1');
    const k2 = deriveDiscoveryKey('store', 'secret-2');
    expect(k1).not.toBe(k2);
  });
});

// ─── PeerAuthenticator ────────────────────────────────────────────────────────

describe('PeerAuthenticator', () => {
  it('generates non-empty challenge', () => {
    const auth = new PeerAuthenticator('mysecret');
    const challenge = auth.generateChallenge('peer-1');
    expect(challenge.length).toBeGreaterThan(0);
  });

  it('authenticate() succeeds with valid signature', () => {
    const auth = new PeerAuthenticator('mysecret');
    const kp = generateKeyPair();
    const challenge = auth.generateChallenge('peer-1');
    const sig = signChallenge(challenge, kp.privateKey);

    expect(auth.authenticate('peer-1', kp.publicKey, challenge, sig)).toBe(true);
    expect(auth.isAuthenticated('peer-1')).toBe(true);
  });

  it('authenticate() rejects invalid signature', () => {
    const auth = new PeerAuthenticator('mysecret');
    const kp = generateKeyPair();
    const wrongKp = generateKeyPair();
    const challenge = auth.generateChallenge('peer-1');
    const sig = signChallenge(challenge, wrongKp.privateKey);

    expect(auth.authenticate('peer-1', kp.publicKey, challenge, sig)).toBe(false);
    expect(auth.isAuthenticated('peer-1')).toBe(false);
  });

  it('revoke() removes an authenticated peer', () => {
    const auth = new PeerAuthenticator('mysecret');
    const kp = generateKeyPair();
    const challenge = auth.generateChallenge('peer-1');
    const sig = signChallenge(challenge, kp.privateKey);
    auth.authenticate('peer-1', kp.publicKey, challenge, sig);

    auth.revoke('peer-1');
    expect(auth.isAuthenticated('peer-1')).toBe(false);
  });

  it('listAuthenticated() returns all authenticated peers', () => {
    const auth = new PeerAuthenticator('mysecret');
    const kp1 = generateKeyPair();
    const kp2 = generateKeyPair();

    const c1 = auth.generateChallenge('p1');
    const c2 = auth.generateChallenge('p2');
    auth.authenticate('p1', kp1.publicKey, c1, signChallenge(c1, kp1.privateKey));
    auth.authenticate('p2', kp2.publicKey, c2, signChallenge(c2, kp2.privateKey));

    expect(auth.listAuthenticated()).toHaveLength(2);
  });
});
