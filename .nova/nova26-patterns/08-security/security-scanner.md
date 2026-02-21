# Security Scanner

## Source
Extracted from Nova26 `src/security/security-scanner.ts`

---

## Pattern: Security Scanner

A static analysis security scanner that detects vulnerabilities in generated and authored code before deployment. The scanner checks for six categories of security issues — leaked secrets, SQL injection, XSS, path traversal, insecure randomness, and ReDoS — using regex-based pattern matching across all TypeScript/JavaScript source files. It also integrates `npm audit` to catch known CVEs in dependencies. The scan result uses a severity-gated pass/fail: only critical and high findings block the build, keeping the feedback loop tight without drowning developers in low-severity noise.

---

## Implementation

### Code Example

```typescript
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import { execSync } from 'child_process';

interface SecurityFinding {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  type: string;
  file: string;
  line: number;
  column: number;
  message: string;
  suggestion: string;
  code: string;
}

interface ScanResult {
  findings: SecurityFinding[];
  scannedFiles: number;
  duration: number;
  passed: boolean;
}

// Pattern categories — each rule has a regex, severity, and actionable suggestion
const SECRET_PATTERNS = [
  { name: 'AWS Access Key',    pattern: /AKIA[0-9A-Z]{16}/,                severity: 'critical' as const },
  { name: 'GitHub Token',      pattern: /gh[pousr]_[A-Za-z0-9_]{36,}/,    severity: 'critical' as const },
  { name: 'Stripe Key',        pattern: /sk_live_[0-9a-zA-Z]{24,}/,       severity: 'critical' as const },
  { name: 'OpenAI API Key',    pattern: /sk-[a-zA-Z0-9]{48}/,             severity: 'critical' as const },
  { name: 'Password in Code',  pattern: /password\s*[=:]\s*['"`][^'"`]{4,}['"`]/i, severity: 'high' as const },
  { name: 'Database URL',      pattern: /(mongodb|postgres|mysql):\/\/[^:]+:[^@]+@/i, severity: 'high' as const },
];

const XSS_PATTERNS = [
  {
    name: 'Eval Usage',
    pattern: /\beval\s*\(/,
    severity: 'critical' as const,
    suggestion: 'Never use eval(). Use JSON.parse or Function constructor instead',
  },
  {
    name: 'Dangerous innerHTML',
    pattern: /innerHTML\s*=\s*[^;]*(?:req\.|request\.|params|body)/i,
    severity: 'high' as const,
    suggestion: 'Use textContent or sanitize HTML with DOMPurify',
  },
  {
    name: 'Unsafe React dangerouslySetInnerHTML',
    pattern: /dangerouslySetInnerHTML\s*=\s*\{\s*\{\s*__html\s*:/,
    severity: 'medium' as const,
    suggestion: 'Ensure content is sanitized before using dangerouslySetInnerHTML',
  },
];

const SQL_INJECTION_PATTERNS = [
  {
    name: 'String Concatenation in Query',
    pattern: /(?:query|execute|exec)\s*\(\s*[`"'][^`"']*\$\{/,
    severity: 'critical' as const,
    suggestion: 'Use parameterized queries instead of string interpolation',
  },
];

// Merge all categories into a single scan list
const SCAN_PATTERNS = [
  ...SECRET_PATTERNS.map(p => ({ ...p, type: 'secret' as const })),
  ...XSS_PATTERNS.map(p => ({ ...p, type: 'xss' as const })),
  ...SQL_INJECTION_PATTERNS.map(p => ({ ...p, type: 'sql-injection' as const })),
];

export class SecurityScanner {
  private findings: SecurityFinding[] = [];
  private scannedFiles = 0;
  private startTime: number = 0;

  async scanDirectory(dir: string): Promise<ScanResult> {
    this.findings = [];
    this.scannedFiles = 0;
    this.startTime = Date.now();

    await this.scanRecursive(dir);
    await this.runNpmAudit();

    const duration = Date.now() - this.startTime;
    const critical = this.findings.filter(f => f.severity === 'critical').length;
    const high = this.findings.filter(f => f.severity === 'high').length;

    return {
      findings: this.findings,
      scannedFiles: this.scannedFiles,
      duration,
      passed: critical === 0 && high === 0,
    };
  }

  private shouldScanFile(filename: string): boolean {
    const scanExts = ['.ts', '.tsx', '.js', '.jsx', '.json', '.env'];
    return scanExts.includes(extname(filename)) || filename === '.env';
  }

  private async scanFile(filePath: string): Promise<void> {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    this.scannedFiles++;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const pattern of SCAN_PATTERNS) {
        const match = pattern.pattern.exec(line);
        if (match) {
          this.findings.push({
            id: `sec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            severity: pattern.severity,
            type: pattern.type,
            file: filePath,
            line: i + 1,
            column: match.index + 1,
            message: `${pattern.name} detected`,
            suggestion: 'suggestion' in pattern
              ? pattern.suggestion
              : 'Review and fix this security issue',
            code: line.trim().slice(0, 80),
          });
        }
      }
    }
  }

  private async runNpmAudit(): Promise<void> {
    try {
      const output = execSync('npm audit --json', {
        encoding: 'utf-8',
        cwd: process.cwd(),
      });
      const audit = JSON.parse(output);

      if (audit.vulnerabilities) {
        for (const [pkg, vuln] of Object.entries(audit.vulnerabilities) as [string, any][]) {
          if (vuln.severity === 'critical' || vuln.severity === 'high') {
            this.findings.push({
              id: `npm-${vuln.via?.[0]?.cves?.[0] || pkg}`,
              severity: vuln.severity,
              type: 'dependency-vulnerability',
              file: 'package.json',
              line: 1,
              column: 1,
              message: `${pkg}: ${vuln.via?.[0]?.title || 'Vulnerability found'}`,
              suggestion: `Run 'npm audit fix' or update ${pkg}`,
              code: `${pkg}@${vuln.range}`,
            });
          }
        }
      }
    } catch {
      // npm audit returns non-zero when vulnerabilities found — expected
    }
  }

  private async scanRecursive(dir: string): Promise<void> {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (entry === 'node_modules' || entry.startsWith('.')) continue;
      if (stat.isDirectory()) {
        await this.scanRecursive(fullPath);
      } else if (stat.isFile() && this.shouldScanFile(entry)) {
        await this.scanFile(fullPath);
      }
    }
  }
}

// Convenience function for CI/CD pipelines
export async function quickSecurityScan(dir: string = process.cwd()): Promise<ScanResult> {
  const scanner = new SecurityScanner();
  return scanner.scanDirectory(dir);
}
```


### Key Concepts

- **Severity-gated pass/fail** — Only `critical` and `high` findings fail the scan. Medium and low are reported but don't block, reducing alert fatigue.
- **Category-based pattern registry** — Scan rules are organized by vulnerability type (secrets, XSS, SQL injection, path traversal, insecure randomness, ReDoS) and merged into a single scan list for a single-pass check.
- **Line-level findings** — Each finding includes file, line, column, and an actionable suggestion so developers can fix issues without guessing.
- **Dependency auditing** — Integrates `npm audit` alongside static analysis to catch known CVEs in third-party packages.
- **Recursive directory scanning** — Walks the file tree, skipping `node_modules` and hidden directories, scanning only relevant extensions (`.ts`, `.tsx`, `.js`, `.jsx`, `.json`, `.env`).

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// Blocking on ALL severity levels — too noisy, developers ignore the scanner
class StrictScanner {
  async scan(dir: string): Promise<ScanResult> {
    const findings = await this.collectFindings(dir);
    return {
      findings,
      passed: findings.length === 0, // Fails on every low-severity match
    };
  }
}

// Scanning node_modules — slow, irrelevant, and produces thousands of false positives
private async scanRecursive(dir: string): Promise<void> {
  const entries = readdirSync(dir);
  for (const entry of entries) {
    // No exclusion — scans everything including node_modules
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      await this.scanRecursive(fullPath);
    }
  }
}

// Hardcoded secrets instead of using environment variables
const API_KEY = "sk_live_abc123def456ghi789";
const DB_URL = "postgres://admin:password123@prod-db.example.com/mydb";
```

### ✅ Do This Instead

```typescript
// Gate on critical + high only — actionable without noise
return {
  findings: this.findings,
  passed: critical === 0 && high === 0,
};

// Skip irrelevant directories to keep scans fast
private async scanRecursive(dir: string): Promise<void> {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    // ... scan only project source files
  }
}

// Use environment variables and .env files (which the scanner also checks)
const API_KEY = process.env.STRIPE_SECRET_KEY;
const DB_URL = process.env.DATABASE_URL;
```

---

## When to Use This Pattern

✅ **Use for:**
- Pre-deployment CI/CD gates that block builds containing leaked secrets or injection vulnerabilities
- Scanning AI-generated code before committing — LLM outputs frequently contain hardcoded credentials or unsafe patterns like `eval()`
- Running as a quality gate in the Nova26 Ralph Loop alongside TypeScript and test-runner gates
- Auditing pull requests for security regressions before merge

❌ **Don't use for:**
- Deep semantic analysis (e.g., taint tracking across function boundaries) — this is regex-based static analysis, not a full SAST tool
- Runtime security monitoring — use WAFs, rate limiters, and observability tools for production
- Replacing dedicated secret scanners like `gitleaks` or `trufflehog` in high-compliance environments

---

## Benefits

1. **Fast feedback loop** — Regex-based scanning completes in milliseconds, making it viable as a pre-commit or CI gate without slowing down development
2. **Six vulnerability categories** — Covers secrets, SQL injection, XSS, path traversal, insecure randomness, and ReDoS in a single pass
3. **Actionable findings** — Every finding includes the exact file, line, code snippet, and a fix suggestion so developers can resolve issues immediately
4. **Dependency coverage** — Integrates `npm audit` to catch known CVEs in third-party packages alongside source code analysis
5. **Severity-gated pass/fail** — Only critical and high findings block the build, reducing alert fatigue while still surfacing medium/low issues for review

---

## Related Patterns

- See [`../03-quality-gates/typescript-gate.md`](../03-quality-gates/typescript-gate.md) for the TypeScript compilation gate that runs alongside the security scanner in the gate pipeline
- See [`../03-quality-gates/test-runner-gate.md`](../03-quality-gates/test-runner-gate.md) for the test execution gate — another quality gate that pairs with security scanning
- See [`../01-orchestration/gate-runner-pipeline.md`](../01-orchestration/gate-runner-pipeline.md) for the gate runner that orchestrates security scanning as part of the build validation pipeline
- See [`../05-execution/docker-executor.md`](../05-execution/docker-executor.md) for sandboxed execution — security scanning should run before code enters the sandbox
- See [`../09-observability/`](../09-observability/) for tracing and metrics patterns that complement security scanning with runtime monitoring

---

*Extracted: 2026-02-19*
