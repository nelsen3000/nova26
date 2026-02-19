# Grok R21-02: ACP (Agent Client Protocol) Integration
## Source: Grok Research Round 21-02 (Feb 19, 2026)
## Status: Accepted

## Key Interfaces

### ACPAgentDescriptor
- id, name, version, description, capabilities: ACPCapability[], icon, website, author

### ACPCapability
- id (e.g. "codegen.react"), name, description, agentSource, inputSchema, outputSchema
- tags, requiresConfirmation

### ACPSession
- id, projectRoot, userId, tasteVaultSnapshotHash, state, connectedAt, lastActivity, transport

### ACPMessage
- jsonrpc: "2.0", method (e.g. "nova26.venus.generateDesignFlow"), params, result, error

### ACPTransport
- type: 'stdio' | 'websocket' | 'sse', options with auth

## File Structure
src/acp/
├── index.ts, types.ts, server.ts, client.ts, descriptor.ts, session-manager.ts
├── transport/ (stdio.ts, websocket.ts, sse.ts)
├── capabilities/ (registry.ts, negotiator.ts)
├── virtual-fs.ts, auth.ts, registry.ts
└── __tests__/acp.test.ts

## RalphLoopOptions Addition
acpConfig: { enabled, transports, defaultSessionTimeoutMinutes: 1440, exposeToExternalEditors, serviceMode: 'local'|'remote'|'hybrid', capabilityWhitelist }

## Key Design Decisions
- JSON-RPC 2.0 over stdio/WebSocket (LSP-inspired, agent-native)
- 21 agents advertised as grouped capabilities (Design, Memory, Wellbeing, etc.)
- Session persistence via SQLite + optional Convex sync
- "Nova26 as a Service": run `nova26 serve --acp` for remote IDE access
- Virtual FS abstraction (agents never touch raw FS)
- MCP and ACP run side-by-side (MCP for tools/resources, ACP for full editor integration)

## Test Strategy
67 vitest cases: descriptor/capability negotiation, session lifecycle, bidirectional messaging, virtual FS, security, backward compatibility, Zed→Nova26→Living Canvas end-to-end, performance
