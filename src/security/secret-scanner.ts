// Secret Scanner - GLM-05
// Scans task outputs and agent responses for accidentally leaked secrets.
// Detects common API key/token formats: AWS, GitHub, OpenAI, Anthropic, generic.

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export type SecretKind =
  | 'aws_access_key'
  | 'aws_secret_key'
  | 'github_token'
  | 'openai_key'
  | 'anthropic_key'
  | 'generic_api_key'
  | 'jwt_token'
  | 'private_key_pem';

export interface SecretMatch {
  kind: SecretKind;
  /** The matched text, partially redacted for safe logging. */
  redacted: string;
  /** Byte offset of the match start (approximate). */
  offset: number;
}

export interface ScanResult {
  /** True if at least one secret was found. */
  hasSecrets: boolean;
  /** All detected secrets, partially redacted. */
  matches: SecretMatch[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// Detection Patterns
// ═══════════════════════════════════════════════════════════════════════════════

interface PatternDef {
  kind: SecretKind;
  re: RegExp;
}

const PATTERNS: PatternDef[] = [
  // AWS Access Key ID: AKIA + 16 uppercase alphanum
  {
    kind: 'aws_access_key',
    re: /\b(AKIA[0-9A-Z]{16})\b/g,
  },
  // AWS Secret Access Key: 40-char base64-like string after keyword
  {
    kind: 'aws_secret_key',
    re: /(?:aws_secret(?:_access)?_key|AWS_SECRET(?:_ACCESS)?_KEY)\s*[=:]\s*["']?([A-Za-z0-9/+=]{40})["']?/gi,
  },
  // GitHub tokens: ghp_, gho_, ghs_, ghr_, github_pat_ prefixes
  {
    kind: 'github_token',
    re: /\b(ghp_[A-Za-z0-9]{36}|gho_[A-Za-z0-9]{36}|ghs_[A-Za-z0-9]{36}|ghr_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{82})\b/g,
  },
  // OpenAI key: sk-proj- or sk- prefix
  {
    kind: 'openai_key',
    re: /\b(sk-(?:proj-)?[A-Za-z0-9_\-]{20,})\b/g,
  },
  // Anthropic key: sk-ant-
  {
    kind: 'anthropic_key',
    re: /\b(sk-ant-[A-Za-z0-9_\-]{20,})\b/g,
  },
  // JWT: three base64url segments separated by dots
  {
    kind: 'jwt_token',
    re: /\b(ey[A-Za-z0-9_\-]{10,}\.ey[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,})\b/g,
  },
  // PEM private key block
  {
    kind: 'private_key_pem',
    re: /(-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/g,
  },
  // Generic API key patterns: variable assignment to long random strings
  {
    kind: 'generic_api_key',
    re: /(?:api[-_]?key|apikey|secret[-_]?key|access[-_]?token|auth[-_]?token)\s*[=:]\s*["']?([A-Za-z0-9_\-./+=]{20,})["']?/gi,
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// Scanner
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Partially redact a matched secret for safe logging.
 * Shows the first 4 and last 4 chars, replaces the middle with `****`.
 */
function redact(value: string): string {
  if (value.length <= 8) return '****';
  return `${value.slice(0, 4)}****${value.slice(-4)}`;
}

/**
 * Scan a string for leaked secrets.
 * Returns a ScanResult listing all matches (partially redacted).
 */
export function scanForSecrets(text: string): ScanResult {
  if (!text || typeof text !== 'string') {
    return { hasSecrets: false, matches: [] };
  }

  const matches: SecretMatch[] = [];

  for (const { kind, re } of PATTERNS) {
    // Reset lastIndex to avoid stateful regex bugs
    re.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      // Use capture group 1 if present, otherwise the full match
      const captured = match[1] ?? match[0];
      matches.push({
        kind,
        redacted: redact(captured),
        offset: match.index,
      });
    }
  }

  return {
    hasSecrets: matches.length > 0,
    matches,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// onAfterTask hook factory
// ═══════════════════════════════════════════════════════════════════════════════

export interface SecretScanHookResult {
  /** Whether any secrets were found in the scanned output. */
  secretsFound: boolean;
  /** Number of matches. */
  matchCount: number;
  /** Kinds of secrets found. */
  kinds: SecretKind[];
}

/**
 * Scan a task output for secrets. Logs a warning if any are found.
 * Returns a summary suitable for use in an onAfterTask hook.
 */
export function scanTaskOutput(
  taskId: string,
  agentName: string,
  output: string
): SecretScanHookResult {
  const result = scanForSecrets(output);

  if (result.hasSecrets) {
    console.warn(
      `[SecretScanner] WARNING: ${result.matches.length} potential secret(s) detected ` +
        `in task ${taskId} (${agentName}): ${result.matches.map(m => m.kind).join(', ')}`
    );
    for (const match of result.matches) {
      console.warn(`  [${match.kind}] ${match.redacted} (offset ${match.offset})`);
    }
  }

  return {
    secretsFound: result.hasSecrets,
    matchCount: result.matches.length,
    kinds: result.matches.map(m => m.kind),
  };
}
