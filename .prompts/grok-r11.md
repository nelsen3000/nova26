# GROK-R11: Nova26 Transformative Capabilities Research Prompt

> Assigned to: Grok
> Round: R11 (post-R10)
> Date issued: 2026-02-18
> Status: Active

---

## Context Brief

Nova26 is a 21-agent AI-powered IDE built with TypeScript, Ollama, and Convex. The 21 agents
are named after celestial bodies (MARS, VENUS, MERCURY, JUPITER, SATURN, PLUTO, etc.) and
operate through a core execution engine called the Ralph Loop (`src/orchestrator/ralph-loop.ts`),
which drives a Generator -> Reflector -> Curator cycle (ACE) for iterative quality improvement.

**Current state of the build:**
- R1-R10 covered: tool use, inner loops, Taste Vault, Global Wisdom Pipeline, Premium Buyer
  Experience, ACE specs, Rehearsal Stage, Self-Improvement Protocol, Real-Time Collaboration,
  Competitive Moat, Semantic Similarity Engine, Convex Real-Time Architecture, Launch/GTM,
  Security/Privacy, Ollama Model Strategy, Plugin Ecosystem, Team/Enterprise, CI/CD Integration,
  Advanced Analytics, Onboarding & Education, Error Recovery, Performance Optimization,
  Testing at Scale, Accessibility/i18n, Long-Term Architecture.
- Kimi has built: inner loop, Taste Vault + Global Wisdom, ACE + Rehearsal + Self-Improvement,
  similarity engine, Convex real-time, security, model routing, analytics.
  1226 tests passing, 0 TypeScript errors.
- Premium pricing: $299/month. Path A: Opt-In Global Wisdom Layer. Local-first with Ollama.
- R11 pushes into genuinely new transformative territory: multi-modal perception, voice
  interfaces, objective quality measurement, knowledge graph visualization, and autonomous
  end-to-end project generation. These are the features that will define Nova26 as a category
  leader rather than a well-engineered tool.

**Your style:** Open each deliverable with a big-picture analogy that makes the architecture
click instantly. Then go deep — TypeScript interfaces, method signatures, file structure, flow
diagrams in ASCII or prose. Every spec must be ready-to-implement or ready-to-research: a
developer or researcher should be able to pick it up without reading R1-R10.

---

## Deliverables

Label each section clearly: GROK-R11-01, GROK-R11-02, etc.

---

### GROK-R11-01: Multi-Modal Agent Capabilities

**The ask:** Today Nova26's agents are blind. They read text, they write text, they reason
over text. But software development is not a text-only discipline — a developer hands a
designer's Figma screenshot to a colleague and says "build this." A senior engineer sketches
an architecture diagram on a whiteboard and photographs it to send to the team. A product
manager uploads a wireframe and asks "does the current component match this?" Nova26's agents
need eyes. This deliverable designs the complete vision pipeline: how agents ingest images,
how they generate diagrams, and how they close the loop between visual intent and implemented
code. The analogy: adding vision to Nova26's agents is like giving a master watchmaker a
loupe — the mechanism was already precise, but now the craftsman can see the hairspring.

Produce a complete, ready-to-code specification covering:

1. **The big-picture analogy.** One paragraph. Multi-modal perception in a code-generation
   agent is like what shift in human cognition? The key insight is that vision is not a
   separate capability bolted on — it is a new input channel that feeds the same ReAct loop.
   A vision-capable agent does not "switch modes"; it adds image understanding to its existing
   tool inventory, the same way a skilled surgeon learns ultrasound-guided procedures — the
   hands do the same work, but the eyes now have a new instrument. The analogy should make
   clear why the ReAct loop needs new tools (`visualize`, `screenshot`, `describe_image`)
   rather than a separate code path.

2. **Ollama vision model survey (2026).** Research and specify:
   - Which vision models are available via Ollama as of 2026?
     - LLaVA (1.5, 1.6) — specify which variants, context window, quality tier
     - Moondream2 — small, fast, good for UI element recognition
     - LLaVA-Phi-3 — hybrid reasoning + vision
     - BakLLaVA — Mistral backbone + LLaVA vision
     - Any Qwen-VL or InternVL models available via Ollama?
   - For each model: what is the Ollama model tag, approximate VRAM requirement, input
     resolution (max image size in pixels), and best use case in Nova26's context?
   - Which model is recommended as the default for each Nova26 vision task?
     - UI mockup → code: LLaVA-1.6 (34B) or Moondream2?
     - Architecture diagram recognition: LLaVA-1.6?
     - Screenshot diff (component vs design): Moondream2 for speed?
   - How does a vision model call differ from a text call in the Ollama Node.js client?
     (Show the API call with `images: [base64string]` parameter)

3. **VisionInput pipeline.** Design the complete image ingestion flow:
   - What image formats are supported? (PNG, JPEG, WebP, SVG — SVG requires rasterization)
   - What is the maximum image size, and how are oversized images handled?
     (Resize to fit model's max resolution before sending; preserve aspect ratio)
   - Where do images come from?
     - User uploads: drag-and-drop in Nova26 CLI? File path argument? `--image ./mockup.png`?
     - Screenshot capture: `screenshot` tool that captures the current state of a running
       dev server (uses `puppeteer` or system screenshot tools)
     - Agent-generated diagrams: output of the `visualize` tool fed back as input
   - How is image data passed through the ReAct loop? (Base64 in the tool result? Stored
     to `.nova/vision-cache/` with a UUID reference passed through the loop?)
   - How is vision context preserved across ACE cycles?
     (Image reference stored in scratchpad? Re-attached on each cycle?)

   Provide the full TypeScript interfaces:

   ```typescript
   interface VisionInput {
     id: string;                       // UUID, used as reference throughout the loop
     sourceType: 'upload' | 'screenshot' | 'agent-generated';
     filePath: string;                 // absolute path to the image on disk
     mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
     widthPx: number;
     heightPx: number;
     sizeBytes: number;
     base64?: string;                  // populated lazily when needed for Ollama call
     description?: string;             // human-readable label ("Figma mockup for auth page")
     capturedAt: string;               // ISO timestamp
   }

   interface VisionContext {
     inputs: VisionInput[];
     primaryInput?: string;            // VisionInput.id of the "main" image for this task
     analysisCache: Record<string, ImageAnalysisResult>;  // id → cached analysis
   }

   interface ImageAnalysisResult {
     visionInputId: string;
     model: string;                    // which Ollama vision model was used
     description: string;              // what the model sees
     uiElements?: UIElement[];         // for mockup analysis
     codeHints?: string[];             // inferred implementation hints
     analyzedAt: string;
   }

   interface UIElement {
     type: 'button' | 'input' | 'card' | 'nav' | 'modal' | 'table' | 'chart' | 'unknown';
     label?: string;                   // text visible in the element
     position: { x: number; y: number; width: number; height: number };
     confidence: number;               // 0-1
   }
   ```

4. **New ReAct tools: `visualize`, `screenshot`, `describe_image`.** Design each tool:

   **`describe_image` tool:**
   - Purpose: takes a `VisionInput` id and returns a detailed text description of the image
   - Parameters: `{ visionInputId: string; focus?: string }` — `focus` narrows the query
     (e.g., "focus on the navigation component")
   - Returns: `ImageAnalysisResult`
   - Caches results in `VisionContext.analysisCache` to avoid redundant model calls
   - Integration: the tool handler calls Ollama with the vision model and the image bytes

   **`screenshot` tool:**
   - Purpose: captures the current rendered state of the dev server for visual diff
   - Parameters: `{ url: string; selector?: string }` — optional CSS selector to capture
     a specific component
   - Returns: a new `VisionInput` with `sourceType: 'screenshot'`
   - Implementation: uses `puppeteer` (add as optional dependency) or falls back to system
     screenshot (`screencapture` on macOS, `import` on Linux)
   - When `puppeteer` is not installed, emit a clear warning and skip tool

   **`visualize` tool:**
   - Purpose: generates a diagram from structured data (architecture, ERD, flow chart)
   - Parameters: `{ type: 'architecture' | 'erd' | 'flowchart' | 'sequence'; data: unknown }`
   - Returns: `DiagramOutput`
   - Implementation: uses Mermaid.js to render diagrams (no browser required; `mermaid-js/mermaid`
     has a Node.js rendering path via `@mermaid-js/mermaid-zx` or similar)
   - The output SVG/PNG is stored to `.nova/vision-cache/` and returned as a `VisionInput`
     for downstream agents to analyze

   Provide the TypeScript interfaces:

   ```typescript
   interface DiagramOutput {
     id: string;
     type: 'architecture' | 'erd' | 'flowchart' | 'sequence';
     format: 'svg' | 'png';
     filePath: string;
     mermaidSource: string;            // the Mermaid DSL source for reproducibility
     generatedAt: string;
     visionInputRef: string;           // VisionInput.id pointing to the rendered image
   }

   interface UIPreviewResult {
     screenshotBefore: VisionInput;    // current rendered state
     screenshotAfter?: VisionInput;    // rendered state after agent's code changes
     designReference?: VisionInput;   // the Figma/mockup image the agent is targeting
     matchScore?: number;              // 0-1, visual similarity between after and design
     discrepancies?: string[];         // list of identified visual differences
   }

   interface VisionTool {
     name: 'describe_image' | 'screenshot' | 'visualize';
     execute(params: unknown, context: VisionContext): Promise<string>;
   }
   ```

5. **Integration with the ReAct loop.** Show how vision tools plug into the existing tool
   registry in `src/agent-loop/agent-loop.ts`:
   - Vision tools are registered alongside existing tools (`read_file`, `write_file`,
     `run_tests`, etc.) — no new code path is needed
   - `RalphLoopOptions.visionEnabled` gates whether vision tools are registered
   - `VisionContext` is attached to the task's scratchpad when vision is enabled
   - The `describe_image` tool is pre-invoked on any `VisionInput` passed with the task
     before the first ACE cycle (eager analysis)
   - Show the additions to `RalphLoopOptions`:

   ```typescript
   // New in R11:
   visionEnabled?: boolean;
   visionModel?: string;               // e.g., 'llava:13b', overrides default
   screenshotEnabled?: boolean;        // requires puppeteer installed
   diagramGeneration?: boolean;
   ```

   Provide pseudocode for the vision-aware `processTask()` extension showing where
   `VisionContext` is created, where image analysis is pre-run, and how `UIPreviewResult`
   is generated at the end of a UI-targeted task.

6. **UI mockup → code workflow.** Design the end-to-end flow:
   - User provides: a screenshot or Figma export at `./designs/auth-page.png`
   - Task description: "Build the login form shown in auth-page.png"
   - Agent (MARS or VENUS): receives the task with the image attached
   - ACE cycle 1: `describe_image` → extract UI elements → generate component scaffold
   - ACE cycle 2: Reflector checks generated code against image description; if mismatch,
     flag specific discrepancies
   - ACE cycle 3: Curator runs `screenshot` tool against the dev server to visually verify
   - Output: code + `UIPreviewResult` with before/after screenshots and match score

7. **File structure.** Specify:
   - `src/vision/vision-input.ts` — `VisionInput` type, image loading, resizing
   - `src/vision/image-analyzer.ts` — `describe_image` implementation, Ollama vision calls
   - `src/vision/screenshot-tool.ts` — `screenshot` tool with `puppeteer` integration
   - `src/vision/diagram-generator.ts` — `visualize` tool with Mermaid.js
   - `src/vision/vision-context.ts` — `VisionContext` lifecycle management
   - `src/vision/ui-preview.ts` — `UIPreviewResult` generation and match scoring
   - `src/vision/index.ts` — unified export and tool registration helper
   - `.nova/vision-cache/` — runtime directory for image storage (added to `.gitignore`)

8. **Open questions for the build team.** List 3-5 questions that must be answered before
   implementation begins.

---

### GROK-R11-02: Voice & Natural Language Interface

**The ask:** A developer working hands-deep in a debugging session should be able to say
"Hey Nova, ask MARS to add input validation to the registration form" and have it happen —
without touching the keyboard. Voice is not a novelty feature. For developers with repetitive
strain injuries, visual impairments, or simply full hands, voice is the difference between
a tool they can use and one they cannot. For the rest, it is the fastest possible input
channel for high-level commands. The analogy: adding voice to Nova26 is like giving an air
traffic controller a radio headset — the controller already knows how to direct traffic,
but now the commands flow at the speed of thought rather than the speed of typing.

Produce a complete, ready-to-code specification covering:

1. **The big-picture analogy.** One paragraph. A local-first voice interface for a dev tool
   is like what other system where low-latency, private, on-device processing is required?
   The key insight is that cloud-based speech APIs (Google, AWS, Azure) introduce a privacy
   violation that is incompatible with Nova26's local-first model — a developer's spoken
   commands include project context, file names, and architectural decisions that should
   never leave the machine. The right analogy should capture the "same quality as cloud,
   runs entirely on your hardware" positioning that makes `whisper.cpp` the obvious choice.

2. **Speech-to-text engine selection.** Research and specify:
   - `whisper.cpp` — the C++ port of OpenAI's Whisper; runs locally, fast on Apple Silicon
     via Metal; available via `whisper-node` npm wrapper. Evaluate this as the primary choice.
   - Whisper via Ollama — as of 2026, does Ollama support Whisper models natively?
     If so, using `ollama` client for STT unifies the local model interface.
   - `faster-whisper` — Python-based; requires Python runtime; acceptable as a fallback
     for Linux users?
   - For each option: latency for a 5-second voice command on M1 MacBook (16GB),
     language support (how many languages?), accuracy on technical vocabulary
     ("deepseek", "Ollama", "MARS agent", "ReAct loop"), and npm/integration complexity.
   - Recommend one primary engine and one fallback. Justify the recommendation.
   - What Whisper model size is recommended? (tiny, base, small, medium, large)
     Consider: accuracy vs. latency tradeoff for short voice commands (5-15 seconds).

3. **Voice command grammar.** Design the command language:
   - Nova26 voice commands follow a natural language pattern, not a rigid grammar.
     The STT output is a transcript; an LLM (a small, fast model) interprets intent.
   - Define the command categories with examples:

   | Category | Example utterance | Parsed intent |
   |---|---|---|
   | Agent directive | "Ask MARS to refactor the auth module" | `{ agent: 'MARS', action: 'refactor', target: 'auth module' }` |
   | Build control | "Start a new build for the payments feature" | `{ command: 'start-build', context: 'payments feature' }` |
   | Status query | "What is VENUS working on right now?" | `{ command: 'status', agent: 'VENUS' }` |
   | Vault operation | "Remember that I prefer functional components" | `{ command: 'vault-store', pattern: 'prefer functional components' }` |
   | System control | "Pause the build" | `{ command: 'pause-build' }` |
   | Help | "What can I say?" | `{ command: 'help' }` |

   - How is intent parsing done? (Feed the transcript to a small model — `llama3.2:3b` or
     `qwen2.5:3b` — with a structured output schema for `VoiceCommandIntent`)
   - What is the confidence threshold below which Nova26 asks for confirmation?
     ("I think you said: ask MARS to refactor auth. Is that right? [Y/n]")
   - How are agent names recognized reliably in speech? (All 21 agent names are celestial
     bodies — add them to a custom vocabulary or hotword list if the STT engine supports it)

4. **VoiceCommand pipeline.** Design the complete audio capture → action flow:

   ```
   Microphone → Audio capture (node-microphone or Sox) → VAD (silence detection) →
   Whisper STT → Transcript → Intent parser (small LLM + structured output) →
   VoiceCommandIntent → RalphLoop / VoiceResponse
   ```

   - **Wake word detection:** How does Nova26 know when to start listening?
     - Option A: Push-to-talk keyboard shortcut (e.g., `Ctrl+Space`)
     - Option B: Continuous listening with wake word ("Hey Nova")
     - Option C: CLI trigger (`nova26 voice` starts a listening session)
     - Recommend Option A or C for v1.0 (wake word detection adds complexity and
       latency; push-to-talk is more reliable and battery-friendly)
   - **Voice activity detection (VAD):** How does the system know when the user has
     finished speaking? (Silence for 1.5 seconds ends the utterance)
   - **Audio capture library:** `node-microphone` (npm) vs. `sox` (requires system install)
     vs. `naudiodon` (PortAudio bindings). Recommend with rationale.

   Provide the full TypeScript interfaces:

   ```typescript
   interface VoiceCommand {
     id: string;
     rawTranscript: string;            // verbatim Whisper output
     normalizedTranscript: string;     // lowercased, punctuation stripped
     intent: VoiceCommandIntent;
     confidence: number;               // 0-1, from intent parser
     requiresConfirmation: boolean;    // true if confidence < threshold
     capturedAt: string;
     processingMs: number;             // total STT + intent parse latency
   }

   type VoiceCommandIntent =
     | { type: 'agent-directive'; agent: AgentName; action: string; target?: string }
     | { type: 'start-build'; context?: string }
     | { type: 'pause-build' }
     | { type: 'resume-build' }
     | { type: 'status-query'; agent?: AgentName }
     | { type: 'vault-store'; pattern: string }
     | { type: 'vault-query'; query: string }
     | { type: 'help' }
     | { type: 'unknown'; rawTranscript: string };

   interface SpeechConfig {
     engine: 'whisper-cpp' | 'whisper-ollama' | 'faster-whisper';
     modelSize: 'tiny' | 'base' | 'small' | 'medium' | 'large';
     language: string;                 // ISO 639-1, e.g., 'en', 'zh', 'ja'
     vadSilenceMs: number;             // default 1500
     confidenceThreshold: number;      // default 0.75, below this asks for confirmation
     wakeMode: 'push-to-talk' | 'cli-session';
     pushToTalkKey?: string;           // e.g., 'ctrl+space'
   }
   ```

5. **Voice response (TTS).** Design the agent voice output:
   - When should agents speak vs. just display text?
     - Always: confirmation that a command was understood ("Starting build for auth module.")
     - On completion of a task: "MARS finished the authentication service."
     - On error: "MARS encountered an error. Check the dashboard for details."
     - Never: long-form code output, stack traces, multi-line responses
   - TTS engine options for local, private synthesis:
     - `espeak-ng`: fast, robotic, zero dependencies beyond the binary
     - `say` command (macOS built-in): high quality, macOS-only
     - `piper` (Rhasspy): neural TTS, runs locally, available as npm binary
     - Which Ollama models support TTS as of 2026? (Likely none — document this gap)
   - Recommend `say` on macOS, `espeak-ng` as cross-platform fallback, with `piper` as
     the premium local TTS option for high-quality voice.
   - How is TTS toggled? (`SpeechConfig.ttsEnabled: boolean`, env var `NOVA26_TTS=1`)

   Provide the TypeScript interface:

   ```typescript
   interface VoiceResponse {
     text: string;                     // what to speak
     priority: 'immediate' | 'queued'; // immediate interrupts; queued waits for silence
     agentName?: AgentName;            // for "MARS says: ..."
     ttsEngine: 'say' | 'espeak' | 'piper';
   }

   interface VoiceInterface {
     startListening(config: SpeechConfig): void;
     stopListening(): void;
     speak(response: VoiceResponse): Promise<void>;
     onCommand(handler: (cmd: VoiceCommand) => Promise<void>): void;
     isListening(): boolean;
   }
   ```

6. **Accessibility impact.** Address voice as an accessibility feature:
   - How does voice enable Nova26 for developers with visual impairments?
     (Combined with the screen reader mode from R10-04: voice input + spoken output
     creates a fully accessible CLI experience without a visual display)
   - How does voice enable developers with repetitive strain injuries?
     (Push-to-talk voice commands eliminate keyboard input for high-level directives)
   - What WCAG 2.1 AA criteria does voice input satisfy?
     (Success Criterion 2.1.1: Keyboard — though voice is not keyboard, it provides
     an equivalent access path for users who cannot use a keyboard)
   - Document the combined accessibility profile: screen reader mode + voice = fully
     accessible Nova26. This is a premium differentiator worth marketing.

7. **File structure.** Specify:
   - `src/voice/speech-to-text.ts` — STT engine abstraction, whisper.cpp integration
   - `src/voice/intent-parser.ts` — transcript → `VoiceCommandIntent` via small LLM
   - `src/voice/audio-capture.ts` — microphone, VAD, audio buffer management
   - `src/voice/text-to-speech.ts` — TTS engine abstraction (`say`, `espeak`, `piper`)
   - `src/voice/voice-interface.ts` — `VoiceInterface` orchestrator
   - `src/voice/voice-command-router.ts` — routes `VoiceCommandIntent` to Ralph Loop actions
   - `src/voice/index.ts` — unified export
   - New `RalphLoopOptions` additions:
     ```typescript
     voiceEnabled?: boolean;
     speechConfig?: SpeechConfig;
     ```

8. **Open questions for the build team.** List 3-5 questions.

---

### GROK-R11-03: Code Generation Quality Benchmarks

**The ask:** "Nova26's agents produce high-quality code" is a claim. "Nova26's agents score
78% on our internal benchmark suite, up from 71% last release, with MARS outperforming
GPT-4o on security-sensitive code generation" is evidence. The difference between a claim
and evidence is what separates a product team from a research team. This deliverable designs
the complete quality measurement infrastructure: the benchmark suite, the scoring engine,
the A/B testing framework, and the integration with SWE-bench and HumanEval. The analogy:
code quality benchmarks are to Nova26 what a tachometer and dyno report are to an engine
builder — you can feel if it's fast, but you cannot improve what you do not measure, and you
cannot ship with confidence what you have not dynoed.

Produce a complete, ready-to-code specification covering:

1. **The big-picture analogy.** One paragraph. Building an objective code quality measurement
   system for a multi-agent IDE is like designing a test suite for what other system that
   produces outputs with no single correct answer but clear quality gradients? The key
   insight is that code quality, like wine quality, can be judged along independent dimensions
   (correctness, style, performance, security) that can each be scored independently with
   automated tools — the judgment does not require a human expert for most cases, only for
   the subjective dimensions. The analogy should make clear why automated scoring on
   multiple dimensions is more valuable than a single aggregate score.

2. **Benchmark suite design.** Design the standardized task library:
   - Define 5 benchmark task categories with 10 tasks each (50 total tasks):
     - **Correctness**: implement functions with known outputs (e.g., binary search,
       LRU cache, Fibonacci with memoization); score by test pass rate
     - **Style**: rewrite provided messy code to match a style guide; score by ESLint
       rule compliance and structural similarity to the reference solution
     - **Performance**: optimize a provided slow implementation; score by execution time
       ratio vs. a reference implementation
     - **Security**: identify and fix security vulnerabilities (SQL injection, XSS, path
       traversal, insecure deserialization); score by SAST tool findings before/after
     - **Architecture**: design a module given a spec; score by interface completeness,
       dependency graph quality, and testability heuristics
   - Each task has: a description (what the agent sees), a reference solution (hidden from
     agents), a set of evaluation criteria with weights, and a ground-truth score range.
   - Tasks are versioned (v1.0, v1.1) so benchmark scores are comparable across releases.
   - How are tasks stored? (YAML files in `benchmarks/tasks/<category>/<task-id>.yaml`)

   Provide the TypeScript interface:

   ```typescript
   interface Benchmark {
     id: string;                       // e.g., 'correctness-lru-cache-v1'
     version: string;
     category: 'correctness' | 'style' | 'performance' | 'security' | 'architecture';
     title: string;
     description: string;              // what the agent receives as the task
     referenceSolution?: string;       // hidden from agents
     evaluationCriteria: EvaluationCriterion[];
     timeoutMs: number;                // max time the agent has to complete
     agentAssignment: AgentName;       // which agent is expected to handle this task
   }

   interface EvaluationCriterion {
     name: string;                     // e.g., 'test-pass-rate', 'eslint-violations'
     weight: number;                   // 0-1, sum of all weights in a benchmark = 1
     scorerType: 'test-runner' | 'static-analysis' | 'execution-time' | 'llm-judge';
     scorerConfig: Record<string, unknown>;
   }
   ```

3. **Automated scoring engine.** Design the multi-dimensional scorer:
   - **Correctness scorer**: run the agent's output through the benchmark's test suite;
     score = (passing tests) / (total tests). Requires a sandboxed execution environment.
   - **Style scorer**: run ESLint with Nova26's standard config against the output;
     score = 1 - (violation count / max violations). Track specific rule categories.
   - **Performance scorer**: execute both agent output and reference implementation N times
     (e.g., 100 runs); score = reference_median_ms / agent_median_ms (clamped to [0, 1]).
     Requires sandbox with deterministic CPU (disable turbo boost in CI for benchmarks).
   - **Security scorer**: run `semgrep` or `eslint-plugin-security` against agent output;
     score = 1 - (critical findings * 0.5 + high findings * 0.3 + medium findings * 0.2).
   - **Architecture scorer**: LLM judge — use a separate small model (NOT the agent's model)
     to evaluate the architectural output against defined rubrics. Define the judge prompt.
   - **Sandbox design**: how is agent code executed safely for scoring?
     (Docker container with network disabled? Node.js `vm` module with resource limits?
     Recommend Docker for correctness/performance; `vm` module for quick style scoring.)

   Provide the TypeScript interfaces:

   ```typescript
   interface QualityScore {
     benchmarkId: string;
     runId: string;
     agentName: AgentName;
     modelUsed: string;
     overallScore: number;             // 0-1, weighted average
     dimensionScores: DimensionScore[];
     generatedAt: string;
     durationMs: number;               // time the agent took to complete the task
     tokensUsed: number;
   }

   interface DimensionScore {
     criterion: string;                // matches EvaluationCriterion.name
     rawScore: number;                 // 0-1
     weight: number;
     weightedScore: number;            // rawScore * weight
     details?: string;                 // human-readable breakdown
   }

   interface BenchmarkRunner {
     run(benchmark: Benchmark, agentConfig: AgentBenchmarkConfig): Promise<QualityScore>;
     runSuite(benchmarks: Benchmark[], agentConfig: AgentBenchmarkConfig): AsyncGenerator<QualityScore>;
     compare(scores: QualityScore[]): BenchmarkReport;
   }

   interface AgentBenchmarkConfig {
     agentName: AgentName;
     model: string;
     aceIterations: number;
     tasteVaultEnabled: boolean;       // run with or without vault context
     playbookEnabled: boolean;
   }
   ```

4. **SWE-bench and HumanEval adaptation.** Design the integration with external benchmarks:
   - **HumanEval** (OpenAI's function synthesis benchmark, 164 tasks):
     - HumanEval tasks map directly to Nova26's `correctness` category
     - Adaptation: wrap each HumanEval problem as a Nova26 `Task` with the agent assigned
       to MARS (the primary code generation agent)
     - Scoring: HumanEval's pass@k metric (pass@1 and pass@5 for Nova26)
     - Challenge: HumanEval is Python-focused; Nova26's primary output is TypeScript.
       Design the TypeScript port of HumanEval's 164 problems (specify the translation
       methodology, not the full translation — that is implementation work)
   - **SWE-bench** (real GitHub issues requiring code patches):
     - SWE-bench is inherently multi-step — it maps to a full Nova26 build, not a single task
     - Adaptation: each SWE-bench instance is a mini-project for Nova26's multi-agent pipeline
     - Which Nova26 agents are involved in a SWE-bench instance?
       (MARS for the fix, PLUTO for test generation, SATURN for code review)
     - Scoring: SWE-bench's `resolved` / `total` metric; Nova26 target: >30% resolution rate
     - Challenge: SWE-bench requires a real execution environment with the target repo
       checked out; design the Docker-based runner
   - Recommend a benchmark reporting format compatible with both internal benchmarks and
     SWE-bench/HumanEval results for side-by-side comparison in the analytics dashboard.

5. **A/B testing framework.** Design the agent config comparison system:
   - **What can be A/B tested?**
     - Model variant: `deepseek-r1:32b` vs `deepseek-r1:14b` on the same task set
     - ACE iterations: 3 cycles vs 5 cycles
     - Playbook variants: with/without a specific playbook directive
     - Prompt variants: different system prompt phrasings for MARS
     - Vault context: with/without Taste Vault pattern injection
   - **How is an A/B test defined?**
     - Select a benchmark suite (or subset)
     - Define variant A config and variant B config
     - Run both configs against the same benchmark tasks (same seed for any random elements)
     - Compare `QualityScore` distributions across dimensions
   - **Statistical significance:** when is the difference between A and B meaningful?
     (Minimum 20 benchmark tasks per variant; use Welch's t-test on overall scores;
     significance threshold: p < 0.05)
   - **How are results stored?** (SQLite in `.nova/benchmarks.db`, schema defined below)

   Provide the TypeScript interface:

   ```typescript
   interface ABTestConfig {
     id: string;
     name: string;
     description: string;
     benchmarkIds: string[];           // which benchmarks to run
     variantA: AgentBenchmarkConfig;
     variantB: AgentBenchmarkConfig;
     replicationsPerVariant: number;   // run each benchmark N times per variant
     randomSeed?: number;              // for reproducibility
   }

   interface ABTestResult {
     testId: string;
     completedAt: string;
     variantAScores: QualityScore[];
     variantBScores: QualityScore[];
     winner: 'A' | 'B' | 'inconclusive';
     pValue: number;
     effectSize: number;               // Cohen's d
     recommendation: string;           // plain English: "Variant B shows 8% improvement..."
   }
   ```

6. **Benchmark CI integration.** Design the regression detection system:
   - Benchmarks run in CI on every PR that touches agent prompts, model routing, or ACE logic
   - A score regression of >5% on any benchmark category blocks the PR
   - Score improvements are highlighted in the PR comment with specific dimension breakdowns
   - The full benchmark suite runs nightly (not on every PR — too slow)
   - Benchmark results are stored in `.nova/benchmarks.db` and surfaced in the analytics dashboard

7. **File structure.** Specify:
   - `benchmarks/tasks/correctness/` — 10 YAML task files
   - `benchmarks/tasks/style/` — 10 YAML task files
   - `benchmarks/tasks/performance/` — 10 YAML task files
   - `benchmarks/tasks/security/` — 10 YAML task files
   - `benchmarks/tasks/architecture/` — 10 YAML task files
   - `src/benchmarks/runner.ts` — `BenchmarkRunner` implementation
   - `src/benchmarks/scorers/` — one file per scorer type (correctness, style, etc.)
   - `src/benchmarks/ab-test.ts` — `ABTestConfig` and `ABTestResult` logic
   - `src/benchmarks/swe-bench-adapter.ts` — SWE-bench integration
   - `src/benchmarks/humaneval-adapter.ts` — HumanEval integration
   - `src/benchmarks/ci-reporter.ts` — CI regression detection and PR comment generation
   - `src/benchmarks/index.ts` — unified export

8. **Open questions for the build team.** List 3-5 questions.

---

### GROK-R11-04: Knowledge Graph Visualization

**The ask:** A Taste Vault with 5,000 patterns is a treasure chest that nobody can see into.
Premium users who have been building with Nova26 for six months have accumulated the most
valuable asset in their development practice — a living graph of their architectural
preferences, code patterns, and quality standards — and right now they experience it as a
black box that silently influences their builds. Giving them a visual, interactive map of
their vault is not a feature — it is a revelation. The first time a developer sees their
vault graph, with clusters of related patterns, edges showing how one preference implies
another, and the Global Wisdom layer overlaid like a star chart, they understand Nova26
in a way that no onboarding tutorial could convey. The analogy: the Knowledge Graph
Visualization is to the Taste Vault what Google Maps was to GPS coordinates — the
underlying data existed, but seeing it transformed how people related to it.

Produce a complete, ready-to-code specification covering:

1. **The big-picture analogy.** One paragraph. Visualizing a 5,000-node knowledge graph in
   a browser with smooth interaction is like rendering what other complex data structure that
   requires smart level-of-detail management to remain usable at scale? The key insight is
   that the full graph cannot be rendered at once — the visualization engine must use
   viewport culling, semantic clustering, and progressive disclosure (zoom in to see more
   detail) to keep the interaction fluid. The right analogy should capture the "infinite
   canvas with progressive detail" pattern (think: Google Maps zoom levels, VS Code's minimap,
   or a zoomable treemap).

2. **Technology selection.** Evaluate and recommend a rendering library:

   | Library | Strengths | Weaknesses | Max nodes (smooth) | Nova26 fit |
   |---|---|---|---|---|
   | D3.js | Ultimate control, force simulation | High implementation cost, custom everything | ~2,000 with canvas | High fit but high effort |
   | Cytoscape.js | Purpose-built for graphs, WebGL mode | Less React-friendly, learning curve | ~10,000 with WebGL | High fit, moderate effort |
   | React Flow | React-native, beautiful defaults | Limited physics, not designed for 5K+ nodes | ~500-1000 | Good for small vaults, degrades |
   | Sigma.js | WebGL-native, massive graphs | Sparse ecosystem, less battle-tested in 2026 | ~50,000+ | High fit for scale |
   | vis.js | Easy to use, decent performance | Dated API, Vue/React integration awkward | ~3,000 | Low fit |

   - Recommendation: **Cytoscape.js with WebGL (via `cytoscape-gl`)** for vaults under 20,000
     nodes. Provide the rationale: it handles Nova26's node/edge types, has TypeScript support,
     and its extension ecosystem covers every required feature (clustering, filtering, layout).
   - For vaults exceeding 20,000 nodes (power users in year 2+): document Sigma.js as the
     migration target and what the interface abstraction should look like to enable that switch.

3. **GraphVisualizationConfig design.** Define the full configuration contract:

   ```typescript
   interface GraphVisualizationConfig {
     layout: 'force-directed' | 'hierarchical' | 'radial' | 'grid';
     nodeFilters: NodeFilter[];
     edgeFilters: EdgeFilter[];
     clusterBy?: 'type' | 'quality-score' | 'usage-count' | 'age' | 'none';
     globalWisdomOverlay: boolean;     // show Global Wisdom nodes in a distinct visual layer
     timeLapseConfig?: TimeLapseConfig;
     performanceMode: 'quality' | 'performance';  // quality = full detail; performance = LOD
     maxVisibleNodes: number;          // default 5000; beyond this, cluster automatically
     nodeScale: 'uniform' | 'by-quality' | 'by-usage';  // node size encoding
   }

   interface NodeFilter {
     field: 'type' | 'qualityScore' | 'usageCount' | 'age' | 'source';
     operator: 'eq' | 'gt' | 'lt' | 'gte' | 'lte' | 'in';
     value: unknown;
     active: boolean;
   }

   interface EdgeFilter {
     relationshipType: 'supports' | 'contradicts' | 'refines' | 'all';
     active: boolean;
   }

   interface TimeLapseConfig {
     startDate: string;               // ISO date
     endDate: string;                 // ISO date
     stepUnit: 'day' | 'week' | 'month';
     playbackSpeedMs: number;         // ms per step, default 500
     highlightNewNodes: boolean;
   }
   ```

4. **NodeRenderData and EdgeRenderData.** Design the visualization data model:

   ```typescript
   interface NodeRenderData {
     id: string;                       // matches VaultNode.id
     label: string;                    // truncated pattern text for display
     fullText: string;                 // shown in detail panel on click
     type: 'personal' | 'team' | 'global-wisdom';
     qualityScore: number;             // 0-1, encodes visual size or color intensity
     usageCount: number;               // encodes node weight
     createdAt: string;
     position?: { x: number; y: number };  // optional: fixed position for hierarchical layouts
     cluster?: string;                 // cluster ID if clustering is active
     isHighlighted: boolean;           // for time-lapse "new node" highlight
     isFiltered: boolean;              // hidden by active filter but retained in graph state
   }

   interface EdgeRenderData {
     id: string;
     source: string;                   // NodeRenderData.id
     target: string;                   // NodeRenderData.id
     relationship: 'supports' | 'contradicts' | 'refines';
     strength: number;                 // 0-1, encodes edge thickness
     label?: string;                   // shown on hover
   }

   interface GraphRenderState {
     nodes: NodeRenderData[];
     edges: EdgeRenderData[];
     clusters: ClusterData[];
     viewport: { x: number; y: number; zoom: number };
     selectedNodeId?: string;
     hoveredNodeId?: string;
     totalNodeCount: number;           // includes filtered-out nodes
     visibleNodeCount: number;
   }

   interface ClusterData {
     id: string;
     label: string;
     nodeIds: string[];
     centroid: { x: number; y: number };
     expanded: boolean;
   }
   ```

5. **Performance at 5,000+ nodes.** Design the performance architecture:
   - **Level-of-detail (LOD) rendering:** at zoom < 0.5, render clusters instead of
     individual nodes. At zoom 0.5-1.0, render nodes as dots with no labels. At zoom > 1.0,
     render full nodes with labels. This mirrors how maps show cities vs. neighborhoods vs.
     streets.
   - **Viewport culling:** only render nodes/edges within the current viewport bounding box
     plus a 20% buffer. Cytoscape.js handles this automatically in its WebGL mode.
   - **Incremental loading:** load the top 1,000 nodes by quality score on initial render;
     stream additional nodes as the user pans/zooms.
   - **Worker-based layout computation:** force-directed layout computation runs in a Web
     Worker to avoid blocking the UI thread. How does Cytoscape.js support Web Workers?
   - **Benchmark target:** 60fps pan/zoom with 5,000 nodes on a 2023 M1 MacBook Pro.
     What is the expected fps on a mid-range 2024 Windows laptop with integrated graphics?
   - **Memory target:** graph state for 10,000 nodes should consume under 200MB of browser
     memory. Estimate actual memory usage per node and edge with the `NodeRenderData` struct.

6. **Interactive features.** Design the user interaction model:
   - **Click on node:** opens detail panel (full pattern text, quality score history,
     usage count over time, which builds used this pattern, incoming/outgoing edges)
   - **Hover on edge:** shows relationship label and strength
   - **Filter panel:** sidebar with `NodeFilter` and `EdgeFilter` controls; filters apply
     in real time without re-fetching data from backend
   - **Global Wisdom overlay toggle:** switches Global Wisdom nodes between visible (distinct
     color/shape) and hidden. Animates the transition.
   - **Time-lapse player:** transport controls (play, pause, step back, step forward,
     speed slider). Nodes fade in as they were created. New nodes flash briefly.
   - **Search:** text search highlights matching nodes and auto-navigates the viewport
   - **Export:** export the current graph view as SVG or PNG; export filtered node list as CSV

7. **Convex integration.** Design the data pipeline from Convex to the visualization:
   - The vault is stored in Convex (from Kimi's KIMI-INFRA-01/02 work). How does the
     visualization layer subscribe to vault updates in real time?
   - Use Convex's real-time query subscription: the React component subscribes to a
     `vault:getGraphData` query that returns `NodeRenderData[]` and `EdgeRenderData[]`
   - How are updates applied incrementally? (Diff the new graph state against the
     current render state; animate additions and removals rather than re-rendering the
     full graph)
   - For vaults with 5,000+ nodes, the initial data fetch may be large. Design a
     paginated loading strategy: fetch the top 1,000 nodes by quality score first,
     then stream the rest in batches of 500.

8. **File structure.** Specify:
   - `src/visualization/graph-config.ts` — `GraphVisualizationConfig`, `NodeFilter`, `EdgeFilter`
   - `src/visualization/graph-data.ts` — `NodeRenderData`, `EdgeRenderData`, `GraphRenderState`
   - `src/visualization/graph-renderer.ts` — Cytoscape.js wrapper, LOD logic, viewport culling
   - `src/visualization/time-lapse.ts` — `TimeLapseConfig` and playback engine
   - `src/visualization/graph-filters.ts` — filter application logic
   - `src/visualization/graph-export.ts` — SVG/PNG/CSV export
   - `src/visualization/index.ts` — unified export
   - `convex/vaultGraph.ts` — `vault:getGraphData` query returning visualization data
   - New `RalphLoopOptions` additions:
     ```typescript
     knowledgeGraphEnabled?: boolean;  // enables graph data computation after builds
     ```

9. **Open questions for the build team.** List 3-5 questions.

---

### GROK-R11-05: Autonomous Multi-Step Project Generation

**The ask:** Every feature Nova26 has built to this point is in service of a single
transformative moment: a developer types "Build me a SaaS dashboard with authentication,
Stripe payments, a REST API, and a React frontend" and Nova26 builds it. Not scaffolds it.
Not suggests it. Builds it — end to end, with tests, with documentation, with a working
deployment config — while the developer makes coffee. This is the ultimate premium feature.
It is why someone pays $299/month instead of $29/month. It is the difference between a
power tool and an assistant. The analogy: autonomous project generation in Nova26 is like
the difference between a sous chef who preps your ingredients and a head chef who takes
your dinner party theme and delivers a five-course meal — same kitchen, same ingredients,
but one requires you to be present at every step while the other brings you the finished
result.

Produce a complete, ready-to-code specification covering:

1. **The big-picture analogy.** One paragraph. Decomposing a high-level project description
   into an executable multi-agent build plan is like what other discipline that must translate
   a vague human intention into a precise, ordered sequence of specialized work? The key
   insight is that the decomposition itself is an agent task — a senior architect (JUPITER)
   takes the description, applies domain knowledge about system design, and produces a
   `ProjectPlan` that less specialized agents can execute. The right analogy should capture
   the "architect hands spec to general contractor who coordinates subcontractors" pattern,
   where each layer knows its domain and trusts the adjacent layers to know theirs.

2. **DecompositionEngine design.** Design the description → plan pipeline:

   **Step 1: Intent extraction** (JUPITER agent)
   - Input: free-form project description ("Build me a SaaS dashboard with auth and Stripe")
   - Output: structured `ProjectIntent` with extracted requirements, tech constraints,
     and quality targets
   - How does JUPITER extract intent? (Structured output prompt with `zod` schema validation;
     if the description is ambiguous on a critical dimension — e.g., database choice — ask
     one clarifying question before proceeding)
   - What is the maximum number of clarifying questions before proceeding with defaults?
     (1-2 questions for autonomy level 3+; 0 questions for autonomy level 5)

   **Step 2: Architecture design** (JUPITER agent, second pass)
   - Input: `ProjectIntent`
   - Output: `SystemArchitecture` — the high-level component diagram, tech stack choices,
     and inter-service communication patterns
   - JUPITER uses the Taste Vault at this step to ensure the architecture matches the
     user's established preferences (e.g., if they always use Prisma, the architecture
     specifies Prisma)

   **Step 3: Phase decomposition** (SATURN agent)
   - Input: `SystemArchitecture`
   - Output: `Phase[]` — ordered phases with clear deliverables and quality gates
   - Each phase contains: a set of agent tasks, a quality gate (tests that must pass before
     the next phase starts), an estimated duration, and a cost estimate

   **Step 4: Task generation** (ATLAS agent — the coordinator)
   - Input: `Phase[]`
   - Output: full `Task[]` for the Ralph Loop — one task per atomic unit of work
   - ATLAS assigns each task to the appropriate agent based on task type

   Provide the TypeScript interfaces:

   ```typescript
   interface ProjectPlan {
     id: string;
     description: string;             // the user's original input
     intent: ProjectIntent;
     architecture: SystemArchitecture;
     phases: Phase[];
     totalEstimatedMs: number;
     totalEstimatedTokens: number;
     estimatedCost: number;           // in USD, based on model pricing
     createdAt: string;
     status: 'draft' | 'approved' | 'executing' | 'completed' | 'failed';
   }

   interface ProjectIntent {
     projectName: string;
     projectType: 'saas' | 'api' | 'cli' | 'library' | 'mobile' | 'fullstack' | 'other';
     features: string[];              // extracted feature list
     techConstraints: TechConstraint[];
     qualityTargets: QualityTarget[];
     targetUsers: string;             // e.g., "developers", "small businesses"
     deploymentTarget: 'local' | 'vercel' | 'aws' | 'docker' | 'unknown';
     clarificationsNeeded: string[];  // questions JUPITER wants to ask
   }

   interface TechConstraint {
     category: 'language' | 'framework' | 'database' | 'auth' | 'payment' | 'deployment';
     value: string;                   // e.g., 'TypeScript', 'Next.js', 'PostgreSQL'
     source: 'user-specified' | 'vault-inferred' | 'default';
   }

   interface QualityTarget {
     dimension: 'correctness' | 'security' | 'performance' | 'coverage';
     threshold: number;               // e.g., 0.8 = 80% test coverage
   }
   ```

3. **Phase and Milestone design.** Design the execution structure:

   ```typescript
   interface Phase {
     id: string;
     name: string;                    // e.g., "Phase 1: Foundation"
     description: string;
     order: number;
     tasks: Task[];
     qualityGate: QualityGate;
     estimatedDurationMs: number;
     estimatedCost: number;
     status: 'pending' | 'executing' | 'gate-check' | 'completed' | 'failed';
     completedAt?: string;
   }

   interface Milestone {
     id: string;
     phaseId: string;
     name: string;                    // e.g., "Database schema deployed"
     description: string;
     verificationCommand?: string;    // shell command to verify milestone is achieved
     achieved: boolean;
     achievedAt?: string;
   }

   interface QualityGate {
     milestones: Milestone[];
     testSuite?: string;              // path to test file to run at gate
     minTestPassRate: number;         // e.g., 0.95 = 95% of tests must pass
     securityScanRequired: boolean;
     manualApprovalRequired: boolean; // for autonomy level <= 2
     autoApproveAfterMs?: number;     // auto-proceed if no human response after N ms
   }
   ```

4. **Cost and time estimation.** Design the pre-execution estimator:
   - Before starting a project, Nova26 shows the user a cost/time estimate:
     ```
     Project: SaaS Dashboard
     Phases: 4
     Estimated tasks: 38
     Estimated tokens: 2.4M
     Estimated cost: $0.00 (all local with Ollama)
     Estimated time: 45-90 minutes
     [Approve and Start] [Adjust Plan] [Cancel]
     ```
   - How are token counts estimated? (Count tokens in each task's expected prompt;
     multiply by the ACE iteration count; add buffer for tool calls)
   - How is wall-clock time estimated? (Historical data from `src/analytics/`; if none,
     use: `taskCount * avgSecondsPerTask * (1 / concurrency)`)
   - How is cost estimated? (For Ollama: always $0.00; for future cloud models: token
     count * model price per token)
   - What is the uncertainty range? (Express as "45-90 minutes" — estimate ± 50% for
     the first run; ± 20% after 10+ builds with historical data)

   Provide the interface:

   ```typescript
   interface DecompositionResult {
     plan: ProjectPlan;
     estimate: ProjectEstimate;
     warnings: string[];              // e.g., "No Stripe integration pattern in your vault"
     suggestedVaultPatterns: string[]; // patterns from Global Wisdom that apply
   }

   interface ProjectEstimate {
     minDurationMs: number;
     maxDurationMs: number;
     expectedDurationMs: number;
     estimatedTokens: number;
     estimatedCost: number;           // USD, 0 for pure Ollama builds
     confidenceLevel: 'low' | 'medium' | 'high';  // based on historical data available
     basisDescription: string;        // "Based on 0 similar builds (no history)" or "Based on 12 similar builds"
   }
   ```

5. **Execution engine.** Design the multi-phase execution loop:
   - The `ProjectExecutionEngine` wraps the Ralph Loop and adds phase coordination:
     1. Execute all tasks in Phase 1 via the Ralph Loop (parallel where possible)
     2. On phase completion, evaluate `QualityGate`:
        - Run milestone verification commands
        - Run the phase test suite
        - If gate passes: proceed to Phase 2
        - If gate fails: attempt automated remediation (retry failed tasks, apply fixes)
        - If remediation fails: pause and notify user (or fail entirely at autonomy level 5)
     3. Repeat for each phase
     4. On project completion: generate a project summary report
   - What is the remediation strategy at a failed quality gate?
     - First attempt: re-run failed tasks with higher ACE iterations
     - Second attempt: assign a "debug" task to PLUTO to diagnose and fix
     - Third attempt: pause and ask for human intervention (even at autonomy level 5)
   - How does the user track progress in real time?
     (Convex real-time: the `projects` table streams phase/milestone status to the dashboard;
     CLI mode: progress bars per phase with milestone checkmarks)

   Provide the interface:

   ```typescript
   interface ProjectExecutionEngine {
     decompose(description: string, config: DecompositionConfig): Promise<DecompositionResult>;
     approve(planId: string): Promise<void>;
     execute(planId: string): AsyncGenerator<ProjectExecutionEvent>;
     pause(planId: string): Promise<void>;
     resume(planId: string): Promise<void>;
     getStatus(planId: string): Promise<ProjectPlan>;
   }

   type ProjectExecutionEvent =
     | { type: 'phase-started'; phase: Phase }
     | { type: 'task-completed'; task: Task; score?: QualityScore }
     | { type: 'milestone-achieved'; milestone: Milestone }
     | { type: 'gate-passed'; phase: Phase }
     | { type: 'gate-failed'; phase: Phase; reason: string; remediating: boolean }
     | { type: 'project-completed'; plan: ProjectPlan; summary: ProjectSummary }
     | { type: 'project-failed'; plan: ProjectPlan; error: string };

   interface DecompositionConfig {
     autonomyLevel: AutonomyLevel;
     maxClarifyingQuestions: number;
     preferredTechStack?: TechConstraint[];
     budgetLimitUsd?: number;
     timeLimitMs?: number;
   }
   ```

6. **Project summary report.** Design the post-completion artifact:
   - When a project completes, Nova26 generates a `ProjectSummary` document at
     `.nova/projects/<projectId>/summary.md` containing:
     - What was built (architecture overview, component list, tech stack)
     - Build metrics (actual vs. estimated time, token usage, ACE iterations per task)
     - Quality gate results (which gates passed, which required remediation)
     - New vault patterns learned during the project
     - Suggested follow-up tasks ("Consider adding: rate limiting, email verification...")
   - The summary is also synced to Convex for the analytics dashboard.

   Provide the TypeScript interface:

   ```typescript
   interface ProjectSummary {
     planId: string;
     projectName: string;
     completedAt: string;
     actualDurationMs: number;
     actualTokensUsed: number;
     actualCost: number;
     phasesCompleted: number;
     tasksCompleted: number;
     tasksRetried: number;
     gateFailures: number;
     newVaultPatterns: number;
     architectureDescription: string;
     techStackUsed: TechConstraint[];
     suggestedFollowUps: string[];
     qualityGateSummary: { phaseId: string; passed: boolean; retriesRequired: number }[];
   }
   ```

7. **Convex schema additions.** Specify the new tables required:
   - `projects` table: stores `ProjectPlan` with status, linked to `builds` table
   - `phases` table: stores `Phase` records linked to `projects`
   - `milestones` table: stores `Milestone` records linked to `phases`
   - Each table needs: `_creationTime` (Convex built-in), `projectId` index, `status` index
   - Show the additions to `convex/schema.ts` for these three tables.

8. **File structure.** Specify:
   - `src/project-gen/decomposition-engine.ts` — intent extraction, architecture design
   - `src/project-gen/phase-builder.ts` — phase and milestone generation
   - `src/project-gen/task-generator.ts` — task array generation from phases
   - `src/project-gen/estimator.ts` — cost/time/token estimation
   - `src/project-gen/execution-engine.ts` — `ProjectExecutionEngine` orchestrator
   - `src/project-gen/quality-gate.ts` — gate evaluation and remediation
   - `src/project-gen/project-summary.ts` — `ProjectSummary` generation and storage
   - `src/project-gen/index.ts` — unified export
   - `convex/projects.ts` — Convex mutations and queries for project tables
   - New `RalphLoopOptions` additions:
     ```typescript
     projectGenEnabled?: boolean;
     projectPlanId?: string;          // set when executing as part of a ProjectPlan
     phaseId?: string;                // set when executing a specific phase
     ```

9. **Open questions for the build team.** List 3-5 questions.

---

## Output Format

- Label each section clearly: `## GROK-R11-01`, `## GROK-R11-02`, etc.
- Begin each deliverable with the big-picture analogy paragraph before any technical content.
- Use TypeScript for all interfaces and method signatures.
- Use ASCII or prose for flow diagrams — no image dependencies.
- For code examples that reference real Nova26 files, use the actual file paths:
  - `src/orchestrator/ralph-loop.ts`
  - `src/orchestrator/prompt-builder.ts`
  - `src/llm/structured-output.ts`
  - `src/agent-loop/scratchpad.ts`
  - `src/agent-loop/agent-loop.ts`
  - `src/memory/session-memory.ts`
  - `src/analytics/agent-analytics.ts`
  - `convex/schema.ts`
  - `convex/atlas.ts`
- Each deliverable should be independently useful — a developer picking up GROK-R11-04
  should not need to read R11-01 first.
- Estimated output: 3,000-5,000 words per deliverable, 15,000-25,000 words total.

---

## Reference: Key Nova26 Types

For accuracy, here are the core types from `src/types/index.ts` that your specs should
build on or extend:

```typescript
// Agent names in the system
type AgentName = 'MARS' | 'VENUS' | 'MERCURY' | 'JUPITER' | 'SATURN' | 'PLUTO'
  | 'NEPTUNE' | 'URANUS' | 'EARTH' | 'IO' | 'GANYMEDE' | 'EUROPA' | 'CALLISTO'
  | 'TITAN' | 'ENCELADUS' | 'MIMAS' | 'TRITON' | 'CHARON' | 'ANDROMEDA'
  | 'ATLAS' | 'SUN';

// Task structure (used throughout ralph-loop.ts and prompt-builder.ts)
interface Task {
  id: string;
  title: string;
  description: string;
  agent: string;
  phase: string;
  status: 'pending' | 'ready' | 'running' | 'done' | 'failed';
  dependencies: string[];
  attempts: number;
  output?: string;
  todos?: TodoItem[];
  currentTodoId?: string;
}

// The autonomy spectrum
type AutonomyLevel = 1 | 2 | 3 | 4 | 5;

// Ralph Loop options (cumulative from R1-R10; R11 adds are at bottom)
interface RalphLoopOptions {
  parallelMode?: boolean;
  concurrency?: number;
  autoTestFix?: boolean;
  maxTestRetries?: number;
  planApproval?: boolean;
  eventStore?: boolean;
  sessionMemory?: boolean;
  gitWorkflow?: boolean;
  costTracking?: boolean;
  budgetLimit?: number;
  convexSync?: boolean;
  agenticMode?: boolean;
  autonomyLevel?: AutonomyLevel;
  acePlaybooks?: boolean;
  rehearsalStage?: boolean;
  similarityEngine?: boolean;
  modelRouting?: boolean;
  pluginAgents?: boolean;
  teamVault?: boolean;
  ciMode?: boolean;
  predictiveAnalytics?: boolean;
  onboardingMode?: boolean;
  checkpointing?: boolean;
  gracefulDegradation?: boolean;
  agentPooling?: boolean;
  llmResponseCache?: boolean;
  migrationCheck?: boolean;
  // New in R11:
  // visionEnabled?: boolean;
  // visionModel?: string;
  // screenshotEnabled?: boolean;
  // diagramGeneration?: boolean;
  // voiceEnabled?: boolean;
  // speechConfig?: SpeechConfig;
  // knowledgeGraphEnabled?: boolean;
  // projectGenEnabled?: boolean;
  // projectPlanId?: string;
  // phaseId?: string;
}
```

---

## Coordination Note

Kimi just completed KIMI-INFRA-01 through KIMI-INFRA-06:
- Similarity engine (`src/similarity/`)
- Convex schema and real-time architecture (`convex/`)
- Security and privacy layer (`src/security/`)
- Model routing (`src/llm/`)
- Analytics pipeline (`src/analytics/`)
- 1226 tests passing, 0 TypeScript errors.

All five R11 deliverables target entirely new source directories:
- GROK-R11-01 targets `src/vision/` — no conflicts
- GROK-R11-02 targets `src/voice/` — no conflicts
- GROK-R11-03 targets `src/benchmarks/` and `benchmarks/` — no conflicts
- GROK-R11-04 targets `src/visualization/` — new Convex query in `convex/vaultGraph.ts`
- GROK-R11-05 targets `src/project-gen/` — new Convex tables in `convex/projects.ts`

For R11-04 and R11-05, any new Convex tables must be specified as explicit additions to
`convex/schema.ts`, with the rationale for each table clearly documented. Do not modify
existing tables (`builds`, `tasks`, `executions`, `patterns`, `agents`, `companyAgents`,
`learnings`).

The `src/analytics/agent-analytics.ts` file remains in Claude Code's domain. R11-03's
benchmark results should feed into analytics via the existing `learnings` table pattern,
not by modifying `agent-analytics.ts` directly — document the integration point.

---

*Prompt issued by Claude Code on 2026-02-18. Grok R11 output should be delivered to
`.nova/output/` or committed directly to the `grok/r11` branch for coordinator review.*
