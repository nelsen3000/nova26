// KIMI-ACE-02: Playbook Management
// Manages agent-specific rules and playbooks for the ACE cycle

import { z } from 'zod';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';

// ============================================================================
// Types
// ============================================================================

export type DeltaType = 'Strategy' | 'Mistake' | 'Preference' | 'Pattern' | 'Decision';

export interface PlaybookRule {
  id: string;
  content: string;
  type: DeltaType;
  confidence: number;
  helpfulCount: number;
  harmfulCount: number;
  createdAt: string;
  updatedAt: string;
  agentName: string;
  isGlobalCandidate: boolean;
  tags?: string[];
  // Legacy compatibility fields
  source?: 'manual' | 'global' | 'learned';
  appliedCount?: number;
  successCount?: number;
}

export interface Playbook {
  id?: string;
  agentName: string;
  version: number;
  rules: PlaybookRule[];
  lastUpdated: string;
  // Legacy compatibility fields
  totalTasksApplied?: number;
  successRate?: number;
  taskTypes?: string[];
  ruleStats?: Record<string, { applied: number; success: number }>;
}

export interface PlaybookDelta {
  id?: string;
  nodeId?: string;
  ruleId?: string;
  taskId?: string;
  action?: 'add' | 'update' | 'remove';
  content: string;
  type: DeltaType;
  confidence: number;
  helpfulDelta: number;
  harmfulDelta: number;
  isGlobalCandidate: boolean;
  reason?: string;
  // Legacy compatibility fields
  agentName?: string;
  tags?: string[];
  createdAt?: string;
}

// Zod schema for validating PlaybookDelta from LLM
export const PlaybookDeltaSchema = z.object({
  id: z.string().optional(),
  nodeId: z.string().optional(),
  ruleId: z.string().optional(),
  taskId: z.string().optional(),
  action: z.enum(['add', 'update', 'remove']).optional(),
  content: z.string(),
  type: z.enum(['Strategy', 'Mistake', 'Preference', 'Pattern', 'Decision']),
  confidence: z.number().min(0).max(1),
  helpfulDelta: z.number().default(0),
  harmfulDelta: z.number().default(0),
  isGlobalCandidate: z.boolean().default(false),
  reason: z.string().optional(),
  agentName: z.string().optional(),
  tags: z.array(z.string()).optional(),
  createdAt: z.string().optional(),
});

export const PlaybookDeltaArraySchema = z.array(PlaybookDeltaSchema);

// ============================================================================
// PlaybookManager Class
// ============================================================================

export class PlaybookManager {
  private playbooks: Map<string, Playbook> = new Map();
  private appliedCounts: Map<string, number> = new Map();
  private persistEnabled = false;
  private persistDir = '.nova/ace/playbooks';

  /**
   * Get or create a playbook for an agent
   */
  getPlaybook(agentName: string): Playbook {
    if (!this.playbooks.has(agentName)) {
      // Try to load from disk first
      const loaded = this.load(agentName);
      if (loaded) {
        this.playbooks.set(agentName, loaded);
        return loaded;
      }

      this.playbooks.set(agentName, {
        id: `playbook-${agentName}-${Date.now()}`,
        agentName,
        version: 0,
        rules: [],
        lastUpdated: new Date().toISOString(),
        totalTasksApplied: 0,
        successRate: 0,
        taskTypes: [],
        ruleStats: {},
      });
    }
    return this.playbooks.get(agentName)!;
  }

  /**
   * Enable/disable persistence
   */
  setPersistEnabled(enabled: boolean): void {
    this.persistEnabled = enabled;
  }

  /**
   * Update a playbook with new deltas
   */
  updatePlaybook(agentName: string, deltas: PlaybookDelta[]): Playbook {
    const playbook = this.getPlaybook(agentName);

    for (const delta of deltas) {
      // Legacy format: if no action specified, treat as 'add' or 'update' based on nodeId
      const action = delta.action || (delta.nodeId ? 'add' : 'add');
      
      switch (action) {
        case 'add':
        case 'update': {
          // Check if rule already exists (legacy: by nodeId, new: by id)
          let existingIndex = playbook.rules.findIndex(
            r => r.id === delta.nodeId || r.id === delta.id || r.id === delta.ruleId
          );
          
          // Determine effective action
          let effectiveAction = action;
          
          // Legacy: If no exact ID match but content is similar, consider it an update
          if (existingIndex < 0 && action === 'add') {
            existingIndex = playbook.rules.findIndex(
              r => r.content.toLowerCase().trim() === delta.content.toLowerCase().trim()
            );
            if (existingIndex >= 0) {
              // Treat as update
              effectiveAction = 'update';
            }
          }
          
          if (existingIndex >= 0 && effectiveAction === 'update') {
            // Update existing rule
            const rule = playbook.rules[existingIndex];
            rule.content = delta.content;
            rule.type = delta.type;
            // Increase confidence based on helpful delta, but cap at 1.0
            const confidenceBoost = (delta.helpfulDelta || 0) * 0.1;
            rule.confidence = Math.min(1.0, Math.max(rule.confidence, delta.confidence) + confidenceBoost);
            rule.helpfulCount += delta.helpfulDelta || 0;
            rule.harmfulCount += delta.harmfulDelta || 0;
            rule.updatedAt = new Date().toISOString();
            rule.isGlobalCandidate = delta.isGlobalCandidate;
            // Merge tags
            if (delta.tags) {
              const existingTags = new Set(rule.tags || []);
              delta.tags.forEach(tag => existingTags.add(tag));
              rule.tags = Array.from(existingTags);
            }
          } else if (effectiveAction === 'add') {
            // Add new rule
            playbook.rules.push({
              id: delta.id || delta.nodeId || crypto.randomUUID(),
              content: delta.content,
              type: delta.type,
              confidence: delta.confidence,
              helpfulCount: Math.max(0, delta.helpfulDelta || 0),
              harmfulCount: Math.max(0, delta.harmfulDelta || 0),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              agentName,
              isGlobalCandidate: delta.isGlobalCandidate,
              tags: delta.tags || [],
              source: 'learned',
              appliedCount: 0,
              successCount: 0,
            });
          }
          break;
        }

        case 'remove':
          if (delta.ruleId || delta.nodeId) {
            playbook.rules = playbook.rules.filter(
              r => r.id !== delta.ruleId && r.id !== delta.nodeId
            );
          }
          break;
      }

      // Track task types (legacy)
      if (delta.type && !playbook.taskTypes?.includes(delta.type)) {
        playbook.taskTypes?.push(delta.type);
      }
    }

    playbook.version++;
    playbook.lastUpdated = new Date().toISOString();

    // Persist if enabled
    if (this.persistEnabled) {
      this.persist(agentName);
    }

    return playbook;
  }

  /**
   * Get active rules for a task, sorted by relevance and confidence
   */
  getActiveRules(
    agentName: string,
    taskDescription: string,
    limit: number = 10
  ): PlaybookRule[] {
    const playbook = this.getPlaybook(agentName);
    
    // Score rules by keyword overlap with task description
    const taskTokens = this.tokenize(taskDescription);
    const taskTokenSet = new Set(taskTokens);

    const scored = playbook.rules.map(rule => {
      const ruleText = `${rule.content} ${rule.type} ${(rule.tags || []).join(' ')}`.toLowerCase();
      const ruleTokens = this.tokenize(ruleText);
      
      let overlap = 0;
      for (const token of ruleTokens) {
        if (taskTokenSet.has(token)) overlap++;
      }

      // Score: keyword overlap + confidence + helpful count
      const score = 
        overlap * 10 + 
        rule.confidence * 20 + 
        Math.log(rule.helpfulCount + 1) * 5 -
        Math.log(rule.harmfulCount + 1) * 3 +
        (rule.successCount || 0) * 2;

      return { rule, score };
    });

    // Sort by score descending and return top N
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map(s => s.rule);
  }

  /**
   * Get global candidate rules
   */
  getGlobalCandidates(agentName: string): PlaybookRule[] {
    const playbook = this.getPlaybook(agentName);
    return playbook.rules.filter(rule => {
      // Must have high confidence
      if (rule.confidence < 0.75) return false;
      // Must be marked as global candidate
      if (!rule.isGlobalCandidate) return false;
      // Must have been applied at least 5 times (or have ruleStats with 5+ applied)
      const applied = rule.appliedCount || 0;
      const statsApplied = playbook.ruleStats?.[rule.id]?.applied || 0;
      const totalApplied = Math.max(applied, statsApplied);
      if (totalApplied < 5) return false;
      // Must have reasonable success rate (at least 60%)
      const success = rule.successCount || 0;
      const statsSuccess = playbook.ruleStats?.[rule.id]?.success || 0;
      const totalSuccess = Math.max(success, statsSuccess);
      if (totalApplied === 0) return false;
      if (totalSuccess / totalApplied < 0.6) return false;
      // Must not already be global
      if (rule.source === 'global') return false;
      return true;
    });
  }

  /**
   * Increment the applied count for a rule
   */
  incrementApplied(ruleId: string): void;
  incrementApplied(agentName: string, ruleIds: string[]): void;
  incrementApplied(arg1: string, arg2?: string[]): void {
    if (arg2) {
      // Legacy signature: incrementApplied(agentName, ruleIds)
      const playbook = this.getPlaybook(arg1);
      if (!playbook.ruleStats) playbook.ruleStats = {};
      
      for (const ruleId of arg2) {
        const current = this.appliedCounts.get(ruleId) || 0;
        this.appliedCounts.set(ruleId, current + 1);
        
        // Also update rule's appliedCount and ruleStats
        const rule = playbook.rules.find(r => r.id === ruleId);
        if (rule) {
          rule.appliedCount = (rule.appliedCount || 0) + 1;
        }
        
        // Update ruleStats for successRate calculation
        if (!playbook.ruleStats[ruleId]) {
          playbook.ruleStats[ruleId] = { applied: 0, success: 0 };
        }
        playbook.ruleStats[ruleId].applied++;
      }
    } else {
      // New signature: incrementApplied(ruleId)
      const current = this.appliedCounts.get(arg1) || 0;
      this.appliedCounts.set(arg1, current + 1);
    }
  }

  /**
   * Record success for rules
   */
  recordSuccess(agentName: string, ruleIds: string[]): void {
    const playbook = this.getPlaybook(agentName);
    for (const ruleId of ruleIds) {
      const rule = playbook.rules.find(r => r.id === ruleId);
      if (rule) {
        rule.successCount = (rule.successCount || 0) + 1;
      }
      // Update rule stats
      if (!playbook.ruleStats) playbook.ruleStats = {};
      if (!playbook.ruleStats[ruleId]) {
        playbook.ruleStats[ruleId] = { applied: 0, success: 0 };
      }
      playbook.ruleStats[ruleId].success++;
    }
    
    // Update total tasks and success rate
    const totalSuccess = Object.values(playbook.ruleStats || {})
      .reduce((sum, stats) => sum + stats.success, 0);
    const totalApplied = Object.values(playbook.ruleStats || {})
      .reduce((sum, stats) => sum + stats.applied, 0);
    playbook.successRate = totalApplied > 0 ? totalSuccess / totalApplied : 0;
  }

  /**
   * Record task applied (legacy)
   */
  recordTaskApplied(agentName: string): void {
    const playbook = this.getPlaybook(agentName);
    playbook.totalTasksApplied = (playbook.totalTasksApplied || 0) + 1;
  }

  /**
   * Get all rule IDs that have been applied
   */
  getAppliedRuleIds(): string[] {
    return Array.from(this.appliedCounts.keys());
  }

  /**
   * Get all playbooks
   */
  getAllPlaybooks(): Playbook[] {
    return Array.from(this.playbooks.values());
  }

  /**
   * Persist playbook to disk
   */
  persist(agentName: string): void {
    const playbook = this.getPlaybook(agentName);
    const path = `${this.persistDir}/${agentName}.json`;
    
    try {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, JSON.stringify(playbook, null, 2), 'utf-8');
    } catch (error) {
      console.warn(`Failed to persist playbook for ${agentName}:`, error);
    }
  }

  /**
   * Load playbook from disk
   */
  load(agentName: string): Playbook | null {
    const path = `${this.persistDir}/${agentName}.json`;
    
    try {
      if (!existsSync(path)) return null;
      
      const data = readFileSync(path, 'utf-8');
      const parsed = JSON.parse(data);
      
      // Validate required fields
      if (!parsed.agentName || !Array.isArray(parsed.rules)) {
        return null;
      }
      
      return parsed as Playbook;
    } catch (error) {
      // Return null for invalid JSON or missing file
      return null;
    }
  }

  /**
   * Clear playbook from cache
   */
  clear(agentName: string): void {
    this.playbooks.delete(agentName);
  }

  /**
   * Reset all playbooks
   */
  reset(): void {
    this.playbooks.clear();
    this.appliedCounts.clear();
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 2);
  }
}

// ============================================================================
// Singleton Factory
// ============================================================================

let playbookManagerInstance: PlaybookManager | null = null;

export function getPlaybookManager(): PlaybookManager {
  if (!playbookManagerInstance) {
    playbookManagerInstance = new PlaybookManager();
  }
  return playbookManagerInstance;
}

export function resetPlaybookManager(): void {
  if (playbookManagerInstance) {
    playbookManagerInstance.reset();
  }
  playbookManagerInstance = null;
}

export function setPlaybookManager(manager: PlaybookManager): void {
  playbookManagerInstance = manager;
}
