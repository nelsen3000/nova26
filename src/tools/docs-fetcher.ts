// Context7 Documentation Tool — Fetches live, up-to-date documentation for libraries
// KIMI-INTEGRATE-01: Grok R11 Context7 integration spec

import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { z } from 'zod';
import * as https from 'https';

// ============================================================================
// Zod Schemas
// ============================================================================

const DocsCacheEntrySchema = z.object({
  library: z.string(),
  topic: z.string().optional(),
  content: z.string(),
  fetchedAt: z.string(),
  expiresAt: z.string(),
  tokenCount: z.number().nonnegative(),
});

const Context7ApiResponseSchema = z.object({
  content: z.string(),
  library: z.string().optional(),
  topic: z.string().optional(),
  version: z.string().optional(),
});

// ============================================================================
// Types
// ============================================================================

export interface DocsFetchResult {
  library: string;
  topic?: string;
  content: string;
  source: 'cache' | 'network';
  fetchedAt: string;
  cacheHit: boolean;
  truncated: boolean;
}

export type DocsCacheEntry = z.infer<typeof DocsCacheEntrySchema>;

interface DocsFetcherOptions {
  cacheDir?: string;
  cacheTTLMs?: number;
  maxTokens?: number;
  baseUrl?: string;
}

// ============================================================================
// DocsFetcher Class
// ============================================================================

class DocsFetcher {
  private cacheDir: string;
  private cacheTTLMs: number;
  private maxTokens: number;
  private baseUrl: string;

  constructor(options: DocsFetcherOptions = {}) {
    this.cacheDir = options.cacheDir ?? join(process.cwd(), '.nova', 'docs-cache');
    this.cacheTTLMs = options.cacheTTLMs ?? 604_800_000; // 7 days
    this.maxTokens = options.maxTokens ?? 2000;
    this.baseUrl = options.baseUrl ?? 'https://context7.com/api/docs';
  }

  async fetchDocs(library: string, topic?: string): Promise<DocsFetchResult> {
    // Sanitize inputs
    const sanitizedLibrary = library.toLowerCase().trim();
    if (!sanitizedLibrary) {
      throw new Error('Library name cannot be empty');
    }
    const sanitizedTopic = topic?.trim();

    // Check cache first
    const cached = this.getCacheEntry(sanitizedLibrary, sanitizedTopic);
    if (cached) {
      const { text, truncated } = this.truncateToTokenBudget(cached.content, this.maxTokens);
      return {
        library: sanitizedLibrary,
        topic: sanitizedTopic,
        content: text,
        source: 'cache',
        fetchedAt: cached.fetchedAt,
        cacheHit: true,
        truncated,
      };
    }

    // Fetch from network
    try {
      const content = await this.fetchFromNetwork(sanitizedLibrary, sanitizedTopic);
      const { text, truncated } = this.truncateToTokenBudget(content, this.maxTokens);
      const now = new Date().toISOString();
      const expiresAt = new Date(Date.now() + this.cacheTTLMs).toISOString();

      // Write to cache
      const cacheEntry: DocsCacheEntry = {
        library: sanitizedLibrary,
        topic: sanitizedTopic,
        content: text,
        fetchedAt: now,
        expiresAt,
        tokenCount: Math.ceil(text.length / 4),
      };
      this.writeCacheEntry(cacheEntry);

      return {
        library: sanitizedLibrary,
        topic: sanitizedTopic,
        content: text,
        source: 'network',
        fetchedAt: now,
        cacheHit: false,
        truncated,
      };
    } catch (error) {
      console.warn(`DocsFetcher: failed to fetch docs for ${sanitizedLibrary}:`, error);
      return this.buildFallbackResult(sanitizedLibrary, sanitizedTopic);
    }
  }

  private fetchFromNetwork(library: string, topic?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const url = new URL(this.baseUrl);
      url.searchParams.set('library', library);
      if (topic) {
        url.searchParams.set('topic', topic);
      }

      const req = https.get(
        url.toString(),
        {
          headers: { Accept: 'application/json' },
          timeout: 10000,
        },
        (res) => {
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode}`));
            return;
          }

          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            try {
              const parsed = JSON.parse(data);
              const validated = Context7ApiResponseSchema.safeParse(parsed);
              if (!validated.success) {
                reject(new Error('Invalid response format'));
                return;
              }
              resolve(validated.data.content);
            } catch {
              reject(new Error('Failed to parse response'));
            }
          });
        }
      );

      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.on('error', (error) => {
        reject(error);
      });
    });
  }

  private getCacheEntry(library: string, topic?: string): DocsCacheEntry | null {
    const safeTopic = topic?.replace(/[^a-z0-9-]/g, '-') ?? '_default';
    const cachePath = join(this.cacheDir, library, `${safeTopic}.json`);

    if (!existsSync(cachePath)) {
      return null;
    }

    try {
      const content = readFileSync(cachePath, 'utf-8');
      const parsed = JSON.parse(content);
      const validated = DocsCacheEntrySchema.safeParse(parsed);

      if (!validated.success) {
        return null;
      }

      // Check expiry
      if (validated.data.expiresAt < new Date().toISOString()) {
        return null;
      }

      return validated.data;
    } catch {
      return null;
    }
  }

  private writeCacheEntry(entry: DocsCacheEntry): void {
    const safeTopic = entry.topic?.replace(/[^a-z0-9-]/g, '-') ?? '_default';
    const cachePath = join(this.cacheDir, entry.library, `${safeTopic}.json`);

    try {
      mkdirSync(dirname(cachePath), { recursive: true });
      writeFileSync(cachePath, JSON.stringify(entry, null, 2));
    } catch {
      // Silently ignore cache write failures
    }
  }

  private truncateToTokenBudget(content: string, maxTokens: number): { text: string; truncated: boolean } {
    const maxChars = maxTokens * 4;
    if (content.length <= maxChars) {
      return { text: content, truncated: false };
    }
    return {
      text: content.slice(0, maxChars) + '\n...[truncated]',
      truncated: true,
    };
  }

  private buildFallbackResult(library: string, topic?: string): DocsFetchResult {
    return {
      library,
      topic,
      content: `Documentation unavailable for ${library}${topic ? ` (${topic})` : ''}. Please consult the official docs.`,
      source: 'network',
      fetchedAt: new Date().toISOString(),
      cacheHit: false,
      truncated: false,
    };
  }

  clearCache(library?: string): void {
    try {
      if (library) {
        const libPath = join(this.cacheDir, library);
        if (existsSync(libPath)) {
          rmSync(libPath, { recursive: true });
        }
      } else {
        if (existsSync(this.cacheDir)) {
          rmSync(this.cacheDir, { recursive: true });
        }
      }
    } catch {
      // Silently ignore errors
    }
  }

  getCacheStats(): { entries: number; oldestEntry?: string; newestEntry?: string } {
    let entries = 0;
    let oldestEntry: string | undefined;
    let newestEntry: string | undefined;

    try {
      if (!existsSync(this.cacheDir)) {
        return { entries: 0 };
      }

      const scanDir = (dir: string): void => {
        const items = readdirSync(dir, { withFileTypes: true });
        for (const item of items) {
          const itemPath = join(dir, item.name);
          if (item.isDirectory()) {
            scanDir(itemPath);
          } else if (item.isFile() && item.name.endsWith('.json')) {
            entries++;
            try {
              const content = readFileSync(itemPath, 'utf-8');
              const parsed = JSON.parse(content);
              const fetchedAt = parsed.fetchedAt as string;
              if (fetchedAt) {
                if (!oldestEntry || fetchedAt < oldestEntry) {
                  oldestEntry = fetchedAt;
                }
                if (!newestEntry || fetchedAt > newestEntry) {
                  newestEntry = fetchedAt;
                }
              }
            } catch {
              // Skip invalid files
            }
          }
        }
      };

      scanDir(this.cacheDir);
    } catch {
      // Return empty stats on error
    }

    return { entries, oldestEntry, newestEntry };
  }
}

// ============================================================================
// Singleton Factory
// ============================================================================

let instance: DocsFetcher | null = null;

export function getDocsFetcher(options?: DocsFetcherOptions): DocsFetcher {
  if (!instance) {
    instance = new DocsFetcher(options);
  }
  return instance;
}

export function resetDocsFetcher(): void {
  instance = null;
}

export { DocsFetcher, DocsCacheEntrySchema, Context7ApiResponseSchema };
