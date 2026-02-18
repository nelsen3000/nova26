// Agent Scratchpad — Maintains conversation history for the inner ReAct loop
// Manages token budget, sliding window, and observation collapsing

// ============================================================================
// Types
// ============================================================================

export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ScratchpadMessage {
  role: MessageRole;
  content: string;
  /** Tool call ID (for tool result messages) */
  toolCallId?: string;
  /** Tool name (for tool result messages) */
  toolName?: string;
  /** Whether this message has been collapsed to save tokens */
  collapsed: boolean;
  /** Original token count before collapsing */
  originalTokens: number;
  /** Current token count */
  currentTokens: number;
  /** Timestamp */
  timestamp: number;
}

export interface ScratchpadConfig {
  /** Max total tokens for the scratchpad (excluding system prompt) */
  maxTokens: number;
  /** Number of recent turns to keep uncollapsed */
  activeWindowSize: number;
  /** Max tokens for a single tool output before truncation */
  maxToolOutputTokens: number;
}

const DEFAULT_CONFIG: ScratchpadConfig = {
  maxTokens: 20000,
  activeWindowSize: 6,
  maxToolOutputTokens: 2000,
};

// ============================================================================
// Token estimation (fast, no external deps)
// ============================================================================

/** Rough token estimate: ~4 chars per token for English/code */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ============================================================================
// Scratchpad
// ============================================================================

export class Scratchpad {
  private messages: ScratchpadMessage[] = [];
  private config: ScratchpadConfig;

  constructor(config?: Partial<ScratchpadConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Add a message to the scratchpad */
  add(role: MessageRole, content: string, options?: { toolCallId?: string; toolName?: string }): void {
    const tokens = estimateTokens(content);

    // Truncate oversized tool outputs immediately
    let finalContent = content;
    let finalTokens = tokens;
    if (role === 'tool' && tokens > this.config.maxToolOutputTokens) {
      const maxChars = this.config.maxToolOutputTokens * 4;
      finalContent = content.slice(0, maxChars) + '\n... (output truncated)';
      finalTokens = estimateTokens(finalContent);
    }

    this.messages.push({
      role,
      content: finalContent,
      toolCallId: options?.toolCallId,
      toolName: options?.toolName,
      collapsed: false,
      originalTokens: tokens,
      currentTokens: finalTokens,
      timestamp: Date.now(),
    });

    // Collapse old messages if over budget
    this.enforceTokenBudget();
  }

  /** Get all messages in conversation format */
  getMessages(): Array<{ role: MessageRole; content: string; toolCallId?: string }> {
    return this.messages.map(m => ({
      role: m.role,
      content: m.content,
      ...(m.toolCallId ? { toolCallId: m.toolCallId } : {}),
    }));
  }

  /** Get total token count */
  getTotalTokens(): number {
    return this.messages.reduce((sum, m) => sum + m.currentTokens, 0);
  }

  /** Get number of turns (assistant + tool pairs) */
  getTurnCount(): number {
    return this.messages.filter(m => m.role === 'assistant').length;
  }

  /** Get the last assistant message */
  getLastAssistantMessage(): string | undefined {
    for (let i = this.messages.length - 1; i >= 0; i--) {
      if (this.messages[i].role === 'assistant') return this.messages[i].content;
    }
    return undefined;
  }

  /** Clear the scratchpad */
  clear(): void {
    this.messages = [];
  }

  /** Get full conversation as a single string (for debugging/logging) */
  toDebugString(): string {
    return this.messages.map(m => {
      const prefix = m.collapsed ? '[COLLAPSED] ' : '';
      const toolInfo = m.toolName ? ` (${m.toolName})` : '';
      return `${prefix}[${m.role}${toolInfo}] ${m.content.slice(0, 200)}${m.content.length > 200 ? '...' : ''}`;
    }).join('\n\n');
  }

  // ============================================================================
  // Private: Token budget management
  // ============================================================================

  private enforceTokenBudget(): void {
    while (this.getTotalTokens() > this.config.maxTokens && this.messages.length > this.config.activeWindowSize) {
      // Find the oldest non-collapsed message outside the active window
      const activeStart = this.messages.length - this.config.activeWindowSize;

      let collapsed = false;
      for (let i = 0; i < activeStart; i++) {
        if (!this.messages[i].collapsed) {
          this.collapseMessage(i);
          collapsed = true;
          break;
        }
      }

      if (!collapsed) break; // All old messages already collapsed
    }
  }

  private collapseMessage(index: number): void {
    const msg = this.messages[index];

    let summary: string;
    if (msg.role === 'tool') {
      summary = `[Tool: ${msg.toolName ?? 'unknown'}] Output collapsed (was ${msg.originalTokens} tokens)`;
    } else if (msg.role === 'assistant') {
      // Keep first 100 chars of reasoning
      summary = `[Reasoning] ${msg.content.slice(0, 100)}... (collapsed from ${msg.originalTokens} tokens)`;
    } else {
      summary = `[${msg.role}] (collapsed, was ${msg.originalTokens} tokens)`;
    }

    msg.content = summary;
    msg.currentTokens = estimateTokens(summary);
    msg.collapsed = true;
  }
}
