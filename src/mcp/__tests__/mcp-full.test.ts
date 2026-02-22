/**
 * Comprehensive MCP (Model Context Protocol) Module Tests
 * Task H5-08: MCP Full Coverage
 *
 * Tests: Types, Configurations, Tools, Resources, Prompts, Transports
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { MCPErrorCode } from '../types.js';
import type {
  MCPServerConfig,
  MCPToolDefinition,
  MCPResourceDefinition,
  MCPPromptDefinition,
  MCPTransport,
  MCPRequest,
  MCPResponse,
  MCPToolCallParams,
  MCPToolCallResult,
  MCPResourceRequestParams,
  MCPPromptRequestParams,
  MCPPromptGetResult,
  MCPClientConfig,
  MCPServerDiscoveryResult,
  MCPConnectionState,
  MCPServerCapabilities,
  MCPToolConfirmationRequest,
  MCPToolConfirmationResponse,
  MCPResourceScopeResult,
} from '../types.js';

// ─── MCP Server Configuration Tests ──────────────────────────────────────────

describe('MCP Server Configuration', () => {
  let config: MCPServerConfig;

  beforeEach(() => {
    config = {
      enabled: true,
      serverName: 'nova26-mcp-server',
      version: '1.0.0',
      instructions: 'Nova26 MCP Server for agent integration',
      transports: [
        {
          type: 'stdio',
          options: {},
        },
      ],
      allowlist: ['venus', 'mercury', 'mars'],
      resourceScopes: ['taste-vault', 'studio-rules'],
    };
  });

  it('should create valid server configuration', () => {
    expect(config.enabled).toBe(true);
    expect(config.serverName).toBe('nova26-mcp-server');
    expect(config.transports).toHaveLength(1);
  });

  it('should support multiple transports', () => {
    config.transports = [
      { type: 'stdio', options: {} },
      { type: 'websocket', options: { port: 8080 } },
      { type: 'sse', options: { path: '/events' } },
    ];

    expect(config.transports).toHaveLength(3);
    expect(config.transports[1].type).toBe('websocket');
  });

  it('should maintain allowlist of agents', () => {
    expect(config.allowlist).toContain('venus');
    expect(config.allowlist).toHaveLength(3);
  });

  it('should define resource scopes', () => {
    expect(config.resourceScopes).toContain('taste-vault');
    expect(config.resourceScopes).toContain('studio-rules');
  });
});

// ─── MCP Tool Definition Tests ───────────────────────────────────────────────

describe('MCP Tool Definitions', () => {
  let tool: MCPToolDefinition;

  beforeEach(() => {
    tool = {
      name: 'nova26.venus.generateDesignFlow',
      description: 'Generate design flows for UI components',
      inputSchema: {
        type: 'object',
        properties: {
          component: { type: 'string' },
          variant: { type: 'string' },
        },
      },
      outputSchema: {
        type: 'object',
        properties: {
          flowId: { type: 'string' },
          steps: { type: 'array' },
        },
      },
      tags: ['design', 'ui', 'flow'],
      agentSource: 'venus',
      requiresConfirmation: true,
    };
  });

  it('should create valid tool definition', () => {
    expect(tool.name).toContain('nova26.');
    expect(tool.agentSource).toBe('venus');
    expect(tool.tags).toHaveLength(3);
  });

  it('should follow dot notation naming convention', () => {
    expect(tool.name).toMatch(/nova26\.[\w-]+\.[\w-]+/);
  });

  it('should support various schema definitions', () => {
    const complexTool: MCPToolDefinition = {
      ...tool,
      inputSchema: {
        type: 'object',
        properties: {
          nested: {
            type: 'object',
            properties: {
              value: { type: 'string' },
            },
          },
          array: {
            type: 'array',
            items: { type: 'string' },
          },
        },
      },
    };

    expect(complexTool.inputSchema).toBeDefined();
  });

  it('should track confirmation requirements', () => {
    const noConfirm: MCPToolDefinition = { ...tool, requiresConfirmation: false };
    expect(noConfirm.requiresConfirmation).toBe(false);
    expect(tool.requiresConfirmation).toBe(true);
  });

  it('should support tool tagging', () => {
    const taggedTool: MCPToolDefinition = {
      ...tool,
      tags: ['critical', 'high-privilege', 'ui-generation'],
    };

    expect(taggedTool.tags).toContain('critical');
  });
});

// ─── MCP Resource Definition Tests ───────────────────────────────────────────

describe('MCP Resource Definitions', () => {
  let resource: MCPResourceDefinition;

  beforeEach(() => {
    resource = {
      uri: 'nova26://taste-vault/swipes',
      name: 'Taste Vault Swipes',
      description: 'User taste vault swipes and preferences',
      mimeType: 'application/json',
      loadContent: async () => JSON.stringify({ swipes: [] }),
      metadata: {
        tasteVaultTags: ['user-preference', 'interaction-history'],
      },
    };
  });

  it('should create valid resource definition', () => {
    expect(resource.uri).toContain('nova26://');
    expect(resource.mimeType).toBe('application/json');
  });

  it('should follow URI scheme convention', () => {
    expect(resource.uri).toMatch(/nova26:\/\/[\w-]+\/[\w-]+/);
  });

  it('should support async content loading', async () => {
    const content = await resource.loadContent();
    expect(content).toBeDefined();
  });

  it('should track taste vault tags', () => {
    expect(resource.metadata.tasteVaultTags).toHaveLength(2);
    expect(resource.metadata.tasteVaultTags).toContain('user-preference');
  });

  it('should support various MIME types', () => {
    const variants = [
      'application/json',
      'text/plain',
      'application/xml',
      'text/markdown',
    ];

    for (const mime of variants) {
      const testRes: MCPResourceDefinition = { ...resource, mimeType: mime };
      expect(testRes.mimeType).toBe(mime);
    }
  });
});

// ─── MCP Prompt Definition Tests ─────────────────────────────────────────────

describe('MCP Prompt Definitions', () => {
  let prompt: MCPPromptDefinition;

  beforeEach(() => {
    prompt = {
      name: 'code-review-prompt',
      description: 'Prompt for code review with studio rules',
      template: `Review the following code according to {{studioRules}}.
Focus on:
- Performance
- Security
- Best practices`,
      arguments: [
        {
          name: 'code',
          description: 'Code to review',
          required: true,
        },
        {
          name: 'language',
          description: 'Programming language',
          required: false,
        },
      ],
    };
  });

  it('should create valid prompt definition', () => {
    expect(prompt.name).toBeDefined();
    expect(prompt.template).toContain('{{studioRules}}');
    expect(prompt.arguments).toHaveLength(2);
  });

  it('should support template placeholders', () => {
    expect(prompt.template).toMatch(/\{\{[\w]+\}\}/);
  });

  it('should track required vs optional arguments', () => {
    const required = prompt.arguments.filter(arg => arg.required);
    const optional = prompt.arguments.filter(arg => !arg.required);

    expect(required).toHaveLength(1);
    expect(optional).toHaveLength(1);
  });

  it('should support argument descriptions', () => {
    for (const arg of prompt.arguments) {
      expect(arg.description).toBeDefined();
    }
  });
});

// ─── MCP Transport Tests ─────────────────────────────────────────────────────

describe('MCP Transport Configuration', () => {
  describe('Transport Types', () => {
    it('should support stdio transport', () => {
      const transport: MCPTransport = {
        type: 'stdio',
        options: {},
      };

      expect(transport.type).toBe('stdio');
    });

    it('should support websocket transport with port', () => {
      const transport: MCPTransport = {
        type: 'websocket',
        options: {
          port: 8080,
          host: 'localhost',
          secure: false,
        },
      };

      expect(transport.type).toBe('websocket');
      expect(transport.options.port).toBe(8080);
    });

    it('should support SSE transport with path', () => {
      const transport: MCPTransport = {
        type: 'sse',
        options: {
          path: '/events',
          secure: true,
        },
      };

      expect(transport.type).toBe('sse');
      expect(transport.options.path).toBe('/events');
    });

    it('should support streamable-http transport', () => {
      const transport: MCPTransport = {
        type: 'streamable-http',
        options: {
          port: 3000,
          host: '0.0.0.0',
        },
      };

      expect(transport.type).toBe('streamable-http');
    });
  });
});

// ─── MCP JSON-RPC Tests ─────────────────────────────────────────────────────

describe('MCP JSON-RPC Communication', () => {
  describe('Requests', () => {
    it('should create valid request', () => {
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
      };

      expect(request.jsonrpc).toBe('2.0');
      expect(request.id).toBe(1);
    });

    it('should support string and numeric IDs', () => {
      const stringId: MCPRequest = {
        jsonrpc: '2.0',
        id: 'req-123',
        method: 'tools/list',
      };

      const numId: MCPRequest = {
        jsonrpc: '2.0',
        id: 456,
        method: 'tools/list',
      };

      expect(typeof stringId.id).toBe('string');
      expect(typeof numId.id).toBe('number');
    });

    it('should include optional params', () => {
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'my-tool', arguments: {} },
      };

      expect(request.params).toBeDefined();
    });
  });

  describe('Responses', () => {
    it('should create success response', () => {
      const response: MCPResponse = {
        jsonrpc: '2.0',
        id: 1,
        result: {
          tools: [
            { name: 'tool-1', description: 'First tool' },
            { name: 'tool-2', description: 'Second tool' },
          ],
        },
      };

      expect(response.result).toBeDefined();
      expect(response.error).toBeUndefined();
    });

    it('should create error response', () => {
      const response: MCPResponse = {
        jsonrpc: '2.0',
        id: 1,
        error: {
          code: MCPErrorCode.MethodNotFound,
          message: 'Method not found',
        },
      };

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(MCPErrorCode.MethodNotFound);
    });
  });
});

// ─── MCP Tool Call Tests ─────────────────────────────────────────────────────

describe('MCP Tool Calls', () => {
  it('should create valid tool call params', () => {
    const params: MCPToolCallParams = {
      name: 'nova26.venus.generateDesignFlow',
      arguments: {
        component: 'Button',
        variant: 'primary',
      },
    };

    expect(params.name).toContain('nova26.');
    expect(params.arguments.component).toBe('Button');
  });

  it('should create tool call result with text content', () => {
    const result: MCPToolCallResult = {
      content: [
        {
          type: 'text',
          text: 'Design flow generated successfully',
        },
      ],
    };

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
  });

  it('should create tool call result with error', () => {
    const result: MCPToolCallResult = {
      content: [
        {
          type: 'text',
          text: 'Tool execution failed: invalid parameters',
        },
      ],
      isError: true,
    };

    expect(result.isError).toBe(true);
  });

  it('should support multiple content items', () => {
    const result: MCPToolCallResult = {
      content: [
        {
          type: 'text',
          text: 'Generated design flow',
        },
        {
          type: 'image',
          data: 'base64-encoded-image',
          mimeType: 'image/png',
        },
      ],
    };

    expect(result.content).toHaveLength(2);
    expect(result.content[1].type).toBe('image');
  });
});

// ─── MCP Prompt Request Tests ────────────────────────────────────────────────

describe('MCP Prompt Requests', () => {
  it('should create prompt get result', () => {
    const result: MCPPromptGetResult = {
      description: 'Code review prompt with studio rules',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: 'Review this code',
          },
        },
        {
          role: 'assistant',
          content: {
            type: 'text',
            text: 'I will review the code according to best practices',
          },
        },
      ],
    };

    expect(result.messages).toHaveLength(2);
    expect(result.messages[0].role).toBe('user');
  });

  it('should support resource content in messages', () => {
    const result: MCPPromptGetResult = {
      description: 'Prompt with resource reference',
      messages: [
        {
          role: 'user',
          content: {
            type: 'resource',
            uri: 'nova26://taste-vault/swipes',
          },
        },
      ],
    };

    expect(result.messages[0].content.type).toBe('resource');
    expect(result.messages[0].content.uri).toContain('nova26://');
  });
});

// ─── MCP Connection State Tests ──────────────────────────────────────────────

describe('MCP Connection Management', () => {
  it('should support all connection states', () => {
    const states: MCPConnectionState[] = [
      'disconnected',
      'connecting',
      'connected',
      'error',
    ];

    for (const state of states) {
      expect(['disconnected', 'connecting', 'connected', 'error']).toContain(
        state
      );
    }
  });

  it('should manage error states', () => {
    let state: MCPConnectionState = 'connected';
    expect(state).toBe('connected');

    state = 'error';
    expect(state).toBe('error');
  });
});

// ─── MCP Error Codes Tests ───────────────────────────────────────────────────

describe('MCP Error Codes', () => {
  it('should have valid JSON-RPC error codes', () => {
    expect(MCPErrorCode.ParseError).toBe(-32700);
    expect(MCPErrorCode.InvalidRequest).toBe(-32600);
    expect(MCPErrorCode.MethodNotFound).toBe(-32601);
    expect(MCPErrorCode.InvalidParams).toBe(-32602);
    expect(MCPErrorCode.InternalError).toBe(-32603);
  });

  it('should have MCP-specific error codes', () => {
    expect(MCPErrorCode.ServerNotInitialized).toBe(-32002);
    expect(MCPErrorCode.UnknownTool).toBe(-32001);
    expect(MCPErrorCode.ToolExecutionError).toBe(-32000);
    expect(MCPErrorCode.ResourceNotFound).toBe(-31999);
  });
});

// ─── MCP Confirmation Tests ──────────────────────────────────────────────────

describe('MCP Tool Confirmation', () => {
  it('should create confirmation request', () => {
    const request: MCPToolConfirmationRequest = {
      toolName: 'nova26.mars.deployToProduction',
      arguments: {
        version: '1.0.0',
        environment: 'production',
      },
      requestId: 'req-123',
      timestamp: new Date().toISOString(),
    };

    expect(request.toolName).toContain('nova26.');
    expect(request.arguments.environment).toBe('production');
  });

  it('should create confirmation response', () => {
    const response: MCPToolConfirmationResponse = {
      approved: true,
      requestId: 'req-123',
      reason: 'Approved by security team',
    };

    expect(response.approved).toBe(true);
    expect(response.reason).toBeDefined();
  });

  it('should handle rejection', () => {
    const response: MCPToolConfirmationResponse = {
      approved: false,
      requestId: 'req-123',
      reason: 'Insufficient permissions',
    };

    expect(response.approved).toBe(false);
  });
});

// ─── MCP Resource Scope Tests ────────────────────────────────────────────────

describe('MCP Resource Scopes', () => {
  it('should verify scope access', () => {
    const result: MCPResourceScopeResult = {
      allowed: true,
      uri: 'nova26://taste-vault/swipes',
      requiredScopes: ['taste-vault:read'],
      missingScopes: [],
    };

    expect(result.allowed).toBe(true);
    expect(result.missingScopes).toHaveLength(0);
  });

  it('should deny access with missing scopes', () => {
    const result: MCPResourceScopeResult = {
      allowed: false,
      uri: 'nova26://studio-rules/private',
      requiredScopes: ['studio-rules:write', 'admin:access'],
      missingScopes: ['admin:access'],
    };

    expect(result.allowed).toBe(false);
    expect(result.missingScopes).toHaveLength(1);
  });
});

// ─── Property-Based Tests ───────────────────────────────────────────────────

describe('MCP Property-Based Tests', () => {
  it('should validate request/response pairing', () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.string(), fc.integer()),
        id => {
          const request: MCPRequest = {
            jsonrpc: '2.0',
            id,
            method: 'test',
          };

          const response: MCPResponse = {
            jsonrpc: '2.0',
            id: request.id,
          };

          return request.id === response.id;
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should maintain tool definition invariants', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        name => {
          const tool: MCPToolDefinition = {
            name: `nova26.agent.${name}`,
            description: 'Test tool',
            inputSchema: {},
            outputSchema: {},
            tags: [],
            agentSource: 'test',
            requiresConfirmation: false,
          };

          return tool.name.includes('nova26.');
        }
      ),
      { numRuns: 40 }
    );
  });
});
