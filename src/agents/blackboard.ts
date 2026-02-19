// Shared Blackboard — Collective working memory for agent teams during builds
// KIMI-FRONTIER-01: Grok R13-01 shared blackboard pattern

import { z } from 'zod';
import type { AgentName } from './message-bus.js';

// ============================================================================
// Core Types
// ============================================================================

export interface BlackboardEntry {
  id: string;
  key: string;
  value: unknown;
  author: AgentName;
  taskId: string;
  confidence: number;
  tags: string[];
  supersedes?: string;
  writtenAt: string;
  version: number;
}

// ============================================================================
// Zod Schemas
// ============================================================================

export const BlackboardEntrySchema = z.object({
  id: z.string(),
  key: z.string(),
  value: z.unknown(),
  author: z.string(),
  taskId: z.string(),
  confidence: z.number().min(0).max(1),
  tags: z.array(z.string()),
  supersedes: z.string().optional(),
  writtenAt: z.string(),
  version: z.number().int().nonnegative(),
});

// ============================================================================
// SharedBlackboard Class
// ============================================================================

class SharedBlackboard {
  private entries: Map<string, BlackboardEntry> = new Map();
  private versionCounters: Map<string, number> = new Map();

  write(
    key: string,
    value: unknown,
    author: AgentName,
    taskId: string,
    options?: { confidence?: number; tags?: string[]; supersedes?: string }
  ): BlackboardEntry {
    const id = crypto.randomUUID();
    const writtenAt = new Date().toISOString();
    
    const confidence = options?.confidence ?? 0.8;
    const tags = options?.tags ?? [];
    
    // Compute version for this key+taskId
    const versionKey = `${taskId}::${key}`;
    const currentVersion = this.versionCounters.get(versionKey) ?? 0;
    const version = currentVersion + 1;
    this.versionCounters.set(versionKey, version);

    const entry: BlackboardEntry = {
      id,
      key,
      value,
      author,
      taskId,
      confidence,
      tags,
      supersedes: options?.supersedes,
      writtenAt,
      version,
    };

    this.entries.set(id, entry);
    return entry;
  }

  read(key: string, taskId: string): BlackboardEntry | null {
    // Find the most recent entry for this key+taskId
    let mostRecent: BlackboardEntry | null = null;
    
    for (const entry of this.entries.values()) {
      if (entry.key === key && entry.taskId === taskId) {
        if (!mostRecent || new Date(entry.writtenAt) > new Date(mostRecent.writtenAt)) {
          mostRecent = entry;
        }
      }
    }
    
    return mostRecent;
  }

  readAll(taskId: string, tags?: string[]): BlackboardEntry[] {
    const results: BlackboardEntry[] = [];
    
    for (const entry of this.entries.values()) {
      if (entry.taskId === taskId) {
        // If tags specified, require at least one match
        if (tags && tags.length > 0) {
          const hasMatchingTag = entry.tags.some(t => tags.includes(t));
          if (!hasMatchingTag) continue;
        }
        results.push(entry);
      }
    }

    // Sort by confidence desc (highest confidence first)
    results.sort((a, b) => b.confidence - a.confidence);
    
    return results;
  }

  supersede(oldEntryId: string, newKey: string, newValue: unknown, author: AgentName): BlackboardEntry {
    const oldEntry = this.entries.get(oldEntryId);
    if (!oldEntry) {
      throw new Error(`Entry ${oldEntryId} not found`);
    }

    return this.write(
      newKey,
      newValue,
      author,
      oldEntry.taskId,
      { supersedes: oldEntryId }
    );
  }

  snapshot(taskId: string): Record<string, BlackboardEntry> {
    const snapshot: Record<string, BlackboardEntry> = {};
    
    for (const entry of this.entries.values()) {
      if (entry.taskId === taskId) {
        // Only include the most recent version of each key
        if (!snapshot[entry.key] || entry.version > snapshot[entry.key].version) {
          snapshot[entry.key] = entry;
        }
      }
    }
    
    return snapshot;
  }

  clear(taskId: string): void {
    for (const [id, entry] of this.entries) {
      if (entry.taskId === taskId) {
        this.entries.delete(id);
      }
    }
    
    // Clean up version counters
    for (const key of this.versionCounters.keys()) {
      if (key.startsWith(`${taskId}::`)) {
        this.versionCounters.delete(key);
      }
    }
  }

  formatForPrompt(taskId: string, maxTokens: number = 500): string {
    const maxChars = maxTokens * 4;
    const entries = this.readAll(taskId);
    
    if (entries.length === 0) {
      return '';
    }

    let output = '## Shared Team Context (from other agents)\n\n';
    
    // Group by confidence tier
    const highConfidence = entries.filter(e => e.confidence >= 0.9);
    const mediumConfidence = entries.filter(e => e.confidence >= 0.7 && e.confidence < 0.9);
    const lowConfidence = entries.filter(e => e.confidence < 0.7);

    // Format entries by tier
    function formatEntry(entry: BlackboardEntry): string {
      const valueStr = typeof entry.value === 'string' 
        ? entry.value 
        : JSON.stringify(entry.value);
      return `[${entry.author}] ${entry.key} = "${valueStr}" (confidence: ${entry.confidence.toFixed(2)})`;
    }

    // Add high confidence entries
    for (const entry of highConfidence) {
      const line = `[HIGH CONFIDENCE] ${formatEntry(entry)}\n`;
      if (output.length + line.length > maxChars) {
        output += '...[truncated]\n';
        break;
      }
      output += line;
    }

    // Add medium confidence entries
    for (const entry of mediumConfidence) {
      const line = `[MEDIUM] ${formatEntry(entry)}\n`;
      if (output.length + line.length > maxChars) {
        output += '...[truncated]\n';
        break;
      }
      output += line;
    }

    // Add low confidence entries only if space permits
    for (const entry of lowConfidence) {
      const line = `[LOW] ${formatEntry(entry)}\n`;
      if (output.length + line.length > maxChars) {
        output += '...[truncated]\n';
        break;
      }
      output += line;
    }

    return output.trim();
  }

  // For testing
  getEntry(id: string): BlackboardEntry | undefined {
    return this.entries.get(id);
  }
}

// ============================================================================
// Singleton Factory
// ============================================================================

let instance: SharedBlackboard | null = null;

export function getSharedBlackboard(): SharedBlackboard {
  if (!instance) {
    instance = new SharedBlackboard();
  }
  return instance;
}

export function resetSharedBlackboard(): void {
  instance = null;
}

export { SharedBlackboard };
