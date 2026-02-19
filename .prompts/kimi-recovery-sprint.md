# KIMI-RECOVERY Sprint: Advanced Error Recovery (R17-01)

> Assigned to: Kimi
> Sprint: R17-01 Advanced Error Recovery
> Date issued: 2026-02-19
> Prerequisite: ~2081 tests passing, 0 TS errors

## Project Context

Nova26 is a 21-agent AI-powered IDE built with TypeScript, Ollama (local LLM), Convex, and vitest. Agents are named after celestial bodies: MARS, VENUS, MERCURY, JUPITER, SATURN, PLUTO, ATLAS, etc.

**Key systems you should be aware of (do not modify unless told):**

- Core execution: Ralph Loop (`src/orchestrator/ralph-loop.ts`)
- Existing recovery: `src/recovery/graceful-recovery.ts` (407 lines) — do NOT modify
- Taste Vault: `src/taste-vault/`
- ACE playbooks: `src/ace/`
- Session Memory: `src/memory/session-memory.ts`
- Agent Memory: `src/memory/agent-memory.ts`

**Existing recovery code** in `src/recovery/graceful-recovery.ts` already provides:

- Basic `Checkpoint` interface with `saveCheckpoint()`, `loadCheckpoint()`, `listResumableCheckpoints()`, `deleteCheckpoint()`
- `isFallbackTrigger()` and `selectFallbackModel()` for model fallback
- `enqueueConvexEvent()` and `flushOfflineQueue()` for offline sync
- `validateVault()` for vault graph repair
- `formatError()` for user-friendly error messages

**This sprint adds advanced recovery capabilities on top of graceful-recovery.ts.** Circuit breakers, automatic build state snapshots, error classification & correlation, recovery strategy orchestration, and self-healing diagnostics. All new files are created alongside `graceful-recovery.ts` in `src/recovery/`. Do NOT modify `graceful-recovery.ts`.

**Current state:** ~2081 tests passing, 0 TypeScript errors.

---

## Rules

- TypeScript strict mode. No `any` types.
- ESM imports with `.js` extensions (e.g., `import { Foo } from './foo.js';`).
- Every new `.ts` source file gets a companion `.test.ts` file in the same directory.
- Tests use vitest (`import { describe, it, expect, vi, beforeEach } from 'vitest';`).
- Mock Ollama calls — **never** make real LLM calls in tests. Use `vi.fn()` or `vi.mock()`.
- Mock file system operations in tests — **never** read/write real files. Use `vi.mock('fs')`.
- Do **not** modify existing source files unless explicitly told to extend them.
- Run `npx tsc --noEmit` and `npx vitest run` after each task. Zero errors, zero failures.
- Target: 2081+ tests passing at end of sprint (aim for 90+ new tests → 2171+).
- All IDs should be generated with `crypto.randomUUID()`.
- All timestamps should be ISO 8601 strings (`new Date().toISOString()`).

---

## KIMI-RECOVERY-01: Circuit Breaker Pattern

### Files to Create

- `src/recovery/circuit-breaker.ts`
- `src/recovery/circuit-breaker.test.ts`

### Purpose

Prevent cascading failures by automatically disabling failing integrations (Ollama, Convex, external services) and re-enabling them after a cooldown period. When an integration fails repeatedly, the circuit "trips" open — all subsequent calls fail immediately without wasting resources. After a configurable timeout, the circuit enters a half-open state where a limited number of probe requests are allowed through. If those succeed, the circuit closes and normal operation resumes. If they fail, the circuit re-opens. This protects the entire system when one dependency goes down.

### Interfaces to Implement

```typescript
export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerConfig {
  failureThreshold: number;       // default: 5 — trips after this many failures
  resetTimeoutMs: number;         // default: 30000 — try again after 30s
  halfOpenMaxAttempts: number;    // default: 3 — attempts in half-open before closing
  monitorWindowMs: number;        // default: 60000 — failure count window
}

export interface CircuitBreakerStats {
  name: string;
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureAt?: string;
  lastSuccessAt?: string;
  trippedAt?: string;
  totalTrips: number;
}
```

Also define and export a custom error class:

```typescript
export class CircuitOpenError extends Error {
  constructor(circuitName: string) {
    super(`Circuit breaker '${circuitName}' is open — calls are being rejected`);
    this.name = 'CircuitOpenError';
  }
}
```

### Class to Implement

```typescript
export class CircuitBreaker {
  constructor(name: string, config?: Partial<CircuitBreakerConfig>);
}
```

Default config:
```typescript
const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeoutMs: 30000,
  halfOpenMaxAttempts: 3,
  monitorWindowMs: 60000,
};
```

Internal state to track:

- `state: CircuitState` — starts as `'closed'`
- `failureCount: number` — failures within the current monitor window
- `successCount: number` — successes in half-open state
- `halfOpenAttempts: number` — attempts made in half-open state
- `totalTrips: number` — lifetime trip count
- `lastFailureAt?: string` — ISO timestamp of last failure
- `lastSuccessAt?: string` — ISO timestamp of last success
- `trippedAt?: string` — ISO timestamp of when circuit last tripped open
- `failureTimestamps: string[]` — ISO timestamps of recent failures (for window-based counting)

### Functions

1. **`execute<T>(fn: () => Promise<T>): Promise<T>`**
   - If `shouldAttempt()` returns false, throw `CircuitOpenError`.
   - If state is `'half-open'`, increment `halfOpenAttempts`.
   - Try calling `fn()`:
     - On success: call `recordSuccess()`, return the result.
     - On failure: call `recordFailure(error)`, re-throw the original error.

2. **`getState(): CircuitState`**
   - Returns the current circuit state.
   - Before returning, checks if an `'open'` circuit should transition to `'half-open'` (if `resetTimeoutMs` has elapsed since `trippedAt`). If so, transitions to `'half-open'` and resets `halfOpenAttempts` to 0.

3. **`getStats(): CircuitBreakerStats`**
   - Returns a snapshot of `{ name, state, failureCount, successCount, lastFailureAt, lastSuccessAt, trippedAt, totalTrips }`.
   - Calls `getState()` first to ensure any pending state transitions are applied.

4. **`recordSuccess(): void`**
   - Update `lastSuccessAt` to now.
   - Increment `successCount`.
   - If state is `'half-open'` and `successCount >= config.halfOpenMaxAttempts`, transition to `'closed'` and reset failure counts.
   - If state is `'closed'`, reset `failureCount` to 0 and clear `failureTimestamps`.

5. **`recordFailure(error: Error): void`**
   - Update `lastFailureAt` to now.
   - Add current timestamp to `failureTimestamps`.
   - Prune `failureTimestamps` to only include entries within `monitorWindowMs` of now.
   - Set `failureCount` to the length of `failureTimestamps` after pruning.
   - If state is `'half-open'`, call `trip()` immediately (any failure in half-open re-opens the circuit).
   - If state is `'closed'` and `failureCount >= config.failureThreshold`, call `trip()`.

6. **`trip(): void`**
   - Set state to `'open'`.
   - Set `trippedAt` to now.
   - Increment `totalTrips`.
   - Reset `halfOpenAttempts` to 0.
   - Reset `successCount` to 0.

7. **`reset(): void`**
   - Set state to `'closed'`.
   - Reset `failureCount` to 0.
   - Reset `successCount` to 0.
   - Reset `halfOpenAttempts` to 0.
   - Clear `failureTimestamps`.
   - Clear `trippedAt`.

8. **`shouldAttempt(): boolean`**
   - `'closed'`: return `true`.
   - `'half-open'`: return `true` if `halfOpenAttempts < config.halfOpenMaxAttempts`.
   - `'open'`: check if `resetTimeoutMs` has elapsed since `trippedAt`. If yes, transition to `'half-open'`, reset `halfOpenAttempts` to 0, reset `successCount` to 0, and return `true`. If no, return `false`.

### Required Tests (minimum 20)

1. **Starts in closed state** — new `CircuitBreaker('test')`, verify `getState()` returns `'closed'`.
2. **Executes function when closed** — `execute(() => Promise.resolve(42))` returns `42`.
3. **Records success on successful execution** — after successful execute, `getStats().successCount` is 1.
4. **Records failure on failed execution** — execute a rejecting fn, verify `getStats().failureCount` is 1.
5. **Trips after failureThreshold consecutive failures** — config `failureThreshold: 3`, trigger 3 failures, verify state is `'open'`.
6. **Rejects execution when open (throws CircuitOpenError)** — trip the circuit, call execute, expect `CircuitOpenError`.
7. **Transitions to half-open after resetTimeoutMs** — trip the circuit, advance time past `resetTimeoutMs`, call `getState()`, verify `'half-open'`.
8. **Closes after successful half-open execution** — in half-open state, execute successful fn `halfOpenMaxAttempts` times, verify state returns to `'closed'`.
9. **Re-opens if half-open execution fails** — in half-open state, execute a failing fn, verify state returns to `'open'`.
10. **Reset clears state to closed** — trip the circuit, call `reset()`, verify `getState()` is `'closed'` and `failureCount` is 0.
11. **Stats reflect current counts** — perform 2 successes and 1 failure, verify stats match.
12. **totalTrips increments on each trip** — trip twice, verify `totalTrips` is 2.
13. **Failures within monitorWindowMs count together** — 3 failures within window, verify `failureCount` is 3.
14. **Old failures outside window don't count** — set `monitorWindowMs: 1000`, record failure, advance time 2000ms, record another failure, verify `failureCount` is 1 (only the recent one).
15. **halfOpenMaxAttempts limits half-open tries** — config `halfOpenMaxAttempts: 2`, in half-open state, verify only 2 attempts allowed before `shouldAttempt()` returns false.
16. **Custom config overrides defaults** — `new CircuitBreaker('x', { failureThreshold: 10 })`, verify threshold is 10 by triggering 9 failures without tripping.
17. **Concurrent executions handled correctly** — execute 5 parallel promises, verify all results captured and counts correct.
18. **getState returns current state** — in each state (closed, open, half-open), verify `getState()` accuracy.
19. **trippedAt set when circuit trips** — trigger trip, verify `getStats().trippedAt` is a valid ISO timestamp.
20. **lastFailureAt updated on failure** — trigger failure, verify `getStats().lastFailureAt` is set to a valid ISO timestamp.

---

## KIMI-RECOVERY-02: Build State Auto-Snapshots

### Files to Create

- `src/recovery/build-snapshot.ts`
- `src/recovery/build-snapshot.test.ts`

### Purpose

Automatically snapshot build state at intervals so crashed builds can resume with minimal lost work. Snapshots are more granular than checkpoints (from `graceful-recovery.ts`) — they capture the full PRD state, completed outputs, and partial progress. When a build crashes, the latest compatible snapshot is loaded and tasks resume from the last known state instead of starting over. Snapshots also enable comparing progress between intervals to identify stuck builds.

### Interfaces to Implement

```typescript
export interface BuildSnapshot {
  id: string;
  buildId: string;
  projectId: string;
  snapshotAt: string;
  prdState: string;                // JSON-serialized PRD
  completedTaskIds: string[];
  runningTaskIds: string[];
  failedTaskIds: string[];
  outputPaths: Record<string, string>; // taskId → output file path
  environmentHash: string;         // hash of node_modules + config for compatibility check
  snapshotSizeBytes: number;
  resumable: boolean;
}

export interface SnapshotConfig {
  enabled: boolean;                // default: true
  intervalMs: number;              // default: 60000 (every 60 seconds)
  maxSnapshots: number;            // default: 10
  snapshotDir: string;             // default: '.nova/snapshots'
}

export interface SnapshotDiff {
  fromSnapshotId: string;
  toSnapshotId: string;
  tasksCompleted: string[];
  tasksFailed: string[];
  newOutputs: string[];
  durationMs: number;
}
```

### Class to Implement

```typescript
export class BuildSnapshotManager {
  constructor(config?: Partial<SnapshotConfig>);
}
```

Default config:
```typescript
const DEFAULT_CONFIG: SnapshotConfig = {
  enabled: true,
  intervalMs: 60000,
  maxSnapshots: 10,
  snapshotDir: '.nova/snapshots',
};
```

Internal state to track:

- `snapshots: Map<string, BuildSnapshot>` — in-memory snapshot store keyed by snapshot ID
- `config: SnapshotConfig` — merged config

### Functions

1. **`createSnapshot(buildId: string, projectId: string, prdState: string, taskStatuses: Array<{id: string; status: string; outputPath?: string}>): BuildSnapshot`**
   - Creates a new `BuildSnapshot` with `crypto.randomUUID()` id.
   - `snapshotAt` = `new Date().toISOString()`.
   - Partitions `taskStatuses` by status:
     - `'completed'` → `completedTaskIds`
     - `'running'` → `runningTaskIds`
     - `'failed'` → `failedTaskIds`
   - Builds `outputPaths` from taskStatuses entries that have `outputPath` defined.
   - `environmentHash` = `''` (computed separately via `computeEnvironmentHash()`).
   - `snapshotSizeBytes` = byte length of `JSON.stringify(snapshot)`.
   - `resumable` = `true` if there are no failed tasks (all `failedTaskIds.length === 0`).
   - Stores snapshot in internal map.
   - Calls `pruneOldSnapshots(buildId)` to enforce `maxSnapshots`.
   - Returns the snapshot.

2. **`loadSnapshot(snapshotId: string): BuildSnapshot | undefined`**
   - Returns the snapshot from internal map, or `undefined` if not found.

3. **`getLatestSnapshot(buildId: string): BuildSnapshot | undefined`**
   - Returns the most recent snapshot (by `snapshotAt`) for the given `buildId`.
   - Returns `undefined` if no snapshots exist for that build.

4. **`listSnapshots(buildId: string): BuildSnapshot[]`**
   - Returns all snapshots for the given `buildId`, sorted by `snapshotAt` descending (newest first).

5. **`compareSnapshots(older: BuildSnapshot, newer: BuildSnapshot): SnapshotDiff`**
   - `tasksCompleted` = task IDs that are in `newer.completedTaskIds` but not in `older.completedTaskIds`.
   - `tasksFailed` = task IDs that are in `newer.failedTaskIds` but not in `older.failedTaskIds`.
   - `newOutputs` = keys in `newer.outputPaths` that are not in `older.outputPaths`.
   - `durationMs` = `new Date(newer.snapshotAt).getTime() - new Date(older.snapshotAt).getTime()`.

6. **`pruneOldSnapshots(buildId: string): number`**
   - Lists snapshots for the build, sorted by `snapshotAt` descending.
   - Keeps only the `config.maxSnapshots` most recent.
   - Deletes the rest from the internal map.
   - Returns the count of deleted snapshots.

7. **`computeEnvironmentHash(nodeModulesPath: string, configPath: string): string`**
   - Computes a simple deterministic hash string: `hash(nodeModulesPath + ':' + configPath)`.
   - Use a basic string hash function (sum of char codes, mod large prime, convert to hex). Do NOT import external hashing libraries.
   - Returns the hex string.

8. **`isCompatible(snapshot: BuildSnapshot, currentHash: string): boolean`**
   - Returns `true` if `snapshot.environmentHash === currentHash` or if `snapshot.environmentHash` is empty (legacy snapshots are always compatible).
   - Returns `false` otherwise.

### Required Tests (minimum 18)

1. **Creates snapshot with correct fields** — verify `buildId`, `projectId`, `prdState` match input.
2. **Snapshot gets unique ID** — verify `id` matches UUID format (`/^[0-9a-f]{8}-/`).
3. **Loads snapshot by ID** — create snapshot, load by ID, verify same object.
4. **Returns undefined for non-existent snapshot** — `loadSnapshot('nonexistent')` returns `undefined`.
5. **Gets latest snapshot for build** — create 3 snapshots for same build, verify latest returned.
6. **Lists snapshots sorted by time** — create 3 snapshots, verify list is sorted descending.
7. **Compare shows completed tasks between snapshots** — older has 2 completed, newer has 4, diff shows the 2 new completions.
8. **Compare shows failed tasks** — newer has a newly failed task, verify it appears in `tasksFailed`.
9. **Compare computes duration between snapshots** — snapshots 5000ms apart, verify `durationMs` is approximately 5000.
10. **Prunes keeps only maxSnapshots** — set `maxSnapshots: 3`, create 5, verify only 3 remain.
11. **Prune returns count of deleted snapshots** — create 5 with max 3, prune returns 2.
12. **Environment hash is deterministic** — same inputs produce same hash twice.
13. **Compatible when hashes match** — snapshot hash matches current hash, `isCompatible()` returns `true`.
14. **Incompatible when hashes differ** — snapshot hash differs from current hash, `isCompatible()` returns `false`.
15. **Snapshot tracks running task IDs** — 2 tasks with status `'running'`, verify `runningTaskIds` has length 2.
16. **Snapshot tracks output paths** — task with `outputPath: '/out/file.ts'`, verify `outputPaths` contains the mapping.
17. **Empty build produces valid snapshot** — no tasks, verify snapshot has empty arrays and `resumable: true`.
18. **Snapshot size computed correctly** — `snapshotSizeBytes` is a positive number greater than 0.

---

## KIMI-RECOVERY-03: Error Classification & Correlation

### Files to Create

- `src/recovery/error-classifier.ts`
- `src/recovery/error-classifier.test.ts`

### Purpose

Classify errors by type and severity, correlate related errors across tasks, and detect recurring patterns. When Nova26 encounters errors during a build, raw error messages are noisy and disconnected. This module transforms raw errors into structured `ClassifiedError` objects with a class, severity, and correlation key. Related errors are grouped so the orchestrator can identify systemic issues (e.g., "Ollama is down" rather than "Task 3 failed, Task 7 failed, Task 12 failed"). Recurring patterns (3+ occurrences of the same class+task combination) trigger escalation.

### Interfaces to Implement

```typescript
export type ErrorClass = 'model-error' | 'network-error' | 'filesystem-error' | 'validation-error' | 'timeout-error' | 'resource-error' | 'unknown-error';
export type ErrorSeverity = 'fatal' | 'recoverable' | 'transient' | 'informational';

export interface ClassifiedError {
  id: string;
  originalError: string;
  errorClass: ErrorClass;
  severity: ErrorSeverity;
  taskId?: string;
  agentName?: string;
  classifiedAt: string;
  suggestedAction: string;
  retryable: boolean;
  correlationKey: string;         // for grouping related errors
}

export interface ErrorPattern {
  patternId: string;
  errorClass: ErrorClass;
  occurrenceCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  affectedAgents: string[];
  affectedTasks: string[];
  isRecurring: boolean;           // 3+ occurrences
  suggestedResolution: string;
}

export interface ErrorCorrelation {
  correlationKey: string;
  errors: ClassifiedError[];
  pattern?: ErrorPattern;
  rootCauseHypothesis?: string;
}
```

### Class to Implement

```typescript
export class ErrorClassifier {
  constructor();
}
```

Internal state to track:

- `errorHistory: ClassifiedError[]` — stored classified errors, limited to 100 entries (FIFO eviction when full)

### Functions

1. **`classifyError(error: string, taskId?: string, agentName?: string): ClassifiedError`**
   - Creates a `ClassifiedError` with `crypto.randomUUID()` id and `classifiedAt` = now.
   - Classification rules (check in order, case-insensitive match on `error` string):
     - Contains `'oom'` or `'out of memory'` → `errorClass: 'model-error'`, `severity: 'recoverable'`, `suggestedAction: 'Reduce context window size or switch to a smaller model'`, `retryable: true`.
     - Contains `'timeout'` → `errorClass: 'timeout-error'`, `severity: 'transient'`, `suggestedAction: 'Increase timeout or retry the operation'`, `retryable: true`.
     - Contains `'ENOENT'` or `'EACCES'` or `'EPERM'` → `errorClass: 'filesystem-error'`, `severity: 'recoverable'`, `suggestedAction: 'Check file permissions and paths'`, `retryable: true`.
     - Contains `'ECONNREFUSED'` or `'ECONNRESET'` or `'fetch failed'` → `errorClass: 'network-error'`, `severity: 'transient'`, `suggestedAction: 'Check network connectivity and retry'`, `retryable: true`.
     - Contains `'validation'` or `'zod'` or `'parse'` → `errorClass: 'validation-error'`, `severity: 'recoverable'`, `suggestedAction: 'Fix input data format or schema'`, `retryable: false`.
     - Contains `'ENOMEM'` or `'heap'` → `errorClass: 'resource-error'`, `severity: 'fatal'`, `suggestedAction: 'Free system resources or increase memory allocation'`, `retryable: false`.
     - Else → `errorClass: 'unknown-error'`, `severity: 'recoverable'`, `suggestedAction: 'Inspect error details and retry manually'`, `retryable: true`.
   - `correlationKey` = `${errorClass}:${taskId || 'global'}`.
   - Appends to `errorHistory`. If `errorHistory.length > 100`, remove the oldest entry.
   - Returns the classified error.

2. **`correlateErrors(errors: ClassifiedError[]): ErrorCorrelation[]`**
   - Groups errors by `correlationKey`.
   - For each group, creates an `ErrorCorrelation` with:
     - `correlationKey` from the group key.
     - `errors` = all errors in the group.
     - `pattern` = result of detecting pattern within this group (call `detectPatterns` logic internally). Set `pattern` if the group is recurring (3+ errors), otherwise `undefined`.
     - `rootCauseHypothesis`:
       - `'network-error'` groups → `'External service is down or unreachable'`
       - `'model-error'` groups → `'LLM service is overloaded or misconfigured'`
       - `'filesystem-error'` groups → `'File system permissions or disk space issue'`
       - `'timeout-error'` groups → `'Service response times are degraded'`
       - Others → `undefined`

3. **`detectPatterns(errors: ClassifiedError[]): ErrorPattern[]`**
   - Groups errors by `errorClass`.
   - For each class group with 3+ occurrences, creates an `ErrorPattern`:
     - `patternId` = `crypto.randomUUID()`
     - `errorClass` from the group key.
     - `occurrenceCount` = number of errors in the group.
     - `firstSeenAt` = earliest `classifiedAt` in the group.
     - `lastSeenAt` = latest `classifiedAt` in the group.
     - `affectedAgents` = unique `agentName` values (filter out `undefined`).
     - `affectedTasks` = unique `taskId` values (filter out `undefined`).
     - `isRecurring` = `true` (always true since we only create patterns for 3+ occurrences).
     - `suggestedResolution`:
       - `'network-error'` → `'Verify network connectivity and service availability'`
       - `'model-error'` → `'Check Ollama service health and model availability'`
       - `'timeout-error'` → `'Increase timeouts or reduce request complexity'`
       - `'filesystem-error'` → `'Audit file permissions and available disk space'`
       - `'validation-error'` → `'Review input schemas and data formats'`
       - `'resource-error'` → `'Monitor system resources and increase allocations'`
       - `'unknown-error'` → `'Review error logs for new failure modes'`

4. **`isRetryable(classified: ClassifiedError): boolean`**
   - Returns `classified.retryable`.
   - This is a convenience method that delegates to the `retryable` field set during classification.

5. **`getSuggestedAction(classified: ClassifiedError): string`**
   - Returns `classified.suggestedAction`.
   - This is a convenience method that delegates to the `suggestedAction` field set during classification.

6. **`getErrorHistory(): ClassifiedError[]`**
   - Returns a copy of the internal `errorHistory` array.
   - Limited to 100 entries (the most recent 100).

### Required Tests (minimum 18)

1. **Classifies OOM error as model-error** — `'out of memory on inference'` → `errorClass: 'model-error'`.
2. **Classifies timeout error as timeout-error** — `'operation timeout after 30s'` → `errorClass: 'timeout-error'`.
3. **Classifies ENOENT as filesystem-error** — `'ENOENT: no such file'` → `errorClass: 'filesystem-error'`.
4. **Classifies EACCES as filesystem-error** — `'EACCES: permission denied'` → `errorClass: 'filesystem-error'`.
5. **Classifies ECONNREFUSED as network-error** — `'ECONNREFUSED 127.0.0.1:11434'` → `errorClass: 'network-error'`.
6. **Classifies fetch failed as network-error** — `'fetch failed for model endpoint'` → `errorClass: 'network-error'`.
7. **Classifies zod error as validation-error** — `'Zod parse error: invalid type'` → `errorClass: 'validation-error'`.
8. **Classifies unknown error as unknown-error** — `'something weird happened'` → `errorClass: 'unknown-error'`.
9. **Classification is case-insensitive** — `'TIMEOUT'` classified as `timeout-error`.
10. **Transient errors are retryable** — timeout and network errors have `retryable: true`.
11. **Validation errors are not retryable** — `retryable: false` for validation-error class.
12. **Correlation key includes taskId** — `classifyError('timeout', 'task-1')` → `correlationKey: 'timeout-error:task-1'`.
13. **Correlation key uses global when no taskId** — `classifyError('timeout')` → `correlationKey: 'timeout-error:global'`.
14. **correlateErrors groups by correlation key** — 3 errors with same key → 1 correlation group with 3 errors.
15. **detectPatterns finds recurring errors** — 4 network errors → pattern with `isRecurring: true`, `occurrenceCount: 4`.
16. **detectPatterns ignores non-recurring** — 2 timeout errors → no pattern returned for that class.
17. **Pattern tracks affected agents** — errors from MARS and VENUS → `affectedAgents: ['MARS', 'VENUS']`.
18. **Error history limited to 100** — classify 110 errors, `getErrorHistory()` returns 100.

---

## KIMI-RECOVERY-04: Recovery Strategy Orchestrator

### Files to Create

- `src/recovery/recovery-strategy.ts`
- `src/recovery/recovery-strategy.test.ts`

### Purpose

Select and execute recovery strategies based on classified errors. Strategies include retry with exponential backoff, model fallback, checkpoint resume, skip-task, graceful degradation, and abort. The orchestrator runs through strategies in priority order: first retry, then fallback, then checkpoint resume, etc. Each strategy gets a limited number of attempts. The orchestrator tracks the full recovery timeline so operators can audit what was tried and why the final outcome was reached.

### Interfaces to Implement

```typescript
import type { ErrorClass } from './error-classifier.js';

export type StrategyType = 'retry' | 'fallback-model' | 'checkpoint-resume' | 'skip-task' | 'graceful-degrade' | 'abort';

export interface RecoveryStrategy {
  id: string;
  type: StrategyType;
  description: string;
  applicableErrorClasses: ErrorClass[];
  priority: number;               // lower = try first
  maxAttempts: number;
  backoffMs: number;              // initial backoff for retry strategies
  backoffMultiplier: number;      // exponential backoff multiplier
}

export interface RecoveryAttempt {
  strategyId: string;
  strategyType: StrategyType;
  attemptNumber: number;
  startedAt: string;
  completedAt?: string;
  success: boolean;
  error?: string;
  resultAction: string;           // what was actually done
}

export interface RecoveryResult {
  errorId: string;
  strategies: RecoveryAttempt[];
  finalOutcome: 'recovered' | 'degraded' | 'failed';
  totalDurationMs: number;
}

export interface RecoveryConfig {
  maxRecoveryAttempts: number;     // default: 5
  initialBackoffMs: number;       // default: 1000
  backoffMultiplier: number;      // default: 2
  enableModelFallback: boolean;   // default: true
  enableCheckpointResume: boolean; // default: true
}
```

### Class to Implement

```typescript
export class RecoveryOrchestrator {
  constructor(config?: Partial<RecoveryConfig>);
}
```

Default config:
```typescript
const DEFAULT_CONFIG: RecoveryConfig = {
  maxRecoveryAttempts: 5,
  initialBackoffMs: 1000,
  backoffMultiplier: 2,
  enableModelFallback: true,
  enableCheckpointResume: true,
};
```

Internal state to track:

- `strategies: RecoveryStrategy[]` — the ordered list of built-in strategies
- `recoveryHistory: RecoveryResult[]` — past recovery attempts

Built-in strategies (defined in constructor or `getStrategies()`):

```typescript
[
  {
    id: 'retry-transient',
    type: 'retry',
    description: 'Retry transient failures with exponential backoff',
    applicableErrorClasses: ['network-error', 'timeout-error'],
    priority: 1,
    maxAttempts: 3,
    backoffMs: 1000,
    backoffMultiplier: 2,
  },
  {
    id: 'retry-model',
    type: 'retry',
    description: 'Retry model errors with backoff',
    applicableErrorClasses: ['model-error'],
    priority: 2,
    maxAttempts: 2,
    backoffMs: 2000,
    backoffMultiplier: 2,
  },
  {
    id: 'fallback-model',
    type: 'fallback-model',
    description: 'Switch to a fallback model',
    applicableErrorClasses: ['model-error', 'timeout-error', 'resource-error'],
    priority: 3,
    maxAttempts: 1,
    backoffMs: 0,
    backoffMultiplier: 1,
  },
  {
    id: 'checkpoint-resume',
    type: 'checkpoint-resume',
    description: 'Resume from the last checkpoint',
    applicableErrorClasses: ['model-error', 'network-error', 'timeout-error', 'filesystem-error', 'resource-error'],
    priority: 4,
    maxAttempts: 1,
    backoffMs: 0,
    backoffMultiplier: 1,
  },
  {
    id: 'skip-task',
    type: 'skip-task',
    description: 'Skip the failing task and continue the build',
    applicableErrorClasses: ['validation-error', 'filesystem-error', 'unknown-error'],
    priority: 5,
    maxAttempts: 1,
    backoffMs: 0,
    backoffMultiplier: 1,
  },
  {
    id: 'graceful-degrade',
    type: 'graceful-degrade',
    description: 'Continue with reduced functionality',
    applicableErrorClasses: ['model-error', 'network-error', 'timeout-error', 'resource-error', 'unknown-error'],
    priority: 6,
    maxAttempts: 1,
    backoffMs: 0,
    backoffMultiplier: 1,
  },
  {
    id: 'abort',
    type: 'abort',
    description: 'Abort the build entirely',
    applicableErrorClasses: ['model-error', 'network-error', 'filesystem-error', 'validation-error', 'timeout-error', 'resource-error', 'unknown-error'],
    priority: 7,
    maxAttempts: 1,
    backoffMs: 0,
    backoffMultiplier: 1,
  },
]
```

### Functions

1. **`getStrategies(): RecoveryStrategy[]`**
   - Returns the built-in strategies array, sorted by `priority` ascending (lowest first).

2. **`selectStrategy(error: ClassifiedError, previousAttempts: RecoveryAttempt[]): RecoveryStrategy | undefined`**
   - Filters strategies to those where `error.errorClass` is in `applicableErrorClasses`.
   - If `!config.enableModelFallback`, exclude strategies with type `'fallback-model'`.
   - If `!config.enableCheckpointResume`, exclude strategies with type `'checkpoint-resume'`.
   - From the remaining, exclude strategies that have already been attempted `maxAttempts` times in `previousAttempts` (match by `strategyId`).
   - Returns the first remaining strategy (lowest priority number), or `undefined` if none available.
   - Import `ClassifiedError` type from `'./error-classifier.js'`.

3. **`computeBackoff(strategy: RecoveryStrategy, attemptNumber: number): number`**
   - Base backoff = `strategy.backoffMs * (strategy.backoffMultiplier ** (attemptNumber - 1))`.
   - Add jitter: `+ Math.floor(Math.random() * 200)` (0-199ms).
   - Return the total delay in milliseconds.

4. **`executeStrategy(strategy: RecoveryStrategy, error: ClassifiedError, retryFn: () => Promise<boolean>): Promise<RecoveryAttempt>`**
   - Creates a `RecoveryAttempt` with `startedAt` = now.
   - For `'retry'` and `'fallback-model'` strategies: calls `retryFn()`.
     - If `retryFn()` returns `true`: `success: true`, `resultAction: 'Retry succeeded'` (or `'Model fallback succeeded'` for fallback-model).
     - If `retryFn()` returns `false` or throws: `success: false`, `error` = error message, `resultAction: 'Retry failed'` (or `'Model fallback failed'`).
   - For `'checkpoint-resume'`: calls `retryFn()`. If true: `resultAction: 'Resumed from checkpoint'`. If false: `resultAction: 'Checkpoint resume failed'`.
   - For `'skip-task'`: always `success: true`, `resultAction: 'Task skipped'`. Does not call `retryFn()`.
   - For `'graceful-degrade'`: always `success: true`, `resultAction: 'Continuing with degraded functionality'`. Does not call `retryFn()`.
   - For `'abort'`: always `success: false`, `resultAction: 'Build aborted'`. Does not call `retryFn()`.
   - Sets `completedAt` = now after execution.
   - Returns the attempt.

5. **`orchestrate(error: ClassifiedError, retryFn: () => Promise<boolean>): Promise<RecoveryResult>`**
   - Full recovery pipeline. Tracks `startTime` = `Date.now()`.
   - Loop (max `config.maxRecoveryAttempts` total attempts):
     1. Call `selectStrategy(error, attempts)` to get next strategy.
     2. If no strategy available, break.
     3. If strategy type is `'retry'` or `'fallback-model'` or `'checkpoint-resume'`, compute backoff and wait (in real code, use `await new Promise(r => setTimeout(r, backoffMs))`; in tests, this will be mocked or fast).
     4. Call `executeStrategy(strategy, error, retryFn)`.
     5. Append the attempt to the attempts array.
     6. If `attempt.success` and strategy type is NOT `'graceful-degrade'`: set `finalOutcome = 'recovered'`, break.
     7. If `attempt.success` and strategy type IS `'graceful-degrade'`: set `finalOutcome = 'degraded'`, break.
     8. If `attempt.success === false` and strategy type is `'abort'`: set `finalOutcome = 'failed'`, break.
     9. Otherwise, continue to next strategy.
   - If loop exhausts without a successful strategy: `finalOutcome = 'failed'`.
   - `totalDurationMs` = `Date.now() - startTime`.
   - Store result in `recoveryHistory`.
   - Return the `RecoveryResult`.

6. **`getRecoveryHistory(): RecoveryResult[]`**
   - Returns a copy of the `recoveryHistory` array.

### Required Tests (minimum 18)

1. **getStrategies returns ordered list** — verify strategies sorted by priority ascending.
2. **getStrategies includes all 7 built-in strategies** — verify length is 7.
3. **selectStrategy picks lowest priority applicable** — network-error → selects 'retry-transient' (priority 1).
4. **selectStrategy skips exhausted strategies** — retry-transient already attempted 3 times → skips to next.
5. **selectStrategy returns undefined when all exhausted** — all strategies exhausted → returns `undefined`.
6. **selectStrategy respects enableModelFallback=false** — config disables fallback, verify fallback-model not selected.
7. **selectStrategy respects enableCheckpointResume=false** — config disables checkpoint, verify checkpoint-resume not selected.
8. **computeBackoff returns exponential values** — attempt 1 = 1000ms, attempt 2 = 2000ms, attempt 3 = 4000ms (ignoring jitter).
9. **computeBackoff adds jitter** — backoff has randomness component (run twice, values may differ).
10. **executeStrategy retry success** — `retryFn` returns `true` → `success: true`, `resultAction` contains 'succeeded'.
11. **executeStrategy retry failure** — `retryFn` returns `false` → `success: false`.
12. **executeStrategy skip-task always succeeds** — skip-task → `success: true`, `resultAction: 'Task skipped'`.
13. **executeStrategy graceful-degrade always succeeds** — `success: true`, `resultAction` contains 'degraded'.
14. **executeStrategy abort always fails** — abort → `success: false`, `resultAction: 'Build aborted'`.
15. **orchestrate recovers on first retry** — `retryFn` returns `true`, `finalOutcome: 'recovered'`.
16. **orchestrate degrades after retries fail** — `retryFn` always returns `false`, eventually reaches graceful-degrade, `finalOutcome: 'degraded'`.
17. **orchestrate fails when all strategies exhausted** — `retryFn` always fails, all strategies fail, `finalOutcome: 'failed'`.
18. **getRecoveryHistory stores results** — orchestrate twice, `getRecoveryHistory()` has length 2.

---

## KIMI-RECOVERY-05: Integration & Wiring

### Files to Create

- `src/recovery/recovery-index.ts`
- `src/recovery/recovery-index.test.ts`

### Modification to Existing File

- `src/orchestrator/ralph-loop.ts` — add 2 fields to `RalphLoopOptions` + 1 import

### Purpose

Barrel export and `ralph-loop.ts` integration. This task ties all four new recovery modules together into a single public API and wires the advanced recovery config into the orchestrator's options interface.

### Barrel Export (`recovery-index.ts`)

Re-export everything from all new modules:

```typescript
// Advanced Recovery - Barrel Export (R17-01)

// Circuit Breaker
export {
  CircuitBreaker,
  CircuitOpenError,
  type CircuitState,
  type CircuitBreakerConfig,
  type CircuitBreakerStats,
} from './circuit-breaker.js';

// Build Snapshots
export {
  BuildSnapshotManager,
  type BuildSnapshot,
  type SnapshotConfig,
  type SnapshotDiff,
} from './build-snapshot.js';

// Error Classification
export {
  ErrorClassifier,
  type ErrorClass,
  type ErrorSeverity,
  type ClassifiedError,
  type ErrorPattern,
  type ErrorCorrelation,
} from './error-classifier.js';

// Recovery Strategy
export {
  RecoveryOrchestrator,
  type StrategyType,
  type RecoveryStrategy,
  type RecoveryAttempt,
  type RecoveryResult,
  type RecoveryConfig,
} from './recovery-strategy.js';
```

### AdvancedRecoveryConfig

Define and export this config interface in `recovery-index.ts`:

```typescript
export interface AdvancedRecoveryConfig {
  circuitBreakerEnabled: boolean;   // default: true
  snapshotEnabled: boolean;         // default: true
  errorClassificationEnabled: boolean; // default: true
  recoveryOrchestrationEnabled: boolean; // default: true
  snapshotIntervalMs: number;       // default: 60000
  maxRecoveryAttempts: number;      // default: 5
}
```

Also export a default config constant:

```typescript
export const DEFAULT_ADVANCED_RECOVERY_CONFIG: AdvancedRecoveryConfig = {
  circuitBreakerEnabled: true,
  snapshotEnabled: true,
  errorClassificationEnabled: true,
  recoveryOrchestrationEnabled: true,
  snapshotIntervalMs: 60000,
  maxRecoveryAttempts: 5,
};
```

### Factory Function

Export a convenience factory:

```typescript
export function createAdvancedRecoverySystem(config?: Partial<AdvancedRecoveryConfig>): {
  circuitBreaker: CircuitBreaker;
  snapshotManager: BuildSnapshotManager;
  errorClassifier: ErrorClassifier;
  recoveryOrchestrator: RecoveryOrchestrator;
  config: AdvancedRecoveryConfig;
}
```

Implementation:
- Merges `config` with `DEFAULT_ADVANCED_RECOVERY_CONFIG`.
- Creates a `CircuitBreaker` named `'nova26-main'` (only if `circuitBreakerEnabled`).
- Creates a `BuildSnapshotManager` with `{ intervalMs: mergedConfig.snapshotIntervalMs }` (only if `snapshotEnabled`).
- Creates an `ErrorClassifier` (only if `errorClassificationEnabled`).
- Creates a `RecoveryOrchestrator` with `{ maxRecoveryAttempts: mergedConfig.maxRecoveryAttempts }` (only if `recoveryOrchestrationEnabled`).
- If any subsystem is disabled, still return the object but with a no-op/default instance so the return type is always consistent.
- Returns all four subsystems and the merged config.

### Modification to `src/orchestrator/ralph-loop.ts`

**This is the ONLY existing file you modify in this entire sprint.** Add this import at the top of the file, after the existing import block (after the `AgentMemoryConfig` import on line 37):

```typescript
import type { AdvancedRecoveryConfig } from '../recovery/recovery-index.js';
```

Add these fields to the `RalphLoopOptions` interface, **after** `memoryConfig` (after line 66):

```typescript
  // Advanced Recovery (R17-01)
  advancedRecoveryEnabled?: boolean;
  advancedRecoveryConfig?: AdvancedRecoveryConfig;
```

**That is the ONLY change to ralph-loop.ts.** Do not modify any functions.

### Required Tests (minimum 16)

**Barrel export tests (verify re-exports are accessible):**

1. **Exports CircuitBreaker class** — `import { CircuitBreaker } from './recovery-index.js'` is a valid constructor.
2. **Exports CircuitOpenError class** — `import { CircuitOpenError } from './recovery-index.js'` is a valid constructor.
3. **Exports BuildSnapshotManager class** — verify constructor.
4. **Exports ErrorClassifier class** — verify constructor.
5. **Exports RecoveryOrchestrator class** — verify constructor.
6. **Exports AdvancedRecoveryConfig type** — verify `DEFAULT_ADVANCED_RECOVERY_CONFIG` has correct shape.

**AdvancedRecoveryConfig tests:**

7. **DEFAULT_ADVANCED_RECOVERY_CONFIG has all fields** — verify all 6 boolean/number fields present.
8. **DEFAULT_ADVANCED_RECOVERY_CONFIG defaults are correct** — `circuitBreakerEnabled: true`, `snapshotIntervalMs: 60000`, etc.

**Factory function tests:**

9. **createAdvancedRecoverySystem returns all subsystems** — verify `circuitBreaker`, `snapshotManager`, `errorClassifier`, `recoveryOrchestrator` are defined.
10. **createAdvancedRecoverySystem uses defaults** — call with no args, verify `config` matches `DEFAULT_ADVANCED_RECOVERY_CONFIG`.
11. **createAdvancedRecoverySystem merges partial config** — pass `{ snapshotIntervalMs: 30000 }`, verify `snapshotIntervalMs: 30000` and other defaults preserved.
12. **CircuitBreaker from factory is named nova26-main** — verify `circuitBreaker.getStats().name === 'nova26-main'`.

**Integration pipeline tests (subsystems work together):**

13. **Classify error then orchestrate recovery** — create error classifier, classify an error, pass to recovery orchestrator, verify `RecoveryResult` returned.
14. **Circuit breaker trips then error classified** — trip circuit breaker, catch `CircuitOpenError`, classify the error message, verify `errorClass` is `'unknown-error'` or appropriate class.
15. **Snapshot captures build state** — create snapshot manager, create snapshot, verify loadable.
16. **Full pipeline: classify → select strategy → execute** — classify a network error, pass to orchestrator's `selectStrategy`, verify a retry strategy is selected.

---

## Final Checklist

After completing all 5 tasks, verify:

```bash
npx tsc --noEmit        # 0 errors
npx vitest run           # 2081+ tests (target: 90+ new = 2171+)
```

New files created (10 total):
- `src/recovery/circuit-breaker.ts`
- `src/recovery/circuit-breaker.test.ts`
- `src/recovery/build-snapshot.ts`
- `src/recovery/build-snapshot.test.ts`
- `src/recovery/error-classifier.ts`
- `src/recovery/error-classifier.test.ts`
- `src/recovery/recovery-strategy.ts`
- `src/recovery/recovery-strategy.test.ts`
- `src/recovery/recovery-index.ts`
- `src/recovery/recovery-index.test.ts`

Modified files (1 total):
- `src/orchestrator/ralph-loop.ts` (2 new fields + 1 import only)

Existing files NOT modified:
- `src/recovery/graceful-recovery.ts` — untouched

Test target: 90+ new tests across 5 test files → 2171+ total.
