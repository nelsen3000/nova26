/**
 * ACP (Agent Client Protocol) Server
 * 
 * Server implementation for the Agent Client Protocol.
 * Handles agent registration, capability negotiation, and message routing.
 */

import {
  type ACPAgentDescriptor,
  type ACPCapability,
  type ACPCapabilityDiscovery,
  type ACPMessage,
  type ACPError,
  ACPErrorCodes,
  isACPRequest,
} from './types.js';

/**
 * Handler function for ACP messages
 */
export type ACPMessageHandler = (message: ACPMessage) => Promise<ACPMessage | undefined>;

/**
 * Capability handler function
 */
export type ACPCapabilityHandler = (input: unknown, context?: Record<string, unknown>) => Promise<unknown>;

/**
 * Server configuration options
 */
export interface ACPServerOptions {
  /** Server name */
  name: string;
  /** Server version */
  version: string;
  /** Enable request logging */
  enableLogging?: boolean;
  /** Default request timeout in milliseconds */
  defaultTimeout?: number;
}

/**
 * ACP Server implementation
 */
export class ACPServer {
  private readonly options: Required<ACPServerOptions>;
  private readonly agents: Map<string, ACPAgentDescriptor> = new Map();
  private readonly capabilities: Map<string, ACPCapability> = new Map();
  private readonly capabilityHandlers: Map<string, ACPCapabilityHandler> = new Map();
  private readonly messageHandlers: Set<ACPMessageHandler> = new Set();
  private isRunning = false;

  /**
   * Create a new ACP Server
   * @param options - Server configuration
   */
  constructor(options: ACPServerOptions) {
    this.options = {
      enableLogging: false,
      defaultTimeout: 30000,
      ...options,
    };
  }

  /**
   * Start the ACP server
   * @returns Promise that resolves when server is ready
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('ACP Server is already running');
    }

    this.isRunning = true;
    
    if (this.options.enableLogging) {
      console.log(`[ACP Server] ${this.options.name} v${this.options.version} started`);
    }
  }

  /**
   * Stop the ACP server
   * @returns Promise that resolves when server is stopped
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    this.agents.clear();
    this.capabilities.clear();
    this.capabilityHandlers.clear();
    this.messageHandlers.clear();

    if (this.options.enableLogging) {
      console.log('[ACP Server] Stopped');
    }
  }

  /**
   * Check if the server is running
   * @returns True if server is active
   */
  get running(): boolean {
    return this.isRunning;
  }

  /**
   * Register an agent with the server
   * @param descriptor - Agent descriptor
   * @returns True if registration succeeded
   */
  registerAgent(descriptor: ACPAgentDescriptor): boolean {
    if (!this.isRunning) {
      throw new Error('Cannot register agent: server is not running');
    }

    // Validate descriptor
    if (!descriptor.id || !descriptor.name || !descriptor.version) {
      throw new Error('Invalid agent descriptor: missing required fields');
    }

    // Check for duplicate
    if (this.agents.has(descriptor.id)) {
      if (this.options.enableLogging) {
        console.warn(`[ACP Server] Agent ${descriptor.id} is already registered`);
      }
      return false;
    }

    // Register agent
    this.agents.set(descriptor.id, descriptor);

    // Register all capabilities
    for (const capability of descriptor.capabilities) {
      this.capabilities.set(capability.id, capability);
      if (this.options.enableLogging) {
        console.log(`[ACP Server] Registered capability: ${capability.id}`);
      }
    }

    if (this.options.enableLogging) {
      console.log(`[ACP Server] Registered agent: ${descriptor.id}`);
    }

    return true;
  }

  /**
   * Unregister an agent
   * @param agentId - Agent ID to unregister
   * @returns True if unregistration succeeded
   */
  unregisterAgent(agentId: string): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return false;
    }

    // Remove capabilities
    for (const capability of agent.capabilities) {
      this.capabilities.delete(capability.id);
      this.capabilityHandlers.delete(capability.id);
    }

    this.agents.delete(agentId);

    if (this.options.enableLogging) {
      console.log(`[ACP Server] Unregistered agent: ${agentId}`);
    }

    return true;
  }

  /**
   * Register a handler for a specific capability
   * @param capabilityId - Capability ID
   * @param handler - Handler function
   * @returns True if handler was registered
   */
  registerCapabilityHandler(capabilityId: string, handler: ACPCapabilityHandler): boolean {
    if (!this.capabilities.has(capabilityId)) {
      if (this.options.enableLogging) {
        console.warn(`[ACP Server] Capability ${capabilityId} not found`);
      }
      return false;
    }

    this.capabilityHandlers.set(capabilityId, handler);
    
    if (this.options.enableLogging) {
      console.log(`[ACP Server] Registered handler for: ${capabilityId}`);
    }

    return true;
  }

  /**
   * Add a message handler for custom processing
   * @param handler - Message handler function
   */
  addMessageHandler(handler: ACPMessageHandler): void {
    this.messageHandlers.add(handler);
  }

  /**
   * Remove a message handler
   * @param handler - Handler to remove
   */
  removeMessageHandler(handler: ACPMessageHandler): void {
    this.messageHandlers.delete(handler);
  }

  /**
   * Handle an incoming ACP message
   * @param message - JSON-RPC message
   * @returns Response message or undefined for notifications
   */
  async handleMessage(message: ACPMessage): Promise<ACPMessage | undefined> {
    const messageId = message.id ?? undefined;

    if (!this.isRunning) {
      return this.createErrorResponse(
        messageId,
        ACPErrorCodes.SERVER_ERROR,
        'Server is not running'
      );
    }

    // Validate JSON-RPC version
    if (message.jsonrpc !== '2.0') {
      return this.createErrorResponse(
        messageId,
        ACPErrorCodes.INVALID_REQUEST,
        'Invalid JSON-RPC version'
      );
    }

    // Process through custom handlers first
    for (const handler of this.messageHandlers) {
      const result = await handler(message);
      if (result !== undefined) {
        return result;
      }
    }

    // Handle based on message type
    if (isACPRequest(message) && message.method) {
      return this.handleRequest(message);
    }

    // If it's a notification (no id), return undefined
    if (message.id === null) {
      return undefined;
    }

    // Invalid message
    return this.createErrorResponse(
      messageId,
      ACPErrorCodes.INVALID_REQUEST,
      'Invalid message structure'
    );
  }

  /**
   * Handle a request message
   * @param message - Request message
   * @returns Response message
   */
  private async handleRequest(message: ACPMessage): Promise<ACPMessage> {
    const { method, params, id } = message;
    const requestId = id ?? undefined;

    switch (method) {
      case 'acp/discover':
        return this.handleDiscover(requestId);

      case 'acp/invoke': {
        const capabilityId = (params as Record<string, string> | undefined)?.capabilityId;
        if (!capabilityId) {
          return this.createErrorResponse(
            requestId,
            ACPErrorCodes.INVALID_PARAMS,
            'Missing capabilityId parameter'
          );
        }
        const input = (params as Record<string, unknown> | undefined)?.input;
        const context = (params as Record<string, Record<string, unknown>> | undefined)?.context;
        return this.handleInvoke(requestId, capabilityId, input, context);
      }

      case 'acp/ping':
        return this.createSuccessResponse(requestId, { pong: true, timestamp: Date.now() });

      default:
        return this.createErrorResponse(
          requestId,
          ACPErrorCodes.METHOD_NOT_FOUND,
          `Method not found: ${method}`
        );
    }
  }

  /**
   * Handle capability discovery request
   * @param id - Request ID
   * @returns Discovery response
   */
  private handleDiscover(id: string | number | undefined): ACPMessage {
    const discovery: ACPCapabilityDiscovery = {
      capabilities: Array.from(this.capabilities.values()),
      agent: {
        id: this.options.name.toLowerCase().replace(/\s+/g, '-'),
        name: this.options.name,
        version: this.options.version,
      },
    };

    return this.createSuccessResponse(id, discovery);
  }

  /**
   * Handle capability invocation
   * @param id - Request ID
   * @param capabilityId - Capability to invoke
   * @param input - Input parameters
   * @param context - Optional context
   * @returns Invocation response
   */
  private async handleInvoke(
    id: string | number | undefined,
    capabilityId: string,
    input: unknown,
    context?: Record<string, unknown>
  ): Promise<ACPMessage> {
    const capability = this.capabilities.get(capabilityId);
    
    if (!capability) {
      return this.createErrorResponse(
        id,
        ACPErrorCodes.CAPABILITY_NOT_FOUND,
        `Capability not found: ${capabilityId}`
      );
    }

    const handler = this.capabilityHandlers.get(capabilityId);
    
    if (!handler) {
      return this.createErrorResponse(
        id,
        ACPErrorCodes.METHOD_NOT_FOUND,
        `No handler registered for capability: ${capabilityId}`
      );
    }

    try {
      const result = await handler(input, context);
      return this.createSuccessResponse(id, result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return this.createErrorResponse(
        id,
        ACPErrorCodes.INTERNAL_ERROR,
        `Capability invocation failed: ${errorMessage}`
      );
    }
  }

  /**
   * Negotiate capabilities between this server and a client
   * @param clientCapabilities - Capabilities offered by the client
   * @returns Intersection of compatible capabilities
   */
  negotiateCapabilities(clientCapabilities: ACPCapability[]): ACPCapability[] {
    const compatible: ACPCapability[] = [];

    for (const clientCap of clientCapabilities) {
      const serverCap = this.capabilities.get(clientCap.id);
      if (serverCap) {
        // Simple version check - can be extended for semver compatibility
        if (serverCap.agentSource === clientCap.agentSource) {
          compatible.push(serverCap);
        }
      }
    }

    return compatible;
  }

  /**
   * List all registered capabilities
   * @returns Array of all capabilities
   */
  listCapabilities(): ACPCapability[] {
    return Array.from(this.capabilities.values());
  }

  /**
   * Get all registered agents
   * @returns Array of agent descriptors
   */
  listAgents(): ACPAgentDescriptor[] {
    return Array.from(this.agents.values());
  }

  /**
   * Create a success response message
   * @param id - Request ID
   * @param result - Result data
   * @returns Response message
   */
  private createSuccessResponse(responseId: string | number | undefined, result: unknown): ACPMessage {
    return {
      jsonrpc: '2.0',
      id: responseId ?? undefined,
      result,
    };
  }

  /**
   * Create an error response message
   * @param id - Request ID
   * @param code - Error code
   * @param message - Error message
   * @returns Error response message
   */
  private createErrorResponse(
    responseId: string | number | undefined,
    code: number,
    message: string
  ): ACPMessage {
    const error: ACPError = { code, message };
    return {
      jsonrpc: '2.0',
      id: responseId ?? undefined,
      error,
    };
  }
}
