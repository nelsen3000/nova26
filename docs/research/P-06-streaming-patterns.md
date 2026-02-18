# P-06: Streaming LLM Patterns for TypeScript (February 2026)

## Overview

This document describes best practices for streaming LLM responses in TypeScript/Node.js as of February 2026, with a focus on:

- Server-Sent Events (SSE)
- Async iterators / AsyncGenerator patterns
- Vercel AI SDK streaming
- Ollama NDJSON streaming
- Error handling, backpressure, and cancellation

It is written to inform Nova26's future streaming architecture for both CLI and any web UI.[file:9][web:162][web:165][web:168]

## 1. Core Streaming Protocols

### 1.1 Server-Sent Events (SSE)

- SSE sends a one-way stream of events over HTTP, where each event is text-based with `data:` prefixes.[web:165][web:168]
- Many LLM APIs (OpenAI, Anthropic, Gemini, etc.) and SDKs expose streaming as SSE: chunks of tokens or JSON objects, terminated with a `[DONE]` marker.[web:165]

Key pattern:

- Backend endpoint writes `Content-Type: text/event-stream` and flushes `data: {"delta": "..."}` lines as they arrive from the model.[web:165]
- Frontend (browser/Node) listens via `EventSource` or a custom `fetch` + reader loop and updates UI incrementally.

### 1.2 NDJSON / JSONL

- NDJSON is line-delimited JSON; often used by tools like Ollama and other local servers to stream updates.[web:162]
- Each line is a complete JSON object that can be parsed independently, making it easy to wrap in async iterators.

## 2. Async Iterator Patterns in TypeScript

- Modern TS/JS: `for await (const chunk of stream) { ... }` is the canonical way to consume streaming responses.[web:162][web:165]
- SDKs and custom wrappers should expose streaming APIs as async iterables of typed events instead of raw text.

Example (conceptual):

```ts
for await (const event of client.streamChat({ messages })) {
  if (event.type === 'delta') {
    buffer += event.text;
    onUpdate(buffer);
  }
}
```

Benefits:

- Composability: streams can be piped, transformed, or buffered using generator utilities.
- Backpressure: consumer controls how fast it iterates, naturally applying backpressure.

## 3. Vercel AI SDK Streaming

- The Vercel AI SDK provides a unified abstraction over provider-specific streaming, designed for Next.js and other runtimes.[web:165][web:168]
- `streamText` and related utilities:
  - Wrap provider APIs (OpenAI, Gemini, Anthropic, etc.) and expose SSE streams as async iterables.
  - Handle provider-specific quirks while giving a consistent TypeScript type surface.[web:165][web:168]

Example pattern (simplified):

```ts
import { streamText } from 'ai';

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: openai('gpt-4.5-mini'),
    messages,
  });

  return result.toTextStreamResponse();
}
```

- On the client, `useChat` hooks consume the stream and update UI with incremental tokens and optional reasoning traces.[web:165][web:168]

## 4. Ollama NDJSON Streaming in TypeScript

- Ollama’s HTTP API streams responses as NDJSON, with each line containing a partial response chunk.[web:162]
- In Node/TypeScript, the pattern is:

```ts
const res = await fetch('http://localhost:11434/api/chat', {
  method: 'POST',
  body: JSON.stringify({ model: 'qwen2.5:7b', messages, stream: true }),
});

if (!res.body) throw new Error('No response body');

const reader = res.body.getReader();
const decoder = new TextDecoder();
let buffer = '';

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });

  const lines = buffer.split('\n');
  buffer = lines.pop() ?? '';

  for (const line of lines) {
    if (!line.trim()) continue;
    const event = JSON.parse(line);
    // handle event
  }
}
```

- This logic can be wrapped in a function that yields parsed events as an async iterator.

## 5. Error Handling & Cancellation

Best practices across SSE/NDJSON streaming:[web:162][web:165][web:168]

- **Structured event types**
  - Define a TypeScript union for stream events: `{ type: 'delta'; text: string } | { type: 'error'; error: string } | ...`.
  - Ensure tooling and gates can reason about partial content vs terminal errors.

- **Timeouts & network failures**
  - Set reasonable timeouts on server-side model calls; surface user-friendly messages on the client.
  - Implement reconnection strategies for non-critical streams; for critical operations, fail fast and log for analysis.

- **Cancellation**
  - Expose an `AbortController` from the streaming call; respect its signal in fetch and in upstream SDKs.
  - Cancel in-flight model calls when the user stops a run or navigates away.

- **Backpressure-aware consumers**
  - Avoid storing unbounded histories in memory; flush completed segments to disk or a log store (e.g., ATLAS) when possible.[file:11]

## 6. Piping Streams Through Quality Gates

For Nova26, streaming should integrate with existing quality gates rather than bypass them.[file:7][file:9]

- **Gate-after-stream pattern**
  - Stream to the user as tokens arrive, but only mark the task as `done` after the complete response passes MERCURY and other gates.
  - UI can show a temporary state (e.g., "Validating...") after stream completion.

- **Inline gate feedback**
  - For long-running tasks, periodically run lightweight checks (e.g., JSON syntax, partial TypeScript parsing) on accumulated text.
  - If a hard failure is detected early, cut the stream, surface the error, and trigger a retry.

- **Event model for gates**
  - Represent gate results as events in the same stream: `{ type: 'gate_result'; gate: 'MERCURY'; status: 'pass' | 'fail'; details?: string }`.
  - This lets a unified event consumer handle both tokens and validation outcomes.

## 7. Recommended Architecture for Nova26

1. **Normalize all provider streams into a common event stream**
   - Wrap Ollama NDJSON, Vercel AI SDK SSE, and any other provider into a unified async iterator of typed events.

2. **Expose streaming APIs in both CLI and web UI**
   - CLI: show incremental tokens with clear phases (generating, validating, saving).
   - Web UI: use SSE endpoints or WebSocket multiplexing to stream events to the browser.

3. **Integrate ATLAS for durable logs**
   - Persist streamed tokens and gate events into Convex/ATLAS for later inspection and replay.[file:11]

4. **Design backpressure-aware consumers**
   - For long outputs, stream only summaries or high-level updates to UI, keeping full transcripts in storage.

5. **Provide cancellation and restart semantics**
   - Allow users to stop a task mid-stream and restart it with modified parameters or prompts.

6. **Align with Vercel AI SDK idioms where possible**
   - For web-facing interfaces, follow the AI SDK 5 patterns (SSE-first, typed tools, agentic loops) to stay close to ecosystem expectations.[web:165][web:168]

## Recommendations for Nova26

- **Implement a unified streaming layer in `ollama-client.ts` (and future providers)**
  - Expose an async iterator of structured events rather than raw text; reuse for CLI and web.

- **Wire streaming into Ralph Loop without compromising gates**
  - Allow users to see partial outputs while still enforcing full-response validation before committing results.

- **Use ATLAS as a streaming log sink**
  - Persist stream chunks and gate events for observability, replay, and debugging.

- **Standardize on SSE for browser clients**
  - For any Nova26 dashboard or in-browser interface, use SSE-backed endpoints with a thin Vercel AI SDK-style wrapper.

- **Document clear patterns and examples**
  - Provide sample Node.js/Next.js code for streaming from Ollama and future cloud providers, aligned with these best practices.
