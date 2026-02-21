// MCP Integration Bridge — Wraps MCP server for A2A tool/resource/prompt sharing
// Sprint S2-23 | A2A Agent-to-Agent Protocols

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  handler: (args: Record<string, unknown>) => Promise<unknown>;
}

export interface ResourceDefinition {
  uri: string;
  name: string;
  description?: string;
  content: unknown;
}

export interface PromptDefinition {
  name: string;
  description?: string;
  template: string;
  arguments?: Record<string, string>;
}

export interface ToolInvocationResult {
  toolName: string;
  agentId: string;
  success: boolean;
  output?: unknown;
  error?: string;
  durationMs: number;
}

export interface MCPBridgeStats {
  totalTools: number;
  totalResources: number;
  totalPrompts: number;
  invocations: number;
  failures: number;
}

/**
 * MCPBridge — Unified tool/resource/prompt layer for all A2A agents.
 * Wraps the existing MCP server infrastructure with agent-namespaced tool registration.
 * Tool names are namespaced as "agentName.toolName" to avoid collisions.
 */
export class MCPBridge {
  private tools = new Map<string, { agentId: string; def: ToolDefinition }>();
  private resources = new Map<string, ResourceDefinition>();
  private prompts = new Map<string, PromptDefinition>();
  private invocationCount = 0;
  private failureCount = 0;

  /**
   * Register tools for an agent. Each tool name is namespaced as "agentId.toolName".
   * Throws if a namespaced name already exists.
   */
  registerAgentTools(agentId: string, tools: ToolDefinition[]): string[] {
    const registered: string[] = [];
    for (const tool of tools) {
      const namespacedName = `${agentId}.${tool.name}`;
      if (this.tools.has(namespacedName)) {
        throw new Error(`Tool "${namespacedName}" already registered`);
      }
      this.tools.set(namespacedName, { agentId, def: tool });
      registered.push(namespacedName);
    }
    return registered;
  }

  /**
   * Invoke a namespaced tool by name.
   */
  async invokeTool(
    namespacedName: string,
    args: Record<string, unknown> = {},
  ): Promise<ToolInvocationResult> {
    const entry = this.tools.get(namespacedName);
    const start = Date.now();
    this.invocationCount++;

    if (!entry) {
      this.failureCount++;
      return {
        toolName: namespacedName,
        agentId: 'unknown',
        success: false,
        error: `Tool "${namespacedName}" not found`,
        durationMs: Date.now() - start,
      };
    }

    try {
      const output = await entry.def.handler(args);
      return {
        toolName: namespacedName,
        agentId: entry.agentId,
        success: true,
        output,
        durationMs: Date.now() - start,
      };
    } catch (err) {
      this.failureCount++;
      return {
        toolName: namespacedName,
        agentId: entry.agentId,
        success: false,
        error: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - start,
      };
    }
  }

  /**
   * List all registered tools across all agents.
   */
  listAllTools(): Array<{ namespacedName: string; agentId: string; description: string }> {
    return [...this.tools.entries()].map(([name, { agentId, def }]) => ({
      namespacedName: name,
      agentId,
      description: def.description,
    }));
  }

  /**
   * List tools for a specific agent.
   */
  listAgentTools(agentId: string): string[] {
    return [...this.tools.entries()]
      .filter(([, entry]) => entry.agentId === agentId)
      .map(([name]) => name);
  }

  /**
   * Register a resource (URI-keyed content).
   */
  registerResource(resource: ResourceDefinition): void {
    this.resources.set(resource.uri, resource);
  }

  /**
   * Read a resource by URI. Throws if not found.
   */
  readResource(uri: string): unknown {
    const resource = this.resources.get(uri);
    if (!resource) throw Object.assign(new Error(`Resource "${uri}" not found`), { code: 'RESOURCE_NOT_FOUND' });
    return resource.content;
  }

  /**
   * List all registered resources.
   */
  listResources(): ResourceDefinition[] {
    return [...this.resources.values()];
  }

  /**
   * Register a prompt template.
   */
  registerPrompt(prompt: PromptDefinition): void {
    this.prompts.set(prompt.name, prompt);
  }

  /**
   * Get a rendered prompt with argument substitution.
   */
  getPrompt(name: string, args: Record<string, string> = {}): string {
    const prompt = this.prompts.get(name);
    if (!prompt) throw Object.assign(new Error(`Prompt "${name}" not found`), { code: 'PROMPT_NOT_FOUND' });

    let rendered = prompt.template;
    for (const [key, value] of Object.entries(args)) {
      rendered = rendered.replaceAll(`{{${key}}}`, value);
    }
    return rendered;
  }

  /**
   * List all registered prompts.
   */
  listPrompts(): PromptDefinition[] {
    return [...this.prompts.values()];
  }

  getStats(): MCPBridgeStats {
    return {
      totalTools: this.tools.size,
      totalResources: this.resources.size,
      totalPrompts: this.prompts.size,
      invocations: this.invocationCount,
      failures: this.failureCount,
    };
  }
}
