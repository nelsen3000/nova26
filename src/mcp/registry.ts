// MCP Registry - Tool/Resource/Prompt Registration and Management
// R21-01: MCP Integration Module

import type {
  MCPToolDefinition,
  MCPResourceDefinition,
  MCPPromptDefinition,
} from './types.js';

/**
 * Registration metadata for MCP entities
 */
interface RegistrationMetadata {
  registeredAt: string;
  updatedAt: string;
  version: string;
}

/**
 * Registered tool entry with metadata
 */
interface RegisteredTool {
  definition: MCPToolDefinition;
  metadata: RegistrationMetadata;
}

/**
 * Registered resource entry with metadata
 */
interface RegisteredResource {
  definition: MCPResourceDefinition;
  metadata: RegistrationMetadata;
}

/**
 * Registered prompt entry with metadata
 */
interface RegisteredPrompt {
  definition: MCPPromptDefinition;
  metadata: RegistrationMetadata;
}

/**
 * MCP Registry - Manages registration of tools, resources, and prompts
 */
export class MCPRegistry {
  private tools: Map<string, RegisteredTool> = new Map();
  private resources: Map<string, RegisteredResource> = new Map();
  private prompts: Map<string, RegisteredPrompt> = new Map();
  private version: string = '1.0.0';

  /**
   * Register a new tool
   * @param definition - Tool definition
   * @returns The registered tool name
   */
  registerTool(definition: MCPToolDefinition): string {
    const now = new Date().toISOString();
    const existing = this.tools.get(definition.name);
    
    this.tools.set(definition.name, {
      definition,
      metadata: {
        registeredAt: existing?.metadata.registeredAt ?? now,
        updatedAt: now,
        version: this.version,
      },
    });
    
    return definition.name;
  }

  /**
   * Register multiple tools at once
   * @param definitions - Array of tool definitions
   * @returns Array of registered tool names
   */
  registerTools(definitions: MCPToolDefinition[]): string[] {
    return definitions.map(def => this.registerTool(def));
  }

  /**
   * Register a new resource
   * @param definition - Resource definition
   * @returns The registered resource URI
   */
  registerResource(definition: MCPResourceDefinition): string {
    const now = new Date().toISOString();
    const existing = this.resources.get(definition.uri);
    
    this.resources.set(definition.uri, {
      definition,
      metadata: {
        registeredAt: existing?.metadata.registeredAt ?? now,
        updatedAt: now,
        version: this.version,
      },
    });
    
    return definition.uri;
  }

  /**
   * Register multiple resources at once
   * @param definitions - Array of resource definitions
   * @returns Array of registered resource URIs
   */
  registerResources(definitions: MCPResourceDefinition[]): string[] {
    return definitions.map(def => this.registerResource(def));
  }

  /**
   * Register a new prompt
   * @param definition - Prompt definition
   * @returns The registered prompt name
   */
  registerPrompt(definition: MCPPromptDefinition): string {
    const now = new Date().toISOString();
    const existing = this.prompts.get(definition.name);
    
    this.prompts.set(definition.name, {
      definition,
      metadata: {
        registeredAt: existing?.metadata.registeredAt ?? now,
        updatedAt: now,
        version: this.version,
      },
    });
    
    return definition.name;
  }

  /**
   * Register multiple prompts at once
   * @param definitions - Array of prompt definitions
   * @returns Array of registered prompt names
   */
  registerPrompts(definitions: MCPPromptDefinition[]): string[] {
    return definitions.map(def => this.registerPrompt(def));
  }

  /**
   * Get a tool by name
   * @param name - Tool name
   * @returns Tool definition or undefined if not found
   */
  getTool(name: string): MCPToolDefinition | undefined {
    return this.tools.get(name)?.definition;
  }

  /**
   * Get a resource by URI
   * @param uri - Resource URI
   * @returns Resource definition or undefined if not found
   */
  getResource(uri: string): MCPResourceDefinition | undefined {
    return this.resources.get(uri)?.definition;
  }

  /**
   * Get a prompt by name
   * @param name - Prompt name
   * @returns Prompt definition or undefined if not found
   */
  getPrompt(name: string): MCPPromptDefinition | undefined {
    return this.prompts.get(name)?.definition;
  }

  /**
   * List all registered tools
   * @returns Array of tool definitions
   */
  listTools(): MCPToolDefinition[] {
    return Array.from(this.tools.values()).map(entry => entry.definition);
  }

  /**
   * List all registered resources
   * @returns Array of resource definitions
   */
  listResources(): MCPResourceDefinition[] {
    return Array.from(this.resources.values()).map(entry => entry.definition);
  }

  /**
   * List all registered prompts
   * @returns Array of prompt definitions
   */
  listPrompts(): MCPPromptDefinition[] {
    return Array.from(this.prompts.values()).map(entry => entry.definition);
  }

  /**
   * List all registered entities
   * @returns Object containing all tools, resources, and prompts
   */
  listAll(): {
    tools: MCPToolDefinition[];
    resources: MCPResourceDefinition[];
    prompts: MCPPromptDefinition[];
  } {
    return {
      tools: this.listTools(),
      resources: this.listResources(),
      prompts: this.listPrompts(),
    };
  }

  /**
   * Unregister a tool by name
   * @param name - Tool name to unregister
   * @returns True if removed, false if not found
   */
  unregisterTool(name: string): boolean {
    return this.tools.delete(name);
  }

  /**
   * Unregister a resource by URI
   * @param uri - Resource URI to unregister
   * @returns True if removed, false if not found
   */
  unregisterResource(uri: string): boolean {
    return this.resources.delete(uri);
  }

  /**
   * Unregister a prompt by name
   * @param name - Prompt name to unregister
   * @returns True if removed, false if not found
   */
  unregisterPrompt(name: string): boolean {
    return this.prompts.delete(name);
  }

  /**
   * Check if a tool is registered
   * @param name - Tool name
   * @returns True if registered
   */
  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Check if a resource is registered
   * @param uri - Resource URI
   * @returns True if registered
   */
  hasResource(uri: string): boolean {
    return this.resources.has(uri);
  }

  /**
   * Check if a prompt is registered
   * @param name - Prompt name
   * @returns True if registered
   */
  hasPrompt(name: string): boolean {
    return this.prompts.has(name);
  }

  /**
   * Get tools by tag
   * @param tag - Tag to filter by
   * @returns Array of matching tool definitions
   */
  getToolsByTag(tag: string): MCPToolDefinition[] {
    return this.listTools().filter(tool => tool.tags.includes(tag));
  }

  /**
   * Get tools by agent source
   * @param agentSource - Agent source to filter by
   * @returns Array of matching tool definitions
   */
  getToolsByAgent(agentSource: string): MCPToolDefinition[] {
    return this.listTools().filter(tool => tool.agentSource === agentSource);
  }

  /**
   * Get resources by taste vault tag
   * @param tag - Taste vault tag to filter by
   * @returns Array of matching resource definitions
   */
  getResourcesByTag(tag: string): MCPResourceDefinition[] {
    return this.listResources().filter(resource => 
      resource.metadata.tasteVaultTags.includes(tag)
    );
  }

  /**
   * Clear all registrations
   */
  clear(): void {
    this.tools.clear();
    this.resources.clear();
    this.prompts.clear();
  }

  /**
   * Get registration statistics
   * @returns Object with counts of registered entities
   */
  getStats(): {
    toolCount: number;
    resourceCount: number;
    promptCount: number;
    totalCount: number;
  } {
    return {
      toolCount: this.tools.size,
      resourceCount: this.resources.size,
      promptCount: this.prompts.size,
      totalCount: this.tools.size + this.resources.size + this.prompts.size,
    };
  }

  /**
   * Set the registry version
   * @param version - New version string
   */
  setVersion(version: string): void {
    this.version = version;
  }

  /**
   * Get the registry version
   * @returns Current version string
   */
  getVersion(): string {
    return this.version;
  }
}

/**
 * Global registry singleton
 */
let globalRegistry: MCPRegistry | null = null;

/**
 * Get the global MCP registry instance
 * @returns Global MCPRegistry instance
 */
export function getGlobalMCPRegistry(): MCPRegistry {
  if (!globalRegistry) {
    globalRegistry = new MCPRegistry();
  }
  return globalRegistry;
}

/**
 * Reset the global registry (useful for testing)
 */
export function resetGlobalMCPRegistry(): void {
  globalRegistry = null;
}
