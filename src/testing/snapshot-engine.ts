// Snapshot Manager & Comparison Engine
// KIMI-TESTING-03: R16-04 spec

import { z } from 'zod';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import crypto from 'crypto';

// ============================================================================
// Core Types
// ============================================================================

export type SnapshotFormat = 'json' | 'text' | 'html' | 'xml';

export interface Snapshot {
  id: string;
  name: string;
  content: string;
  format: SnapshotFormat;
  hash: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface SnapshotComparison {
  identical: boolean;
  additions: number;
  deletions: number;
  modifications: number;
  diff: string;
  similarity: number; // 0-100
}

export interface SnapshotMatchOptions {
  ignoreWhitespace?: boolean;
  ignoreCase?: boolean;
  ignoreFields?: string[]; // For JSON snapshots
  threshold?: number; // Similarity threshold (0-100)
}

export interface SnapshotStore {
  save(snapshot: Snapshot): Promise<void>;
  load(id: string): Promise<Snapshot | null>;
  loadByName(name: string): Promise<Snapshot | null>;
  list(): Promise<Snapshot[]>;
  delete(id: string): Promise<boolean>;
  clear(): Promise<void>;
}

// ============================================================================
// Zod Schemas
// ============================================================================

export const SnapshotSchema = z.object({
  id: z.string(),
  name: z.string(),
  content: z.string(),
  format: z.enum(['json', 'text', 'html', 'xml']),
  hash: z.string(),
  createdAt: z.string(),
  metadata: z.record(z.unknown()).optional(),
});

export const SnapshotComparisonSchema = z.object({
  identical: z.boolean(),
  additions: z.number(),
  deletions: z.number(),
  modifications: z.number(),
  diff: z.string(),
  similarity: z.number().min(0).max(100),
});

// ============================================================================
// SnapshotHasher
// ============================================================================

export class SnapshotHasher {
  static compute(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  static verify(content: string, hash: string): boolean {
    return this.compute(content) === hash;
  }
}

// ============================================================================
// SnapshotComparator
// ============================================================================

export class SnapshotComparator {
  compare(snap1: Snapshot, snap2: Snapshot, options: SnapshotMatchOptions = {}): SnapshotComparison {
    const opts = { ignoreWhitespace: false, ignoreCase: false, threshold: 100, ...options };

    let content1 = snap1.content;
    let content2 = snap2.content;

    if (opts.ignoreWhitespace) {
      content1 = content1.replace(/\s+/g, ' ').trim();
      content2 = content2.replace(/\s+/g, ' ').trim();
    }

    if (opts.ignoreCase) {
      content1 = content1.toLowerCase();
      content2 = content2.toLowerCase();
    }

    // Handle JSON field ignoring
    if (snap1.format === 'json' && snap2.format === 'json' && opts.ignoreFields?.length) {
      content1 = this.omitJsonFields(content1, opts.ignoreFields);
      content2 = this.omitJsonFields(content2, opts.ignoreFields);
    }

    if (content1 === content2) {
      return {
        identical: true,
        additions: 0,
        deletions: 0,
        modifications: 0,
        diff: '',
        similarity: 100,
      };
    }

    const diff = this.generateDiff(content1, content2);
    const { additions, deletions, modifications } = this.countChanges(diff);
    const similarity = this.calculateSimilarity(content1, content2);

    return {
      identical: similarity >= opts.threshold!,
      additions,
      deletions,
      modifications,
      diff,
      similarity,
    };
  }

  private omitJsonFields(jsonStr: string, fields: string[]): string {
    try {
      const obj = JSON.parse(jsonStr);
      const omit = (o: unknown): unknown => {
        if (Array.isArray(o)) {
          return o.map(omit);
        }
        if (o && typeof o === 'object') {
          const result: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(o)) {
            if (!fields.includes(key)) {
              result[key] = omit(value);
            }
          }
          return result;
        }
        return o;
      };
      return JSON.stringify(omit(obj), null, 2);
    } catch {
      return jsonStr;
    }
  }

  private generateDiff(oldContent: string, newContent: string): string {
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');
    const diff: string[] = [];

    let i = 0, j = 0;
    while (i < oldLines.length || j < newLines.length) {
      if (i >= oldLines.length) {
        diff.push(`+ ${newLines[j]}`);
        j++;
      } else if (j >= newLines.length) {
        diff.push(`- ${oldLines[i]}`);
        i++;
      } else if (oldLines[i] === newLines[j]) {
        diff.push(`  ${oldLines[i]}`);
        i++;
        j++;
      } else {
        diff.push(`- ${oldLines[i]}`);
        diff.push(`+ ${newLines[j]}`);
        i++;
        j++;
      }
    }

    return diff.join('\n');
  }

  private countChanges(diff: string): { additions: number; deletions: number; modifications: number } {
    const lines = diff.split('\n');
    let additions = 0;
    let deletions = 0;

    for (const line of lines) {
      if (line.startsWith('+ ')) additions++;
      if (line.startsWith('- ')) deletions++;
    }

    // Rough estimate: modifications are min of additions and deletions
    const modifications = Math.min(additions, deletions);

    return { additions, deletions, modifications };
  }

  private calculateSimilarity(str1: string, str2: string): number {
    const maxLen = Math.max(str1.length, str2.length);
    if (maxLen === 0) return 100;

    const distance = this.levenshteinDistance(str1, str2);
    return Math.round(((maxLen - distance) / maxLen) * 100);
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }
}

// ============================================================================
// FileSystemSnapshotStore
// ============================================================================

export class FileSystemSnapshotStore implements SnapshotStore {
  private baseDir: string;

  constructor(baseDir: string) {
    this.baseDir = baseDir;
  }

  async save(snapshot: Snapshot): Promise<void> {
    const filepath = this.getFilepath(snapshot.id);
    await fs.mkdir(dirname(filepath), { recursive: true });
    await fs.writeFile(filepath, JSON.stringify(snapshot, null, 2), 'utf-8');
  }

  async load(id: string): Promise<Snapshot | null> {
    try {
      const filepath = this.getFilepath(id);
      const content = await fs.readFile(filepath, 'utf-8');
      const parsed = JSON.parse(content);
      const result = SnapshotSchema.safeParse(parsed);
      return result.success ? result.data : null;
    } catch {
      return null;
    }
  }

  async loadByName(name: string): Promise<Snapshot | null> {
    const snapshots = await this.list();
    return snapshots.find(s => s.name === name) || null;
  }

  async list(): Promise<Snapshot[]> {
    try {
      const files = await fs.readdir(this.baseDir);
      const snapshots: Snapshot[] = [];

      for (const file of files) {
        if (file.endsWith('.snap')) {
          const id = file.replace('.snap', '');
          const snapshot = await this.load(id);
          if (snapshot) snapshots.push(snapshot);
        }
      }

      return snapshots;
    } catch {
      return [];
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const filepath = this.getFilepath(id);
      await fs.unlink(filepath);
      return true;
    } catch {
      return false;
    }
  }

  async clear(): Promise<void> {
    try {
      const files = await fs.readdir(this.baseDir);
      for (const file of files) {
        if (file.endsWith('.snap')) {
          await fs.unlink(join(this.baseDir, file));
        }
      }
    } catch {
      // Directory might not exist
    }
  }

  private getFilepath(id: string): string {
    // Sanitize ID for filesystem
    const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '_');
    return join(this.baseDir, `${safeId}.snap`);
  }
}

// ============================================================================
// SnapshotManager
// ============================================================================

export class SnapshotManager {
  private store: SnapshotStore;
  private comparator: SnapshotComparator;

  constructor(store: SnapshotStore) {
    this.store = store;
    this.comparator = new SnapshotComparator();
  }

  async capture(name: string, content: string, format: SnapshotFormat = 'text', metadata?: Record<string, unknown>): Promise<Snapshot> {
    const snapshot: Snapshot = {
      id: crypto.randomUUID(),
      name,
      content,
      format,
      hash: SnapshotHasher.compute(content),
      createdAt: new Date().toISOString(),
      metadata,
    };

    await this.store.save(snapshot);
    return snapshot;
  }

  async captureJson(name: string, data: unknown, metadata?: Record<string, unknown>): Promise<Snapshot> {
    return this.capture(name, JSON.stringify(data, null, 2), 'json', metadata);
  }

  async match(name: string, actual: string, options?: SnapshotMatchOptions): Promise<{ pass: boolean; comparison?: SnapshotComparison }> {
    const expected = await this.store.loadByName(name);

    if (!expected) {
      return { pass: false };
    }

    const actualSnapshot: Snapshot = {
      id: 'temp',
      name: 'actual',
      content: actual,
      format: expected.format,
      hash: SnapshotHasher.compute(actual),
      createdAt: new Date().toISOString(),
    };

    const comparison = this.comparator.compare(expected, actualSnapshot, options);
    return { pass: comparison.identical, comparison };
  }

  async matchOrCapture(name: string, actual: string, format: SnapshotFormat = 'text', options?: SnapshotMatchOptions): Promise<{
    pass: boolean;
    isNew: boolean;
    comparison?: SnapshotComparison;
  }> {
    const { pass, comparison } = await this.match(name, actual, options);

    if (!comparison) {
      // No existing snapshot, capture new
      await this.capture(name, actual, format);
      return { pass: true, isNew: true };
    }

    return { pass, isNew: false, comparison };
  }

  async update(name: string, content: string): Promise<Snapshot | null> {
    const existing = await this.store.loadByName(name);
    if (!existing) return null;

    const updated: Snapshot = {
      ...existing,
      content,
      hash: SnapshotHasher.compute(content),
      createdAt: new Date().toISOString(),
    };

    await this.store.save(updated);
    return updated;
  }

  async compareSnapshots(id1: string, id2: string, options?: SnapshotMatchOptions): Promise<SnapshotComparison | null> {
    const snap1 = await this.store.load(id1);
    const snap2 = await this.store.load(id2);

    if (!snap1 || !snap2) return null;

    return this.comparator.compare(snap1, snap2, options);
  }

  async listSnapshots(): Promise<Snapshot[]> {
    return this.store.list();
  }

  async deleteSnapshot(id: string): Promise<boolean> {
    return this.store.delete(id);
  }

  async clearAll(): Promise<void> {
    await this.store.clear();
  }

  getComparator(): SnapshotComparator {
    return this.comparator;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

export function createSnapshotManager(baseDir: string): SnapshotManager {
  const store = new FileSystemSnapshotStore(baseDir);
  return new SnapshotManager(store);
}
