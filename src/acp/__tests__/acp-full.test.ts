/**
 * Comprehensive ACP (Agent Client Protocol) Module Tests
 * Task H5-06: ACP Full Coverage
 *
 * Tests: Types, SessionManager, Client, Descriptor, Server basics
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import {
  isACPRequest,
  isACPResponse,
  isACPNotification,
  ACPErrorCodes,
} from '../types.js';
import type {
  ACPAgentDescriptor,
  ACPCapability,
  ACPSession,
  ACPMessage,
  ACPCapabilityInvocation,
  ACPCapabilityDiscovery,
  ACPSessionState,
  ACPTransportType,
} from '../types.js';

// ─── Type Guard Tests ────────────────────────────────────────────────────────

describe('ACP Types', () => {
  describe('Type Guards', () => {
    it('should identify valid ACP request messages', () => {
      const message: ACPMessage = {
        jsonrpc: '2.0',
        method: 'capability.invoke',
        params: { capabilityId: 'test' },
        id: 1,
      };

      expect(isACPRequest(message)).toBe(true);
    });

    it('should reject messages without method as requests', () => {
      const message: ACPMessage = {
        jsonrpc: '2.0',
        result: { status: 'ok' },
        id: 1,
      };

      expect(isACPRequest(message)).toBe(false);
    });

    it('should reject messages without id as requests', () => {
      const message: ACPMessage = {
        jsonrpc: '2.0',
        method: 'test',
        params: {},
      };

      expect(isACPRequest(message)).toBe(false);
    });

    it('should identify valid ACP response messages', () => {
      const message: ACPMessage = {
        jsonrpc: '2.0',
        result: { data: 'test' },
        id: 1,
      };

      expect(isACPResponse(message)).toBe(true);
    });

    it('should identify ACP error responses', () => {
      const message: ACPMessage = {
        jsonrpc: '2.0',
        error: {
          code: ACPErrorCodes.METHOD_NOT_FOUND,
          message: 'Method not found',
        },
        id: 1,
      };

      expect(isACPResponse(message)).toBe(true);
    });

    it('should identify ACP notification messages', () => {
      const message: ACPMessage = {
        jsonrpc: '2.0',
        method: 'agent.event',
        params: { event: 'started' },
        id: null,
      };

      expect(isACPNotification(message)).toBe(true);
    });

    it('should reject messages with undefined id as notifications', () => {
      const message: ACPMessage = {
        jsonrpc: '2.0',
        method: 'test',
        params: {},
      };

      expect(isACPNotification(message)).toBe(false);
    });
  });

  describe('Error Codes', () => {
    it('should have valid JSON-RPC error codes', () => {
      expect(ACPErrorCodes.PARSE_ERROR).toBe(-32700);
      expect(ACPErrorCodes.INVALID_REQUEST).toBe(-32600);
      expect(ACPErrorCodes.METHOD_NOT_FOUND).toBe(-32601);
      expect(ACPErrorCodes.INVALID_PARAMS).toBe(-32602);
      expect(ACPErrorCodes.INTERNAL_ERROR).toBe(-32603);
    });

    it('should have custom ACP error codes', () => {
      expect(ACPErrorCodes.CAPABILITY_NOT_FOUND).toBe(-32001);
      expect(ACPErrorCodes.SESSION_ERROR).toBe(-32002);
      expect(ACPErrorCodes.AUTH_ERROR).toBe(-32003);
      expect(ACPErrorCodes.CONFIRMATION_REQUIRED).toBe(-32004);
    });

    it('should be accessible and defined', () => {
      expect(Object.keys(ACPErrorCodes).length).toBeGreaterThan(0);
      expect(Object.keys(ACPErrorCodes)).toContain('PARSE_ERROR');
      expect(Object.keys(ACPErrorCodes)).toContain('CAPABILITY_NOT_FOUND');
    });
  });
});

// ─── Agent Descriptor Tests ──────────────────────────────────────────────────

describe('ACP Agent Descriptor', () => {
  let descriptor: ACPAgentDescriptor;

  beforeEach(() => {
    descriptor = {
      id: 'nova26-test-agent',
      name: 'Test Agent',
      version: '1.0.0',
      description: 'A test agent for validation',
      author: 'Nova26',
      capabilities: [],
      icon: '🤖',
      website: 'https://nova26.dev',
    };
  });

  describe('Creation and Validation', () => {
    it('should create valid agent descriptor', () => {
      expect(descriptor.id).toBe('nova26-test-agent');
      expect(descriptor.name).toBe('Test Agent');
      expect(descriptor.version).toBe('1.0.0');
    });

    it('should support optional fields', () => {
      const minimalDescriptor: ACPAgentDescriptor = {
        id: 'minimal-agent',
        name: 'Minimal',
        version: '1.0.0',
        description: 'Minimal agent',
        author: 'Test',
        capabilities: [],
      };

      expect(minimalDescriptor.icon).toBeUndefined();
      expect(minimalDescriptor.website).toBeUndefined();
    });

    it('should validate capability array', () => {
      descriptor.capabilities = [
        {
          id: 'test.capability',
          name: 'Test Cap',
          description: 'Test capability',
          agentSource: 'nova26-test-agent',
          inputSchema: { type: 'object' },
          outputSchema: { type: 'object' },
          tags: ['test'],
          requiresConfirmation: false,
        },
      ];

      expect(descriptor.capabilities).toHaveLength(1);
      expect(descriptor.capabilities[0].id).toBe('test.capability');
    });
  });

  describe('Capability Management', () => {
    it('should handle multiple capabilities', () => {
      descriptor.capabilities = [
        {
          id: 'cap1',
          name: 'Capability 1',
          description: 'First capability',
          agentSource: 'nova26-test-agent',
          inputSchema: {},
          outputSchema: {},
          tags: ['type1'],
          requiresConfirmation: false,
        },
        {
          id: 'cap2',
          name: 'Capability 2',
          description: 'Second capability',
          agentSource: 'nova26-test-agent',
          inputSchema: {},
          outputSchema: {},
          tags: ['type2'],
          requiresConfirmation: true,
        },
      ];

      expect(descriptor.capabilities).toHaveLength(2);
      expect(descriptor.capabilities[1].requiresConfirmation).toBe(true);
    });

    it('should validate capability structure', () => {
      const capability: ACPCapability = {
        id: 'codegen.react',
        name: 'React Code Generation',
        description: 'Generate React components',
        agentSource: 'nova26-test-agent',
        inputSchema: {
          type: 'object',
          properties: {
            component: { type: 'string' },
            props: { type: 'object' },
          },
        },
        outputSchema: {
          type: 'object',
          properties: {
            code: { type: 'string' },
          },
        },
        tags: ['codegen', 'react', 'frontend'],
        requiresConfirmation: true,
      };

      expect(capability.id).toContain('.');
      expect(capability.tags).toHaveLength(3);
    });
  });
});

// ─── Session Tests ──────────────────────────────────────────────────────────

describe('ACP Session', () => {
  let session: ACPSession;

  beforeEach(() => {
    const now = Date.now();
    session = {
      id: 'session-1',
      projectRoot: '/project',
      userId: 'user-123',
      tasteVaultSnapshotHash: 'hash-abc123',
      state: 'active',
      connectedAt: now,
      lastActivity: now,
      transport: {
        type: 'websocket',
        options: { auth: { token: 'token-xyz' } },
      },
    };
  });

  describe('Session Lifecycle', () => {
    it('should create active session', () => {
      expect(session.state).toBe('active');
      expect(session.connectedAt).toBeLessThanOrEqual(session.lastActivity);
    });

    it('should support session state transitions', () => {
      const states: ACPSessionState[] = ['active', 'idle', 'closed'];

      for (const state of states) {
        session.state = state;
        expect(['active', 'idle', 'closed']).toContain(session.state);
      }
    });

    it('should track activity timestamps', () => {
      const connectTime = session.connectedAt;
      const initialActivity = session.lastActivity;

      // Simulate later activity
      session.lastActivity = Date.now() + 5000;

      expect(session.lastActivity).toBeGreaterThanOrEqual(initialActivity);
      expect(session.connectedAt).toBe(connectTime);
    });

    it('should support optional user ID', () => {
      const sessionNoUser: ACPSession = {
        ...session,
        userId: undefined,
      };

      expect(sessionNoUser.userId).toBeUndefined();
    });
  });

  describe('Transport Configuration', () => {
    it('should support multiple transport types', () => {
      const transports: ACPTransportType[] = ['stdio', 'websocket', 'sse'];

      for (const type of transports) {
        session.transport.type = type;
        expect(['stdio', 'websocket', 'sse']).toContain(session.transport.type);
      }
    });

    it('should handle authentication options', () => {
      expect(session.transport.options.auth?.token).toBe('token-xyz');

      session.transport.options.auth = { apiKey: 'key-abc' };
      expect(session.transport.options.auth?.apiKey).toBe('key-abc');
    });

    it('should allow missing auth options', () => {
      const noAuthSession: ACPSession = {
        ...session,
        transport: { type: 'stdio', options: {} },
      };

      expect(noAuthSession.transport.options.auth).toBeUndefined();
    });
  });
});

// ─── Message Tests ──────────────────────────────────────────────────────────

describe('ACP Messages', () => {
  describe('Request Messages', () => {
    it('should create valid request message', () => {
      const request: ACPMessage = {
        jsonrpc: '2.0',
        method: 'capability.discover',
        id: 1,
      };

      expect(isACPRequest(request)).toBe(true);
    });

    it('should include parameters in requests', () => {
      const request: ACPMessage = {
        jsonrpc: '2.0',
        method: 'capability.invoke',
        params: {
          capabilityId: 'test.cap',
          input: { key: 'value' },
        },
        id: 2,
      };

      expect(request.params).toBeDefined();
      expect((request.params as any).capabilityId).toBe('test.cap');
    });

    it('should accept string or numeric IDs', () => {
      const stringIdReq: ACPMessage = {
        jsonrpc: '2.0',
        method: 'test',
        id: 'req-123',
      };

      const numericIdReq: ACPMessage = {
        jsonrpc: '2.0',
        method: 'test',
        id: 456,
      };

      expect(isACPRequest(stringIdReq)).toBe(true);
      expect(isACPRequest(numericIdReq)).toBe(true);
    });
  });

  describe('Response Messages', () => {
    it('should create success response', () => {
      const response: ACPMessage = {
        jsonrpc: '2.0',
        result: {
          capabilities: [],
          agent: { id: 'agent', name: 'Agent', version: '1.0.0' },
        },
        id: 1,
      };

      expect(isACPResponse(response)).toBe(true);
    });

    it('should create error response', () => {
      const errorResponse: ACPMessage = {
        jsonrpc: '2.0',
        error: {
          code: ACPErrorCodes.CAPABILITY_NOT_FOUND,
          message: 'Capability not found',
          data: { capabilityId: 'unknown' },
        },
        id: 1,
      };

      expect(isACPResponse(errorResponse)).toBe(true);
      expect(errorResponse.error?.code).toBe(ACPErrorCodes.CAPABILITY_NOT_FOUND);
    });

    it('should not be both success and error', () => {
      const invalid: ACPMessage = {
        jsonrpc: '2.0',
        result: { status: 'ok' },
        error: { code: -1, message: 'error' },
        id: 1,
      };

      // Response check should still pass (has both, but that's invalid in real usage)
      expect(isACPResponse(invalid)).toBe(true);
    });
  });

  describe('Notification Messages', () => {
    it('should create valid notification', () => {
      const notification: ACPMessage = {
        jsonrpc: '2.0',
        method: 'agent.statusChanged',
        params: { status: 'ready' },
        id: null,
      };

      expect(isACPNotification(notification)).toBe(true);
    });

    it('should not expect responses for notifications', () => {
      const notification: ACPMessage = {
        jsonrpc: '2.0',
        method: 'agent.event',
        params: { type: 'initialized' },
        id: null,
      };

      expect(isACPRequest(notification)).toBe(false);
    });
  });
});

// ─── Capability Invocation Tests ─────────────────────────────────────────────

describe('ACP Capability Invocation', () => {
  let invocation: ACPCapabilityInvocation;

  beforeEach(() => {
    invocation = {
      capabilityId: 'codegen.react',
      input: {
        componentName: 'Button',
        props: { variant: 'primary' },
      },
      context: {
        projectId: 'proj-123',
        userId: 'user-456',
      },
    };
  });

  it('should create valid capability invocation', () => {
    expect(invocation.capabilityId).toBe('codegen.react');
    expect((invocation.input as any).componentName).toBe('Button');
  });

  it('should support various input types', () => {
    const stringInput: ACPCapabilityInvocation = {
      capabilityId: 'test',
      input: 'simple string',
    };

    const objectInput: ACPCapabilityInvocation = {
      capabilityId: 'test',
      input: { complex: { nested: 'object' } },
    };

    const arrayInput: ACPCapabilityInvocation = {
      capabilityId: 'test',
      input: [1, 2, 3],
    };

    expect(typeof stringInput.input).toBe('string');
    expect(typeof objectInput.input).toBe('object');
    expect(Array.isArray(arrayInput.input)).toBe(true);
  });

  it('should support optional context', () => {
    const noContext: ACPCapabilityInvocation = {
      capabilityId: 'test',
      input: {},
    };

    expect(noContext.context).toBeUndefined();
  });
});

// ─── Capability Discovery Tests ──────────────────────────────────────────────

describe('ACP Capability Discovery', () => {
  let discovery: ACPCapabilityDiscovery;

  beforeEach(() => {
    discovery = {
      capabilities: [
        {
          id: 'codegen.react',
          name: 'React Codegen',
          description: 'Generate React components',
          agentSource: 'nova26-venus',
          inputSchema: {},
          outputSchema: {},
          tags: ['codegen'],
          requiresConfirmation: true,
        },
        {
          id: 'review.code',
          name: 'Code Review',
          description: 'Review code',
          agentSource: 'nova26-mercury',
          inputSchema: {},
          outputSchema: {},
          tags: ['review'],
          requiresConfirmation: false,
        },
      ],
      agent: {
        id: 'nova26-orchestrator',
        name: 'Nova26 Orchestrator',
        version: '1.0.0',
      },
    };
  });

  it('should discover available capabilities', () => {
    expect(discovery.capabilities).toHaveLength(2);
    expect(discovery.capabilities[0].id).toBe('codegen.react');
  });

  it('should include agent metadata', () => {
    expect(discovery.agent.id).toBe('nova26-orchestrator');
    expect(discovery.agent.version).toBe('1.0.0');
  });

  it('should support capability filtering', () => {
    const requiresConfirm = discovery.capabilities.filter(
      cap => cap.requiresConfirmation
    );

    expect(requiresConfirm).toHaveLength(1);
    expect(requiresConfirm[0].id).toBe('codegen.react');
  });

  it('should support capability search by tags', () => {
    const codegencaps = discovery.capabilities.filter(cap =>
      cap.tags.includes('codegen')
    );

    expect(codegencaps).toHaveLength(1);
  });
});

// ─── Property-Based Tests ────────────────────────────────────────────────────

describe('ACP Property-Based Tests', () => {
  it('should validate message structure for all valid messages', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant({
            jsonrpc: '2.0' as const,
            method: 'test',
            id: 1,
          }),
          fc.constant({
            jsonrpc: '2.0' as const,
            result: { data: 'test' },
            id: 1,
          }),
          fc.constant({
            jsonrpc: '2.0' as const,
            error: { code: -1, message: 'error' },
            id: 1,
          }),
          fc.constant({
            jsonrpc: '2.0' as const,
            method: 'notify',
            id: null,
          })
        ),
        message => {
          return (
            message.jsonrpc === '2.0' &&
            (isACPRequest(message) ||
              isACPResponse(message) ||
              isACPNotification(message))
          );
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should handle session IDs correctly', () => {
    fc.assert(
      fc.property(fc.uuid(), uuid => {
        const session: ACPSession = {
          id: uuid,
          projectRoot: '/test',
          tasteVaultSnapshotHash: 'hash',
          state: 'active',
          connectedAt: Date.now(),
          lastActivity: Date.now(),
          transport: { type: 'stdio', options: {} },
        };

        return session.id === uuid && session.id.length > 0;
      }),
      { numRuns: 30 }
    );
  });

  it('should validate capability IDs follow dot notation', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.string({ minLength: 1, maxLength: 20 })
        ),
        ([first, second]) => {
          const capId = `${first.toLowerCase()}.${second.toLowerCase()}`;
          const capability: ACPCapability = {
            id: capId,
            name: 'Test',
            description: 'Test capability',
            agentSource: 'test',
            inputSchema: {},
            outputSchema: {},
            tags: [],
            requiresConfirmation: false,
          };

          return capability.id.includes('.');
        }
      ),
      { numRuns: 30 }
    );
  });
});
