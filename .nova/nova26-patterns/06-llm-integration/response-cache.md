# Response Cache

## Source
Extracted from Nova26 `src/llm/response-cache.ts`

---

## Pattern: SQLite-Backed LLM Response Cache

The response cache uses a local SQLite database to store LLM responses keyed by a SHA-256 hash of the prompt, model, and temperature. Identical requests return cached results instantly, saving tokens and API costs. The cache supports TTL-based expiry, hit count tracking, cost estimation, per-model queries, and a `getOrCompute()` wrapper that transparently caches any LLM call.

---

## Implementation

### Code Example

```typescript
import Database from 'better-sqlite3';
import { createHash } from 'crypto';
import { join } from 'path';
import { mkdirSync } from 'fs';

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

// Initialize schema with indexes for fast lookup
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
 * Cache key = SHA-256(prompt | model | temperature).
 * Deterministic: same inputs always produce the same hash.
 */
function generateCacheKey(prompt: string, model: string, temperature: number): string {
  return createHash('sha256')
    .update(`${prompt}|${model}|${temperature}`)
    .digest('hex');
}

/**
 * Retrieve a cached response if it exists and hasn't expired.
 * Increments hit_count on access for analytics.
 */
export function getCachedResponse(
  prompt: string,
  model: string,
  temperature: number,
  maxAgeHours: number = 24
): CachedResponse | null {
  const promptHash = generateCacheKey(prompt, model, temperature);

  const row = db.prepare(`
    SELECT * FROM responses
    WHERE prompt_hash = ?
    AND datetime(created_at) > datetime('now', '-${maxAgeHours} hours')
  `).get(promptHash) as any;

  if (!row) return null;

  db.prepare(`
    UPDATE responses SET hit_count = hit_count + 1,
    last_accessed = datetime('now') WHERE id = ?
  `).run(row.id);

  return { ...row, hitCount: row.hit_count + 1 };
}

/**
 * Transparent cache wrapper — checks cache first, computes on miss,
 * stores the result for future hits.
 */
export async function getOrCompute(
  prompt: string,
  model: string,
  temperature: number,
  compute: () => Promise<{ response: string; tokensUsed: number }>,
  maxAgeHours?: number
): Promise<{ response: string; fromCache: boolean; tokensUsed: number }> {
  const cached = getCachedResponse(prompt, model, temperature, maxAgeHours);
  if (cached) {
    console.log(`Cache hit! Saved ${cached.tokensUsed} tokens`);
    return { response: cached.response, fromCache: true, tokensUsed: 0 };
  }

  const result = await compute();
  cacheResponse(prompt, model, temperature, result.response, result.tokensUsed);
  return { response: result.response, fromCache: false, tokensUsed: result.tokensUsed };
}

/**
 * Cache statistics — total entries, hit rate, tokens saved, estimated cost saved.
 */
export function getCacheStats(): CacheStats {
  const total = db.prepare('SELECT COUNT(*) as count FROM responses').get() as { count: number };
  const hits = db.prepare('SELECT SUM(hit_count) as total FROM responses').get() as { total: number };
  const tokens = db.prepare('SELECT SUM(tokens_used * hit_count) as saved FROM responses')
    .get() as { saved: number };

  const avgCostPer1K = 0.002;
  const tokensSaved = tokens.saved || 0;

  return {
    totalEntries: total.count,
    totalHits: hits.total || 0,
    totalTokensSaved: tokensSaved,
    estimatedCostSaved: (tokensSaved / 1000) * avgCostPer1K,
    hitRate: total.count > 0 ? ((hits.total || 0) / total.count) * 100 : 0,
  };
}

/**
 * Clear expired entries beyond the TTL threshold.
 */
export function clearExpired(maxAgeHours: number = 24): number {
  const result = db.prepare(`
    DELETE FROM responses
    WHERE datetime(created_at) < datetime('now', '-${maxAgeHours} hours')
  `).run();
  return result.changes;
}

/**
 * Find similar prompts using word overlap for analysis.
 */
export function findSimilarPrompts(
  prompt: string,
  limit: number = 5
): Array<{ prompt: string; similarity: number }> {
  const rows = db.prepare('SELECT prompt FROM responses LIMIT 100')
    .all() as Array<{ prompt: string }>;
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
```

### Key Concepts

- **Deterministic cache key**: SHA-256 hash of `prompt|model|temperature` ensures identical requests always hit the same cache entry
- **TTL-based expiry**: `maxAgeHours` parameter prevents serving stale responses (default 24 hours)
- **Hit count tracking**: Every cache hit increments a counter, enabling cache effectiveness analysis
- **getOrCompute pattern**: Wraps any async LLM call with transparent caching — callers don't need to manage cache logic
- **Cost estimation**: Multiplies saved tokens by average cost-per-1K to show dollar savings
- **Fuzzy similarity search**: `findSimilarPrompts()` uses word overlap to find near-duplicate prompts for analysis
- **Maintenance utilities**: `clearExpired()` and `clearAllCache()` manage disk usage over time

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// No TTL — stale responses served indefinitely
const cached = db.prepare('SELECT * FROM responses WHERE prompt_hash = ?').get(hash);
return cached; // Could be weeks old, model behavior may have changed

// Caching non-deterministic prompts — cache key changes every call
const prompt = `Generate output for ${Date.now()}`; // Timestamp in prompt = never hits cache
const cached = getCachedResponse(prompt, model, temp); // Always null

// No hit tracking — impossible to measure if cache is worth the disk space
db.prepare('INSERT INTO responses ...').run(data);
// No hit_count column, no way to know which entries are actually reused
```

### ✅ Do This Instead

```typescript
// TTL-based expiry — only serve fresh responses
const cached = getCachedResponse(prompt, model, temperature, 24); // 24-hour max age

// Deterministic prompts — strip timestamps and random values before caching
const normalizedPrompt = prompt.replace(/\d{13}/g, ''); // Remove epoch timestamps
const cached = getCachedResponse(normalizedPrompt, model, temperature);

// Track hits and report savings
const stats = getCacheStats();
console.log(`Hit rate: ${stats.hitRate}%, Tokens saved: ${stats.totalTokensSaved}`);
```

---

## When to Use This Pattern

✅ **Use for:**
- Iterative development workflows where the same prompts are sent repeatedly (e.g., re-running a build)
- Cost-sensitive environments where paid API token usage needs to be minimized
- Multi-agent pipelines where agents may produce identical sub-prompts across different tasks

❌ **Don't use for:**
- Prompts that must always produce fresh output (e.g., real-time data queries, creative generation with high temperature)

---

## Benefits

1. **Token savings** — identical prompts return cached results with zero token consumption
2. **Cost reduction** — tracks estimated dollar savings from avoided API calls
3. **Transparent integration** — `getOrCompute()` wraps any LLM call without changing the caller's interface
4. **Analytics** — hit count, hit rate, and per-model breakdowns enable data-driven cache tuning
5. **TTL control** — configurable expiry prevents serving outdated responses while maximizing cache hits

---

## Related Patterns

- See `../06-llm-integration/model-router.md` for the model routing layer that sits above the cache
- See `../06-llm-integration/ollama-client.md` for the local LLM client whose responses are cached
- See `../10-cost-management/cost-tracker.md` for broader token cost monitoring beyond cache savings
- See `../01-orchestration/ralph-loop-execution.md` for the orchestration loop that benefits from cached agent responses

---

*Extracted: 2025-07-15*