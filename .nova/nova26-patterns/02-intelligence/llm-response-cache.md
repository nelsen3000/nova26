# LLM Response Cache

**Category:** 02-intelligence
**Type:** Pattern
**Tags:** cache, sqlite, llm, cost-saving, tokens, nova26

---

## Overview

SQLite-backed cache for LLM responses. Identical prompts (same content + model + temperature) return cached results instantly, saving tokens and API costs. Tracks hit counts and supports TTL-based expiry.

---

## Source

`src/llm/response-cache.ts`

---

## Pattern
function generateCacheKey(prompt: string, model: string, temperature: number): string {
  return createHash('sha256')
    .update(`${prompt}|${model}|${temperature}`)
    .digest('hex');
}

// Get cached response (with TTL check)
export function getCachedResponse(
  prompt: string, model: string, temperature: number, maxAgeHours = 24
): CachedResponse | null {
  const promptHash = generateCacheKey(prompt, model, temperature);

  const row = db.prepare(`
    SELECT * FROM responses
    WHERE prompt_hash = ?
    AND datetime(created_at) > datetime('now', '-${maxAgeHours} hours')
  `).get(promptHash);

  if (!row) return null;

  // Increment hit count
  db.prepare('UPDATE responses SET hit_count = hit_count + 1, last_accessed = datetime("now") WHERE id = ?')
    .run(row.id);

  return row;
}

// Get or compute with automatic caching
export async function getOrCompute<T>(
  prompt: string, model: string, temperature: number,
  compute: () => Promise<{ response: string; tokensUsed: number }>,
  maxAgeHours?: number
): Promise<{ response: string; fromCache: boolean; tokensUsed: number }> {
  const cached = getCachedResponse(prompt, model, temperature, maxAgeHours);
  if (cached) {
    console.log(`💰 Cache hit! Saved ${cached.tokensUsed} tokens`);
    return { response: cached.response, fromCache: true, tokensUsed: 0 };
  }

  const result = await compute();
  cacheResponse(prompt, model, temperature, result.response, result.tokensUsed);
  return { response: result.response, fromCache: false, tokensUsed: result.tokensUsed };
}
```

```sql
-- SQLite schema
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
```

---

## Usage

```typescript
// Wrap any LLM call with caching
const { response, fromCache, tokensUsed } = await getOrCompute(
  prompt, 'gpt-4o', 0.7,
  () => callOpenAI(prompt, 'gpt-4o', {}),
  24 // 24-hour TTL
);

// View cache stats
const stats = getCacheStats();
console.log(formatCacheStats(stats));
// 📊 LLM Cache Statistics
// Total Entries: 142
// Hit Rate: 34.5%
// Tokens Saved: 45,230
// Est. Cost Saved: $0.0905

// Clear expired entries
clearExpired(24); // Remove entries older than 24 hours
```

---

## Anti-Patterns

```typescript
// ❌ No TTL — stale responses served indefinitely
getCachedResponse(prompt, model, temperature); // No maxAgeHours — never expires

// ✅ Good: Always specify a TTL
getCachedResponse(prompt, model, temperature, 24); // 24-hour expiry

// ❌ Caching non-deterministic prompts
// Don't cache prompts that include timestamps or random seeds
const prompt = `Generate a unique ID for ${Date.now()}`; // Different every call

// ✅ Good: Cache only deterministic prompts
const prompt = `Explain the observer pattern`; // Same input → same output

// ❌ No hit tracking — can't measure cache effectiveness
// Always track hit_count to know if cache is worth maintaining

// ✅ Good: Track hits and review stats periodically
const stats = getCacheStats(); // Monitor hit rate and tokens saved
```

---

## When to Use

- Repeated LLM calls with identical prompts (e.g., re-running failed builds)
- Development and testing where the same prompts are sent frequently
- Cost-sensitive deployments where token savings matter

---

## Benefits

- Instant responses for cached prompts — no API latency or token cost
- SHA-256 keying ensures deterministic cache hits
- TTL-based expiry prevents stale responses
- Hit count tracking enables cache effectiveness monitoring

---

## Related Patterns

- `model-router-fallback-chains.md` — Model routing (cache sits on top)
- `checkpoint-system.md` — Build state persistence
- `../10-cost-management/cost-tracker.md` — Token cost monitoring
