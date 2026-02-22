// Input Sanitizer - GLM-04
// Validates and sanitizes all external inputs entering the ralph-loop pipeline:
//   - Task descriptions: strip XSS-style injection
//   - File paths: block path traversal sequences
//   - Config values: reject shell-injection characters

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface SanitizeResult {
  /** True if the input was accepted (possibly after sanitization). */
  ok: boolean;
  /** The sanitized/normalized value. Empty string on rejection. */
  value: string;
  /** Human-readable reason when ok === false. */
  reason?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Task Description Sanitizer
// ═══════════════════════════════════════════════════════════════════════════════

// Characters that could trigger HTML/script injection if rendered in UI
const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
};

const HTML_ENTITY_RE = /[&<>"']/g;

/**
 * Sanitize a task description or user-supplied text.
 * - Trims leading/trailing whitespace
 * - Encodes HTML special chars to prevent XSS if the string is later rendered
 * - Rejects null bytes
 * - Enforces a maximum length (default: 10 000 chars)
 */
export function sanitizeTaskDescription(
  input: string,
  maxLength = 10_000
): SanitizeResult {
  if (typeof input !== 'string') {
    return { ok: false, value: '', reason: 'Input must be a string' };
  }

  const trimmed = input.trim();

  if (trimmed.length === 0) {
    return { ok: false, value: '', reason: 'Task description must not be empty' };
  }

  if (trimmed.includes('\0')) {
    return { ok: false, value: '', reason: 'Input contains null bytes' };
  }

  if (trimmed.length > maxLength) {
    return {
      ok: false,
      value: '',
      reason: `Task description exceeds maximum length of ${maxLength} characters`,
    };
  }

  const sanitized = trimmed.replace(HTML_ENTITY_RE, (ch) => HTML_ENTITIES[ch] ?? ch);

  return { ok: true, value: sanitized };
}

// ═══════════════════════════════════════════════════════════════════════════════
// File Path Sanitizer
// ═══════════════════════════════════════════════════════════════════════════════

// Sequences that indicate path traversal attempts
const PATH_TRAVERSAL_RE = /(\.\.(\/|\\|$))|^(\/|\\)/;
const NULL_BYTE_RE = /\0/;
const SHELL_META_IN_PATH_RE = /[`$;|&><!()\[\]{}"'*?~]/;

/**
 * Validate and normalize a file path.
 * - Rejects absolute paths (must be relative)
 * - Rejects `..` traversal sequences
 * - Rejects null bytes and shell-meta characters
 * - Normalizes directory separators to forward-slash
 */
export function sanitizeFilePath(input: string): SanitizeResult {
  if (typeof input !== 'string') {
    return { ok: false, value: '', reason: 'Path must be a string' };
  }

  const trimmed = input.trim();

  if (trimmed.length === 0) {
    return { ok: false, value: '', reason: 'File path must not be empty' };
  }

  if (NULL_BYTE_RE.test(trimmed)) {
    return { ok: false, value: '', reason: 'File path contains null bytes' };
  }

  if (PATH_TRAVERSAL_RE.test(trimmed)) {
    return {
      ok: false,
      value: '',
      reason: 'File path contains traversal sequences or is absolute',
    };
  }

  if (SHELL_META_IN_PATH_RE.test(trimmed)) {
    return {
      ok: false,
      value: '',
      reason: 'File path contains invalid characters',
    };
  }

  // Normalize backslashes to forward slashes
  const normalized = trimmed.replace(/\\/g, '/');

  return { ok: true, value: normalized };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Config Value Sanitizer
// ═══════════════════════════════════════════════════════════════════════════════

// Shell-injection characters that should never appear in config strings
const SHELL_INJECTION_RE = /[`$;|&><!()\[\]{}"'\\]/;

/**
 * Validate a configuration value (e.g. agent name, model id, feature flag).
 * - Rejects values containing shell-meta characters
 * - Rejects null bytes
 * - Enforces a maximum length (default: 512 chars)
 * - Trims whitespace
 */
export function sanitizeConfigValue(
  input: string,
  maxLength = 512
): SanitizeResult {
  if (typeof input !== 'string') {
    return { ok: false, value: '', reason: 'Config value must be a string' };
  }

  const trimmed = input.trim();

  if (trimmed.length === 0) {
    return { ok: false, value: '', reason: 'Config value must not be empty' };
  }

  if (trimmed.includes('\0')) {
    return { ok: false, value: '', reason: 'Config value contains null bytes' };
  }

  if (trimmed.length > maxLength) {
    return {
      ok: false,
      value: '',
      reason: `Config value exceeds maximum length of ${maxLength} characters`,
    };
  }

  if (SHELL_INJECTION_RE.test(trimmed)) {
    return {
      ok: false,
      value: '',
      reason: 'Config value contains invalid characters',
    };
  }

  return { ok: true, value: trimmed };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Batch sanitizer (for processTask() entry point)
// ═══════════════════════════════════════════════════════════════════════════════

export interface TaskInputs {
  title: string;
  description: string;
  agent: string;
  outputPath?: string;
}

export interface TaskInputsResult {
  ok: boolean;
  errors: string[];
  sanitized?: {
    title: string;
    description: string;
    agent: string;
    outputPath?: string;
  };
}

/**
 * Sanitize all fields of a task at the processTask() entry point.
 * Returns ok:false with a list of errors if any field is invalid.
 */
export function sanitizeTaskInputs(inputs: TaskInputs): TaskInputsResult {
  const errors: string[] = [];

  const titleResult = sanitizeTaskDescription(inputs.title, 512);
  if (!titleResult.ok) errors.push(`title: ${titleResult.reason}`);

  const descResult = sanitizeTaskDescription(inputs.description);
  if (!descResult.ok) errors.push(`description: ${descResult.reason}`);

  const agentResult = sanitizeConfigValue(inputs.agent, 64);
  if (!agentResult.ok) errors.push(`agent: ${agentResult.reason}`);

  let outputPathResult: SanitizeResult | null = null;
  if (inputs.outputPath !== undefined) {
    outputPathResult = sanitizeFilePath(inputs.outputPath);
    if (!outputPathResult.ok) errors.push(`outputPath: ${outputPathResult.reason}`);
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    errors: [],
    sanitized: {
      title: titleResult.value,
      description: descResult.value,
      agent: agentResult.value,
      outputPath: outputPathResult?.value,
    },
  };
}
