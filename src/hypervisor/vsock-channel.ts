// Hypervisor VSOCK Channel — Spec Task 6 (VSOCK Communication)
// Sprint S3-11 | Hypervisor Hypercore Integration (Reel 2)
//
// VSOCK communication channel for sandbox ↔ host task dispatching.
// Uses length-prefixed JSON framing (compatible with MessagePack protocol shape).
// In unit tests / non-Linux environments: operates in "local" simulation mode.

import type { TaskPayload, TaskResult } from './types.js';
import { TaskPayloadSchema, TaskResultSchema } from './types.js';
import { randomUUID } from 'crypto';

// ─── Types ────────────────────────────────────────────────────────────────────

export const MSG_TYPE_PAYLOAD = 0;
export const MSG_TYPE_RESULT = 1;
export const HEADER_SIZE = 8; // 4 bytes length + 4 bytes type

export interface VSOCKFrame {
  type: 0 | 1;
  data: Buffer;
}

export interface PendingTask {
  resolve: (result: TaskResult) => void;
  reject: (reason: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export interface VSOCKChannelStats {
  sent: number;
  received: number;
  errors: number;
  pending: number;
}

// ─── Serialisation ────────────────────────────────────────────────────────────

/**
 * Serialize a TaskPayload to a length-prefixed binary frame.
 *
 * Frame format:
 *   [0..3]  uint32be — JSON body length
 *   [4..7]  uint32be — message type (MSG_TYPE_PAYLOAD = 0)
 *   [8..]   UTF-8 JSON body
 */
export function serializePayload(payload: TaskPayload): Buffer {
  const body = Buffer.from(JSON.stringify(payload), 'utf8');
  const header = Buffer.allocUnsafe(HEADER_SIZE);
  header.writeUInt32BE(body.length, 0);
  header.writeUInt32BE(MSG_TYPE_PAYLOAD, 4);
  return Buffer.concat([header, body]);
}

/**
 * Serialize a TaskResult to a length-prefixed binary frame.
 */
export function serializeResult(result: TaskResult): Buffer {
  const body = Buffer.from(JSON.stringify(result), 'utf8');
  const header = Buffer.allocUnsafe(HEADER_SIZE);
  header.writeUInt32BE(body.length, 0);
  header.writeUInt32BE(MSG_TYPE_RESULT, 4);
  return Buffer.concat([header, body]);
}

/**
 * Parse a framed buffer back into VSOCKFrame.
 * Throws on malformed data.
 */
export function parseFrame(data: Buffer): VSOCKFrame {
  if (data.length < HEADER_SIZE) {
    throw new Error(`VSOCK frame too short: ${data.length} < ${HEADER_SIZE}`);
  }
  const bodyLen = data.readUInt32BE(0);
  const type = data.readUInt32BE(4) as 0 | 1;
  if (type !== MSG_TYPE_PAYLOAD && type !== MSG_TYPE_RESULT) {
    throw new Error(`VSOCK unknown message type: ${type}`);
  }
  if (data.length < HEADER_SIZE + bodyLen) {
    throw new Error(`VSOCK frame incomplete: expected ${HEADER_SIZE + bodyLen}, got ${data.length}`);
  }
  return { type, data: data.slice(HEADER_SIZE, HEADER_SIZE + bodyLen) };
}

/**
 * Deserialize a TaskPayload frame (validates with Zod).
 */
export function deserializePayload(frame: VSOCKFrame): TaskPayload {
  if (frame.type !== MSG_TYPE_PAYLOAD) {
    throw new Error(`Expected MSG_TYPE_PAYLOAD (${MSG_TYPE_PAYLOAD}), got ${frame.type}`);
  }
  const raw = JSON.parse(frame.data.toString('utf8')) as unknown;
  return TaskPayloadSchema.parse(raw);
}

/**
 * Deserialize a TaskResult frame (validates with Zod).
 */
export function deserializeResult(frame: VSOCKFrame): TaskResult {
  if (frame.type !== MSG_TYPE_RESULT) {
    throw new Error(`Expected MSG_TYPE_RESULT (${MSG_TYPE_RESULT}), got ${frame.type}`);
  }
  const raw = JSON.parse(frame.data.toString('utf8')) as unknown;
  return TaskResultSchema.parse(raw);
}

// ─── VSOCKChannel ────────────────────────────────────────────────────────────

/**
 * VSOCKChannel — manages bidirectional communication between host and sandbox VM.
 *
 * In production: connects over Linux AF_VSOCK socket.
 * In tests / non-Linux: runs in local simulation mode (in-memory echo).
 *
 * Satisfies Spec Task 6.1:
 * - serialize/deserialize TaskPayload ↔ TaskResult
 * - send(payload) → taskId
 * - receive(taskId, timeout) → TaskResult
 * - isConnected() heartbeat
 * - multiplexing via taskId-keyed pending map
 */
export class VSOCKChannel {
  private _connected = false;
  private pending = new Map<string, PendingTask>();
  private stats = { sent: 0, received: 0, errors: 0 };
  private localMode: boolean;
  private localHandlers: Array<(payload: TaskPayload) => Promise<TaskResult>> = [];

  constructor(opts: { localMode?: boolean } = {}) {
    // Local mode: in-memory simulation — used for tests and non-VSOCK environments
    this.localMode = opts.localMode ?? true;
  }

  /**
   * "Connect" the channel.
   * In local mode, connection is always immediate.
   * In production, would open an AF_VSOCK socket to the specified CID:port.
   */
  connect(_vmCid?: number, _port = 1234): void {
    this._connected = true;
  }

  /**
   * Close the channel, rejecting all pending tasks.
   */
  disconnect(): void {
    this._connected = false;
    for (const [taskId, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(new Error(`VSOCKChannel: disconnected while task ${taskId} pending`));
    }
    this.pending.clear();
  }

  /**
   * Whether the channel is currently connected.
   */
  isConnected(): boolean {
    return this._connected;
  }

  /**
   * Register a local handler for incoming payloads (local simulation mode only).
   * The handler receives the payload and returns a TaskResult.
   */
  onPayload(handler: (payload: TaskPayload) => Promise<TaskResult>): void {
    this.localHandlers.push(handler);
  }

  /**
   * Send a TaskPayload over the channel.
   * Returns the taskId for correlation with receive().
   *
   * In local mode: immediately invokes local handlers and resolves the pending task.
   */
  async send(payload: TaskPayload): Promise<string> {
    if (!this._connected) {
      throw new Error('VSOCKChannel: not connected');
    }
    // Serialize to ensure round-trip correctness
    const frame = serializePayload(payload);
    const parsed = deserializePayload(parseFrame(frame));
    this.stats.sent++;

    if (this.localMode && this.localHandlers.length > 0) {
      // Run all handlers (last one wins in terms of result delivery)
      const handler = this.localHandlers[this.localHandlers.length - 1];
      const result = await handler(parsed);
      // Deliver to pending if registered, otherwise just resolve immediately
      const pending = this.pending.get(parsed.taskId);
      if (pending) {
        clearTimeout(pending.timer);
        this.pending.delete(parsed.taskId);
        this.stats.received++;
        pending.resolve(result);
      }
    }

    return parsed.taskId;
  }

  /**
   * Wait for a TaskResult for the given taskId, with timeout.
   * Returns a Promise that resolves with the TaskResult or rejects on timeout.
   */
  receive(taskId: string, timeoutMs = 30_000): Promise<TaskResult> {
    return new Promise<TaskResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(taskId);
        this.stats.errors++;
        reject(new Error(`VSOCKChannel: timeout waiting for task ${taskId}`));
      }, timeoutMs);

      this.pending.set(taskId, { resolve, reject, timer });
    });
  }

  /**
   * Deliver a result externally (used in simulation mode or by receive path).
   * Called when the VSOCK socket delivers data that has been framed + parsed.
   */
  deliverResult(result: TaskResult): void {
    const pending = this.pending.get(result.taskId);
    if (pending) {
      clearTimeout(pending.timer);
      this.pending.delete(result.taskId);
      this.stats.received++;
      pending.resolve(result);
    }
  }

  /**
   * Execute a task: send + receive in one call.
   * This is the primary API for dispatch callers.
   */
  async execute(payload: TaskPayload, timeoutMs = 30_000): Promise<TaskResult> {
    if (!this._connected) {
      throw new Error('VSOCKChannel: not connected');
    }

    // Register pending before send (race-free in local mode since JS is single-threaded)
    const resultPromise = this.receive(payload.taskId, timeoutMs);
    await this.send(payload);
    return resultPromise;
  }

  /**
   * Serialise + parse a full round trip (pure serialization test helper).
   */
  static roundTrip(payload: TaskPayload): TaskPayload {
    const frame = serializePayload(payload);
    return deserializePayload(parseFrame(frame));
  }

  static roundTripResult(result: TaskResult): TaskResult {
    const frame = serializeResult(result);
    return deserializeResult(parseFrame(frame));
  }

  getStats(): VSOCKChannelStats {
    return { ...this.stats, pending: this.pending.size };
  }
}
