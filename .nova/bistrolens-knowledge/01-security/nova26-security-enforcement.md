# Nova26 Security Enforcement System

## Adapted from BistroLens Security Architecture

**Source:** BistroLens `29-SECURITY-STEERING.md`, `utils/` security files  
**Category:** Security Validation & Enforcement  
**Priority:** P1  
**Reusability:** 10/10

---

## Overview

BistroLens has layered security:
- Rate limiting (per user, per tier)
- Encryption (AES-256-GCM)
- WAF middleware (SQL injection, XSS, CSRF)
- Content safety validation
- Bot detection
- DDoS protection
- Row Level Security (RLS)

Nova26's ENCELADUS agent handles security guidance but has NO enforcement layer. Agent outputs (MARS/VENUS/GANYMEDE) can introduce vulnerabilities without detection.

---

## Pattern 1: Agent Output Security Scanner

**Source:** BistroLens `utils/contentSafety.ts`, `api/waf-middleware.ts`  
**Nova26 Adaptation:** Post-generation security validation

### Implementation

```typescript
// src/security/agent-output-scanner.ts

interface SecurityScanResult {
  passed: boolean;
  findings: SecurityFinding[];
  severity: 'low' | 'medium' | 'high' | 'critical';
}

interface SecurityFinding {
  type: 'secret' | 'injection' | 'xss' | 'eval' | 'prototype-pollution';
  file: string;
  line: number;
  code: string;
  remediation: string;
}

const DANGEROUS_PATTERNS = {
  // Secrets detection
  secrets: [
    /api[_-]?key['"]?\s*[:=]\s*['"`][a-zA-Z0-9]{16,}['"`]/i,
    /password['"]?\s*[:=]\s*['"`][^'"`]{8,}['"`]/i,
    /-----BEGIN (RSA )?PRIVATE KEY-----/,
    /sk-[a-zA-Z0-9]{48}/,  // OpenAI API key pattern
    /ghp_[a-zA-Z0-9]{36}/,  // GitHub token pattern
  ],
  
  // Injection vulnerabilities
  injection: [
    /eval\s*\(/,
    /new\s+Function\s*\(/,
    /setTimeout\s*\(\s*['"`]/,
    /setInterval\s*\(\s*['"`]/,
  ],
  
  // XSS vulnerabilities
  xss: [
    /dangerouslySetInnerHTML\s*[=:]/,
    /innerHTML\s*[=:]\s*.*\+/,
    /document\.write\s*\(/,
  ],
  
  // Prototype pollution
  prototypePollution: [
    /__proto__\s*:/,
    /constructor\s*\.\s*prototype/,
    /Object\.assign\s*\([^,]+,\s*req\./,
  ]
};

export function scanAgentOutput(
  files: Array<{ path: string; content: string }>
): SecurityScanResult {
  const findings: SecurityFinding[] = [];
  
  for (const file of files) {
    const lines = file.content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      for (const [category, patterns] of Object.entries(DANGEROUS_PATTERNS)) {
        for (const pattern of patterns) {
          if (pattern.test(line)) {
            findings.push({
              type: category as SecurityFinding['type'],
              file: file.path,
              line: i + 1,
              code: line.trim(),
              remediation: getRemediation(category as SecurityFinding['type'])
            });
          }
        }
      }
    }
  }
  
  const severity = calculateSeverity(findings);
  
  return {
    passed: findings.length === 0,
    findings,
    severity
  };
}

function getRemediation(type: SecurityFinding['type']): string {
  const remediations: Record<string, string> = {
    secret: 'Move to environment variables. Use process.env.XXX',
    injection: 'Use parameterized queries or prepared statements',
    xss: 'Use React built-in escaping or DOMPurify for HTML',
    eval: 'Use JSON.parse for data, or refactor to avoid dynamic code',
    'prototype-pollution': 'Use Object.freeze() or schema validation',
  };
  return remediations[type] || 'Review and fix manually';
}

function calculateSeverity(findings: SecurityFinding[]): SecurityScanResult['severity'] {
  const criticalCount = findings.filter(f => 
    f.type === 'secret' || f.type === 'injection'
  ).length;
  
  if (criticalCount > 0) return 'critical';
  if (findings.length > 5) return 'high';
  if (findings.length > 0) return 'medium';
  return 'low';
}
```

---

## Pattern 2: Rate Limiting for LLM Calls

**Source:** BistroLens `api/rateLimiter.ts`  
**Nova26 Adaptation:** Per-agent token budget enforcement

### Implementation

```typescript
// src/security/llm-rate-limiter.ts

import { db } from '../persistence/sqlite';

interface RateLimitConfig {
  perMinute: number;
  perHour: number;
  perDay: number;
}

const AGENT_RATE_LIMITS: Record<string, RateLimitConfig> = {
  SUN: { perMinute: 5, perHour: 50, perDay: 200 },
  VENUS: { perMinute: 10, perHour: 100, perDay: 500 },
  MARS: { perMinute: 10, perHour: 100, perDay: 500 },
  TITAN: { perMinute: 5, perHour: 50, perDay: 200 },
  default: { perMinute: 3, perHour: 30, perDay: 100 },
};

export function checkLLMRateLimit(
  agent: string,
  buildId: string
): { allowed: boolean; retryAfter?: number } {
  const limits = AGENT_RATE_LIMITS[agent] || AGENT_RATE_LIMITS.default;
  const now = Date.now();
  
  // Check counts in time windows
  const minuteAgo = now - 60 * 1000;
  const hourAgo = now - 60 * 60 * 1000;
  const dayAgo = now - 24 * 60 * 60 * 1000;
  
  const counts = db.prepare(`
    SELECT 
      SUM(CASE WHEN timestamp > ? THEN 1 ELSE 0 END) as minute_count,
      SUM(CASE WHEN timestamp > ? THEN 1 ELSE 0 END) as hour_count,
      SUM(CASE WHEN timestamp > ? THEN 1 ELSE 0 END) as day_count
    FROM llm_calls
    WHERE agent = ? AND build_id = ?
  `).get(minuteAgo, hourAgo, dayAgo, agent, buildId);
  
  if (counts.minute_count >= limits.perMinute) {
    return { allowed: false, retryAfter: 60 };
  }
  if (counts.hour_count >= limits.perHour) {
    return { allowed: false, retryAfter: 3600 };
  }
  if (counts.day_count >= limits.perDay) {
    return { allowed: false, retryAfter: 86400 };
  }
  
  return { allowed: true };
}
```

---

## Pattern 3: Suspicion Scoring for Builds

**Source:** BistroLens `utils/advancedRateLimiter.ts`  
**Nova26 Adaptation:** Build behavior analysis

```typescript
// src/security/build-suspicion-scorer.ts

interface SuspicionFactors {
  rapidRequests: number;
  identicalPrompts: number;
  unusualAgentPattern: number;
  highTokenUsage: number;
  repeatedFailures: number;
}

const SUSPICION_WEIGHTS: SuspicionFactors = {
  rapidRequests: 10,
  identicalPrompts: 25,
  unusualAgentPattern: 15,
  highTokenUsage: 5,
  repeatedFailures: 20,
};

export function calculateBuildSuspicion(buildId: string): { 
  score: number; 
  factors: string[];
  shouldBlock: boolean;
} {
  const build = getBuildHistory(buildId);
  const factors: string[] = [];
  let score = 0;
  
  // Check rapid requests
  const recentCalls = build.calls.filter(c => 
    Date.now() - c.timestamp < 60000
  );
  if (recentCalls.length > 10) {
    score += SUSPICION_WEIGHTS.rapidRequests;
    factors.push('rapid_requests');
  }
  
  // Check repeated failures
  const failures = build.calls.filter(c => c.failed).length;
  if (failures > 5) {
    score += SUSPICION_WEIGHTS.repeatedFailures;
    factors.push('repeated_failures');
  }
  
  return { 
    score, 
    factors,
    shouldBlock: score >= 100
  };
}
```

---

## Pattern 4: Content Safety for Generated Code

**Source:** BistroLens `utils/contentSafety.ts`  
**Nova26 Adaptation:** Code generation safety validation

```typescript
// src/security/code-content-safety.ts

const BLOCKED_CODE_PATTERNS = [
  { pattern: /child_process/, reason: 'child_process_blocked' },
  { pattern: /exec\s*\(/, reason: 'exec_blocked' },
  { pattern: /spawn\s*\(/, reason: 'spawn_blocked' },
  { pattern: /eval\s*\(/, reason: 'eval_blocked' },
  { pattern: /new\s+Function\s*\(/, reason: 'function_constructor_blocked' },
];

export function validateGeneratedCode(
  code: string,
  context: { agent: string; fileType: string }
): { safe: boolean; violations: string[] } {
  const violations: string[] = [];
  
  for (const { pattern, reason } of BLOCKED_CODE_PATTERNS) {
    if (pattern.test(code)) {
      violations.push(reason);
    }
  }
  
  // Agent-specific rules
  if (context.agent === 'VENUS' && /child_process/.test(code)) {
    violations.push('VENUS_cannot_generate_server_code');
  }
  
  return { safe: violations.length === 0, violations };
}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/security/agent-output-scanner.ts` | New - post-generation security scan |
| `src/security/llm-rate-limiter.ts` | New - per-agent rate limiting |
| `src/security/build-suspicion-scorer.ts` | New - build behavior analysis |
| `src/security/code-content-safety.ts` | New - generated code validation |
| `src/orchestrator/gate-runner.ts` | Add security gate |

---

*Adapted from BistroLens security architecture*
*For Nova26 agent output validation*
