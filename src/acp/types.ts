/**
 * ACP (Agent Client Protocol) Type Definitions
 * 
 * Core types for the Agent Client Protocol integration in Nova26 R21-02.
 * This module provides type-safe interfaces for agent descriptors, capabilities,
 * sessions, and JSON-RPC messaging.
 */

/**
 * Agent descriptor containing metadata about an ACP-compatible agent
 */
export interface ACPAgentDescriptor {
  /** Unique identifier for the agent (e.g., 'nova26-orchestrator') */
  id: string;
  /** Human-readable name */
  name: string;
  /** Semantic version */
  version: string;
  /** Brief description of agent functionality */
  description: string;
  /** Capabilities this agent provides */
  capabilities: ACPCapability[];
  /** Optional icon URL or emoji */
  icon?: string;
  /** Optional website URL */
  website?: string;
  /** Author or organization */
  author: string;
}

/**
 * Capability definition for ACP agents
 */
export interface ACPCapability {
  /** Unique capability ID (dot-notation, e.g., 'codegen.react') */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description of what this capability does */
  description: string;
  /** Source agent that provides this capability */
  agentSource: string;
  /** JSON Schema for input validation */
  inputSchema: unknown;
  /** JSON Schema for output validation */
  outputSchema: unknown;
  /** Tags for categorization */
  tags: string[];
  /** Whether user confirmation is required before invocation */
  requiresConfirmation: boolean;
}

/**
 * ACP Session state type
 */
export type ACPSessionState = 'active' | 'idle' | 'closed';

/**
 * Transport type for ACP connections
 */
export type ACPTransportType = 'stdio' | 'websocket' | 'sse';

/**
 * ACP Session tracking active connections
 */
export interface ACPSession {
  /** Unique session ID */
  id: string;
  /** Root directory of the project being worked on */
  projectRoot: string;
  /** Optional user identifier */
  userId?: string;
  /** Hash of the TasteVault snapshot at session start */
  tasteVaultSnapshotHash: string;
  /** Current session state */
  state: ACPSessionState;
  /** Unix timestamp when session was established */
  connectedAt: number;
  /** Unix timestamp of last activity */
  lastActivity: number;
  /** Transport configuration */
  transport: ACPTransport;
}

/**
 * Authentication options for ACP transport
 */
export interface ACPAuthOptions {
  /** Bearer token */
  token?: string;
  /** API key for service authentication */
  apiKey?: string;
}

/**
 * Transport configuration for ACP connections
 */
export interface ACPTransport {
  /** Transport type */
  type: ACPTransportType;
  /** Transport-specific options */
  options: {
    auth?: ACPAuthOptions;
  };
}

/**
 * JSON-RPC 2.0 error structure
 */
export interface ACPError {
  /** Error code (standard JSON-RPC or application-specific) */
  code: number;
  /** Human-readable error message */
  message: string;
  /** Optional additional error data */
  data?: unknown;
}

/**
 * JSON-RPC 2.0 message structure for ACP communication
 */
export interface ACPMessage {
  /** JSON-RPC version */
  jsonrpc: '2.0';
  /** Method name for requests/notifications */
  method?: string;
  /** Parameters for the method */
  params?: unknown;
  /** Result data for responses */
  result?: unknown;
  /** Error information for error responses */
  error?: ACPError;
  /** Request ID (null for notifications, string/number for requests) */
  id?: string | number | null;
}

/**
 * Request message type guard
 */
export function isACPRequest(message: ACPMessage): boolean {
  return message.method !== undefined && message.id !== undefined && message.id !== null;
}

/**
 * Response message type guard
 */
export function isACPResponse(message: ACPMessage): boolean {
  return (message.result !== undefined || message.error !== undefined) && message.id !== undefined;
}

/**
 * Notification message type guard (no id)
 */
export function isACPNotification(message: ACPMessage): boolean {
  return message.method !== undefined && message.id === null;
}

/**
 * Capability invocation request parameters
 */
export interface ACPCapabilityInvocation {
  /** Capability ID to invoke */
  capabilityId: string;
  /** Input parameters matching the capability's inputSchema */
  input: unknown;
  /** Optional request context */
  context?: Record<string, unknown>;
}

/**
 * Capability discovery result
 */
export interface ACPCapabilityDiscovery {
  /** Available capabilities */
  capabilities: ACPCapability[];
  /** Server/agent metadata */
  agent: Pick<ACPAgentDescriptor, 'id' | 'name' | 'version'>;
}

/**
 * Standard JSON-RPC error codes
 */
export const ACPErrorCodes = {
  /** Invalid JSON was received */
  PARSE_ERROR: -32700,
  /** The JSON sent is not a valid Request object */
  INVALID_REQUEST: -32600,
  /** The method does not exist */
  METHOD_NOT_FOUND: -32601,
  /** Invalid method parameter(s) */
  INVALID_PARAMS: -32602,
  /** Internal JSON-RPC error */
  INTERNAL_ERROR: -32603,
  /** Server error (reserved range -32000 to -32099) */
  SERVER_ERROR: -32000,
  /** Capability not found */
  CAPABILITY_NOT_FOUND: -32001,
  /** Session not found or expired */
  SESSION_ERROR: -32002,
  /** Authentication failed */
  AUTH_ERROR: -32003,
  /** Confirmation required but not provided */
  CONFIRMATION_REQUIRED: -32004,
} as const;

/**
 * Type for ACP error codes
 */
export type ACPErrorCode = typeof ACPErrorCodes[keyof typeof ACPErrorCodes];
