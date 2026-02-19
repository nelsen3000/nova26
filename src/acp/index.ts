/**
 * ACP (Agent Client Protocol) Integration Module
 * 
 * Nova26 R21-02 ACP Integration - Provides type-safe communication between
 * agents using JSON-RPC 2.0 protocol.
 * 
 * @module @nova26/acp
 */

// Type exports
export type {
  ACPAgentDescriptor,
  ACPCapability,
  ACPSession,
  ACPSessionState,
  ACPTransport,
  ACPTransportType,
  ACPAuthOptions,
  ACPMessage,
  ACPError,
  ACPErrorCode,
  ACPCapabilityInvocation,
  ACPCapabilityDiscovery,
} from './types.js';

// Value exports
export {
  ACPErrorCodes,
  isACPRequest,
  isACPResponse,
  isACPNotification,
} from './types.js';

// Server exports
export {
  ACPServer,
  type ACPServerOptions,
  type ACPMessageHandler,
  type ACPCapabilityHandler,
} from './server.js';

// Client exports
export {
  ACPClient,
  type ACPClientOptions,
  type ACPConnectionState,
} from './client.js';

// Session Manager exports
export {
  ACPSessionManager,
  type ACPSessionManagerOptions,
  type ACPSessionCreateParams,
  type ACPSessionStats,
} from './session-manager.js';

// Descriptor exports
export {
  createNova26Descriptor,
  getAllNova26Agents,
  getNova26Agent,
} from './descriptor.js';
