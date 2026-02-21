// Hypervisor Network Policy — Egress/ingress rule enforcement per VM
// Sprint S2-14 | Hypervisor Integration (Reel 2)

import { z } from 'zod';

// ─── Policy Rules ─────────────────────────────────────────────────────────────

export const NetworkProtocolSchema = z.enum(['tcp', 'udp', 'icmp', 'any']);
export type NetworkProtocol = z.infer<typeof NetworkProtocolSchema>;

export const NetworkDirectionSchema = z.enum(['egress', 'ingress', 'both']);
export type NetworkDirection = z.infer<typeof NetworkDirectionSchema>;

export const NetworkRuleSchema = z.object({
  ruleId: z.string(),
  vmId: z.string(),
  direction: NetworkDirectionSchema.default('egress'),
  action: z.enum(['allow', 'deny']),
  protocol: NetworkProtocolSchema.default('any'),
  remoteHost: z.string().optional(),   // CIDR or hostname; undefined = wildcard
  portRange: z.tuple([z.number().int().min(0).max(65535), z.number().int().min(0).max(65535)]).optional(),
  priority: z.number().int().default(100),  // lower = higher priority
  description: z.string().optional(),
  createdAt: z.number(),
});
export type NetworkRule = z.infer<typeof NetworkRuleSchema>;

export const NetworkRequestSchema = z.object({
  vmId: z.string(),
  direction: NetworkDirectionSchema,
  protocol: NetworkProtocolSchema,
  remoteHost: z.string(),
  port: z.number().int().min(0).max(65535),
});
export type NetworkRequest = z.infer<typeof NetworkRequestSchema>;

export const NetworkPolicyResultSchema = z.object({
  allowed: z.boolean(),
  matchedRuleId: z.string().optional(),
  reason: z.string(),
  evaluatedAt: z.number(),
});
export type NetworkPolicyResult = z.infer<typeof NetworkPolicyResultSchema>;

// ─── NetworkPolicyManager ─────────────────────────────────────────────────────

/**
 * NetworkPolicyManager — rule-based allow/deny for VM network requests.
 *
 * Rule evaluation: rules sorted by priority (ascending = higher priority).
 * First match wins. If no rule matches, default action applies (deny by default).
 */
export class NetworkPolicyManager {
  private rules = new Map<string, NetworkRule[]>(); // vmId → rules
  private globalRules: NetworkRule[] = [];
  private defaultAction: 'allow' | 'deny';
  private evaluationLog: Array<{ request: NetworkRequest; result: NetworkPolicyResult }> = [];
  private maxLogEntries: number;

  constructor(options: { defaultAction?: 'allow' | 'deny'; maxLogEntries?: number } = {}) {
    this.defaultAction = options.defaultAction ?? 'deny';
    this.maxLogEntries = options.maxLogEntries ?? 500;
  }

  /**
   * Add a network rule for a specific VM (or global if vmId = '*').
   */
  addRule(rule: Omit<NetworkRule, 'createdAt'>): NetworkRule {
    const fullRule = NetworkRuleSchema.parse({ ...rule, createdAt: Date.now() });
    if (fullRule.vmId === '*') {
      this.globalRules.push(fullRule);
      this.globalRules.sort((a, b) => a.priority - b.priority);
    } else {
      if (!this.rules.has(fullRule.vmId)) this.rules.set(fullRule.vmId, []);
      const vmRules = this.rules.get(fullRule.vmId)!;
      vmRules.push(fullRule);
      vmRules.sort((a, b) => a.priority - b.priority);
    }
    return fullRule;
  }

  /**
   * Remove a rule by its ruleId (searches all VMs and global rules).
   */
  removeRule(ruleId: string): boolean {
    // Check global
    const gIdx = this.globalRules.findIndex(r => r.ruleId === ruleId);
    if (gIdx !== -1) {
      this.globalRules.splice(gIdx, 1);
      return true;
    }
    // Check per-VM
    for (const [vmId, vmRules] of this.rules) {
      const idx = vmRules.findIndex(r => r.ruleId === ruleId);
      if (idx !== -1) {
        vmRules.splice(idx, 1);
        if (vmRules.length === 0) this.rules.delete(vmId);
        return true;
      }
    }
    return false;
  }

  /**
   * Get all rules for a VM (including global rules), sorted by priority.
   */
  getRules(vmId: string): NetworkRule[] {
    const vmRules = this.rules.get(vmId) ?? [];
    return [...vmRules, ...this.globalRules].sort((a, b) => a.priority - b.priority);
  }

  /**
   * List all rules across all VMs.
   */
  listAllRules(): NetworkRule[] {
    const all: NetworkRule[] = [...this.globalRules];
    for (const rules of this.rules.values()) all.push(...rules);
    return all.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Evaluate a network request against all applicable rules.
   */
  evaluate(request: NetworkRequest): NetworkPolicyResult {
    const parsed = NetworkRequestSchema.parse(request);
    const rules = this.getRules(parsed.vmId);

    for (const rule of rules) {
      if (this.ruleMatches(rule, parsed)) {
        const result = NetworkPolicyResultSchema.parse({
          allowed: rule.action === 'allow',
          matchedRuleId: rule.ruleId,
          reason: `Matched rule "${rule.ruleId}" (${rule.action})`,
          evaluatedAt: Date.now(),
        });
        this.logEvaluation(parsed, result);
        return result;
      }
    }

    // Default action
    const defaultResult = NetworkPolicyResultSchema.parse({
      allowed: this.defaultAction === 'allow',
      reason: `No matching rule — default action: ${this.defaultAction}`,
      evaluatedAt: Date.now(),
    });
    this.logEvaluation(parsed, defaultResult);
    return defaultResult;
  }

  /**
   * Apply a blanket "block all" policy for a VM (adds deny-all rule at low priority).
   */
  blockAll(vmId: string): NetworkRule {
    return this.addRule({
      ruleId: `block-all-${vmId}-${Date.now()}`,
      vmId,
      direction: 'both',
      action: 'deny',
      protocol: 'any',
      priority: 9999,
      description: 'Blanket deny-all',
    });
  }

  /**
   * Apply a blanket "allow all" policy for a VM.
   */
  allowAll(vmId: string): NetworkRule {
    return this.addRule({
      ruleId: `allow-all-${vmId}-${Date.now()}`,
      vmId,
      direction: 'both',
      action: 'allow',
      protocol: 'any',
      priority: 9999,
      description: 'Blanket allow-all',
    });
  }

  /**
   * Remove all rules for a VM.
   */
  clearRules(vmId: string): void {
    this.rules.delete(vmId);
  }

  /**
   * Get evaluation log (most recent first).
   */
  getEvaluationLog(limit = 50): Array<{ request: NetworkRequest; result: NetworkPolicyResult }> {
    return [...this.evaluationLog].reverse().slice(0, limit);
  }

  /**
   * Get stats.
   */
  getStats(): { totalRules: number; globalRules: number; perVmRules: number; totalEvaluations: number } {
    let perVm = 0;
    for (const rules of this.rules.values()) perVm += rules.length;
    return {
      totalRules: this.globalRules.length + perVm,
      globalRules: this.globalRules.length,
      perVmRules: perVm,
      totalEvaluations: this.evaluationLog.length,
    };
  }

  /**
   * Reset all rules and log (for testing).
   */
  reset(): void {
    this.rules.clear();
    this.globalRules = [];
    this.evaluationLog = [];
  }

  private ruleMatches(rule: NetworkRule, request: NetworkRequest): boolean {
    // Direction
    if (rule.direction !== 'both' && rule.direction !== request.direction) return false;

    // Protocol
    if (rule.protocol !== 'any' && rule.protocol !== request.protocol) return false;

    // Remote host (simple prefix/wildcard match)
    if (rule.remoteHost !== undefined) {
      if (!this.hostMatches(request.remoteHost, rule.remoteHost)) return false;
    }

    // Port range
    if (rule.portRange !== undefined) {
      const [lo, hi] = rule.portRange;
      if (request.port < lo || request.port > hi) return false;
    }

    return true;
  }

  private hostMatches(actual: string, pattern: string): boolean {
    if (pattern === '*') return true;
    if (pattern === actual) return true;
    // Simple wildcard prefix: *.example.com
    if (pattern.startsWith('*.')) {
      const suffix = pattern.slice(1); // .example.com
      return actual.endsWith(suffix);
    }
    // CIDR: treat as prefix match for test simplicity
    if (pattern.includes('/')) {
      return actual.startsWith(pattern.split('/')[0].split('.').slice(0, 3).join('.'));
    }
    return false;
  }

  private logEvaluation(request: NetworkRequest, result: NetworkPolicyResult): void {
    this.evaluationLog.push({ request, result });
    if (this.evaluationLog.length > this.maxLogEntries) this.evaluationLog.shift();
  }
}
