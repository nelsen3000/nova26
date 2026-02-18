// Tool Parser — Extracts tool calls from LLM responses
// Supports both XML-tagged format and native JSON tool_calls

import { randomUUID } from 'crypto';
import type { ToolCall } from './tool-registry.js';

// ============================================================================
// Parse XML-tagged tool calls
// ============================================================================

/**
 * Parse tool calls from XML-tagged format:
 * <tool_call>
 * {"name": "readFile", "arguments": {"path": "src/index.ts"}}
 * </tool_call>
 */
export function parseXmlToolCalls(response: string): ToolCall[] {
  const calls: ToolCall[] = [];
  const regex = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/g;

  let match: RegExpExecArray | null;
  while ((match = regex.exec(response)) !== null) {
    try {
      const raw = match[1].trim();
      const parsed = JSON.parse(raw);

      if (parsed.name && typeof parsed.name === 'string') {
        calls.push({
          id: `tc_${randomUUID().slice(0, 8)}`,
          name: parsed.name,
          arguments: parsed.arguments ?? {},
        });
      }
    } catch {
      // Invalid JSON in tool_call block — skip it
    }
  }

  return calls;
}

// ============================================================================
// Parse native JSON tool calls (Ollama format)
// ============================================================================

interface OllamaToolCallMessage {
  tool_calls?: Array<{
    id?: string;
    function: {
      name: string;
      arguments: string | Record<string, unknown>;
    };
  }>;
}

/**
 * Parse tool calls from Ollama's native tool_calls response format
 */
export function parseNativeToolCalls(message: OllamaToolCallMessage): ToolCall[] {
  if (!message.tool_calls || !Array.isArray(message.tool_calls)) {
    return [];
  }

  return message.tool_calls
    .filter(tc => tc.function?.name)
    .map(tc => ({
      id: tc.id ?? `tc_${randomUUID().slice(0, 8)}`,
      name: tc.function.name,
      arguments: typeof tc.function.arguments === 'string'
        ? safeJsonParse(tc.function.arguments)
        : tc.function.arguments ?? {},
    }));
}

// ============================================================================
// Parse any format (auto-detect)
// ============================================================================

/**
 * Auto-detect and parse tool calls from LLM response.
 * Tries XML tags first (most reliable with local models), then JSON blocks.
 */
export function parseToolCalls(response: string): ToolCall[] {
  // Try XML format first (our recommended format)
  const xmlCalls = parseXmlToolCalls(response);
  if (xmlCalls.length > 0) return xmlCalls;

  // Try JSON code blocks
  const jsonCalls = parseJsonBlockToolCalls(response);
  if (jsonCalls.length > 0) return jsonCalls;

  return [];
}

/**
 * Parse tool calls from JSON inside code blocks:
 * ```json
 * {"tool": "readFile", "args": {"path": "src/index.ts"}}
 * ```
 */
function parseJsonBlockToolCalls(response: string): ToolCall[] {
  const calls: ToolCall[] = [];
  const regex = /```(?:json)?\s*([\s\S]*?)```/g;

  let match: RegExpExecArray | null;
  while ((match = regex.exec(response)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());

      // Support both {"tool": ..., "args": ...} and {"name": ..., "arguments": ...}
      const name = parsed.tool ?? parsed.name;
      const args = parsed.args ?? parsed.arguments ?? {};

      if (name && typeof name === 'string') {
        calls.push({
          id: `tc_${randomUUID().slice(0, 8)}`,
          name,
          arguments: args,
        });
      }
    } catch {
      // Not a valid tool call JSON block
    }
  }

  return calls;
}

// ============================================================================
// Extract final output
// ============================================================================

/**
 * Extract the final output from an agent response.
 * Looks for <final_output> tags. Falls back to full response minus tool calls.
 */
export function extractFinalOutput(response: string): string | null {
  const match = /<final_output>\s*([\s\S]*?)\s*<\/final_output>/.exec(response);
  if (match) return match[1].trim();
  return null;
}

/**
 * Check if the response contains any tool calls
 */
export function hasToolCalls(response: string): boolean {
  return /<tool_call>/.test(response) || /```json[\s\S]*?"(?:tool|name)"/.test(response);
}

/**
 * Check if the response contains a final output
 */
export function hasFinalOutput(response: string): boolean {
  return /<final_output>/.test(response);
}

/**
 * Strip tool calls from response, leaving only reasoning text
 */
export function stripToolCalls(response: string): string {
  return response
    .replace(/<tool_call>[\s\S]*?<\/tool_call>/g, '')
    .replace(/<final_output>[\s\S]*?<\/final_output>/g, '')
    .trim();
}

// ============================================================================
// Format tool results for LLM consumption
// ============================================================================

/**
 * Format tool execution results for injection back into the conversation
 */
export function formatToolResults(
  calls: ToolCall[],
  results: Array<{ success: boolean; output: string; error?: string }>
): string {
  const parts: string[] = [];

  for (let i = 0; i < calls.length; i++) {
    const call = calls[i];
    const result = results[i];

    parts.push(`<tool_result name="${call.name}" id="${call.id}">`);
    if (result.success) {
      parts.push(result.output);
    } else {
      parts.push(`ERROR: ${result.error ?? 'Unknown error'}`);
    }
    parts.push('</tool_result>');
  }

  return parts.join('\n');
}

// ============================================================================
// Helpers
// ============================================================================

function safeJsonParse(str: string): Record<string, unknown> {
  try {
    return JSON.parse(str);
  } catch {
    return {};
  }
}
