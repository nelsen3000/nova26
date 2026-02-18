# Nova26 LLM Cost Protection

## Adapted from BistroLens API Cost Protection

**Source:** BistroLens `31-API-COST-PROTECTION.md`, `api/rateLimiter.ts`  
**Category:** Cost Management & Budgeting  
**Priority:** P1  
**Reusability:** 10/10

---

## Overview

BistroLens tracks API costs per user with daily/monthly limits, caching, circuit breakers. Nova26 has `model-router.ts` with tier selection but NO cost tracking or limits.

**Key Insight:** LLM costs can spiral quickly. Per-agent budgets are essential.

---

## Cost Centers for Nova26

| Component | Model | Cost | Risk Level |
|-----------|-------|------|------------|
| SUN (orchestrator) | Claude 3.5 Sonnet | $3/1M tokens | MEDIUM |
| VENUS (UI) | GPT-4o-mini | $0.15/1M tokens | LOW |
| MARS (TypeScript) | Claude 3.5 Sonnet | $3/1M tokens | MEDIUM |
| TITAN (realtime) | GPT-4o-mini | $0.15/1M tokens | LOW |
| GANYMEDE (API) | Claude 3.5 Sonnet | $3/1M tokens | MEDIUM |
| URANUS (research) | GPT-4o | $5/1M tokens | HIGH |
| ANDROMEDA (analysis) | Claude 3.5 Sonnet | $3/1M tokens | MEDIUM |
| Image generation | DALL-E 3 | $0.04/image | HIGH |

---

## Per-Build Budget System

```typescript
// src/cost/build-budget.ts

interface BuildBudget {
  buildId: string;
  totalBudget: number;
  perAgentBudget: Record<string, number>;
  alertsAt: number[];  // Percentage thresholds
}

const DEFAULT_BUDGETS = {
  quick: {           // Small features
    total: 2.00,
    perAgent: 0.50,
  },
  standard: {        // Medium features
    total: 5.00,
    perAgent: 1.50,
  },
  complex: {         // Large features
    total: 15.00,
    perAgent: 4.00,
  },
  research: {        // Deep research tasks
    total: 20.00,
    perAgent: 10.00,
  },
};

export function createBuildBudget(
  buildId: string,
  complexity: 'quick' | 'standard' | 'complex' | 'research'
): BuildBudget {
  const defaults = DEFAULT_BUDGETS[complexity];
  
  return {
    buildId,
    totalBudget: defaults.total,
    perAgentBudget: {
      SUN: defaults.perAgent * 1.5,      // Orchestrator needs more
      VENUS: defaults.perAgent,
      MARS: defaults.perAgent,
      PLUTO: defaults.perAgent * 0.5,    // Schema is cheaper
      // ... etc
    },
    alertsAt: [50, 75, 90, 100],
  };
}
```

---

## Circuit Breaker for Costs

```typescript
// src/cost/cost-circuit-breaker.ts

interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half-open';
  failureCount: number;
  lastFailureTime?: number;
  nextRetryTime?: number;
}

const CIRCUIT_BREAKER_CONFIG = {
  failureThreshold: 5,        // Open after 5 cost overruns
  recoveryTimeout: 60000,     // Try again after 60 seconds
  halfOpenMaxCalls: 3,        // Allow 3 test calls in half-open
};

class CostCircuitBreaker {
  private states: Map<string, CircuitBreakerState> = new Map();
  
  canProceed(agent: string): boolean {
    const state = this.states.get(agent) || { state: 'closed', failureCount: 0 };
    
    if (state.state === 'open') {
      if (Date.now() > (state.nextRetryTime || 0)) {
        state.state = 'half-open';
        state.failureCount = 0;
        this.states.set(agent, state);
        return true;
      }
      return false;
    }
    
    return true;
  }
  
  recordSuccess(agent: string): void {
    const state = this.states.get(agent);
    if (state?.state === 'half-open') {
      state.state = 'closed';
      state.failureCount = 0;
      this.states.set(agent, state);
    }
  }
  
  recordFailure(agent: string): void {
    const state = this.states.get(agent) || { state: 'closed', failureCount: 0 };
    state.failureCount++;
    
    if (state.failureCount >= CIRCUIT_BREAKER_CONFIG.failureThreshold) {
      state.state = 'open';
      state.nextRetryTime = Date.now() + CIRCUIT_BREAKER_CONFIG.recoveryTimeout;
    }
    
    this.states.set(agent, state);
  }
}
```

---

## Cache-First Strategy

```typescript
// src/cost/cache-first-llm.ts

import { getCachedResponse, cacheResponse } from '../llm/response-cache';

interface CacheConfig {
  ttlMinutes: number;
  cacheKeyGenerator: (prompt: string, model: string) => string;
}

const CACHE_CONFIGS: Record<string, CacheConfig> = {
  // Research results - cache for 24h
  'URANUS': { ttlMinutes: 24 * 60, cacheKeyGenerator: hashPrompt },
  
  // PRD generation - cache for 12h
  'SUN': { ttlMinutes: 12 * 60, cacheKeyGenerator: hashPrompt },
  
  // Schema design - cache for 6h
  'PLUTO': { ttlMinutes: 6 * 60, cacheKeyGenerator: hashPrompt },
  
  // UI components - cache for 2h (styles change often)
  'VENUS': { ttlMinutes: 2 * 60, cacheKeyGenerator: hashPrompt },
};

export async function getOrGenerateWithCache<T>(
  agent: string,
  prompt: string,
  model: string,
  generator: () => Promise<T>
): Promise<T> {
  const config = CACHE_CONFIGS[agent];
  if (!config) {
    return generator(); // No caching for this agent
  }
  
  const cacheKey = config.cacheKeyGenerator(prompt, model);
  
  // Check cache
  const cached = getCachedResponse(cacheKey, model);
  if (cached) {
    recordCacheHit(agent, cacheKey);
    return cached.response as T;
  }
  
  // Generate and cache
  const result = await generator();
  cacheResponse(cacheKey, model, result, config.ttlMinutes);
  
  return result;
}

function hashPrompt(prompt: string, model: string): string {
  return createHash('sha256')
    .update(`${prompt}:${model}`)
    .digest('hex');
}
```

---

## Graceful Degradation on Cost Overrun

```typescript
// src/cost/graceful-degradation.ts

interface DegradationStrategy {
  agent: string;
  fallbackModel?: string;
  simplifyPrompt?: (prompt: string) => string;
  skipOptional?: boolean;
}

const DEGRADATION_STRATEGIES: Record<string, DegradationStrategy> = {
  'URANUS': {
    fallbackModel: 'claude-3-haiku',  // Cheaper model
    simplifyPrompt: (p) => `${p}\n\nProvide a brief summary only.`,
  },
  'VENUS': {
    simplifyPrompt: (p) => `${p}\n\nUse minimal styling. Focus on functionality.`,
    skipOptional: true,  // Skip animations, complex effects
  },
  'MARS': {
    fallbackModel: 'gpt-4o-mini',
    simplifyPrompt: (p) => `${p}\n\nProvide TypeScript types only, no implementation.`,
  },
};

export function applyCostDegradation(
  agent: string,
  originalPrompt: string,
  currentSpend: number,
  budget: number
): { prompt: string; model?: string; skipOptional: boolean } {
  const percentUsed = (currentSpend / budget) * 100;
  const strategy = DEGRADATION_STRATEGIES[agent];
  
  if (percentUsed < 75) {
    // Normal operation
    return { prompt: originalPrompt, skipOptional: false };
  }
  
  if (percentUsed < 90) {
    // Level 1: Simplify prompts
    return {
      prompt: strategy?.simplifyPrompt?.(originalPrompt) || originalPrompt,
      model: strategy?.fallbackModel,
      skipOptional: false,
    };
  }
  
  // Level 2: Skip optional features
  return {
    prompt: strategy?.simplifyPrompt?.(originalPrompt) || originalPrompt,
    model: strategy?.fallbackModel,
    skipOptional: true,
  };
}
```

---

## Cost Alert System

```typescript
// src/cost/alert-system.ts

type AlertLevel = 'info' | 'warning' | 'critical';

interface CostAlert {
  level: AlertLevel;
  buildId: string;
  agent: string;
  message: string;
  currentSpend: number;
  budget: number;
  percentUsed: number;
}

export function checkCostAlerts(
  buildId: string,
  agent: string,
  currentSpend: number,
  budget: number
): CostAlert | null {
  const percentUsed = (currentSpend / budget) * 100;
  
  if (percentUsed >= 100) {
    return {
      level: 'critical',
      buildId,
      agent,
      message: `CRITICAL: ${agent} exceeded budget ($${currentSpend.toFixed(2)} / $${budget})`,
      currentSpend,
      budget,
      percentUsed,
    };
  }
  
  if (percentUsed >= 90) {
    return {
      level: 'warning',
      buildId,
      agent,
      message: `WARNING: ${agent} at 90% of budget`,
      currentSpend,
      budget,
      percentUsed,
    };
  }
  
  if (percentUsed >= 75) {
    return {
      level: 'info',
      buildId,
      agent,
      message: `INFO: ${agent} at 75% of budget`,
      currentSpend,
      budget,
      percentUsed,
    };
  }
  
  return null;
}

// Send alerts to appropriate channels
export function sendAlert(alert: CostAlert): void {
  switch (alert.level) {
    case 'critical':
      console.error(`[COST ALERT] ${alert.message}`);
      // Could also: send Slack, email, etc.
      break;
    case 'warning':
      console.warn(`[COST ALERT] ${alert.message}`);
      break;
    case 'info':
      console.log(`[COST ALERT] ${alert.message}`);
      break;
  }
}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/cost/build-budget.ts` | New - per-build budget system |
| `src/cost/cost-circuit-breaker.ts` | New - circuit breaker pattern |
| `src/cost/cache-first-llm.ts` | New - cache-first strategy |
| `src/cost/graceful-degradation.ts` | New - cost overrun handling |
| `src/cost/alert-system.ts` | New - cost alerting |
| `src/llm/model-router.ts` | Integrate budget checks |
| `src/cost/cost-tracker.ts` | Enhance with per-agent tracking |

---

*Adapted from BistroLens API cost protection*
*For Nova26 LLM cost management*
