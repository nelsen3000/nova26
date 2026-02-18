// Security Scanner - Detect vulnerabilities in code
// High impact security checks for NOVA26 builds

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

// Secret patterns to detect
const SECRET_PATTERNS = [
  {
    name: 'AWS Access Key',
    pattern: /AKIA[0-9A-Z]{16}/,
    severity: 'critical' as const,
  },
  {
    name: 'AWS Secret Key',
    pattern: /['"`]([0-9a-zA-Z/+]{40})['"`].*(?:aws|secret|key)/i,
    severity: 'critical' as const,
  },
  {
    name: 'Private Key',
    pattern: /-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/,
    severity: 'critical' as const,
  },
  {
    name: 'GitHub Token',
    pattern: /gh[pousr]_[A-Za-z0-9_]{36,}/,
    severity: 'critical' as const,
  },
  {
    name: 'Slack Token',
    pattern: /xox[baprs]-[0-9a-zA-Z-]+/,
    severity: 'critical' as const,
  },
  {
    name: 'Stripe Key',
    pattern: /sk_live_[0-9a-zA-Z]{24,}/,
    severity: 'critical' as const,
  },
  {
    name: 'OpenAI API Key',
    pattern: /sk-[a-zA-Z0-9]{48}/,
    severity: 'critical' as const,
  },
  {
    name: 'Password in Code',
    pattern: /password\s*[=:]\s*['"`][^'"`]{4,}['"`]/i,
    severity: 'high' as const,
  },
  {
    name: 'API Key',
    pattern: /api[_-]?key\s*[=:]\s*['"`][a-zA-Z0-9]{16,}['"`]/i,
    severity: 'high' as const,
  },
  {
    name: 'Database URL',
    pattern: /(mongodb|postgres|mysql):\/\/[^:]+:[^@]+@/i,
    severity: 'high' as const,
  },
];

// SQL injection patterns
const SQL_INJECTION_PATTERNS = [
  {
    name: 'String Concatenation in Query',
    pattern: /(?:query|execute|exec)\s*\(\s*[`"'][^`"']*\$\{/,
    severity: 'critical' as const,
    suggestion: 'Use parameterized queries instead of string interpolation',
  },
  {
    name: 'Direct SQL Concatenation',
    pattern: /(?:SELECT|INSERT|UPDATE|DELETE).*\+\s*(?:req\.|request\.|params|body)/i,
    severity: 'critical' as const,
    suggestion: 'Use query parameters (?) instead of concatenation',
  },
  {
    name: 'Unsafe Query Method',
    pattern: /query\s*\(\s*[^,]*\+[^,)]*\)/,
    severity: 'high' as const,
    suggestion: 'Use parameterized queries with placeholders',
  },
];

// XSS patterns
const XSS_PATTERNS = [
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
  {
    name: 'Eval Usage',
    pattern: /\beval\s*\(/,
    severity: 'critical' as const,
    suggestion: 'Never use eval(). Use JSON.parse or Function constructor instead',
  },
  {
    name: 'Document Write',
    pattern: /document\.write\s*\(/,
    severity: 'medium' as const,
    suggestion: 'Avoid document.write. Use DOM manipulation instead',
  },
];

// Path traversal patterns
const PATH_TRAVERSAL_PATTERNS = [
  {
    name: 'Path Traversal Risk',
    pattern: /(?:fs\.|readFile|sendFile|download)\s*\([^)]*(?:req\.|request\.|params|body)/i,
    severity: 'high' as const,
    suggestion: 'Validate and sanitize file paths before use',
  },
  {
    name: 'Directory Traversal',
    pattern: /\.+\/+/,
    severity: 'medium' as const,
    suggestion: 'Sanitize paths to prevent directory traversal attacks',
  },
];

// Insecure randomness
const INSECURE_RANDOM_PATTERNS = [
  {
    name: 'Math.random for Security',
    pattern: /Math\.random\s*\(\)[^;]*(?:token|password|key|secret|id)/i,
    severity: 'high' as const,
    suggestion: 'Use crypto.randomBytes() or Web Crypto API for security tokens',
  },
];

// Regex DoS patterns
const REDOS_PATTERNS = [
  {
    name: 'ReDoS Risk - Nested Quantifiers',
    pattern: /\([^)]*\*[^)]*\+[^)]*\)|\([^)]*\+[^)]*\*[^)]*\)/,
    severity: 'medium' as const,
    suggestion: 'Review regex for potential ReDoS (Catastrophic Backtracking)',
  },
  {
    name: 'ReDoS Risk - Nested Groups with Alternation',
    pattern: /\([^)]*\|[^)]*\)[*+]/,
    severity: 'low' as const,
    suggestion: 'Test regex performance with long input strings',
  },
];

const SCAN_PATTERNS = [
  ...SECRET_PATTERNS.map(p => ({ ...p, type: 'secret' as const })),
  ...SQL_INJECTION_PATTERNS.map(p => ({ ...p, type: 'sql-injection' as const })),
  ...XSS_PATTERNS.map(p => ({ ...p, type: 'xss' as const })),
  ...PATH_TRAVERSAL_PATTERNS.map(p => ({ ...p, type: 'path-traversal' as const })),
  ...INSECURE_RANDOM_PATTERNS.map(p => ({ ...p, type: 'insecure-random' as const })),
  ...REDOS_PATTERNS.map(p => ({ ...p, type: 'redos' as const })),
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

    // Run npm audit
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

  private async scanRecursive(dir: string): Promise<void> {
    const entries = readdirSync(dir);

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);

      // Skip node_modules and hidden directories
      if (entry === 'node_modules' || entry.startsWith('.')) continue;

      if (stat.isDirectory()) {
        await this.scanRecursive(fullPath);
      } else if (stat.isFile() && this.shouldScanFile(entry)) {
        await this.scanFile(fullPath);
      }
    }
  }

  private shouldScanFile(filename: string): boolean {
    const ext = extname(filename);
    const scanExts = ['.ts', '.tsx', '.js', '.jsx', '.json', '.env'];
    return scanExts.includes(ext) || filename === '.env';
  }

  private async scanFile(filePath: string): Promise<void> {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      this.scannedFiles++;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNumber = i + 1;

        for (const pattern of SCAN_PATTERNS) {
          const match = pattern.pattern.exec(line);
          if (match) {
            this.findings.push({
              id: `sec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              severity: pattern.severity,
              type: pattern.type,
              file: filePath,
              line: lineNumber,
              column: match.index + 1,
              message: `${pattern.name} detected`,
              suggestion: 'suggestion' in pattern ? pattern.suggestion : 'Review and fix this security issue',
              code: line.trim().slice(0, 80),
            });
          }
        }
      }
    } catch (error) {
      console.error(`Failed to scan ${filePath}:`, error);
    }
  }

  private async runNpmAudit(): Promise<void> {
    try {
      const output = execSync('npm audit --json', { encoding: 'utf-8', cwd: process.cwd() });
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
              suggestion: `Run 'npm audit fix' or update ${pkg} to ${vuln.fixAvailable?.version || 'latest'}`,
              code: `${pkg}@${vuln.range}`,
            });
          }
        }
      }
    } catch {
      // npm audit returns non-zero when vulnerabilities found
      // This is expected, ignore the error
    }
  }
}

export function formatSecurityReport(result: ScanResult): string {
  const lines = [
    '🔒 Security Scan Report',
    '═══════════════════════════════════════════════════',
    `Files Scanned: ${result.scannedFiles}`,
    `Duration: ${result.duration}ms`,
    `Findings: ${result.findings.length}`,
    `  Critical: ${result.findings.filter(f => f.severity === 'critical').length}`,
    `  High: ${result.findings.filter(f => f.severity === 'high').length}`,
    `  Medium: ${result.findings.filter(f => f.severity === 'medium').length}`,
    `  Low: ${result.findings.filter(f => f.severity === 'low').length}`,
    '',
    result.passed ? '✅ PASSED - No critical or high severity issues' : '❌ FAILED - Security issues found',
    '',
  ];

  if (result.findings.length > 0) {
    lines.push('Findings by Severity:');
    lines.push('');

    const severityOrder: Array<'critical' | 'high' | 'medium' | 'low'> = ['critical', 'high', 'medium', 'low'];
    
    for (const severity of severityOrder) {
      const findings = result.findings.filter(f => f.severity === severity);
      if (findings.length === 0) continue;

      lines.push(`${severity.toUpperCase()} (${findings.length}):`);
      for (const finding of findings) {
        lines.push(`  [${finding.type}] ${finding.file}:${finding.line}`);
        lines.push(`    ${finding.message}`);
        lines.push(`    Code: ${finding.code}`);
        lines.push(`    Fix: ${finding.suggestion}`);
        lines.push('');
      }
    }
  }

  return lines.join('\n');
}

// Quick scan function
export async function quickSecurityScan(dir: string = process.cwd()): Promise<ScanResult> {
  const scanner = new SecurityScanner();
  return scanner.scanDirectory(dir);
}
