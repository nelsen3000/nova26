# KIMI TASK FILE — Frontier Sprint

> Owner: Kimi
> Priority: Frontier Features (next-generation AI IDE capabilities)
> Prerequisite: KIMI-AGENT-01-06, KIMI-VAULT-01-06, KIMI-ACE-01-06, KIMI-INFRA-01-06, KIMI-POLISH-01-06, KIMI-INTEGRATIONS-01-06 complete and merged to main
> Spec sources: Grok R13-01 (Agent Communication), R13-02 (Predictive Decomposition), R13-03 (Semantic Code Search), R13-04 (Adaptive Personality), R13-05 (Offline-First), R11-01 (Multi-Modal Vision), R11-03 (Quality Benchmarks)
> Test baseline: 1445 tests passing, 0 TypeScript errors

---

## Context

Nova26 is a 21-agent AI-powered IDE built with TypeScript, Ollama, and Convex. You have
completed six major sprint cycles:

- **KIMI-AGENT-01-06** — inner loop (ReAct, agent-loop, tool registry, orchestrator)
- **KIMI-VAULT-01-06** — Living Taste Vault (`src/taste-vault/`) and Global Wisdom Pipeline
- **KIMI-ACE-01-06** — ACE Playbook System, Rehearsal Stage, Self-Improvement Protocol
- **KIMI-INFRA-01-06** — Semantic similarity, Convex real-time, security, model routing, analytics
- **KIMI-POLISH-01-06** — Error recovery, performance caching, prompt snapshots, property tests, CI
- **KIMI-INTEGRATIONS-01-06** — Docs fetcher, skills framework, pattern loader, knowledge base, Venus UI skills

The product is feature-rich and hardened. 1445 tests are passing, 0 TS errors. Nova26
targets premium pricing at ~$299/month with a local-first (Ollama) value prop.

**This sprint builds the frontier features that no other AI IDE has — the ones that make
premium users say "nothing else comes close."**

These are not incremental improvements to existing features. They are architectural leaps:
agents that communicate and negotiate with each other mid-build; semantic understanding
of the entire codebase at query time; task decompositions that get smarter with every
build; agents that adapt their personality to each user over time; and a product that
works flawlessly without any internet connection. A developer reading these specs in 2027
should recognize them as the moment Nova26 diverged from the obvious path.

**Key existing files you will read before touching:**

- `src/agent-loop/agent-loop.ts` — `AgentLoop`, the ReAct inner loop, turn structure
- `src/orchestrator/ralph-loop.ts` — `processTask()`, outer build orchestration
- `src/orchestrator/task-decomposer.ts` — existing decomposition logic
- `src/orchestrator/prompt-builder.ts` — how prompts are assembled for agents
- `src/tools/tool-registry.ts` — `ToolRegistry`, singleton pattern, `Tool` interface
- `src/tools/core-tools.ts` — how existing tools are defined and registered
- `src/similarity/semantic-dedup.ts` — `SemanticDedup`, embedding infrastructure
- `src/taste-vault/graph-memory.ts` — `GraphMemory`, `GraphNode`, `NodeType`, `EdgeRelation`
- `src/taste-vault/taste-vault.ts` — `TasteVault`, high-level vault API
- `src/llm/model-router.ts` — `callLLM()`, `AVAILABLE_MODELS`, `selectModelForTask()`

**New directories you will create:**

- `src/agents/` — message bus, blackboard, personality engine
- `src/tools/` — semantic-search.ts (add alongside existing tool files)
- `src/orchestrator/` — predictive-decomposer.ts (add alongside existing orchestrator files)
- `src/sync/` — offline engine

---

## Global Rules (apply to every task)

- **TypeScript strict mode** — no `any`, no implicit `any`, no `@ts-ignore`
- **ESM imports** — always use `.js` extensions on relative imports (e.g., `import { Foo } from './foo.js'`)
- **Zod for all external/runtime data validation** — validate at system boundaries,
  especially when reading persisted JSON files
- **Tests with vitest** — all new tests use `import { describe, it, expect, vi } from 'vitest'`
- **Do not break existing tests** — `npx vitest run` must show 1445+ passing after each task
- **Zero TypeScript errors** — `npx tsc --noEmit` must report 0 errors after every task
- **Commit to main when done** — one commit per KIMI-FRONTIER task, commit message format:
  `feat(frontier): KIMI-FRONTIER-XX <short description>`
- **Reference existing patterns** — follow singleton factory pattern from `src/tools/tool-registry.ts`
  (class + `get*()` factory + `reset*()` for tests). Match error handling conventions from
  `src/taste-vault/global-wisdom.ts` (catch, log, never throw from context-building paths).
- **File header comments** — every new file starts with a 2-line comment:
  `// <Short description>\n// <Which spec this implements>`
- **No new npm dependencies** without a compelling reason — `zod`, `vitest`, `better-sqlite3`,
  `typescript`, and the TypeScript Compiler API are available. Do not add libraries arbitrarily.
- **Read existing files before modifying them** — every integration point (AgentLoop,
  ralph-loop.ts, prompt-builder.ts, tool-registry.ts) must be read in full before any edits.

---

## KIMI-FRONTIER-01: Agent-to-Agent Communication

**Files:** `src/agents/message-bus.ts`, `src/agents/blackboard.ts`
**Target size:** ~300 lines total
**Spec:** Grok R13-01

### What to build

The current Ralph Loop orchestrates agents sequentially — JUPITER plans, MARS codes,
VENUS reviews, PLUTO tests. This works for well-understood tasks. But complex builds are
negotiations between competing expertise and incomplete information that no single agent
fully possesses. The `AgentMessageBus` and `SharedBlackboard` turn Nova26's agent
pipeline from a relay race into a jazz ensemble: each agent has a role, but they listen
to each other, share findings mid-build, negotiate disagreements, and the result is
something none of them could have produced alone.

### Core types

```typescript
// src/agents/message-bus.ts

export type AgentMessageType =
  | 'REQUEST_HELP'     // agent asks a peer for domain expertise
  | 'SHARE_FINDING'    // agent broadcasts a discovery to relevant peers
  | 'FLAG_CONCERN'     // agent raises a blocking issue for another to resolve
  | 'PROPOSE'          // agent proposes an approach for another to evaluate
  | 'COUNTER'          // agent counters a PROPOSE with an alternative
  | 'AGREE'            // agent signals agreement with a PROPOSE or COUNTER
  | 'ESCALATE';        // agent requests JUPITER or human arbitration

export type AgentName =
  | 'MARS' | 'VENUS' | 'MERCURY' | 'JUPITER' | 'SATURN' | 'PLUTO'
  | 'ATLAS' | 'GANYMEDE' | 'IO' | 'CALLISTO' | 'MIMAS' | 'NEPTUNE'
  | 'ANDROMEDA' | 'ENCELADUS' | 'SUN' | 'EARTH' | 'RALPH';

export interface AgentMessage {
  id: string;                          // crypto.randomUUID()
  type: AgentMessageType;
  from: AgentName;
  to: AgentName | 'BROADCAST';        // BROADCAST delivers to all subscribed agents
  subject: string;                     // brief topic, e.g. 'auth error handling approach'
  body: string;                        // the actual content
  replyToId?: string;                  // for threading: AGREE, COUNTER, ESCALATE chain back
  taskId: string;                      // the Ralph Loop task this message relates to
  priority: 'low' | 'medium' | 'high' | 'urgent';
  requiresResponse: boolean;
  responseDeadlineMs?: number;         // how long sender waits before auto-escalating
  sentAt: string;                      // ISO timestamp
  deliveredAt?: string;
  readAt?: string;
}
```

### AgentMessageBus class

```typescript
class AgentMessageBus {
  // ---- Sending and receiving ----

  async send(message: Omit<AgentMessage, 'id' | 'sentAt'>): Promise<AgentMessage>
  // Assign id = crypto.randomUUID(), sentAt = new Date().toISOString().
  // Store message in in-memory map keyed by message.id.
  // If message.to === 'BROADCAST': deliver to all registered handlers.
  // If message.to is a specific AgentName: deliver to that agent's handler if registered.
  // Set deliveredAt on delivery.
  // Return the complete AgentMessage with id and sentAt set.
  // Log: `MessageBus [${message.from} → ${message.to}] ${message.type}: ${message.subject}`

  subscribe(agentName: AgentName, handler: (msg: AgentMessage) => Promise<void>): () => void
  // Register handler for the given agentName.
  // Return an unsubscribe function that removes the handler.
  // Only one handler per agentName (calling subscribe again replaces the prior handler).

  getThread(rootMessageId: string): AgentMessage[]
  // Return the root message and all messages where replyToId traces back to rootMessageId.
  // Ordered by sentAt ascending (oldest first).

  getInbox(agentName: AgentName, taskId?: string): AgentMessage[]
  // Return all messages delivered to agentName (to === agentName OR to === 'BROADCAST').
  // If taskId provided: filter to messages for that task only.
  // Sorted by sentAt desc (newest first).

  markRead(messageId: string, agentName: AgentName): void
  // Set readAt = new Date().toISOString() on the message with the given id.

  getUnread(agentName: AgentName, taskId: string): AgentMessage[]
  // Return messages in agentName's inbox for taskId where readAt is undefined.

  clearTask(taskId: string): void
  // Remove all messages for a given taskId from the in-memory store.
  // Called by ralph-loop.ts when a task completes (cleanup).

  // ---- Singleton factory ----
}

export function getAgentMessageBus(): AgentMessageBus
export function resetAgentMessageBus(): void  // for tests
```

### NegotiationProtocol

The negotiation protocol formalizes the PROPOSE → COUNTER → AGREE/ESCALATE flow.
When two agents disagree on an approach, they enter structured negotiation rather than
having the orchestrator arbitrarily pick one side.

```typescript
export type NegotiationStatus = 'open' | 'agreed' | 'escalated';

export interface NegotiationSession {
  id: string;                          // crypto.randomUUID()
  taskId: string;
  initiator: AgentName;
  respondent: AgentName;
  topic: string;                       // e.g. 'data structure choice for session cache'
  initiatorPosition: string;           // MARS: 'use Map — O(1) lookup, typed keys'
  respondentPosition?: string;         // VENUS: 'use Record — JSON-serializable, simpler'
  status: NegotiationStatus;
  resolution?: string;                 // the chosen approach (filled when agreed/escalated)
  resolvedBy?: AgentName | 'JUPITER' | 'auto';
  openedAt: string;
  resolvedAt?: string;
  messageIds: string[];                // all message IDs in this negotiation thread
}

class NegotiationProtocol {
  constructor(private bus: AgentMessageBus)

  async openNegotiation(
    taskId: string,
    initiator: AgentName,
    respondent: AgentName,
    topic: string,
    initiatorPosition: string
  ): Promise<NegotiationSession>
  // Create a new NegotiationSession with status 'open'.
  // Send a PROPOSE message from initiator to respondent.
  // Store the session in an in-memory map keyed by session.id.
  // Return the session.

  async respondToNegotiation(
    sessionId: string,
    respondentPosition: string
  ): Promise<NegotiationSession>
  // Load the session by id. Throw if not found or not 'open'.
  // Set respondentPosition on the session.
  // Send a COUNTER message from respondent to initiator (replyToId = original PROPOSE message id).
  // Return the updated session.

  async resolve(
    sessionId: string,
    chosenApproach: string,
    resolvedBy: AgentName | 'JUPITER' | 'auto'
  ): Promise<NegotiationSession>
  // Set status = 'agreed', resolution = chosenApproach, resolvedBy, resolvedAt = now.
  // Send an AGREE message from resolvedBy to both agents.
  // Return the updated session.

  async escalate(
    sessionId: string,
    reason: string
  ): Promise<NegotiationSession>
  // Set status = 'escalated', resolvedBy = 'JUPITER', resolvedAt = now.
  // Send an ESCALATE message to JUPITER with the full negotiation context.
  // Return the updated session.

  getOpenNegotiations(taskId: string): NegotiationSession[]
  // Return all sessions for taskId where status === 'open'.

  // ---- Auto-trigger logic ----

  shouldTriggerNegotiation(agentConfidence: number, peerHasExpertise: boolean): boolean
  // Returns true when agentConfidence < 0.65 AND peerHasExpertise === true.
  // This is the threshold at which an agent should REQUEST_HELP rather than proceeding alone.
  // Called by AgentLoop after each turn to check whether to initiate communication.

  // ---- Singleton factory ----
}

export function getNegotiationProtocol(): NegotiationProtocol
export function resetNegotiationProtocol(): void  // for tests
```

### SharedBlackboard class (src/agents/blackboard.ts)

The blackboard is the collective working memory of the agent team during a build. It is
not the Taste Vault (long-term memory) — it is the whiteboard on the wall during a sprint:
visible to everyone, updated in real time, erased when the task is done.

```typescript
// src/agents/blackboard.ts
// Shared key-value state visible to all agents during a Ralph Loop task
// Implements Grok R13-01 shared blackboard pattern

export interface BlackboardEntry {
  id: string;                          // crypto.randomUUID()
  key: string;                         // e.g. 'current-auth-approach', 'failing-tests'
  value: unknown;                      // the actual content
  author: AgentName;
  taskId: string;
  confidence: number;                  // 0-1: how certain is the author
  tags: string[];                      // for filtering: ['auth', 'architecture', 'decision']
  supersedes?: string;                 // id of a prior entry this replaces
  writtenAt: string;                   // ISO timestamp
  version: number;                     // increments each time this key is overwritten
}

class SharedBlackboard {
  write(
    key: string,
    value: unknown,
    author: AgentName,
    taskId: string,
    options?: { confidence?: number; tags?: string[]; supersedes?: string }
  ): BlackboardEntry
  // Create a new BlackboardEntry with id = crypto.randomUUID(), writtenAt = now.
  // Default confidence = 0.8, tags = [].
  // If an existing entry for the same key+taskId exists, increment version (start at 1).
  // Store in in-memory map: key = `${taskId}::${key}`.
  // Return the entry.

  read(key: string, taskId: string): BlackboardEntry | null
  // Return the most recent entry for key+taskId, or null if none exists.

  readAll(taskId: string, tags?: string[]): BlackboardEntry[]
  // Return all entries for taskId.
  // If tags provided: return only entries where at least one tag matches.
  // Sorted by confidence desc (highest confidence entries first).

  supersede(oldEntryId: string, newKey: string, newValue: unknown, author: AgentName): BlackboardEntry
  // Look up oldEntryId. Throw if not found.
  // Create new entry with supersedes = oldEntryId, same taskId as old entry.
  // Return the new entry.

  snapshot(taskId: string): Record<string, BlackboardEntry>
  // Return a shallow copy of all entries for taskId, keyed by entry key.
  // Used to inject context into agent prompts.

  clear(taskId: string): void
  // Remove all entries for taskId from in-memory store.
  // Called by ralph-loop.ts when a task completes.

  // Format for prompt injection (used by prompt-builder.ts):
  formatForPrompt(taskId: string, maxTokens?: number): string
  // Produce a formatted string of the blackboard for injection into agent prompts.
  // Default maxTokens = 500 (roughly 375 words).
  // Format:
  //   ## Shared Team Context (from other agents)
  //   [HIGH CONFIDENCE] {author} wrote: {key} = "{value}" (confidence: {confidence})
  //   [MEDIUM] {author} wrote: {key} = {value} (confidence: {confidence})
  // Confidence tiers: >= 0.9 = HIGH, >= 0.7 = MEDIUM, < 0.7 = LOW
  // Truncate to fit maxTokens (rough estimate: 1 token ≈ 4 chars). Show most recent
  // high-confidence entries first.

  // ---- Singleton factory ----
}

export function getSharedBlackboard(): SharedBlackboard
export function resetSharedBlackboard(): void  // for tests
```

### New tools in ToolRegistry

Register two new tools in `src/tools/core-tools.ts` (read the file before editing):

```typescript
// Tool: readBlackboard
// Input: { taskId: string; key?: string; tags?: string[] }
// Behavior: if key provided, read that specific key from the blackboard.
//   If only tags provided, readAll filtered by tags.
//   If neither, readAll for taskId.
// Output: JSON-serialized array of BlackboardEntry objects (or single entry).

// Tool: writeBlackboard
// Input: { taskId: string; key: string; value: string; confidence?: number; tags?: string[] }
// Behavior: write the key-value pair to the blackboard for this taskId.
// Note: value is always a string when coming through the tool interface
//   (agents pass JSON-encoded complex values as strings).
// Output: JSON-serialized BlackboardEntry.
```

### Integration with AgentLoop

Read `src/agent-loop/agent-loop.ts` fully before editing. After each turn completes,
check for incoming messages:

```typescript
// At the end of each turn in AgentLoop, after tool execution:
const bus = getAgentMessageBus();
const unread = bus.getUnread(this.config.agentName as AgentName, this.config.taskId);
if (unread.length > 0) {
  // Inject unread messages into the next turn's prompt context.
  // Mark them as read.
  for (const msg of unread) {
    bus.markRead(msg.id, this.config.agentName as AgentName);
  }
  // If any message has type ESCALATE and to === this agent: log a warning.
  // If any message is REQUEST_HELP directed at this agent: set a flag so the next
  //   turn prompt includes the requester's question.
}

// Auto-trigger negotiation check (after confidence scoring, if applicable):
const protocol = getNegotiationProtocol();
if (protocol.shouldTriggerNegotiation(this.lastConfidence ?? 1.0, this.peerExpertiseAvailable)) {
  // The agent can initiate a REQUEST_HELP via the writeBlackboard tool or message bus.
  // Don't force it — just make the flag available to the prompt context.
  this.shouldSeekHelp = true;
}
```

### Zod schemas

```typescript
const AgentMessageSchema = z.object({
  id: z.string(),
  type: z.enum(['REQUEST_HELP', 'SHARE_FINDING', 'FLAG_CONCERN', 'PROPOSE', 'COUNTER', 'AGREE', 'ESCALATE']),
  from: z.string(),
  to: z.union([z.string(), z.literal('BROADCAST')]),
  subject: z.string(),
  body: z.string(),
  replyToId: z.string().optional(),
  taskId: z.string(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  requiresResponse: z.boolean(),
  responseDeadlineMs: z.number().optional(),
  sentAt: z.string(),
  deliveredAt: z.string().optional(),
  readAt: z.string().optional(),
});

const BlackboardEntrySchema = z.object({
  id: z.string(),
  key: z.string(),
  value: z.unknown(),
  author: z.string(),
  taskId: z.string(),
  confidence: z.number().min(0).max(1),
  tags: z.array(z.string()),
  supersedes: z.string().optional(),
  writtenAt: z.string(),
  version: z.number().int().nonnegative(),
});
```

### Notes

- The message bus is entirely in-memory for single-machine builds. In a future team
  sprint, a `ConvexMessageBusAdapter` can replace the in-memory store while keeping
  the same `AgentMessageBus` interface.
- `clearTask()` on the bus and `clear()` on the blackboard must be called by
  ralph-loop.ts after each task completes to prevent unbounded memory growth.
- The blackboard does NOT persist across builds. It is ephemeral working state.
  If agents need to persist a finding across builds, they write it to the Taste Vault
  via the existing vault tools.
- The negotiation auto-trigger (confidence < 0.65) is a soft trigger. The agent does not
  automatically send a message — it sets a flag that the next prompt context can act on.
  Forcing agents to seek help could cause infinite loops; the flag approach is safer.

---

## KIMI-FRONTIER-02: Semantic Code Search

**File:** `src/tools/semantic-search.ts`
**Target size:** ~350 lines
**Spec:** Grok R13-03

### What to build

Most code search tools are lexical: they find files that contain a keyword. Semantic
code search finds files that contain relevant *concepts*, even when the exact words
differ. A developer asking "where do we handle authentication errors?" should find the
`handleAuthFailure()` function even though it doesn't contain the word "errors" in its
name. The `CodeIndex` class parses the TypeScript AST of the entire project, extracts
meaningful code units, embeds them semantically, and makes the codebase queryable in
natural language.

### CodeIndex class

```typescript
// src/tools/semantic-search.ts
// Semantic code search using TypeScript Compiler API + Ollama embeddings
// Implements Grok R13-03

import ts from 'typescript';

export interface CodeUnit {
  id: string;                          // SHA-256 of (filePath + name)
  filePath: string;                    // absolute path
  name: string;                        // e.g. 'handleAuthFailure', 'UserService', 'AuthConfig'
  kind: 'function' | 'class' | 'interface' | 'type' | 'variable' | 'method';
  docstring: string;                   // JSDoc comment if present, otherwise first line of body
  signature: string;                   // e.g. 'async function handleAuthFailure(err: AuthError): Promise<void>'
  startLine: number;
  endLine: number;
  embedding?: number[];                // set after embed() is called
  indexedAt: string;                   // ISO timestamp
}

export interface SearchResult {
  unit: CodeUnit;
  score: number;                       // cosine similarity 0-1
  relevance: 'high' | 'medium' | 'low';
}

export interface ImpactAnalysis {
  filePath: string;
  affectedFiles: string[];             // files that import symbols from filePath
  affectedSymbols: Array<{
    symbol: string;
    usedIn: string[];                  // files that use this specific symbol
  }>;
  impactRadius: 'contained' | 'moderate' | 'widespread';
  // contained: ≤ 3 files affected
  // moderate: 4–10 files affected
  // widespread: > 10 files affected
}

class CodeIndex {
  constructor(options?: {
    projectRoot?: string;              // default: process.cwd()
    embeddingModel?: string;           // default: 'nomic-embed-text'
    indexPath?: string;                // default: '.nova/code-index/{projectHash}.json'
    ollamaBaseUrl?: string;            // default: 'http://localhost:11434'
    excludePatterns?: string[];        // default: ['node_modules', 'dist', '.nova', '.git']
  })

  // ---- Indexing ----

  async buildIndex(projectRoot?: string): Promise<void>
  // Discover all .ts and .tsx files under projectRoot (excluding excludePatterns).
  // For each file: call parseFile(filePath) to extract CodeUnits.
  // Embed each CodeUnit using embedUnit(unit) via Ollama nomic-embed-text.
  //   Reuse SemanticDedup's embedding infrastructure (getSemanticDedup().embed()).
  //   The text to embed = `${unit.kind} ${unit.name}: ${unit.docstring} ${unit.signature}`
  // Store all units in in-memory array and persist to indexPath.
  // Log progress: `CodeIndex: indexed {n} units from {fileCount} files`

  async parseFile(filePath: string): Promise<CodeUnit[]>
  // Use TypeScript Compiler API to parse the file into an AST.
  // Create a ts.SourceFile with:
  //   ts.createSourceFile(filePath, fileContents, ts.ScriptTarget.Latest, true)
  // Walk the AST and extract CodeUnits for:
  //   - FunctionDeclaration / FunctionExpression / ArrowFunction (kind: 'function')
  //   - ClassDeclaration (kind: 'class')
  //   - InterfaceDeclaration (kind: 'interface')
  //   - TypeAliasDeclaration (kind: 'type')
  //   - MethodDeclaration (kind: 'method')
  //   - VariableDeclaration where initializer is a function (kind: 'variable')
  // For each unit: extract the name, compute startLine/endLine from node positions,
  //   extract the preceding JSDoc comment as docstring (if any), and build a signature
  //   string from the node's first line.
  // Skip anonymous functions and generated/declaration files (.d.ts).
  // Return the array of CodeUnits.

  async embedUnit(unit: CodeUnit): Promise<CodeUnit>
  // Compose embed text: `${unit.kind} ${unit.name}: ${unit.docstring} ${unit.signature}`
  // Call getSemanticDedup().embed(embedText) to get the embedding vector.
  // Set unit.embedding = the returned vector.
  // Return the unit with embedding set.

  // ---- Search ----

  async query(naturalLanguage: string, topK?: number): Promise<SearchResult[]>
  // Default topK = 10.
  // Embed the natural language query using getSemanticDedup().embed(naturalLanguage).
  // Compute cosine similarity between the query embedding and each indexed unit's embedding.
  //   Skip units with no embedding.
  // Sort by similarity descending.
  // Take top topK results.
  // Map score to relevance: >= 0.75 = 'high', >= 0.55 = 'medium', < 0.55 = 'low'.
  // Return the ranked SearchResult array.

  // ---- Impact analysis ----

  async analyzeImpact(filePath: string): Promise<ImpactAnalysis>
  // Parse the given file to identify exported symbols (functions, classes, types, variables).
  // Scan all indexed files' source to find imports of those symbols.
  //   Simple text-based scan: look for lines matching `from '...{relativePathToFile}'`
  //   or `from "...{relativePathToFile}"`.
  // Build the affectedFiles list: any file that imports from filePath.
  // For each exported symbol, find which files specifically use it
  //   (check if the symbol name appears in the importing file's code units).
  // Compute impactRadius based on affectedFiles.length.
  // Return the ImpactAnalysis.

  // ---- Index persistence ----

  async saveIndex(): Promise<void>
  // Serialize all CodeUnits (with embeddings) to indexPath as JSON.
  // Create parent directories if needed.

  async loadIndex(): Promise<boolean>
  // Read and parse indexPath. Validate with Zod.
  // If file doesn't exist or is invalid: return false.
  // Populate in-memory units array. Return true on success.

  async incrementalUpdate(changedFiles: string[]): Promise<void>
  // For each changedFile:
  //   Remove all existing CodeUnits with filePath === changedFile from in-memory array.
  //   Re-parse the file and embed the new units.
  //   Add the new units to the in-memory array.
  // After processing all changed files: call saveIndex().
  // Log: `CodeIndex: incremental update for ${changedFiles.length} files`

  // ---- File change detection ----

  async detectChangedFiles(since?: string): Promise<string[]>
  // Return a list of .ts/.tsx files modified since the given ISO timestamp.
  // If since is undefined: return all files (triggers full reindex).
  // Uses file mtime comparison.

  getStats(): { unitCount: number; fileCount: number; lastIndexed?: string }

  // ---- Singleton factory ----
}

export function getCodeIndex(): CodeIndex
export function resetCodeIndex(): void  // for tests
```

### New tools in ToolRegistry

Register two new tools in `src/tools/core-tools.ts` (read the file before editing):

```typescript
// Tool: semanticSearch
// Input: { query: string; topK?: number }
// Behavior: call getCodeIndex().query(query, topK).
//   If the index is empty, trigger buildIndex() first (non-blocking warning if it takes > 5s).
// Output: JSON array of SearchResult objects (unit + score + relevance), max topK entries.
//   Format each result as:
//   { file: unit.filePath, name: unit.name, kind: unit.kind, score, relevance, signature }

// Tool: impactAnalysis
// Input: { filePath: string }
// Behavior: call getCodeIndex().analyzeImpact(filePath).
// Output: JSON-serialized ImpactAnalysis.
//   Summary line: "Changing {filePath} affects {n} files ({impactRadius} impact)."
```

### Index persistence format

```
.nova/code-index/{projectHash}.json
```

Where `projectHash` = SHA-256 of the `projectRoot` path (first 12 chars). The JSON file
contains:

```json
{
  "version": "1",
  "projectRoot": "/absolute/path",
  "indexedAt": "2026-02-18T...",
  "units": [ /* array of CodeUnit objects with embeddings */ ]
}
```

### Zod schemas

```typescript
const CodeUnitSchema = z.object({
  id: z.string(),
  filePath: z.string(),
  name: z.string(),
  kind: z.enum(['function', 'class', 'interface', 'type', 'variable', 'method']),
  docstring: z.string(),
  signature: z.string(),
  startLine: z.number().int().nonneg(),
  endLine: z.number().int().nonneg(),
  embedding: z.array(z.number()).optional(),
  indexedAt: z.string(),
});

const CodeIndexFileSchema = z.object({
  version: z.literal('1'),
  projectRoot: z.string(),
  indexedAt: z.string(),
  units: z.array(CodeUnitSchema),
});
```

### Notes

- The TypeScript Compiler API is already available as a transitive dependency (TypeScript
  itself is installed). Import via `import ts from 'typescript'`. No new npm dependency needed.
- Embeddings are computed using `getSemanticDedup().embed()` from `src/similarity/semantic-dedup.ts`.
  Read semantic-dedup.ts before calling to confirm the exact method signature.
- The index file can be large (hundreds of KB for a big codebase). Load it lazily — only
  call `loadIndex()` on first query. Do not load at module initialization time.
- `analyzeImpact()` uses simple text-based import scanning rather than a full TypeScript
  type-resolution pass. This is intentional: full type resolution would require a language
  server and is out of scope. The text-based approach is fast and accurate for direct imports.
- Auto-reindex: `incrementalUpdate()` is the correct path for file watcher integration.
  The actual file watcher integration (fs.watch or chokidar) is NOT part of this task —
  only the `incrementalUpdate()` method needs to be implemented. Watcher integration is
  a future sprint.

---

## KIMI-FRONTIER-03: Predictive Task Decomposition

**File:** `src/orchestrator/predictive-decomposer.ts`
**Target size:** ~250 lines
**Spec:** Grok R13-02

### What to build

Today, JUPITER decomposes every new project description from scratch. It is capable, but
it has no memory: the 200th Next.js SaaS it decomposes gets no benefit from the previous
199. The `PredictiveDecomposer` gives JUPITER a long-term pattern library of successful
decompositions. When a new project arrives, the system finds the most similar past builds,
extracts their task sequences as `TaskTemplate` objects, and hands JUPITER a head start —
"here's how we've successfully decomposed similar projects; use this as a starting point,
not a mandate."

### Core types

```typescript
// src/orchestrator/predictive-decomposer.ts
// Predictive task decomposition using historical build patterns and semantic matching
// Implements Grok R13-02

export interface TaskTemplate {
  id: string;                          // SHA-256 of (projectType + tasks hash)
  name: string;                        // e.g. 'Next.js SaaS with Auth'
  projectType: string;                 // e.g. 'nextjs-saas', 'react-spa', 'node-api'
  description: string;                 // human-readable description of the template
  tasks: TemplateTask[];               // ordered list of tasks in this decomposition
  successCount: number;                // how many times this template led to a successful build
  avgTokensUsed: number;               // average tokens consumed in builds using this template
  createdAt: string;
  lastUsedAt: string;
  embedding?: number[];                // embedding of the description, for similarity matching
}

export interface TemplateTask {
  order: number;                       // 1-indexed position in the sequence
  agentName: AgentName;                // which agent handles this task
  taskType: string;                    // e.g. 'architecture', 'code-generation', 'testing'
  title: string;                       // e.g. 'Design authentication system'
  estimatedComplexity: 'low' | 'medium' | 'high';
  dependsOnOrders: number[];           // which earlier tasks must complete first
}

export interface DecompositionPrediction {
  suggestedTasks: TemplateTask[];
  confidence: number;                  // 0-1: how similar is this to past builds
  basedOn: Array<{
    templateId: string;
    templateName: string;
    similarity: number;
  }>;
  sourceTemplates: TaskTemplate[];     // the full template objects used for prediction
}

export interface BuildRecord {
  buildId: string;
  intent: string;                      // the original project description
  tasks: TemplateTask[];               // the actual tasks executed (post-execution)
  successful: boolean;
  completedAt: string;
  tokensUsed: number;
}
```

### PredictiveDecomposer class

```typescript
class PredictiveDecomposer {
  constructor(options?: {
    templateDir?: string;              // default: '.nova/templates/decomposition'
    embeddingModel?: string;           // default: 'nomic-embed-text'
    minConfidence?: number;            // minimum similarity to use a template (default: 0.60)
    maxTemplatesUsed?: number;         // max templates to blend (default: 3)
  })

  // ---- Prediction ----

  async predictDecomposition(intent: string): Promise<DecompositionPrediction | null>
  // 1. Load all templates from templateDir (call loadTemplates() if not already loaded).
  // 2. If no templates exist: return null (no history to draw from).
  // 3. Embed the intent using getSemanticDedup().embed(intent).
  // 4. Compute cosine similarity between intent embedding and each template's embedding.
  //    Skip templates with no embedding.
  // 5. Sort templates by similarity desc. Take top maxTemplatesUsed above minConfidence.
  // 6. If no templates exceed minConfidence: return null.
  // 7. Blend the top templates into a single DecompositionPrediction:
  //    - Take the task list from the highest-similarity template as the base.
  //    - Confidence = similarity score of the best-matching template.
  //    - basedOn = array of { templateId, templateName, similarity } for all used templates.
  // 8. Return the prediction.

  // ---- Learning loop ----

  async learnFromBuild(record: BuildRecord): Promise<void>
  // Called after each successful build completes.
  // 1. Detect the project type from record.intent using a simple heuristic:
  //    - Contains 'next.js' or 'nextjs' → 'nextjs-saas'
  //    - Contains 'react' and 'spa' or 'app' → 'react-spa'
  //    - Contains 'api' or 'express' or 'fastify' → 'node-api'
  //    - Contains 'cli' → 'cli-tool'
  //    - Otherwise → 'general'
  // 2. Look for an existing template with the same projectType and very similar tasks
  //    (similarity > 0.90 between the intent embeddings).
  //    - If found: increment successCount, update avgTokensUsed, update lastUsedAt.
  //    - If not found: create a new TaskTemplate.
  // 3. Embed the intent and store as template.embedding.
  // 4. Save the template to templateDir.
  // Only learn from successful builds (record.successful === true).

  async extractTemplate(record: BuildRecord): Promise<TaskTemplate>
  // Create a TaskTemplate from a BuildRecord.
  // id = SHA-256 of (record.buildId).slice(0, 16)
  // name = first 60 chars of record.intent
  // description = record.intent
  // tasks = record.tasks
  // successCount = 1
  // avgTokensUsed = record.tokensUsed
  // createdAt = record.completedAt
  // lastUsedAt = record.completedAt

  // ---- Template storage ----

  async saveTemplate(template: TaskTemplate): Promise<void>
  // Write to .nova/templates/decomposition/{template.id}.json
  // Validate with Zod before writing.
  // Create parent directory if needed.

  async loadTemplates(): Promise<TaskTemplate[]>
  // Read all .json files from templateDir.
  // Parse and validate each with Zod.
  // Skip files that fail validation (log a warning, do not throw).
  // Cache in memory for the lifetime of this instance.
  // Return the array.

  async deleteTemplate(templateId: string): Promise<void>
  // Delete .nova/templates/decomposition/{templateId}.json
  // Silently succeed if file does not exist.

  getStats(): { templateCount: number; totalSuccessfulBuilds: number }

  // ---- Singleton factory ----
}

export function getPredictiveDecomposer(): PredictiveDecomposer
export function resetPredictiveDecomposer(): void  // for tests
```

### Zod schemas

```typescript
const TemplateTaskSchema = z.object({
  order: z.number().int().positive(),
  agentName: z.string(),
  taskType: z.string(),
  title: z.string(),
  estimatedComplexity: z.enum(['low', 'medium', 'high']),
  dependsOnOrders: z.array(z.number().int()),
});

const TaskTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  projectType: z.string(),
  description: z.string(),
  tasks: z.array(TemplateTaskSchema),
  successCount: z.number().int().nonneg(),
  avgTokensUsed: z.number().nonneg(),
  createdAt: z.string(),
  lastUsedAt: z.string(),
  embedding: z.array(z.number()).optional(),
});

const BuildRecordSchema = z.object({
  buildId: z.string(),
  intent: z.string(),
  tasks: z.array(TemplateTaskSchema),
  successful: z.boolean(),
  completedAt: z.string(),
  tokensUsed: z.number().nonneg(),
});
```

### Integration with JUPITER

Read `src/orchestrator/task-decomposer.ts` fully before editing. After JUPITER's initial
decomposition, check for a prediction and include it in the prompt context:

```typescript
// In ralph-loop.ts, before calling the task decomposer:
const decomposer = getPredictiveDecomposer();
const prediction = await decomposer.predictDecomposition(intent);

// If prediction is available, include it in the JUPITER prompt as advisory context:
if (prediction && prediction.confidence >= 0.60) {
  const hint = `\n\n## Historical Decomposition Hint (confidence: ${prediction.confidence.toFixed(2)})\n` +
    `Similar past builds used this task structure:\n` +
    prediction.suggestedTasks.map(t => `  ${t.order}. [${t.agentName}] ${t.title}`).join('\n') +
    `\n\nThis is a starting point, not a mandate. Adapt to the specific requirements.`;
  // Append hint to the JUPITER task prompt.
}

// After a successful build, record it for learning:
await decomposer.learnFromBuild({
  buildId,
  intent,
  tasks: completedTasks,
  successful: true,
  completedAt: new Date().toISOString(),
  tokensUsed: totalTokens,
});
```

### Notes

- Templates are persisted per-project root. Different projects accumulate different
  template libraries.
- The "blending" of multiple templates in `predictDecomposition()` is simple in this
  sprint: take the best-matching template's task list as-is. Future sprints can implement
  cross-template task merging.
- `learnFromBuild()` must be called only on successful builds. Partial or failed builds
  produce misleading templates.
- The project type detection heuristic is intentionally simple. A future sprint can use
  an LLM call to classify project type more accurately.

---

## KIMI-FRONTIER-04: Adaptive Agent Personality

**File:** `src/agents/personality-engine.ts`
**Target size:** ~200 lines
**Spec:** Grok R13-04

### What to build

Every agent in Nova26 currently communicates in a fixed style. MARS is always terse and
technical. But a beginner user and a staff engineer require fundamentally different
communication styles. The `PersonalityEngine` adapts each agent's communication style to
each user's observed preferences over time, making the product feel as though every agent
knows who they are talking to. Critically, safety-relevant communications (security
warnings, breaking changes) always override personality settings — no amount of "be brief"
preference will cause a security warning to be omitted.

### Core types

```typescript
// src/agents/personality-engine.ts
// Per-agent adaptive personality system with Taste Vault persistence
// Implements Grok R13-04

export interface PersonalityDimensions {
  verbosity: number;           // 1-10: 1 = one-liners only, 10 = full explanations
  formality: number;           // 1-10: 1 = casual/emoji OK, 10 = formal/professional
  explanationDepth: number;    // 1-10: 1 = skip reasoning, 10 = explain every decision
  technicalDensity: number;    // 1-10: 1 = plain English, 10 = jargon + types
  encouragement: number;       // 1-10: 1 = no praise, 10 = frequent positive reinforcement
}

export interface PersonalityProfile {
  agentName: AgentName;
  dimensions: PersonalityDimensions;
  lastUpdatedAt: string;
  observationCount: number;        // how many interactions have been used to tune this profile
  lockedDimensions?: Array<keyof PersonalityDimensions>;  // dimensions the user has manually set
}

export type PersonalitySignal =
  | 'USER_TRUNCATED_OUTPUT'        // user cut off a long response → reduce verbosity
  | 'USER_ASKED_FOR_MORE_DETAIL'   // user asked "why?" or "explain" → increase depth
  | 'USER_EDITED_FORMALITY_UP'     // user rewrote a casual response more formally
  | 'USER_EDITED_FORMALITY_DOWN'   // user rewrote a formal response more casually
  | 'USER_ASKED_FOR_LESS_JARGON'   // user asked "in plain English?" → reduce technical density
  | 'USER_POSITIVE_REACTION'       // user thumbs-up or praised → increase encouragement
  | 'USER_SKIPPED_ENCOURAGEMENT';  // user dismissed praise → reduce encouragement
```

### PersonalityEngine class

```typescript
class PersonalityEngine {
  // ---- Default personalities per agent ----

  // MARS (implementor): concise + highly technical + low encouragement
  // { verbosity: 3, formality: 6, explanationDepth: 3, technicalDensity: 9, encouragement: 2 }

  // VENUS (UI/UX): warm + visual + moderate explanation
  // { verbosity: 6, formality: 5, explanationDepth: 6, technicalDensity: 5, encouragement: 8 }

  // JUPITER (planner): detailed + strategic + formal
  // { verbosity: 8, formality: 8, explanationDepth: 9, technicalDensity: 6, encouragement: 4 }

  // PLUTO (tester): precise + technical + neutral encouragement
  // { verbosity: 5, formality: 7, explanationDepth: 7, technicalDensity: 8, encouragement: 3 }

  // All other agents: balanced defaults
  // { verbosity: 5, formality: 6, explanationDepth: 5, technicalDensity: 6, encouragement: 5 }

  getDefaultProfile(agentName: AgentName): PersonalityProfile
  // Return the default PersonalityProfile for the given agent.
  // observationCount = 0, lastUpdatedAt = now, lockedDimensions = [].

  // ---- Profile management ----

  async loadProfile(agentName: AgentName): Promise<PersonalityProfile>
  // Read from .nova/personalities/{agentName}.json.
  // Validate with Zod.
  // If file does not exist or is invalid: return getDefaultProfile(agentName).
  // Cache in memory for this instance.

  async saveProfile(profile: PersonalityProfile): Promise<void>
  // Write to .nova/personalities/{agentName}.json.
  // Create parent directory if needed.
  // Validate with Zod before writing.

  // ---- Learning from signals ----

  async applySignal(agentName: AgentName, signal: PersonalitySignal): Promise<PersonalityProfile>
  // Load the current profile for agentName.
  // Apply the signal as a dimension nudge (see adjustment table below).
  // Skip adjustment for any dimension in profile.lockedDimensions.
  // Clamp all dimensions to [1, 10] after adjustment.
  // Increment observationCount. Update lastUpdatedAt.
  // Save the updated profile.
  // Return the updated profile.
  //
  // Adjustment table (delta applied to dimension):
  //   USER_TRUNCATED_OUTPUT:        verbosity -= 1
  //   USER_ASKED_FOR_MORE_DETAIL:   explanationDepth += 1, verbosity += 1
  //   USER_EDITED_FORMALITY_UP:     formality += 1
  //   USER_EDITED_FORMALITY_DOWN:   formality -= 1
  //   USER_ASKED_FOR_LESS_JARGON:   technicalDensity -= 2
  //   USER_POSITIVE_REACTION:       encouragement += 1
  //   USER_SKIPPED_ENCOURAGEMENT:   encouragement -= 2

  async resetToDefaults(agentName: AgentName): Promise<PersonalityProfile>
  // Reset to getDefaultProfile(agentName) and save.
  // Return the reset profile.

  // ---- Prompt injection ----

  async buildPersonalityInstructions(agentName: AgentName): Promise<string>
  // Load the current profile for agentName.
  // Produce a personality instruction block for injection into the agent's system prompt.
  // Format (adapt based on dimension values):
  //
  //   ## Communication Style
  //   Verbosity: {descriptor}. {instruction}
  //   Formality: {descriptor}. {instruction}
  //   Explanation depth: {descriptor}. {instruction}
  //   Technical density: {descriptor}. {instruction}
  //   Encouragement: {descriptor}. {instruction}
  //
  //   SAFETY OVERRIDE: Always communicate security warnings, data loss risks, and
  //   breaking changes with full detail regardless of the above style settings.
  //
  // Descriptor/instruction mappings (examples):
  //   verbosity <= 3:  "Terse. Keep responses short — use bullet points, skip preamble."
  //   verbosity 4-6:  "Moderate. Balance detail with brevity."
  //   verbosity >= 7:  "Verbose. Provide thorough explanations and context."
  //   technicalDensity <= 3: "Plain. Use simple language; avoid jargon and type annotations in prose."
  //   technicalDensity >= 8: "Dense. Use precise technical language, types, and implementation details."
  //   encouragement >= 8: "Encouraging. Acknowledge good decisions; celebrate progress."
  //   encouragement <= 2: "Neutral. Skip praise and motivational language."
  //   (define the full mapping set; cover all 5 dimensions with 3 tiers each)

  // ---- Safety override (always injected regardless of personality) ----

  isSafetyContent(text: string): boolean
  // Returns true if text contains any of these patterns (case-insensitive):
  //   'security', 'vulnerability', 'breaking change', 'data loss', 'deprecated',
  //   'critical', 'warning', 'danger', 'unsafe', 'exploit'
  // Safety content must always be communicated with full detail.
  // The personality instructions include the safety override reminder; this method
  // is available for callers who want to explicitly check before applying truncation.

  getAllProfiles(): Promise<PersonalityProfile[]>
  // Load profiles for all 17 standard agents.
  // Return the array.

  // ---- Singleton factory ----
}

export function getPersonalityEngine(): PersonalityEngine
export function resetPersonalityEngine(): void  // for tests
```

### Zod schemas

```typescript
const PersonalityDimensionsSchema = z.object({
  verbosity: z.number().int().min(1).max(10),
  formality: z.number().int().min(1).max(10),
  explanationDepth: z.number().int().min(1).max(10),
  technicalDensity: z.number().int().min(1).max(10),
  encouragement: z.number().int().min(1).max(10),
});

const PersonalityProfileSchema = z.object({
  agentName: z.string(),
  dimensions: PersonalityDimensionsSchema,
  lastUpdatedAt: z.string(),
  observationCount: z.number().int().nonneg(),
  lockedDimensions: z.array(z.string()).optional(),
});
```

### Integration with prompt-builder.ts

Read `src/orchestrator/prompt-builder.ts` fully before editing. Inject personality
instructions as the final section of the system prompt, after all other context:

```typescript
// In prompt-builder.ts, at the end of the system prompt assembly:
const personalityEngine = getPersonalityEngine();
const personalityInstructions = await personalityEngine.buildPersonalityInstructions(
  agentName as AgentName
);
// Append personalityInstructions to the system prompt.
// This ensures personality is the last instruction the model sees before the task,
// making it the most contextually proximate style guidance.
```

### Notes

- Personality profiles are stored in `.nova/personalities/` — one file per agent.
- Profiles persist across builds and sessions. Users accumulate preferences over time.
- The `lockedDimensions` feature allows users to pin specific dimensions (e.g., always
  formal) while allowing the system to learn other dimensions. Locked dimensions are never
  adjusted by signals.
- The safety override is non-negotiable. The personality instruction block always includes
  the override statement. No signal can reduce it. This is a product safety guarantee.
- `isSafetyContent()` is provided for callers but is not enforced in this class beyond
  the instruction injection. Enforcement is the agent's responsibility (it receives the
  instructions in its prompt).

---

## KIMI-FRONTIER-05: Offline-First Engine

**File:** `src/sync/offline-engine.ts`
**Target size:** ~300 lines
**Spec:** Grok R13-05

### What to build

A $299/month professional tool that stops working when the user's coffee shop WiFi drops
is not a professional tool. The `OfflineEngine` ensures that Nova26's core agent loop,
vault operations, and build history work completely offline — network connectivity is
an enhancement (Global Wisdom sync, docs fetching), not a requirement. When the user
reconnects, all buffered mutations flush to Convex automatically with deterministic
conflict resolution.

### Core types

```typescript
// src/sync/offline-engine.ts
// Offline-first storage and sync engine using SQLite and Convex mutation buffering
// Implements Grok R13-05

export type SyncStatus = 'online' | 'offline' | 'syncing' | 'error';

export interface SyncQueueEntry {
  id: string;                          // crypto.randomUUID()
  mutationPath: string;                // e.g. 'atlas:logTask'
  args: Record<string, unknown>;
  enqueuedAt: string;
  attemptCount: number;
  lastAttemptAt?: string;
  status: 'pending' | 'retrying' | 'failed' | 'synced';
  errorMessage?: string;
}

export interface ConflictResolution {
  entityType: 'user-content' | 'tags-metadata' | 'computed-fields';
  strategy: 'local-wins' | 'union-merge' | 'server-wins';
  description: string;
}

export interface ConnectivityState {
  status: SyncStatus;
  lastCheckedAt: string;
  lastOnlineAt?: string;
  pendingMutations: number;
  failedMutations: number;
}

// Feature availability matrix
export interface FeatureAvailability {
  feature: string;
  requiresConnectivity: boolean;
  availableOffline: boolean;
  degradedMessage?: string;            // message shown when offline but feature partially works
}
```

### OfflineEngine class

```typescript
class OfflineEngine {
  constructor(options?: {
    dbPath?: string;                   // default: '.nova/offline.db'
    convexUrl?: string;                // default: process.env.CONVEX_URL
    convexToken?: string;              // default: process.env.CONVEX_TOKEN
    connectivityCheckUrl?: string;     // default: 'https://1.1.1.1' (Cloudflare DNS)
    checkIntervalMs?: number;          // default: 30_000 (check every 30s)
    maxRetryAttempts?: number;         // default: 5
  })

  // ---- Connectivity detection ----

  async checkConnectivity(): Promise<boolean>
  // Attempt a HEAD request to connectivityCheckUrl with a 3s timeout.
  // Return true if response is 2xx or 3xx. Return false on timeout or network error.
  // Update internal status state.
  // If transitioning from offline → online: emit 'connected' event and trigger flush.

  getConnectivityState(): ConnectivityState
  // Return the current connectivity state with counts from the sync queue.

  startMonitoring(): void
  // Begin periodic connectivity checks at checkIntervalMs interval.
  // Safe to call multiple times (idempotent — only one interval runs at a time).

  stopMonitoring(): void
  // Stop the periodic connectivity check interval.

  on(event: 'connected' | 'disconnected' | 'sync-complete' | 'sync-error', handler: () => void): () => void
  // Register an event handler. Return an unsubscribe function.

  // ---- Offline store (SQLite) ----

  async initStore(): Promise<void>
  // Initialize the SQLite database at dbPath.
  // Create tables if they don't exist:
  //
  //   CREATE TABLE IF NOT EXISTS kv_store (
  //     namespace TEXT NOT NULL,
  //     key TEXT NOT NULL,
  //     value TEXT NOT NULL,   -- JSON-serialized
  //     updated_at TEXT NOT NULL,
  //     PRIMARY KEY (namespace, key)
  //   );
  //
  //   CREATE TABLE IF NOT EXISTS sync_queue (
  //     id TEXT PRIMARY KEY,
  //     mutation_path TEXT NOT NULL,
  //     args TEXT NOT NULL,          -- JSON-serialized
  //     enqueued_at TEXT NOT NULL,
  //     attempt_count INTEGER NOT NULL DEFAULT 0,
  //     last_attempt_at TEXT,
  //     status TEXT NOT NULL DEFAULT 'pending',
  //     error_message TEXT
  //   );
  //
  // Use better-sqlite3 (synchronous API). Create parent directory if needed.

  storeLocal(namespace: string, key: string, value: unknown): void
  // Upsert into kv_store: (namespace, key, JSON.stringify(value), now).
  // Synchronous (better-sqlite3).

  loadLocal(namespace: string, key: string): unknown | null
  // SELECT value FROM kv_store WHERE namespace = ? AND key = ?
  // Parse JSON and return. Return null if not found.

  loadAllLocal(namespace: string): Array<{ key: string; value: unknown }>
  // SELECT key, value FROM kv_store WHERE namespace = ?
  // Return array of parsed entries.

  deleteLocal(namespace: string, key: string): void
  // DELETE FROM kv_store WHERE namespace = ? AND key = ?

  // ---- Sync queue ----

  enqueue(mutationPath: string, args: Record<string, unknown>): SyncQueueEntry
  // Insert a new SyncQueueEntry into the sync_queue table.
  // status = 'pending', attemptCount = 0.
  // Return the entry.
  // If currently online: attempt immediate flush (non-blocking, fire-and-forget).

  async flush(): Promise<{ succeeded: number; failed: number; skipped: number }>
  // Process all 'pending' and 'retrying' entries in sync_queue.
  // For each entry:
  //   POST to ${convexUrl}/api/mutation with { path: entry.mutationPath, args: entry.args }
  //   Authorization: Bearer ${convexToken} if token available.
  //   On success (2xx): mark status = 'synced'.
  //   On failure: increment attemptCount, set status = 'retrying', set lastAttemptAt = now.
  //     If attemptCount >= maxRetryAttempts: set status = 'failed', set errorMessage.
  //     If status becomes 'failed': emit 'sync-error' event.
  // Return { succeeded, failed, skipped } where skipped = entries with status 'failed'.
  // Emit 'sync-complete' after all entries are processed.

  getPendingCount(): number
  // Count sync_queue entries where status IN ('pending', 'retrying').

  getFailedCount(): number
  // Count sync_queue entries where status = 'failed'.

  clearSynced(): void
  // DELETE FROM sync_queue WHERE status = 'synced'.
  // Call this periodically (e.g., hourly) to keep the queue table small.

  // ---- Conflict resolution ----

  readonly conflictStrategies: ConflictResolution[]
  // Fixed set of three strategies:
  //   { entityType: 'user-content',     strategy: 'local-wins',    description: 'User-authored content (notes, vault edits, playbooks): local version always wins.' }
  //   { entityType: 'tags-metadata',    strategy: 'union-merge',   description: 'Tags and metadata: merge local and server sets (union of both).' }
  //   { entityType: 'computed-fields',  strategy: 'server-wins',   description: 'Computed fields (scores, counts, aggregates): server version wins.' }

  resolveConflict<T extends Record<string, unknown>>(
    entityType: ConflictResolution['entityType'],
    local: T,
    server: T
  ): T
  // Apply the resolution strategy for the given entityType:
  //   'local-wins':   return local
  //   'server-wins':  return server
  //   'union-merge':  merge both objects:
  //     - For array fields: return Array.from(new Set([...local[k], ...server[k]])) for all array fields.
  //     - For string/number fields: prefer local value.
  //     - For fields only in server: include them.
  //     - For fields only in local: include them.

  // ---- Feature availability matrix ----

  readonly featureMatrix: FeatureAvailability[]
  // Hardcoded matrix:
  //   { feature: 'agent-loop',           requiresConnectivity: false, availableOffline: true }
  //   { feature: 'taste-vault-read',     requiresConnectivity: false, availableOffline: true }
  //   { feature: 'taste-vault-write',    requiresConnectivity: false, availableOffline: true,
  //     degradedMessage: 'Changes will sync to Global Wisdom when reconnected.' }
  //   { feature: 'global-wisdom-sync',   requiresConnectivity: true,  availableOffline: false,
  //     degradedMessage: 'Global Wisdom sync requires connectivity. Using local vault only.' }
  //   { feature: 'docs-fetcher',         requiresConnectivity: true,  availableOffline: false,
  //     degradedMessage: 'Documentation fetching requires connectivity.' }
  //   { feature: 'convex-analytics',     requiresConnectivity: true,  availableOffline: false,
  //     degradedMessage: 'Build analytics will sync when reconnected.' }
  //   { feature: 'semantic-search',      requiresConnectivity: false, availableOffline: true,
  //     degradedMessage: 'Search uses local index only.' }

  isAvailable(feature: string): boolean
  // Return true if feature is availableOffline OR if currently online.
  // Return false if feature requiresConnectivity AND currently offline.

  getUnavailableMessage(feature: string): string | null
  // Return the degradedMessage for the feature if it is currently unavailable.
  // Return null if feature is available.

  // ---- Lifecycle ----

  async close(): Promise<void>
  // Close the SQLite connection. Stop monitoring.
  // Safe to call multiple times.

  // ---- Singleton factory ----
}

export function getOfflineEngine(): OfflineEngine
export function resetOfflineEngine(): void  // for tests
```

### Zod schemas

```typescript
const SyncQueueEntrySchema = z.object({
  id: z.string(),
  mutationPath: z.string(),
  args: z.record(z.unknown()),
  enqueuedAt: z.string(),
  attemptCount: z.number().int().nonneg(),
  lastAttemptAt: z.string().optional(),
  status: z.enum(['pending', 'retrying', 'failed', 'synced']),
  errorMessage: z.string().optional(),
});
```

### Integration with existing Convex calls

Read `src/orchestrator/atlas-convex.ts` (or equivalent Convex call site) before editing.
Wrap all Convex mutations with the offline engine:

```typescript
// Instead of calling Convex directly:
//   await convexClient.mutation('atlas:logTask', args)

// Use the offline engine:
const offline = getOfflineEngine();
if (offline.isAvailable('convex-analytics')) {
  // Online: flush any queued mutations, then call directly
  await offline.flush();
  // ... direct Convex call ...
} else {
  // Offline: queue the mutation for later
  offline.enqueue('atlas:logTask', args);
  console.log(offline.getUnavailableMessage('convex-analytics') ?? 'Offline — mutation queued.');
}
```

### Notes

- `better-sqlite3` is a synchronous SQLite library already listed as available. Read its
  API before implementing: all calls are synchronous (no async/await needed for DB ops).
  The `initStore()` method is still async to allow future migration to an async driver.
- The `checkConnectivity()` method uses a HEAD request to Cloudflare's DNS resolver
  (`https://1.1.1.1`). This is a lightweight, reliable target that does not log requests.
  In environments where this URL is blocked, the user can override via `connectivityCheckUrl`.
- Conflict resolution is intentionally simple: three strategies, deterministic rules.
  There is no interactive conflict UI in this sprint. A future sprint can add a visual
  conflict resolver.
- `startMonitoring()` is called at Nova26 startup in `ralph-loop.ts`. Read ralph-loop.ts
  before adding the call to ensure it goes in the right place (after initialization, before
  the first task loop iteration).
- The offline store (`kv_store` table) is a general-purpose key-value store. Namespaces
  currently in use: `'vault'` (vault snapshots), `'playbooks'` (ACE playbooks),
  `'patterns'` (BistroLens patterns), `'events'` (build event history).

---

## KIMI-FRONTIER-06: Tests

**Files:**
- `src/agents/message-bus.test.ts` — ~20 tests
- `src/tools/semantic-search.test.ts` — ~25 tests
- `src/orchestrator/predictive-decomposer.test.ts` — ~20 tests
- `src/agents/personality-engine.test.ts` — ~15 tests
- `src/sync/offline-engine.test.ts` — ~20 tests

**Target:** 100+ new tests. All must pass. Existing 1445 tests must still pass.

### message-bus.test.ts (~20 tests)

Call `resetAgentMessageBus()` and `resetNegotiationProtocol()` in `beforeEach`.
Use `vi.useFakeTimers()` for timestamp-sensitive tests.

Cover:

- `send()` delivers a message to a registered handler
- `send()` assigns a unique id and sentAt timestamp
- `send()` BROADCAST delivers to all registered handlers
- `send()` directed message only delivers to the named recipient, not others
- `subscribe()` returns an unsubscribe function that removes the handler
- calling the unsubscribe function stops message delivery
- `getThread()` returns root message + all reply messages in chronological order
- `getThread()` returns only the root if no replies exist
- `getInbox()` returns messages for the specified agent, newest first
- `getInbox()` with taskId filter returns only messages for that task
- `markRead()` sets readAt on the message
- `getUnread()` returns only messages where readAt is undefined
- `clearTask()` removes all messages for the given taskId
- `NegotiationProtocol.openNegotiation()` creates a session with status 'open' and sends a PROPOSE message
- `NegotiationProtocol.respondToNegotiation()` sets respondentPosition and sends a COUNTER message
- `NegotiationProtocol.resolve()` sets status 'agreed' and sends an AGREE message
- `NegotiationProtocol.escalate()` sets status 'escalated' and sends an ESCALATE to JUPITER
- `NegotiationProtocol.getOpenNegotiations()` returns only open sessions for the taskId
- `NegotiationProtocol.shouldTriggerNegotiation()` returns true when confidence < 0.65 and peer has expertise
- `NegotiationProtocol.shouldTriggerNegotiation()` returns false when confidence >= 0.65
- `SharedBlackboard.write()` stores an entry and returns it with id and writtenAt set
- `SharedBlackboard.read()` returns the most recent entry for key+taskId
- `SharedBlackboard.read()` returns null when no entry exists
- `SharedBlackboard.readAll()` returns all entries for a taskId sorted by confidence
- `SharedBlackboard.readAll()` with tags filter returns only matching entries
- `SharedBlackboard.supersede()` creates a new entry linking back to the old one
- `SharedBlackboard.snapshot()` returns a map of key → entry for the taskId
- `SharedBlackboard.clear()` removes all entries for the taskId
- `SharedBlackboard.formatForPrompt()` produces a formatted string with HIGH/MEDIUM/LOW tiers
- `SharedBlackboard.formatForPrompt()` truncates to approximately maxTokens

### semantic-search.test.ts (~25 tests)

Mock `getSemanticDedup().embed()` to return deterministic fixed vectors.
Use `vi.stubGlobal` or `vi.mock` for the SemanticDedup singleton.
Use a temporary directory for the index persistence tests.
Call `resetCodeIndex()` in `beforeEach`.

Cover:

- `parseFile()` extracts FunctionDeclaration units with correct name and kind
- `parseFile()` extracts ClassDeclaration units
- `parseFile()` extracts InterfaceDeclaration units
- `parseFile()` extracts TypeAliasDeclaration units
- `parseFile()` extracts MethodDeclaration units from a class
- `parseFile()` skips anonymous functions
- `parseFile()` skips .d.ts files
- `parseFile()` extracts JSDoc comments as docstrings
- `parseFile()` sets correct startLine and endLine for each unit
- `embedUnit()` calls getSemanticDedup().embed() with the composed text
- `embedUnit()` sets the embedding on the unit and returns it
- `query()` returns empty array when index has no units with embeddings
- `query()` returns results sorted by cosine similarity descending
- `query()` maps score >= 0.75 to relevance 'high'
- `query()` maps score 0.55-0.74 to relevance 'medium'
- `query()` maps score < 0.55 to relevance 'low'
- `query()` respects topK limit
- `analyzeImpact()` returns empty affectedFiles when no imports exist
- `analyzeImpact()` correctly identifies files that import from the target file
- `analyzeImpact()` computes impactRadius 'contained' for ≤ 3 affected files
- `analyzeImpact()` computes impactRadius 'moderate' for 4-10 affected files
- `analyzeImpact()` computes impactRadius 'widespread' for > 10 affected files
- `saveIndex()` writes a valid JSON file to the index path
- `loadIndex()` reads and restores units from a previously saved index
- `loadIndex()` returns false when no index file exists
- `incrementalUpdate()` removes old units for the changed file and adds new ones

### predictive-decomposer.test.ts (~20 tests)

Mock `getSemanticDedup().embed()` to return deterministic vectors.
Use a temporary directory for template storage.
Call `resetPredictiveDecomposer()` in `beforeEach`.

Cover:

- `predictDecomposition()` returns null when no templates exist
- `predictDecomposition()` returns null when no templates exceed minConfidence
- `predictDecomposition()` returns a prediction when a similar template exists
- `predictDecomposition()` prediction.confidence matches the best-matching template's similarity
- `predictDecomposition()` prediction.basedOn lists all templates used
- `predictDecomposition()` suggestedTasks comes from the best-matching template
- `learnFromBuild()` creates a new template for an unrecognized project type
- `learnFromBuild()` increments successCount when an existing template is matched
- `learnFromBuild()` does NOT learn from unsuccessful builds
- `learnFromBuild()` detects 'nextjs-saas' project type from intent containing 'next.js'
- `learnFromBuild()` detects 'node-api' project type from intent containing 'api'
- `learnFromBuild()` falls back to 'general' project type for unrecognized intent
- `extractTemplate()` creates a template with correct fields from a BuildRecord
- `saveTemplate()` writes a JSON file to the template directory
- `loadTemplates()` reads and returns all valid templates from the directory
- `loadTemplates()` skips files that fail Zod validation (no throw)
- `deleteTemplate()` removes the template file
- `deleteTemplate()` succeeds silently when file does not exist
- `getStats()` returns correct templateCount and totalSuccessfulBuilds
- `getPredictiveDecomposer()` returns the same singleton on multiple calls

### personality-engine.test.ts (~15 tests)

Use a temporary directory for personality profile storage.
Call `resetPersonalityEngine()` in `beforeEach`.

Cover:

- `getDefaultProfile('MARS')` returns verbosity=3 and technicalDensity=9
- `getDefaultProfile('VENUS')` returns encouragement=8 and verbosity=6
- `getDefaultProfile('JUPITER')` returns verbosity=8 and explanationDepth=9
- `getDefaultProfile()` for unknown agents returns balanced defaults (all dimensions = 5 or 6)
- `loadProfile()` returns the default profile when no file exists
- `saveProfile()` + `loadProfile()` round-trip: returns the saved profile
- `applySignal('USER_TRUNCATED_OUTPUT')` decreases verbosity by 1
- `applySignal('USER_ASKED_FOR_MORE_DETAIL')` increases explanationDepth by 1
- `applySignal('USER_ASKED_FOR_LESS_JARGON')` decreases technicalDensity by 2
- `applySignal()` clamps dimensions to [1, 10] (no value goes below 1 or above 10)
- `applySignal()` does not adjust locked dimensions
- `applySignal()` increments observationCount
- `buildPersonalityInstructions()` returns a string containing "Communication Style"
- `buildPersonalityInstructions()` always includes the SAFETY OVERRIDE clause
- `isSafetyContent()` returns true for text containing 'security'
- `isSafetyContent()` returns true for text containing 'breaking change'
- `isSafetyContent()` returns false for neutral technical text

### offline-engine.test.ts (~20 tests)

Use `vi.stubGlobal('fetch', ...)` to mock connectivity checks and Convex calls.
Use a temporary directory for the SQLite database.
Call `resetOfflineEngine()` in `beforeEach`.

Cover:

- `checkConnectivity()` returns true when fetch succeeds with 200
- `checkConnectivity()` returns false when fetch throws (network error)
- `checkConnectivity()` returns false when fetch times out
- `initStore()` creates the SQLite database and both tables
- `initStore()` is idempotent (calling twice does not throw)
- `storeLocal()` + `loadLocal()` round-trip: returns the stored value
- `storeLocal()` upserts (calling twice with same key overwrites)
- `loadLocal()` returns null for non-existent key
- `loadAllLocal()` returns all entries for the given namespace
- `deleteLocal()` removes the entry
- `enqueue()` adds an entry to the sync_queue with status 'pending'
- `flush()` POSTs each pending entry to the Convex URL
- `flush()` marks entries as 'synced' on success
- `flush()` increments attemptCount on failure
- `flush()` marks entries as 'failed' after maxRetryAttempts
- `flush()` returns correct { succeeded, failed, skipped } counts
- `getPendingCount()` counts only 'pending' and 'retrying' entries
- `getFailedCount()` counts only 'failed' entries
- `clearSynced()` removes 'synced' entries from the queue
- `resolveConflict('local-wins')` returns the local object
- `resolveConflict('server-wins')` returns the server object
- `resolveConflict('union-merge')` merges array fields as a union set
- `isAvailable()` returns true for agent-loop regardless of connectivity state
- `isAvailable()` returns false for global-wisdom-sync when offline
- `getUnavailableMessage()` returns the degradedMessage when feature is unavailable
- `getUnavailableMessage()` returns null when feature is available

---

## File Structure to Create

```
src/
  agents/
    message-bus.ts                    (KIMI-FRONTIER-01)
    blackboard.ts                     (KIMI-FRONTIER-01)
    personality-engine.ts             (KIMI-FRONTIER-04)
    message-bus.test.ts               (KIMI-FRONTIER-06)
    personality-engine.test.ts        (KIMI-FRONTIER-06)
  tools/
    semantic-search.ts                (KIMI-FRONTIER-02)
    semantic-search.test.ts           (KIMI-FRONTIER-06)
    core-tools.ts                     (KIMI-FRONTIER-01 + 02, add new tools)
  orchestrator/
    predictive-decomposer.ts          (KIMI-FRONTIER-03)
    predictive-decomposer.test.ts     (KIMI-FRONTIER-06)
    ralph-loop.ts                     (KIMI-FRONTIER-01 + 03 + 05, integration additions)
    prompt-builder.ts                 (KIMI-FRONTIER-01 + 04, blackboard + personality injection)
  sync/
    offline-engine.ts                 (KIMI-FRONTIER-05)
    offline-engine.test.ts            (KIMI-FRONTIER-06)
  agent-loop/
    agent-loop.ts                     (KIMI-FRONTIER-01, message check after turns)
.nova/
  code-index/                         (created at runtime by CodeIndex)
  templates/
    decomposition/                    (created at runtime by PredictiveDecomposer)
  personalities/                      (created at runtime by PersonalityEngine)
  offline.db                          (created at runtime by OfflineEngine)
```

---

## Verification Checklist

After all six tasks are complete, run:

```bash
# TypeScript: must be 0 errors
npx tsc --noEmit

# Tests: must be 1445 + 100+ new passing, 0 failing
npx vitest run

# Spot-check: message bus
node --input-type=module << 'EOF'
import { getAgentMessageBus } from './src/agents/message-bus.js';
import { getSharedBlackboard } from './src/agents/blackboard.js';
const bus = getAgentMessageBus();
const received = [];
bus.subscribe('VENUS', async (msg) => { received.push(msg); });
const sent = await bus.send({
  type: 'SHARE_FINDING',
  from: 'MARS',
  to: 'VENUS',
  subject: 'auth approach decided',
  body: 'Using JWT with httpOnly cookies.',
  taskId: 'task-001',
  priority: 'medium',
  requiresResponse: false,
});
console.log('Message sent:', sent.id, '| Delivered to VENUS:', received.length === 1);
const bb = getSharedBlackboard();
bb.write('auth-approach', 'JWT + httpOnly cookies', 'MARS', 'task-001', { confidence: 0.95, tags: ['auth', 'security'] });
const entry = bb.read('auth-approach', 'task-001');
console.log('Blackboard entry:', entry?.value, '| Confidence:', entry?.confidence);
const formatted = bb.formatForPrompt('task-001');
console.log('Prompt format starts with:', formatted.slice(0, 60));
EOF

# Spot-check: semantic search
node --input-type=module << 'EOF'
import { getCodeIndex } from './src/tools/semantic-search.js';
const index = getCodeIndex({ projectRoot: process.cwd() });
const stats = index.getStats();
console.log('Index stats (empty):', JSON.stringify(stats));
// Note: full buildIndex() requires Ollama running with nomic-embed-text
// Verify parseFile() on a known file:
const units = await index.parseFile('./src/tools/tool-registry.ts');
console.log('Parsed units from tool-registry.ts:', units.length, 'units');
console.log('First unit:', units[0]?.name, '|', units[0]?.kind);
EOF

# Spot-check: predictive decomposer
node --input-type=module << 'EOF'
import { getPredictiveDecomposer } from './src/orchestrator/predictive-decomposer.js';
const decomposer = getPredictiveDecomposer();
const prediction = await decomposer.predictDecomposition('Build a Next.js SaaS with authentication');
console.log('Prediction (no templates):', prediction === null ? 'null (expected)' : 'has prediction');
const stats = decomposer.getStats();
console.log('Decomposer stats:', JSON.stringify(stats));
EOF

# Spot-check: personality engine
node --input-type=module << 'EOF'
import { getPersonalityEngine } from './src/agents/personality-engine.js';
const engine = getPersonalityEngine();
const marsDefault = engine.getDefaultProfile('MARS');
console.log('MARS default verbosity (should be 3):', marsDefault.dimensions.verbosity);
console.log('MARS default technicalDensity (should be 9):', marsDefault.dimensions.technicalDensity);
const venusDefault = engine.getDefaultProfile('VENUS');
console.log('VENUS default encouragement (should be 8):', venusDefault.dimensions.encouragement);
const instructions = await engine.buildPersonalityInstructions('MARS');
console.log('Instructions contain SAFETY OVERRIDE:', instructions.includes('SAFETY OVERRIDE'));
console.log('isSafetyContent("security warning"):', engine.isSafetyContent('security warning'));
EOF

# Spot-check: offline engine
node --input-type=module << 'EOF'
import { getOfflineEngine } from './src/sync/offline-engine.js';
import { mkdirSync } from 'fs';
mkdirSync('/tmp/nova26-offline-test', { recursive: true });
const engine = getOfflineEngine({ dbPath: '/tmp/nova26-offline-test/offline.db' });
await engine.initStore();
engine.storeLocal('vault', 'test-key', { content: 'hello', confidence: 0.9 });
const loaded = engine.loadLocal('vault', 'test-key');
console.log('Offline store round-trip:', JSON.stringify(loaded));
const entry = engine.enqueue('atlas:logTask', { taskId: 'task-001', status: 'completed' });
console.log('Enqueued mutation:', entry.status, '| Pending:', engine.getPendingCount());
const resolved = engine.resolveConflict('local-wins', { value: 'local' }, { value: 'server' });
console.log('Conflict resolution (local-wins):', resolved.value);
const available = engine.isAvailable('agent-loop');
console.log('agent-loop available offline:', available);
await engine.close();
EOF
```

---

## Commit Order

Commit after each task so main stays green:

1. `feat(frontier): KIMI-FRONTIER-01 agent-to-agent communication — message bus, blackboard, negotiation protocol`
2. `feat(frontier): KIMI-FRONTIER-02 semantic code search — TypeScript AST indexing, embedding, impact analysis`
3. `feat(frontier): KIMI-FRONTIER-03 predictive task decomposition — template learning, similarity matching, JUPITER integration`
4. `feat(frontier): KIMI-FRONTIER-04 adaptive agent personality — 5-dimension profiles, signal learning, prompt injection`
5. `feat(frontier): KIMI-FRONTIER-05 offline-first engine — SQLite store, sync queue, conflict resolution, connectivity detection`
6. `feat(frontier): KIMI-FRONTIER-06 100+ tests for message bus, semantic search, decomposer, personality, offline engine`

Each commit must pass `npx tsc --noEmit` and `npx vitest run` before being committed.

---

## Key Design Decisions (do not deviate without flagging)

1. **Message bus is in-memory only for this sprint.** The `AgentMessageBus` uses an
   in-memory Map. There is no persistence and no Convex integration in this sprint. A
   future `ConvexMessageBusAdapter` can be swapped in behind the same interface. The
   current implementation is correct for single-machine builds, which is the 99% case.

2. **Blackboard is ephemeral — it is NOT the Taste Vault.** The blackboard is wiped at
   the end of each task. Agents that want to persist a finding across builds must explicitly
   write it to the Taste Vault. The blackboard is the whiteboard on the wall; the vault is
   the team wiki.

3. **Negotiation auto-trigger is a soft flag, not a forced behavior.** When
   `shouldTriggerNegotiation()` returns true, the AgentLoop sets a flag that the next turn
   prompt can act on. The agent decides whether to initiate communication. Forcing agents
   to seek help automatically could cause infinite help-request loops.

4. **CodeIndex uses the TypeScript Compiler API directly, not ts-morph or other wrappers.**
   `typescript` is already installed. Using it directly avoids an additional dependency.
   The AST walking code will be verbose but explicit. This is intentional — less magic,
   easier to debug when a new TypeScript syntax variant causes parsing issues.

5. **Semantic search uses cosine similarity with nomic-embed-text.** This reuses the
   exact same embedding infrastructure as SemanticDedup (`getSemanticDedup().embed()`).
   The embedding model, key format, and infrastructure are shared. This avoids a second
   embedding pipeline and keeps the vector space consistent for cross-feature comparisons.

6. **PredictiveDecomposer blends templates by taking the best-matching one as-is.**
   Multi-template blending (taking task 1-3 from template A and task 4-6 from template B)
   is explicitly deferred to a future sprint. The current approach is simpler and safer —
   a single coherent template is less likely to produce contradictory task sequences than
   a naive blend.

7. **Personality dimensions are integers 1-10, not floats.** This simplifies the prompt
   injection logic (three tiers per dimension: low/medium/high) and avoids floating-point
   drift from repeated signal applications. When `applySignal()` adds 1 to verbosity=3.7,
   the result would be 4.7 — unclear which tier applies. Integer stepping avoids this.

8. **Safety override is always present in personality instructions.** The override clause
   is hardcoded at the end of every `buildPersonalityInstructions()` output, regardless of
   any dimension values. No personality configuration can suppress it. This is a
   non-negotiable product safety property.

9. **OfflineEngine uses better-sqlite3 (synchronous).** The async API in `initStore()` is
   a design affordance for future migration to an async SQLite driver. All current
   operations are synchronous. This is intentional: synchronous SQLite is dramatically
   simpler to reason about in a single-threaded Node.js process, and performance is not
   a concern for the queue sizes involved (hundreds of entries, not millions).

10. **Conflict resolution strategies are deterministic and never interactive.** The three
    strategies (local-wins, union-merge, server-wins) are assigned by entity type, not by
    inspection of individual field values. There is no LLM call in conflict resolution.
    Deterministic rules are essential here — a conflict resolver that occasionally makes
    different decisions for identical inputs would be a data integrity liability.

11. **`clearTask()` on the bus and `clear()` on the blackboard are caller responsibilities.**
    The AgentLoop and ralph-loop.ts are responsible for calling these cleanup methods after
    each task completes. Neither the bus nor the blackboard auto-evict entries. This is
    intentional — the caller knows when a task is definitively complete; the bus and
    blackboard should not guess.

12. **All new src/agents/ files use the same singleton factory pattern as existing modules.**
    `class Foo` is not exported directly. Only `getFoo()` and `resetFoo()` are exported.
    This makes test isolation trivial: `resetFoo()` in `beforeEach` guarantees a clean
    instance for every test. Never deviate from this pattern in Nova26 modules.
