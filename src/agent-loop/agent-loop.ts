// Agent Loop Core — ReAct inner loop with tool use and multi-turn reasoning
// KIMI-AGENT-01: The heart of agentic execution

import type { ToolRegistry, ToolExecution, ToolCall, ToolResult } from '../tools/tool-registry.js';
import { parseToolCalls, extractFinalOutput, hasFinalOutput, formatToolResults } from '../tools/tool-parser.js';
import { Scratchpad } from './scratchpad.js';
import { callLLM } from '../llm/ollama-client.js';

// ============================================================================
// Configuration
// ============================================================================

export interface AgentLoopConfig {
  maxTurns: number;           // default 8
  confidenceThreshold: number; // default 0.85, agent stops if confident
  tokenBudget: number;         // max tokens for entire loop
  enableTools: boolean;        // can be disabled per autonomy level
  thinkingModel?: string;      // cheap model for inner turns (e.g., 'qwen2.5:7b')
  finalModel?: string;         // quality model for final output (e.g., 'qwen2.5:14b')
}

const DEFAULT_CONFIG: AgentLoopConfig = {
  maxTurns: 8,
  confidenceThreshold: 0.85,
  tokenBudget: 50000,
  enableTools: true,
  thinkingModel: 'qwen2.5:7b',
  finalModel: 'qwen2.5:14b',
};

// ============================================================================
// Result Types
// ============================================================================

export interface AgentLoopResult {
  output: string;             // Final agent output
  toolExecutions: ToolExecution[];  // All tool calls made
  turns: number;              // How many inner turns
  totalTokens: number;        // Total tokens consumed
  confidence: number;         // Agent's self-assessed confidence (0-1)
  stoppedBecause: 'confidence' | 'max_turns' | 'budget' | 'done' | 'error';
}

interface ParsedFinalOutput {
  content: string;
  confidence: number;
}

// ============================================================================
// Agent Loop
// ============================================================================

export class AgentLoop {
  private registry: ToolRegistry;
  private config: AgentLoopConfig;
  private scratchpad: Scratchpad;
  private toolExecutions: ToolExecution[] = [];
  private totalTokens = 0;
  private turns = 0;
  private baseSystemPrompt = '';

  constructor(registry: ToolRegistry, config?: Partial<AgentLoopConfig>) {
    this.registry = registry;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.scratchpad = new Scratchpad({
      maxTokens: Math.min(this.config.tokenBudget * 0.8, 30000),
      activeWindowSize: 6,
      maxToolOutputTokens: 2000,
    });
  }

  async run(
    agentName: string,
    systemPrompt: string,
    userPrompt: string,
    taskId: string,
  ): Promise<AgentLoopResult> {
    // Reset state for new run
    this.scratchpad.clear();
    this.toolExecutions = [];
    this.totalTokens = 0;
    this.turns = 0;

    // Build base system prompt with tool definitions
    this.baseSystemPrompt = this.buildSystemPrompt(agentName, systemPrompt);

    // Add initial user task to scratchpad
    this.scratchpad.add('user', userPrompt);

    try {
      while (this.turns < this.config.maxTurns) {
        // Check token budget
        if (this.totalTokens >= this.config.tokenBudget) {
          return this.buildResult('budget', agentName);
        }

        // Determine which model to use
        const isFinalTurn = this.turns === this.config.maxTurns - 1;
        const model = isFinalTurn 
          ? (this.config.finalModel ?? this.config.thinkingModel ?? 'qwen2.5:7b')
          : (this.config.thinkingModel ?? 'qwen2.5:7b');

        // Call LLM
        const response = await this.callModel(model, agentName, isFinalTurn);
        this.totalTokens += response.tokens || 0;
        this.turns++;

        const content = response.content;

        // Check for final output
        if (hasFinalOutput(content)) {
          const final = this.parseFinalOutput(content);
          this.scratchpad.add('assistant', content);
          
          // Check confidence threshold
          if (final.confidence >= this.config.confidenceThreshold) {
            return this.buildResult('confidence', agentName, final.content, final.confidence);
          }
          
          // Confidence too low, continue if we have turns left
          if (this.turns >= this.config.maxTurns) {
            return this.buildResult('done', agentName, final.content, final.confidence);
          }
          continue;
        }

        // If this is the final turn and no final output, extract what we can
        if (isFinalTurn) {
          this.scratchpad.add('assistant', content);
          return this.buildResult('max_turns', agentName, content, 0.5);
        }

        // Check for tool calls
        if (this.config.enableTools) {
          const toolCalls = parseToolCalls(content);
          
          if (toolCalls.length > 0) {
            // Add assistant message with tool calls to scratchpad
            this.scratchpad.add('assistant', content);

            // Execute tools
            const results = await this.executeTools(agentName, taskId, toolCalls);
            
            // Format and add results to scratchpad
            const formattedResults = formatToolResults(toolCalls, results);
            this.scratchpad.add('tool', formattedResults, {
              toolCallId: toolCalls[0]?.id,
              toolName: toolCalls[0]?.name,
            });

            // Track executions
            for (let i = 0; i < toolCalls.length; i++) {
              this.toolExecutions.push({
                call: toolCalls[i],
                result: results[i],
                timestamp: Date.now(),
              });
            }

            continue;
          }
        }

        // No tool calls, no final output — add reasoning to scratchpad and continue
        this.scratchpad.add('assistant', content);
      }

      // Max turns reached without final output
      return this.buildResult('max_turns', agentName);

    } catch (error) {
      return this.buildErrorResult(error);
    }
  }

  // ============================================================================
  // Private: Prompt Building
  // ============================================================================

  private buildSystemPrompt(agentName: string, basePrompt: string): string {
    const parts: string[] = [];

    // Base system prompt
    parts.push(basePrompt);

    // Add tool definitions if tools are enabled
    if (this.config.enableTools) {
      try {
        const toolsPrompt = this.registry.formatToolsForPrompt(agentName);
        if (toolsPrompt) {
          parts.push(toolsPrompt);
        }
      } catch {
        // If formatting fails (e.g., agent not in registry), continue without tools
      }
    }

    // Add output format instructions
    parts.push(this.getOutputFormatInstructions());

    return parts.join('\n\n');
  }

  private getOutputFormatInstructions(): string {
    return `<output_format>
When you are ready to provide your final answer, wrap it in <final_output> tags with a confidence attribute:

<final_output confidence="0.92">
Your final response here.
</final_output>

Confidence should be between 0.0 and 1.0 based on your certainty:
- 0.9-1.0: Very confident, clear answer
- 0.7-0.9: Fairly confident, minor uncertainties
- 0.5-0.7: Uncertain, significant gaps
- Below 0.5: Highly uncertain, more research needed
</output_format>`;
  }

  // ============================================================================
  // Private: LLM Calling
  // ============================================================================

  private async callModel(model: string, agentName: string, isFinalTurn: boolean): Promise<import('../types/index.js').LLMResponse> {
    // Build conversation context
    const messages = this.scratchpad.getMessages();
    
    // Find the system and user prompts
    const systemPrompt = this.baseSystemPrompt;
    
    // Build the user prompt from conversation history
    let userPrompt: string;
    
    if (messages.length === 1 && messages[0].role === 'user') {
      // First turn - just use the original user prompt
      userPrompt = messages[0].content;
    } else {
      // Subsequent turns - include full conversation history
      const history = messages.map(m => {
        const roleLabel = m.role.toUpperCase();
        return `[${roleLabel}]\n${m.content}`;
      }).join('\n\n');
      
      userPrompt = `Continue the task based on this conversation history:\n\n${history}`;
    }

    // Add urgency message on final turn if not already present
    if (isFinalTurn) {
      userPrompt += '\n\n[SYSTEM: This is your final turn. You MUST now provide your final output wrapped in <final_output> tags with a confidence score between 0.0 and 1.0.]';
    }

    // Use callLLM with model override
    const response = await callLLM(systemPrompt, userPrompt, agentName, { 
      cache: false,
      model,
    });
    
    // Override the model in response for tracking
    return {
      ...response,
      model,
    };
  }

  // ============================================================================
  // Private: Tool Execution
  // ============================================================================

  private async executeTools(
    agentName: string,
    taskId: string,
    toolCalls: ToolCall[]
  ): Promise<ToolResult[]> {
    const results: ToolResult[] = [];

    for (const call of toolCalls) {
      // Check permissions
      const permission = this.registry.canCall(agentName, call.name, taskId);
      if (!permission.allowed) {
        results.push({
          success: false,
          output: '',
          error: permission.reason ?? 'Permission denied',
          duration: 0,
          truncated: false,
        });
        continue;
      }

      // Get tool
      const tool = this.registry.get(call.name);
      if (!tool) {
        results.push({
          success: false,
          output: '',
          error: `Tool "${call.name}" not found`,
          duration: 0,
          truncated: false,
        });
        continue;
      }

      // Record the call
      this.registry.recordCall(agentName, taskId);

      // Execute with timeout
      const startTime = Date.now();
      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error(`Tool execution timed out after ${tool.timeout}ms`)), tool.timeout);
        });

        const result = await Promise.race([
          tool.execute(call.arguments),
          timeoutPromise,
        ]);

        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          output: '',
          error: error instanceof Error ? error.message : String(error),
          duration: Date.now() - startTime,
          truncated: false,
        });
      }
    }

    return results;
  }

  // ============================================================================
  // Private: Final Output Handling
  // ============================================================================

  private parseFinalOutput(content: string): ParsedFinalOutput {
    const extracted = extractFinalOutput(content);
    if (!extracted) {
      return { content, confidence: 0.5 };
    }

    // Try to extract confidence from the tag attribute (handle both formats)
    // Format 1: <final_output confidence="0.92">
    // Format 2: <final_output>
    const confidenceMatch = content.match(/<final_output\s+confidence="([\d.]+)"[^>]*>/i) || 
                            content.match(/<final_output[^>]*confidence="([\d.]+)"[^>]*>/i);
    let confidence = 0.5;
    
    if (confidenceMatch) {
      const parsed = parseFloat(confidenceMatch[1]);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
        confidence = parsed;
      }
    }

    return { content: extracted, confidence };
  }

  // ============================================================================
  // Private: Result Building
  // ============================================================================

  private buildResult(
    stoppedBecause: AgentLoopResult['stoppedBecause'],
    _agentName: string,
    output?: string,
    confidence?: number
  ): AgentLoopResult {
    return {
      output: output ?? this.scratchpad.getLastAssistantMessage() ?? 'No output generated',
      toolExecutions: this.toolExecutions,
      turns: this.turns,
      totalTokens: this.totalTokens,
      confidence: confidence ?? 0.5,
      stoppedBecause,
    };
  }

  private buildErrorResult(error: unknown): AgentLoopResult {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      output: `Error during execution: ${errorMessage}`,
      toolExecutions: this.toolExecutions,
      turns: this.turns,
      totalTokens: this.totalTokens,
      confidence: 0,
      stoppedBecause: 'error',
    };
  }
}

// ============================================================================
// Factory
// ============================================================================

let globalAgentLoop: AgentLoop | null = null;

export function getAgentLoop(registry: ToolRegistry, config?: Partial<AgentLoopConfig>): AgentLoop {
  if (!globalAgentLoop) {
    globalAgentLoop = new AgentLoop(registry, config);
  }
  return globalAgentLoop;
}

export function resetAgentLoop(): void {
  globalAgentLoop = null;
}
