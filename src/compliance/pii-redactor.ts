// PII Redactor — R21-03
// Automatic PII redaction before log writes

import type { AuditTrailConfig } from './types.js';

export class PIIRedactor {
  private level: AuditTrailConfig['piiRedactionLevel'];

  constructor(level: AuditTrailConfig['piiRedactionLevel'] = 'partial') {
    this.level = level;
  }

  /**
   * Redact PII from text based on configured level
   */
  redact(text: string): string {
    if (this.level === 'none') return text;

    let redacted = text;

    // Full redaction removes all potentially sensitive info
    if (this.level === 'full') {
      redacted = this.redactEmail(redacted);
      redacted = this.redactPhone(redacted);
      redacted = this.redactSSN(redacted);
      redacted = this.redactAPIKey(redacted);
      redacted = this.redactIP(redacted);
      redacted = this.redactCreditCard(redacted);
      redacted = this.redactName(redacted);
    } else {
      // Partial redaction - only high-risk PII
      redacted = this.redactEmail(redacted);
      redacted = this.redactSSN(redacted);
      redacted = this.redactAPIKey(redacted);
      redacted = this.redactCreditCard(redacted);
    }

    return redacted;
  }

  /**
   * Redact email addresses
   */
  redactEmail(text: string): string {
    const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    return text.replace(emailPattern, '[EMAIL_REDACTED]');
  }

  /**
   * Redact phone numbers
   */
  redactPhone(text: string): string {
    const phonePattern = /\b(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/g;
    return text.replace(phonePattern, '[PHONE_REDACTED]');
  }

  /**
   * Redact SSN
   */
  redactSSN(text: string): string {
    const ssnPattern = /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/g;
    return text.replace(ssnPattern, '[SSN_REDACTED]');
  }

  /**
   * Redact API keys and tokens
   */
  redactAPIKey(text: string): string {
    // Common API key patterns
    const apiKeyPatterns = [
      /\b(sk-[a-zA-Z0-9]{32,})\b/g, // OpenAI-style
      /\b(gh[pousr]_[a-zA-Z0-9]{36})\b/g, // GitHub tokens
      /\b([a-zA-Z0-9]{32,})\b/g, // Generic long tokens
    ];

    let redacted = text;
    for (const pattern of apiKeyPatterns) {
      redacted = redacted.replace(pattern, '[API_KEY_REDACTED]');
    }
    return redacted;
  }

  /**
   * Redact IP addresses
   */
  redactIP(text: string): string {
    const ipPattern = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
    return text.replace(ipPattern, '[IP_REDACTED]');
  }

  /**
   * Redact credit card numbers
   */
  redactCreditCard(text: string): string {
    const ccPattern = /\b(?:\d{4}[-.\s]?){3}\d{4}\b/g;
    return text.replace(ccPattern, '[CC_REDACTED]');
  }

  /**
   * Redact names (basic pattern)
   */
  redactName(text: string): string {
    // Simple pattern for capitalized words that could be names
    // In production, would use NER (Named Entity Recognition)
    const namePattern = /\b[A-Z][a-z]+\s[A-Z][a-z]+\b/g;
    return text.replace(namePattern, '[NAME_REDACTED]');
  }

  /**
   * Redact object recursively
   */
  redactObject<T extends Record<string, unknown>>(obj: T): T {
    const redacted: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        redacted[key] = this.redact(value);
      } else if (typeof value === 'object' && value !== null) {
        redacted[key] = this.redactObject(value as Record<string, unknown>);
      } else {
        redacted[key] = value;
      }
    }

    return redacted as T;
  }
}

export function createPIIRedactor(level?: AuditTrailConfig['piiRedactionLevel']): PIIRedactor {
  return new PIIRedactor(level);
}
