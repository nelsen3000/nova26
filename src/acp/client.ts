/**
 * ACP (Agent Client Protocol) Client
 * 
 * Client implementation for connecting to ACP-compatible agents and servers.
 * Supports capability discovery and invocation over various transports.
 */

import {
  type ACPCapability,
  type ACPCapabilityDiscovery,
  type ACPCapabilityInvocation,
  type ACPMessage,
  type ACPTransport,
  isACPResponse,
} from './types.js';

/**
 * Client configuration options
 */
export interface ACPClientOptions {
  /** Client name */
  name: string;
  /** Client version */
  version: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Connection state
 */
export type ACPConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * ACP Client implementation
 */
export class ACPClient {
  private readonly options: Required<ACPClientOptions>;
  private transport: ACPTransport | undefined;
  private connectionState: ACPConnectionState = 'disconnected';
  private messageIdCounter = 0;
  private pendingRequests: Map<string | number, {
    resolve: (value: ACPMessage) => void;
    reject: (reason: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
  }> = new Map();
  private discoveredCapabilities: Map<string, ACPCapability> = new Map();
  private serverInfo: ACPCapabilityDiscovery['agent'] | undefined;

  /**
   * Create a new ACP Client
   * @param options - Client configuration
   */
  constructor(options: ACPClientOptions) {
    this.options = {
      timeout: 30000,
      debug: false,
      ...options,
    };
  }

  /**
   * Get current connection state
   * @returns Current state
   */
  get state(): ACPConnectionState {
    return this.connectionState;
  }

  /**
   * Check if client is connected
   * @returns True if connected
   */
  get isConnected(): boolean {
    return this.connectionState === 'connected';
  }

  /**
   * Get discovered server info
   * @returns Server metadata or undefined
   */
  get serverMetadata(): ACPCapabilityDiscovery['agent'] | undefined {
    return this.serverInfo;
  }

  /**
   * Connect to an ACP server
   * @param transport - Transport configuration
   * @returns Promise that resolves when connected
   */
  async connect(transport: ACPTransport): Promise<void> {
    if (this.connectionState === 'connected') {
      throw new Error('Already connected');
    }

    if (this.connectionState === 'connecting') {
      throw new Error('Connection already in progress');
    }

    this.connectionState = 'connecting';
    this.transport = transport;

    try {
      await this.establishConnection(transport);
      this.connectionState = 'connected';
      
      if (this.options.debug) {
        console.log(`[ACP Client] Connected via ${transport.type}`);
      }

      // Auto-discover capabilities on connect
      await this.discoverCapabilities();
    } catch (error) {
      this.connectionState = 'error';
      this.transport = undefined;
      throw error;
    }
  }

  /**
   * Disconnect from the server
   * @returns Promise that resolves when disconnected
   */
  async disconnect(): Promise<void> {
    if (this.connectionState === 'disconnected') {
      return;
    }

    // Clear all pending requests
    for (const [_id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Client disconnected'));
    }
    this.pendingRequests.clear();

    await this.closeConnection();
    
    this.connectionState = 'disconnected';
    this.transport = undefined;
    this.discoveredCapabilities.clear();
    this.serverInfo = undefined;

    if (this.options.debug) {
      console.log('[ACP Client] Disconnected');
    }
  }

  /**
   * Discover capabilities from the connected server
   * @returns Discovered capabilities
   */
  async discoverCapabilities(): Promise<ACPCapability[]> {
    this.ensureConnected();

    const response = await this.sendRequest('acp/discover', {});

    if (response.error) {
      throw new Error(`Discovery failed: ${response.error.message}`);
    }

    const discovery = response.result as ACPCapabilityDiscovery;
    
    // Store discovered capabilities
    this.discoveredCapabilities.clear();
    for (const cap of discovery.capabilities) {
      this.discoveredCapabilities.set(cap.id, cap);
    }

    // Store server info
    this.serverInfo = discovery.agent;

    if (this.options.debug) {
      console.log(`[ACP Client] Discovered ${discovery.capabilities.length} capabilities`);
    }

    return discovery.capabilities;
  }

  /**
   * Get a discovered capability by ID
   * @param capabilityId - Capability ID
   * @returns Capability or undefined
   */
  getCapability(capabilityId: string): ACPCapability | undefined {
    return this.discoveredCapabilities.get(capabilityId);
  }

  /**
   * List all discovered capabilities
   * @returns Array of capabilities
   */
  listDiscoveredCapabilities(): ACPCapability[] {
    return Array.from(this.discoveredCapabilities.values());
  }

  /**
   * Invoke a capability on the server
   * @param capabilityId - Capability ID to invoke
   * @param input - Input parameters
   * @param context - Optional context
   * @returns Invocation result
   */
  async invokeCapability<T = unknown>(
    capabilityId: string,
    input: unknown,
    context?: Record<string, unknown>
  ): Promise<T> {
    this.ensureConnected();

    const capability = this.discoveredCapabilities.get(capabilityId);
    if (!capability) {
      throw new Error(`Capability not discovered: ${capabilityId}`);
    }

    if (this.options.debug) {
      console.log(`[ACP Client] Invoking capability: ${capabilityId}`);
    }

    const invocation: ACPCapabilityInvocation = {
      capabilityId,
      input,
      context,
    };

    const response = await this.sendRequest('acp/invoke', invocation);

    if (response.error) {
      throw new Error(`Invocation failed: ${response.error.message}`);
    }

    return response.result as T;
  }

  /**
   * Send a raw JSON-RPC message
   * @param message - Message to send
   * @returns Promise that resolves with response
   */
  async sendMessage(message: Omit<ACPMessage, 'jsonrpc'>): Promise<ACPMessage> {
    this.ensureConnected();

    const fullMessage: ACPMessage = {
      jsonrpc: '2.0',
      ...message,
    };

    return this.sendRequestWithResponse(fullMessage);
  }

  /**
   * Ping the server to check connectivity
   * @returns True if ping succeeded
   */
  async ping(): Promise<boolean> {
    try {
      const response = await this.sendRequest('acp/ping', {});
      return !response.error && (response.result as { pong?: boolean })?.pong === true;
    } catch {
      return false;
    }
  }

  /**
   * Send a request and wait for response
   * @param method - Method name
   * @param params - Method parameters
   * @returns Response message
   */
  private async sendRequest(method: string, params: unknown): Promise<ACPMessage> {
    const id = this.generateMessageId();
    const message: ACPMessage = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    return this.sendRequestWithResponse(message);
  }

  /**
   * Send a request message and wait for response
   * @param message - Request message
   * @returns Response message
   */
  private async sendRequestWithResponse(message: ACPMessage): Promise<ACPMessage> {
    const messageId = message.id;
    if (messageId === undefined || messageId === null) {
      throw new Error('Request must have an id');
    }

    return new Promise((resolve, reject) => {
      // Set timeout
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(messageId);
        reject(new Error(`Request timeout after ${this.options.timeout}ms`));
      }, this.options.timeout);

      // Store pending request
      this.pendingRequests.set(messageId, { resolve, reject, timeout });

      // Send the message
      this.transportMessage(message).catch((error: Error) => {
        clearTimeout(timeout);
        this.pendingRequests.delete(messageId);
        reject(error);
      });
    });
  }

  /**
   * Handle incoming message from transport
   * @param message - Received message
   */
  protected handleIncomingMessage(message: ACPMessage): void {
    if (this.options.debug) {
      console.log('[ACP Client] Received:', message);
    }

    // Handle responses to pending requests
    if (isACPResponse(message) && message.id !== undefined && message.id !== null) {
      const pending = this.pendingRequests.get(message.id);
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(message.id);
        pending.resolve(message);
        return;
      }
    }

    // Handle notifications or unsolicited messages
    if (message.method) {
      this.handleNotification(message);
    }
  }

  /**
   * Handle notification messages
   * @param message - Notification message
   */
  private handleNotification(message: ACPMessage): void {
    if (this.options.debug) {
      console.log(`[ACP Client] Received notification: ${message.method}`);
    }

    // Handle known notifications
    switch (message.method) {
      case 'acp/capabilityUpdated':
        // Re-discover capabilities
        this.discoverCapabilities().catch(() => {
          // Ignore discovery errors
        });
        break;

      default:
        if (this.options.debug) {
          console.log(`[ACP Client] Unhandled notification: ${message.method}`);
        }
    }
  }

  /**
   * Send message through transport layer
   * @param message - Message to send
   */
  private async transportMessage(message: ACPMessage): Promise<void> {
    if (!this.transport) {
      throw new Error('No transport configured');
    }

    if (this.options.debug) {
      console.log('[ACP Client] Sending:', message);
    }

    switch (this.transport.type) {
      case 'stdio':
        await this.sendStdio(message);
        break;
      case 'websocket':
        await this.sendWebsocket(message);
        break;
      case 'sse':
        await this.sendSse(message);
        break;
      default:
        throw new Error(`Unsupported transport: ${this.transport.type}`);
    }
  }

  /**
   * Establish connection based on transport type
   * @param transport - Transport configuration
   */
  private async establishConnection(transport: ACPTransport): Promise<void> {
    switch (transport.type) {
      case 'stdio':
        await this.connectStdio(transport);
        break;
      case 'websocket':
        await this.connectWebsocket(transport);
        break;
      case 'sse':
        await this.connectSse(transport);
        break;
      default:
        throw new Error(`Unsupported transport: ${transport.type}`);
    }
  }

  /**
   * Close the current connection
   */
  private async closeConnection(): Promise<void> {
    // Transport-specific cleanup would go here
    // This is a base implementation
  }

  /**
   * Ensure client is connected
   */
  private ensureConnected(): void {
    if (!this.isConnected) {
      throw new Error('Client is not connected');
    }
  }

  /**
   * Generate unique message ID
   * @returns Unique ID
   */
  private generateMessageId(): string {
    this.messageIdCounter++;
    return `${this.options.name}-${Date.now()}-${this.messageIdCounter}`;
  }

  // Transport-specific implementations (stubs for extensibility)

  private async connectStdio(_transport: ACPTransport): Promise<void> {
    // Implementation depends on specific stdio requirements
    // This is a stub for the base class
  }

  private async connectWebsocket(_transport: ACPTransport): Promise<void> {
    // Implementation depends on WebSocket library
    // This is a stub for the base class
  }

  private async connectSse(_transport: ACPTransport): Promise<void> {
    // Implementation depends on SSE library
    // This is a stub for the base class
  }

  private async sendStdio(_message: ACPMessage): Promise<void> {
    throw new Error('stdio transport not implemented in base client');
  }

  private async sendWebsocket(_message: ACPMessage): Promise<void> {
    throw new Error('websocket transport not implemented in base client');
  }

  private async sendSse(_message: ACPMessage): Promise<void> {
    throw new Error('sse transport not implemented in base client');
  }
}
