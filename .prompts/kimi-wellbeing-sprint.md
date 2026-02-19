# KIMI-WELLBEING Sprint: Emotional Intelligence & Developer Wellbeing (R16-05)

> Assigned to: Kimi
> Sprint: Wellbeing (post-Testing)
> Date issued: 2026-02-19
> Prerequisite: KIMI-TESTING complete (~2081 tests, 0 TS errors)

## Project Context

Nova26 is a 21-agent AI-powered IDE built with TypeScript, Ollama (local LLM), Convex, and vitest. Agents are named after celestial bodies: MARS, VENUS, MERCURY, JUPITER, SATURN, PLUTO, ATLAS, etc.

**Key systems you should be aware of (do not modify unless told):**

- Core execution: Ralph Loop (`src/orchestrator/ralph-loop.ts`)
- Taste Vault: `src/taste-vault/`
- ACE playbooks: `src/ace/`
- Rehearsal Stage: `src/rehearsal/`
- Session Memory: `src/memory/session-memory.ts`
- Agent Memory: `src/memory/agent-memory.ts`
- Personality Engine: `src/agents/personality-engine.ts`
- Offline Engine: `src/sync/offline-engine.ts`
- Semantic Search: `src/tools/semantic-search.ts`
- ATLAS: `src/atlas/`
- Dream Engine: `src/dream/`
- Parallel Universe: `src/universe/`
- Overnight Evolution: `src/evolution/`
- Nova Symbiont: `src/symbiont/`
- Taste Room: `src/taste-room/`
- Portfolio: `src/portfolio/`
- Generative UI: `src/gen-ui/`
- Autonomous Testing: `src/auto-test/`

**Current state:** ~2081 tests passing, 0 TypeScript errors.

**Important context:** This sprint creates a wellbeing layer that observes developer behavior signals, tracks emotional state via a state machine, triggers gentle interventions (offers, never assessments), adapts agent tone based on state, and tracks work sessions with narrative summaries. The system is passive and supportive — it never judges, never diagnoses, and never blocks workflow. Interventions are always phrased as offers ("Would you like me to suggest an alternative approach?"), never statements about the developer's mental state.

**Key distinction from Personality Engine:** The Personality Engine (`src/agents/personality-engine.ts`) defines each agent's base communication style. The Wellbeing Tone Adapter temporarily overrides personality settings based on transient emotional state. When the developer returns to a `focused` state, the personality engine's defaults resume. Do **not** modify `personality-engine.ts`.

---

## Rules

- TypeScript strict mode. No `any` types.
- ESM imports with `.js` extensions (e.g., `import { Foo } from './foo.js';`).
- Every new `.ts` source file gets a companion `.test.ts` file in the same directory.
- Tests use vitest (`import { describe, it, expect, vi, beforeEach } from 'vitest';`).
- Mock Ollama calls — **never** make real LLM calls in tests. Use `vi.fn()` or `vi.mock()`.
- Mock `fs` in tests — **never** read or write real files. Use `vi.mock()`.
- Do **not** modify existing source files unless explicitly told to extend them.
- Run `npx tsc --noEmit` and `npx vitest run` after each task. Zero errors, zero failures.
- Target: 2081+ tests passing at end of sprint (aim for 90+ new tests).
- All IDs should be generated with `crypto.randomUUID()`.
- All timestamps should be ISO 8601 strings (`new Date().toISOString()`).

---

## KIMI-WELLBEING-01: Signal Detection Types & Engine

### Files to Create

- `src/wellbeing/signal-detector.ts`
- `src/wellbeing/signal-detector.test.ts`

### Purpose

Nova26's agents currently have no awareness of developer frustration, fatigue, or celebration. This task creates the foundation: TypeScript interfaces for wellbeing configuration, signal types, and the signal detection engine that analyzes observable developer behavior patterns (undo frequency, failure counts, commit messages, session duration, velocity changes, milestones) to produce structured wellbeing signals.

### Interfaces to Implement

All interfaces must be exported from `src/wellbeing/signal-detector.ts`:

```typescript
export interface WellbeingConfig {
  signalDetectionEnabled: boolean;   // default: true
  interventionsEnabled: boolean;     // default: true
  toneAdaptationEnabled: boolean;    // default: true
  milestoneAcknowledgmentEnabled: boolean; // default: true
  sessionSummaryEnabled: boolean;    // default: true
  sessionInactivityTimeoutMinutes: number; // default: 30
  stuckThresholdMinutes: number;     // default: 30
  fatigueThresholdMinutes: number;   // default: 90
}

export type DeveloperState = 'focused' | 'exploring' | 'stuck' | 'frustrated' | 'fatigued' | 'celebrating';

export type SignalType =
  | 'rapid-undo'
  | 'repeated-failure'
  | 'negative-commit-message'
  | 'long-session-no-build'
  | 'rapid-task-abandonment'
  | 'velocity-drop'
  | 'milestone-reached'
  | 'successful-build-after-stuck';

export interface WellbeingSignal {
  id: string;
  type: SignalType;
  confidence: number;              // 0-1
  detectedAt: string;
  context: string;
  sessionId: string;
  projectId: string;
  rawData?: Record<string, unknown>;
}
```

### Class to Implement

```typescript
export class SignalDetector {
  constructor(config?: Partial<WellbeingConfig>);
}
```

The constructor merges config with defaults:

```typescript
const DEFAULT_WELLBEING_CONFIG: WellbeingConfig = {
  signalDetectionEnabled: true,
  interventionsEnabled: true,
  toneAdaptationEnabled: true,
  milestoneAcknowledgmentEnabled: true,
  sessionSummaryEnabled: true,
  sessionInactivityTimeoutMinutes: 30,
  stuckThresholdMinutes: 30,
  fatigueThresholdMinutes: 90,
};
```

Export `DEFAULT_WELLBEING_CONFIG` so other modules can reference it.

### Functions (all instance methods on `SignalDetector`)

1. **`detectRapidUndo(undoCount: number, timeWindowMs: number): WellbeingSignal | undefined`**
   - Returns a `'rapid-undo'` signal if `undoCount > 5` AND `timeWindowMs <= 60000` (60 seconds).
   - Confidence: `Math.min(1, undoCount / 10)`. Context: `"${undoCount} undos in ${timeWindowMs}ms"`.
   - Returns `undefined` if thresholds not met or `signalDetectionEnabled` is false.
   - The returned signal's `sessionId` and `projectId` are empty strings (caller fills them in).

2. **`detectRepeatedFailure(failureCount: number, taskId: string): WellbeingSignal | undefined`**
   - Returns a `'repeated-failure'` signal if `failureCount >= 3`.
   - Confidence: `Math.min(1, failureCount / 5)`. Context: `"${failureCount} consecutive failures on task ${taskId}"`.
   - Returns `undefined` if threshold not met or detection disabled.

3. **`detectNegativeCommitMessage(message: string): WellbeingSignal | undefined`**
   - Searches the commit message (case-insensitive) for keywords: `'ugh'`, `'why'`, `'broken'`, `'hate'`, `'stupid'`, `'wtf'`, `'nothing works'`, `'give up'`, `'frustrated'`, `'terrible'`, `'awful'`, `'worst'`.
   - Returns a `'negative-commit-message'` signal if any keyword matches.
   - Confidence: `Math.min(1, matchCount * 0.3)` where `matchCount` is the number of distinct keywords found. Context: `"Negative sentiment in commit: '${message.slice(0, 60)}'"`.
   - Returns `undefined` if no keywords match or detection disabled.

4. **`detectLongSession(sessionStartedAt: string, lastBuildSuccessAt: string | undefined): WellbeingSignal | undefined`**
   - Calculates minutes since `sessionStartedAt`. If `lastBuildSuccessAt` is undefined or the time since last successful build exceeds `fatigueThresholdMinutes` (default 90), returns a `'long-session-no-build'` signal.
   - Also requires that the total session duration is >= `fatigueThresholdMinutes`.
   - Confidence: `Math.min(1, minutesSinceStart / (fatigueThresholdMinutes * 2))`. Context: `"Session running ${minutesSinceStart} minutes without successful build"`.
   - Returns `undefined` if threshold not met or detection disabled.

5. **`detectVelocityDrop(recentVelocity: number, baselineVelocity: number): WellbeingSignal | undefined`**
   - Returns a `'velocity-drop'` signal if `baselineVelocity > 0` AND `recentVelocity / baselineVelocity < 0.6` (40%+ drop).
   - Confidence: `Math.min(1, 1 - (recentVelocity / baselineVelocity))`. Context: `"Velocity dropped from ${baselineVelocity} to ${recentVelocity}"`.
   - Returns `undefined` if baseline is 0, drop < 40%, or detection disabled.

6. **`detectMilestone(milestoneType: string, milestoneDescription: string): WellbeingSignal`**
   - Always returns a `'milestone-reached'` signal (milestones are never suppressed).
   - Confidence: `1.0`. Context: `"${milestoneType}: ${milestoneDescription}"`.
   - Ignores `signalDetectionEnabled` — milestones are always detected.

7. **`aggregateSignals(signals: WellbeingSignal[]): number`**
   - Computes a composite confidence score from 0-1 across all provided signals.
   - If no signals, returns 0.
   - Formula: `1 - signals.reduce((acc, s) => acc * (1 - s.confidence), 1)` — probabilistic union so multiple weak signals compound into higher confidence.
   - Clamp result to `[0, 1]`.

### Required Tests (minimum 20)

Write these in `src/wellbeing/signal-detector.test.ts`:

1. **detectRapidUndo returns signal for 6 undos in 50s** — verify type 'rapid-undo', confidence 0.6.
2. **detectRapidUndo returns undefined for 5 undos** — threshold is >5.
3. **detectRapidUndo returns undefined for 6 undos in 90s** — window exceeds 60s.
4. **detectRapidUndo returns undefined when detection disabled** — config `signalDetectionEnabled: false`.
5. **detectRepeatedFailure returns signal for 3 failures** — verify type 'repeated-failure', confidence 0.6.
6. **detectRepeatedFailure returns undefined for 2 failures** — below threshold.
7. **detectRepeatedFailure includes taskId in context** — verify context string contains the taskId.
8. **detectNegativeCommitMessage detects 'ugh'** — verify signal returned.
9. **detectNegativeCommitMessage detects 'wtf' case-insensitive** — uppercase 'WTF' still matches.
10. **detectNegativeCommitMessage detects multiple keywords** — 'ugh this is broken' matches 2 keywords, confidence 0.6.
11. **detectNegativeCommitMessage returns undefined for clean message** — 'feat: add login page' returns undefined.
12. **detectNegativeCommitMessage returns undefined when disabled** — detection disabled.
13. **detectLongSession returns signal after 90 minutes without build** — verify type 'long-session-no-build'.
14. **detectLongSession returns undefined for short session** — 30 minutes returns undefined.
15. **detectLongSession returns undefined when recent build exists** — lastBuildSuccessAt within threshold returns undefined.
16. **detectVelocityDrop returns signal for 50% drop** — recent 2.0, baseline 5.0, verify signal.
17. **detectVelocityDrop returns undefined for 30% drop** — recent 3.5, baseline 5.0, below 40% threshold.
18. **detectVelocityDrop returns undefined for zero baseline** — baseline 0 returns undefined.
19. **detectMilestone always returns signal** — even when signalDetectionEnabled is false.
20. **detectMilestone has confidence 1.0** — verify confidence is always 1.0.
21. **aggregateSignals returns 0 for empty array** — verify.
22. **aggregateSignals returns single signal confidence** — one signal at 0.7, result 0.7.
23. **aggregateSignals compounds multiple signals** — two signals at 0.5 each, result 0.75.
24. **aggregateSignals clamps to 1.0** — multiple high-confidence signals, result <= 1.0.

---

## KIMI-WELLBEING-02: Emotional State Machine

### Files to Create

- `src/wellbeing/state-machine.ts`
- `src/wellbeing/state-machine.test.ts`

### Purpose

The emotional state machine tracks the developer's inferred emotional state across a session. It transitions between states based on wellbeing signals, following defined transition rules. Each state has minimum confidence thresholds and allowed transitions. The state machine is purely reactive — it processes signals and produces state, never initiating actions on its own.

### Interfaces to Implement

All interfaces must be exported from `src/wellbeing/state-machine.ts`:

```typescript
export interface EmotionalState {
  sessionId: string;
  currentState: DeveloperState;
  previousState?: DeveloperState;
  stateEnteredAt: string;
  signals: WellbeingSignal[];
  compositeConfidence: number;     // 0-1
  interventionCooldownUntil?: string;
  lastMilestoneAt?: string;
  lastMilestoneDescription?: string;
}

export interface TransitionRule {
  from: DeveloperState;
  to: DeveloperState;
  triggerSignals: SignalType[];
  minConfidence: number;
}
```

Import `DeveloperState`, `SignalType`, `WellbeingSignal` from `./signal-detector.js`.

### Class to Implement

```typescript
export class EmotionalStateMachine {
  constructor();
}
```

### Functions (all instance methods on `EmotionalStateMachine`)

1. **`processSignal(state: EmotionalState, signal: WellbeingSignal): EmotionalState`**
   - Adds the signal to `state.signals`.
   - Recalculates `compositeConfidence` using the probabilistic union formula: `1 - signals.reduce((acc, s) => acc * (1 - s.confidence), 1)`, using only signals from the last 10 minutes (filter by `detectedAt`).
   - Calls `shouldTransition()` to check if state should change.
   - If a transition target is returned, calls `transitionState()`.
   - If the signal is `'milestone-reached'`, sets `lastMilestoneAt` and `lastMilestoneDescription` from signal context.
   - Returns the (possibly updated) state.

2. **`transitionState(state: EmotionalState, newState: DeveloperState): EmotionalState`**
   - Records `previousState = state.currentState`.
   - Sets `currentState = newState`.
   - Sets `stateEnteredAt` to now.
   - Clears `signals` array (fresh start for the new state).
   - Resets `compositeConfidence` to 0.
   - Returns the new state.

3. **`getTransitionRules(): TransitionRule[]`**
   - Returns the built-in transition rules:
     - `focused → stuck`: signals `['repeated-failure', 'long-session-no-build']`, minConfidence 0.5
     - `focused → exploring`: signals `['rapid-task-abandonment']`, minConfidence 0.3
     - `focused → fatigued`: signals `['long-session-no-build', 'velocity-drop']`, minConfidence 0.6
     - `stuck → frustrated`: signals `['repeated-failure', 'negative-commit-message', 'rapid-undo']`, minConfidence 0.6
     - `stuck → focused`: signals `['successful-build-after-stuck', 'milestone-reached']`, minConfidence 0.3
     - `exploring → focused`: signals `['successful-build-after-stuck', 'milestone-reached']`, minConfidence 0.3
     - `exploring → stuck`: signals `['repeated-failure']`, minConfidence 0.5
     - `frustrated → focused`: signals `['successful-build-after-stuck', 'milestone-reached']`, minConfidence 0.3
     - `frustrated → celebrating`: signals `['milestone-reached']`, minConfidence 0.5
     - `fatigued → focused`: signals `['successful-build-after-stuck', 'milestone-reached']`, minConfidence 0.3
     - Any state → `celebrating`: signals `['milestone-reached']`, minConfidence 0.8
     - `celebrating → focused`: signals `['repeated-failure', 'velocity-drop']`, minConfidence 0.3

4. **`shouldTransition(currentState: DeveloperState, signals: WellbeingSignal[]): DeveloperState | undefined`**
   - Filters signals to only those from the last 10 minutes.
   - Gets transition rules where `from === currentState`.
   - For each rule: checks if any of the rule's `triggerSignals` appear in the filtered signals AND the composite confidence of matching signals >= `minConfidence`.
   - Returns the `to` state of the first matching rule, or `undefined` if none match.
   - Priority: check specific state transitions first, then the "any state → celebrating" wildcard rule last.

5. **`createInitialState(sessionId: string): EmotionalState`**
   - Returns a new `EmotionalState` starting in `'focused'`:
     - `sessionId` from parameter.
     - `currentState: 'focused'`.
     - `previousState: undefined`.
     - `stateEnteredAt: new Date().toISOString()`.
     - `signals: []`.
     - `compositeConfidence: 0`.
     - No cooldown, no milestone.

6. **`getStateAge(state: EmotionalState): number`**
   - Returns the number of minutes since `stateEnteredAt` (rounded down).
   - Uses `Math.floor((Date.now() - new Date(state.stateEnteredAt).getTime()) / 60000)`.

### Required Tests (minimum 18)

Write these in `src/wellbeing/state-machine.test.ts`:

1. **createInitialState starts in focused** — verify currentState is 'focused'.
2. **createInitialState has empty signals** — verify signals array is empty.
3. **createInitialState has zero compositeConfidence** — verify 0.
4. **processSignal adds signal to state** — process one signal, verify signals.length is 1.
5. **processSignal recalculates compositeConfidence** — process signal with confidence 0.7, verify compositeConfidence > 0.
6. **processSignal sets milestone fields on milestone signal** — verify lastMilestoneAt and lastMilestoneDescription set.
7. **focused → stuck on repeated-failure with sufficient confidence** — verify transition.
8. **focused stays focused on low-confidence signal** — confidence below threshold, no transition.
9. **stuck → frustrated on negative-commit-message** — verify transition.
10. **stuck → focused on successful-build-after-stuck** — verify recovery transition.
11. **frustrated → focused on milestone-reached** — verify recovery.
12. **frustrated → celebrating on high-confidence milestone** — verify transition.
13. **fatigued → focused on successful-build-after-stuck** — verify recovery.
14. **any state → celebrating on high-confidence milestone** — from exploring, verify transition to celebrating.
15. **celebrating → focused on repeated-failure** — verify transition back.
16. **transitionState records previousState** — verify previousState set to old currentState.
17. **transitionState clears signals** — verify signals array is empty after transition.
18. **transitionState resets compositeConfidence** — verify 0 after transition.
19. **getStateAge returns minutes since stateEnteredAt** — state entered 5 minutes ago, verify returns 5.
20. **shouldTransition returns undefined when no rules match** — focused state with no signals, verify undefined.
21. **getTransitionRules returns all defined rules** — verify at least 12 rules returned.

---

## KIMI-WELLBEING-03: Intervention Strategy Engine

### Files to Create

- `src/wellbeing/intervention-engine.ts`
- `src/wellbeing/intervention-engine.test.ts`

### Purpose

The intervention engine determines when and how to gently intervene based on the developer's emotional state. Interventions are always framed as offers — never assessments of the developer's emotional state. The engine enforces cooldown periods and per-session limits to avoid being intrusive.

### Interfaces to Implement

All interfaces must be exported from `src/wellbeing/intervention-engine.ts`:

```typescript
export type InterventionType =
  | 'alternative-approach-offer'
  | 'explanation-offer'
  | 'break-suggestion'
  | 'milestone-acknowledgment'
  | 'session-summary';

export interface InterventionStrategy {
  id: string;
  triggerState: DeveloperState;
  type: InterventionType;
  minimumStateAgeMinutes: number;
  cooldownMinutes: number;
  messageTemplate: string;
  requiresResponse: boolean;       // default: false
  maxPerSession: number;           // default: 1
}

export interface InterventionRecord {
  strategyId: string;
  deliveredAt: string;
  sessionId: string;
}
```

Import `DeveloperState`, `WellbeingConfig`, `EmotionalState` from their respective modules.

### Class to Implement

```typescript
export class InterventionEngine {
  constructor(config?: Partial<WellbeingConfig>);
}
```

The engine tracks intervention delivery counts internally via a `Map<string, InterventionRecord[]>` keyed by `sessionId + strategyId`.

### Functions (all instance methods on `InterventionEngine`)

1. **`getStrategies(): InterventionStrategy[]`**
   - Returns the built-in intervention strategies:
     - **stuck → alternative-approach-offer**: `minimumStateAgeMinutes: 30`, `cooldownMinutes: 15`, `messageTemplate: "I notice this has been challenging. Would you like me to suggest an alternative approach to {{context}}?"`, `requiresResponse: false`, `maxPerSession: 2`.
     - **frustrated → explanation-offer**: `minimumStateAgeMinutes: 5`, `cooldownMinutes: 20`, `messageTemplate: "Would it help if I explained what might be going wrong with {{context}}? Sometimes a different perspective helps."`, `requiresResponse: false`, `maxPerSession: 2`.
     - **fatigued → break-suggestion**: `minimumStateAgeMinutes: 90`, `cooldownMinutes: 30`, `messageTemplate: "You have been working for a while. This might be a good moment to take a short break. Your progress will be here when you get back."`, `requiresResponse: false`, `maxPerSession: 1`.
     - **celebrating → milestone-acknowledgment**: `minimumStateAgeMinutes: 0`, `cooldownMinutes: 5`, `messageTemplate: "Nice work on {{milestone}}. That is solid progress."`, `requiresResponse: false`, `maxPerSession: 3`.
   - Each strategy gets a deterministic `id` (e.g., `'strategy-stuck-alternative'`, `'strategy-frustrated-explanation'`, `'strategy-fatigued-break'`, `'strategy-celebrating-milestone'`).

2. **`shouldIntervene(state: EmotionalState): InterventionStrategy | undefined`**
   - Returns `undefined` if `interventionsEnabled` is false in config.
   - Gets strategies where `triggerState === state.currentState`.
   - For each matching strategy:
     - Checks if `getStateAge(state) >= strategy.minimumStateAgeMinutes` (use the age calculated from `state.stateEnteredAt`).
     - Checks `isOnCooldown(state)` — if true, skip.
     - Checks if the delivery count for this strategy in this session < `maxPerSession`.
   - Returns the first strategy that passes all checks, or `undefined`.

3. **`formatMessage(strategy: InterventionStrategy, context: Record<string, string>): string`**
   - Replaces `{{key}}` placeholders in `strategy.messageTemplate` with values from `context`.
   - If a placeholder key is not in `context`, leaves it as-is.
   - Returns the formatted message string.

4. **`recordIntervention(state: EmotionalState, strategy: InterventionStrategy): EmotionalState`**
   - Records the intervention delivery: adds to internal tracking map.
   - Sets `state.interventionCooldownUntil` to `new Date(Date.now() + strategy.cooldownMinutes * 60000).toISOString()`.
   - Returns the updated state.

5. **`isOnCooldown(state: EmotionalState): boolean`**
   - Returns `true` if `state.interventionCooldownUntil` is defined and is in the future.
   - Returns `false` otherwise.

### Required Tests (minimum 18)

Write these in `src/wellbeing/intervention-engine.test.ts`:

1. **getStrategies returns 4 built-in strategies** — verify length and types.
2. **getStrategies includes stuck alternative-approach-offer** — verify triggerState and type.
3. **getStrategies includes frustrated explanation-offer** — verify.
4. **getStrategies includes fatigued break-suggestion** — verify.
5. **getStrategies includes celebrating milestone-acknowledgment** — verify.
6. **shouldIntervene returns undefined for focused state** — no strategy targets focused.
7. **shouldIntervene returns undefined when interventions disabled** — config `interventionsEnabled: false`.
8. **shouldIntervene returns undefined for stuck state under 30 minutes** — state age 15 min.
9. **shouldIntervene returns strategy for stuck state over 30 minutes** — state age 35 min, verify alternative-approach-offer.
10. **shouldIntervene returns strategy for frustrated state over 5 minutes** — verify explanation-offer.
11. **shouldIntervene returns strategy for fatigued state over 90 minutes** — verify break-suggestion.
12. **shouldIntervene returns strategy for celebrating state immediately** — minimumStateAgeMinutes is 0.
13. **shouldIntervene returns undefined when on cooldown** — cooldownUntil in future.
14. **shouldIntervene returns undefined when maxPerSession reached** — deliver 2 stuck interventions, verify third blocked.
15. **formatMessage replaces placeholders** — template with `{{context}}`, verify replaced.
16. **formatMessage leaves unknown placeholders** — template with `{{unknown}}`, verify kept as-is.
17. **formatMessage handles multiple placeholders** — template with `{{context}}` and `{{milestone}}`, verify both replaced.
18. **recordIntervention sets cooldownUntil** — verify cooldownUntil is in the future.
19. **isOnCooldown returns true when cooldown active** — set cooldownUntil to future timestamp.
20. **isOnCooldown returns false when cooldown expired** — set cooldownUntil to past timestamp.
21. **isOnCooldown returns false when no cooldown set** — undefined cooldownUntil.

---

## KIMI-WELLBEING-04: Tone Adaptation Profiles

### Files to Create

- `src/wellbeing/tone-adapter.ts`
- `src/wellbeing/tone-adapter.test.ts`

### Purpose

The tone adapter adjusts agent communication style based on the developer's current emotional state. When a developer is frustrated, responses become shorter, more direct, and result-first. When exploring, responses give more context. When celebrating, acknowledgment is more frequent. State is transient — when the developer returns to `focused`, the personality engine's base settings resume. The adapter never uses emoji (`useEmoji: false` for all profiles).

### Interfaces to Implement

All interfaces must be exported from `src/wellbeing/tone-adapter.ts`:

```typescript
export interface ToneProfile {
  state: DeveloperState;
  maxResponseLength: 'short' | 'medium' | 'long';
  technicalDepth: 'minimal' | 'standard' | 'detailed';
  acknowledgmentFrequency: 'never' | 'milestones-only' | 'regular';
  useEmoji: false;
  ledeStyle: 'result-first' | 'context-first';
}
```

Import `DeveloperState` from `./signal-detector.js`.

### Class to Implement

```typescript
export class ToneAdapter {
  constructor();
}
```

### Built-in Profiles

The following profiles are the defaults. All have `useEmoji: false`:

| State | maxResponseLength | technicalDepth | acknowledgmentFrequency | ledeStyle |
|---|---|---|---|---|
| `focused` | `long` | `detailed` | `milestones-only` | `result-first` |
| `exploring` | `medium` | `standard` | `regular` | `context-first` |
| `stuck` | `medium` | `standard` | `milestones-only` | `result-first` |
| `frustrated` | `short` | `minimal` | `never` | `result-first` |
| `fatigued` | `short` | `minimal` | `milestones-only` | `result-first` |
| `celebrating` | `medium` | `standard` | `regular` | `result-first` |

### Functions (all instance methods on `ToneAdapter`)

1. **`getProfile(state: DeveloperState): ToneProfile`**
   - Returns the tone profile for the given state from the built-in profiles map.

2. **`getDefaultProfiles(): Map<DeveloperState, ToneProfile>`**
   - Returns a `Map` containing all 6 built-in profiles, keyed by `DeveloperState`.

3. **`adjustResponseLength(content: string, profile: ToneProfile): string`**
   - Counts words in `content` (split by whitespace).
   - If `profile.maxResponseLength === 'short'` and word count > 100: truncate to first 100 words, append `"..."`.
   - If `profile.maxResponseLength === 'medium'` and word count > 300: truncate to first 300 words, append `"..."`.
   - If `profile.maxResponseLength === 'long'`: no truncation.
   - Returns the (possibly truncated) content string.

4. **`shouldAcknowledge(profile: ToneProfile, isMilestone: boolean): boolean`**
   - If `profile.acknowledgmentFrequency === 'never'`: return `false`.
   - If `profile.acknowledgmentFrequency === 'milestones-only'`: return `isMilestone`.
   - If `profile.acknowledgmentFrequency === 'regular'`: return `true`.

5. **`formatLede(content: string, profile: ToneProfile): string`**
   - Splits content into sentences (split on `. ` followed by an uppercase letter, or on `.\n`).
   - If fewer than 2 sentences, returns content as-is.
   - If `profile.ledeStyle === 'result-first'`: returns content unchanged (assumes content is already written result-first by the agent).
   - If `profile.ledeStyle === 'context-first'`: moves the last sentence to the beginning, prefixed with `"Context: "`. This is a simple heuristic — the last sentence is assumed to be the result, and moving it first gives context before the conclusion.
   - Returns the reformatted content.

### Required Tests (minimum 16)

Write these in `src/wellbeing/tone-adapter.test.ts`:

1. **getProfile returns focused profile** — verify maxResponseLength 'long', technicalDepth 'detailed'.
2. **getProfile returns frustrated profile** — verify maxResponseLength 'short', technicalDepth 'minimal'.
3. **getProfile returns exploring profile** — verify ledeStyle 'context-first'.
4. **getProfile returns stuck profile** — verify maxResponseLength 'medium'.
5. **getProfile returns fatigued profile** — verify maxResponseLength 'short'.
6. **getProfile returns celebrating profile** — verify acknowledgmentFrequency 'regular'.
7. **All profiles have useEmoji false** — iterate all profiles, verify useEmoji is false.
8. **getDefaultProfiles returns 6 profiles** — verify map size is 6.
9. **adjustResponseLength truncates to 100 words for short** — 200-word content, short profile, verify <= 100 words + "...".
10. **adjustResponseLength truncates to 300 words for medium** — 500-word content, medium profile, verify <= 300 words + "...".
11. **adjustResponseLength does not truncate for long** — 500-word content, long profile, verify unchanged.
12. **adjustResponseLength does not truncate short content** — 50-word content, short profile, verify unchanged.
13. **shouldAcknowledge returns false for never** — frustrated profile, any milestone flag.
14. **shouldAcknowledge returns true for milestones-only when milestone** — focused profile, isMilestone true.
15. **shouldAcknowledge returns false for milestones-only when not milestone** — focused profile, isMilestone false.
16. **shouldAcknowledge returns true for regular regardless** — exploring profile, isMilestone false, verify true.
17. **formatLede returns content unchanged for result-first** — verify no modification.
18. **formatLede handles single sentence** — returns as-is.
19. **formatLede reorders for context-first** — multi-sentence content, verify last sentence moved to front with "Context: " prefix.

---

## KIMI-WELLBEING-05: Session Awareness & Integration

### Files to Create

- `src/wellbeing/session-tracker.ts`
- `src/wellbeing/session-tracker.test.ts`
- `src/wellbeing/wellbeing-index.ts`
- `src/wellbeing/wellbeing-index.test.ts`

### Files to Modify

- `src/orchestrator/ralph-loop.ts` — **ADD** two new fields to `RalphLoopOptions`

### Purpose

The session tracker monitors a work session from start to finish, recording builds, tasks, milestones, state visits, and generating a narrative summary at session end. The barrel export wires all wellbeing modules together. The Ralph Loop modification adds the wellbeing configuration entry point.

### Class: `SessionTracker`

```typescript
export class SessionTracker {
  constructor(config?: Partial<WellbeingConfig>);
}
```

Import `WellbeingConfig`, `DeveloperState` from `./signal-detector.js`.

### Interfaces to Implement

All interfaces must be exported from `src/wellbeing/session-tracker.ts`:

```typescript
export interface SessionSummary {
  sessionId: string;
  projectId: string;
  startedAt: string;
  endedAt: string;
  durationMinutes: number;
  buildsCompleted: number;
  tasksCompleted: number;
  linesChanged: number;
  milestonesReached: string[];
  statesVisited: DeveloperState[];
  peakFrustrationSignals: number;
  recoveries: number;
  narrativeSummary: string;
}
```

### Functions (all instance methods on `SessionTracker`)

1. **`startSession(projectId: string): SessionSummary`**
   - Creates a new `SessionSummary` with:
     - `sessionId`: `crypto.randomUUID()`
     - `projectId` from parameter
     - `startedAt`: `new Date().toISOString()`
     - `endedAt`: `''` (not ended yet)
     - `durationMinutes`: `0`
     - `buildsCompleted`: `0`
     - `tasksCompleted`: `0`
     - `linesChanged`: `0`
     - `milestonesReached`: `[]`
     - `statesVisited`: `['focused']` (initial state)
     - `peakFrustrationSignals`: `0`
     - `recoveries`: `0`
     - `narrativeSummary`: `''`

2. **`recordBuild(session: SessionSummary, success: boolean): SessionSummary`**
   - Returns a new `SessionSummary` with `buildsCompleted` incremented by 1 if `success` is true.
   - If `success` is false, `buildsCompleted` stays the same but `peakFrustrationSignals` increments by 1.
   - Returns a new object (immutable pattern).

3. **`recordTask(session: SessionSummary): SessionSummary`**
   - Returns a new `SessionSummary` with `tasksCompleted` incremented by 1.

4. **`recordMilestone(session: SessionSummary, description: string): SessionSummary`**
   - Returns a new `SessionSummary` with `description` appended to `milestonesReached`.

5. **`recordStateVisit(session: SessionSummary, state: DeveloperState): SessionSummary`**
   - Adds `state` to `statesVisited` only if not already present (unique).
   - If `state` is `'focused'` and the previous last entry in `statesVisited` was `'frustrated'` or `'stuck'`, increments `recoveries` by 1.
   - Returns a new `SessionSummary`.

6. **`computeVelocity(session: SessionSummary): number`**
   - Returns `buildsCompleted / (durationMinutes / 60)` — successful builds per hour.
   - If `durationMinutes` is 0, returns 0.
   - Rounds to 2 decimal places.

7. **`endSession(session: SessionSummary): SessionSummary`**
   - Sets `endedAt` to `new Date().toISOString()`.
   - Computes `durationMinutes` as the difference between `endedAt` and `startedAt` in minutes (rounded down).
   - Sets `narrativeSummary` via `generateNarrative()`.
   - Returns the completed `SessionSummary`.

8. **`generateNarrative(session: SessionSummary): string`**
   - Generates a human-readable summary string:
     - Always starts with: `"You worked for ${durationMinutes} minutes, completed ${buildsCompleted} successful builds and ${tasksCompleted} tasks."`
     - If `milestonesReached.length > 0`: appends `" Milestones: ${milestonesReached.join(', ')}."`
     - If `recoveries > 0`: appends `" You hit some rough patches but recovered ${recoveries} time(s) — nice resilience."`
     - If `peakFrustrationSignals > 0` and `recoveries === 0`: appends `" There were some challenging moments."`
   - Returns the complete narrative string.

### Barrel Export: `src/wellbeing/wellbeing-index.ts`

Create a barrel export that re-exports from all wellbeing modules:

```typescript
export * from './signal-detector.js';
export * from './state-machine.js';
export * from './intervention-engine.js';
export * from './tone-adapter.js';
export * from './session-tracker.js';
```

### Modification to `src/orchestrator/ralph-loop.ts`

Add these two lines to the `RalphLoopOptions` interface, **after** the existing configs (after the agent memory fields if present, or after the last config field):

```typescript
  // Developer wellbeing (R16-05)
  wellbeingEnabled?: boolean;
  wellbeingConfig?: WellbeingConfig;
```

Add the import at the top of the file:

```typescript
import type { WellbeingConfig } from '../wellbeing/signal-detector.js';
```

**That is the ONLY change to ralph-loop.ts.** Do not modify any functions.

### Required Tests (minimum 18)

Write these in `src/wellbeing/session-tracker.test.ts`:

1. **startSession creates session with correct projectId** — verify projectId set.
2. **startSession starts in focused state** — verify statesVisited contains 'focused'.
3. **startSession has zero counters** — verify buildsCompleted, tasksCompleted, linesChanged all 0.
4. **startSession has empty endedAt** — verify endedAt is ''.
5. **startSession generates UUID sessionId** — verify sessionId is a valid UUID format.
6. **recordBuild increments buildsCompleted on success** — verify +1.
7. **recordBuild increments peakFrustrationSignals on failure** — verify +1.
8. **recordBuild does not increment buildsCompleted on failure** — verify unchanged.
9. **recordTask increments tasksCompleted** — verify +1.
10. **recordMilestone appends to milestonesReached** — verify array grows.
11. **recordStateVisit adds unique state** — add 'stuck', verify in statesVisited.
12. **recordStateVisit does not duplicate state** — add 'focused' twice, verify only one entry.
13. **recordStateVisit increments recoveries on frustrated→focused** — verify recoveries +1.
14. **computeVelocity returns builds per hour** — 6 builds in 60 minutes, verify 6.0.
15. **computeVelocity returns 0 for zero duration** — verify 0.
16. **endSession sets endedAt** — verify endedAt is non-empty ISO string.
17. **endSession computes durationMinutes** — verify positive number.
18. **generateNarrative includes duration and builds** — verify string contains minutes and build count.
19. **generateNarrative includes milestones** — session with milestones, verify "Milestones:" in narrative.
20. **generateNarrative includes recovery note** — session with recoveries > 0, verify "recovered" in narrative.
21. **generateNarrative includes challenging note when frustration but no recovery** — verify "challenging" in narrative.

Write these in `src/wellbeing/wellbeing-index.test.ts`:

1. **Barrel exports SignalDetector** — import and verify defined.
2. **Barrel exports EmotionalStateMachine** — import and verify defined.
3. **Barrel exports InterventionEngine** — import and verify defined.
4. **Barrel exports ToneAdapter** — import and verify defined.
5. **Barrel exports SessionTracker** — import and verify defined.
6. **Barrel exports WellbeingConfig type** — verify type is importable (use a config object assignment).
7. **Barrel exports DeveloperState type** — verify type is importable.
8. **Barrel exports WellbeingSignal interface** — verify type is importable.
9. **Barrel exports EmotionalState interface** — verify type is importable.
10. **Barrel exports SessionSummary interface** — verify type is importable.

---

## Final Checklist

After completing all 5 tasks, verify:

```bash
npx tsc --noEmit        # 0 errors
npx vitest run           # 2081+ tests (target: 90+ new = 2171+)
```

New files created:
- `src/wellbeing/signal-detector.ts`
- `src/wellbeing/signal-detector.test.ts`
- `src/wellbeing/state-machine.ts`
- `src/wellbeing/state-machine.test.ts`
- `src/wellbeing/intervention-engine.ts`
- `src/wellbeing/intervention-engine.test.ts`
- `src/wellbeing/tone-adapter.ts`
- `src/wellbeing/tone-adapter.test.ts`
- `src/wellbeing/session-tracker.ts`
- `src/wellbeing/session-tracker.test.ts`
- `src/wellbeing/wellbeing-index.ts`
- `src/wellbeing/wellbeing-index.test.ts`

Modified files:
- `src/orchestrator/ralph-loop.ts` (2 new fields + 1 import only)
