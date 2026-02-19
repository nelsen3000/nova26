# Nova26 Code Generation Governance

## Adapted from BistroLens Image Governance System

**Source:** BistroLens `04-IMAGE-SYSTEM-MASTER.md`, `36-IMAGE-SYSTEM-RED-LINES.md`  
**Category:** Generated Code Governance  
**Priority:** P1  
**Reusability:** 8/10

---

## Overview

BistroLens has comprehensive image governance: policies, red lines, kill switches, admin approval, deduplication, quality scoring. Nova26 generates CODE not images, but the governance MODEL is directly applicable.

**Key concept:** Code generation is also asset generation. It needs the same governance rigor.

---

## Code Generation Taxonomy

| Code Type | Risk Level | Auto-Approve | Review Required | Nova26 Agent |
|-----------|-----------|--------------|-----------------|--------------|
| UI Components | Low | Yes | No | VENUS |
| Schema Definitions | Medium | Yes | No | PLUTO |
| API Functions | Medium | Yes | No | GANYMEDE |
| Business Logic | High | No | MARS+SUN | MARS |
| Security Functions | Critical | No | ENCELADUS+SUN | ENCELADUS |
| Auth/Permissions | Critical | No | ENCELADUS+SUN | ENCELADUS |
| Database Migrations | Critical | No | PLUTO+SUN | PLUTO |

---

## Red Lines for Generated Code

### NEVER Generate Code With:

```typescript
const CODE_RED_LINES = {
  // Security vulnerabilities
  'eval-usage': {
    pattern: /eval\s*\(/,
    severity: 'CRITICAL',
    message: 'Never use eval() - use JSON.parse or safer alternatives',
  },
  
  'dynamic-function': {
    pattern: /new\s+Function\s*\(/,
    severity: 'CRITICAL',
    message: 'Never use new Function() - security risk',
  },
  
  'hardcoded-secrets': {
    pattern: /(password|secret|token|key)\s*[:=]\s*['"`][^'"`]{8,}['"`]/i,
    severity: 'CRITICAL',
    message: 'Never hardcode secrets - use environment variables',
  },
  
  'sql-injection': {
    pattern: /query\s*\(\s*['"`].*\$/,
    severity: 'CRITICAL',
    message: 'Never concatenate SQL with user input',
  },
  
  // Anti-patterns
  'any-types': {
    pattern: /:\s*any\b/,
    severity: 'HIGH',
    message: 'Never use any - use proper types',
  },
  
  'inline-styles': {
    pattern: /style\s*=\s*\{\{/,
    severity: 'HIGH',
    message: 'Never use inline styles - use Tailwind classes',
  },
  
  'div-onclick': {
    pattern: /<div[^>]*onClick/,
    severity: 'HIGH',
    message: 'Never use div onClick - use button element',
  },
  
  // Architectural violations
  'client-db-access': {
    pattern: /ctx\.db\./,
    context: 'client',
    severity: 'CRITICAL',
    message: 'Never access database from client code',
  },
  
  'server-dom-access': {
    pattern: /document\.|window\./,
    context: 'server',
    severity: 'CRITICAL',
    message: 'Never access DOM from server code',
  },
};
```

---

## Code Quality Gates

### Gate 1: Syntax Validation (Pre-Generation)

```typescript
// src/governance/syntax-gate.ts

export function validateSyntaxRequest(
  agent: string,
  request: CodeRequest
): { allowed: boolean; reason?: string } {
  // Check if agent is allowed to generate this code type
  const allowedTypes = AGENT_CODE_CAPABILITIES[agent];
  
  if (!allowedTypes.includes(request.codeType)) {
    return {
      allowed: false,
      reason: `${agent} is not authorized to generate ${request.codeType}`,
    };
  }
  
  // Check for red line patterns in request
  for (const [ruleName, rule] of Object.entries(CODE_RED_LINES)) {
    if (rule.pattern.test(request.description)) {
      return {
        allowed: false,
        reason: `Request violates red line: ${rule.message}`,
      };
    }
  }
  
  return { allowed: true };
}

const AGENT_CODE_CAPABILITIES: Record<string, string[]> = {
  VENUS: ['ui-component', 'css', 'typescript-types'],
  MARS: ['business-logic', 'utilities', 'typescript-types'],
  PLUTO: ['schema', 'migration', 'convex-function'],
  GANYMEDE: ['api-function', 'integration', 'webhook'],
  ENCELADUS: ['security-function', 'auth', 'validation'],
  TITAN: ['subscription', 'realtime', 'optimistic-update'],
};
```

### Gate 2: Quality Scoring (Post-Generation)

```typescript
// src/governance/quality-scorer.ts

interface CodeQualityScore {
  total: number;        // 0-100
  breakdown: {
    security: number;   // 0-25
    typeSafety: number; // 0-25
    style: number;      // 0-20
    testability: number;// 0-15
    documentation: number;// 0-15
  };
}

export function scoreCodeQuality(
  code: string,
  context: { agent: string; fileType: string }
): CodeQualityScore {
  const breakdown = {
    security: scoreSecurity(code),
    typeSafety: scoreTypeSafety(code),
    style: scoreStyle(code),
    testability: scoreTestability(code),
    documentation: scoreDocumentation(code),
  };
  
  const total = Object.values(breakdown).reduce((a, b) => a + b, 0);
  
  return { total, breakdown };
}

function scoreSecurity(code: string): number {
  let score = 25;
  
  for (const [ruleName, rule] of Object.entries(CODE_RED_LINES)) {
    if (rule.severity === 'CRITICAL' && rule.pattern.test(code)) {
      score = 0; // Critical violation = 0 security score
      break;
    }
    if (rule.severity === 'HIGH' && rule.pattern.test(code)) {
      score -= 10;
    }
  }
  
  return Math.max(0, score);
}

function scoreTypeSafety(code: string): number {
  let score = 25;
  
  // Penalize 'any' usage
  const anyCount = (code.match(/:\s*any\b/g) || []).length;
  score -= anyCount * 5;
  
  // Penalize missing return types on functions
  const functionsWithoutReturn = (code.match(/function\s+\w+\s*\([^)]*\)\s*\{/g) || []).length;
  score -= functionsWithoutReturn * 2;
  
  return Math.max(0, score);
}

function scoreStyle(code: string): number {
  let score = 20;
  
  // Check for hard-limits violations
  if (/style\s*=\s*\{\{/.test(code)) score -= 10; // inline styles
  if (/<div[^>]*onClick/.test(code)) score -= 10; // div onClick
  
  return Math.max(0, score);
}

function scoreTestability(code: string): number {
  let score = 15;
  
  // Check for pure functions
  if (/Math\.random\(\)/.test(code)) score -= 5;
  if (/Date\.now\(\)/.test(code) && !/const.*=.*Date\.now/.test(code)) score -= 3;
  
  return Math.max(0, score);
}

function scoreDocumentation(code: string): number {
  let score = 15;
  
  const hasJSDoc = /\/\*\*[\s\S]*?\*\//.test(code);
  const hasComments = /\/\/.*\b(why|what|how)\b/i.test(code);
  
  if (!hasJSDoc) score -= 5;
  if (!hasComments) score -= 5;
  
  return Math.max(0, score);
}
```

---

## Kill Switch System

```typescript
// src/governance/kill-switch.ts

interface KillSwitchState {
  globalEnabled: boolean;
  agentOverrides: Record<string, boolean>;
  triggeredBy?: string;
  triggeredAt?: number;
  reason?: string;
}

class CodeGenerationKillSwitch {
  private state: KillSwitchState = {
    globalEnabled: true,
    agentOverrides: {},
  };
  
  // Emergency stop all code generation
  triggerGlobalKill(reason: string, triggeredBy: string): void {
    this.state.globalEnabled = false;
    this.state.triggeredBy = triggeredBy;
    this.state.triggeredAt = Date.now();
    this.state.reason = reason;
    
    // Log and alert
    logCriticalEvent('CODE_GENERATION_KILL_SWITCH', {
      reason,
      triggeredBy,
      timestamp: Date.now(),
    });
    
    alertAdmins(`Code generation KILL SWITCH activated: ${reason}`);
  }
  
  // Disable specific agent
  disableAgent(agent: string, reason: string): void {
    this.state.agentOverrides[agent] = false;
    
    logSecurityEvent({
      type: 'agent_disabled',
      agent,
      reason,
    });
  }
  
  canGenerate(agent: string): boolean {
    if (!this.state.globalEnabled) return false;
    if (this.state.agentOverrides[agent] === false) return false;
    return true;
  }
}

// Auto-trigger conditions
const AUTO_PAUSE_CONDITIONS = {
  // If >10% of generated code has critical security issues
  securityRejectionSpike: (stats: GenerationStats) => 
    stats.criticalViolations / stats.totalFiles > 0.1,
  
  // If >20% of code fails quality gates
  qualityFailureSpike: (stats: GenerationStats) => 
    stats.failedQualityGates / stats.totalFiles > 0.2,
  
  // If build cost exceeds $10
  costThreshold: (stats: GenerationStats) => 
    stats.totalCost > 10,
};
```

---

## Code Deduplication

```typescript
// src/governance/code-deduplication.ts

import { createHash } from 'crypto';

interface CodeFingerprint {
  contentHash: string;
  astHash: string;
  semanticHash: string;
  agent: string;
  createdAt: number;
}

export function generateCodeFingerprint(
  code: string,
  agent: string
): CodeFingerprint {
  // Content hash - exact match
  const contentHash = createHash('sha256').update(code).digest('hex');
  
  // AST hash - structural match (ignores formatting)
  const astHash = generateASTHash(code);
  
  // Semantic hash - functional match (ignores variable names)
  const semanticHash = generateSemanticHash(code);
  
  return {
    contentHash,
    astHash,
    semanticHash,
    agent,
    createdAt: Date.now(),
  };
}

export function findSimilarCode(
  fingerprint: CodeFingerprint
): CodeFingerprint | null {
  // Check for exact duplicate
  const exactMatch = db.query(`
    SELECT * FROM code_fingerprints
    WHERE content_hash = ?
  `, fingerprint.contentHash);
  
  if (exactMatch) {
    return exactMatch; // Reuse this code
  }
  
  // Check for structural duplicate (same logic, different formatting)
  const structuralMatch = db.query(`
    SELECT * FROM code_fingerprints
    WHERE ast_hash = ?
  `, fingerprint.astHash);
  
  if (structuralMatch) {
    return structuralMatch; // Consider reformatting instead of regenerating
  }
  
  return null;
}
```

---

## Approval Workflow

```typescript
// src/governance/approval-workflow.ts

interface ApprovalRequest {
  id: string;
  agent: string;
  codeType: string;
  code: string;
  qualityScore: number;
  securityScan: SecurityScanResult;
  requestedAt: number;
  approvedBy?: string;
  approvedAt?: number;
}

const APPROVAL_REQUIREMENTS: Record<string, { minScore: number; requireHuman: boolean }> = {
  'ui-component': { minScore: 60, requireHuman: false },
  'business-logic': { minScore: 70, requireHuman: false },
  'api-function': { minScore: 75, requireHuman: true },
  'security-function': { minScore: 90, requireHuman: true },
  'auth': { minScore: 95, requireHuman: true },
  'migration': { minScore: 85, requireHuman: true },
};

export function requiresApproval(
  codeType: string,
  qualityScore: number
): boolean {
  const requirements = APPROVAL_REQUIREMENTS[codeType];
  
  if (!requirements) return true; // Unknown type requires approval
  
  if (qualityScore < requirements.minScore) return true;
  if (requirements.requireHuman) return true;
  
  return false;
}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/governance/red-lines.ts` | New - define code red lines |
| `src/governance/quality-scorer.ts` | New - code quality scoring |
| `src/governance/kill-switch.ts` | New - emergency stop system |
| `src/governance/code-deduplication.ts` | New - fingerprint and dedupe |
| `src/governance/approval-workflow.ts` | New - human approval process |
| `src/orchestrator/gate-runner.ts` | Integrate governance gates |

---

## Source

Adapted from BistroLens image governance system. See `04-IMAGE-SYSTEM-MASTER.md`, `36-IMAGE-SYSTEM-RED-LINES.md`.

## Anti-Patterns

- Don't allow any agent to generate code outside its authorized capabilities -- enforce `AGENT_CODE_CAPABILITIES` strictly
- Don't skip quality scoring for auto-approved code types -- even low-risk UI components should be scored
- Don't disable the kill switch during development -- it exists to catch cascading failures early
- Don't rely solely on regex-based red line detection -- combine with AST analysis for structural violations

## When to Use

- Before code generation to validate that the requesting agent is authorized for the code type
- After code generation to score quality and check for red line violations
- When build failure rates spike above thresholds to trigger automatic kill switches
- When deduplicating generated code to avoid regenerating existing logic

## Benefits

- Prevents unauthorized code generation by enforcing per-agent capability boundaries
- Provides quantitative quality scoring (0-100) across security, type safety, style, testability, and documentation
- Kill switch system enables emergency stop of all code generation when critical thresholds are breached
- Code deduplication via content, AST, and semantic hashing avoids wasted LLM calls

## Related Patterns

- See `nova26-security-enforcement.md` for the security scanning layer that feeds into quality scoring
- See `nova26-expanded-gates.md` for the full gate pipeline that integrates governance checks
- See `nova26-cost-protection.md` for cost thresholds that can trigger kill switches
- See `nova26-test-plan.md` for testing strategies that validate governance enforcement

---

*Adapted from BistroLens image governance system*
*For Nova26 code generation governance*
