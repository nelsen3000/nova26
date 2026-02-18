// Convex Cloud Client - Triple-write redundancy layer
// Gracefully degrades if CONVEX_URL is not set or Convex is unreachable.
// Uses ConvexHttpClient for simple mutation/query calls from Node.js.

import type { BuildLog } from '../types/index.js';

const CONVEX_URL = process.env['CONVEX_URL'] || '';

interface ConvexLogResult {
  buildId: string;
  taskId: string;
}

export class ConvexAtlasClient {
  private url: string;
  private enabled: boolean;

  constructor(convexUrl?: string) {
    this.url = convexUrl || CONVEX_URL;
    this.enabled = this.url.length > 0;

    if (!this.enabled) {
      console.log('[Convex] CONVEX_URL not set — cloud sync disabled');
    }
  }

  /** Check if Convex cloud sync is configured and reachable. */
  async isAvailable(): Promise<boolean> {
    if (!this.enabled) return false;

    try {
      // Convex HTTP API health check — a simple query to verify connectivity
      const response = await this.callFunction('query', 'atlas:getBuildStatus', {
        prdId: '__health_check__',
      });
      // Even if the query returns null, the fact that it responded means Convex is up
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Log a build execution to Convex cloud.
   * Handles the full builds → tasks → executions chain in one mutation.
   */
  async logExecution(
    log: BuildLog,
    prdId: string,
    prdName: string,
    taskTitle: string,
    phase: number
  ): Promise<ConvexLogResult | null> {
    if (!this.enabled) return null;

    try {
      const response = await this.callFunction('mutation', 'atlas:logExecution', {
        prdId,
        prdName,
        taskId: log.taskId,
        taskTitle,
        agent: log.agent,
        model: log.model,
        phase,
        prompt: log.prompt,
        response: log.response,
        gatesPassed: log.gatesPassed,
        duration: log.duration,
        timestamp: log.timestamp,
        error: log.error,
      });

      if (!response.ok) {
        console.warn(`[Convex] logExecution returned ${response.status}`);
        return null;
      }

      const result = (await response.json()) as { value: ConvexLogResult };
      console.log(`[Convex] Synced execution ${log.taskId} to cloud`);
      return result.value;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[Convex] Cloud sync failed for ${log.taskId}: ${message}`);
      return null;
    }
  }

  /** Mark a build as completed or failed in Convex. */
  async completeBuild(
    prdId: string,
    status: 'completed' | 'failed',
    error?: string
  ): Promise<void> {
    if (!this.enabled) return;

    try {
      await this.callFunction('mutation', 'atlas:completeBuild', {
        prdId,
        status,
        error,
      });
      console.log(`[Convex] Build ${prdId} marked as ${status}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[Convex] completeBuild failed: ${message}`);
    }
  }

  /** Log a learning/pattern to Convex. */
  async logLearning(
    prdId: string,
    taskId: string,
    pattern: string,
    insight: string,
    code?: string
  ): Promise<void> {
    if (!this.enabled) return;

    try {
      await this.callFunction('mutation', 'atlas:logLearning', {
        prdId,
        taskId,
        pattern,
        insight,
        code,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[Convex] logLearning failed: ${message}`);
    }
  }

  /**
   * Call a Convex function via the HTTP API.
   * Uses the public Convex HTTP endpoint format:
   * POST {CONVEX_URL}/api/{type}/{functionPath}
   */
  private async callFunction(
    type: 'mutation' | 'query',
    functionPath: string,
    args: Record<string, unknown>
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      return await fetch(`${this.url}/api/${type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: functionPath,
          args,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
