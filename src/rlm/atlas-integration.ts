// RLM ATLAS Integration - Store and retrieve compressed context
// Spec: .kiro/specs/recursive-language-models/tasks.md

import type { ContextWindow, SerializedContextWindow } from './types.js';
import { serializeContextWindow, deserializeContextWindow } from './context-window.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════════════════

export interface ATLASIntegrationConfig {
  enabled: boolean;
  storageKey: string;
  maxRetainedWindows: number;
}

export const DEFAULT_CONFIG: ATLASIntegrationConfig = {
  enabled: true,
  storageKey: 'rlm_context_windows',
  maxRetainedWindows: 100,
};

// ═══════════════════════════════════════════════════════════════════════════════
// ATLAS Storage Interface
// ═══════════════════════════════════════════════════════════════════════════════

export interface ATLASStorage {
  store(key: string, data: string): Promise<void>;
  retrieve(key: string): Promise<string | null>;
  list(pattern: string): Promise<string[]>;
  delete(key: string): Promise<void>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// In-Memory ATLAS Storage (for testing)
// ═══════════════════════════════════════════════════════════════════════════════

class InMemoryATLASStorage implements ATLASStorage {
  private data = new Map<string, string>();

  async store(key: string, data: string): Promise<void> {
    this.data.set(key, data);
  }

  async retrieve(key: string): Promise<string | null> {
    return this.data.get(key) || null;
  }

  async list(pattern: string): Promise<string[]> {
    const regex = new RegExp(pattern.replace('*', '.*'));
    return Array.from(this.data.keys()).filter(k => regex.test(k));
  }

  async delete(key: string): Promise<void> {
    this.data.delete(key);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// RLM ATLAS Integration
// ═══════════════════════════════════════════════════════════════════════════════

export class RLMATLASIntegration {
  private config: ATLASIntegrationConfig;
  private storage: ATLASStorage;

  constructor(
    storage: ATLASStorage = new InMemoryATLASStorage(),
    config?: Partial<ATLASIntegrationConfig>
  ) {
    this.storage = storage;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Store Context Window
  // ═══════════════════════════════════════════════════════════════════════════

  async storeContextWindow(
    sessionId: string,
    contextWindow: ContextWindow
  ): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    const serialized = serializeContextWindow(contextWindow);
    const key = `${this.config.storageKey}/${sessionId}/${contextWindow.createdAt}`;
    
    await this.storage.store(key, serialized);

    // Prune old windows if exceeding limit
    await this.pruneOldWindows(sessionId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Retrieve Historical Context
  // ═══════════════════════════════════════════════════════════════════════════

  async retrieveHistoricalContext(
    sessionId: string,
    maxAgeMs: number = 3600000 // 1 hour default
  ): Promise<ContextWindow[]> {
    if (!this.config.enabled) {
      return [];
    }

    const pattern = `${this.config.storageKey}/${sessionId}/*`;
    const keys = await this.storage.list(pattern);
    
    const cutoff = Date.now() - maxAgeMs;
    const windows: ContextWindow[] = [];

    for (const key of keys) {
      try {
        const data = await this.storage.retrieve(key);
        if (data) {
          const window = deserializeContextWindow(data);
          if (window.createdAt >= cutoff) {
            windows.push(window);
          }
        }
      } catch {
        // Skip invalid windows
      }
    }

    // Sort by recency
    return windows.sort((a, b) => b.createdAt - a.createdAt);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Re-compress Retrieved Context
  // ═══════════════════════════════════════════════════════════════════════════

  async recompressToBudget(
    contextWindow: ContextWindow,
    maxTokens: number
  ): Promise<ContextWindow> {
    // Sort segments by relevance
    const sortedSegments = [...contextWindow.segments].sort(
      (a, b) => b.relevanceScore - a.relevanceScore
    );

    // Select segments within budget
    const selected: typeof sortedSegments = [];
    let tokenCount = 0;

    for (const segment of sortedSegments) {
      if (tokenCount + segment.compressedTokens <= maxTokens) {
        selected.push(segment);
        tokenCount += segment.compressedTokens;
      }
    }

    // Sort back to original order for coherence
    selected.sort((a, b) => {
      const aIndex = contextWindow.segments.indexOf(a);
      const bIndex = contextWindow.segments.indexOf(b);
      return aIndex - bIndex;
    });

    return {
      ...contextWindow,
      segments: selected,
      totalCompressedTokens: tokenCount,
      compressionRatio: contextWindow.totalOriginalTokens / tokenCount,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Cross-Project Context Merging
  // ═══════════════════════════════════════════════════════════════════════════

  async mergeCrossProjectContext(
    sessionIds: string[],
    maxTokens: number
  ): Promise<ContextWindow | null> {
    const allWindows: ContextWindow[] = [];

    for (const sessionId of sessionIds) {
      const windows = await this.retrieveHistoricalContext(sessionId);
      allWindows.push(...windows);
    }

    if (allWindows.length === 0) {
      return null;
    }

    // Merge all segments
    const mergedSegments = allWindows.flatMap(w => w.segments);
    
    // Deduplicate by content
    const seen = new Set<string>();
    const uniqueSegments = mergedSegments.filter(s => {
      if (seen.has(s.content)) {
        return false;
      }
      seen.add(s.content);
      return true;
    });

    // Create merged window
    const merged: ContextWindow = {
      segments: uniqueSegments,
      totalOriginalTokens: uniqueSegments.reduce((s, seg) => s + seg.originalTokens, 0),
      totalCompressedTokens: uniqueSegments.reduce((s, seg) => s + seg.compressedTokens, 0),
      compressionRatio: 1,
      readerModelId: 'merged',
      createdAt: Date.now(),
      taskContext: 'Cross-project merged context',
    };

    // Re-compress to budget
    return this.recompressToBudget(merged, maxTokens);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Pruning
  // ═══════════════════════════════════════════════════════════════════════════

  private async pruneOldWindows(sessionId: string): Promise<void> {
    const pattern = `${this.config.storageKey}/${sessionId}/*`;
    const keys = await this.storage.list(pattern);

    if (keys.length <= this.config.maxRetainedWindows) {
      return;
    }

    // Sort by timestamp (extracted from key)
    const sortedKeys = keys.sort();
    const toDelete = sortedKeys.slice(0, keys.length - this.config.maxRetainedWindows);

    for (const key of toDelete) {
      await this.storage.delete(key);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Factory Function
// ═══════════════════════════════════════════════════════════════════════════════

export function createRLMATLASIntegration(
  storage?: ATLASStorage,
  config?: Partial<ATLASIntegrationConfig>
): RLMATLASIntegration {
  return new RLMATLASIntegration(storage, config);
}
