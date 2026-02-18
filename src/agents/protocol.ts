// Agent Communication Protocol - Structured message-passing system for agent communication

/**
 * Message types supported by the agent communication protocol
 */
export type MessageType =
  | 'question'       // Agent asks another agent something
  | 'answer'         // Response to a question
  | 'discovery'      // Agent found something useful (broadcast)
  | 'dependency'     // "I need X from agent Y before I can continue"
  | 'review_request' // "Agent Y, please review my output"
  | 'review_result'  // Response to review request
  | 'warning'        // "I found a potential issue"
  | 'status_update'; // "I'm 50% done"

/**
 * Priority levels for messages
 */
export type MessagePriority = 'low' | 'normal' | 'high' | 'critical';

/**
 * Core message structure for agent communication
 */
export interface AgentMessage {
  id: string;
  type: MessageType;
  from: string;              // sender agent name
  to: string | '*';          // recipient or broadcast
  subject: string;           // short description
  body: string;              // full content
  replyTo?: string;          // id of message being replied to
  priority: MessagePriority;
  timestamp: string;
}

/**
 * Message bus interface for agent communication
 */
export interface MessageBus {
  /**
   * Post a new message to the bus
   * @param msg - Message data (id and timestamp will be auto-generated)
   * @returns The complete message with generated id and timestamp
   */
  post(msg: Omit<AgentMessage, 'id' | 'timestamp'>): AgentMessage;

  /**
   * Get all messages for a specific agent (direct + broadcasts)
   * @param agent - Agent name to get messages for
   * @param minPriority - Optional minimum priority filter
   * @returns Array of messages for the agent
   */
  getFor(agent: string, minPriority?: MessagePriority): AgentMessage[];

  /**
   * Get a conversation thread starting from a message
   * @param messageId - ID of the message to start from
   * @returns Array of messages in the thread (original + replies)
   */
  getThread(messageId: string): AgentMessage[];

  /**
   * Get all broadcast messages
   * @param minPriority - Optional minimum priority filter
   * @returns Array of broadcast messages
   */
  getBroadcasts(minPriority?: MessagePriority): AgentMessage[];

  /**
   * Get all messages in the bus
   * @param minPriority - Optional minimum priority filter
   * @returns Array of all messages
   */
  getAll(minPriority?: MessagePriority): AgentMessage[];

  /**
   * Clear all messages from the bus
   */
  clear(): void;

  /**
   * Get message count statistics
   * @returns Object with counts by type and priority
   */
  getStats(): MessageStats;
}

/**
 * Statistics for messages in the bus
 */
export interface MessageStats {
  total: number;
  byType: Record<MessageType, number>;
  byPriority: Record<MessagePriority, number>;
  broadcasts: number;
}

/**
 * Priority values for filtering (higher = more important)
 */
const PRIORITY_VALUES: Record<MessagePriority, number> = {
  low: 1,
  normal: 2,
  high: 3,
  critical: 4,
};

/**
 * Generate a unique message ID
 */
let messageIdCounter = 0;
function generateMessageId(): string {
  messageIdCounter++;
  return `msg_${Date.now()}_${messageIdCounter}`;
}

/**
 * Check if a message meets the minimum priority threshold
 */
function meetsPriority(message: AgentMessage, minPriority?: MessagePriority): boolean {
  if (!minPriority) return true;
  return PRIORITY_VALUES[message.priority] >= PRIORITY_VALUES[minPriority];
}

/**
 * Format a single message for communication context display
 */
function formatMessageForContext(msg: AgentMessage): string {
  const typeEmojis: Record<MessageType, string> = {
    question: '❓',
    answer: '✅',
    discovery: '💡',
    dependency: '🔗',
    review_request: '👀',
    review_result: '📝',
    warning: '⚠️',
    status_update: '📊',
  };

  const emoji = typeEmojis[msg.type];
  
  // For broadcasts, show differently
  if (msg.to === '*') {
    return `${emoji} ${msg.from} broadcasts ${msg.type}: ${msg.subject}`;
  }
  
  // For direct messages
  if (msg.replyTo) {
    return `${emoji} ${msg.from} replies to ${msg.to}: ${msg.subject}`;
  }
  
  return `${emoji} ${msg.from} → ${msg.to}: ${msg.subject}`;
}

/**
 * Create an in-memory message bus for agent communication
 * @returns MessageBus implementation
 */
export function createMessageBus(): MessageBus {
  const messages: AgentMessage[] = [];

  return {
    post(msg: Omit<AgentMessage, 'id' | 'timestamp'>): AgentMessage {
      const fullMessage: AgentMessage = {
        ...msg,
        id: generateMessageId(),
        timestamp: new Date().toISOString(),
      };
      messages.push(fullMessage);
      return fullMessage;
    },

    getFor(agent: string, minPriority?: MessagePriority): AgentMessage[] {
      return messages.filter(
        msg => 
          (msg.to === agent || msg.to === '*' || msg.from === agent) &&
          meetsPriority(msg, minPriority)
      );
    },

    getThread(messageId: string): AgentMessage[] {
      // Find the root message
      const rootMessage = messages.find(msg => msg.id === messageId);
      if (!rootMessage) return [];

      // Find all messages in the thread (original + replies)
      const threadMessages: AgentMessage[] = [rootMessage];
      
      // Find direct replies to this message
      const replies = messages.filter(msg => msg.replyTo === messageId);
      threadMessages.push(...replies);

      // Find the message this one replies to (if any)
      if (rootMessage.replyTo) {
        const parent = messages.find(msg => msg.id === rootMessage.replyTo);
        if (parent && !threadMessages.includes(parent)) {
          threadMessages.unshift(parent);
        }
      }

      // Sort by timestamp
      return threadMessages.sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
    },

    getBroadcasts(minPriority?: MessagePriority): AgentMessage[] {
      return messages.filter(
        msg => msg.to === '*' && meetsPriority(msg, minPriority)
      );
    },

    getAll(minPriority?: MessagePriority): AgentMessage[] {
      return messages.filter(msg => meetsPriority(msg, minPriority));
    },

    clear(): void {
      messages.length = 0;
    },

    getStats(): MessageStats {
      const stats: MessageStats = {
        total: messages.length,
        byType: {
          question: 0,
          answer: 0,
          discovery: 0,
          dependency: 0,
          review_request: 0,
          review_result: 0,
          warning: 0,
          status_update: 0,
        },
        byPriority: {
          low: 0,
          normal: 0,
          high: 0,
          critical: 0,
        },
        broadcasts: 0,
      };

      for (const msg of messages) {
        stats.byType[msg.type]++;
        stats.byPriority[msg.priority]++;
        if (msg.to === '*') {
          stats.broadcasts++;
        }
      }

      return stats;
    },
  };
}

/**
 * Build a communication context section for an agent's prompt
 * @param bus - The message bus
 * @param agent - The agent name to build context for
 * @returns Formatted communication context string
 */
export function buildCommunicationContext(bus: MessageBus, agent: string): string {
  const messages = bus.getFor(agent);
  
  if (messages.length === 0) {
    return '';
  }

  // Sort by priority (critical first) then timestamp
  const sortedMessages = [...messages].sort((a, b) => {
    const priorityDiff = PRIORITY_VALUES[b.priority] - PRIORITY_VALUES[a.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
  });

  const formattedMessages = sortedMessages.map(formatMessageForContext);
  
  return `## Messages for you:
${formattedMessages.map(m => `- ${m}`).join('\n')}

`;
}

/**
 * Helper to create a question message
 */
export function ask(
  bus: MessageBus,
  from: string,
  to: string,
  subject: string,
  body: string,
  priority: MessagePriority = 'normal'
): AgentMessage {
  return bus.post({
    type: 'question',
    from,
    to,
    subject,
    body,
    priority,
  });
}

/**
 * Helper to answer a question
 */
export function answer(
  bus: MessageBus,
  from: string,
  to: string,
  questionId: string,
  subject: string,
  body: string,
  priority: MessagePriority = 'normal'
): AgentMessage {
  return bus.post({
    type: 'answer',
    from,
    to,
    subject,
    body,
    replyTo: questionId,
    priority,
  });
}

/**
 * Helper to broadcast a discovery
 */
export function broadcast(
  bus: MessageBus,
  from: string,
  subject: string,
  body: string,
  priority: MessagePriority = 'normal'
): AgentMessage {
  return bus.post({
    type: 'discovery',
    from,
    to: '*',
    subject,
    body,
    priority,
  });
}

/**
 * Helper to send a warning
 */
export function warn(
  bus: MessageBus,
  from: string,
  to: string,
  subject: string,
  body: string,
  priority: MessagePriority = 'high'
): AgentMessage {
  return bus.post({
    type: 'warning',
    from,
    to,
    subject,
    body,
    priority,
  });
}

/**
 * Helper to request a review
 */
export function requestReview(
  bus: MessageBus,
  from: string,
  to: string,
  subject: string,
  body: string,
  priority: MessagePriority = 'normal'
): AgentMessage {
  return bus.post({
    type: 'review_request',
    from,
    to,
    subject,
    body,
    priority,
  });
}

/**
 * Helper to send a status update
 */
export function statusUpdate(
  bus: MessageBus,
  from: string,
  subject: string,
  body: string,
  priority: MessagePriority = 'low'
): AgentMessage {
  return bus.post({
    type: 'status_update',
    from,
    to: '*',
    subject,
    body,
    priority,
  });
}
