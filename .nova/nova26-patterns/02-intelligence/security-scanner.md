# Static Security Scanner

**Category:** 02-intelligence
**Type:** Pattern
**Tags:** security, static-analysis, secrets, xss, sql-injection, nova26

---

## Overview

`SecurityScanner` performs static analysis on the codebase before deployment. Detects secrets, SQL injection, XSS, path traversal, insecure randomness, and ReDoS patterns. Also runs `npm audit` for dependency vulnerabilities.

---

## Source

`src/security/security-scanner.ts`

---

## Pattern
  async scanDirectory(dir: string): Promise<ScanResult> {
    await this.scanRecursive(dir);
    await this.runNpmAudit();

    const critical = this.findings.filter(f => f.severity === 'critical').length;
    const high     = this.findings.filter(f => f.severity === 'high').length;

    return {
      findings: this.findings,
      scannedFiles: this.scannedFiles,
      duration: Date.now() - this.startTime,
      passed: critical === 0 && high === 0, // Only critical/high block builds
    };
  }
}
```

```typescript
// Pattern categories scanned
const SCAN_PATTERNS = [
  // Secrets
  { name: 'AWS Access Key',  pattern: /AKIA[0-9A-Z]{16}/,           severity: 'critical', type: 'secret' },
  { name: 'Stripe Key',      pattern: /sk_live_[0-9a-zA-Z]{24,}/,   severity: 'critical', type: 'secret' },
  { name: 'OpenAI API Key',  pattern: /sk-[a-zA-Z0-9]{48}/,         severity: 'critical', type: 'secret' },
  { name: 'Password in Code',pattern: /password\s*[=:]\s*['"`][^'"`]{4,}['"`]/i, severity: 'high', type: 'secret' },

  // SQL Injection
  { name: 'String Concat in Query', pattern: /(?:query|execute)\s*\(\s*[`"'][^`"']*\$\{/, severity: 'critical', type: 'sql-injection' },

  // XSS
  { name: 'Dangerous innerHTML', pattern: /innerHTML\s*=\s*[^;]*(?:req\.|params|body)/i, severity: 'high', type: 'xss' },
  { name: 'Eval Usage',          pattern: /\beval\s*\(/,                                  severity: 'critical', type: 'xss' },

  // Path Traversal
  { name: 'Path Traversal Risk', pattern: /(?:fs\.|readFile|sendFile)\s*\([^)]*(?:req\.|params|body)/i, severity: 'high', type: 'path-traversal' },

  // Insecure Randomness
  { name: 'Math.random for Security', pattern: /Math\.random\s*\(\)[^;]*(?:token|password|key|secret)/i, severity: 'high', type: 'insecure-random' },
];
```

---

## Usage

```typescript
// Quick scan before deployment
const result = await quickSecurityScan(process.cwd());
console.log(formatSecurityReport(result));

if (!result.passed) {
  console.error('Security scan failed — fix critical/high issues before deploying');
  process.exit(1);
}

// Output:
// 🔒 Security Scan Report
// Files Scanned: 142
// Findings: 2
//   Critical: 1 (AWS Access Key in src/config.ts:14)
//   High: 1 (Password in Code in tests/fixtures.ts:8)
// ❌ FAILED - Security issues found
```

---

## Anti-Patterns

```typescript
// ❌ Blocking on medium/low severity — too noisy
return { passed: findings.length === 0 }; // Blocks on every minor issue

// ✅ Good: Only block on critical/high severity
return { passed: findings.filter(f => f.severity === 'critical' || f.severity === 'high').length === 0 };

// ❌ Scanning node_modules — slow and irrelevant
// Always skip: node_modules, .git, hidden directories

// ✅ Good: Exclude non-project directories
const skipDirs = ['node_modules', '.git', 'dist'];

// ❌ No npm audit — misses dependency vulnerabilities
// npm audit catches known CVEs in dependencies

// ✅ Good: Include npm audit in the scan pipeline
const auditResult = await runNpmAudit(); // Catches known CVEs
```

---

## When to Use

- Pre-deployment gate to catch secrets and vulnerabilities before code ships
- CI/CD pipeline integration as a blocking quality gate
- Periodic codebase audits for security hygiene

---

## Benefits

- Catches hardcoded secrets before they reach version control
- Severity-gated pass/fail avoids blocking on low-risk findings
- Combines static regex analysis with npm audit for comprehensive coverage
- Fast execution — regex scanning is lightweight compared to full SAST tools

---

## Related Patterns

- `../01-orchestration/gate-runner-pipeline.md` — Security scanner can be a gate
- `smart-retry-escalation.md` — Retry after security fix
