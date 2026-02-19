# KIMI TASK FILE — Production Infrastructure Sprint

> Owner: Kimi
> Priority: Infrastructure (production-readiness, premium-worthiness)
> Prerequisite: KIMI-AGENT-01-06, KIMI-VAULT-01-06, KIMI-ACE-01-06 complete and merged to main
> Spec sources: Grok R8-01 (Semantic Similarity), R8-02 (Convex Real-Time), R8-04 (Security/Privacy), R8-05 (Model Strategy)
> Test baseline: 1116 tests passing, 0 TypeScript errors, 36 test files

---

## Context

Nova26 is a 21-agent AI-powered IDE built with TypeScript, Ollama, and Convex. You have
completed three major sprint cycles:

- **KIMI-AGENT-01-06** — inner loop (ReAct, agent-loop, tool registry, orchestrator)
- **KIMI-VAULT-01-06** — Living Taste Vault (`src/taste-vault/`) and Global Wisdom Pipeline
- **KIMI-ACE-01-06** — ACE Playbook System, Rehearsal Stage, Self-Improvement Protocol

The core agent architecture is solid. 1116 tests are passing, 0 TS errors. The product
is now targeting premium pricing at ~$299/month with a local-first (Ollama) value prop
and an opt-in Global Wisdom network.

**This sprint adds the infrastructure that makes Nova26 production-ready and
premium-worthy:**

1. **Semantic deduplication** — embedding-based dedup for the Global Wisdom pipeline
   replaces the current Jaccard-only approach, which is too coarse for code patterns.
2. **Convex real-time** — proper schema tables, indexed queries, and real-time subscriptions
   for multi-user features (wisdom feed, agent activity) that justify the premium price.
3. **Security and privacy layer** — encryption, PII stripping, GDPR delete, audit log.
   Required before any cross-user data sharing ships.
4. **Model routing optimization** — complexity-aware routing using Qwen3/DeepSeek models,
   cost tracking per build, model availability detection.
5. **Build intelligence** — ROI calculation, build time prediction, agent heatmap. The
   analytics premium users actually care about.

**Key existing files you will touch or integrate with:**

- `src/taste-vault/global-wisdom.ts` — `GlobalWisdomPipeline`, `promote()`, `stripSensitiveData()`
- `src/llm/model-router.ts` — `callLLM()`, `AVAILABLE_MODELS`, `selectModelForTask()`
- `src/analytics/agent-analytics.ts` — `recordTaskResult()`, `getAgentStats()`, `getBuildStats()`
- `convex/schema.ts` — current tables: builds, patterns, agents, tasks, executions, learnings, companies, chipAccounts, divisions, companyAgents

**New directories you will create:**

- `src/similarity/` — Semantic Similarity Engine
- `src/security/` — Vault Security layer
- `src/analytics/` (new file in existing dir) — Build Intelligence

---

## Global Rules (apply to every task)

- **TypeScript strict mode** — no `any`, no implicit `any`, no `@ts-ignore`
- **ESM imports** — always use `.js` extensions on relative imports (e.g., `import { Foo } from './foo.js'`)
- **Zod for all external/runtime data validation** — validate at system boundaries,
  especially when reading persisted JSON or receiving Ollama API responses
- **Tests with vitest** — all new tests use `import { describe, it, expect, vi } from 'vitest'`
- **Do not break existing tests** — `npx vitest run` must show 1116+ passing after each task
- **Zero TypeScript errors** — `npx tsc --noEmit` must report 0 errors after every task
- **Commit to main when done** — one commit per KIMI-INFRA task, commit message format:
  `feat(infra): KIMI-INFRA-XX <short description>`
- **Reference existing patterns** — follow singleton factory pattern from `src/tools/tool-registry.ts`
  (class + `get*()` factory + `reset*()` for tests). Match error handling conventions from
  `src/taste-vault/global-wisdom.ts` (catch, log, never throw from context-building paths).
- **File header comments** — every new file starts with a 2-line comment:
  `// <Short description>\n// <Which spec this implements>`
- **No new npm dependencies** without a compelling reason — `node-fetch`, `zod`, `vitest`,
  and `better-sqlite3` are already available. Do not add embedding libraries; call Ollama
  directly via `fetch`.

---

## KIMI-INFRA-01: Semantic Similarity Engine

**File:** `src/similarity/semantic-dedup.ts`
**Target size:** ~200 lines
**Spec:** Grok R8-01

### What to build

The `SemanticDedup` class calls Ollama's `/api/embeddings` endpoint to generate vector
embeddings for pattern content, then computes cosine similarity to detect semantic
duplicates before a node is promoted to the Global Wisdom pool.

This replaces the existing `isSimilar()` Jaccard method in `GlobalWisdomPipeline` as
the primary deduplication gate. The Jaccard fallback remains available when Ollama
embeddings are unavailable.

### Core interfaces

```typescript
export interface DedupResult {
  isDuplicate: boolean;
  canonicalNodeId?: string;  // ID of the existing node this is a duplicate of
  similarity: number;        // 0–1, actual computed similarity
}

export interface EmbeddingCacheEntry {
  nodeId: string;
  embedding: number[];
  computedAt: string;  // ISO timestamp
  model: string;       // which embedding model produced this vector
}
```

### SemanticDedup class

```typescript
class SemanticDedup {
  constructor(options?: {
    model?: string;          // default: 'nomic-embed-text'
    threshold?: number;      // default: 0.92 cosine similarity
    ollamaBaseUrl?: string;  // default: 'http://localhost:11434'
  })

  // Core embedding
  async getEmbedding(text: string): Promise<number[]>
  // POST to {ollamaBaseUrl}/api/embeddings with { model, prompt: text }
  // Returns the embedding array from the response.
  // Checks in-memory cache first (keyed by SHA-256 of text + model name).
  // On HTTP error or network failure: throw Error with the response status/message.
  // Zod-validate the Ollama response shape before returning.

  // Similarity math
  cosineSimilarity(a: number[], b: number[]): number
  // Standard dot product / (||a|| * ||b||).
  // Returns 0 if either vector is zero-length or vectors have different dimensions.
  // Clamp result to [0, 1].

  // High-level dedup check
  async isDuplicate(
    newNode: { id: string; content: string },
    existingNodes: Array<{ id: string; content: string }>,
    threshold?: number  // override instance threshold for this call
  ): Promise<DedupResult>
  // 1. Get embedding for newNode.content (cache hit or Ollama call).
  // 2. For each existingNode, get its embedding (cache or Ollama).
  // 3. Compute cosineSimilarity(newEmbedding, existingEmbedding).
  // 4. If any similarity >= threshold: return { isDuplicate: true, canonicalNodeId: existingNode.id, similarity }
  //    (use the HIGHEST similarity match as canonical).
  // 5. If no match: return { isDuplicate: false, similarity: highest_seen }.
  // If Ollama is unavailable (getEmbedding throws): fall back to Jaccard similarity.
  //   jaccardFallback(a, b): tokenize on whitespace, compute intersection / union.
  //   Use threshold of 0.7 for Jaccard fallback (coarser than cosine).
  //   Log a warning: 'SemanticDedup: Ollama unavailable, using Jaccard fallback'

  // Batch indexing for initial setup
  async bulkIndex(nodes: Array<{ id: string; content: string }>): Promise<void>
  // Calls getEmbedding() for each node and stores in both in-memory cache and
  // the persistence file (.nova/similarity/embeddings.json).
  // Uses sequential (not parallel) calls to avoid overwhelming local Ollama.
  // Logs progress: 'SemanticDedup: indexed N/total'

  // Cache management
  persistCache(): Promise<void>
  // Write in-memory embedding cache to .nova/similarity/embeddings.json.
  // Create parent directory if it does not exist.

  loadCache(): Promise<void>
  // Read from .nova/similarity/embeddings.json and populate in-memory cache.
  // Validate with Zod. If file missing or invalid: silently start with empty cache.

  clearCache(): void
  // Clear in-memory cache only (for tests). Does not delete the JSON file.
}
```

### Zod schema for Ollama embedding response

```typescript
const OllamaEmbeddingResponseSchema = z.object({
  embedding: z.array(z.number()),
});
```

### Zod schema for the persistence file

```typescript
const EmbeddingCacheFileSchema = z.object({
  version: z.string(),
  entries: z.array(z.object({
    nodeId: z.string(),
    embedding: z.array(z.number()),
    computedAt: z.string(),
    model: z.string(),
  })),
});
```

### Singleton factory

```typescript
export function getSemanticDedup(): SemanticDedup
export function resetSemanticDedup(): void  // for tests — clears singleton + in-memory cache
```

### Integration point

After `bulkIndex` is wired, modify `GlobalWisdomPipeline.promote()` in
`src/taste-vault/global-wisdom.ts` to call `getSemanticDedup().isDuplicate()` before
the existing Jaccard `findDuplicates()` check. Place the semantic check first. If
`isDuplicate.isDuplicate === true`, return `null` early (same as the existing dedup
path). The existing Jaccard check remains as a secondary gate.

```typescript
// In GlobalWisdomPipeline.promote(), BEFORE the existing findDuplicates() call:
const semanticDedup = getSemanticDedup();
const existingAsNodes = patterns.map(p => ({ id: p.id, content: p.canonicalContent }));
const dedupResult = await semanticDedup.isDuplicate(strippedNode, existingAsNodes);
if (dedupResult.isDuplicate) {
  return null;
}
```

This integration must not break existing `global-wisdom.test.ts` tests. Wrap the
`getSemanticDedup()` call in try/catch so that if the similarity engine is unavailable
the existing Jaccard path still runs.

### Embedding model configuration

Support two models via the constructor `model` option:
- `'nomic-embed-text'` — default, ~274M params, fast
- `'mxbai-embed-large'` — alternative, higher quality, ~335M params

The model is fixed at construction time. The cache key includes the model name so
switching models does not produce stale cache hits.

---

## KIMI-INFRA-02: Convex Schema and Real-Time Functions

**Files:** `convex/schema.ts` (modify), `convex/wisdom.ts` (new), `convex/activity.ts` (new)
**Target size:** ~250 lines total across Convex files
**Spec:** Grok R8-02

### What to build

Add the Convex tables and functions needed for real-time multi-user features: the
Global Wisdom subscription feed, per-user activity streams, and user profile storage.
Convex queries auto-update in real-time — callers that subscribe to a query will
receive updates whenever underlying data changes. This is the foundation for the
premium "live wisdom feed" and "agent activity" dashboard panels.

### Schema additions to convex/schema.ts

Add four new tables to the existing schema. Do not modify or remove any existing table.
Append these after the `companyAgents` table:

```typescript
// Global Wisdom patterns with optional embedding vector
globalPatterns: defineTable({
  canonicalContent: v.string(),
  originalNodeIds: v.array(v.string()),
  successScore: v.number(),
  userDiversity: v.number(),
  lastPromotedAt: v.string(),
  language: v.optional(v.string()),
  tags: v.array(v.string()),
  promotionCount: v.number(),
  harmReports: v.number(),
  isActive: v.boolean(),
  // Embedding vector stored as flat array of floats (nomic-embed-text = 768 dims)
  // Optional because not all patterns will have embeddings on day one.
  embeddingVector: v.optional(v.array(v.number())),
}).index('by_active', ['isActive'])
  .index('by_success_score', ['successScore'])
  .index('by_promoted_at', ['lastPromotedAt']),

// User profiles for Nova26 premium users
userProfiles: defineTable({
  userId: v.string(),            // External auth ID (e.g. Clerk userId)
  email: v.optional(v.string()),
  tier: v.union(v.literal('free'), v.literal('premium')),
  globalWisdomOptIn: v.boolean(),
  createdAt: v.string(),
  lastActiveAt: v.string(),
}).index('by_user_id', ['userId'])
  .index('by_tier', ['tier']),

// Wisdom updates feed for real-time subscriptions
wisdomUpdates: defineTable({
  patternId: v.string(),          // ID of the promoted GlobalPattern
  promotedByUserId: v.string(),
  content: v.string(),            // Anonymized canonical content snippet (first 200 chars)
  tags: v.array(v.string()),
  successScore: v.number(),
  timestamp: v.string(),
}).index('by_timestamp', ['timestamp'])
  .index('by_pattern', ['patternId']),

// Agent activity feed per user
agentActivityFeed: defineTable({
  userId: v.string(),
  agentName: v.string(),
  eventType: v.union(
    v.literal('task_started'),
    v.literal('task_completed'),
    v.literal('task_failed'),
    v.literal('playbook_updated'),
    v.literal('wisdom_promoted'),
    v.literal('rehearsal_ran')
  ),
  taskId: v.optional(v.string()),
  details: v.string(),            // JSON-serialized event details
  timestamp: v.string(),
}).index('by_user_and_time', ['userId', 'timestamp'])
  .index('by_user_and_agent', ['userId', 'agentName']),
```

### convex/wisdom.ts — Wisdom queries, mutations, and action

Create this file from scratch. Use the Convex API patterns already established in
`convex/atlas.ts` (which you can read for reference).

**Queries (real-time, auto-updating):**

```typescript
// Get the latest N global wisdom patterns (active only), sorted by successScore desc
export const getLatestGlobalWisdom = query({
  args: { userId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { userId, limit = 12 }) => {
    // 1. Check that the user exists and has tier 'premium' OR that globalWisdomOptIn is true.
    //    If user not found, return [].
    // 2. Fetch from globalPatterns where isActive === true, ordered by successScore desc.
    //    Convex does not support ORDER BY directly in queries without an index — use
    //    .withIndex('by_success_score') and collect, then sort in-memory if needed,
    //    or use .order('desc') on the index.
    // 3. Return up to `limit` patterns.
    // Note: This is a real-time query — Convex will push updates to subscribers
    // whenever the globalPatterns table changes.
  }
});

// Get the wisdom update feed (reverse-chronological), for a live feed UI
export const getWisdomFeed = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit = 20 }) => {
    // Fetch from wisdomUpdates, ordered by timestamp desc, up to limit.
    // Use .withIndex('by_timestamp').order('desc').take(limit)
  }
});
```

**Mutations:**

```typescript
// Promote a pattern into Convex (called from GlobalWisdomPipeline after local dedup passes)
export const promotePattern = mutation({
  args: {
    canonicalContent: v.string(),
    originalNodeIds: v.array(v.string()),
    successScore: v.number(),
    userDiversity: v.number(),
    tags: v.array(v.string()),
    language: v.optional(v.string()),
    promotedByUserId: v.string(),
    embeddingVector: v.optional(v.array(v.number())),
  },
  handler: async (ctx, args) => {
    // 1. Insert into globalPatterns.
    // 2. Insert a wisdomUpdates entry (content = first 200 chars of canonicalContent).
    // 3. Return the new pattern's _id.
  }
});

// Sync a user's vault node into Convex for cross-device access
export const syncVaultNode = mutation({
  args: {
    userId: v.string(),
    nodeId: v.string(),
    content: v.string(),
    tags: v.array(v.string()),
    helpfulCount: v.number(),
    timestamp: v.string(),
  },
  handler: async (ctx, args) => {
    // Upsert: check if a learnings entry with taskId === nodeId exists for any build
    // owned by this user. If yes, update. If no, insert into learnings table.
    // Return the document _id.
    // Note: This is a lightweight sync — not a full vault sync. It persists the
    // most important vault nodes to Convex for cross-device read access.
  }
});

// Upsert user profile
export const upsertUserProfile = mutation({
  args: {
    userId: v.string(),
    email: v.optional(v.string()),
    tier: v.union(v.literal('free'), v.literal('premium')),
    globalWisdomOptIn: v.boolean(),
  },
  handler: async (ctx, args) => {
    // Check if userProfiles row exists for userId (query .withIndex('by_user_id')).
    // If yes: patch lastActiveAt and any changed fields.
    // If no: insert new row with createdAt = now.
  }
});
```

**Action (server-side, can call external services):**

```typescript
// Nightly aggregation — triggers GlobalWisdomPipeline server-side
// This is a Convex action (not a mutation) because it may call external APIs.
export const runNightlyAggregation = action({
  args: { triggeredBy: v.optional(v.string()) },
  handler: async (ctx, { triggeredBy }) => {
    // In a full implementation this would call the GlobalWisdomPipeline
    // to aggregate local vault data into Convex. For now:
    // 1. Log the trigger event to agentActivityFeed via ctx.runMutation.
    // 2. Fetch all active globalPatterns and return a summary.
    // Return: { patternsAggregated: number, timestamp: string }
    // This action is designed to be called from a Convex scheduled job (future work).
  }
});
```

### convex/activity.ts — Agent activity feed functions

```typescript
// Record an agent activity event (called from ralph-loop.ts after each task)
export const recordAgentActivity = mutation({
  args: {
    userId: v.string(),
    agentName: v.string(),
    eventType: v.union(
      v.literal('task_started'),
      v.literal('task_completed'),
      v.literal('task_failed'),
      v.literal('playbook_updated'),
      v.literal('wisdom_promoted'),
      v.literal('rehearsal_ran')
    ),
    taskId: v.optional(v.string()),
    details: v.string(),
  },
  handler: async (ctx, args) => {
    // Insert into agentActivityFeed with timestamp = now ISO string.
    // Return _id.
  }
});

// Real-time query: get agent activity for a user, most recent first
export const getAgentActivity = query({
  args: { userId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { userId, limit = 50 }) => {
    // Use .withIndex('by_user_and_time', q => q.eq('userId', userId))
    // .order('desc').take(limit)
    // Returns agentActivityFeed rows.
  }
});

// Get activity filtered by agent name
export const getAgentActivityByAgent = query({
  args: { userId: v.string(), agentName: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { userId, agentName, limit = 20 }) => {
    // Use .withIndex('by_user_and_agent', q => q.eq('userId', userId).eq('agentName', agentName))
    // .order('desc').take(limit)
  }
});
```

---

## KIMI-INFRA-03: Security and Privacy Layer

**File:** `src/security/vault-security.ts`
**Target size:** ~250 lines
**Spec:** Grok R8-04

### What to build

The `VaultSecurity` class is the security layer that sits between the local Taste Vault
and the Global Wisdom Pipeline. It handles: node encryption for local storage, PII/secret
stripping before any cross-user promotion, GDPR-compliant bulk delete, and an append-only
audit trail.

Note: `GlobalWisdomPipeline.stripSensitiveData()` in `src/taste-vault/global-wisdom.ts`
already does basic regex stripping. `VaultSecurity.stripSensitiveData()` is a superset —
more aggressive, and the result of this method is what should be used before Convex
promotion. The existing method in `GlobalWisdomPipeline` is left in place (it is used
in tests); `VaultSecurity.stripSensitiveData()` is the enhanced version called in new
integration paths.

### Core interfaces

```typescript
export type AuditAction =
  | 'promote_global'
  | 'demote_global'
  | 'delete_data'
  | 'flag_harmful'
  | 'export_vault'
  | 'encrypt_node'
  | 'decrypt_node';

export interface AuditLogEntry {
  id: string;              // crypto.randomUUID()
  userId: string;
  action: AuditAction;
  nodeId?: string;         // which vault node this concerns, if applicable
  details: string;         // human-readable description
  timestamp: string;       // ISO timestamp
  success: boolean;
}

export interface EncryptedNode {
  id: string;
  encryptedContent: string;  // Base64-encoded AES-GCM ciphertext
  iv: string;                // Base64-encoded 12-byte IV
  authTag: string;           // Base64-encoded 16-byte GCM auth tag
  algorithm: 'aes-256-gcm';
  keyId: string;             // Identifies which key was used (first 8 chars of SHA-256 of key)
  encryptedAt: string;
}
```

### VaultSecurity class

```typescript
class VaultSecurity {
  // Node encryption (symmetric, AES-256-GCM via Node.js crypto module)
  encryptNode(
    node: { id: string; content: string },
    key: string   // Raw key string — will be SHA-256 hashed to 32 bytes
  ): EncryptedNode
  // 1. Derive 32-byte key from `key` string using crypto.createHash('sha256').
  // 2. Generate random 12-byte IV using crypto.randomBytes(12).
  // 3. Create cipher: crypto.createCipheriv('aes-256-gcm', derivedKey, iv).
  // 4. Encrypt node.content (utf-8 → Buffer).
  // 5. Get authTag after finalize.
  // 6. Return EncryptedNode with all fields Base64-encoded.

  decryptNode(
    encrypted: EncryptedNode,
    key: string
  ): { id: string; content: string }
  // 1. Derive same 32-byte key.
  // 2. Decode Base64 fields back to Buffers.
  // 3. Create decipher: crypto.createDecipheriv('aes-256-gcm', derivedKey, iv).
  // 4. Set authTag.
  // 5. Decrypt and return { id: encrypted.id, content }.
  // On any failure (bad key, corrupted data): throw Error('VaultSecurity: decryption failed')

  // Privacy filter for global promotion
  stripSensitiveData(node: { id: string; content: string }): { id: string; content: string }
  // Enhanced version of GlobalWisdomPipeline.stripSensitiveData().
  // Apply all of the existing regexes PLUS:
  //   - IP addresses: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g → '[IP_REDACTED]'
  //   - Email addresses: /\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b/g → '[EMAIL_REDACTED]'
  //   - JWT tokens: /eyJ[a-zA-Z0-9\-_]+\.[a-zA-Z0-9\-_]+\.[a-zA-Z0-9\-_]+/g → '[JWT_REDACTED]'
  //   - Hex strings 32+ chars (potential hashes/secrets): /\b[0-9a-fA-F]{32,}\b/g → '[HASH_REDACTED]'
  //   - Private key markers: /-----BEGIN [A-Z ]+-----[\s\S]+-----END [A-Z ]+-----/g → '[KEY_REDACTED]'
  // Returns new node object. Never mutates the input.

  // Ownership enforcement
  ensureOwnership(userId: string, nodeOwnerId: string): void
  // If userId !== nodeOwnerId: throw Error(`VaultSecurity: user ${userId} does not own this node`)
  // Used as a guard before any mutation on a vault node.

  // GDPR: delete all data for a user
  async deleteAllUserData(userId: string): Promise<{
    nodesDeleted: number;
    auditEntriesDeleted: number;
  }>
  // 1. Read the user's vault file from .nova/taste-vault/{userId}.json if it exists.
  //    Count nodes. Delete the file.
  // 2. Read the ACE playbook files from .nova/ace/playbooks/*.json.
  //    If any playbook's agentName appears to belong to this user... actually: playbooks
  //    are per-agent not per-user. So instead: read .nova/ace/profiles/{userId}.json
  //    (self-improvement profile) and delete it if it exists.
  // 3. Read .nova/similarity/embeddings.json. Remove all EmbeddingCacheEntry rows where
  //    nodeId starts with userId or where we can infer user ownership. Persist updated file.
  //    (A best-effort scrub — not a hard guarantee for embeddings since nodeIds may not
  //    encode userId. Log a note: 'GDPR: embedding scrub is best-effort.')
  // 4. Append audit log entry with action 'delete_data', details = summary.
  // 5. Return { nodesDeleted, auditEntriesDeleted }.

  // Audit log
  logAction(
    userId: string,
    action: AuditAction,
    details: string,
    nodeId?: string,
    success?: boolean
  ): void
  // Append an AuditLogEntry to .nova/security/audit.jsonl (newline-delimited JSON).
  // Create parent directory if needed.
  // Each line is one JSON-stringified AuditLogEntry.
  // This is append-only — never rewrite the whole file. Use fs.appendFileSync.

  // Read audit log
  readAuditLog(
    userId?: string,
    limit?: number
  ): AuditLogEntry[]
  // Read .nova/security/audit.jsonl line by line.
  // Parse each line as JSON. Validate with Zod (skip malformed lines silently).
  // If userId is provided: filter to entries for that userId.
  // Sort by timestamp desc. Return up to `limit` entries (default 100).
}
```

### Zod schema for audit log entries

```typescript
const AuditLogEntrySchema = z.object({
  id: z.string(),
  userId: z.string(),
  action: z.enum([
    'promote_global', 'demote_global', 'delete_data',
    'flag_harmful', 'export_vault', 'encrypt_node', 'decrypt_node',
  ]),
  nodeId: z.string().optional(),
  details: z.string(),
  timestamp: z.string(),
  success: z.boolean(),
});
```

### Singleton factory

```typescript
export function getVaultSecurity(): VaultSecurity
export function resetVaultSecurity(): void  // for tests
```

### Notes

- Use Node.js built-in `crypto` module only. No external crypto libraries.
- The `deleteAllUserData` method is intentionally conservative: it only deletes files
  that are clearly per-user. It does NOT attempt to scrub the global wisdom patterns
  (those are anonymized). Log a note about what was and was not scrubbed.
- The audit log is local-only in this sprint. A future sprint will sync it to Convex.

---

## KIMI-INFRA-04: Model Router Optimization

**File:** `src/llm/model-router.ts` (modify existing)
**Target size:** ~150 lines of new/modified code added to the existing ~549-line file
**Spec:** Grok R8-05

### What to build

Update `model-router.ts` to implement Grok's R8-05 model strategy: complexity-based
routing to the right Qwen3/DeepSeek tier, model availability detection via the Ollama
API, and per-build cost tracking. Read the full existing file before touching it.

### New models to add to AVAILABLE_MODELS

Append these entries to the `AVAILABLE_MODELS` array (do not remove any existing entries):

```typescript
{
  name: 'qwen3:7b',
  provider: 'ollama',
  tier: 'free',
  contextWindow: 32768,
  costPer1KTokens: 0,
  speed: 'fast',
  quality: 'good',
  bestFor: ['thinking turns', 'ReAct reasoning', 'quick iterations'],
  description: 'Qwen3 7B — preferred for thinking/ReAct turns (R8-05)',
},
{
  name: 'qwen3-coder:32b',
  provider: 'ollama',
  tier: 'free',
  contextWindow: 131072,
  costPer1KTokens: 0,
  speed: 'slow',
  quality: 'excellent',
  bestFor: ['final code generation', 'complex architecture', 'production code'],
  description: 'Qwen3-Coder 32B — preferred for final code generation (R8-05)',
},
{
  name: 'deepseek-v3',
  provider: 'ollama',
  tier: 'free',
  contextWindow: 131072,
  costPer1KTokens: 0,
  speed: 'slow',
  quality: 'excellent',
  bestFor: ['final code generation', 'deep reasoning', 'complex refactors'],
  description: 'DeepSeek V3 — alternative for final code generation (R8-05)',
},
{
  name: 'nomic-embed-text',
  provider: 'ollama',
  tier: 'free',
  contextWindow: 8192,
  costPer1KTokens: 0,
  speed: 'fast',
  quality: 'good',
  bestFor: ['embeddings', 'semantic similarity', 'deduplication'],
  description: 'Nomic Embed Text — for SemanticDedup (R8-01)',
},
{
  name: 'mxbai-embed-large',
  provider: 'ollama',
  tier: 'free',
  contextWindow: 512,
  costPer1KTokens: 0,
  speed: 'medium',
  quality: 'excellent',
  bestFor: ['embeddings', 'high-quality semantic similarity'],
  description: 'MXBai Embed Large — alternative embedding model (R8-01)',
},
```

### New export: selectModelForPhase

Add this function alongside the existing `selectModelForTask`:

```typescript
export type BuildPhase = 'thinking' | 'tool_use' | 'code_gen' | 'embedding' | 'reflection';

export function selectModelForPhase(phase: BuildPhase): ModelConfig
// Phase → preferred model mapping (R8-05 strategy):
//   'thinking'   → 'qwen3:7b' if available, else 'qwen2.5:7b'
//   'tool_use'   → 'qwen3:7b' if available, else 'qwen2.5:7b'
//   'code_gen'   → 'qwen3-coder:32b' if available, else 'deepseek-v3' if available, else 'qwen2.5:14b'
//   'embedding'  → 'nomic-embed-text' if available, else 'mxbai-embed-large'
//   'reflection' → 'qwen3:7b' if available, else 'qwen2.5:7b'
// "if available" = model is in AVAILABLE_MODELS AND not circuit-broken
// Fall back to currentModel if no phase-appropriate model is available.
```

### New export: detectAvailableModels

```typescript
export async function detectAvailableModels(
  ollamaBaseUrl?: string  // default: 'http://localhost:11434'
): Promise<string[]>
// GET {ollamaBaseUrl}/api/tags
// Parse response: { models: Array<{ name: string }> }
// Validate with Zod.
// Return array of model names that are installed.
// On any HTTP or network error: return [] and log a warning.
// This is used to warm up the availability cache at startup so that
// selectModelForPhase() knows what is actually installed.
```

Store the result in a module-level `installedModels: Set<string>` variable. Update
`selectModelForPhase` to check `installedModels` when the set is non-empty (i.e., after
`detectAvailableModels()` has been called). If `installedModels` is empty, assume all
configured models might be available (current behavior, no regression).

### CostTracker class

Add this class at the bottom of `model-router.ts`:

```typescript
export interface UsageRecord {
  buildId: string;
  model: string;
  estimatedTokens: number;
  durationMs: number;
  phase: BuildPhase;
  timestamp: string;
}

export interface BuildCostSummary {
  buildId: string;
  totalEstimatedTokens: number;
  modelBreakdown: Record<string, { tokens: number; calls: number }>;
  estimatedCostUsd: number;  // 0 for free/Ollama models
  durationMs: number;
}

export interface MonthlySummary {
  month: string;  // 'YYYY-MM'
  totalBuilds: number;
  totalEstimatedTokens: number;
  estimatedCostUsd: number;
  topModels: Array<{ model: string; tokens: number; calls: number }>;
}

class CostTracker {
  recordUsage(
    buildId: string,
    model: string,
    estimatedTokens: number,
    durationMs: number,
    phase: BuildPhase
  ): void
  // Append a UsageRecord to in-memory records.
  // Also persist to .nova/analytics/cost-tracker.jsonl (append-only, one JSON line per record).
  // Estimate tokens as Math.ceil(promptChars / 4) if not provided externally.
  // Create parent directory if needed.

  getBuildCost(buildId: string): BuildCostSummary
  // Read all UsageRecords from in-memory (or reload from file if cache is empty).
  // Filter to buildId.
  // Compute modelBreakdown and estimatedCostUsd using costPer1KTokens from AVAILABLE_MODELS.
  // estimatedCostUsd is always 0 for provider === 'ollama' models.

  getMonthlyUsage(month?: string): MonthlySummary
  // month format: 'YYYY-MM'. Defaults to current month.
  // Aggregate all records from that month.
  // Return top 5 models by token usage.

  reset(): void
  // Clear in-memory records only (for tests). Does not delete the file.
}

export function getCostTracker(): CostTracker
export function resetCostTracker(): void
```

### Wire CostTracker into callLLM

In the existing `callLLM` function, after a successful model call, add:

```typescript
// Cost tracking
try {
  const phase: BuildPhase = options.phase ?? 'code_gen';
  const estimatedTokens = Math.ceil(prompt.length / 4) + Math.ceil(result.length / 4);
  getCostTracker().recordUsage(
    options.buildId ?? 'unknown',
    model.name,
    estimatedTokens,
    callDurationMs,  // capture Date.now() before/after the callSingleModel() call
    phase
  );
} catch {
  // never let cost tracking break the main call path
}
```

Add `phase?: BuildPhase` and `buildId?: string` to the `callLLM` options interface.

---

## KIMI-INFRA-05: Build Analytics Enhancement

**Files:**
- `src/analytics/agent-analytics.ts` (modify existing)
- `src/analytics/build-intelligence.ts` (new file)

**Target size:** ~200 lines total (new + modifications)
**Spec:** Grok R8-05 analytics section

### Modifications to agent-analytics.ts

Add a `wisdom_impact` column to the SQLite `agent_results` table for tracking which
vault and global wisdom patterns were applied during each build:

```typescript
// Add to the CREATE TABLE IF NOT EXISTS statement (new columns, backward-compatible):
vault_patterns_used INTEGER DEFAULT 0,    -- count of vault patterns applied
global_wisdom_applied INTEGER DEFAULT 0,  -- count of global wisdom patterns applied
build_phase TEXT,                         -- phase of build (thinking/tool_use/code_gen etc.)
```

Update `recordTaskResult()` to accept two new optional parameters:

```typescript
export function recordTaskResult(
  agent: string,
  taskId: string,
  success: boolean,
  tokens: number,
  duration: number,
  gateRetries?: number,
  failureReason?: string,
  buildId?: string,
  vaultPatternsUsed?: number,     // new
  globalWisdomApplied?: number,   // new
  buildPhase?: string,            // new
): void
```

Add a new query function:

```typescript
export function getWisdomImpactStats(agentOrBuildId: string, mode: 'agent' | 'build'): {
  avgVaultPatternsPerTask: number;
  avgGlobalWisdomPerTask: number;
  wisdomAssistedSuccessRate: number;  // success rate on tasks where wisdom was applied
  baselineSuccessRate: number;        // success rate on tasks where no wisdom was applied
}
// Query agent_results grouped by whether vault_patterns_used > 0 OR global_wisdom_applied > 0.
// Compute success rates for each group.
// If mode === 'agent': filter by agent = agentOrBuildId.
// If mode === 'build': filter by build_id = agentOrBuildId.
```

### build-intelligence.ts (new file)

```typescript
// Build Intelligence — predictive analytics and ROI for Nova26 premium users
// Implements Grok R8-05 analytics section
```

```typescript
export interface BuildTimePrediction {
  estimatedMinutes: number;
  confidence: number;        // 0–1
  basis: 'historical' | 'heuristic';  // whether we had historical data
}

export interface ROISummary {
  userId: string;
  period: string;            // 'YYYY-MM' or 'last-30-days'
  buildCount: number;
  avgBuildDurationMs: number;
  estimatedHoursSaved: number;
  estimatedCostSavedUsd: number;  // based on $150/hr developer rate
  premiumCostUsd: number;         // $299 * months in period
  netROI: number;                 // estimatedCostSavedUsd - premiumCostUsd
}

export interface AgentHeatmapEntry {
  agentName: string;
  taskType: string;
  totalTasks: number;
  successRate: number;       // 0–1
  avgDurationMs: number;
}

class BuildIntelligence {
  predictBuildTime(
    taskDescription: string,
    agentName: string
  ): BuildTimePrediction
  // 1. Query agent_results in the analytics DB for the agent.
  // 2. Find tasks whose descriptions (inferred from taskId patterns) are similar
  //    to taskDescription. Use a simple keyword overlap heuristic:
  //    tokenize both strings, compute intersection size / 5.
  //    "Similar" = at least 2 tokens in common AND same agent.
  // 3. If >= 3 similar historical tasks exist:
  //    return { estimatedMinutes: avg(duration) / 60000, confidence: 0.75, basis: 'historical' }
  // 4. If not enough history:
  //    Heuristic: base = 5 minutes. Add 3 min per 100 chars of description over 200 chars.
  //    return { estimatedMinutes: heuristicMinutes, confidence: 0.40, basis: 'heuristic' }

  calculateROI(userId: string, period: string): ROISummary
  // `period` is 'YYYY-MM' or 'last-30-days'.
  // 1. Count builds in the period from the analytics DB.
  // 2. Avg build duration = mean of all task durations for those builds.
  // 3. estimatedHoursSaved: assume each build would have taken 2 hours manually.
  //    hoursSaved = buildCount * 2 - (totalBuildDurationMs / 3_600_000)
  //    Floor at 0.
  // 4. estimatedCostSavedUsd = hoursSaved * 150.
  // 5. premiumCostUsd = 299 * monthsInPeriod (1 for a single month, prorated for 30-day).
  // 6. netROI = estimatedCostSavedUsd - premiumCostUsd.
  // 7. Return ROISummary.

  getAgentHeatmap(userId: string): AgentHeatmapEntry[]
  // 1. Query agent_results for all agents, grouped by (agent, inferred task type).
  //    Infer task type as the first word of failure_reason or fallback to 'general'.
  //    (Note: task_type is not stored directly. Use build_phase if available, else 'general'.)
  // 2. For each (agentName, taskType) group, compute:
  //    totalTasks, successRate, avgDurationMs.
  // 3. Return as flat array, sorted by agentName asc, then successRate desc.
  // `userId` is accepted for API consistency but not used yet (future: filter by user).

  // Singleton factory
}

export function getBuildIntelligence(): BuildIntelligence
export function resetBuildIntelligence(): void
```

### Notes

- `BuildIntelligence` reads from the same SQLite `analytics.db` created by
  `agent-analytics.ts`. Import `getAnalyticsDB()` from `./agent-analytics.js`.
- The ROI calculation is intentionally generous to support premium marketing copy.
  The $150/hr developer rate and 2hr/build estimate are configurable via constructor
  options (add optional params with those defaults).

---

## KIMI-INFRA-06: Tests

**Files:**
- `src/similarity/semantic-dedup.test.ts` — ~20 tests
- `src/security/vault-security.test.ts` — ~20 tests
- `src/analytics/build-intelligence.test.ts` — ~15 tests
- `src/llm/model-router.test.ts` (extend existing) — ~10 new tests
- `src/similarity/integration.test.ts` — ~10 integration tests

**Target:** 75+ new tests. All must pass. Existing 1116 tests must still pass.

### semantic-dedup.test.ts (~20 tests)

Mock the Ollama `/api/embeddings` endpoint using `vi.stubGlobal('fetch', ...)` or a
similar vitest mock. Do not make real network calls in tests.

Cover:

- `getEmbedding()` makes a POST to the correct Ollama URL with the correct body
- `getEmbedding()` returns the embedding array from a valid mocked response
- `getEmbedding()` validates the Ollama response with Zod (returns embedding on success)
- `getEmbedding()` throws on HTTP error response (non-2xx)
- `getEmbedding()` returns cached result on second call for same text (no second fetch)
- `cosineSimilarity()` returns 1.0 for identical vectors
- `cosineSimilarity()` returns 0.0 for orthogonal vectors (e.g. [1,0] and [0,1])
- `cosineSimilarity()` returns 0 when either input is a zero vector
- `cosineSimilarity()` clamps result to [0, 1] (never returns negative)
- `cosineSimilarity()` returns 0 for vectors of different lengths
- `isDuplicate()` returns `isDuplicate: true` when highest similarity >= threshold
- `isDuplicate()` returns the correct `canonicalNodeId` (the ID of the best match)
- `isDuplicate()` returns `isDuplicate: false` when all similarities < threshold
- `isDuplicate()` uses Jaccard fallback when Ollama throws (fetch rejects)
- `isDuplicate()` logs a warning when falling back to Jaccard
- `bulkIndex()` calls `getEmbedding()` for each node sequentially
- `bulkIndex()` stores results in the in-memory cache
- `persistCache()` writes a Zod-valid JSON file to `.nova/similarity/embeddings.json`
- `loadCache()` populates the cache from an existing file
- `loadCache()` silently succeeds when the file does not exist
- `resetSemanticDedup()` clears the singleton so next `getSemanticDedup()` is fresh

### vault-security.test.ts (~20 tests)

Cover:

- `encryptNode()` returns an EncryptedNode with algorithm `'aes-256-gcm'`
- `encryptNode()` + `decryptNode()` round-trip: decrypted content matches original
- `decryptNode()` throws when given the wrong key
- `decryptNode()` throws when the ciphertext is corrupted
- `encryptNode()` produces different IVs on each call (randomness)
- `stripSensitiveData()` redacts IPv4 addresses
- `stripSensitiveData()` redacts email addresses
- `stripSensitiveData()` redacts JWT tokens (eyJ... format)
- `stripSensitiveData()` redacts 32+ character hex strings
- `stripSensitiveData()` redacts PEM key blocks (-----BEGIN...)
- `stripSensitiveData()` does not mutate the input node object
- `stripSensitiveData()` preserves non-sensitive content unchanged
- `ensureOwnership()` does not throw when userId matches nodeOwnerId
- `ensureOwnership()` throws when userId does not match nodeOwnerId
- `logAction()` appends a valid JSON line to `.nova/security/audit.jsonl`
- `logAction()` creates the directory if it does not exist
- `readAuditLog()` returns entries in reverse-chronological order
- `readAuditLog()` filters by userId when provided
- `readAuditLog()` skips malformed lines silently
- `deleteAllUserData()` deletes the user's vault file and returns correct counts

### build-intelligence.test.ts (~15 tests)

Mock `getAnalyticsDB()` to return a minimal in-memory SQLite database (use actual
better-sqlite3 with an in-memory `:memory:` database, not a full mock).

Cover:

- `predictBuildTime()` returns `basis: 'heuristic'` when no historical data exists
- `predictBuildTime()` returns `basis: 'historical'` after 3+ similar tasks are seeded
- `predictBuildTime()` heuristic adds time for longer descriptions
- `predictBuildTime()` confidence is 0.40 for heuristic, 0.75 for historical
- `calculateROI()` returns `netROI` >= 0 when enough builds are recorded
- `calculateROI()` returns `buildCount: 0` when no data exists for the period
- `calculateROI()` `estimatedHoursSaved` is floored at 0
- `calculateROI()` `estimatedCostSavedUsd` uses $150/hr rate
- `calculateROI()` `premiumCostUsd` is $299 for a single month
- `getAgentHeatmap()` returns an entry per (agentName, taskType) combination
- `getAgentHeatmap()` entries are sorted by agentName asc
- `getAgentHeatmap()` `successRate` is computed correctly from seeded data
- `getAgentHeatmap()` returns an empty array when no task data exists
- `getBuildIntelligence()` returns the same singleton on multiple calls
- `resetBuildIntelligence()` clears the singleton

### model-router.test.ts extensions (~10 new tests)

Add to the existing `model-router.test.ts` file. Do not modify existing tests.

Cover:

- `detectAvailableModels()` returns model names from a mocked Ollama `/api/tags` response
- `detectAvailableModels()` returns `[]` when fetch rejects (network error)
- `selectModelForPhase('thinking')` returns a 7B-class model name
- `selectModelForPhase('code_gen')` returns a 32B-class model name
- `selectModelForPhase('embedding')` returns `'nomic-embed-text'` or `'mxbai-embed-large'`
- `getCostTracker().recordUsage()` appends a record to the in-memory store
- `getCostTracker().getBuildCost()` aggregates tokens correctly across multiple records
- `getCostTracker().getBuildCost()` returns estimatedCostUsd of 0 for Ollama models
- `getCostTracker().getMonthlyUsage()` filters to the current month
- `resetCostTracker()` clears in-memory records

### integration.test.ts (~10 tests)

Test the end-to-end wisdom promotion pipeline with dedup and security.

Cover:

- Full pipeline: `stripSensitiveData()` → `isDuplicate()` → `GlobalWisdomPipeline.promote()`
  with a unique node returns a non-null pattern
- Full pipeline: a node with an email address in its content has the email redacted in
  the promoted pattern's `canonicalContent`
- Full pipeline: calling `promote()` twice with semantically similar content (mocked
  cosine similarity >= 0.92) returns `null` on the second call
- Full pipeline: `promote()` falls through to Jaccard dedup when Ollama is unavailable
- `encryptNode()` → `decryptNode()` round-trip via `VaultSecurity` singleton
- `VaultSecurity.deleteAllUserData()` removes the file that `TasteVault` would have
  written for a given userId (use temp directory in test)
- `SemanticDedup.bulkIndex()` → `isDuplicate()` uses the cached embeddings (no Ollama
  calls after bulkIndex when content is identical)
- `CostTracker.recordUsage()` → `getBuildCost()` returns correct model breakdown
- `getWisdomImpactStats()` returns higher `wisdomAssistedSuccessRate` than
  `baselineSuccessRate` when test data is seeded accordingly
- After `detectAvailableModels()` populates `installedModels`, `selectModelForPhase()`
  prefers installed models over uninstalled ones

---

## File Structure to Create

```
src/
  similarity/
    semantic-dedup.ts              (KIMI-INFRA-01)
    semantic-dedup.test.ts         (KIMI-INFRA-06)
    integration.test.ts            (KIMI-INFRA-06)
  security/
    vault-security.ts              (KIMI-INFRA-03)
    vault-security.test.ts         (KIMI-INFRA-06)
  analytics/
    build-intelligence.ts          (KIMI-INFRA-05, new)
    build-intelligence.test.ts     (KIMI-INFRA-06)
    agent-analytics.ts             (KIMI-INFRA-05, modify existing)
  llm/
    model-router.ts                (KIMI-INFRA-04, modify existing)
    model-router.test.ts           (KIMI-INFRA-06, extend existing)
  taste-vault/
    global-wisdom.ts               (KIMI-INFRA-01, small integration addition)
convex/
  schema.ts                        (KIMI-INFRA-02, add 4 tables)
  wisdom.ts                        (KIMI-INFRA-02, new)
  activity.ts                      (KIMI-INFRA-02, new)
.nova/
  similarity/
    embeddings.json                (created at runtime by SemanticDedup)
  security/
    audit.jsonl                    (created at runtime by VaultSecurity)
  analytics/
    cost-tracker.jsonl             (created at runtime by CostTracker)
```

---

## Verification Checklist

After all six tasks are complete, run:

```bash
# TypeScript: must be 0 errors
npx tsc --noEmit

# Tests: must be 1116 + 75+ new passing, 0 failing
npx vitest run

# Spot-check: semantic dedup round-trip (requires Ollama running with nomic-embed-text)
node --input-type=module << 'EOF'
import { getSemanticDedup } from './src/similarity/semantic-dedup.js';
const dedup = getSemanticDedup();
const result = await dedup.isDuplicate(
  { id: 'node-a', content: 'Always validate Zod schemas at API boundaries' },
  [{ id: 'node-b', content: 'Validate all external inputs with Zod' }]
);
console.log('isDuplicate:', result.isDuplicate, '| similarity:', result.similarity.toFixed(3));
EOF

# Spot-check: vault security encrypt/decrypt
node --input-type=module << 'EOF'
import { getVaultSecurity } from './src/security/vault-security.js';
const sec = getVaultSecurity();
const enc = sec.encryptNode({ id: 'test-node', content: 'secret pattern content' }, 'my-key');
const dec = sec.decryptNode(enc, 'my-key');
console.log('round-trip OK:', dec.content === 'secret pattern content');
EOF

# Spot-check: build intelligence ROI
node --input-type=module << 'EOF'
import { getBuildIntelligence } from './src/analytics/build-intelligence.js';
const bi = getBuildIntelligence();
const roi = bi.calculateROI('user-001', 'last-30-days');
console.log('ROI summary:', JSON.stringify(roi, null, 2));
EOF

# Spot-check: model router phase selection
node --input-type=module << 'EOF'
import { selectModelForPhase } from './src/llm/model-router.js';
console.log('thinking phase:', selectModelForPhase('thinking').name);
console.log('code_gen phase:', selectModelForPhase('code_gen').name);
console.log('embedding phase:', selectModelForPhase('embedding').name);
EOF
```

---

## Commit Order

Commit after each task so main stays green:

1. `feat(infra): KIMI-INFRA-01 semantic dedup — Ollama embedding-based dedup with Jaccard fallback`
2. `feat(infra): KIMI-INFRA-02 convex real-time — globalPatterns, userProfiles, wisdomUpdates, agentActivityFeed`
3. `feat(infra): KIMI-INFRA-03 vault security — AES-256-GCM encrypt, PII strip, GDPR delete, audit log`
4. `feat(infra): KIMI-INFRA-04 model router optimization — Qwen3/DeepSeek routing, availability detection, CostTracker`
5. `feat(infra): KIMI-INFRA-05 build intelligence — ROI, build time prediction, agent heatmap, wisdom impact stats`
6. `feat(infra): KIMI-INFRA-06 75+ tests for similarity, security, build-intelligence, model-router, integration`

Each commit must pass `npx tsc --noEmit` and `npx vitest run` before being committed.

---

## Key Design Decisions (do not deviate without flagging)

1. **Ollama HTTP calls use `fetch` directly — no new libraries.** The existing
   `src/llm/ollama-client.ts` uses `fetch`. `SemanticDedup` and `detectAvailableModels`
   follow the same pattern. Keep the dependency footprint flat.

2. **Semantic dedup is a pre-gate, Jaccard remains a secondary gate.** The new cosine
   similarity check runs first in `GlobalWisdomPipeline.promote()`. If Ollama is
   unavailable, the existing Jaccard check in `findDuplicates()` still runs. Never
   skip deduplication entirely — the Jaccard path is the ultimate fallback.

3. **Encryption is symmetric AES-256-GCM, Node.js crypto only.** No `argon2`, no
   `bcrypt`, no `libsodium` wrappers. The key derivation is SHA-256 (for simplicity in
   this sprint). A future sprint can upgrade to PBKDF2 or Argon2 without changing the
   interface — the `EncryptedNode` shape already stores `keyId` and `algorithm`.

4. **Convex schema additions are additive.** The four new tables (`globalPatterns`,
   `userProfiles`, `wisdomUpdates`, `agentActivityFeed`) are appended to the existing
   schema. No existing table is modified or renamed. The `convex/atlas.ts` functions
   continue to work unchanged.

5. **CostTracker is fire-and-forget inside callLLM.** The cost tracking block is wrapped
   in `try/catch` so a CostTracker failure can never surface as a callLLM failure. The
   main inference path is never blocked by analytics.

6. **BuildIntelligence uses the existing SQLite database via getAnalyticsDB().** It does
   not create a second database. The `getAnalyticsDB()` export in `agent-analytics.ts`
   was designed for exactly this kind of advanced query access.

7. **GDPR delete is local-only in this sprint.** `deleteAllUserData()` scrubs local
   `.nova/` files. Convex data deletion is a future sprint (requires a Convex mutation
   that cascades across `globalPatterns`, `wisdomUpdates`, `agentActivityFeed`, and
   `userProfiles` for the given userId). Log a clear warning that Convex data was not
   scrubbed.

8. **Model availability detection is best-effort and non-blocking.** `detectAvailableModels()`
   returns `[]` on any failure. `selectModelForPhase()` degrades gracefully: if the
   preferred model is not in `installedModels` (or `installedModels` is empty), it falls
   back down the preference chain to whatever is circuit-breaker-available.

9. **Singleton pattern matches existing codebase.** Every new class has a `get*()` factory
   and a `reset*()` for tests. Reset functions clear in-memory state only — they do not
   delete JSON/JSONL files on disk. This matches the pattern in `src/tools/tool-registry.ts`
   and `src/taste-vault/graph-memory.ts`.

10. **Never throw from analytics or context-building paths.** `BuildIntelligence`,
    `CostTracker`, and the `getWisdomImpactStats()` function must catch their own errors
    and return sensible zero-value defaults. The build pipeline must never be interrupted
    by an analytics failure.
