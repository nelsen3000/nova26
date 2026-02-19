# Grok R21-01: MCP (Model Context Protocol) Integration
## Source: Grok Research Round 21-01 (Feb 19, 2026)
## Status: Accepted

## Key Interfaces

### MCPServerConfig
- enabled, serverName, version, instructions, transports: MCPTransport[]
- allowlist: string[], resourceScopes: string[]

### MCPToolDefinition
- name (e.g. "nova26.venus.generateDesignFlow"), description
- inputSchema (Zod/JSON Schema), outputSchema, tags, agentSource, requiresConfirmation

### MCPResourceDefinition
- uri (e.g. "nova26://taste-vault/swipes"), name, description, mimeType
- content: lazy loader, metadata with tasteVaultTags

### MCPPromptDefinition
- name, description, template with {{studioRules}} placeholders, arguments

### MCPTransport
- type: 'stdio' | 'streamable-http' | 'sse' | 'websocket'
- options: port, path, host, secure

## File Structure
src/mcp/
├── index.ts, types.ts, server.ts, client.ts
├── transport/ (stdio.ts, streamable-http.ts, websocket.ts)
├── discovery.ts, security.ts, registry.ts
├── resources/ (project-files.ts, taste-vault.ts, convex-sync.ts)
├── prompts/agent-templates.ts
└── __tests__/mcp.test.ts

## RalphLoopOptions Addition
mcpConfig: { enabled, server: {enabled, transports}, client: {autoDiscover, maxConcurrent: 5}, tasteVaultExposure: 'read-only'|'full' }

## Key Design Decisions
- Uses official @modelcontextprotocol/sdk
- Nova26 as both MCP Server (exposes 21 agents) AND Client (consumes external tools)
- All 21 agent templates exposed as MCPPromptDefinition
- Auto-discovery via local stdio scan + public registry
- stdio default (<30ms), WebSocket for dashboard, SSE for remote

## Test Strategy
78 vitest cases: server/client round-trip, tool discovery, resource streaming, prompt template execution, security enforcement, Cursor→Nova26→Dream Mode end-to-end, performance
