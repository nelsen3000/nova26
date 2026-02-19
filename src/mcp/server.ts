// MCP Server Implementation
// R21-01: MCP Integration Module

import { EventEmitter } from 'events';
import type {
  MCPServerConfig,
  MCPTransport,
  MCPRequest,
  MCPResponse,
  MCPToolDefinition,
  MCPResourceDefinition,
  MCPPromptDefinition,
  MCPToolCallParams,
  MCPToolCallResult,
  MCPResourceRequestParams,
  MCPPromptRequestParams,
  MCPPromptGetResult,
  MCPErrorCode,
  MCPToolConfirmationRequest,
  MCPToolConfirmationResponse,
  MCPResourceScopeResult,
} from './types.js';
import { MCPRegistry } from './registry.js';

/**
 * Tool execution handler function type
 */
export type ToolExecutionHandler = (
  params: MCPToolCallParams,
  confirmationResponse?: MCPToolConfirmationResponse
) => Promise<MCPToolCallResult>;

/**
 * Confirmation request handler function type
 */
export type ConfirmationRequestHandler = (
  request: MCPToolConfirmationRequest
) => Promise<MCPToolConfirmationResponse>;

/**
 * MCP Server implementation
 */
export class MCPServer extends EventEmitter {
  private config: MCPServerConfig;
  private registry: MCPRegistry;
  private started: boolean = false;
  private transportHandlers: Map<string, TransportHandler> = new Map();
  private toolExecutors: Map<string, ToolExecutionHandler> = new Map();
  private confirmationHandler: ConfirmationRequestHandler | null = null;
  private pendingConfirmations: Map<string, MCPToolConfirmationRequest> = new Map();

  constructor(config: MCPServerConfig, registry: MCPRegistry = new MCPRegistry()) {
    super();
    this.config = config;
    this.registry = registry;
  }

  /**
   * Start the MCP server
   */
  async start(): Promise<void> {
    if (this.started) {
      throw new Error('MCP server is already running');
    }

    if (!this.config.enabled) {
      throw new Error('MCP server is disabled in configuration');
    }

    // Initialize all configured transports
    for (const transport of this.config.transports) {
      await this.initializeTransport(transport);
    }

    this.started = true;
    this.emit('started', { serverName: this.config.serverName });
  }

  /**
   * Stop the MCP server
   */
  async stop(): Promise<void> {
    if (!this.started) {
      return;
    }

    // Close all transport handlers
    for (const [id, handler] of Array.from(this.transportHandlers.entries())) {
      await handler.close();
      this.transportHandlers.delete(id);
    }

    this.started = false;
    this.emit('stopped');
  }

  /**
   * Check if the server is running
   */
  isRunning(): boolean {
    return this.started;
  }

  /**
   * Register a tool with its execution handler
   */
  registerTool(
    definition: MCPToolDefinition,
    executor: ToolExecutionHandler
  ): string {
    const name = this.registry.registerTool(definition);
    this.toolExecutors.set(definition.name, executor);
    this.emit('toolRegistered', { name, definition });
    return name;
  }

  /**
   * Register a resource
   */
  registerResource(definition: MCPResourceDefinition): string {
    const uri = this.registry.registerResource(definition);
    this.emit('resourceRegistered', { uri, definition });
    return uri;
  }

  /**
   * Register a prompt
   */
  registerPrompt(definition: MCPPromptDefinition): string {
    const name = this.registry.registerPrompt(definition);
    this.emit('promptRegistered', { name, definition });
    return name;
  }

  /**
   * Set the confirmation handler for tools requiring confirmation
   */
  setConfirmationHandler(handler: ConfirmationRequestHandler): void {
    this.confirmationHandler = handler;
  }

  /**
   * Handle an incoming MCP request
   */
  async handleRequest(request: MCPRequest): Promise<MCPResponse> {
    try {
      switch (request.method) {
        case 'initialize':
          return this.handleInitialize(request);
        case 'tools/list':
          return this.handleListTools(request);
        case 'tools/call':
          return this.handleCallTool(request);
        case 'resources/list':
          return this.handleListResources(request);
        case 'resources/read':
          return this.handleReadResource(request);
        case 'prompts/list':
          return this.handleListPrompts(request);
        case 'prompts/get':
          return this.handleGetPrompt(request);
        default:
          return this.createErrorResponse(
            request.id,
            -32601 as MCPErrorCode, // MethodNotFound
            `Method not found: ${request.method}`
          );
      }
    } catch (error) {
      return this.createErrorResponse(
        request.id,
        -32603 as MCPErrorCode, // InternalError
        error instanceof Error ? error.message : 'Internal error'
      );
    }
  }

  /**
   * List all registered tools
   */
  listTools(): MCPToolDefinition[] {
    return this.registry.listTools();
  }

  /**
   * List all registered resources
   */
  listResources(): MCPResourceDefinition[] {
    return this.registry.listResources();
  }

  /**
   * List all registered prompts
   */
  listPrompts(): MCPPromptDefinition[] {
    return this.registry.listPrompts();
  }

  /**
   * Get the server configuration
   */
  getConfig(): MCPServerConfig {
    return { ...this.config };
  }

  /**
   * Get the underlying registry
   */
  getRegistry(): MCPRegistry {
    return this.registry;
  }

  // ============================================================================
  // Private handlers
  // ============================================================================

  private handleInitialize(request: MCPRequest): MCPResponse {
    return {
      jsonrpc: '2.0',
      id: request.id,
      result: {
        protocolVersion: '2024-11-05',
        serverInfo: {
          name: this.config.serverName,
          version: this.config.version,
        },
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
        instructions: this.config.instructions,
      },
    };
  }

  private handleListTools(request: MCPRequest): MCPResponse {
    return {
      jsonrpc: '2.0',
      id: request.id,
      result: {
        tools: this.registry.listTools(),
      },
    };
  }

  private async handleCallTool(request: MCPRequest): Promise<MCPResponse> {
    const params = request.params as MCPToolCallParams | undefined;
    
    if (!params?.name) {
      return this.createErrorResponse(
        request.id,
        -32602 as MCPErrorCode, // InvalidParams
        'Missing tool name'
      );
    }

    const tool = this.registry.getTool(params.name);
    if (!tool) {
      return this.createErrorResponse(
        request.id,
        -32001 as MCPErrorCode, // UnknownTool
        `Unknown tool: ${params.name}`
      );
    }

    // Check allowlist
    if (this.config.allowlist.length > 0 && 
        !this.config.allowlist.includes(params.name)) {
      return this.createErrorResponse(
        request.id,
        -32000 as MCPErrorCode, // ToolExecutionError
        `Tool not in allowlist: ${params.name}`
      );
    }

    // Handle confirmation if required
    if (tool.requiresConfirmation && this.confirmationHandler) {
      const requestId = `confirm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const confirmationRequest: MCPToolConfirmationRequest = {
        toolName: params.name,
        arguments: params.arguments || {},
        requestId,
        timestamp: new Date().toISOString(),
      };

      this.pendingConfirmations.set(requestId, confirmationRequest);
      
      const response = await this.confirmationHandler(confirmationRequest);
      this.pendingConfirmations.delete(requestId);

      if (!response.approved) {
        return this.createErrorResponse(
          request.id,
          -31997 as MCPErrorCode, // ConfirmationRequired
          `Tool execution denied: ${response.reason || 'No reason provided'}`
        );
      }
    }

    // Execute the tool
    const executor = this.toolExecutors.get(params.name);
    if (!executor) {
      return this.createErrorResponse(
        request.id,
        -32000 as MCPErrorCode, // ToolExecutionError
        `No executor registered for tool: ${params.name}`
      );
    }

    try {
      const result = await executor(params);
      return {
        jsonrpc: '2.0',
        id: request.id,
        result,
      };
    } catch (error) {
      return this.createErrorResponse(
        request.id,
        -32000 as MCPErrorCode, // ToolExecutionError
        error instanceof Error ? error.message : 'Tool execution failed'
      );
    }
  }

  private handleListResources(request: MCPRequest): MCPResponse {
    return {
      jsonrpc: '2.0',
      id: request.id,
      result: {
        resources: this.registry.listResources(),
      },
    };
  }

  private async handleReadResource(request: MCPRequest): Promise<MCPResponse> {
    const params = request.params as MCPResourceRequestParams | undefined;
    
    if (!params?.uri) {
      return this.createErrorResponse(
        request.id,
        -32602 as MCPErrorCode, // InvalidParams
        'Missing resource URI'
      );
    }

    const resource = this.registry.getResource(params.uri);
    if (!resource) {
      return this.createErrorResponse(
        request.id,
        -31999 as MCPErrorCode, // ResourceNotFound
        `Resource not found: ${params.uri}`
      );
    }

    // Check resource scopes
    const scopeCheck = this.checkResourceScope(params.uri, resource);
    if (!scopeCheck.allowed) {
      return this.createErrorResponse(
        request.id,
        -32000 as MCPErrorCode, // ToolExecutionError
        `Access denied: missing scopes [${scopeCheck.missingScopes.join(', ')}]`
      );
    }

    try {
      const content = await resource.loadContent();
      return {
        jsonrpc: '2.0',
        id: request.id,
        result: {
          contents: [{
            uri: params.uri,
            mimeType: resource.mimeType,
            text: content,
          }],
        },
      };
    } catch (error) {
      return this.createErrorResponse(
        request.id,
        -32000 as MCPErrorCode, // ToolExecutionError
        error instanceof Error ? error.message : 'Failed to load resource'
      );
    }
  }

  private handleListPrompts(request: MCPRequest): MCPResponse {
    return {
      jsonrpc: '2.0',
      id: request.id,
      result: {
        prompts: this.registry.listPrompts(),
      },
    };
  }

  private handleGetPrompt(request: MCPRequest): MCPResponse {
    const params = request.params as MCPPromptRequestParams | undefined;
    
    if (!params?.name) {
      return this.createErrorResponse(
        request.id,
        -32602 as MCPErrorCode, // InvalidParams
        'Missing prompt name'
      );
    }

    const prompt = this.registry.getPrompt(params.name);
    if (!prompt) {
      return this.createErrorResponse(
        request.id,
        -31998 as MCPErrorCode, // PromptNotFound
        `Prompt not found: ${params.name}`
      );
    }

    // Process template with provided arguments
    let processedTemplate = prompt.template;
    const args = params.arguments || {};
    
    for (const [key, value] of Object.entries(args)) {
      processedTemplate = processedTemplate.replace(
        new RegExp(`\\{\\{${key}\\}\\}`, 'g'),
        value
      );
    }

    const result: MCPPromptGetResult = {
      description: prompt.description,
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: processedTemplate,
        },
      }],
    };

    return {
      jsonrpc: '2.0',
      id: request.id,
      result,
    };
  }

  // ============================================================================
  // Utility methods
  // ============================================================================

  private createErrorResponse(
    id: string | number,
    code: MCPErrorCode,
    message: string,
    data?: unknown
  ): MCPResponse {
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code,
        message,
        data,
      },
    };
  }

  private checkResourceScope(
    uri: string,
    resource: MCPResourceDefinition
  ): MCPResourceScopeResult {
    const requiredScopes = this.config.resourceScopes;
    const missingScopes: string[] = [];

    // Check if any required scopes are missing from the resource
    for (const scope of requiredScopes) {
      if (!resource.metadata.tasteVaultTags.includes(scope)) {
        missingScopes.push(scope);
      }
    }

    return {
      allowed: missingScopes.length === 0,
      uri,
      requiredScopes,
      missingScopes,
    };
  }

  private async initializeTransport(transport: MCPTransport): Promise<void> {
    const id = `transport-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const handler = new TransportHandler(transport, this);
    await handler.open();
    this.transportHandlers.set(id, handler);
  }
}

/**
 * Transport handler for managing individual transport connections
 */
class TransportHandler {
  private transport: MCPTransport;
  private server: MCPServer;
  private openHandler: (() => Promise<void>) | null = null;
  private closeHandler: (() => Promise<void>) | null = null;

  constructor(transport: MCPTransport, server: MCPServer) {
    this.transport = transport;
    this.server = server;
  }

  async open(): Promise<void> {
    switch (this.transport.type) {
      case 'stdio':
        await this.openStdio();
        break;
      case 'streamable-http':
        await this.openHttp();
        break;
      case 'sse':
        await this.openSSE();
        break;
      case 'websocket':
        await this.openWebSocket();
        break;
      default:
        throw new Error(`Unsupported transport type: ${this.transport.type}`);
    }
  }

  async close(): Promise<void> {
    void this.server; // maintain reference for cleanup
    if (this.closeHandler) {
      await this.closeHandler();
    }
  }

  private async openStdio(): Promise<void> {
    // STDIO transport implementation would go here
    // This reads from stdin and writes to stdout
    this.openHandler = async () => {
      // Implementation placeholder
    };
    this.closeHandler = async () => {
      // Implementation placeholder
    };
    await this.openHandler();
  }

  private async openHttp(): Promise<void> {
    // HTTP transport implementation would go here
    this.openHandler = async () => {
      // Implementation placeholder
    };
    this.closeHandler = async () => {
      // Implementation placeholder
    };
    await this.openHandler();
  }

  private async openSSE(): Promise<void> {
    // SSE transport implementation would go here
    this.openHandler = async () => {
      // Implementation placeholder
    };
    this.closeHandler = async () => {
      // Implementation placeholder
    };
    await this.openHandler();
  }

  private async openWebSocket(): Promise<void> {
    // WebSocket transport implementation would go here
    this.openHandler = async () => {
      // Implementation placeholder
    };
    this.closeHandler = async () => {
      // Implementation placeholder
    };
    await this.openHandler();
  }
}
