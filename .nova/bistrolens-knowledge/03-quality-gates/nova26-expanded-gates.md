# Nova26 Expanded Quality Gates

## Adapted from BistroLens Hook System

**Source:** BistroLens `.kiro/hooks/*.json` (9 automated hooks)  
**Category:** Quality Assurance & Validation  
**Priority:** P1  
**Reusability:** 9/10

---

## Overview

BistroLens has 9 automated hooks that trigger on different events:
1. `pre-commit-quality.json` - TypeScript, lint, import checks
2. `security-scan.json` - Vulnerability scanning
3. `accessibility-audit.json` - a11y compliance
4. `performance-check.json` - Bundle size, load times
5. `api-cost-monitor.json` - Cost tracking
6. `test-runner.json` - Smart test execution
7. `release-checklist.json` - Pre-release validation
8. `i18n-string-check.json` - Localization
9. `documentation-sync.json` - Doc verification

Nova26 has 4 gates: `response-validation`, `mercury-validator`, `hard-limits`, `schema-validation`. Need to expand based on BistroLens patterns.

---

## New Gate: accessibility-gate

**Source:** BistroLens `accessibility-audit.json`, `50-ACCESSIBILITY-WCAG-COMPLIANCE.md`  
**Trigger:** After VENUS generates UI components

### Implementation

```typescript
// src/gates/accessibility-gate.ts

interface AccessibilityViolation {
  rule: string;
  element: string;
  file: string;
  line: number;
  severity: 'error' | 'warning';
  fix: string;
}

const A11Y_RULES = {
  // Interactive elements must be keyboard accessible
  'click-events-have-key-events': {
    pattern: /onClick\s*[=:]/,
    check: (code: string) => 
      code.includes('onClick') && 
      !code.includes('onKeyDown') && 
      !code.includes('onKeyPress'),
    fix: 'Add onKeyDown handler or use <button>',
  },
  
  // Images must have alt text
  'img-must-have-alt': {
    pattern: /<img[^>]*>/,
    check: (code: string) => 
      /<img[^>]*>/.test(code) && 
      !/alt\s*[=:]/.test(code),
    fix: 'Add alt attribute (empty string for decorative)',
  },
  
  // Form inputs must have labels
  'input-must-have-label': {
    pattern: /<input[^>]*>/,
    check: (code: string) => {
      const hasLabel = /htmlFor\s*[=:]/.test(code) || 
                       /aria-label\s*[=:]/.test(code) ||
                       /aria-labelledby\s*[=:]/.test(code);
      return !hasLabel;
    },
    fix: 'Add label with htmlFor or aria-label',
  },
  
  // Page must have heading hierarchy
  'heading-hierarchy': {
    pattern: /<h[1-6][^>]*>/g,
    check: (code: string) => {
      const headings = code.match(/<h[1-6][^>]*>/g) || [];
      let lastLevel = 0;
      for (const h of headings) {
        const level = parseInt(h[2]);
        if (level > lastLevel + 1) return true; // Skipped level
        lastLevel = level;
      }
      return false;
    },
    fix: 'Use proper heading hierarchy (h1 -> h2 -> h3)',
  },
  
  // aria-live for dynamic content
  'dynamic-content-needs-live-region': {
    pattern: /\{[^}]*\}/,
    check: (code: string) => 
      /\{(loading|error|data)\??\.?/.test(code) && 
      !/aria-live\s*[=:]/.test(code),
    fix: 'Add aria-live="polite" for dynamic content',
  },
};

export function runAccessibilityGate(
  files: Array<{ path: string; content: string }>
): { passed: boolean; violations: AccessibilityViolation[] } {
  const violations: AccessibilityViolation[] = [];
  
  for (const file of files) {
    if (!file.path.endsWith('.tsx')) continue;
    
    const lines = file.content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      for (const [ruleName, rule] of Object.entries(A11Y_RULES)) {
        if (rule.pattern.test(line) && rule.check(line)) {
          violations.push({
            rule: ruleName,
            element: line.trim().slice(0, 50),
            file: file.path,
            line: i + 1,
            severity: 'error',
            fix: rule.fix,
          });
        }
      }
    }
  }
  
  return {
    passed: violations.filter(v => v.severity === 'error').length === 0,
    violations,
  };
}
```

---

## New Gate: performance-gate

**Source:** BistroLens `performance-check.json`  
**Trigger:** After component generation, before commit

### Implementation

```typescript
// src/gates/performance-gate.ts

interface PerformanceMetric {
  name: string;
  value: number;
  threshold: number;
  passed: boolean;
}

const PERFORMANCE_THRESHOLDS = {
  maxBundleSizeKB: 500,
  maxFirstLoadJSKB: 200,
  maxComponentLines: 300,
  maxPropsCount: 15,
  maxNestedDepth: 5,
};

export function runPerformanceGate(
  files: Array<{ path: string; content: string }>
): { passed: boolean; metrics: PerformanceMetric[] } {
  const metrics: PerformanceMetric[] = [];
  
  for (const file of files) {
    // Check component size
    const lineCount = file.content.split('\n').length;
    metrics.push({
      name: `${file.path} - lines`,
      value: lineCount,
      threshold: PERFORMANCE_THRESHOLDS.maxComponentLines,
      passed: lineCount <= PERFORMANCE_THRESHOLDS.maxComponentLines,
    });
    
    // Check prop count (for React components)
    const propsMatch = file.content.match(/interface\s+\w+Props\s*\{[^}]*\}/s);
    if (propsMatch) {
      const propCount = propsMatch[0].match(/\w+\??\s*:/g)?.length || 0;
      metrics.push({
        name: `${file.path} - props`,
        value: propCount,
        threshold: PERFORMANCE_THRESHOLDS.maxPropsCount,
        passed: propCount <= PERFORMANCE_THRESHOLDS.maxPropsCount,
      });
    }
    
    // Check nesting depth
    const maxDepth = calculateNestingDepth(file.content);
    metrics.push({
      name: `${file.path} - nesting depth`,
      value: maxDepth,
      threshold: PERFORMANCE_THRESHOLDS.maxNestedDepth,
      passed: maxDepth <= PERFORMANCE_THRESHOLDS.maxNestedDepth,
    });
    
    // Check for expensive patterns
    const hasExpensivePattern = 
      /useEffect\s*\(\s*\(\s*\)\s*=>\s*\{[\s\S]{200,}\}\s*\)/.test(file.content);
    if (hasExpensivePattern) {
      metrics.push({
        name: `${file.path} - expensive useEffect`,
        value: 1,
        threshold: 0,
        passed: false,
      });
    }
  }
  
  return {
    passed: metrics.every(m => m.passed),
    metrics,
  };
}

function calculateNestingDepth(code: string): number {
  let maxDepth = 0;
  let currentDepth = 0;
  
  for (const char of code) {
    if (char === '(' || char === '{' || char === '[') {
      currentDepth++;
      maxDepth = Math.max(maxDepth, currentDepth);
    } else if (char === ')' || char === '}' || char === ']') {
      currentDepth--;
    }
  }
  
  return maxDepth;
}
```

---

## New Gate: i18n-gate

**Source:** BistroLens `i18n-string-check.json`  
**Trigger:** After UI component generation

### Implementation

```typescript
// src/gates/i18n-gate.ts

interface I18nFinding {
  type: 'hardcoded' | 'inconsistent' | 'missing-key';
  text: string;
  file: string;
  line: number;
  suggestion: string;
}

const HARDcoded_PATTERNS = [
  // Common hardcoded UI strings
  />([^<]{3,50})</g,  // Text between tags
  /placeholder\s*=\s*["']([^"']{3,})["']/g,
  /title\s*=\s*["']([^"']{3,})["']/g,
  /aria-label\s*=\s*["']([^"']{3,})["']/g,
];

const UI_COMMON_WORDS = new Set([
  'submit', 'cancel', 'save', 'delete', 'edit', 'create', 
  'loading', 'error', 'success', 'retry', 'close', 'open',
  'next', 'previous', 'back', 'continue', 'confirm',
]);

export function runI18nGate(
  files: Array<{ path: string; content: string }>
): { passed: boolean; findings: I18nFinding[] } {
  const findings: I18nFinding[] = [];
  
  for (const file of files) {
    if (!file.path.endsWith('.tsx')) continue;
    
    const lines = file.content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check for hardcoded strings that should be i18n keys
      for (const pattern of HARDcoded_PATTERNS) {
        const matches = line.matchAll(pattern);
        for (const match of matches) {
          const text = match[1].trim();
          
          // Skip if it's already a variable or function call
          if (text.startsWith('{') || text.includes('$')) continue;
          
          // Check if it looks like UI text
          if (UI_COMMON_WORDS.has(text.toLowerCase())) {
            findings.push({
              type: 'hardcoded',
              text,
              file: file.path,
              line: i + 1,
              suggestion: `Use t('${toCamelCase(text)}') instead of "${text}"`,
            });
          }
        }
      }
    }
  }
  
  return {
    passed: findings.filter(f => f.type === 'hardcoded').length === 0,
    findings,
  };
}

function toCamelCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-zA-Z0-9]+(.)/g, (m, chr) => chr.toUpperCase());
}
```

---

## New Gate: documentation-gate

**Source:** BistroLens `documentation-sync.json`  
**Trigger:** Before build completion

### Implementation

```typescript
// src/gates/documentation-gate.ts

interface DocRequirement {
  file: string;
  requiredDocs: string[];
  optionalDocs: string[];
}

const DOC_REQUIREMENTS: Record<string, DocRequirement> = {
  'src/orchestrator/*.ts': {
    file: 'pattern',
    requiredDocs: ['.nova/architecture/orchestrator.md'],
    optionalDocs: ['.nova/adr/*.md'],
  },
  'convex/*.ts': {
    file: 'pattern',
    requiredDocs: ['convex/README.md'],
    optionalDocs: ['.nova/database/schema.md'],
  },
  'src/components/*.tsx': {
    file: 'pattern',
    requiredDocs: [],
    optionalDocs: ['.nova/components/*.md'],
  },
};

export function runDocumentationGate(
  files: Array<{ path: string; content: string }>
): { 
  passed: boolean; 
  coverage: number;
  missing: Array<{ file: string; doc: string }>;
} {
  const missing: Array<{ file: string; doc: string }> = [];
  let totalRequirements = 0;
  let metRequirements = 0;
  
  for (const file of files) {
    for (const [pattern, requirement] of Object.entries(DOC_REQUIREMENTS)) {
      if (minimatch(file.path, pattern)) {
        for (const doc of requirement.requiredDocs) {
          totalRequirements++;
          if (!fileExists(doc)) {
            missing.push({ file: file.path, doc });
          } else {
            metRequirements++;
          }
        }
        
        for (const doc of requirement.optionalDocs) {
          totalRequirements += 0.5;
          if (fileExists(doc)) {
            metRequirements += 0.5;
          }
        }
      }
    }
  }
  
  const coverage = totalRequirements > 0 
    ? metRequirements / totalRequirements 
    : 1;
  
  return {
    passed: coverage >= 0.8 && missing.length === 0,
    coverage,
    missing,
  };
}

function fileExists(path: string): boolean {
  // Implementation using fs
  try {
    require('fs').accessSync(path);
    return true;
  } catch {
    return false;
  }
}

function minimatch(path: string, pattern: string): boolean {
  // Use minimatch library
  const { minimatch } = require('minimatch');
  return minimatch(path, pattern);
}
```

---

## New Gate: cost-monitor-gate

**Source:** BistroLens `api-cost-monitor.json`  
**Trigger:** After each LLM call, at build milestones

### Implementation

```typescript
// src/gates/cost-monitor-gate.ts

interface CostAlert {
  type: 'threshold' | 'spike' | 'budget';
  agent: string;
  current: number;
  threshold: number;
  message: string;
}

const COST_THRESHOLDS = {
  perAgentPerBuild: 0.50,  // $0.50 per agent per build
  perBuildTotal: 5.00,      // $5.00 total per build
  dailyBudget: 50.00,       // $50.00 per day
  warningAtPercent: 80,
};

export function runCostMonitorGate(
  buildId: string
): { 
  passed: boolean; 
  alerts: CostAlert[];
  report: CostReport;
} {
  const alerts: CostAlert[] = [];
  
  // Get costs for this build
  const buildCosts = getBuildCosts(buildId);
  const dailyCosts = getDailyCosts();
  
  // Check per-agent thresholds
  for (const [agent, cost] of Object.entries(buildCosts.byAgent)) {
    if (cost > COST_THRESHOLDS.perAgentPerBuild) {
      alerts.push({
        type: 'threshold',
        agent,
        current: cost,
        threshold: COST_THRESHOLDS.perAgentPerBuild,
        message: `${agent} exceeded per-agent cost threshold`,
      });
    }
  }
  
  // Check total build cost
  if (buildCosts.total > COST_THRESHOLDS.perBuildTotal) {
    alerts.push({
      type: 'budget',
      agent: 'TOTAL',
      current: buildCosts.total,
      threshold: COST_THRESHOLDS.perBuildTotal,
      message: 'Build exceeded total cost threshold',
    });
  }
  
  // Check daily budget
  const dailyPercent = (dailyCosts / COST_THRESHOLDS.dailyBudget) * 100;
  if (dailyPercent >= COST_THRESHOLDS.warningAtPercent) {
    alerts.push({
      type: 'spike',
      agent: 'DAILY',
      current: dailyCosts,
      threshold: COST_THRESHOLDS.dailyBudget,
      message: `Daily budget ${dailyPercent.toFixed(0)}% consumed`,
    });
  }
  
  return {
    passed: alerts.filter(a => a.type === 'budget').length === 0,
    alerts,
    report: buildCosts,
  };
}

interface CostReport {
  total: number;
  byAgent: Record<string, number>;
  byModel: Record<string, number>;
}

function getBuildCosts(buildId: string): CostReport {
  // Query from database
  const rows = db.prepare(`
    SELECT agent, model, SUM(cost_usd) as cost
    FROM cost_logs
    WHERE build_id = ?
    GROUP BY agent, model
  `).all(buildId);
  
  const byAgent: Record<string, number> = {};
  const byModel: Record<string, number> = {};
  let total = 0;
  
  for (const row of rows) {
    byAgent[row.agent] = (byAgent[row.agent] || 0) + row.cost;
    byModel[row.model] = (byModel[row.model] || 0) + row.cost;
    total += row.cost;
  }
  
  return { total, byAgent, byModel };
}

function getDailyCosts(): number {
  const today = new Date().toISOString().split('T')[0];
  const row = db.prepare(`
    SELECT SUM(cost_usd) as total
    FROM cost_logs
    WHERE date(timestamp / 1000, 'unixepoch') = ?
  `).get(today);
  
  return row?.total || 0;
}
```

---

## Gate Priority Order

```typescript
const GATE_EXECUTION_ORDER = [
  'hard-limits',           // Fast syntactic checks
  'security-gate',         // Security scan (new)
  'schema-validation',     // Database schema
  'response-validation',   // LLM output format
  'mercury-validator',     // MERCURY review
  'accessibility-gate',    // a11y checks (new)
  'performance-gate',      // Performance (new)
  'i18n-gate',             // i18n readiness (new)
  'cost-monitor-gate',     // Cost tracking (new)
  'documentation-gate',    // Docs coverage (new)
];
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/gates/accessibility-gate.ts` | New - WCAG compliance |
| `src/gates/performance-gate.ts` | New - Performance metrics |
| `src/gates/i18n-gate.ts` | New - i18n validation |
| `src/gates/documentation-gate.ts` | New - Doc coverage |
| `src/gates/cost-monitor-gate.ts` | New - Cost tracking |
| `src/orchestrator/gate-runner.ts` | Add new gates to pipeline |

---

*Adapted from BistroLens hook system*
*For Nova26 quality assurance*
