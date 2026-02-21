// TaskNegotiator Tests — Requirements 7.1-7.5

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AgentRegistry } from '../registry.js';
import { A2ARouter } from '../router.js';
import { TaskNegotiator } from '../task-negotiator.js';
import type { TaskProposal } from '../types.js';

describe('TaskNegotiator', () => {
  let registry: AgentRegistry;
  let router: A2ARouter;
  let sunNegotiator: TaskNegotiator;
  let marsNegotiator: TaskNegotiator;

  const sampleProposal: TaskProposal = {
    taskId: 'task-1',
    description: 'Build the login page',
    requiredCapabilities: ['coding'],
    complexity: 'medium',
    proposedBy: 'SUN',
  };

  beforeEach(() => {
    registry = new AgentRegistry();
    registry.register({ id: 'SUN', name: 'Sun', tier: 'L0' });
    registry.register({ id: 'MARS', name: 'Mars', tier: 'L2' });
    router = new A2ARouter(registry);
    sunNegotiator = new TaskNegotiator('SUN', router);
    marsNegotiator = new TaskNegotiator('MARS', router);
  });

  afterEach(() => {
    sunNegotiator.dispose();
    marsNegotiator.dispose();
  });

  it('propose creates a negotiation record with pending status', async () => {
    router.onReceive('MARS', () => {});
    const record = await sunNegotiator.propose('MARS', sampleProposal);
    expect(record.status).toBe('pending');
    expect(record.proposerAgentId).toBe('SUN');
    expect(record.targetAgentId).toBe('MARS');
    expect(record.correlationId).toBeDefined();
    expect(record.proposalId).toBeDefined();
  });

  it('propose sends task-proposal envelope to target', async () => {
    const received: unknown[] = [];
    router.onReceive('MARS', env => received.push(env));
    await sunNegotiator.propose('MARS', sampleProposal);
    expect(received.length).toBe(1);
  });

  it('accept transitions proposal to accepted', async () => {
    router.onReceive('MARS', () => {});
    router.onReceive('SUN', () => {});
    const record = await sunNegotiator.propose('MARS', sampleProposal);
    await sunNegotiator.accept(record.proposalId, 5000);
    expect(record.status).toBe('accepted');
    expect(record.acceptedBy).toBe('SUN');
    expect(record.estimatedCompletionMs).toBe(5000);
  });

  it('reject transitions proposal to rejected with reason', async () => {
    router.onReceive('MARS', () => {});
    router.onReceive('SUN', () => {});
    const record = await sunNegotiator.propose('MARS', sampleProposal);
    await sunNegotiator.reject(record.proposalId, 'Too busy', 'VENUS');
    expect(record.status).toBe('rejected');
    expect(record.rejectionReason).toBe('Too busy');
    expect(record.alternativeSuggestion).toBe('VENUS');
  });

  it('accept on non-pending proposal throws', async () => {
    router.onReceive('MARS', () => {});
    router.onReceive('SUN', () => {});
    const record = await sunNegotiator.propose('MARS', sampleProposal);
    await sunNegotiator.accept(record.proposalId);
    await expect(sunNegotiator.accept(record.proposalId)).rejects.toThrow('already accepted');
  });

  it('proposal times out after deadline', async () => {
    vi.useFakeTimers();
    router.onReceive('MARS', () => {});
    const record = await sunNegotiator.propose('MARS', sampleProposal, 100);
    expect(record.status).toBe('pending');
    vi.advanceTimersByTime(150);
    expect(record.status).toBe('timed-out');
    vi.useRealTimers();
  });

  it('handleIncomingProposal stores and notifies handlers', async () => {
    const received: string[] = [];
    marsNegotiator.onProposalReceived(r => { received.push(r.proposalId); });

    const factory = (await import('../envelope.js')).EnvelopeFactory;
    const f = new factory('SUN');
    const envelope = f.createEnvelope('task-proposal', 'MARS', {
      proposalId: 'prop-1',
      ...sampleProposal,
      deadlineMs: 5000,
    }, { correlationId: 'corr-1' });

    const record = await marsNegotiator.handleIncomingProposal(envelope);
    expect(record.proposalId).toBe('prop-1');
    expect(record.status).toBe('pending');
    expect(received).toContain('prop-1');
  });

  it('correlation thread links proposal and acceptance', async () => {
    router.onReceive('MARS', () => {});
    router.onReceive('SUN', () => {});
    const record = await sunNegotiator.propose('MARS', sampleProposal);
    await sunNegotiator.accept(record.proposalId);
    const thread = sunNegotiator.getThread(record.correlationId);
    expect(thread.length).toBe(1);
    expect(thread[0]!.correlationId).toBe(record.correlationId);
  });

  it('listPending returns only pending proposals', async () => {
    router.onReceive('MARS', () => {});
    router.onReceive('SUN', () => {});
    const r1 = await sunNegotiator.propose('MARS', sampleProposal);
    await sunNegotiator.propose('MARS', { ...sampleProposal, taskId: 'task-2' });
    await sunNegotiator.accept(r1.proposalId);
    expect(sunNegotiator.listPending().length).toBe(1);
  });

  it('getProposal returns undefined for unknown ID', () => {
    expect(sunNegotiator.getProposal('nonexistent')).toBeUndefined();
  });
});
