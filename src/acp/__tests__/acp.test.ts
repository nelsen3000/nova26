/**
 * ACP (Agent Client Protocol) Integration Tests
 * 
 * Comprehensive test suite for Nova26 R21-02 ACP implementation.
 * Covers ACPServer, ACPClient, ACPSessionManager, and Descriptor/Capabilities.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ACPServer } from '../server.js';
import { ACPClient } from '../client.js';
import { ACPSessionManager } from '../session-manager.js';
import { createNova26Descriptor, getAllNova26Agents, getNova26Agent } from '../descriptor.js';
import type { ACPAgentDescriptor, ACPCapability, ACPSession, ACPMessage, ACPTransport } from '../types.js';
import { ACPErrorCodes, isACPRequest, isACPResponse, isACPNotification } from '../types.js';

// ============================================================================
// Test Fixtures
// ============================================================================

const createMockTransport = (type: 'stdio' | 'websocket' | 'sse' = 'stdio'): ACPTransport => ({
  type,
  options: {
    auth: {
      token: 'test-token',
    },
  },
});

const createMockAgent = (id: string): ACPAgentDescriptor => ({
  id,
  name: `Test Agent ${id}`,
  version: '1.0.0',
  description: 'Test agent for unit tests',
  author: 'Test Author',
  capabilities: [
    {
      id: `${id}.test-capability`,
      name: 'Test Capability',
      description: 'A test capability',
      agentSource: id,
      inputSchema: { type: 'object' },
      outputSchema: { type: 'object' },
      tags: ['test'],
      requiresConfirmation: false,
    },
  ],
});

// ============================================================================
// ACPServer Tests (18 tests)
// ============================================================================

describe('ACPServer', () => {
  let server: ACPServer;

  beforeEach(() => {
    server = new ACPServer({
      name: 'Test Server',
      version: '1.0.0',
      enableLogging: false,
    });
  });

  afterEach(async () => {
    if (server.running) {
      await server.stop();
    }
  });

  describe('start/stop', () => {
    it('should start the server successfully', async () => {
      await server.start();
      expect(server.running).toBe(true);
    });

    it('should throw error when starting already running server', async () => {
      await server.start();
      await expect(server.start()).rejects.toThrow('ACP Server is already running');
    });

    it('should stop the server successfully', async () => {
      await server.start();
      await server.stop();
      expect(server.running).toBe(false);
    });

    it('should handle stop on non-running server gracefully', async () => {
      await expect(server.stop()).resolves.toBeUndefined();
      expect(server.running).toBe(false);
    });

    it('should clear all registrations on stop', async () => {
      await server.start();
      const agent = createMockAgent('test-agent');
      server.registerAgent(agent);
      expect(server.listAgents()).toHaveLength(1);
      
      await server.stop();
      expect(server.listAgents()).toHaveLength(0);
      expect(server.listCapabilities()).toHaveLength(0);
    });
  });

  describe('registerAgent', () => {
    it('should register an agent successfully', async () => {
      await server.start();
      const agent = createMockAgent('test-agent');
      const result = server.registerAgent(agent);
      
      expect(result).toBe(true);
      expect(server.listAgents()).toContainEqual(agent);
    });

    it('should register agent capabilities', async () => {
      await server.start();
      const agent = createMockAgent('test-agent');
      server.registerAgent(agent);
      
      const capabilities = server.listCapabilities();
      expect(capabilities).toHaveLength(1);
      expect(capabilities[0]?.id).toBe('test-agent.test-capability');
    });

    it('should return false for duplicate agent registration', async () => {
      await server.start();
      const agent = createMockAgent('test-agent');
      server.registerAgent(agent);
      const result = server.registerAgent(agent);
      
      expect(result).toBe(false);
    });

    it('should throw error when registering agent on stopped server', async () => {
      const agent = createMockAgent('test-agent');
      expect(() => server.registerAgent(agent)).toThrow('Cannot register agent: server is not running');
    });

    it('should throw error for invalid agent descriptor', async () => {
      await server.start();
      const invalidAgent = { id: '', name: '', version: '', description: '', author: '', capabilities: [] };
      expect(() => server.registerAgent(invalidAgent as ACPAgentDescriptor)).toThrow('Invalid agent descriptor');
    });

    it('should unregister an agent and its capabilities', async () => {
      await server.start();
      const agent = createMockAgent('test-agent');
      server.registerAgent(agent);
      
      const result = server.unregisterAgent('test-agent');
      expect(result).toBe(true);
      expect(server.listAgents()).toHaveLength(0);
      expect(server.listCapabilities()).toHaveLength(0);
    });

    it('should return false when unregistering non-existent agent', async () => {
      await server.start();
      const result = server.unregisterAgent('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('handleMessage', () => {
    beforeEach(async () => {
      await server.start();
    });

    it('should handle valid discovery request', async () => {
      const request: ACPMessage = {
        jsonrpc: '2.0',
        id: 'req-1',
        method: 'acp/discover',
        params: {},
      };
      
      const response = await server.handleMessage(request);
      
      expect(response).toBeDefined();
      expect(response?.jsonrpc).toBe('2.0');
      expect(response?.id).toBe('req-1');
      expect(response?.result).toBeDefined();
    });

    it('should handle ping request', async () => {
      const request: ACPMessage = {
        jsonrpc: '2.0',
        id: 'req-1',
        method: 'acp/ping',
        params: {},
      };
      
      const response = await server.handleMessage(request);
      
      expect(response?.result).toEqual(expect.objectContaining({ pong: true }));
    });

    it('should return error for unknown method', async () => {
      const request: ACPMessage = {
        jsonrpc: '2.0',
        id: 'req-1',
        method: 'unknown/method',
        params: {},
      };
      
      const response = await server.handleMessage(request);
      
      expect(response?.error).toBeDefined();
      expect(response?.error?.code).toBe(ACPErrorCodes.METHOD_NOT_FOUND);
    });

    it('should return error for invalid JSON-RPC version', async () => {
      const request = {
        jsonrpc: '1.0',
        id: 'req-1',
        method: 'acp/ping',
        params: {},
      } as unknown as ACPMessage;
      
      const response = await server.handleMessage(request);
      
      expect(response?.error).toBeDefined();
      expect(response?.error?.code).toBe(ACPErrorCodes.INVALID_REQUEST);
    });

    it('should return undefined for notifications (no id)', async () => {
      const notification: ACPMessage = {
        jsonrpc: '2.0',
        method: 'acp/notification',
        params: {},
        id: null,
      };
      
      const response = await server.handleMessage(notification);
      
      expect(response).toBeUndefined();
    });

    it('should return error when server not running', async () => {
      await server.stop();
      const request: ACPMessage = {
        jsonrpc: '2.0',
        id: 'req-1',
        method: 'acp/ping',
        params: {},
      };
      
      const response = await server.handleMessage(request);
      
      expect(response?.error).toBeDefined();
      expect(response?.error?.code).toBe(ACPErrorCodes.SERVER_ERROR);
    });
  });

  describe('capability invocation', () => {
    beforeEach(async () => {
      await server.start();
    });

    it('should invoke registered capability', async () => {
      const agent = createMockAgent('test-agent');
      server.registerAgent(agent);
      
      const mockHandler = vi.fn().mockResolvedValue({ success: true });
      server.registerCapabilityHandler('test-agent.test-capability', mockHandler);
      
      const request: ACPMessage = {
        jsonrpc: '2.0',
        id: 'req-1',
        method: 'acp/invoke',
        params: {
          capabilityId: 'test-agent.test-capability',
          input: { test: 'data' },
        },
      };
      
      const response = await server.handleMessage(request);
      
      expect(mockHandler).toHaveBeenCalledWith({ test: 'data' }, undefined);
      expect(response?.result).toEqual({ success: true });
    });

    it('should return error for non-existent capability', async () => {
      const request: ACPMessage = {
        jsonrpc: '2.0',
        id: 'req-1',
        method: 'acp/invoke',
        params: {
          capabilityId: 'non-existent.capability',
          input: {},
        },
      };
      
      const response = await server.handleMessage(request);
      
      expect(response?.error?.code).toBe(ACPErrorCodes.CAPABILITY_NOT_FOUND);
    });

    it('should return error for capability without handler', async () => {
      const agent = createMockAgent('test-agent');
      server.registerAgent(agent);
      
      const request: ACPMessage = {
        jsonrpc: '2.0',
        id: 'req-1',
        method: 'acp/invoke',
        params: {
          capabilityId: 'test-agent.test-capability',
          input: {},
        },
      };
      
      const response = await server.handleMessage(request);
      
      expect(response?.error?.code).toBe(ACPErrorCodes.METHOD_NOT_FOUND);
    });

    it('should handle handler errors gracefully', async () => {
      const agent = createMockAgent('test-agent');
      server.registerAgent(agent);
      
      const mockHandler = vi.fn().mockRejectedValue(new Error('Handler failed'));
      server.registerCapabilityHandler('test-agent.test-capability', mockHandler);
      
      const request: ACPMessage = {
        jsonrpc: '2.0',
        id: 'req-1',
        method: 'acp/invoke',
        params: {
          capabilityId: 'test-agent.test-capability',
          input: {},
        },
      };
      
      const response = await server.handleMessage(request);
      
      expect(response?.error?.code).toBe(ACPErrorCodes.INTERNAL_ERROR);
      expect(response?.error?.message).toContain('Handler failed');
    });

    it('should return error for missing capabilityId', async () => {
      const request: ACPMessage = {
        jsonrpc: '2.0',
        id: 'req-1',
        method: 'acp/invoke',
        params: {},
      };
      
      const response = await server.handleMessage(request);
      
      expect(response?.error?.code).toBe(ACPErrorCodes.INVALID_PARAMS);
    });
  });

  describe('negotiateCapabilities', () => {
    beforeEach(async () => {
      await server.start();
    });

    it('should return compatible capabilities', async () => {
      const agent = createMockAgent('test-agent');
      server.registerAgent(agent);
      
      const clientCapabilities: ACPCapability[] = [agent.capabilities[0]!];
      const compatible = server.negotiateCapabilities(clientCapabilities);
      
      expect(compatible).toHaveLength(1);
      expect(compatible[0]?.id).toBe('test-agent.test-capability');
    });

    it('should return empty array for no matches', async () => {
      const agent = createMockAgent('test-agent');
      server.registerAgent(agent);
      
      const clientCapabilities: ACPCapability[] = [{
        id: 'other.capability',
        name: 'Other',
        description: 'Other capability',
        agentSource: 'other-agent',
        inputSchema: {},
        outputSchema: {},
        tags: [],
        requiresConfirmation: false,
      }];
      
      const compatible = server.negotiateCapabilities(clientCapabilities);
      expect(compatible).toHaveLength(0);
    });

    it('should list all registered capabilities', async () => {
      const agent1 = createMockAgent('agent1');
      const agent2 = createMockAgent('agent2');
      server.registerAgent(agent1);
      server.registerAgent(agent2);
      
      const capabilities = server.listCapabilities();
      expect(capabilities).toHaveLength(2);
    });
  });

  describe('message handlers', () => {
    beforeEach(async () => {
      await server.start();
    });

    it('should support custom message handlers', async () => {
      const customHandler = vi.fn().mockResolvedValue({
        jsonrpc: '2.0',
        id: 'custom-1',
        result: { custom: true },
      } as ACPMessage);
      
      server.addMessageHandler(customHandler);
      
      const request: ACPMessage = {
        jsonrpc: '2.0',
        id: 'custom-1',
        method: 'custom/method',
        params: {},
      };
      
      await server.handleMessage(request);
      expect(customHandler).toHaveBeenCalledWith(request);
    });

    it('should remove message handlers', async () => {
      const customHandler = vi.fn().mockResolvedValue(undefined);
      server.addMessageHandler(customHandler);
      server.removeMessageHandler(customHandler);
      
      const request: ACPMessage = {
        jsonrpc: '2.0',
        id: 'req-1',
        method: 'acp/ping',
        params: {},
      };
      
      await server.handleMessage(request);
      expect(customHandler).not.toHaveBeenCalled();
    });
  });
});

// ============================================================================
// ACPClient Tests (18 tests)
// ============================================================================

describe('ACPClient', () => {
  let client: ACPClient;
  let mockTransport: ACPTransport;

  beforeEach(() => {
    vi.useRealTimers();
    client = new ACPClient({
      name: 'Test Client',
      version: '1.0.0',
      timeout: 5000,
      debug: false,
    });
    mockTransport = createMockTransport('stdio');
  });

  afterEach(async () => {
    if (client.isConnected) {
      await client.disconnect();
    }
  });

  describe('connection state', () => {
    it('should start in disconnected state', () => {
      expect(client.state).toBe('disconnected');
      expect(client.isConnected).toBe(false);
    });

    it('should track connection state', async () => {
      // Create a client with mocked transport methods
      const testClient = new TestableACPClient({
        name: 'Test Client',
        version: '1.0.0',
      });
      
      // Set up mock discovery response
      testClient.setMockResponse({
        jsonrpc: '2.0',
        id: 'test-discover',
        result: {
          capabilities: [],
          agent: { id: 'test-server', name: 'Test Server', version: '1.0.0' },
        },
      });
      
      expect(testClient.state).toBe('disconnected');
      await testClient.connect(mockTransport);
      expect(testClient.state).toBe('connected');
      expect(testClient.isConnected).toBe(true);
      await testClient.disconnect();
      expect(testClient.state).toBe('disconnected');
    });

    it('should throw when connecting while already connected', async () => {
      const testClient = new TestableACPClient({
        name: 'Test Client',
        version: '1.0.0',
      });
      
      // Set up mock discovery response
      testClient.setMockResponse({
        jsonrpc: '2.0',
        id: 'test-discover',
        result: {
          capabilities: [],
          agent: { id: 'test-server', name: 'Test Server', version: '1.0.0' },
        },
      });
      
      await testClient.connect(mockTransport);
      await expect(testClient.connect(mockTransport)).rejects.toThrow('Already connected');
      await testClient.disconnect();
    });

    it('should throw when connecting while connection in progress', async () => {
      const testClient = new TestableACPClient({
        name: 'Test Client',
        version: '1.0.0',
      });
      
      // Simulate connecting state
      (testClient as unknown as { connectionState: string }).connectionState = 'connecting';
      await expect(testClient.connect(mockTransport)).rejects.toThrow('Connection already in progress');
    });

    it('should handle disconnect gracefully when not connected', async () => {
      await expect(client.disconnect()).resolves.toBeUndefined();
    });
  });

  describe('discoverCapabilities', () => {
    it('should throw when not connected', async () => {
      await expect(client.discoverCapabilities()).rejects.toThrow('Client is not connected');
    });

    it('should discover capabilities from server', async () => {
      const testClient = new TestableACPClient({
        name: 'Test Client',
        version: '1.0.0',
      });
      
      const mockCapability: ACPCapability = {
        id: 'test.capability',
        name: 'Test Capability',
        description: 'Test',
        agentSource: 'test-agent',
        inputSchema: {},
        outputSchema: {},
        tags: ['test'],
        requiresConfirmation: false,
      };
      
      testClient.setMockResponse({
        jsonrpc: '2.0',
        id: 'test-discover',
        result: {
          capabilities: [mockCapability],
          agent: { id: 'test-server', name: 'Test Server', version: '1.0.0' },
        },
      });
      
      await testClient.connect(mockTransport);
      const capabilities = await testClient.discoverCapabilities();
      
      expect(capabilities).toHaveLength(1);
      expect(capabilities[0]?.id).toBe('test.capability');
      await testClient.disconnect();
    });

    it('should store discovered capabilities', async () => {
      const testClient = new TestableACPClient({
        name: 'Test Client',
        version: '1.0.0',
      });
      
      const mockCapability: ACPCapability = {
        id: 'test.capability',
        name: 'Test Capability',
        description: 'Test',
        agentSource: 'test-agent',
        inputSchema: {},
        outputSchema: {},
        tags: ['test'],
        requiresConfirmation: false,
      };
      
      testClient.setMockResponse({
        jsonrpc: '2.0',
        id: 'test-discover',
        result: {
          capabilities: [mockCapability],
          agent: { id: 'test-server', name: 'Test Server', version: '1.0.0' },
        },
      });
      
      await testClient.connect(mockTransport);
      await testClient.discoverCapabilities();
      
      const stored = testClient.getCapability('test.capability');
      expect(stored).toBeDefined();
      expect(stored?.name).toBe('Test Capability');
      await testClient.disconnect();
    });

    it('should throw on discovery error', async () => {
      const testClient = new TestableACPClient({
        name: 'Test Client',
        version: '1.0.0',
      });
      
      testClient.setMockResponse({
        jsonrpc: '2.0',
        id: 'test-discover',
        error: { code: -32603, message: 'Discovery failed' },
      });
      
      // connect() auto-discovers, so it should throw
      await expect(testClient.connect(mockTransport)).rejects.toThrow('Discovery failed');
    });
  });

  describe('invokeCapability', () => {
    it('should throw when invoking non-discovered capability', async () => {
      const testClient = new TestableACPClient({
        name: 'Test Client',
        version: '1.0.0',
      });
      
      testClient.setMockResponse({
        jsonrpc: '2.0',
        id: 'test-discover',
        result: {
          capabilities: [],
          agent: { id: 'test-server', name: 'Test Server', version: '1.0.0' },
        },
      });
      
      await testClient.connect(mockTransport);
      await testClient.discoverCapabilities();
      
      await expect(testClient.invokeCapability('unknown.capability', {})).rejects.toThrow('Capability not discovered');
      await testClient.disconnect();
    });

    it('should invoke discovered capability', async () => {
      const testClient = new TestableACPClient({
        name: 'Test Client',
        version: '1.0.0',
      });
      
      const mockCapability: ACPCapability = {
        id: 'test.capability',
        name: 'Test Capability',
        description: 'Test',
        agentSource: 'test-agent',
        inputSchema: {},
        outputSchema: {},
        tags: ['test'],
        requiresConfirmation: false,
      };
      
      testClient.setMockResponse({
        jsonrpc: '2.0',
        id: 'test-discover',
        result: {
          capabilities: [mockCapability],
          agent: { id: 'test-server', name: 'Test Server', version: '1.0.0' },
        },
      });
      
      await testClient.connect(mockTransport);
      await testClient.discoverCapabilities();
      
      testClient.setMockResponse({
        jsonrpc: '2.0',
        id: 'test-invoke',
        result: { success: true, data: 'test-result' },
      });
      
      const result = await testClient.invokeCapability('test.capability', { input: 'data' });
      expect(result).toEqual({ success: true, data: 'test-result' });
      await testClient.disconnect();
    });

    it('should throw on invocation error', async () => {
      const testClient = new TestableACPClient({
        name: 'Test Client',
        version: '1.0.0',
      });
      
      const mockCapability: ACPCapability = {
        id: 'test.capability',
        name: 'Test Capability',
        description: 'Test',
        agentSource: 'test-agent',
        inputSchema: {},
        outputSchema: {},
        tags: ['test'],
        requiresConfirmation: false,
      };
      
      testClient.setMockResponse({
        jsonrpc: '2.0',
        id: 'test-discover',
        result: {
          capabilities: [mockCapability],
          agent: { id: 'test-server', name: 'Test Server', version: '1.0.0' },
        },
      });
      
      await testClient.connect(mockTransport);
      await testClient.discoverCapabilities();
      
      testClient.setMockResponse({
        jsonrpc: '2.0',
        id: 'test-invoke',
        error: { code: -32603, message: 'Invocation failed' },
      });
      
      await expect(testClient.invokeCapability('test.capability', {})).rejects.toThrow('Invocation failed');
      await testClient.disconnect();
    });
  });

  describe('sendMessage', () => {
    it('should send raw message and return response', async () => {
      const testClient = new TestableACPClient({
        name: 'Test Client',
        version: '1.0.0',
      });
      
      // Set up discovery response first (connect() auto-discovers)
      testClient.setMockResponse({
        jsonrpc: '2.0',
        id: 'test-discover',
        result: {
          capabilities: [],
          agent: { id: 'test-server', name: 'Test Server', version: '1.0.0' },
        },
      });
      
      await testClient.connect(mockTransport);
      
      // Now set up the actual test response
      testClient.setMockResponse({
        jsonrpc: '2.0',
        id: 'test-msg',
        result: { received: true },
      });
      const response = await testClient.sendMessage({
        method: 'custom/method',
        params: { data: 'test' },
        id: 'test-msg',
      });
      
      expect(response.result).toEqual({ received: true });
      await testClient.disconnect();
    });

    it('should throw when not connected', async () => {
      await expect(client.sendMessage({
        method: 'test',
        params: {},
        id: 'test',
      })).rejects.toThrow('Client is not connected');
    });
  });

  describe('ping', () => {
    it('should return true on successful ping', async () => {
      const testClient = new TestableACPClient({
        name: 'Test Client',
        version: '1.0.0',
      });
      
      // Set up discovery response first (connect() auto-discovers)
      testClient.setMockResponse({
        jsonrpc: '2.0',
        id: 'test-discover',
        result: {
          capabilities: [],
          agent: { id: 'test-server', name: 'Test Server', version: '1.0.0' },
        },
      });
      
      await testClient.connect(mockTransport);
      
      // Now set up ping response
      testClient.setMockResponse({
        jsonrpc: '2.0',
        id: 'ping-test',
        result: { pong: true, timestamp: Date.now() },
      });
      const result = await testClient.ping();
      expect(result).toBe(true);
      await testClient.disconnect();
    });

    it('should return false on failed ping', async () => {
      const testClient = new TestableACPClient({
        name: 'Test Client',
        version: '1.0.0',
      });
      
      // Set up discovery response first (connect() auto-discovers)
      testClient.setMockResponse({
        jsonrpc: '2.0',
        id: 'test-discover',
        result: {
          capabilities: [],
          agent: { id: 'test-server', name: 'Test Server', version: '1.0.0' },
        },
      });
      
      await testClient.connect(mockTransport);
      
      // Now set up ping error response
      testClient.setMockResponse({
        jsonrpc: '2.0',
        id: 'ping-test',
        error: { code: -32603, message: 'Ping failed' },
      });
      const result = await testClient.ping();
      expect(result).toBe(false);
      await testClient.disconnect();
    });
  });

  describe('request/response matching', () => {
    it('should match responses to pending requests', async () => {
      const testClient = new TestableACPClient({
        name: 'Test Client',
        version: '1.0.0',
      });
      
      // Set up discovery response first (connect() auto-discovers)
      testClient.setMockResponse({
        jsonrpc: '2.0',
        id: 'test-discover',
        result: {
          capabilities: [],
          agent: { id: 'test-server', name: 'Test Server', version: '1.0.0' },
        },
      });
      
      await testClient.connect(mockTransport);
      
      // Simulate receiving a response
      const responsePromise = testClient.sendMessage({
        method: 'test/method',
        params: {},
        id: 'test-req-1',
      });
      
      // Simulate incoming response
      testClient.simulateIncomingMessage({
        jsonrpc: '2.0',
        id: 'test-req-1',
        result: { success: true },
      });
      
      const response = await responsePromise;
      expect(response.result).toEqual({ success: true });
      await testClient.disconnect();
    });

    it('should handle request timeout', async () => {
      const testClient = new TestableACPClient({
        name: 'Test Client',
        version: '1.0.0',
        timeout: 100, // Short timeout for faster test
      });
      
      // Set up discovery response first (connect() auto-discovers)
      testClient.setMockResponse({
        jsonrpc: '2.0',
        id: 'test-discover',
        result: {
          capabilities: [],
          agent: { id: 'test-server', name: 'Test Server', version: '1.0.0' },
        },
      });
      
      await testClient.connect(mockTransport);
      
      // Clear mock response to simulate no response (timeout)
      testClient.setMockResponse(undefined as unknown as ACPMessage);
      
      const requestPromise = testClient.sendMessage({
        method: 'test/method',
        params: {},
        id: 'timeout-test',
      });
      
      // Wait for timeout (mock transport doesn't respond)
      await expect(requestPromise).rejects.toThrow('Request timeout');
      
      await testClient.disconnect();
    });

    it('should clear pending requests on disconnect', async () => {
      const testClient = new TestableACPClient({
        name: 'Test Client',
        version: '1.0.0',
      });
      
      // Set up discovery response first (connect() auto-discovers)
      testClient.setMockResponse({
        jsonrpc: '2.0',
        id: 'test-discover',
        result: {
          capabilities: [],
          agent: { id: 'test-server', name: 'Test Server', version: '1.0.0' },
        },
      });
      
      await testClient.connect(mockTransport);
      
      const requestPromise = testClient.sendMessage({
        method: 'test/method',
        params: {},
        id: 'disconnect-test',
      });
      
      await testClient.disconnect();
      
      await expect(requestPromise).rejects.toThrow('Client disconnected');
    });
  });

  describe('server metadata', () => {
    it('should store server metadata after discovery', async () => {
      const testClient = new TestableACPClient({
        name: 'Test Client',
        version: '1.0.0',
      });
      
      testClient.setMockResponse({
        jsonrpc: '2.0',
        id: 'test-discover',
        result: {
          capabilities: [],
          agent: { id: 'test-server', name: 'Test Server', version: '2.0.0' },
        },
      });
      
      await testClient.connect(mockTransport);
      await testClient.discoverCapabilities();
      
      expect(testClient.serverMetadata).toEqual({
        id: 'test-server',
        name: 'Test Server',
        version: '2.0.0',
      });
      await testClient.disconnect();
    });
  });

  describe('list capabilities', () => {
    it('should list all discovered capabilities', async () => {
      const testClient = new TestableACPClient({
        name: 'Test Client',
        version: '1.0.0',
      });
      
      const mockCapabilities: ACPCapability[] = [
        {
          id: 'cap1',
          name: 'Capability 1',
          description: 'Test',
          agentSource: 'agent1',
          inputSchema: {},
          outputSchema: {},
          tags: [],
          requiresConfirmation: false,
        },
        {
          id: 'cap2',
          name: 'Capability 2',
          description: 'Test',
          agentSource: 'agent2',
          inputSchema: {},
          outputSchema: {},
          tags: [],
          requiresConfirmation: false,
        },
      ];
      
      testClient.setMockResponse({
        jsonrpc: '2.0',
        id: 'test-discover',
        result: {
          capabilities: mockCapabilities,
          agent: { id: 'test-server', name: 'Test Server', version: '1.0.0' },
        },
      });
      
      await testClient.connect(mockTransport);
      await testClient.discoverCapabilities();
      
      const listed = testClient.listDiscoveredCapabilities();
      expect(listed).toHaveLength(2);
      await testClient.disconnect();
    });
  });
});

// ============================================================================
// ACPSessionManager Tests (18 tests)
// ============================================================================

describe('ACPSessionManager', () => {
  let manager: ACPSessionManager;
  let now: number;

  beforeEach(() => {
    now = Date.now();
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    manager = new ACPSessionManager({
      idleTimeout: 3600000, // 1 hour
      maxSessions: 10,
      debug: false,
      tasteVaultHashFn: () => 'test-hash-123',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createSession', () => {
    it('should create a new session', () => {
      const session = manager.createSession({
        projectRoot: '/test/project',
        transport: createMockTransport(),
      });
      
      expect(session).toBeDefined();
      expect(session.projectRoot).toBe('/test/project');
      expect(session.state).toBe('active');
      expect(session.tasteVaultSnapshotHash).toBe('test-hash-123');
    });

    it('should generate unique session IDs', () => {
      const session1 = manager.createSession({
        projectRoot: '/test/project1',
        transport: createMockTransport(),
      });
      
      const session2 = manager.createSession({
        projectRoot: '/test/project2',
        transport: createMockTransport(),
      });
      
      expect(session1.id).not.toBe(session2.id);
    });

    it('should throw when max sessions reached', async () => {
      const smallManager = new ACPSessionManager({
        maxSessions: 2,
        idleTimeout: 3600000,
      });
      
      smallManager.createSession({
        projectRoot: '/test/project1',
        transport: createMockTransport(),
      });
      
      smallManager.createSession({
        projectRoot: '/test/project2',
        transport: createMockTransport(),
      });
      
      expect(() => {
        smallManager.createSession({
          projectRoot: '/test/project3',
          transport: createMockTransport(),
        });
      }).toThrow('Maximum number of sessions (2) reached');
    });

    it('should accept optional userId', () => {
      const session = manager.createSession({
        projectRoot: '/test/project',
        transport: createMockTransport(),
        userId: 'user-123',
      });
      
      expect(session.userId).toBe('user-123');
    });

    it('should accept initial state', () => {
      const session = manager.createSession({
        projectRoot: '/test/project',
        transport: createMockTransport(),
        initialState: 'idle',
      });
      
      expect(session.state).toBe('idle');
    });
  });

  describe('getSession', () => {
    it('should retrieve session by ID', () => {
      const session = manager.createSession({
        projectRoot: '/test/project',
        transport: createMockTransport(),
      });
      
      const retrieved = manager.getSession(session.id);
      expect(retrieved).toEqual(session);
    });

    it('should return undefined for non-existent session', () => {
      const retrieved = manager.getSession('non-existent-id');
      expect(retrieved).toBeUndefined();
    });

    it('should throw for non-existent session with getSessionOrThrow', () => {
      expect(() => manager.getSessionOrThrow('non-existent-id')).toThrow('Session not found');
    });
  });

  describe('closeSession', () => {
    it('should close an existing session', () => {
      const session = manager.createSession({
        projectRoot: '/test/project',
        transport: createMockTransport(),
      });
      
      const result = manager.closeSession(session.id);
      expect(result).toBe(true);
      expect(manager.getSession(session.id)).toBeUndefined();
    });

    it('should return false for non-existent session', () => {
      const result = manager.closeSession('non-existent-id');
      expect(result).toBe(false);
    });

    it('should update session state to closed in history', () => {
      const session = manager.createSession({
        projectRoot: '/test/project',
        transport: createMockTransport(),
      });
      
      manager.closeSession(session.id);
      const history = manager.getSessionHistory();
      expect(history[0]?.session.state).toBe('closed');
    });
  });

  describe('listActiveSessions', () => {
    it('should list only active sessions', () => {
      const session1 = manager.createSession({
        projectRoot: '/test/project1',
        transport: createMockTransport(),
        initialState: 'active',
      });
      
      const session2 = manager.createSession({
        projectRoot: '/test/project2',
        transport: createMockTransport(),
        initialState: 'idle',
      });
      
      const activeSessions = manager.listActiveSessions();
      expect(activeSessions).toHaveLength(2);
      expect(activeSessions.map(s => s.id).sort()).toEqual([session1.id, session2.id].sort());
    });

    it('should not include closed sessions', () => {
      const session = manager.createSession({
        projectRoot: '/test/project',
        transport: createMockTransport(),
      });
      
      manager.closeSession(session.id);
      
      const activeSessions = manager.listActiveSessions();
      expect(activeSessions).toHaveLength(0);
    });

    it('should filter by state', () => {
      manager.createSession({
        projectRoot: '/test/project1',
        transport: createMockTransport(),
        initialState: 'active',
      });
      
      manager.createSession({
        projectRoot: '/test/project2',
        transport: createMockTransport(),
        initialState: 'idle',
      });
      
      const idleSessions = manager.listSessionsByState('idle');
      expect(idleSessions).toHaveLength(1);
      expect(idleSessions[0]?.state).toBe('idle');
    });

    it('should filter by user', () => {
      manager.createSession({
        projectRoot: '/test/project1',
        transport: createMockTransport(),
        userId: 'user-1',
      });
      
      manager.createSession({
        projectRoot: '/test/project2',
        transport: createMockTransport(),
        userId: 'user-2',
      });
      
      const user1Sessions = manager.listSessionsByUser('user-1');
      expect(user1Sessions).toHaveLength(1);
      expect(user1Sessions[0]?.userId).toBe('user-1');
    });

    it('should filter by project', () => {
      manager.createSession({
        projectRoot: '/test/project1',
        transport: createMockTransport(),
      });
      
      manager.createSession({
        projectRoot: '/test/project2',
        transport: createMockTransport(),
      });
      
      const project1Sessions = manager.listSessionsByProject('/test/project1');
      expect(project1Sessions).toHaveLength(1);
      expect(project1Sessions[0]?.projectRoot).toBe('/test/project1');
    });
  });

  describe('updateActivity', () => {
    it('should update last activity timestamp', () => {
      const session = manager.createSession({
        projectRoot: '/test/project',
        transport: createMockTransport(),
      });
      
      const originalActivity = session.lastActivity;
      
      now += 1000;
      const updated = manager.updateActivity(session.id);
      
      expect(updated?.lastActivity).toBeGreaterThan(originalActivity);
    });

    it('should change idle state to active', () => {
      const session = manager.createSession({
        projectRoot: '/test/project',
        transport: createMockTransport(),
        initialState: 'idle',
      });
      
      const updated = manager.updateActivity(session.id);
      expect(updated?.state).toBe('active');
    });

    it('should return undefined for non-existent session', () => {
      const updated = manager.updateActivity('non-existent-id');
      expect(updated).toBeUndefined();
    });
  });

  describe('setSessionState', () => {
    it('should update session state', () => {
      const session = manager.createSession({
        projectRoot: '/test/project',
        transport: createMockTransport(),
      });
      
      const updated = manager.setSessionState(session.id, 'idle');
      expect(updated?.state).toBe('idle');
    });

    it('should update last activity when changing state', () => {
      const session = manager.createSession({
        projectRoot: '/test/project',
        transport: createMockTransport(),
      });
      
      const originalActivity = session.lastActivity;
      now += 1000;
      
      const updated = manager.setSessionState(session.id, 'idle');
      expect(updated?.lastActivity).toBeGreaterThan(originalActivity);
    });

    it('should return undefined for non-existent session', () => {
      const updated = manager.setSessionState('non-existent-id', 'idle');
      expect(updated).toBeUndefined();
    });
  });

  describe('cleanupIdleSessions', () => {
    it('should mark sessions as idle after timeout', async () => {
      const shortTimeoutManager = new ACPSessionManager({
        idleTimeout: 5000,
        maxSessions: 10,
      });
      
      const session = shortTimeoutManager.createSession({
        projectRoot: '/test/project',
        transport: createMockTransport(),
      });
      
      now += 6000;
      shortTimeoutManager.cleanupIdleSessions();
      
      const updated = shortTimeoutManager.getSession(session.id);
      expect(updated?.state).toBe('idle');
    });

    it('should close sessions after double timeout', async () => {
      const shortTimeoutManager = new ACPSessionManager({
        idleTimeout: 5000,
        maxSessions: 10,
      });
      
      const session = shortTimeoutManager.createSession({
        projectRoot: '/test/project',
        transport: createMockTransport(),
      });
      
      now += 11000; // More than double timeout
      const closed = shortTimeoutManager.cleanupIdleSessions();
      
      expect(closed).toBe(1);
      expect(shortTimeoutManager.getSession(session.id)).toBeUndefined();
    });

    it('should return count of closed sessions', async () => {
      const shortTimeoutManager = new ACPSessionManager({
        idleTimeout: 5000,
        maxSessions: 10,
      });
      
      shortTimeoutManager.createSession({
        projectRoot: '/test/project1',
        transport: createMockTransport(),
      });
      
      shortTimeoutManager.createSession({
        projectRoot: '/test/project2',
        transport: createMockTransport(),
      });
      
      now += 11000;
      const closed = shortTimeoutManager.cleanupIdleSessions();
      
      expect(closed).toBe(2);
    });

    it('should not close active sessions', () => {
      const session = manager.createSession({
        projectRoot: '/test/project',
        transport: createMockTransport(),
      });
      
      now += 1000;
      manager.updateActivity(session.id);
      
      const closed = manager.cleanupIdleSessions();
      expect(closed).toBe(0);
      expect(manager.getSession(session.id)).toBeDefined();
    });
  });

  describe('isSessionExpired', () => {
    it('should return true for expired sessions', async () => {
      const shortTimeoutManager = new ACPSessionManager({
        idleTimeout: 5000,
        maxSessions: 10,
      });
      
      const session = shortTimeoutManager.createSession({
        projectRoot: '/test/project',
        transport: createMockTransport(),
      });
      
      now += 6000;
      expect(shortTimeoutManager.isSessionExpired(session.id)).toBe(true);
    });

    it('should return false for active sessions', () => {
      const session = manager.createSession({
        projectRoot: '/test/project',
        transport: createMockTransport(),
      });
      
      expect(manager.isSessionExpired(session.id)).toBe(false);
    });

    it('should return true for non-existent sessions', () => {
      expect(manager.isSessionExpired('non-existent-id')).toBe(true);
    });
  });

  describe('getStats', () => {
    it('should return session statistics', () => {
      manager.createSession({
        projectRoot: '/test/project1',
        transport: createMockTransport('stdio'),
        initialState: 'active',
      });
      
      manager.createSession({
        projectRoot: '/test/project2',
        transport: createMockTransport('websocket'),
        initialState: 'idle',
      });
      
      const stats = manager.getStats();
      
      expect(stats.total).toBe(2);
      expect(stats.byState.active).toBe(1);
      expect(stats.byState.idle).toBe(1);
      expect(stats.byTransport.stdio).toBe(1);
      expect(stats.byTransport.websocket).toBe(1);
    });

    it('should calculate average duration for closed sessions', () => {
      const session = manager.createSession({
        projectRoot: '/test/project',
        transport: createMockTransport(),
      });
      
      now += 5000;
      manager.closeSession(session.id);
      
      const stats = manager.getStats();
      expect(stats.averageDuration).toBeGreaterThanOrEqual(5000);
    });

    it('should return null for average duration with no closed sessions', () => {
      manager.createSession({
        projectRoot: '/test/project',
        transport: createMockTransport(),
      });
      
      const stats = manager.getStats();
      expect(stats.averageDuration).toBeNull();
    });

    it('should track oldest active session', () => {
      const session1 = manager.createSession({
        projectRoot: '/test/project1',
        transport: createMockTransport(),
      });
      
      now += 1000;
      
      manager.createSession({
        projectRoot: '/test/project2',
        transport: createMockTransport(),
      });
      
      const stats = manager.getStats();
      expect(stats.oldestActiveSession).toBe(session1.connectedAt);
    });
  });

  describe('utility methods', () => {
    it('should get active session count', () => {
      manager.createSession({
        projectRoot: '/test/project1',
        transport: createMockTransport(),
      });
      
      manager.createSession({
        projectRoot: '/test/project2',
        transport: createMockTransport(),
      });
      
      expect(manager.getActiveSessionCount()).toBe(2);
    });

    it('should check if session exists', () => {
      const session = manager.createSession({
        projectRoot: '/test/project',
        transport: createMockTransport(),
      });
      
      expect(manager.hasSession(session.id)).toBe(true);
      expect(manager.hasSession('non-existent-id')).toBe(false);
    });

    it('should close all sessions', () => {
      manager.createSession({
        projectRoot: '/test/project1',
        transport: createMockTransport(),
      });
      
      manager.createSession({
        projectRoot: '/test/project2',
        transport: createMockTransport(),
      });
      
      const closed = manager.closeAllSessions();
      expect(closed).toBe(2);
      expect(manager.getActiveSessionCount()).toBe(0);
    });

    it('should get session history with limit', () => {
      const session1 = manager.createSession({
        projectRoot: '/test/project1',
        transport: createMockTransport(),
      });
      
      now += 100;
      
      const session2 = manager.createSession({
        projectRoot: '/test/project2',
        transport: createMockTransport(),
      });
      
      manager.closeSession(session1.id);
      manager.closeSession(session2.id);
      
      const history = manager.getSessionHistory(1);
      expect(history).toHaveLength(1);
    });

    it('should clear history', () => {
      const session = manager.createSession({
        projectRoot: '/test/project',
        transport: createMockTransport(),
      });
      
      manager.closeSession(session.id);
      manager.clearHistory();
      
      const history = manager.getSessionHistory();
      expect(history).toHaveLength(0);
    });

    it('should use default hash when no hash function provided', () => {
      const defaultManager = new ACPSessionManager({});
      
      const session = defaultManager.createSession({
        projectRoot: '/test/project',
        transport: createMockTransport(),
      });
      
      expect(session.tasteVaultSnapshotHash).toBe('default-hash');
    });
  });
});

// ============================================================================
// Descriptor/Capabilities Tests (13 tests)
// ============================================================================

describe('Descriptor and Capabilities', () => {
  describe('createNova26Descriptor', () => {
    it('should create Nova26 descriptor with correct metadata', () => {
      const descriptor = createNova26Descriptor();
      
      expect(descriptor.id).toBe('nova26');
      expect(descriptor.name).toBe('Nova26 R21-02');
      expect(descriptor.version).toBe('R21-02');
      expect(descriptor.author).toBe('Nova26 Team');
      expect(descriptor.website).toBe('https://nova26.dev');
      expect(descriptor.icon).toBe('🚀');
    });

    it('should include all 20 agents', () => {
      const descriptor = createNova26Descriptor();
      const allAgents = getAllNova26Agents();
      
      expect(allAgents).toHaveLength(20);
      
      // Count total capabilities
      const totalCapabilities = allAgents.reduce((sum, agent) => sum + agent.capabilities.length, 0);
      expect(descriptor.capabilities).toHaveLength(totalCapabilities);
    });

    it('should include orchestrator capabilities', () => {
      const descriptor = createNova26Descriptor();
      
      const orchestratorCaps = descriptor.capabilities.filter(
        cap => cap.agentSource === 'nova26-orchestrator'
      );
      
      expect(orchestratorCaps).toHaveLength(4);
      expect(orchestratorCaps.map(c => c.id)).toContain('orchestrate.task-delegate');
      expect(orchestratorCaps.map(c => c.id)).toContain('orchestrate.workflow');
      expect(orchestratorCaps.map(c => c.id)).toContain('orchestrate.agent-select');
      expect(orchestratorCaps.map(c => c.id)).toContain('orchestrate.plan-approval');
    });

    it('should include ACE capabilities', () => {
      const descriptor = createNova26Descriptor();
      
      const aceCaps = descriptor.capabilities.filter(
        cap => cap.agentSource === 'nova26-ace'
      );
      
      expect(aceCaps).toHaveLength(3);
      expect(aceCaps.map(c => c.id)).toContain('ace.generate');
      expect(aceCaps.map(c => c.id)).toContain('ace.reflect');
      expect(aceCaps.map(c => c.id)).toContain('ace.curate');
    });

    it('should include Atlas capabilities', () => {
      const descriptor = createNova26Descriptor();
      
      const atlasCaps = descriptor.capabilities.filter(
        cap => cap.agentSource === 'nova26-atlas'
      );
      
      expect(atlasCaps).toHaveLength(3);
      expect(atlasCaps.map(c => c.id)).toContain('atlas.query');
      expect(atlasCaps.map(c => c.id)).toContain('atlas.store');
      expect(atlasCaps.map(c => c.id)).toContain('atlas.retrospective');
    });

    it('should include TasteVault capabilities', () => {
      const descriptor = createNova26Descriptor();
      
      const tasteCaps = descriptor.capabilities.filter(
        cap => cap.agentSource === 'nova26-taste-vault'
      );
      
      expect(tasteCaps).toHaveLength(3);
      expect(tasteCaps.map(c => c.id)).toContain('taste.capture');
      expect(tasteCaps.map(c => c.id)).toContain('taste.apply');
      expect(tasteCaps.map(c => c.id)).toContain('taste.analyze');
    });

    it('should include Gates capabilities', () => {
      const descriptor = createNova26Descriptor();
      
      const gatesCaps = descriptor.capabilities.filter(
        cap => cap.agentSource === 'nova26-gates'
      );
      
      expect(gatesCaps).toHaveLength(3);
      expect(gatesCaps.map(c => c.id)).toContain('gates.typescript');
      expect(gatesCaps.map(c => c.id)).toContain('gates.tests');
      expect(gatesCaps.map(c => c.id)).toContain('gates.lint');
    });

    it('should include capability schemas', () => {
      const descriptor = createNova26Descriptor();
      
      const capability = descriptor.capabilities[0];
      expect(capability).toBeDefined();
      expect(capability?.inputSchema).toBeDefined();
      expect(capability?.outputSchema).toBeDefined();
    });

    it('should include capability tags', () => {
      const descriptor = createNova26Descriptor();
      
      const capability = descriptor.capabilities.find(c => c.id === 'orchestrate.task-delegate');
      expect(capability?.tags).toContain('orchestration');
      expect(capability?.tags).toContain('delegation');
      expect(capability?.tags).toContain('coordination');
    });

    it('should set requiresConfirmation correctly', () => {
      const descriptor = createNova26Descriptor();
      
      // Capabilities that require confirmation
      const planApproval = descriptor.capabilities.find(c => c.id === 'orchestrate.plan-approval');
      expect(planApproval?.requiresConfirmation).toBe(true);
      
      const rehearsalMerge = descriptor.capabilities.find(c => c.id === 'rehearsal.merge');
      expect(rehearsalMerge?.requiresConfirmation).toBe(true);
      
      const recoveryRollback = descriptor.capabilities.find(c => c.id === 'recovery.rollback');
      expect(recoveryRollback?.requiresConfirmation).toBe(true);
      
      const securityVault = descriptor.capabilities.find(c => c.id === 'security.vault');
      expect(securityVault?.requiresConfirmation).toBe(true);
      
      const migrateExecute = descriptor.capabilities.find(c => c.id === 'migrate.execute');
      expect(migrateExecute?.requiresConfirmation).toBe(true);
      
      // Capabilities that don't require confirmation
      const taskDelegate = descriptor.capabilities.find(c => c.id === 'orchestrate.task-delegate');
      expect(taskDelegate?.requiresConfirmation).toBe(false);
    });

    it('should get specific agent by ID', () => {
      const orchestrator = getNova26Agent('nova26-orchestrator');
      expect(orchestrator).toBeDefined();
      expect(orchestrator?.id).toBe('nova26-orchestrator');
      
      const ace = getNova26Agent('nova26-ace');
      expect(ace).toBeDefined();
      expect(ace?.id).toBe('nova26-ace');
    });

    it('should return undefined for unknown agent ID', () => {
      const unknown = getNova26Agent('unknown-agent');
      expect(unknown).toBeUndefined();
    });

    it('should have all agents with consistent version', () => {
      const allAgents = getAllNova26Agents();
      
      for (const agent of allAgents) {
        expect(agent.version).toBe('R21-02');
        expect(agent.author).toBe('Nova26 Team');
      }
    });
  });
});

// ============================================================================
// Type Guards Tests
// ============================================================================

describe('Type Guards', () => {
  describe('isACPRequest', () => {
    it('should return true for valid requests', () => {
      expect(isACPRequest({ jsonrpc: '2.0', id: 1, method: 'test' })).toBe(true);
      expect(isACPRequest({ jsonrpc: '2.0', id: 'abc', method: 'test' })).toBe(true);
    });

    it('should return false for notifications', () => {
      expect(isACPRequest({ jsonrpc: '2.0', method: 'test', id: null })).toBe(false);
    });

    it('should return false for responses', () => {
      expect(isACPRequest({ jsonrpc: '2.0', id: 1, result: {} })).toBe(false);
    });
  });

  describe('isACPResponse', () => {
    it('should return true for success responses', () => {
      expect(isACPResponse({ jsonrpc: '2.0', id: 1, result: {} })).toBe(true);
    });

    it('should return true for error responses', () => {
      expect(isACPResponse({ jsonrpc: '2.0', id: 1, error: { code: 1, message: 'err' } })).toBe(true);
    });

    it('should return false for requests', () => {
      expect(isACPResponse({ jsonrpc: '2.0', id: 1, method: 'test' })).toBe(false);
    });
  });

  describe('isACPNotification', () => {
    it('should return true for notifications', () => {
      expect(isACPNotification({ jsonrpc: '2.0', method: 'test', id: null })).toBe(true);
    });

    it('should return false for requests with id', () => {
      expect(isACPNotification({ jsonrpc: '2.0', method: 'test', id: 1 })).toBe(false);
    });

    it('should return false for responses', () => {
      expect(isACPNotification({ jsonrpc: '2.0', id: 1, result: {} })).toBe(false);
    });
  });
});

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Testable ACP Client that allows mocking transport responses
 */
class TestableACPClient extends ACPClient {
  private mockResponse: ACPMessage | undefined;

  setMockResponse(response: ACPMessage): void {
    this.mockResponse = response;
  }

  simulateIncomingMessage(message: ACPMessage): void {
    this.handleIncomingMessage(message);
  }

  protected override async transportMessage(message: ACPMessage): Promise<void> {
    // Immediately trigger the response in the next microtask (if mock is set)
    if (this.mockResponse) {
      const response: ACPMessage = {
        ...this.mockResponse,
        id: message.id,
      };
      // Use setImmediate-like behavior with Promise.resolve
      await Promise.resolve();
      this.handleIncomingMessage(response);
    }
    // If no mock response, do nothing (request will timeout)
  }

  protected override async establishConnection(): Promise<void> {
    // Mock successful connection
    return Promise.resolve();
  }

  protected override async closeConnection(): Promise<void> {
    // Mock successful disconnection
    return Promise.resolve();
  }
}
