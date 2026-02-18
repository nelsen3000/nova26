// Kronos HTTP Client - Wraps the Kronos REST API (port 8765)
// All methods gracefully degrade: if Kronos is unreachable, log a warning and continue.

import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { KronosEntry, KronosPointer, KronosSearchResult } from './types.js';

const KRONOS_BASE_URL = 'http://localhost:8765';
const FETCH_TIMEOUT_MS = 5000;

interface KronosHealthResponse {
  status: string;
  health_score: number;
}

interface KronosQueryResponse {
  status: string;
  pointers: KronosQueryPointer[];
  chunks: KronosQueryChunk[];
}

interface KronosQueryPointer {
  file: string;
  start_line: number;
  end_line: number;
  summary: string;
  score: number;
  token_estimate: number;
}

interface KronosQueryChunk {
  content: string;
  file: string;
  score: number;
}

interface KronosFetchResponse {
  content: string;
  file: string;
  status: string;
}

interface KronosIngestResponse {
  status: string;
  path: string;
  new_chunks_indexed: number;
  total_chunks: number;
}

export class KronosClient {
  private baseUrl: string;

  constructor(baseUrl: string = KRONOS_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * POST task output to Kronos after a successful gate pass.
   * Writes content to .nova/kronos/{taskId}.md then calls Kronos /ingest
   * with the directory path (Kronos ingests from the filesystem).
   */
  async ingest(entry: KronosEntry): Promise<void> {
    try {
      // Kronos /ingest expects a filesystem path, not raw content.
      // Write the task output to a staging directory for Kronos to index.
      const kronosDir = join(process.cwd(), '.nova', 'kronos', entry.project);
      if (!existsSync(kronosDir)) {
        mkdirSync(kronosDir, { recursive: true });
      }

      const filePath = join(kronosDir, `${entry.taskId}.md`);
      const fileContent = [
        `# ${entry.taskId}`,
        `agent: ${entry.agent}`,
        `phase: ${entry.phase}`,
        `tags: ${entry.tags.join(', ')}`,
        '',
        '---',
        '',
        entry.content,
      ].join('\n');
      writeFileSync(filePath, fileContent);

      const response = await this.fetchWithTimeout(`${this.baseUrl}/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: kronosDir,
          recursive: false,
        }),
      });

      if (!response.ok) {
        console.warn(`[Kronos] Ingest returned ${response.status} for task ${entry.taskId}`);
        return;
      }

      const data = (await response.json()) as KronosIngestResponse;
      const tokenEstimate = Math.ceil(entry.content.length / 4);
      console.log(
        `[Kronos] Ingested task ${entry.taskId} (agent: ${entry.agent}, ` +
        `phase: ${entry.phase}, ~${tokenEstimate} tokens, ` +
        `${data.new_chunks_indexed} new chunks)`
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[Kronos] Ingest failed for task ${entry.taskId}: ${message}`);
    }
  }

  /** Search Kronos knowledge graph by semantic query. */
  async search(query: string, project?: string): Promise<KronosSearchResult> {
    const emptyResult: KronosSearchResult = { pointers: [], totalTokensSaved: 0 };

    try {
      const body: Record<string, unknown> = {
        text: query,
        limit: 5,
        mode: 'budget',
        budget_tokens: 4000,
      };
      if (project) {
        body['current_file_path'] = project;
      }

      const response = await this.fetchWithTimeout(`${this.baseUrl}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        console.warn(`[Kronos] Search returned ${response.status}`);
        return emptyResult;
      }

      const data = (await response.json()) as KronosQueryResponse;
      const pointers = (data.pointers || []).map((p, i) => this.mapPointer(p, i));
      const fullTokens = (data.chunks || []).reduce(
        (sum, c) => sum + Math.ceil(c.content.length / 4),
        0
      );
      const pointerTokens = pointers.reduce((sum, p) => sum + p.tokenCount, 0);

      return {
        pointers,
        totalTokensSaved: Math.max(0, fullTokens - pointerTokens),
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[Kronos] Search failed: ${message}`);
      return emptyResult;
    }
  }

  /** Fetch full content for a specific pointer (file_path:start_line-end_line). */
  async fetch(pointerId: string): Promise<string> {
    try {
      const { filePath, startLine, endLine } = this.parsePointerId(pointerId);

      const response = await this.fetchWithTimeout(`${this.baseUrl}/fetch_exact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_path: filePath,
          start_line: startLine,
          end_line: endLine,
        }),
      });

      if (!response.ok) {
        console.warn(`[Kronos] Fetch returned ${response.status} for pointer ${pointerId}`);
        return '';
      }

      const data = (await response.json()) as KronosFetchResponse;
      return data.content || '';
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[Kronos] Fetch failed for pointer ${pointerId}: ${message}`);
      return '';
    }
  }

  /** Returns true if Kronos server is reachable, false otherwise. */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.fetchWithTimeout(`${this.baseUrl}/health`, {
        method: 'GET',
      });

      if (!response.ok) {
        return false;
      }

      const data = (await response.json()) as KronosHealthResponse;
      return data.status === 'healthy';
    } catch {
      return false;
    }
  }

  private mapPointer(raw: KronosQueryPointer, index: number): KronosPointer {
    return {
      id: `${raw.file}:${raw.start_line}-${raw.end_line}`,
      taskId: `pointer-${index}`,
      summary: raw.summary || `${raw.file}:${raw.start_line}-${raw.end_line}`,
      relevanceScore: raw.score ?? 0,
      tokenCount: raw.token_estimate ?? 0,
    };
  }

  private parsePointerId(pointerId: string): {
    filePath: string;
    startLine: number;
    endLine: number;
  } {
    // Format: "file/path:startLine-endLine"
    const colonIdx = pointerId.lastIndexOf(':');
    if (colonIdx === -1) {
      return { filePath: pointerId, startLine: 1, endLine: 50 };
    }

    const filePath = pointerId.substring(0, colonIdx);
    const range = pointerId.substring(colonIdx + 1);
    const dashIdx = range.indexOf('-');

    if (dashIdx === -1) {
      const line = parseInt(range, 10) || 1;
      return { filePath, startLine: line, endLine: line + 20 };
    }

    const startLine = parseInt(range.substring(0, dashIdx), 10) || 1;
    const endLine = parseInt(range.substring(dashIdx + 1), 10) || startLine + 20;
    return { filePath, startLine, endLine };
  }

  private async fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
