// Harness Serializer - K3-26
// JSON serialization/deserialization with schema version validation
// Spec: .kiro/specs/agent-harnesses/tasks.md

import type { HarnessState } from './types.js';
import { HarnessStateSchema } from './schemas.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════════

const CURRENT_SCHEMA_VERSION = 1;

export interface SerializedHarness {
  schemaVersion: number;
  serializedAt: number;
  data: HarnessState;
  checksum: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Harness Serializer
// ═══════════════════════════════════════════════════════════════════════════════

export class HarnessSerializer {
  /**
   * Serialize a HarnessState to a JSON string with schema version and checksum.
   */
  serialize(state: HarnessState): string {
    const validated = HarnessStateSchema.parse(state);
    const envelope: SerializedHarness = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      serializedAt: Date.now(),
      data: validated,
      checksum: this.computeChecksum(validated),
    };
    return JSON.stringify(envelope);
  }

  /**
   * Deserialize a JSON string back to HarnessState.
   * Validates schema version and checksum.
   */
  deserialize(json: string): HarnessState {
    let envelope: SerializedHarness;
    try {
      envelope = JSON.parse(json) as SerializedHarness;
    } catch (err) {
      throw new Error(`Invalid JSON: ${err instanceof Error ? err.message : String(err)}`);
    }

    if (envelope.schemaVersion !== CURRENT_SCHEMA_VERSION) {
      throw new Error(
        `Schema version mismatch: expected ${CURRENT_SCHEMA_VERSION}, got ${envelope.schemaVersion}`
      );
    }

    const expectedChecksum = this.computeChecksum(envelope.data);
    if (envelope.checksum !== expectedChecksum) {
      throw new Error('Checksum mismatch — data may be corrupted');
    }

    return HarnessStateSchema.parse(envelope.data);
  }

  /**
   * Check whether a JSON string is a valid serialized HarnessState.
   */
  isValid(json: string): boolean {
    try {
      this.deserialize(json);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get schema version from serialized data without full validation.
   */
  getSchemaVersion(json: string): number | null {
    try {
      const envelope = JSON.parse(json) as Partial<SerializedHarness>;
      return typeof envelope.schemaVersion === 'number' ? envelope.schemaVersion : null;
    } catch {
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Private Helpers
  // ═══════════════════════════════════════════════════════════════════════════

  private computeChecksum(state: HarnessState): string {
    const content = `${state.config.id}:${state.status}:${state.createdAt}:${state.toolCallCount}`;
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit int
    }
    return Math.abs(hash).toString(16);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Factory Function
// ═══════════════════════════════════════════════════════════════════════════════

export function createHarnessSerializer(): HarnessSerializer {
  return new HarnessSerializer();
}
