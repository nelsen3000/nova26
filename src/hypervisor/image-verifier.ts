// Hypervisor Image Verifier — Spec Task 10.1
// Sprint S3-12 | Hypervisor Hypercore Integration (Reel 2)
//
// Verifies image/kernel/plugin checksums against a TrustedManifest.
// Uses SHA-256 (Node.js built-in crypto) — no external deps.

import { createHash } from 'crypto';
import type { TrustedManifest, VerificationResult } from './types.js';
import { TrustedManifestSchema } from './types.js';

// ─── Errors ───────────────────────────────────────────────────────────────────

export class ImageVerificationError extends Error {
  readonly code = 'IMAGE_VERIFICATION_FAILED';
  constructor(path: string, expected: string, actual: string) {
    super(`Image verification failed for '${path}': expected ${expected}, got ${actual}`);
    this.name = 'ImageVerificationError';
  }
}

export class ManifestNotFoundError extends Error {
  readonly code = 'MANIFEST_NOT_FOUND';
  constructor() {
    super('TrustedManifest not loaded — call loadManifest() first');
    this.name = 'ManifestNotFoundError';
  }
}

// ─── Hash utilities ────────────────────────────────────────────────────────────

/**
 * Compute SHA-256 of a Buffer. Returns hex string.
 */
export function sha256(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

// ─── ImageVerifier ────────────────────────────────────────────────────────────

/**
 * ImageVerifier — verifies VM images, kernels, and plugins against a TrustedManifest.
 *
 * Satisfies Spec Task 10.1:
 * - verifyImage(imagePath, data): check SHA-256 against manifest
 * - verifyKernel(kernelPath, data): same for kernel
 * - verifyPlugin(pluginName, pluginData): same for plugin
 * - loadManifest(manifest): load the trusted manifest
 * - manifest stored in-memory (file I/O injected for prod; test-friendly)
 */
export class ImageVerifier {
  private manifest: TrustedManifest | null = null;

  /**
   * Load a TrustedManifest (validates with Zod).
   */
  loadManifest(manifest: TrustedManifest): void {
    this.manifest = TrustedManifestSchema.parse(manifest);
  }

  /**
   * Clear the loaded manifest.
   */
  clearManifest(): void {
    this.manifest = null;
  }

  /**
   * Verify a VM image file by comparing its SHA-256 against the manifest.
   */
  verifyImage(imagePath: string, data: Buffer): VerificationResult {
    return this.verifyEntry('images', imagePath, data);
  }

  /**
   * Verify a kernel file by comparing its SHA-256 against the manifest.
   */
  verifyKernel(kernelPath: string, data: Buffer): VerificationResult {
    return this.verifyEntry('kernels', kernelPath, data);
  }

  /**
   * Verify a plugin by name and data buffer.
   */
  verifyPlugin(pluginName: string, pluginData: Buffer): VerificationResult {
    return this.verifyEntry('plugins', pluginName, pluginData);
  }

  /**
   * Check whether a path/name is in the manifest (useful for pre-flight checks).
   */
  isKnown(type: 'images' | 'kernels' | 'plugins', key: string): boolean {
    if (!this.manifest) return false;
    return key in this.manifest[type];
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private verifyEntry(
    type: 'images' | 'kernels' | 'plugins',
    key: string,
    data: Buffer,
  ): VerificationResult {
    if (!this.manifest) {
      return {
        verified: false,
        path: key,
        expectedHash: '',
        actualHash: '',
        verifiedAt: Date.now(),
        error: 'No manifest loaded',
      };
    }

    const expectedHash = this.manifest[type][key];
    if (!expectedHash) {
      return {
        verified: false,
        path: key,
        expectedHash: '',
        actualHash: '',
        verifiedAt: Date.now(),
        error: `'${key}' not found in manifest ${type}`,
      };
    }

    const actualHash = sha256(data);
    const verified = actualHash === expectedHash;
    return {
      verified,
      path: key,
      expectedHash,
      actualHash,
      verifiedAt: Date.now(),
      error: verified ? undefined : `hash mismatch: expected ${expectedHash}, got ${actualHash}`,
    };
  }
}
