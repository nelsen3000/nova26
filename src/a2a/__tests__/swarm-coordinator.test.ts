// SwarmCoordinator Tests — Requirements 8.1-8.6

import { describe, it, expect, beforeEach } from 'vitest';
import { AgentRegistry } from '../registry.js';
import { A2ARouter } from '../router.js';
import { SwarmCoordinator } from '../swarm-coordinator.js';

describe('SwarmCoordinator', () => {
  let registry: AgentRegistry;
  let router: A2ARouter;
  let coordinator: SwarmCoordinator;

  beforeEach(() => {
    registry = new AgentRegistry();
    registry.register({ id: 'SUN', name: 'Sun', tier: 'L0' });
    registry.register({
      id: 'MARS', name: 'Mars', tier: 'L2',
      capabilities: [{ name: 'coding', version: '1.0', description: 'Code generation' }],
    });
    registry.register({
      id: 'VENUS', name: 'Venus', tier: 'L2',
      capabilities: [{ name: 'coding', version: '1.0', description: 'Code review' }],
    });
    registry.register({
      id: 'SATURN', name: 'Saturn', tier: 'L1',
      capabilities: [{ name: 'testing', version: '1.0', description: 'Testing' }],
    });
    router = new A2ARouter(registry);
    coordinator = new SwarmCoordinator('SUN', router, registry);
  });

  it('createSwarm broadcasts proposals to capable agents', async () => {
    const received: string[] = [];
    router.onReceive('MARS', env => received.push(env.to));
    router.onReceive('VENUS', env => received.push(env.to));
    router.onReceive('SATURN', () => {}); // should not receive coding proposals

    const session = await coordinator.createSwarm('Build feature', ['coding'], ['Task A', 'Task B']);
    expect(session.status).toBe('recruiting');
    expect(session.subTasks.length).toBe(2);
    expect(received).toContain('MARS');
    expect(received).toContain('VENUS');
    expect(received).not.toContain('SATURN');
  });

  it('joinSwarm adds participant and assigns pending sub-task', async () => {
    const session = await coordinator.createSwarm('Build feature', ['coding'], ['Task A', 'Task B']);
    const assigned = coordinator.joinSwarm(session.id, 'MARS');
    expect(assigned).toBeDefined();
    expect(assigned!.assignedAgent).toBe('MARS');
    expect(assigned!.status).toBe('running');
    expect(session.participants).toContain('MARS');
    expect(session.status).toBe('active');
  });

  it('joinSwarm assigns different sub-tasks to different agents', async () => {
    const session = await coordinator.createSwarm('Build feature', ['coding'], ['Task A', 'Task B']);
    const t1 = coordinator.joinSwarm(session.id, 'MARS');
    const t2 = coordinator.joinSwarm(session.id, 'VENUS');
    expect(t1!.id).not.toBe(t2!.id);
    expect(t1!.assignedAgent).toBe('MARS');
    expect(t2!.assignedAgent).toBe('VENUS');
  });

  it('completeSubTask updates shared state', async () => {
    const session = await coordinator.createSwarm('Build feature', ['coding'], ['Task A']);
    coordinator.joinSwarm(session.id, 'MARS');
    const subTaskId = session.subTasks[0]!.id;
    coordinator.completeSubTask(session.id, subTaskId, { output: 'done' });
    expect(session.subTasks[0]!.status).toBe('completed');
    expect(session.sharedState[subTaskId]).toEqual({ output: 'done' });
  });

  it('swarm transitions to completed when all sub-tasks done', async () => {
    const session = await coordinator.createSwarm('Build feature', ['coding'], ['Task A']);
    coordinator.joinSwarm(session.id, 'MARS');
    coordinator.completeSubTask(session.id, session.subTasks[0]!.id, 'ok');
    expect(session.status).toBe('completed');
    expect(session.completedAt).toBeDefined();
  });

  it('failSubTask reassigns to another participant', async () => {
    const session = await coordinator.createSwarm('Build feature', ['coding'], ['Task A']);
    coordinator.joinSwarm(session.id, 'MARS');
    coordinator.joinSwarm(session.id, 'VENUS');
    const result = coordinator.failSubTask(session.id, session.subTasks[0]!.id, 'crashed');
    expect(result.reassigned).toBe(true);
    expect(result.newAgent).toBe('VENUS');
    expect(session.subTasks[0]!.status).toBe('running');
  });

  it('failSubTask marks failed when no alternative agent', async () => {
    const session = await coordinator.createSwarm('Build feature', ['coding'], ['Task A']);
    coordinator.joinSwarm(session.id, 'MARS');
    const result = coordinator.failSubTask(session.id, session.subTasks[0]!.id, 'crashed');
    expect(result.reassigned).toBe(false);
    expect(session.subTasks[0]!.status).toBe('failed');
  });

  it('swarm transitions to failed when sub-task fails with no reassignment', async () => {
    const session = await coordinator.createSwarm('Build feature', ['coding'], ['Task A']);
    coordinator.joinSwarm(session.id, 'MARS');
    coordinator.failSubTask(session.id, session.subTasks[0]!.id, 'crashed');
    expect(session.status).toBe('failed');
  });

  it('getSwarm returns undefined for unknown ID', () => {
    expect(coordinator.getSwarm('nonexistent')).toBeUndefined();
  });

  it('listActiveSwarms returns only active/recruiting swarms', async () => {
    const s1 = await coordinator.createSwarm('Task 1', ['coding'], ['A']);
    await coordinator.createSwarm('Task 2', ['coding'], ['B']);
    coordinator.joinSwarm(s1.id, 'MARS');
    coordinator.completeSubTask(s1.id, s1.subTasks[0]!.id, 'done');
    expect(coordinator.listActiveSwarms().length).toBe(1);
  });

  it('joinSwarm throws for completed swarm', async () => {
    const session = await coordinator.createSwarm('Build feature', ['coding'], ['Task A']);
    coordinator.joinSwarm(session.id, 'MARS');
    coordinator.completeSubTask(session.id, session.subTasks[0]!.id, 'done');
    expect(() => coordinator.joinSwarm(session.id, 'VENUS')).toThrow('completed');
  });
});
