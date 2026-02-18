// LLM Response Cache
// Saves tokens and money by caching identical prompts

// @ts-ignore - better-sqlite3 types installed at runtime
import Database from 'better-sqlite3';
import { join } from 'path';
import { mkdirSync } from 'fs';
import { createHash } from 'crypto';

interface CachedResponse {
  id: string;
  promptHash: string;
  prompt: string;
  model: string;
  temperature: number;
  response: string;
  tokensUsed: number;
  createdAt: string;
  hitCount: number;
  lastAccessed: string;
}

interface CacheStats {
  totalEntries: number;
  totalHits: number;
  totalTokensSaved: number;
  estimatedCostSaved: number;
  hitRate: number;
}

const CACHE_DIR = join(process.cwd(), '.nova', 'cache');
mkdirSync(CACHE_DIR, { recursive: true });

const db = new Database(join(CACHE_DIR, 'llm-cache.db'));

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS responses (
    id TEXT PRIMARY KEY,
    prompt_hash TEXT NOT NULL UNIQUE,
    prompt TEXT NOT NULL,
    model TEXT NOT NULL,
    temperature REAL NOT NULL,
    response TEXT NOT NULL,
    tokens_used INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    hit_count INTEGER DEFAULT 0,
    last_accessed TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_prompt_hash ON responses(prompt_hash);
  CREATE INDEX IF NOT EXISTS idx_model ON responses(model);
  CREATE INDEX IF NOT EXISTS idx_created ON responses(created_at);
`);



/**
 * Generate hash for prompt + model + temperature
 */
function generateCacheKey(prompt: string, model: string, temperature: number): string {
  return createHash('sha256')
    .update(`${prompt}|${model}|${temperature}`)
    .digest('hex');
}

/**
 * Get cached response if exists and not expired
 */
export function getCachedResponse(
  prompt: string,
  model: string,
  temperature: number,
  maxAgeHours: number = 24
): CachedResponse | null {
  const promptHash = generateCacheKey(prompt, model, temperature);
  
  const stmt = db.prepare(`
    SELECT * FROM responses 
    WHERE prompt_hash = ? 
    AND datetime(created_at) > datetime('now', '-${maxAgeHours} hours')
  `);
  
  const row = stmt.get(promptHash) as any;
  if (!row) return null;
  
  // Update hit count and last accessed
  db.prepare(`
    UPDATE responses 
    SET hit_count = hit_count + 1, last_accessed = datetime('now')
    WHERE id = ?
  `).run(row.id);
  
  return {
    id: row.id,
    promptHash: row.prompt_hash,
    prompt: row.prompt,
    model: row.model,
    temperature: row.temperature,
    response: row.response,
    tokensUsed: row.tokens_used,
    createdAt: row.created_at,
    hitCount: row.hit_count + 1,
    lastAccessed: new Date().toISOString(),
  };
}

/**
 * Cache a new response
 */
export function cacheResponse(
  prompt: string,
  model: string,
  temperature: number,
  response: string,
  tokensUsed: number
): CachedResponse {
  const promptHash = generateCacheKey(prompt, model, temperature);
  const id = createHash('sha256').update(promptHash + Date.now()).digest('hex').slice(0, 16);
  
  const now = new Date().toISOString();
  
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO responses 
    (id, prompt_hash, prompt, model, temperature, response, tokens_used, created_at, hit_count, last_accessed)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
  `);
  
  stmt.run(
    id,
    promptHash,
    prompt,
    model,
    temperature,
    response,
    tokensUsed,
    now,
    now
  );
  
  return {
    id,
    promptHash,
    prompt,
    model,
    temperature,
    response,
    tokensUsed,
    createdAt: now,
    hitCount: 0,
    lastAccessed: now,
  };
}

/**
 * Get or compute with cache
 */
export async function getOrCompute<_T>(
  prompt: string,
  model: string,
  temperature: number,
  compute: () => Promise<{ response: string; tokensUsed: number }>,
  maxAgeHours?: number
): Promise<{ response: string; fromCache: boolean; tokensUsed: number }> {
  // Check cache
  const cached = getCachedResponse(prompt, model, temperature, maxAgeHours);
  if (cached) {
    console.log(`💰 Cache hit! Saved ${cached.tokensUsed} tokens`);
    return {
      response: cached.response,
      fromCache: true,
      tokensUsed: 0, // No tokens used for cached response
    };
  }
  
  // Compute and cache
  const result = await compute();
  cacheResponse(prompt, model, temperature, result.response, result.tokensUsed);
  
  return {
    response: result.response,
    fromCache: false,
    tokensUsed: result.tokensUsed,
  };
}

/**
 * Get cache statistics
 */
export function getCacheStats(): CacheStats {
  const totalStmt = db.prepare('SELECT COUNT(*) as count FROM responses');
  const hitsStmt = db.prepare('SELECT SUM(hit_count) as total FROM responses');
  const tokensStmt = db.prepare('SELECT SUM(tokens_used * hit_count) as saved FROM responses');
  const requestsStmt = db.prepare('SELECT COUNT(*) as count FROM responses WHERE hit_count > 0');
  
  const total = totalStmt.get() as { count: number };
  const hits = hitsStmt.get() as { total: number };
  const tokens = tokensStmt.get() as { saved: number };
  const requests = requestsStmt.get() as { count: number };
  
  const totalHits = hits.total || 0;
  const totalRequests = total.count || 0;
  const hitRate = totalRequests > 0 ? (requests.count / totalRequests) * 100 : 0;
  
  // Rough cost estimate (assume average paid model cost)
  const avgCostPer1K = 0.002; // $0.002 per 1K tokens
  const tokensSaved = tokens.saved || 0;
  const costSaved = (tokensSaved / 1000) * avgCostPer1K;
  
  return {
    totalEntries: total.count,
    totalHits,
    totalTokensSaved: tokensSaved,
    estimatedCostSaved: costSaved,
    hitRate,
  };
}

/**
 * Clear expired entries
 */
export function clearExpired(maxAgeHours: number = 24): number {
  const stmt = db.prepare(`
    DELETE FROM responses 
    WHERE datetime(created_at) < datetime('now', '-${maxAgeHours} hours')
  `);
  
  const result = stmt.run();
  console.log(`🧹 Cleared ${result.changes} expired cache entries`);
  return result.changes;
}

/**
 * Clear all cache
 */
export function clearAllCache(): void {
  db.prepare('DELETE FROM responses').run();
  console.log('🗑️  Cache cleared');
}

/**
 * Format stats for display
 */
export function formatCacheStats(stats: CacheStats): string {
  return `
📊 LLM Cache Statistics
═══════════════════════════════════════
Total Entries:     ${stats.totalEntries.toLocaleString()}
Total Hits:        ${stats.totalHits.toLocaleString()}
Hit Rate:          ${stats.hitRate.toFixed(1)}%
Tokens Saved:      ${stats.totalTokensSaved.toLocaleString()}
Est. Cost Saved:   $${stats.estimatedCostSaved.toFixed(4)}
═══════════════════════════════════════
`;
}

/**
 * Get cache entries for a model
 */
export function getEntriesByModel(model: string): CachedResponse[] {
  const stmt = db.prepare(`
    SELECT * FROM responses 
    WHERE model = ? 
    ORDER BY hit_count DESC
  `);
  
  const rows = stmt.all(model) as any[];
  return rows.map(row => ({
    id: row.id,
    promptHash: row.prompt_hash,
    prompt: row.prompt,
    model: row.model,
    temperature: row.temperature,
    response: row.response,
    tokensUsed: row.tokens_used,
    createdAt: row.created_at,
    hitCount: row.hit_count,
    lastAccessed: row.last_accessed,
  }));
}

/**
 * Find similar prompts (fuzzy matching for analysis)
 */
export function findSimilarPrompts(prompt: string, limit: number = 5): Array<{ prompt: string; similarity: number }> {
  // Simple substring matching - could be enhanced with embeddings
  const stmt = db.prepare('SELECT prompt FROM responses LIMIT 100');
  const rows = stmt.all() as Array<{ prompt: string }>;
  
  const promptWords = new Set(prompt.toLowerCase().split(/\s+/));
  
  return rows
    .map(row => {
      const cachedWords = new Set(row.prompt.toLowerCase().split(/\s+/));
      const intersection = new Set([...promptWords].filter(w => cachedWords.has(w)));
      const similarity = intersection.size / Math.max(promptWords.size, cachedWords.size);
      return { prompt: row.prompt, similarity };
    })
    .filter(r => r.similarity > 0.5)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}
