// Speculative Decoding — Nemotron-3-Nano draft + Qwen-3.5 verify
// Target: 2.5x throughput improvement
// KIMI-R22-01 | Feb 2026

import type { SpeculativeDecodingConfig, InferenceResult } from './types.js';

export interface SpeculativeStep {
  draftTokens: string[];
  acceptedTokens: string[];
  acceptanceRate: number;
  draftDurationMs: number;
  verifyDurationMs: number;
}

export interface SpeculativeDecodingResult extends InferenceResult {
  steps: SpeculativeStep[];
  overallAcceptanceRate: number;
  speedupFactor: number;
}

export type InferenceFn = (
  model: string,
  prompt: string,
  maxTokens?: number,
) => Promise<{ text: string; tokensOut: number; durationMs: number; confidence: number }>;

export class SpeculativeDecoder {
  private config: SpeculativeDecodingConfig;

  constructor(config: SpeculativeDecodingConfig) {
    this.config = config;
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  async decode(
    agentId: string,
    prompt: string,
    inferenceFn: InferenceFn,
    maxTokens = 512,
  ): Promise<SpeculativeDecodingResult> {
    const startTs = Date.now();
    const steps: SpeculativeStep[] = [];
    let output = '';
    let totalTokensOut = 0;
    let overallAccepted = 0;
    let overallDraft = 0;

    // Iteratively draft + verify until we have enough tokens
    let remaining = maxTokens;
    while (remaining > 0) {
      const draftCount = Math.min(this.config.draftTokens, remaining);

      // 1. Draft: fast model generates draftCount tokens
      const draftStart = Date.now();
      const draftResult = await inferenceFn(
        this.config.draftModel,
        prompt + output,
        draftCount,
      );
      const draftDurationMs = Date.now() - draftStart;
      const draftTokens = tokenize(draftResult.text);

      // 2. Verify: quality model scores each draft token
      const verifyStart = Date.now();
      const verifyResult = await inferenceFn(
        this.config.verifyModel,
        prompt + output,
        draftCount,
      );
      const verifyDurationMs = Date.now() - verifyStart;
      const verifyTokens = tokenize(verifyResult.text);

      // 3. Accept tokens where draft ≈ verify
      const accepted: string[] = [];
      for (let i = 0; i < draftTokens.length; i++) {
        if (draftTokens[i] === verifyTokens[i]) {
          accepted.push(draftTokens[i]!);
        } else {
          // Use the verify token at the first mismatch, then stop
          accepted.push(verifyTokens[i] ?? '');
          break;
        }
      }

      const acceptanceRate = accepted.length / Math.max(draftTokens.length, 1);
      steps.push({ draftTokens, acceptedTokens: accepted, acceptanceRate, draftDurationMs, verifyDurationMs });

      output += accepted.join(' ');
      totalTokensOut += accepted.length;
      overallAccepted += accepted.length;
      overallDraft += draftTokens.length;
      remaining -= accepted.length;

      // Stop if we got a natural end-of-sequence
      if (draftResult.text.includes('<|end|>') || verifyResult.text.includes('<|end|>')) break;
      if (accepted.length < draftTokens.length) break; // Mismatch means we should re-draft
    }

    const totalDurationMs = Date.now() - startTs;
    const overallAcceptanceRate = overallAccepted / Math.max(overallDraft, 1);

    // Speedup estimate: if acceptance rate is high, we saved verification passes
    const baselineMs = overallAcceptanceRate > 0 ? totalDurationMs / overallAcceptanceRate : totalDurationMs;
    const speedupFactor = totalDurationMs > 0 ? Math.min(baselineMs / totalDurationMs, 3.5) : 1;

    const lastVerify = steps[steps.length - 1];

    return {
      agentId,
      modelUsed: `${this.config.draftModel}+${this.config.verifyModel}`,
      output,
      confidence: lastVerify?.acceptanceRate ?? 0.5,
      tokensIn: prompt.split(/\s+/).length,
      tokensOut: totalTokensOut,
      durationMs: totalDurationMs,
      escalated: false,
      steps,
      overallAcceptanceRate,
      speedupFactor,
    };
  }

  getAcceptanceRateTarget(): number {
    return this.config.acceptanceRateTarget;
  }

  getDraftModel(): string {
    return this.config.draftModel;
  }

  getVerifyModel(): string {
    return this.config.verifyModel;
  }
}

function tokenize(text: string): string[] {
  return text.split(/(\s+|[.,;:!?()[\]{}'"`])/u).filter(Boolean);
}
