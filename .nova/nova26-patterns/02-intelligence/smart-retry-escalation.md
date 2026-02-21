# Smart Retry with Escalation

**Category:** 02-intelligence
**Type:** Pattern
**Tags:** retry, escalation, model-switching, error-classification, resilience, nova26

---

## Overview

`SmartRetrySystem` classifies errors and applies escalating strategies across retries: same model with error context → stronger model → context chunking → council-of-agents prompt. Automatically upgrades from free to paid tier on complex failures.

---

## Source

`src/llm/smart-retry.ts`

---

## Pattern
  async execute(task: Task, prompt: string, initialModel: string, executeFn: (model: string, prompt: string) => Promise<string>): Promise<RetryResult> {
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const response = await executeFn(currentModel, currentPrompt);
        return { success: true, response, attempts: this.attempts };
      } catch (error) {
        const classification = this.classifyError(error.message);
        const strategy = this.getStrategy(attempt, classification);

        currentModel = strategy.model;
        currentPrompt = strategy.modifyPrompt?.(currentPrompt, error.message) ?? currentPrompt;

        // Exponential backoff with jitter
        const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
        await sleep(delay);
      }
    }
    return { success: false, attempts: this.attempts };
  }

  private getStrategy(attempt: number, error: ErrorClassification) {
    switch (attempt) {
      case 1: return { model: 'qwen2.5:14b',   modifyPrompt: (p, e) => `${p}\n\nPrevious error: ${e}. Fix and retry.` };
      case 2: return { model: 'gpt-4o',         modifyPrompt: (p, e) => `Complex task. Previous failure: ${e}.\n${p}` };
      case 3: return { model: 'claude-3-opus',  modifyPrompt: (p) => error.type === 'context_length' ? p.slice(0, 10000) : p };
      case 4: return { model: 'gpt-4o',         modifyPrompt: (p, e) => `COUNCIL REVIEW: ${p}\n\nAll agents failed: ${e}` };
    }
  }
}
```

```typescript
// Error classification
const ERROR_PATTERNS = [
  { pattern: /syntax.*error|unexpected token/i,    type: 'syntax',         recoverable: true },
  { pattern: /timeout|timed out/i,                 type: 'timeout',        recoverable: true },
  { pattern: /rate.*limit|too many requests/i,     type: 'rate_limit',     recoverable: true },
  { pattern: /context.*length|too long|max.*tokens/i, type: 'context_length', recoverable: true },
  { pattern: /undefined|null reference/i,          type: 'logic',          recoverable: true },
];
```

---

## Usage

```typescript
// Retry code generation with validation
const result = await retryCodeGeneration(
  task,
  prompt,
  async (code) => {
    const { valid, errors } = await validateTypeScript(code);
    return { valid, errors };
  }
);

// Progressive enhancement
const result = await progressiveEnhancement(
  basePrompt,
  ['Add error handling', 'Add TypeScript types', 'Add tests'],
  (prompt) => callLLM(prompt)
);
```

---

## Anti-Patterns

```typescript
// ❌ Same model on every retry — same failure every time
for (let i = 0; i < 4; i++) {
  response = await callLLM(prompt, 'qwen2.5:7b'); // Never escalates
}

// ✅ Good: Escalate model on each retry
const models = ['qwen2.5:7b', 'qwen2.5:14b', 'gpt-4o-mini', 'gpt-4o'];
response = await callLLM(prompt, models[attempt]);

// ❌ No error classification — same strategy for all errors
// Rate limit errors need delay; syntax errors need prompt modification

// ✅ Good: Classify errors and adapt strategy
if (isRateLimit(error)) await delay(backoff);
else if (isSyntaxError(error)) prompt = refinePrompt(prompt, error);

// ❌ Escalating to paid tier without user consent
// Should check NOVA26_TIER env var or user preference before upgrading

// ✅ Good: Respect tier configuration
if (currentTier === 'free' && !process.env.ALLOW_PAID_FALLBACK) throw error;
```

---

## When to Use

- LLM code generation tasks where first attempts frequently fail validation
- Multi-model environments where escalating to a stronger model can resolve failures
- Tasks with diverse error types that need different recovery strategies

---

## Benefits

- Automatic model escalation avoids manual intervention on failures
- Error classification enables targeted recovery strategies per error type
- Exponential backoff with jitter prevents rate limit cascades
- Progressive enhancement builds up quality across retries

---

## Related Patterns

- `model-router-fallback-chains.md` — Model selection
- `../01-orchestration/test-fix-retest-loop.md` — Test-specific retry loop
- `../01-orchestration/gate-runner-pipeline.md` — Gates that trigger retries
