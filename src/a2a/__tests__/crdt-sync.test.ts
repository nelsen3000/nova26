// CRDTSyncChannel Tests — Requirements 9.1-9.5

import { describe, it, expect, beforeEach } from 'vitest';
import { AgentRegistry } from '../registry.js';
import { A2ARouter } from '../router.js';
import { CRDTSyncChannel } from '../crdt-sync.js';
import type { CRDTSyncMessage } from '../types.js';

describe('CRDTSyncChannel', () => {
  let registry: AgentRegistry;
  let router: A2ARouter;
  let channelA: CRDTSyncChannel;
  let channelB: CRDTSyncChannel;

  beforeEach(() => {
    registry = new AgentRegistry();
    registry.register({ id: 'AGENT-A', name: 'Agent A', tier: 'L0' });
    registry.register({ id: 'AGENT-B', name: 'Agent B', tier: 'L1' });
    router = new A2ARouter(registry);
    channelA = new CRDTSyncChannel('AGENT-A', router);
    channelB = new CRDTSyncChannel('AGENT-B', router);
  });

  it('broadcast increments local vector clock', async () => {
    router.onReceive('AGENT-B', () => {});
    await channelA.broadcast({ op: 'insert', value: 'hello' });
    const clock = channelA.getVectorClock();
    expect(clock['AGENT-A']).toBe(1);
  });

  it('broadcast sends stream-data envelope via router', async () => {
    const received: unknown[] = [];
    router.onReceive('AGENT-B', env => received.push(env));
    await channelA.broadcast({ op: 'insert' });
    // Broadcast goes to all agents except sender
    expect(received.length).toBe(1);
  });

  it('applyUpdate merges vector clock', async () => {
    const message: CRDTSyncMessage = {
      operationId: 'AGENT-A-1',
      vectorClock: { 'AGENT-A': 3, 'AGENT-C': 2 },
      payload: { op: 'insert' },
      logName: 'crdt-sync',
      seq: 3,
    };
    const applied = await channelB.applyUpdate(message);
    expect(applied).toBe(true);
    const clock = channelB.getVectorClock();
    expect(clock['AGENT-A']).toBe(3);
    expect(clock['AGENT-C']).toBe(2);
  });

  it('applyUpdate notifies handlers', async () => {
    const received: CRDTSyncMessage[] = [];
    channelB.onUpdate(msg => { received.push(msg); });
    await channelB.applyUpdate({
      operationId: 'op-1',
      vectorClock: { 'AGENT-A': 1 },
      payload: { data: 'test' },
      logName: 'crdt-sync',
      seq: 1,
    });
    expect(received.length).toBe(1);
    expect(received[0]!.payload).toEqual({ data: 'test' });
  });

  it('applyUpdate skips malformed messages and logs error', async () => {
    const applied = await channelB.applyUpdate({ bad: 'data' });
    expect(applied).toBe(false);
    expect(channelB.getErrorLog().length).toBe(1);
  });

  it('concurrent updates from different agents merge correctly', async () => {
    // Agent A sends clock {A:1}
    await channelB.applyUpdate({
      operationId: 'A-1', vectorClock: { 'AGENT-A': 1 },
      payload: {}, logName: 'crdt-sync', seq: 1,
    });
    // Agent C sends clock {C:2}
    await channelB.applyUpdate({
      operationId: 'C-1', vectorClock: { 'AGENT-C': 2 },
      payload: {}, logName: 'crdt-sync', seq: 2,
    });
    const clock = channelB.getVectorClock();
    expect(clock['AGENT-A']).toBe(1);
    expect(clock['AGENT-C']).toBe(2);
    expect(clock['AGENT-B']).toBe(0); // local clock unchanged
  });

  it('onUpdate returns unsubscribe function', async () => {
    const received: CRDTSyncMessage[] = [];
    const unsub = channelB.onUpdate(msg => received.push(msg));
    unsub();
    await channelB.applyUpdate({
      operationId: 'op-1', vectorClock: { 'AGENT-A': 1 },
      payload: {}, logName: 'crdt-sync', seq: 1,
    });
    expect(received.length).toBe(0);
  });

  it('close prevents further broadcasts', async () => {
    channelA.close();
    await expect(channelA.broadcast({ op: 'insert' })).rejects.toThrow('closed');
  });

  it('multiple broadcasts increment clock sequentially', async () => {
    router.onReceive('AGENT-B', () => {});
    await channelA.broadcast({ op: 1 });
    await channelA.broadcast({ op: 2 });
    await channelA.broadcast({ op: 3 });
    expect(channelA.getVectorClock()['AGENT-A']).toBe(3);
  });
});
