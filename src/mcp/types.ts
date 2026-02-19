// MCP (Model Context Protocol) Type Definitions
// R21-01: MCP Integration Module

/**
 * MCP Server Configuration
 */
export interface MCPServerConfig {
  enabled: boolean;
  serverName: string;
  version: string;
  instructions: string;
  transports: MCPTransport[];
  allowlist: string[];
  resourceScopes: string[];
}

/**
 * MCP Tool Definition
 * Represents a callable tool/function exposed via MCP
 */
export interface MCPToolDefinition {
  name: string; // e.g. "nova26.venus.generateDesignFlow"
  description: string;
  inputSchema: unknown; // JSON Schema
  outputSchema: unknown;
  tags: string[];
  agentSource: string;
  requiresConfirmation: boolean;
}

/**
 * MCP Resource Definition
 * Represents a readable resource exposed via MCP
 */
export interface MCPResourceDefinition {
  uri: string; // e.g. "nova26://taste-vault/swipes"
  name: string;
  description: string;
  mimeType: string;
  loadContent: () => Promise<string>;
  metadata: {
    tasteVaultTags: string[];
  };
}

/**
 * MCP Prompt Definition
 * Represents a prompt template exposed via MCP
 */
export interface MCPPromptDefinition {
  name: string;
  description: string;
  template: string; // with {{studioRules}} placeholders
  arguments: Array<{
    name: string;
    description: string;
    required: boolean;
  }>;
}

/**
 * MCP Transport Configuration
 * Defines how the MCP server communicates
 */
export interface MCPTransport {
  type: 'stdio' | 'streamable-http' | 'sse' | 'websocket';
  options: {
    port?: number;
    path?: string;
    host?: string;
    secure?: boolean;
  };
}

/**
 * MCP JSON-RPC Request
 */
export interface MCPRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: unknown;
}

/**
 * MCP JSON-RPC Response
 */
export interface MCPResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/**
 * MCP Tool Call Parameters
 */
export interface MCPToolCallParams {
  name: string;
  arguments: Record<string, unknown>;
}

/**
 * MCP Tool Call Result
 */
export interface MCPToolCallResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
    resource?: MCPResourceDefinition;
  }>;
  isError?: boolean;
}

/**
 * MCP Resource Request Parameters
 */
export interface MCPResourceRequestParams {
  uri: string;
}

/**
 * MCP Prompt Request Parameters
 */
export interface MCPPromptRequestParams {
  name: string;
  arguments?: Record<string, string>;
}

/**
 * MCP Prompt Get Result
 */
export interface MCPPromptGetResult {
  description: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: {
      type: 'text' | 'image' | 'resource';
      text?: string;
      data?: string;
      mimeType?: string;
      uri?: string;
    };
  }>;
}

/**
 * MCP Client Configuration
 */
export interface MCPClientConfig {
  serverName: string;
  transport: MCPTransport;
  timeout: number;
  retries: number;
}

/**
 * MCP Server Discovery Result
 */
export interface MCPServerDiscoveryResult {
  name: string;
  version: string;
  instructions?: string;
  tools: MCPToolDefinition[];
  resources: MCPResourceDefinition[];
  prompts: MCPPromptDefinition[];
}

/**
 * MCP Connection State
 */
export type MCPConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * MCP Error Codes (per MCP specification)
 */
export enum MCPErrorCode {
  // Standard JSON-RPC error codes
  ParseError = -32700,
  InvalidRequest = -32600,
  MethodNotFound = -32601,
  InvalidParams = -32602,
  InternalError = -32603,
  
  // MCP-specific error codes
  ServerNotInitialized = -32002,
  UnknownTool = -32001,
  ToolExecutionError = -32000,
  ResourceNotFound = -31999,
  PromptNotFound = -31998,
  ConfirmationRequired = -31997,
}

/**
 * MCP Capability Flags
 */
export interface MCPServerCapabilities {
  tools: boolean;
  resources: boolean;
  prompts: boolean;
  logging: boolean;
}

/**
 * Tool execution confirmation request
 */
export interface MCPToolConfirmationRequest {
  toolName: string;
  arguments: Record<string, unknown>;
  requestId: string;
  timestamp: string;
}

/**
 * Tool execution confirmation response
 */
export interface MCPToolConfirmationResponse {
  approved: boolean;
  requestId: string;
  reason?: string;
}

/**
 * Resource scope check result
 */
export interface MCPResourceScopeResult {
  allowed: boolean;
  uri: string;
  requiredScopes: string[];
  missingScopes: string[];
}
