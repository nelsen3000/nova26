// MCP (Model Context Protocol) Integration Module
// R21-01: Nova26 MCP Integration

// ============================================================================
// Type Exports
// ============================================================================

export type {
  // Core types
  MCPServerConfig,
  MCPTransport,
  MCPRequest,
  MCPResponse,
  
  // Entity definitions
  MCPToolDefinition,
  MCPResourceDefinition,
  MCPPromptDefinition,
  
  // Tool types
  MCPToolCallParams,
  MCPToolCallResult,
  
  // Resource types
  MCPResourceRequestParams,
  MCPResourceScopeResult,
  
  // Prompt types
  MCPPromptRequestParams,
  MCPPromptGetResult,
  
  // Client types
  MCPClientConfig,
  MCPServerDiscoveryResult,
  MCPConnectionState,
  
  // Confirmation types
  MCPToolConfirmationRequest,
  MCPToolConfirmationResponse,
  
  // Capability types
  MCPServerCapabilities,
} from './types.js';

export { MCPErrorCode } from './types.js';

// ============================================================================
// Registry Exports
// ============================================================================

export {
  MCPRegistry,
  getGlobalMCPRegistry,
  resetGlobalMCPRegistry,
} from './registry.js';

// ============================================================================
// Server Exports
// ============================================================================

export {
  MCPServer,
  type ToolExecutionHandler,
  type ConfirmationRequestHandler,
} from './server.js';

// ============================================================================
// Client Exports
// ============================================================================

export {
  MCPClient,
  MCPClientManager,
  type LocalDiscoveryConfig,
} from './client.js';
