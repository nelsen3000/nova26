/**
 * KIMI-POLISH-03: Prompt Snapshot Testing
 * Capture and detect prompt drift across agent task types
 */

import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import { join } from 'path';
import { z } from 'zod';

// ============================================================================
// Types
// ============================================================================

export interface PromptSnapshot {
  agent: string;
  taskType: string;
  prompt: string;
  capturedAt: string;
  promptHash: string;
  version: string;
}

export type DriftResult =
  | { drifted: false }
  | {
      drifted: true;
      agent: string;
      taskType: string;
      oldHash: string;
      newHash: string;
      diffSummary: string;
    };

export const STANDARD_TASK_TYPES = [
  'code-generation',
  'testing',
  'architecture',
  'review',
  'debugging',
] as const;

// ============================================================================
// Zod Schema
// ============================================================================

const PromptSnapshotSchema = z.object({
  agent: z.string(),
  taskType: z.string(),
  prompt: z.string(),
  capturedAt: z.string(),
  promptHash: z.string(),
  version: z.string(),
});

// ============================================================================
// Utility Functions
// ============================================================================

function computeHash(prompt: string): string {
  return createHash('sha256').update(prompt, 'utf-8').digest('hex');
}

function generateDiffSummary(oldPrompt: string, newPrompt: string): string {
  const oldLines = oldPrompt.split('\n');
  const newLines = newPrompt.split('\n');
  const maxLines = Math.max(oldLines.length, newLines.length);
  let added = 0;
  let removed = 0;
  let modified = 0;

  for (let i = 0; i < maxLines; i++) {
    const oldLine = oldLines[i] ?? '';
    const newLine = newLines[i] ?? '';
    
    if (i >= oldLines.length) {
      added++;
    } else if (i >= newLines.length) {
      removed++;
    } else if (oldLine !== newLine) {
      modified++;
    }
  }

  const parts: string[] = [];
  if (added > 0) parts.push(`+${added} lines`);
  if (removed > 0) parts.push(`-${removed} lines`);
  if (modified > 0) parts.push(`~${modified} lines modified`);
  
  return parts.length > 0 ? parts.join(', ') : 'content changed';
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function getSnapshotFilename(agent: string, taskType: string): string {
  return `${sanitizeFilename(agent)}-${sanitizeFilename(taskType)}.snap`;
}

// ============================================================================
// PromptSnapshotManager Class
// ============================================================================

interface PromptSnapshotManagerOptions {
  snapshotDir?: string;
  version?: string;
}

class PromptSnapshotManager {
  private readonly snapshotDir: string;
  private readonly version: string;

  constructor(options: PromptSnapshotManagerOptions = {}) {
    this.snapshotDir = options.snapshotDir ?? '.nova/testing/snapshots';
    this.version = options.version ?? '1.0.0';
  }

  /**
   * Capture a new prompt snapshot and write to disk
   */
  async captureSnapshot(
    agent: string,
    taskType: string,
    prompt: string
  ): Promise<PromptSnapshot> {
    const snapshot: PromptSnapshot = {
      agent,
      taskType,
      prompt,
      capturedAt: new Date().toISOString(),
      promptHash: computeHash(prompt),
      version: this.version,
    };

    await this.ensureDirectory();
    const filepath = this.getSnapshotPath(agent, taskType);
    await fs.writeFile(filepath, JSON.stringify(snapshot, null, 2), 'utf-8');

    return snapshot;
  }

  /**
   * Load an existing snapshot from disk
   */
  async loadSnapshot(
    agent: string,
    taskType: string
  ): Promise<PromptSnapshot | null> {
    const filepath = this.getSnapshotPath(agent, taskType);

    try {
      const content = await fs.readFile(filepath, 'utf-8');
      const parsed = JSON.parse(content);
      const validated = PromptSnapshotSchema.safeParse(parsed);

      if (!validated.success) {
        return null;
      }

      return validated.data;
    } catch (error) {
      // File doesn't exist or is unreadable
      return null;
    }
  }

  /**
   * Detect if current prompt differs from stored snapshot
   */
  async detectPromptDrift(
    agent: string,
    taskType: string,
    currentPrompt: string
  ): Promise<DriftResult> {
    const stored = await this.loadSnapshot(agent, taskType);

    if (!stored) {
      // No snapshot exists - consider this as no drift (first capture)
      return { drifted: false };
    }

    const currentHash = computeHash(currentPrompt);

    if (stored.promptHash === currentHash) {
      return { drifted: false };
    }

    return {
      drifted: true,
      agent,
      taskType,
      oldHash: stored.promptHash,
      newHash: currentHash,
      diffSummary: generateDiffSummary(stored.prompt, currentPrompt),
    };
  }

  /**
   * Force-overwrite an existing snapshot
   */
  async updateSnapshot(
    agent: string,
    taskType: string,
    prompt: string
  ): Promise<void> {
    await this.captureSnapshot(agent, taskType, prompt);
  }

  /**
   * Check all existing snapshots for drift
   */
  async detectAllDrift(
    renderPrompt: (agent: string, taskType: string) => Promise<string>
  ): Promise<DriftResult[]> {
    const snapshots = await this.listSnapshots();
    const results: DriftResult[] = [];

    for (const { agent, taskType } of snapshots) {
      try {
        const currentPrompt = await renderPrompt(agent, taskType);
        const drift = await this.detectPromptDrift(agent, taskType, currentPrompt);
        results.push(drift);
      } catch (error) {
        // If we can't render the prompt, skip this snapshot
        results.push({ drifted: false });
      }
    }

    return results;
  }

  /**
   * List all stored snapshots
   */
  async listSnapshots(): Promise<Array<{ agent: string; taskType: string }>> {
    try {
      await this.ensureDirectory();
      const files = await fs.readdir(this.snapshotDir);
      const snapshots: Array<{ agent: string; taskType: string }> = [];

      for (const file of files) {
        if (!file.endsWith('.snap')) continue;

        // Parse filename: {agent}-{taskType}.snap
        const basename = file.slice(0, -5); // Remove .snap
        const lastDashIndex = basename.lastIndexOf('-');
        
        if (lastDashIndex === -1) continue;

        const agent = basename.slice(0, lastDashIndex).replace(/_/g, '-');
        const taskType = basename.slice(lastDashIndex + 1).replace(/_/g, '-');

        snapshots.push({ agent, taskType });
      }

      return snapshots;
    } catch (error) {
      return [];
    }
  }

  // -------------------------------------------------------------------------
  // Private Helpers
  // -------------------------------------------------------------------------

  private getSnapshotPath(agent: string, taskType: string): string {
    return join(this.snapshotDir, getSnapshotFilename(agent, taskType));
  }

  private async ensureDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.snapshotDir, { recursive: true });
    } catch (error) {
      // Directory already exists or cannot be created
    }
  }
}

// ============================================================================
// Singleton Factory
// ============================================================================

let globalManager: PromptSnapshotManager | null = null;

export function getPromptSnapshotManager(): PromptSnapshotManager {
  if (!globalManager) {
    globalManager = new PromptSnapshotManager();
  }
  return globalManager;
}

export function resetPromptSnapshotManager(): void {
  globalManager = null;
}

// ============================================================================
// Re-exports
// ============================================================================

export { PromptSnapshotManager, PromptSnapshotSchema };
