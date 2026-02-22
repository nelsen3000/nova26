// VSOCK Channel Tests — Spec Tasks 6.1, 6.2, 6.3, 6.4
// Sprint S3-11 | Hypervisor Hypercore Integration (Reel 2)

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import {
  VSOCKChannel,
  serializePayload,
  serializeResult,
  parseFrame,
  deserializePayload,
  deserializeResult,
  MSG_TYPE_PAYLOAD,
  MSG_TYPE_RESULT,
  HEADER_SIZE,
} from '../vsock-channel.js';
import type { TaskPayload, TaskResult } from '../types.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makePayload(overrides: Partial<TaskPayload> = {}): TaskPayload {
  return {
    taskId: 'task-001',
    agentId: 'MARS',
    action: 'run-test',
    args: { input: 'hello' },
    timeoutMs: 5000,
    ...overrides,
  };
}

function makeResult(taskId = 'task-001', success = true): TaskResult {
  return {
    taskId,
    success,
    output: { result: 'ok' },
    durationMs: 42,
  };
}

// ─── Serialization ────────────────────────────────────────────────────────────

describe('Serialization', () => {
  it('serializePayload produces correct header', () => {
    const payload = makePayload();
    const buf = serializePayload(payload);
    expect(buf.length).toBeGreaterThan(HEADER_SIZE);
    expect(buf.readUInt32BE(4)).toBe(MSG_TYPE_PAYLOAD);
  });

  it('serializeResult produces MSG_TYPE_RESULT header', () => {
    const result = makeResult();
    const buf = serializeResult(result);
    expect(buf.readUInt32BE(4)).toBe(MSG_TYPE_RESULT);
  });

  it('parseFrame extracts body correctly', () => {
    const payload = makePayload();
    const buf = serializePayload(payload);
    const frame = parseFrame(buf);
    expect(frame.type).toBe(MSG_TYPE_PAYLOAD);
    const body = JSON.parse(frame.data.toString('utf8')) as TaskPayload;
    expect(body.taskId).toBe(payload.taskId);
  });

  it('parseFrame throws on too-short buffer', () => {
    expect(() => parseFrame(Buffer.alloc(4))).toThrow(/too short/);
  });

  it('parseFrame throws on unknown type', () => {
    const buf = Buffer.allocUnsafe(HEADER_SIZE + 2);
    buf.writeUInt32BE(2, 0);
    buf.writeUInt32BE(99, 4); // unknown type
    expect(() => parseFrame(buf)).toThrow(/unknown message type/);
  });

  it('deserializePayload round-trip preserves all fields', () => {
    const payload = makePayload({ args: { nested: { arr: [1, 2, 3] } } });
    const rt = VSOCKChannel.roundTrip(payload);
    expect(rt.taskId).toBe(payload.taskId);
    expect(rt.agentId).toBe(payload.agentId);
    expect(rt.args).toEqual(payload.args);
  });

  it('deserializeResult round-trip preserves all fields', () => {
    const result = makeResult('task-42', false);
    const rt = VSOCKChannel.roundTripResult(result);
    expect(rt.taskId).toBe('task-42');
    expect(rt.success).toBe(false);
    expect(rt.durationMs).toBe(42);
  });

  it('deserializePayload throws on wrong frame type', () => {
    const buf = serializeResult(makeResult()); // result framed as payload
    const frame = parseFrame(buf);
    expect(() => deserializePayload(frame)).toThrow(/MSG_TYPE_PAYLOAD/);
  });

  it('deserializeResult throws on wrong frame type', () => {
    const buf = serializePayload(makePayload());
    const frame = parseFrame(buf);
    expect(() => deserializeResult(frame)).toThrow(/MSG_TYPE_RESULT/);
  });
});

// ─── VSOCKChannel lifecycle ───────────────────────────────────────────────────

describe('VSOCKChannel lifecycle', () => {
  let ch: VSOCKChannel;

  beforeEach(() => {
    ch = new VSOCKChannel({ localMode: true });
  });

  it('isConnected() is false before connect()', () => {
    expect(ch.isConnected()).toBe(false);
  });

  it('isConnected() is true after connect()', () => {
    ch.connect();
    expect(ch.isConnected()).toBe(true);
  });

  it('isConnected() is false after disconnect()', () => {
    ch.connect();
    ch.disconnect();
    expect(ch.isConnected()).toBe(false);
  });

  it('send() throws when not connected', async () => {
    await expect(ch.send(makePayload())).rejects.toThrow(/not connected/);
  });
});

// ─── Task execution ───────────────────────────────────────────────────────────

describe('VSOCKChannel task execution', () => {
  let ch: VSOCKChannel;

  beforeEach(() => {
    ch = new VSOCKChannel({ localMode: true });
    ch.connect();
  });

  it('execute() delivers result via local handler', async () => {
    ch.onPayload(async (payload) => makeResult(payload.taskId, true));

    const payload = makePayload({ taskId: 'task-exec-1' });
    const result = await ch.execute(payload, 1000);

    expect(result.taskId).toBe('task-exec-1');
    expect(result.success).toBe(true);
  });

  it('receive() times out when no handler registered', async () => {
    const ch2 = new VSOCKChannel({ localMode: false });
    ch2.connect();
    const payload = makePayload({ taskId: 'task-timeout' });
    // Don't register a handler — just test timeout
    await expect(ch2.receive('task-timeout', 50)).rejects.toThrow(/timeout/);
  });

  it('stats increment after successful send/receive', async () => {
    ch.onPayload(async (payload) => makeResult(payload.taskId));
    await ch.execute(makePayload({ taskId: 'stats-test' }), 1000);
    const stats = ch.getStats();
    expect(stats.sent).toBe(1);
    expect(stats.received).toBe(1);
    expect(stats.errors).toBe(0);
  });

  it('disconnect() rejects pending tasks', async () => {
    const ch2 = new VSOCKChannel({ localMode: false });
    ch2.connect();
    const receivePromise = ch2.receive('pending-task', 5000);
    ch2.disconnect();
    await expect(receivePromise).rejects.toThrow(/disconnected/);
  });

  it('deliverResult() resolves pending task', async () => {
    const ch2 = new VSOCKChannel({ localMode: false });
    ch2.connect();
    const taskId = 'manual-delivery';
    const receivePromise = ch2.receive(taskId, 1000);
    ch2.deliverResult(makeResult(taskId));
    const result = await receivePromise;
    expect(result.taskId).toBe(taskId);
  });
});

// ─── Property 13: VSOCK task payload round-trip ───────────────────────────────

describe('Property 13: VSOCK task payload round-trip', () => {
  it('serialize + deserialize preserves all TaskPayload fields', () => {
    fc.assert(fc.property(
      fc.record({
        taskId: fc.uuid(),
        agentId: fc.constantFrom('MARS', 'VENUS', 'EARTH', 'ATLAS'),
        action: fc.string({ minLength: 1, maxLength: 30 }),
        args: fc.dictionary(fc.string(), fc.oneof(fc.string(), fc.integer(), fc.boolean())),
        timeoutMs: fc.integer({ min: 1000, max: 120_000 }),
      }),
      (fields) => {
        const payload: TaskPayload = fields;
        const rt = VSOCKChannel.roundTrip(payload);
        expect(rt.taskId).toBe(payload.taskId);
        expect(rt.agentId).toBe(payload.agentId);
        expect(rt.action).toBe(payload.action);
        expect(rt.timeoutMs).toBe(payload.timeoutMs);
        expect(rt.args).toEqual(payload.args);
      },
    ), { numRuns: 100 });
  });
});

// ─── Property 14: VSOCK task execution protocol ───────────────────────────────

describe('Property 14: VSOCK task execution protocol', () => {
  it('execute() always returns result with matching taskId', async () => {
    await fc.assert(fc.asyncProperty(
      fc.uuid(),
      async (taskId) => {
        const ch = new VSOCKChannel({ localMode: true });
        ch.connect();
        ch.onPayload(async (p) => ({
          taskId: p.taskId,
          success: true,
          output: 'ok',
          durationMs: 1,
        }));
        const result = await ch.execute(makePayload({ taskId }), 1000);
        expect(result.taskId).toBe(taskId);
        expect(result.success).toBe(true);
      },
    ), { numRuns: 30 });
  });
});

// ─── Property 15: VSOCK multiplexing independence ────────────────────────────

describe('Property 15: VSOCK multiplexing independence', () => {
  it('concurrent tasks deliver results to correct receivers', async () => {
    const ch = new VSOCKChannel({ localMode: false });
    ch.connect();

    const N = 10;
    const taskIds = Array.from({ length: N }, (_, i) => `task-mux-${i}`);

    // Register receives before delivers (simulating concurrent requests)
    const receivePromises = taskIds.map(id => ch.receive(id, 1000));

    // Deliver results in reverse order (to verify no ordering dependency)
    for (const id of [...taskIds].reverse()) {
      ch.deliverResult(makeResult(id));
    }

    const results = await Promise.all(receivePromises);
    for (let i = 0; i < N; i++) {
      expect(results[i].taskId).toBe(taskIds[i]);
    }
  });
});
