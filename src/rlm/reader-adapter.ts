// Reader Model Adapter - Compress context using a lightweight reader model
// Spec: .kiro/specs/recursive-language-models/design.md

import type {
  ScratchpadMessage,
  ContextSegment,
} from './types.js';
import {
  createSegment,
  estimateTokenCount,
} from './context-window.js';
import { selectReaderModel, ModelSelectionResult } from './model-selection.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════════════════

export interface ReaderAdapterConfig {
  modelSelection?: ModelSelectionResult;
  timeoutMs: number;
  compressionTargetRatio: number;
}

export const DEFAULT_CONFIG: ReaderAdapterConfig = {
  timeoutMs: 30000,
  compressionTargetRatio: 0.5,
};

// ═══════════════════════════════════════════════════════════════════════════════
// LLM Call Interface (stub - would integrate with actual LLM client)
// ═══════════════════════════════════════════════════════════════════════════════

export interface LLMCallOptions {
  modelId: string;
  systemPrompt: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  maxTokens?: number;
}

export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
}

export type LLMCaller = (options: LLMCallOptions) => Promise<LLMResponse>;

// ═══════════════════════════════════════════════════════════════════════════════
// Compression Prompt
// ═══════════════════════════════════════════════════════════════════════════════

function buildCompressionPrompt(messages: ScratchpadMessage[]): string {
  const messageText = messages
    .map(m => `[${m.role}] ${m.content}`)
    .join('\n\n');

  return `You are a context compression assistant. Your task is to analyze the conversation history and produce a compressed representation.

For each message or group of related messages, create a segment with:
1. A compressed summary of the key information
2. A relevance score (0.0-1.0) indicating how important this is for the current task
3. The original token count (estimate ~4 chars per token)

Output format (JSON array):
[
  {
    "id": "segment-1",
    "role": "user|assistant|tool|system",
    "content": "compressed content",
    "originalTokens": 50,
    "relevanceScore": 0.9,
    "sourceMessageIds": ["msg-1", "msg-2"]
  }
]

Conversation to compress:
${messageText}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Reader Adapter
// ═══════════════════════════════════════════════════════════════════════════════

export interface CompressionOutput {
  segments: ContextSegment[];
  success: boolean;
  error?: string;
}

export async function compressWithReader(
  messages: ScratchpadMessage[],
  llmCaller: LLMCaller,
  config: Partial<ReaderAdapterConfig> = {}
): Promise<CompressionOutput> {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };

  // Select model if not provided
  const modelSelection =
    fullConfig.modelSelection || selectReaderModel();

  const systemPrompt = `You are a context compression assistant. Analyze conversation history and produce compressed segments with relevance scores (0.0-1.0). Higher scores for task-critical information.`;

  const llmMessages = [
    {
      role: 'user',
      content: buildCompressionPrompt(messages),
    },
  ];

  try {
    // Call LLM with timeout
    const response = await Promise.race([
      llmCaller({
        modelId: modelSelection.modelId,
        systemPrompt,
        messages: llmMessages,
        temperature: 0.3,
        maxTokens: 2000,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error('Reader model timeout')),
          fullConfig.timeoutMs
        )
      ),
    ]);

    // Parse response
    const parsedSegments = parseCompressionResponse(
      response.content,
      messages
    );

    return {
      segments: parsedSegments,
      success: true,
    };
  } catch (error) {
    return {
      segments: [],
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Response Parsing
// ═══════════════════════════════════════════════════════════════════════════════

function parseCompressionResponse(
  content: string,
  sourceMessages: ScratchpadMessage[]
): ContextSegment[] {
  try {
    // Try to extract JSON from the response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      // Fallback: treat entire response as single segment
      return [
        createSegment(
          `segment-${Date.now()}`,
          'system',
          content,
          sourceMessages.reduce((sum, m) => sum + estimateTokenCount(m.content), 0),
          estimateTokenCount(content),
          0.5,
          sourceMessages.map(m => m.id)
        ),
      ];
    }

    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) {
      throw new Error('Response is not an array');
    }

    return parsed.map((item: unknown, index: number) => {
      const raw = item as Record<string, unknown>;
      return createSegment(
        (raw.id as string) || `segment-${index}`,
        (raw.role as ContextSegment['role']) || 'system',
        (raw.content as string) || '',
        (raw.originalTokens as number) || 0,
        estimateTokenCount((raw.content as string) || ''),
        (raw.relevanceScore as number) || 0.5,
        Array.isArray(raw.sourceMessageIds)
          ? (raw.sourceMessageIds as string[])
          : sourceMessages.map(m => m.id),
        raw.metadata as Record<string, unknown> | undefined
      );
    });
  } catch (error) {
    // Fallback: create single segment from raw content
    return [
      createSegment(
        `segment-fallback-${Date.now()}`,
        'system',
        content,
        sourceMessages.reduce((sum, m) => sum + estimateTokenCount(m.content), 0),
        estimateTokenCount(content),
        0.5,
        sourceMessages.map(m => m.id)
      ),
    ];
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Mock LLM Caller (for testing)
// ═══════════════════════════════════════════════════════════════════════════════

export function createMockLLMCaller(
  options: {
    delayMs?: number;
    successRate?: number;
    compressionRatio?: number;
  } = {}
): LLMCaller {
  const { delayMs = 100, successRate = 0.9, compressionRatio = 0.5 } = options;

  return async (callOptions: LLMCallOptions): Promise<LLMResponse> => {
    // Simulate network delay
    await new Promise(r => setTimeout(r, delayMs));

    // Simulate occasional failures
    if (Math.random() > successRate) {
      throw new Error('Mock LLM failure');
    }

    // Generate mock compressed segments
    const inputLength = callOptions.messages.reduce(
      (sum, m) => sum + m.content.length,
      0
    );
    const compressedLength = Math.floor(inputLength * compressionRatio);

    const mockSegments = [
      {
        id: 'seg-1',
        role: 'system',
        content: `Compressed context (${compressedLength} chars)`,
        originalTokens: Math.floor(inputLength / 4),
        relevanceScore: 0.8,
        sourceMessageIds: ['msg-1'],
      },
    ];

    return {
      content: JSON.stringify(mockSegments),
      usage: {
        promptTokens: Math.floor(inputLength / 4),
        completionTokens: Math.floor(compressedLength / 4),
      },
    };
  };
}
