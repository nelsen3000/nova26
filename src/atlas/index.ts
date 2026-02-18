// KronosAtlas - Dual-write ATLAS layer (file-based + Kronos)

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { KronosClient } from './kronos-client.js';
import type { KronosEntry, KronosSearchResult } from './types.js';
import type { BuildLog } from '../types/index.js';

// Re-export retrospective module for Phase 3 ATLAS agent usage
export { KronosRetrospective } from './retrospective.js';

const ATLAS_DIR = join(process.cwd(), '.nova', 'atlas');
const BUILDS_FILE = join(ATLAS_DIR, 'builds.json');

export class KronosAtlas {
  private kronos: KronosClient;

  constructor(kronosBaseUrl?: string) {
    this.kronos = new KronosClient(kronosBaseUrl);
  }

  /**
   * Dual-write: logs to file-based builds.json AND ingests into Kronos.
   * File-based write always happens. Kronos ingest is best-effort.
   */
  async logBuild(log: BuildLog, project: string, phase: number = 0): Promise<void> {
    // 1. Always write to file-based builds.json
    this.appendToBuildLog(log);

    // 2. Best-effort Kronos ingest
    try {
      const isHealthy = await this.kronos.healthCheck();
      if (!isHealthy) {
        console.warn('[KronosAtlas] Kronos unavailable — skipping memory ingest');
        return;
      }

      const entry: KronosEntry = {
        project,
        taskId: log.taskId,
        agent: log.agent,
        phase,
        content: log.response,
        tags: [log.agent, `phase-${phase}`, log.gatesPassed ? 'gates-passed' : 'gates-failed'],
      };

      await this.kronos.ingest(entry);
      const tokenEstimate = Math.ceil(log.response.length / 4);
      console.log(`[KronosAtlas] Logged build ${log.taskId} (~${tokenEstimate} tokens)`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[KronosAtlas] Kronos ingest failed: ${message}`);
    }
  }

  /** Search Kronos for relevant patterns. Returns empty result if unavailable. */
  async searchPatterns(query: string, project?: string): Promise<KronosSearchResult> {
    return this.kronos.search(query, project);
  }

  /** Check if Kronos is available. */
  async isKronosAvailable(): Promise<boolean> {
    return this.kronos.healthCheck();
  }

  private appendToBuildLog(log: BuildLog): void {
    if (!existsSync(ATLAS_DIR)) {
      mkdirSync(ATLAS_DIR, { recursive: true });
    }

    let builds: BuildLog[] = [];
    if (existsSync(BUILDS_FILE)) {
      try {
        const raw = readFileSync(BUILDS_FILE, 'utf-8');
        builds = JSON.parse(raw) as BuildLog[];
      } catch {
        builds = [];
      }
    }

    builds.push(log);
    writeFileSync(BUILDS_FILE, JSON.stringify(builds, null, 2));
  }
}
