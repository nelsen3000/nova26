import { describe, it, expect, beforeEach } from 'vitest';
import {
  createMessageBus,
  buildCommunicationContext,
  ask,
  answer,
  broadcast,
  warn,
  requestReview,
  statusUpdate,
  type MessageBus,
  type MessageType,
} from './protocol.js';

describe('MessageBus', () => {
  let bus: MessageBus;

  beforeEach(() => {
    bus = createMessageBus();
  });

  describe('post', () => {
    it('should post a message and return it with id and timestamp', () => {
      const msg = bus.post({
        type: 'question',
        from: 'EARTH',
        to: 'MARS',
        subject: 'Database schema',
        body: 'What fields does the user table need?',
        priority: 'normal',
      });

      expect(msg.id).toBeDefined();
      expect(msg.id).toMatch(/^msg_\d+_\d+$/);
      expect(msg.timestamp).toBeDefined();
      expect(msg.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(msg.type).toBe('question');
      expect(msg.from).toBe('EARTH');
      expect(msg.to).toBe('MARS');
    });

    it('should assign unique ids to multiple messages', () => {
      const msg1 = bus.post({
        type: 'question',
        from: 'EARTH',
        to: 'MARS',
        subject: 'Question 1',
        body: 'Body 1',
        priority: 'normal',
      });

      const msg2 = bus.post({
        type: 'discovery',
        from: 'JUPITER',
        to: '*',
        subject: 'Discovery 1',
        body: 'Body 2',
        priority: 'high',
      });

      expect(msg1.id).not.toBe(msg2.id);
      expect(msg2.priority).toBe('high');
    });
  });

  describe('getFor', () => {
    it('should retrieve messages sent directly to an agent', () => {
      bus.post({
        type: 'question',
        from: 'EARTH',
        to: 'MARS',
        subject: 'Schema question',
        body: 'What fields?',
        priority: 'normal',
      });

      const messages = bus.getFor('MARS');
      expect(messages).toHaveLength(1);
      expect(messages[0].from).toBe('EARTH');
      expect(messages[0].subject).toBe('Schema question');
    });

    it('should include broadcast messages for any agent', () => {
      bus.post({
        type: 'discovery',
        from: 'JUPITER',
        to: '*',
        subject: 'PostgreSQL recommendation',
        body: 'We should use PostgreSQL',
        priority: 'high',
      });

      const marsMessages = bus.getFor('MARS');
      const earthMessages = bus.getFor('EARTH');

      expect(marsMessages).toHaveLength(1);
      expect(earthMessages).toHaveLength(1);
      expect(marsMessages[0].type).toBe('discovery');
    });

    it('should include messages sent by the agent', () => {
      bus.post({
        type: 'question',
        from: 'EARTH',
        to: 'MARS',
        subject: 'Question',
        body: 'Body',
        priority: 'normal',
      });

      const earthMessages = bus.getFor('EARTH');
      expect(earthMessages).toHaveLength(1);
      expect(earthMessages[0].from).toBe('EARTH');
    });

    it('should return empty array when no messages exist', () => {
      const messages = bus.getFor('VENUS');
      expect(messages).toEqual([]);
    });

    it('should filter by minimum priority', () => {
      bus.post({
        type: 'status_update',
        from: 'MERCURY',
        to: '*',
        subject: 'Starting work',
        body: 'Working on it',
        priority: 'low',
      });

      bus.post({
        type: 'warning',
        from: 'MERCURY',
        to: '*',
        subject: 'Type mismatch',
        body: 'Found an issue',
        priority: 'high',
      });

      bus.post({
        type: 'discovery',
        from: 'MERCURY',
        to: '*',
        subject: 'Critical bug',
        body: 'Critical issue found',
        priority: 'critical',
      });

      const allMessages = bus.getFor('EARTH');
      expect(allMessages).toHaveLength(3);

      const highAndAbove = bus.getFor('EARTH', 'high');
      expect(highAndAbove).toHaveLength(2);
      expect(highAndAbove.every(m => ['high', 'critical'].includes(m.priority))).toBe(true);

      const criticalOnly = bus.getFor('EARTH', 'critical');
      expect(criticalOnly).toHaveLength(1);
      expect(criticalOnly[0].priority).toBe('critical');
    });
  });

  describe('getThread', () => {
    it('should retrieve a conversation thread', () => {
      const question = bus.post({
        type: 'question',
        from: 'EARTH',
        to: 'MARS',
        subject: 'Database schema',
        body: 'What fields?',
        priority: 'normal',
      });

      const answer = bus.post({
        type: 'answer',
        from: 'MARS',
        to: 'EARTH',
        subject: 'Re: Database schema',
        body: 'User needs id, name, email',
        replyTo: question.id,
        priority: 'normal',
      });

      const thread = bus.getThread(question.id);
      expect(thread).toHaveLength(2);
      expect(thread.map(m => m.id)).toContain(question.id);
      expect(thread.map(m => m.id)).toContain(answer.id);
    });

    it('should return empty array for non-existent message', () => {
      const thread = bus.getThread('non-existent-id');
      expect(thread).toEqual([]);
    });

    it('should include parent message when getting thread for a reply', () => {
      const question = bus.post({
        type: 'question',
        from: 'EARTH',
        to: 'MARS',
        subject: 'Schema',
        body: 'Question?',
        priority: 'normal',
      });

      const reply = bus.post({
        type: 'answer',
        from: 'MARS',
        to: 'EARTH',
        subject: 'Re: Schema',
        body: 'Answer!',
        replyTo: question.id,
        priority: 'normal',
      });

      const thread = bus.getThread(reply.id);
      expect(thread).toHaveLength(2);
      expect(thread[0].id).toBe(question.id); // Parent first
      expect(thread[1].id).toBe(reply.id);
    });

    it('should sort thread by timestamp', () => {
      const msg1 = bus.post({
        type: 'question',
        from: 'EARTH',
        to: 'MARS',
        subject: 'First',
        body: 'Body',
        priority: 'normal',
      });

      bus.post({
        type: 'answer',
        from: 'MARS',
        to: 'EARTH',
        subject: 'Reply',
        body: 'Reply body',
        replyTo: msg1.id,
        priority: 'normal',
      });

      const thread = bus.getThread(msg1.id);
      expect(new Date(thread[0].timestamp).getTime()).toBeLessThanOrEqual(
        new Date(thread[1].timestamp).getTime()
      );
    });
  });

  describe('getBroadcasts', () => {
    it('should retrieve only broadcast messages', () => {
      bus.post({
        type: 'discovery',
        from: 'JUPITER',
        to: '*',
        subject: 'Discovery 1',
        body: 'Body',
        priority: 'normal',
      });

      bus.post({
        type: 'question',
        from: 'EARTH',
        to: 'MARS',
        subject: 'Direct question',
        body: 'Body',
        priority: 'normal',
      });

      bus.post({
        type: 'warning',
        from: 'SATURN',
        to: '*',
        subject: 'Warning all',
        body: 'Body',
        priority: 'high',
      });

      const broadcasts = bus.getBroadcasts();
      expect(broadcasts).toHaveLength(2);
      expect(broadcasts.every(m => m.to === '*')).toBe(true);
    });

    it('should filter broadcasts by priority', () => {
      bus.post({
        type: 'status_update',
        from: 'MERCURY',
        to: '*',
        subject: 'Update',
        body: 'Body',
        priority: 'low',
      });

      bus.post({
        type: 'discovery',
        from: 'JUPITER',
        to: '*',
        subject: 'Important discovery',
        body: 'Body',
        priority: 'critical',
      });

      const highPriority = bus.getBroadcasts('high');
      expect(highPriority).toHaveLength(1);
      expect(highPriority[0].priority).toBe('critical');
    });
  });

  describe('getAll', () => {
    it('should retrieve all messages', () => {
      bus.post({
        type: 'discovery',
        from: 'JUPITER',
        to: '*',
        subject: 'Broadcast',
        body: 'Body',
        priority: 'normal',
      });

      bus.post({
        type: 'question',
        from: 'EARTH',
        to: 'MARS',
        subject: 'Direct',
        body: 'Body',
        priority: 'normal',
      });

      const all = bus.getAll();
      expect(all).toHaveLength(2);
    });

    it('should filter all messages by priority', () => {
      bus.post({
        type: 'status_update',
        from: 'MERCURY',
        to: '*',
        subject: 'Update',
        body: 'Body',
        priority: 'low',
      });

      bus.post({
        type: 'warning',
        from: 'MERCURY',
        to: 'EARTH',
        subject: 'Warning',
        body: 'Body',
        priority: 'high',
      });

      bus.post({
        type: 'discovery',
        from: 'JUPITER',
        to: '*',
        subject: 'Discovery',
        body: 'Body',
        priority: 'critical',
      });

      const highAndAbove = bus.getAll('high');
      expect(highAndAbove).toHaveLength(2);
    });
  });

  describe('clear', () => {
    it('should remove all messages', () => {
      bus.post({
        type: 'discovery',
        from: 'JUPITER',
        to: '*',
        subject: 'Discovery',
        body: 'Body',
        priority: 'normal',
      });

      bus.post({
        type: 'question',
        from: 'EARTH',
        to: 'MARS',
        subject: 'Question',
        body: 'Body',
        priority: 'normal',
      });

      expect(bus.getAll()).toHaveLength(2);

      bus.clear();

      expect(bus.getAll()).toHaveLength(0);
      expect(bus.getFor('EARTH')).toHaveLength(0);
      expect(bus.getFor('MARS')).toHaveLength(0);
      expect(bus.getBroadcasts()).toHaveLength(0);
    });

    it('should allow posting after clear', () => {
      bus.post({
        type: 'discovery',
        from: 'JUPITER',
        to: '*',
        subject: 'First',
        body: 'Body',
        priority: 'normal',
      });

      bus.clear();

      bus.post({
        type: 'warning',
        from: 'MERCURY',
        to: '*',
        subject: 'Second',
        body: 'Body',
        priority: 'high',
      });

      expect(bus.getAll()).toHaveLength(1);
      expect(bus.getAll()[0].subject).toBe('Second');
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', () => {
      bus.post({ type: 'question', from: 'EARTH', to: 'MARS', subject: 'Q1', body: 'B', priority: 'normal' });
      bus.post({ type: 'question', from: 'MARS', to: 'EARTH', subject: 'Q2', body: 'B', priority: 'high' });
      bus.post({ type: 'discovery', from: 'JUPITER', to: '*', subject: 'D1', body: 'B', priority: 'critical' });
      bus.post({ type: 'discovery', from: 'JUPITER', to: '*', subject: 'D2', body: 'B', priority: 'low' });
      bus.post({ type: 'warning', from: 'MERCURY', to: 'EARTH', subject: 'W1', body: 'B', priority: 'high' });

      const stats = bus.getStats();

      expect(stats.total).toBe(5);
      expect(stats.byType.question).toBe(2);
      expect(stats.byType.discovery).toBe(2);
      expect(stats.byType.warning).toBe(1);
      expect(stats.byType.answer).toBe(0);
      expect(stats.byPriority.normal).toBe(1);
      expect(stats.byPriority.high).toBe(2);
      expect(stats.byPriority.critical).toBe(1);
      expect(stats.byPriority.low).toBe(1);
      expect(stats.broadcasts).toBe(2);
    });

    it('should return zero stats for empty bus', () => {
      const stats = bus.getStats();

      expect(stats.total).toBe(0);
      expect(stats.broadcasts).toBe(0);
      expect(Object.values(stats.byType).every(v => v === 0)).toBe(true);
      expect(Object.values(stats.byPriority).every(v => v === 0)).toBe(true);
    });
  });
});

describe('buildCommunicationContext', () => {
  let bus: MessageBus;

  beforeEach(() => {
    bus = createMessageBus();
  });

  it('should return empty string when no messages', () => {
    const context = buildCommunicationContext(bus, 'EARTH');
    expect(context).toBe('');
  });

  it('should format messages correctly', () => {
    bus.post({
      type: 'question',
      from: 'EARTH',
      to: 'MARS',
      subject: 'What fields does the user table need?',
      body: 'Full question body',
      priority: 'normal',
    });

    bus.post({
      type: 'discovery',
      from: 'JUPITER',
      to: '*',
      subject: 'We should use PostgreSQL for this project',
      body: 'Full discovery body',
      priority: 'high',
    });

    bus.post({
      type: 'warning',
      from: 'MERCURY',
      to: 'MARS',
      subject: 'Type mismatch detected in schema',
      body: 'Full warning body',
      priority: 'critical',
    });

    const context = buildCommunicationContext(bus, 'MARS');

    expect(context).toContain('## Messages for you:');
    expect(context).toContain('EARTH → MARS: What fields does the user table need?');
    expect(context).toContain('JUPITER broadcasts discovery: We should use PostgreSQL for this project');
    expect(context).toContain('MERCURY → MARS: Type mismatch detected in schema');
  });

  it('should include emojis for different message types', () => {
    bus.post({
      type: 'question',
      from: 'EARTH',
      to: 'MARS',
      subject: 'Question',
      body: 'Body',
      priority: 'normal',
    });

    bus.post({
      type: 'discovery',
      from: 'JUPITER',
      to: '*',
      subject: 'Discovery',
      body: 'Body',
      priority: 'normal',
    });

    bus.post({
      type: 'warning',
      from: 'MERCURY',
      to: 'MARS',
      subject: 'Warning',
      body: 'Body',
      priority: 'normal',
    });

    const context = buildCommunicationContext(bus, 'MARS');

    expect(context).toContain('❓');
    expect(context).toContain('💡');
    expect(context).toContain('⚠️');
  });

  it('should sort by priority (critical first)', () => {
    bus.post({
      type: 'status_update',
      from: 'AGENT1',
      to: 'MARS',
      subject: 'Low priority',
      body: 'Body',
      priority: 'low',
    });

    bus.post({
      type: 'warning',
      from: 'AGENT2',
      to: 'MARS',
      subject: 'Critical priority',
      body: 'Body',
      priority: 'critical',
    });

    bus.post({
      type: 'discovery',
      from: 'AGENT3',
      to: 'MARS',
      subject: 'Normal priority',
      body: 'Body',
      priority: 'normal',
    });

    const context = buildCommunicationContext(bus, 'MARS');
    const lines = context.split('\n').filter(line => line.startsWith('-'));

    expect(lines[0]).toContain('Critical priority');
    expect(lines[1]).toContain('Normal priority');
    expect(lines[2]).toContain('Low priority');
  });

  it('should not include messages for other agents', () => {
    bus.post({
      type: 'question',
      from: 'EARTH',
      to: 'VENUS',
      subject: 'For Venus',
      body: 'Body',
      priority: 'normal',
    });

    bus.post({
      type: 'discovery',
      from: 'JUPITER',
      to: '*',
      subject: 'For everyone',
      body: 'Body',
      priority: 'normal',
    });

    const marsContext = buildCommunicationContext(bus, 'MARS');
    expect(marsContext).not.toContain('For Venus');
    expect(marsContext).toContain('For everyone');

    const venusContext = buildCommunicationContext(bus, 'VENUS');
    expect(venusContext).toContain('For Venus');
    expect(venusContext).toContain('For everyone');
  });

  it('should indicate replies in context', () => {
    const question = bus.post({
      type: 'question',
      from: 'EARTH',
      to: 'MARS',
      subject: 'Original question',
      body: 'Body',
      priority: 'normal',
    });

    bus.post({
      type: 'answer',
      from: 'MARS',
      to: 'EARTH',
      subject: 'Here is the answer',
      body: 'Body',
      replyTo: question.id,
      priority: 'normal',
    });

    const earthContext = buildCommunicationContext(bus, 'EARTH');
    expect(earthContext).toContain('MARS replies to EARTH');
  });
});

describe('helper functions', () => {
  let bus: MessageBus;

  beforeEach(() => {
    bus = createMessageBus();
  });

  describe('ask', () => {
    it('should create a question message', () => {
      const msg = ask(bus, 'EARTH', 'MARS', 'Schema question', 'What fields?', 'high');

      expect(msg.type).toBe('question');
      expect(msg.from).toBe('EARTH');
      expect(msg.to).toBe('MARS');
      expect(msg.subject).toBe('Schema question');
      expect(msg.body).toBe('What fields?');
      expect(msg.priority).toBe('high');
    });

    it('should use default priority', () => {
      const msg = ask(bus, 'EARTH', 'MARS', 'Subject', 'Body');
      expect(msg.priority).toBe('normal');
    });
  });

  describe('answer', () => {
    it('should create an answer message with replyTo', () => {
      const questionId = 'msg_123_1';
      const msg = answer(bus, 'MARS', 'EARTH', questionId, 'The answer', 'Here it is', 'normal');

      expect(msg.type).toBe('answer');
      expect(msg.from).toBe('MARS');
      expect(msg.to).toBe('EARTH');
      expect(msg.replyTo).toBe(questionId);
      expect(msg.subject).toBe('The answer');
    });
  });

  describe('broadcast', () => {
    it('should create a discovery broadcast', () => {
      const msg = broadcast(bus, 'JUPITER', 'New discovery', 'Found something important', 'high');

      expect(msg.type).toBe('discovery');
      expect(msg.from).toBe('JUPITER');
      expect(msg.to).toBe('*');
      expect(msg.subject).toBe('New discovery');
      expect(msg.priority).toBe('high');
    });

    it('should use default priority', () => {
      const msg = broadcast(bus, 'JUPITER', 'Subject', 'Body');
      expect(msg.priority).toBe('normal');
    });
  });

  describe('warn', () => {
    it('should create a warning message', () => {
      const msg = warn(bus, 'MERCURY', 'EARTH', 'Type error', 'Found a type mismatch', 'critical');

      expect(msg.type).toBe('warning');
      expect(msg.from).toBe('MERCURY');
      expect(msg.to).toBe('EARTH');
      expect(msg.priority).toBe('critical');
    });

    it('should default to high priority', () => {
      const msg = warn(bus, 'MERCURY', 'EARTH', 'Subject', 'Body');
      expect(msg.priority).toBe('high');
    });
  });

  describe('requestReview', () => {
    it('should create a review request', () => {
      const msg = requestReview(bus, 'EARTH', 'VENUS', 'Review my code', 'Please check this', 'high');

      expect(msg.type).toBe('review_request');
      expect(msg.from).toBe('EARTH');
      expect(msg.to).toBe('VENUS');
      expect(msg.priority).toBe('high');
    });
  });

  describe('statusUpdate', () => {
    it('should create a status update broadcast', () => {
      const msg = statusUpdate(bus, 'MARS', '50% complete', 'Working on feature X');

      expect(msg.type).toBe('status_update');
      expect(msg.from).toBe('MARS');
      expect(msg.to).toBe('*');
      expect(msg.subject).toBe('50% complete');
      expect(msg.priority).toBe('low');
    });
  });
});

describe('all message types', () => {
  let bus: MessageBus;

  beforeEach(() => {
    bus = createMessageBus();
  });

  it('should support all message types', () => {
    const types: MessageType[] = [
      'question',
      'answer',
      'discovery',
      'dependency',
      'review_request',
      'review_result',
      'warning',
      'status_update',
    ];

    for (const type of types) {
      const msg = bus.post({
        type,
        from: 'TESTER',
        to: 'RECEIVER',
        subject: `Test ${type}`,
        body: 'Test body',
        priority: 'normal',
      });

      expect(msg.type).toBe(type);
    }

    const stats = bus.getStats();
    expect(stats.total).toBe(types.length);
    for (const type of types) {
      expect(stats.byType[type]).toBe(1);
    }
  });
});
