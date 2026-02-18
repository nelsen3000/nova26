// Tool Registry — Foundation for agentic tool use
// Manages tool definitions, safety rules, and agent-level permissions

import { z } from 'zod';

// ============================================================================
// Core Types
// ============================================================================

/** A callable tool that agents can invoke during reasoning */
export interface Tool {
  name: string;
  description: string;
  parameters: z.ZodSchema<unknown>;
  execute: (args: Record<string, unknown>) => Promise<ToolResult>;
  /** Which agents can use this tool (empty = all agents) */
  allowedAgents: string[];
  /** Which agents are explicitly blocked (takes priority over allowedAgents) */
  blockedAgents: string[];
  /** Whether this tool modifies state (writes files, runs commands) */
  mutating: boolean;
  /** Timeout in ms for tool execution */
  timeout: number;
}

/** Result of a tool invocation */
export interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
  duration: number;
  /** Truncated if output exceeds limit */
  truncated: boolean;
}

/** A tool call parsed from LLM response */
export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/** A completed tool call with its result */
export interface ToolExecution {
  call: ToolCall;
  result: ToolResult;
  timestamp: number;
}

/** Tool definition for LLM prompt injection (OpenAI-compatible format) */
export interface ToolSpec {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}

// ============================================================================
// Safety Rules
// ============================================================================

/** Per-agent tool safety configuration */
export interface AgentToolPermissions {
  /** Agent name (e.g., 'MARS', 'VENUS') */
  agent: string;
  /** Tools this agent can use */
  allowed: string[];
  /** Max tool calls per task */
  maxCallsPerTask: number;
  /** Whether agent can use mutating tools */
  canMutate: boolean;
}

/** Default safety rules per agent */
const DEFAULT_PERMISSIONS: AgentToolPermissions[] = [
  // Core agents — full access
  { agent: 'MARS', allowed: ['readFile', 'writeFile', 'searchCode', 'checkTypes', 'runTests', 'listFiles'], maxCallsPerTask: 20, canMutate: true },
  { agent: 'VENUS', allowed: ['readFile', 'searchCode', 'listFiles', 'writeFile'], maxCallsPerTask: 15, canMutate: true },
  { agent: 'SATURN', allowed: ['readFile', 'searchCode', 'runTests', 'listFiles', 'checkTypes'], maxCallsPerTask: 20, canMutate: false },
  { agent: 'MERCURY', allowed: ['readFile', 'searchCode', 'checkTypes', 'runTests', 'listFiles'], maxCallsPerTask: 15, canMutate: false },

  // Infrastructure agents
  { agent: 'JUPITER', allowed: ['readFile', 'searchCode', 'listFiles'], maxCallsPerTask: 10, canMutate: false },
  { agent: 'PLUTO', allowed: ['readFile', 'searchCode', 'writeFile', 'listFiles'], maxCallsPerTask: 15, canMutate: true },
  { agent: 'IO', allowed: ['readFile', 'searchCode', 'runTests', 'listFiles', 'checkTypes'], maxCallsPerTask: 15, canMutate: false },

  // Moon agents — limited access
  { agent: 'TITAN', allowed: ['readFile', 'searchCode', 'writeFile', 'listFiles'], maxCallsPerTask: 10, canMutate: true },
  { agent: 'EUROPA', allowed: ['readFile', 'searchCode', 'writeFile', 'listFiles'], maxCallsPerTask: 10, canMutate: true },
  { agent: 'GANYMEDE', allowed: ['readFile', 'searchCode', 'writeFile', 'listFiles'], maxCallsPerTask: 10, canMutate: true },
  { agent: 'TRITON', allowed: ['readFile', 'searchCode', 'listFiles', 'checkTypes'], maxCallsPerTask: 10, canMutate: false },
  { agent: 'ENCELADUS', allowed: ['readFile', 'searchCode', 'listFiles'], maxCallsPerTask: 10, canMutate: false },
  { agent: 'MIMAS', allowed: ['readFile', 'searchCode', 'listFiles'], maxCallsPerTask: 8, canMutate: false },
  { agent: 'CHARON', allowed: ['readFile', 'searchCode', 'writeFile', 'listFiles'], maxCallsPerTask: 8, canMutate: true },

  // Read-only agents
  { agent: 'SUN', allowed: ['readFile', 'searchCode', 'listFiles'], maxCallsPerTask: 10, canMutate: false },
  { agent: 'EARTH', allowed: ['readFile', 'searchCode', 'listFiles'], maxCallsPerTask: 8, canMutate: false },
  { agent: 'URANUS', allowed: ['readFile', 'searchCode', 'listFiles'], maxCallsPerTask: 8, canMutate: false },
  { agent: 'NEPTUNE', allowed: ['readFile', 'searchCode', 'listFiles'], maxCallsPerTask: 8, canMutate: false },
  { agent: 'CALLISTO', allowed: ['readFile', 'searchCode', 'listFiles', 'writeFile'], maxCallsPerTask: 10, canMutate: true },
  { agent: 'ATLAS', allowed: ['readFile', 'searchCode', 'listFiles'], maxCallsPerTask: 8, canMutate: false },
  { agent: 'ANDROMEDA', allowed: ['readFile', 'searchCode', 'listFiles'], maxCallsPerTask: 5, canMutate: false },
];

// ============================================================================
// Tool Registry
// ============================================================================

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();
  private permissions: Map<string, AgentToolPermissions> = new Map();
  private callCounts: Map<string, number> = new Map(); // task-agent → count

  constructor(customPermissions?: AgentToolPermissions[]) {
    const perms = customPermissions ?? DEFAULT_PERMISSIONS;
    for (const p of perms) {
      this.permissions.set(p.agent, p);
    }
  }

  /** Register a tool */
  register(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool "${tool.name}" is already registered`);
    }
    this.tools.set(tool.name, tool);
  }

  /** Get a tool by name */
  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  /** List all registered tools */
  listAll(): Tool[] {
    return Array.from(this.tools.values());
  }

  /** List tools available to a specific agent */
  listForAgent(agentName: string): Tool[] {
    const perms = this.permissions.get(agentName);
    if (!perms) {
      // Unknown agent — read-only tools only
      return this.listAll().filter(t => !t.mutating);
    }

    return this.listAll().filter(t => {
      // Check explicit blocks
      if (t.blockedAgents.length > 0 && t.blockedAgents.includes(agentName)) return false;
      // Check allowed list
      if (t.allowedAgents.length > 0 && !t.allowedAgents.includes(agentName)) return false;
      // Check permission config
      if (!perms.allowed.includes(t.name)) return false;
      // Check mutation permission
      if (t.mutating && !perms.canMutate) return false;
      return true;
    });
  }

  /** Get permissions for an agent */
  getPermissions(agentName: string): AgentToolPermissions | undefined {
    return this.permissions.get(agentName);
  }

  /** Check if an agent can call a specific tool (includes rate limiting) */
  canCall(agentName: string, toolName: string, taskId: string): { allowed: boolean; reason?: string } {
    const tool = this.tools.get(toolName);
    if (!tool) return { allowed: false, reason: `Tool "${toolName}" not found` };

    const perms = this.permissions.get(agentName);
    if (!perms) return { allowed: false, reason: `Agent "${agentName}" has no permissions configured` };

    if (!perms.allowed.includes(toolName)) {
      return { allowed: false, reason: `Agent "${agentName}" is not allowed to use "${toolName}"` };
    }

    if (tool.mutating && !perms.canMutate) {
      return { allowed: false, reason: `Agent "${agentName}" cannot use mutating tools` };
    }

    if (tool.blockedAgents.includes(agentName)) {
      return { allowed: false, reason: `Agent "${agentName}" is explicitly blocked from "${toolName}"` };
    }

    // Rate limit check
    const key = `${taskId}:${agentName}`;
    const count = this.callCounts.get(key) ?? 0;
    if (count >= perms.maxCallsPerTask) {
      return { allowed: false, reason: `Agent "${agentName}" has reached max tool calls (${perms.maxCallsPerTask}) for this task` };
    }

    return { allowed: true };
  }

  /** Record a tool call (for rate limiting) */
  recordCall(agentName: string, taskId: string): void {
    const key = `${taskId}:${agentName}`;
    this.callCounts.set(key, (this.callCounts.get(key) ?? 0) + 1);
  }

  /** Reset call counts for a task */
  resetCallCounts(taskId: string): void {
    for (const key of this.callCounts.keys()) {
      if (key.startsWith(`${taskId}:`)) {
        this.callCounts.delete(key);
      }
    }
  }

  /** Convert tool to OpenAI-compatible spec for LLM prompt injection */
  toSpec(tool: Tool): ToolSpec {
    // Extract JSON schema from Zod
    const jsonSchema = zodToJsonSchema(tool.parameters);
    return {
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: jsonSchema,
      },
    };
  }

  /** Get all tool specs for an agent (for Ollama /api/chat tools parameter) */
  getSpecsForAgent(agentName: string): ToolSpec[] {
    return this.listForAgent(agentName).map(t => this.toSpec(t));
  }

  /** Format tools as a prompt string for injection into system prompt */
  formatToolsForPrompt(agentName: string): string {
    const tools = this.listForAgent(agentName);
    if (tools.length === 0) return '';

    const perms = this.permissions.get(agentName);
    const maxCalls = perms?.maxCallsPerTask ?? 10;

    let prompt = '<available_tools>\n';
    prompt += `You have access to ${tools.length} tools. Max ${maxCalls} calls per task.\n\n`;

    for (const tool of tools) {
      const schema = zodToJsonSchema(tool.parameters);
      prompt += `## ${tool.name}\n`;
      prompt += `${tool.description}\n`;
      prompt += `Parameters: ${JSON.stringify(schema.properties, null, 2)}\n`;
      if (schema.required && schema.required.length > 0) {
        prompt += `Required: ${schema.required.join(', ')}\n`;
      }
      prompt += '\n';
    }

    prompt += 'To use a tool, respond with:\n';
    prompt += '<tool_call>\n{"name": "toolName", "arguments": {"param": "value"}}\n</tool_call>\n\n';
    prompt += 'You may use multiple tools before giving your final answer.\n';
    prompt += 'When done, wrap your final output in <final_output> tags.\n';
    prompt += '</available_tools>\n';

    return prompt;
  }
}

// ============================================================================
// Zod → JSON Schema utility (lightweight, no external dep)
// ============================================================================

interface SimpleJsonSchema {
  type: 'object';
  properties: Record<string, unknown>;
  required?: string[];
}

function zodToJsonSchema(schema: z.ZodSchema<unknown>): SimpleJsonSchema {
  const result: SimpleJsonSchema = { type: 'object' as const, properties: {} };
  const required: string[] = [];

  // Handle ZodObject
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    for (const [key, value] of Object.entries(shape)) {
      const field = value as z.ZodTypeAny;
      result.properties[key] = zodFieldToJsonSchema(field);
      if (!field.isOptional()) {
        required.push(key);
      }
    }
  }

  if (required.length > 0) result.required = required;
  return result;
}

function zodFieldToJsonSchema(field: z.ZodTypeAny): Record<string, unknown> {
  // Unwrap optionals
  if (field instanceof z.ZodOptional) {
    return zodFieldToJsonSchema(field.unwrap());
  }
  if (field instanceof z.ZodString) return { type: 'string' };
  if (field instanceof z.ZodNumber) return { type: 'number' };
  if (field instanceof z.ZodBoolean) return { type: 'boolean' };
  if (field instanceof z.ZodArray) {
    return { type: 'array', items: zodFieldToJsonSchema(field.element) };
  }
  // Default fallback
  return { type: 'string' };
}

// ============================================================================
// Singleton factory
// ============================================================================

let globalRegistry: ToolRegistry | null = null;

export function getToolRegistry(): ToolRegistry {
  if (!globalRegistry) {
    globalRegistry = new ToolRegistry();
  }
  return globalRegistry;
}

export function resetToolRegistry(): void {
  globalRegistry = null;
}
