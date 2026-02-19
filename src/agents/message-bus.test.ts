// Tests for Agent Message Bus and Negotiation Protocol
// KIMI-FRONTIER-06

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getAgentMessageBus,
  resetAgentMessageBus,
  getNegotiationProtocol,
  resetNegotiationProtocol,
  type AgentMessage,
  type AgentName,
} from './message-bus.js';
import { getSharedBlackboard, resetSharedBlackboard } from './blackboard.js';

describe('AgentMessageBus', () => {
  beforeEach(() => {
    resetAgentMessageBus();
  });

  describe('Message sending', () => {
    it('send() delivers a message to a registered handler', async () => {
      const bus = getAgentMessageBus();
      const received: AgentMessage[] = [];
      
      bus.subscribe('VENUS' as AgentName, async (msg) => {
        received.push(msg);
      });

      await bus.send({
        type: 'SHARE_FINDING',
        from: 'MARS' as AgentName,
        to: 'VENUS' as AgentName,
        subject: 'test',
        body: 'test body',
        taskId: 'task-001',
        priority: 'medium',
        requiresResponse: false,
      });

      expect(received.length).toBe(1);
      expect(received[0].body).toBe('test body');
    });

    it('send() assigns a unique id and sentAt timestamp', async () => {
      const bus = getAgentMessageBus();
      
      const msg1 = await bus.send({
        type: 'SHARE_FINDING',
        from: 'MARS' as AgentName,
        to: 'VENUS' as AgentName,
        subject: 'test',
        body: 'test',
        taskId: 'task-001',
        priority: 'medium',
        requiresResponse: false,
      });

      const msg2 = await bus.send({
        type: 'SHARE_FINDING',
        from: 'MARS' as AgentName,
        to: 'VENUS' as AgentName,
        subject: 'test',
        body: 'test',
        taskId: 'task-001',
        priority: 'medium',
        requiresResponse: false,
      });

      expect(msg1.id).toBeDefined();
      expect(msg2.id).toBeDefined();
      expect(msg1.id).not.toBe(msg2.id);
      expect(msg1.sentAt).toBeDefined();
    });

    it('send() BROADCAST delivers to all registered handlers', async () => {
      const bus = getAgentMessageBus();
      const receivedMars: AgentMessage[] = [];
      const receivedVenus: AgentMessage[] = [];
      
      bus.subscribe('MARS' as AgentName, async (msg) => receivedMars.push(msg));
      bus.subscribe('VENUS' as AgentName, async (msg) => receivedVenus.push(msg));

      await bus.send({
        type: 'SHARE_FINDING',
        from: 'JUPITER' as AgentName,
        to: 'BROADCAST',
        subject: 'announcement',
        body: 'hello all',
        taskId: 'task-001',
        priority: 'medium',
        requiresResponse: false,
      });

      expect(receivedMars.length).toBe(1);
      expect(receivedVenus.length).toBe(1);
    });

    it('send() directed message only delivers to the named recipient, not others', async () => {
      const bus = getAgentMessageBus();
      const receivedMars: AgentMessage[] = [];
      const receivedVenus: AgentMessage[] = [];
      
      bus.subscribe('MARS' as AgentName, async (msg) => receivedMars.push(msg));
      bus.subscribe('VENUS' as AgentName, async (msg) => receivedVenus.push(msg));

      await bus.send({
        type: 'SHARE_FINDING',
        from: 'JUPITER' as AgentName,
        to: 'VENUS' as AgentName,
        subject: 'private',
        body: 'for venus only',
        taskId: 'task-001',
        priority: 'medium',
        requiresResponse: false,
      });

      expect(receivedMars.length).toBe(0);
      expect(receivedVenus.length).toBe(1);
    });
  });

  describe('Subscription', () => {
    it('subscribe() returns an unsubscribe function that removes the handler', async () => {
      const bus = getAgentMessageBus();
      const received: AgentMessage[] = [];
      
      const unsubscribe = bus.subscribe('VENUS' as AgentName, async (msg) => {
        received.push(msg);
      });

      // Unsubscribe
      unsubscribe();

      await bus.send({
        type: 'SHARE_FINDING',
        from: 'MARS' as AgentName,
        to: 'VENUS' as AgentName,
        subject: 'test',
        body: 'test',
        taskId: 'task-001',
        priority: 'medium',
        requiresResponse: false,
      });

      expect(received.length).toBe(0);
    });

    it('calling the unsubscribe function stops message delivery', async () => {
      const bus = getAgentMessageBus();
      const received: AgentMessage[] = [];
      
      const unsubscribe = bus.subscribe('VENUS' as AgentName, async (msg) => {
        received.push(msg);
      });

      // Send before unsubscribe
      await bus.send({
        type: 'SHARE_FINDING',
        from: 'MARS' as AgentName,
        to: 'VENUS' as AgentName,
        subject: 'test',
        body: 'first',
        taskId: 'task-001',
        priority: 'medium',
        requiresResponse: false,
      });

      expect(received.length).toBe(1);

      // Unsubscribe
      unsubscribe();

      // Send after unsubscribe
      await bus.send({
        type: 'SHARE_FINDING',
        from: 'MARS' as AgentName,
        to: 'VENUS' as AgentName,
        subject: 'test',
        body: 'second',
        taskId: 'task-001',
        priority: 'medium',
        requiresResponse: false,
      });

      // Should still only have 1 message
      expect(received.length).toBe(1);
    });
  });

  describe('Threading', () => {
    it('getThread() returns root message + all reply messages in chronological order', async () => {
      const bus = getAgentMessageBus();
      
      const root = await bus.send({
        type: 'PROPOSE',
        from: 'MARS' as AgentName,
        to: 'VENUS' as AgentName,
        subject: 'proposal',
        body: 'original',
        taskId: 'task-001',
        priority: 'medium',
        requiresResponse: true,
      });

      const reply = await bus.send({
        type: 'COUNTER',
        from: 'VENUS' as AgentName,
        to: 'MARS' as AgentName,
        subject: 're: proposal',
        body: 'counter',
        replyToId: root.id,
        taskId: 'task-001',
        priority: 'medium',
        requiresResponse: true,
      });

      const thread = bus.getThread(root.id);
      expect(thread.length).toBe(2);
      expect(thread[0].id).toBe(root.id);
      expect(thread[1].id).toBe(reply.id);
    });

    it('getThread() returns only the root if no replies exist', async () => {
      const bus = getAgentMessageBus();
      
      const root = await bus.send({
        type: 'SHARE_FINDING',
        from: 'MARS' as AgentName,
        to: 'VENUS' as AgentName,
        subject: 'solo',
        body: 'standalone',
        taskId: 'task-001',
        priority: 'medium',
        requiresResponse: false,
      });

      const thread = bus.getThread(root.id);
      expect(thread.length).toBe(1);
      expect(thread[0].id).toBe(root.id);
    });
  });

  describe('Inbox', () => {
    it('getInbox() returns messages for the specified agent, newest first', async () => {
      const bus = getAgentMessageBus();
      
      await bus.send({
        type: 'SHARE_FINDING',
        from: 'MARS' as AgentName,
        to: 'VENUS' as AgentName,
        subject: 'first',
        body: 'first',
        taskId: 'task-001',
        priority: 'medium',
        requiresResponse: false,
      });

      // Small delay to ensure different timestamps
      await new Promise(r => setTimeout(r, 10));

      await bus.send({
        type: 'SHARE_FINDING',
        from: 'MARS' as AgentName,
        to: 'VENUS' as AgentName,
        subject: 'second',
        body: 'second',
        taskId: 'task-001',
        priority: 'medium',
        requiresResponse: false,
      });

      const inbox = bus.getInbox('VENUS' as AgentName);
      expect(inbox.length).toBe(2);
      expect(inbox[0].subject).toBe('second'); // Newest first
      expect(inbox[1].subject).toBe('first');
    });

    it('getInbox() with taskId filter returns only messages for that task', async () => {
      const bus = getAgentMessageBus();
      
      await bus.send({
        type: 'SHARE_FINDING',
        from: 'MARS' as AgentName,
        to: 'VENUS' as AgentName,
        subject: 'task1',
        body: 'task1',
        taskId: 'task-001',
        priority: 'medium',
        requiresResponse: false,
      });

      await bus.send({
        type: 'SHARE_FINDING',
        from: 'MARS' as AgentName,
        to: 'VENUS' as AgentName,
        subject: 'task2',
        body: 'task2',
        taskId: 'task-002',
        priority: 'medium',
        requiresResponse: false,
      });

      const inbox = bus.getInbox('VENUS' as AgentName, 'task-001');
      expect(inbox.length).toBe(1);
      expect(inbox[0].subject).toBe('task1');
    });
  });

  describe('Read tracking', () => {
    it('markRead() sets readAt on the message', async () => {
      const bus = getAgentMessageBus();
      
      const msg = await bus.send({
        type: 'SHARE_FINDING',
        from: 'MARS' as AgentName,
        to: 'VENUS' as AgentName,
        subject: 'test',
        body: 'test',
        taskId: 'task-001',
        priority: 'medium',
        requiresResponse: false,
      });

      expect(msg.readAt).toBeUndefined();

      bus.markRead(msg.id, 'VENUS' as AgentName);
      
      const updated = bus.getMessage(msg.id);
      expect(updated?.readAt).toBeDefined();
    });

    it('getUnread() returns only messages where readAt is undefined', async () => {
      const bus = getAgentMessageBus();
      
      const msg1 = await bus.send({
        type: 'SHARE_FINDING',
        from: 'MARS' as AgentName,
        to: 'VENUS' as AgentName,
        subject: 'unread',
        body: 'unread',
        taskId: 'task-001',
        priority: 'medium',
        requiresResponse: false,
      });

      const msg2 = await bus.send({
        type: 'SHARE_FINDING',
        from: 'MARS' as AgentName,
        to: 'VENUS' as AgentName,
        subject: 'read',
        body: 'read',
        taskId: 'task-001',
        priority: 'medium',
        requiresResponse: false,
      });

      bus.markRead(msg2.id, 'VENUS' as AgentName);

      const unread = bus.getUnread('VENUS' as AgentName, 'task-001');
      expect(unread.length).toBe(1);
      expect(unread[0].subject).toBe('unread');
    });
  });

  describe('Cleanup', () => {
    it('clearTask() removes all messages for the given taskId', async () => {
      const bus = getAgentMessageBus();
      
      await bus.send({
        type: 'SHARE_FINDING',
        from: 'MARS' as AgentName,
        to: 'VENUS' as AgentName,
        subject: 'task1',
        body: 'task1',
        taskId: 'task-001',
        priority: 'medium',
        requiresResponse: false,
      });

      await bus.send({
        type: 'SHARE_FINDING',
        from: 'MARS' as AgentName,
        to: 'VENUS' as AgentName,
        subject: 'task2',
        body: 'task2',
        taskId: 'task-002',
        priority: 'medium',
        requiresResponse: false,
      });

      bus.clearTask('task-001');

      const inbox1 = bus.getInbox('VENUS' as AgentName, 'task-001');
      const inbox2 = bus.getInbox('VENUS' as AgentName, 'task-002');

      expect(inbox1.length).toBe(0);
      expect(inbox2.length).toBe(1);
    });
  });
});

describe('NegotiationProtocol', () => {
  beforeEach(() => {
    resetAgentMessageBus();
    resetNegotiationProtocol();
  });

  it('openNegotiation() creates a session with status open and sends a PROPOSE message', async () => {
    const protocol = getNegotiationProtocol();
    
    const session = await protocol.openNegotiation(
      'task-001',
      'MARS' as AgentName,
      'VENUS' as AgentName,
      'auth approach',
      'use JWT'
    );

    expect(session.status).toBe('open');
    expect(session.initiator).toBe('MARS');
    expect(session.respondent).toBe('VENUS');
    expect(session.messageIds.length).toBe(1);
  });

  it('respondToNegotiation() sets respondentPosition and sends a COUNTER message', async () => {
    const protocol = getNegotiationProtocol();
    
    const session = await protocol.openNegotiation(
      'task-001',
      'MARS' as AgentName,
      'VENUS' as AgentName,
      'auth approach',
      'use JWT'
    );

    const updated = await protocol.respondToNegotiation(session.id, 'use sessions');

    expect(updated.respondentPosition).toBe('use sessions');
    expect(updated.messageIds.length).toBe(2);
  });

  it('resolve() sets status agreed and sends an AGREE message', async () => {
    const protocol = getNegotiationProtocol();
    
    const session = await protocol.openNegotiation(
      'task-001',
      'MARS' as AgentName,
      'VENUS' as AgentName,
      'auth approach',
      'use JWT'
    );

    const resolved = await protocol.resolve(session.id, 'use JWT with refresh', 'auto');

    expect(resolved.status).toBe('agreed');
    expect(resolved.resolution).toBe('use JWT with refresh');
    expect(resolved.resolvedBy).toBe('auto');
  });

  it('escalate() sets status escalated and sends an ESCALATE to JUPITER', async () => {
    const protocol = getNegotiationProtocol();
    
    const session = await protocol.openNegotiation(
      'task-001',
      'MARS' as AgentName,
      'VENUS' as AgentName,
      'auth approach',
      'use JWT'
    );

    const escalated = await protocol.escalate(session.id, 'cannot agree on approach');

    expect(escalated.status).toBe('escalated');
    expect(escalated.resolvedBy).toBe('JUPITER');
  });

  it('getOpenNegotiations() returns only open sessions for the taskId', async () => {
    const protocol = getNegotiationProtocol();
    
    await protocol.openNegotiation('task-001', 'MARS' as AgentName, 'VENUS' as AgentName, 'topic1', 'pos1');
    const session2 = await protocol.openNegotiation('task-001', 'MARS' as AgentName, 'VENUS' as AgentName, 'topic2', 'pos2');
    await protocol.resolve(session2.id, 'agreed', 'auto');

    const open = protocol.getOpenNegotiations('task-001');
    expect(open.length).toBe(1);
    expect(open[0].topic).toBe('topic1');
  });

  it('shouldTriggerNegotiation() returns true when confidence < 0.65 and peer has expertise', () => {
    const protocol = getNegotiationProtocol();
    
    expect(protocol.shouldTriggerNegotiation(0.5, true)).toBe(true);
    expect(protocol.shouldTriggerNegotiation(0.7, true)).toBe(false);
    expect(protocol.shouldTriggerNegotiation(0.5, false)).toBe(false);
  });

  it('shouldTriggerNegotiation() returns false when confidence >= 0.65', () => {
    const protocol = getNegotiationProtocol();
    
    expect(protocol.shouldTriggerNegotiation(0.65, true)).toBe(false);
    expect(protocol.shouldTriggerNegotiation(0.9, true)).toBe(false);
  });
});

describe('SharedBlackboard', () => {
  beforeEach(() => {
    resetSharedBlackboard();
  });

  it('write() stores an entry and returns it with id and writtenAt set', () => {
    const bb = getSharedBlackboard();
    
    const entry = bb.write('key1', 'value1', 'MARS' as AgentName, 'task-001');

    expect(entry.id).toBeDefined();
    expect(entry.writtenAt).toBeDefined();
    expect(entry.key).toBe('key1');
    expect(entry.value).toBe('value1');
  });

  it('read() returns the most recent entry for key+taskId', async () => {
    const bb = getSharedBlackboard();
    
    bb.write('key1', 'first', 'MARS' as AgentName, 'task-001');
    
    // Small delay to ensure different timestamps
    await new Promise(r => setTimeout(r, 10));
    
    const entry2 = bb.write('key1', 'second', 'VENUS' as AgentName, 'task-001');

    const read = bb.read('key1', 'task-001');
    expect(read?.value).toBe('second');
    expect(read?.id).toBe(entry2.id);
  });

  it('read() returns null when no entry exists', () => {
    const bb = getSharedBlackboard();
    
    const read = bb.read('nonexistent', 'task-001');
    expect(read).toBeNull();
  });

  it('readAll() returns all entries for a taskId sorted by confidence', () => {
    const bb = getSharedBlackboard();
    
    bb.write('key1', 'low', 'MARS' as AgentName, 'task-001', { confidence: 0.5 });
    bb.write('key2', 'high', 'VENUS' as AgentName, 'task-001', { confidence: 0.9 });
    bb.write('key3', 'medium', 'PLUTO' as AgentName, 'task-001', { confidence: 0.7 });

    const all = bb.readAll('task-001');
    expect(all.length).toBe(3);
    expect(all[0].confidence).toBe(0.9); // Highest first
    expect(all[1].confidence).toBe(0.7);
    expect(all[2].confidence).toBe(0.5);
  });

  it('readAll() with tags filter returns only matching entries', () => {
    const bb = getSharedBlackboard();
    
    bb.write('key1', 'value1', 'MARS' as AgentName, 'task-001', { tags: ['auth'] });
    bb.write('key2', 'value2', 'VENUS' as AgentName, 'task-001', { tags: ['ui'] });
    bb.write('key3', 'value3', 'PLUTO' as AgentName, 'task-001', { tags: ['auth', 'security'] });

    const authEntries = bb.readAll('task-001', ['auth']);
    expect(authEntries.length).toBe(2);
  });

  it('supersede() creates a new entry linking back to the old one', () => {
    const bb = getSharedBlackboard();
    
    const oldEntry = bb.write('oldKey', 'oldValue', 'MARS' as AgentName, 'task-001');
    const newEntry = bb.supersede(oldEntry.id, 'newKey', 'newValue', 'VENUS' as AgentName);

    expect(newEntry.supersedes).toBe(oldEntry.id);
    expect(newEntry.key).toBe('newKey');
    expect(newEntry.value).toBe('newValue');
  });

  it('snapshot() returns a map of key -> entry for the taskId', () => {
    const bb = getSharedBlackboard();
    
    bb.write('key1', 'value1', 'MARS' as AgentName, 'task-001');
    bb.write('key2', 'value2', 'VENUS' as AgentName, 'task-001');
    bb.write('key3', 'other-task', 'PLUTO' as AgentName, 'task-002');

    const snapshot = bb.snapshot('task-001');
    expect(Object.keys(snapshot).length).toBe(2);
    expect(snapshot['key1'].value).toBe('value1');
    expect(snapshot['key2'].value).toBe('value2');
  });

  it('clear() removes all entries for the taskId', () => {
    const bb = getSharedBlackboard();
    
    bb.write('key1', 'value1', 'MARS' as AgentName, 'task-001');
    bb.write('key2', 'value2', 'VENUS' as AgentName, 'task-002');

    bb.clear('task-001');

    expect(bb.read('key1', 'task-001')).toBeNull();
    expect(bb.read('key2', 'task-002')).not.toBeNull();
  });

  it('formatForPrompt() produces a formatted string with HIGH/MEDIUM/LOW tiers', () => {
    const bb = getSharedBlackboard();
    
    bb.write('highConf', 'high value', 'MARS' as AgentName, 'task-001', { confidence: 0.95 });
    bb.write('medConf', 'med value', 'VENUS' as AgentName, 'task-001', { confidence: 0.75 });
    bb.write('lowConf', 'low value', 'PLUTO' as AgentName, 'task-001', { confidence: 0.5 });

    const formatted = bb.formatForPrompt('task-001');
    
    expect(formatted).toContain('Shared Team Context');
    expect(formatted).toContain('[HIGH CONFIDENCE]');
    expect(formatted).toContain('[MEDIUM]');
    expect(formatted).toContain('[LOW]');
  });

  it('formatForPrompt() truncates to approximately maxTokens', () => {
    const bb = getSharedBlackboard();
    
    // Create many entries to exceed token limit
    for (let i = 0; i < 20; i++) {
      bb.write(`key${i}`, 'a very long value that takes up space', 'MARS' as AgentName, 'task-001', { confidence: 0.9 });
    }

    const formatted = bb.formatForPrompt('task-001', 50); // 50 tokens = ~200 chars
    
    expect(formatted.length).toBeLessThan(300);
    expect(formatted).toContain('[truncated]');
  });
});
