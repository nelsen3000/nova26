# SERIES 8: Wave 3 Kickoff — Hours 16-18

## GROK 4.2

Architecture review of the Visual Workflow Engine (src/workflow/) built by Qwen.

Validate:
1. DAG correctness: Is the workflow graph a valid DAG? Does it detect cycles? Can it handle: linear chains, parallel fan-out, conditional branching, join/synchronization points?
2. Execution engine: Does step execution follow topological order? Are parallel steps actually executed concurrently? Does the join step correctly wait for all predecessors?
3. Persistence: Can a workflow execution survive a crash? Is serialization/deserialization correct? Can it resume from the exact step that was interrupted?
4. Step types: Are all 5 step types (task, decision, parallel, join, human) implemented correctly? Does the decision step evaluate conditions properly? Does the human step actually pause execution?
5. Visualization data: Does the auto-layout algorithm produce valid positions? No overlapping nodes? Correct edge routing? Status colors match execution state?
6. Integration: How does this connect to the Ralph Loop? Can SUN orchestrator create and execute workflows? Can agents be assigned as step executors?

Also review GLM's CRDT implementation (src/collaboration/) if available. Check: commutativity, associativity, idempotency of merge operations.

OUTPUT: Technical review with correctness proofs for DAG operations, integration assessment, test gap analysis.

---

## GEMINI 3.1

GEMINI-13: Voice & Multimodal AI Interfaces research.

1. Speech-to-Intent: How to convert voice commands to agent actions. Compare: Whisper (OpenAI), Deepgram, AssemblyAI. Latency requirements for real-time voice interaction. On-device vs cloud processing.
2. Voice command patterns for IDEs: What voice commands make sense? "Create a new component called UserProfile", "Run the tests", "Show me the build history", "What's VENUS working on?". How to handle ambiguity and confirmation.
3. Image grounding: Can agents understand screenshots? Use cases: "Fix the layout in this screenshot", "Make this look like the reference design". GPT-4V, Claude Vision, Gemini Vision comparison for UI understanding.
4. Screen sharing for agents: Can an agent watch the developer's screen and proactively suggest improvements? Privacy considerations. Performance impact. When to interrupt vs when to stay silent.
5. Multimodal input fusion: Combining voice + text + image inputs. "Make this (points to component) look like this (shows screenshot) and add a loading state (voice)". How to resolve conflicts between modalities.

OUTPUT: Research report with: voice integration architecture, command grammar specification, image grounding feasibility, screen sharing design, multimodal fusion strategy.

---

## CHATGPT 5.2

Write a comprehensive testing guide for Nova26 contributors.

Document:
1. Testing Philosophy: Why we test (confidence, regression prevention, documentation). Property-based testing for agent behavior. Integration tests for cross-module flows.
2. Test Stack: Vitest (why not Jest), React Testing Library (component tests), fast-check (property-based), Playwright (E2E — future). Configuration in vitest.config.ts.
3. Writing Unit Tests: File naming (.test.ts next to source), describe/it structure, assertion patterns (expect().toBe, toEqual, toThrow), async test patterns.
4. Mocking Patterns: How to mock Convex functions, LLM API calls, file system, network requests. When to mock vs when to use real implementations. Mock factories for common types (Agent, Build, Task).
5. Testing React Components: RTL patterns (render, screen, userEvent), testing Convex hooks (ConvexProvider mock), testing loading/error/empty states, snapshot testing (when to use, when to avoid).
6. Testing Convex Functions: convex-test library, isolated test environments, testing auth, testing validators, testing real-time subscriptions.
7. Property-Based Testing: fast-check basics, writing generators for Nova26 types, properties to test (idempotency, commutativity, bounded output), shrinking and debugging failures.
8. Running Tests: `vitest run` (all), `vitest run src/llm/` (directory), `vitest -t "model router"` (by name), coverage reports.

OUTPUT: Complete docs/TESTING.md ready to commit.

---

## PERPLEXITY

Research CRDT libraries and patterns for real-time collaboration in TypeScript.

1. CRDT libraries: Compare Yjs, Automerge, Diamond Types, loro-crdt. Which is best for TypeScript? Bundle size? Performance? Learning curve?
2. CRDT types needed for Nova26: What CRDT types for collaborative code editing (text CRDT), shared agent configuration (map CRDT), task lists (list CRDT), presence (register CRDT)?
3. Sync protocols: How to sync CRDT state between clients. WebSocket vs WebRTC. Server-mediated vs peer-to-peer. How does Convex fit in (can Convex be the sync server)?
4. Conflict resolution: How CRDTs handle concurrent edits. Last-writer-wins vs merge semantics. What happens when two users edit the same agent configuration simultaneously?
5. Performance: CRDT document size growth over time. Garbage collection / compaction strategies. Memory usage with 10+ concurrent editors.
6. Integration with React: How to bind CRDT state to React components. Yjs + React bindings. Optimistic rendering. Cursor/selection synchronization.

OUTPUT: Library comparison matrix, recommended architecture for Nova26 collaboration, implementation guide with code examples, performance benchmarks.
