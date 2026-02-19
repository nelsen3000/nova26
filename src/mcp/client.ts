// MCP Client Implementation
// R21-01: MCP Integration Module

import { EventEmitter } from 'events';
import { readFile, readdir } from 'fs/promises';
import { join } from 'path';
import type {
  MCPClientConfig,
  MCPTransport,
  MCPRequest,
  MCPResponse,
  MCPServerDiscoveryResult,
  MCPConnectionState,
  MCPToolDefinition,
  MCPToolCallParams,
  MCPToolCallResult,
  MCPResourceDefinition,
  MCPResourceRequestParams,
  MCPPromptDefinition,
  MCPPromptRequestParams,
  MCPPromptGetResult,
  MCPErrorCode,
} from './types.js';

/**
 * Configuration for local server discovery
 */
export interface LocalDiscoveryConfig {
  /** Directories to scan for MCP server manifests */
  scanPaths: string[];
  /** File pattern to match manifests */
  manifestPattern: string;
}

/**
 * MCP Client for connecting to MCP servers
 */
export class MCPClient extends EventEmitter {
  private config: MCPClientConfig;
  private state: MCPConnectionState = 'disconnected';
  private transport: MCPTransport | null = null;
  private requestId: number = 0;
  private pendingRequests: Map<string | number, (response: MCPResponse) => void> = new Map();
  private messageHandler: ((message: MCPResponse) => void) | null = null;
  private disconnectHandler: (() => void) | null = null;
  private serverInfo: MCPServerDiscoveryResult | null = null;
  private connectionTimeout: number = 30000;

  constructor(config: MCPClientConfig) {
    super();
    this.config = config;
    this.connectionTimeout = config.timeout || 30000;
  }

  /**
   * Connect to an MCP server
   */
  async connect(): Promise<void> {
    if (this.state === 'connected' || this.state === 'connecting') {
      return;
    }

    this.state = 'connecting';
    this.emit('connecting');

    try {
      await this.initializeTransport(this.config.transport);
      
      // Perform initialization handshake
      const initResponse = await this.sendRequest({
        jsonrpc: '2.0',
        id: this.nextRequestId(),
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          clientInfo: {
            name: 'nova26-mcp-client',
            version: '1.0.0',
          },
          capabilities: {
            tools: {},
            resources: {},
            prompts: {},
          },
        },
      });

      if (initResponse.error) {
        throw new Error(`Initialization failed: ${initResponse.error.message}`);
      }

      // Send initialized notification
      await this.sendNotification('notifications/initialized', {});

      // Cache server info
      this.serverInfo = {
        name: (initResponse.result as { serverInfo?: { name: string } })?.serverInfo?.name || 'unknown',
        version: (initResponse.result as { serverInfo?: { version: string } })?.serverInfo?.version || 'unknown',
        instructions: (initResponse.result as { instructions?: string })?.instructions,
        tools: [],
        resources: [],
        prompts: [],
      };

      this.state = 'connected';
      this.emit('connected', this.serverInfo);
    } catch (error) {
      this.state = 'error';
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Disconnect from the MCP server
   */
  async disconnect(): Promise<void> {
    if (this.state === 'disconnected') {
      return;
    }

    // Cleanup stored references
    void this.transport;
    void this.messageHandler;

    try {
      // Send shutdown notification if connected
      if (this.state === 'connected') {
        await this.sendNotification('notifications/shutdown', {});
      }

      // Close transport
      if (this.disconnectHandler) {
        await this.disconnectHandler();
      }

      // Clear pending requests
      for (const [id, reject] of Array.from(this.pendingRequests.entries())) {
        reject({
          jsonrpc: '2.0',
          id,
          error: {
            code: -32603 as MCPErrorCode, // InternalError
            message: 'Connection closed',
          },
        });
      }
      this.pendingRequests.clear();

      this.state = 'disconnected';
      this.serverInfo = null;
      this.emit('disconnected');
    } catch (error) {
      this.state = 'error';
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Get current connection state
   */
  getState(): MCPConnectionState {
    return this.state;
  }

  /**
   * Check if client is connected
   */
  isConnected(): boolean {
    return this.state === 'connected';
  }

  /**
   * Discover available tools from the server
   */
  async discoverTools(): Promise<MCPToolDefinition[]> {
    this.ensureConnected();

    const response = await this.sendRequest({
      jsonrpc: '2.0',
      id: this.nextRequestId(),
      method: 'tools/list',
    });

    if (response.error) {
      throw new Error(`Failed to list tools: ${response.error.message}`);
    }

    const tools = (response.result as { tools?: MCPToolDefinition[] })?.tools || [];
    
    if (this.serverInfo) {
      this.serverInfo.tools = tools;
    }

    return tools;
  }

  /**
   * Call a tool on the server
   */
  async callTool(name: string, args: Record<string, unknown>): Promise<MCPToolCallResult> {
    this.ensureConnected();

    const params: MCPToolCallParams = {
      name,
      arguments: args,
    };

    const response = await this.sendRequest({
      jsonrpc: '2.0',
      id: this.nextRequestId(),
      method: 'tools/call',
      params,
    });

    if (response.error) {
      throw new Error(`Tool call failed: ${response.error.message}`);
    }

    return response.result as MCPToolCallResult;
  }

  /**
   * List available resources from the server
   */
  async listResources(): Promise<MCPResourceDefinition[]> {
    this.ensureConnected();

    const response = await this.sendRequest({
      jsonrpc: '2.0',
      id: this.nextRequestId(),
      method: 'resources/list',
    });

    if (response.error) {
      throw new Error(`Failed to list resources: ${response.error.message}`);
    }

    const resources = (response.result as { resources?: MCPResourceDefinition[] })?.resources || [];
    
    if (this.serverInfo) {
      this.serverInfo.resources = resources;
    }

    return resources;
  }

  /**
   * Read a resource from the server
   */
  async readResource(uri: string): Promise<{ mimeType: string; text: string }> {
    this.ensureConnected();

    const params: MCPResourceRequestParams = {
      uri,
    };

    const response = await this.sendRequest({
      jsonrpc: '2.0',
      id: this.nextRequestId(),
      method: 'resources/read',
      params,
    });

    if (response.error) {
      throw new Error(`Failed to read resource: ${response.error.message}`);
    }

    const result = response.result as { 
      contents?: Array<{ mimeType?: string; text?: string }> 
    };
    const content = result?.contents?.[0];

    if (!content) {
      throw new Error('Resource content not found');
    }

    return {
      mimeType: content.mimeType || 'text/plain',
      text: content.text || '',
    };
  }

  /**
   * List available prompts from the server
   */
  async listPrompts(): Promise<MCPPromptDefinition[]> {
    this.ensureConnected();

    const response = await this.sendRequest({
      jsonrpc: '2.0',
      id: this.nextRequestId(),
      method: 'prompts/list',
    });

    if (response.error) {
      throw new Error(`Failed to list prompts: ${response.error.message}`);
    }

    const prompts = (response.result as { prompts?: MCPPromptDefinition[] })?.prompts || [];
    
    if (this.serverInfo) {
      this.serverInfo.prompts = prompts;
    }

    return prompts;
  }

  /**
   * Get a prompt from the server
   */
  async getPrompt(name: string, args?: Record<string, string>): Promise<MCPPromptGetResult> {
    this.ensureConnected();

    const params: MCPPromptRequestParams = {
      name,
      arguments: args,
    };

    const response = await this.sendRequest({
      jsonrpc: '2.0',
      id: this.nextRequestId(),
      method: 'prompts/get',
      params,
    });

    if (response.error) {
      throw new Error(`Failed to get prompt: ${response.error.message}`);
    }

    return response.result as MCPPromptGetResult;
  }

  /**
   * Get cached server info
   */
  getServerInfo(): MCPServerDiscoveryResult | null {
    return this.serverInfo ? { ...this.serverInfo } : null;
  }

  /**
   * Get client configuration
   */
  getConfig(): MCPClientConfig {
    return { ...this.config };
  }

  /**
   * Scan for local MCP server manifests
   */
  static async discoverLocalServers(config: LocalDiscoveryConfig): Promise<Array<{
    name: string;
    path: string;
    manifest: unknown;
  }>> {
    const results: Array<{ name: string; path: string; manifest: unknown }> = [];

    for (const scanPath of config.scanPaths) {
      try {
        const entries = await readdir(scanPath, { withFileTypes: true });
        
        for (const entry of entries) {
          if (entry.isFile() && entry.name.match(config.manifestPattern)) {
            const manifestPath = join(scanPath, entry.name);
            try {
              const content = await readFile(manifestPath, 'utf-8');
              const manifest = JSON.parse(content) as unknown;
              results.push({
                name: entry.name,
                path: manifestPath,
                manifest,
              });
            } catch {
              // Skip invalid manifests
            }
          }
        }
      } catch {
        // Skip inaccessible directories
      }
    }

    return results;
  }

  // ============================================================================
  // Private methods
  // ============================================================================

  private ensureConnected(): void {
    if (this.state !== 'connected') {
      throw new Error('Client is not connected');
    }
  }

  private nextRequestId(): number {
    return ++this.requestId;
  }

  private async sendRequest(request: MCPRequest): Promise<MCPResponse> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(request.id);
        reject(new Error(`Request timeout after ${this.connectionTimeout}ms`));
      }, this.connectionTimeout);

      this.pendingRequests.set(request.id, (response) => {
        clearTimeout(timeout);
        resolve(response);
      });

      this.emit('send', request);
    });
  }

  private async sendNotification(method: string, params: unknown): Promise<void> {
    const notification: MCPRequest = {
      jsonrpc: '2.0',
      id: this.nextRequestId(),
      method,
      params,
    };
    this.emit('send', notification);
  }

  private handleIncomingMessage(message: MCPResponse): void {
    // Handle responses to pending requests
    const pendingResolver = this.pendingRequests.get(message.id);
    if (pendingResolver) {
      this.pendingRequests.delete(message.id);
      pendingResolver(message);
      return;
    }

    // Handle server-initiated notifications
    if ('method' in message) {
      const notification = message as unknown as { method: string; params?: unknown };
      this.emit('notification', notification.method, notification.params);
    }
  }

  private async initializeTransport(transport: MCPTransport): Promise<void> {
    this.transport = transport;

    switch (transport.type) {
      case 'stdio':
        await this.initializeStdioTransport(transport);
        break;
      case 'streamable-http':
        await this.initializeHttpTransport(transport);
        break;
      case 'sse':
        await this.initializeSSETransport(transport);
        break;
      case 'websocket':
        await this.initializeWebSocketTransport(transport);
        break;
      default:
        throw new Error(`Unsupported transport type: ${transport.type}`);
    }
  }

  private async initializeStdioTransport(_transport: MCPTransport): Promise<void> {
    // STDIO transport - connect to process stdin/stdout
    this.messageHandler = (message: MCPResponse) => {
      this.handleIncomingMessage(message);
    };

    this.disconnectHandler = async () => {
      // Cleanup STDIO resources
      this.messageHandler = null;
    };

    // In a real implementation, this would spawn a subprocess
    // and wire up stdin/stdout for JSON-RPC communication
    this.emit('transportReady', 'stdio');
  }

  private async initializeHttpTransport(transport: MCPTransport): Promise<void> {
    const { host = 'localhost', port = 3000, path = '/mcp', secure = false } = transport.options;
    const protocol = secure ? 'https' : 'http';
    const baseUrl = `${protocol}://${host}:${port}${path}`;

    this.messageHandler = (message: MCPResponse) => {
      this.handleIncomingMessage(message);
    };

    this.disconnectHandler = async () => {
      // Cleanup HTTP resources
      this.messageHandler = null;
    };

    this.emit('transportReady', 'streamable-http', baseUrl);
  }

  private async initializeSSETransport(transport: MCPTransport): Promise<void> {
    const { host = 'localhost', port = 3000, path = '/mcp/sse', secure = false } = transport.options;
    const protocol = secure ? 'https' : 'http';
    const url = `${protocol}://${host}:${port}${path}`;

    this.messageHandler = (message: MCPResponse) => {
      this.handleIncomingMessage(message);
    };

    this.disconnectHandler = async () => {
      // Cleanup SSE resources
      this.messageHandler = null;
    };

    this.emit('transportReady', 'sse', url);
  }

  private async initializeWebSocketTransport(transport: MCPTransport): Promise<void> {
    const { host = 'localhost', port = 3000, path = '/mcp/ws', secure = false } = transport.options;
    const protocol = secure ? 'wss' : 'ws';
    const url = `${protocol}://${host}:${port}${path}`;

    this.messageHandler = (message: MCPResponse) => {
      this.handleIncomingMessage(message);
    };

    this.disconnectHandler = async () => {
      // Cleanup WebSocket resources
      this.messageHandler = null;
    };

    this.emit('transportReady', 'websocket', url);
  }
}

/**
 * MCP Client Manager for handling multiple client connections
 */
export class MCPClientManager {
  private clients: Map<string, MCPClient> = new Map();
  private configs: Map<string, MCPClientConfig> = new Map();

  /**
   * Register a client configuration
   */
  registerClient(name: string, config: MCPClientConfig): void {
    this.configs.set(name, config);
  }

  /**
   * Connect to a registered client
   */
  async connect(name: string): Promise<MCPClient> {
    const config = this.configs.get(name);
    if (!config) {
      throw new Error(`Client configuration not found: ${name}`);
    }

    const existing = this.clients.get(name);
    if (existing?.isConnected()) {
      return existing;
    }

    const client = new MCPClient(config);
    await client.connect();
    this.clients.set(name, client);
    return client;
  }

  /**
   * Disconnect a client
   */
  async disconnect(name: string): Promise<void> {
    const client = this.clients.get(name);
    if (client) {
      await client.disconnect();
      this.clients.delete(name);
    }
  }

  /**
   * Get a connected client
   */
  getClient(name: string): MCPClient | undefined {
    const client = this.clients.get(name);
    return client?.isConnected() ? client : undefined;
  }

  /**
   * List all connected clients
   */
  listConnected(): string[] {
    return Array.from(this.clients.entries())
      .filter(([, client]) => client.isConnected())
      .map(([name]) => name);
  }

  /**
   * Disconnect all clients
   */
  async disconnectAll(): Promise<void> {
    const disconnectPromises = Array.from(this.clients.entries()).map(
      async ([name, client]) => {
        try {
          await client.disconnect();
        } catch (error) {
          console.error(`Failed to disconnect client ${name}:`, error);
        }
      }
    );
    await Promise.all(disconnectPromises);
    this.clients.clear();
  }
}
