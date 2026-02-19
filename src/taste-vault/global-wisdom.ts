// Global Wisdom Pipeline - Aggregates anonymized patterns from opt-in users
// KIMI-VAULT-03: Aggregates high-confidence nodes into shareable global patterns

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { getSemanticDedup } from '../similarity/semantic-dedup.js';

// GlobalPattern schema - represents an aggregated, anonymized pattern
export interface GlobalPattern {
  id: string;
  canonicalContent: string;
  originalNodeIds: string[];
  successScore: number;
  userDiversity: number;
  lastPromotedAt: string;
  language?: string;
  tags: string[];
  promotionCount: number;
  harmReports: number;
  isActive: boolean;
}

// GraphNode interface - expected input from user vaults
export interface GraphNode {
  id: string;
  content: string;
  helpfulCount: number;
  createdAt: string;
  tags?: string[];
  language?: string;
}

// User vault interface
export interface UserVault {
  userId: string;
  optIn: boolean;
  nodes: GraphNode[];
}

// Weekly promotion log entry
export interface WeeklyPromotionLog {
  userId: string;
  promotionCount: number;
  weekStart: string;
}

// Persistence store structure
interface GlobalWisdomStore {
  version: string;
  patterns: GlobalPattern[];
  weeklyLogs: WeeklyPromotionLog[];
  lastUpdated: string;
}

const DATA_DIR = join(process.cwd(), '.nova', 'taste-vault');
const STORAGE_FILE = join(DATA_DIR, 'global-wisdom.json');

// In-memory pub/sub subscribers
type PatternSubscriber = (pattern: GlobalPattern) => void;

/**
 * GlobalWisdomPipeline - aggregates anonymized patterns from opt-in users
 */
export class GlobalWisdomPipeline {
  private patterns: Map<string, GlobalPattern> = new Map();
  private weeklyLogs: Map<string, WeeklyPromotionLog> = new Map();
  private subscribers: Set<PatternSubscriber> = new Set();
  private version = '1.0.0';

  constructor() {
    this.ensureDirectory();
  }

  private ensureDirectory(): void {
    if (!existsSync(DATA_DIR)) {
      mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  /**
   * Collect high-confidence nodes from opt-in user vaults
   * @param vaults - Array of user vaults
   * @param threshold - Minimum helpfulCount threshold (default 0.85)
   */
  collectHighConfidenceNodes(vaults: UserVault[], threshold = 0.85): GraphNode[] {
    const nodes: GraphNode[] = [];

    for (const vault of vaults) {
      if (!vault.optIn) continue;

      for (const node of vault.nodes) {
        // Normalize helpfulCount to 0-1 scale if needed
        const score = node.helpfulCount;
        if (score >= threshold) {
          nodes.push(node);
        }
      }
    }

    return nodes;
  }

  /**
   * Strip sensitive data from a node
   * Removes: file paths, secrets, user-specific variables, emails
   * Returns a NEW node, does not mutate original
   */
  stripSensitiveData(node: GraphNode): GraphNode {
    let content = node.content;

    // Remove email addresses (general pattern)
    content = content.replace(
      /\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b/g,
      '[EMAIL_REDACTED]'
    );

    // Remove absolute file paths (Unix-style)
    content = content.replace(/\/([a-zA-Z0-9_\-]+\/)+[a-zA-Z0-9_\-\.]+/g, '[PATH_REDACTED]');
    
    // Remove relative file paths (./path and ../path)
    content = content.replace(/\.\.?\/([a-zA-Z0-9_\-\.]+\/)*[a-zA-Z0-9_\-\.]+/g, '[PATH_REDACTED]');
    
    // Remove Windows file paths
    content = content.replace(/[A-Za-z]:\\[a-zA-Z0-9_\\\.\-\s]+/g, '[PATH_REDACTED]');

    // Remove secrets (key, secret, token, password patterns)
    content = content.replace(
      /(key|secret|token|password|api[_-]?key|auth[_-]?token)\s*[:=]\s*["']?[a-zA-Z0-9_\-\.]+["']?/gi,
      '$1: [REDACTED]'
    );

    // Remove user-specific variables (username, userId patterns)
    content = content.replace(
      /(username|user[_-]?id|user[_-]?name)\s*[:=]\s*["']?[^"'\s,;]+["']?/gi,
      '$1: [REDACTED]'
    );

    // Remove potential API keys and tokens (long alphanumeric strings)
    content = content.replace(/\b[a-zA-Z0-9]{32,}\b/g, '[TOKEN_REDACTED]');

    return {
      ...node,
      content,
    };
  }

  /**
   * Calculate Jaccard similarity between two strings
   * Uses word token sets
   */
  isSimilar(a: string, b: string, threshold = 0.7): boolean {
    const tokensA = new Set(this.tokenize(a.toLowerCase()));
    const tokensB = new Set(this.tokenize(b.toLowerCase()));

    if (tokensA.size === 0 && tokensB.size === 0) return true;
    if (tokensA.size === 0 || tokensB.size === 0) return false;

    const intersection = new Set([...tokensA].filter(x => tokensB.has(x)));
    const union = new Set([...tokensA, ...tokensB]);

    const similarity = intersection.size / union.size;
    return similarity >= threshold;
  }

  private tokenize(text: string): string[] {
    // Extract words, preserving some code relevance
    // Keep single characters as they can be important (e.g., "A" vs "B")
    return text
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 0);
  }

  /**
   * Find duplicates among candidates against existing patterns
   * Returns { duplicates: similar pairs, unique: non-duplicate candidates }
   */
  findDuplicates(
    candidates: GraphNode[],
    existing: GlobalPattern[],
    threshold = 0.7
  ): { duplicates: Array<{ candidate: GraphNode; existing: GlobalPattern }>; unique: GraphNode[] } {
    const duplicates: Array<{ candidate: GraphNode; existing: GlobalPattern }> = [];
    const unique: GraphNode[] = [];

    for (const candidate of candidates) {
      let isDuplicate = false;
      for (const pattern of existing) {
        if (this.isSimilar(candidate.content, pattern.canonicalContent, threshold)) {
          duplicates.push({ candidate, existing: pattern });
          isDuplicate = true;
          break;
        }
      }
      if (!isDuplicate) {
        unique.push(candidate);
      }
    }

    return { duplicates, unique };
  }

  /**
   * Score a node for promotion
   * Formula: (helpfulCount * 0.6) + (userDiversity * 0.3) + (recencyBoost * 0.1)
   * recencyBoost: 1.0 if < 30 days, decays to 0 at 180 days
   */
  scoreNode(node: GraphNode, userDiversity: number, recencyBoostDays = 30): number {
    const helpfulScore = Math.min(node.helpfulCount, 1) * 0.6;
    const diversityScore = Math.min(userDiversity / 10, 1) * 0.3;

    // Calculate recency boost
    const nodeDate = new Date(node.createdAt);
    const now = new Date();
    const daysDiff = (now.getTime() - nodeDate.getTime()) / (1000 * 60 * 60 * 24);

    let recencyBoost = 0;
    if (daysDiff < recencyBoostDays) {
      recencyBoost = 1.0 * 0.1;
    } else if (daysDiff < 180) {
      // Linear decay from 30 to 180 days
      recencyBoost = ((180 - daysDiff) / 150) * 0.1;
    }

    return helpfulScore + diversityScore + recencyBoost;
  }

  /**
   * Check if user has exceeded weekly promotion limit (anti-gaming)
   * Returns false if user has >= 5 promotions this week
   */
  checkAntiGaming(userId: string, weeklyPromotionLog: WeeklyPromotionLog[]): boolean {
    const weekStart = this.getWeekStart(new Date());

    const userLog = weeklyPromotionLog.find(
      log => log.userId === userId && log.weekStart === weekStart
    );

    if (!userLog) return true;
    return userLog.promotionCount < 5;
  }

  private getWeekStart(date: Date): string {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d.toISOString().split('T')[0];
  }

  /**
   * Report harm on a pattern
   * Increments harmReports, deactivates if >= 3
   */
  reportHarm(patternId: string): void {
    const pattern = this.patterns.get(patternId);
    if (!pattern) return;

    pattern.harmReports++;
    if (pattern.harmReports >= 3) {
      pattern.isActive = false;
    }

    this.patterns.set(patternId, pattern);
  }

  /**
   * Promote a node to global pattern
   * Full pipeline: strip → semantic dedup → Jaccard dedup → antiGaming → score → create
   * Returns null if any check fails
   * Requires userDiversity >= 3 before publicly visible
   */
  async promote(
    node: GraphNode,
    userId: string,
    weeklyLog: WeeklyPromotionLog[],
    existingPatterns?: GlobalPattern[]
  ): Promise<GlobalPattern | null> {
    // Anti-gaming check
    if (!this.checkAntiGaming(userId, weeklyLog)) {
      return null;
    }

    // Strip sensitive data
    const strippedNode = this.stripSensitiveData(node);

    // Semantic deduplication check (try first)
    const patterns = existingPatterns || Array.from(this.patterns.values());
    const patternNodes = patterns.map(p => ({
      id: p.id,
      content: p.canonicalContent,
    }));

    try {
      const semanticResult = await getSemanticDedup().isDuplicate(
        { id: node.id, content: strippedNode.content },
        patternNodes
      );
      if (semanticResult.isDuplicate) {
        return null;
      }
    } catch {
      // Fall through to Jaccard if semantic check fails
    }

    // Jaccard deduplication fallback check
    const { duplicates } = this.findDuplicates([strippedNode], patterns);
    if (duplicates.length > 0) {
      return null;
    }

    // Calculate user diversity (minimum 3 required for public visibility)
    const userDiversity = this.calculateUserDiversity(strippedNode);

    // Score the node
    const score = this.scoreNode(strippedNode, userDiversity);

    // Create global pattern - always active when first created
    const pattern: GlobalPattern = {
      id: `pattern-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      canonicalContent: strippedNode.content,
      originalNodeIds: [strippedNode.id],
      successScore: score,
      userDiversity,
      lastPromotedAt: new Date().toISOString(),
      language: strippedNode.language,
      tags: strippedNode.tags || [],
      promotionCount: 1,
      harmReports: 0,
      isActive: true, // Always active on creation
    };

    // Store pattern
    this.patterns.set(pattern.id, pattern);

    // Update weekly log
    this.updateWeeklyLog(userId);

    // Notify subscribers
    this.pushToSubscribers(pattern);

    return pattern;
  }

  private calculateUserDiversity(_node: GraphNode): number {
    // In a real implementation, this would check how many unique users
    // have similar patterns. For now, return a default value.
    // This would be enhanced with actual user clustering.
    return 1;
  }

  private updateWeeklyLog(userId: string): void {
    const weekStart = this.getWeekStart(new Date());
    const key = `${userId}:${weekStart}`;

    const existing = this.weeklyLogs.get(key);
    if (existing) {
      existing.promotionCount++;
    } else {
      this.weeklyLogs.set(key, {
        userId,
        promotionCount: 1,
        weekStart,
      });
    }
  }

  /**
   * Get patterns for premium users
   * Top `limit` active by successScore, default 12
   */
  getForPremium(limit = 12): GlobalPattern[] {
    return Array.from(this.patterns.values())
      .filter(p => p.isActive)
      .sort((a, b) => b.successScore - a.successScore)
      .slice(0, limit);
  }

  /**
   * Get patterns for free users
   * Top `limit` active, default 4
   */
  getForFree(limit = 4): GlobalPattern[] {
    return this.getForPremium(limit);
  }

  /**
   * Subscribe to pattern promotions (in-memory pub/sub)
   */
  subscribe(callback: PatternSubscriber): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Push pattern to subscribers
   */
  pushToSubscribers(pattern: GlobalPattern): void {
    for (const subscriber of this.subscribers) {
      try {
        subscriber(pattern);
      } catch (error) {
        // Log but don't fail if subscriber throws
        console.error('Subscriber error:', error);
      }
    }
  }

  /**
   * Persist patterns to disk
   */
  async persist(): Promise<void> {
    this.ensureDirectory();

    const store: GlobalWisdomStore = {
      version: this.version,
      patterns: Array.from(this.patterns.values()),
      weeklyLogs: Array.from(this.weeklyLogs.values()),
      lastUpdated: new Date().toISOString(),
    };

    writeFileSync(STORAGE_FILE, JSON.stringify(store, null, 2));
  }

  /**
   * Load patterns from disk
   */
  async load(): Promise<void> {
    if (!existsSync(STORAGE_FILE)) {
      return;
    }

    try {
      const raw = readFileSync(STORAGE_FILE, 'utf-8');
      const store: GlobalWisdomStore = JSON.parse(raw);

      this.patterns.clear();
      this.weeklyLogs.clear();

      for (const pattern of store.patterns) {
        this.patterns.set(pattern.id, pattern);
      }

      for (const log of store.weeklyLogs) {
        const key = `${log.userId}:${log.weekStart}`;
        this.weeklyLogs.set(key, log);
      }

      this.version = store.version;
    } catch (error) {
      console.error('Failed to load global wisdom:', error);
    }
  }

  /**
   * Get pipeline statistics
   */
  stats(): {
    totalPatterns: number;
    activePatterns: number;
    demotedPatterns: number;
    avgSuccessScore: number;
    topPatterns: GlobalPattern[];
  } {
    const allPatterns = Array.from(this.patterns.values());
    const activePatterns = allPatterns.filter(p => p.isActive);
    const demotedPatterns = allPatterns.filter(p => !p.isActive);

    const avgSuccessScore =
      allPatterns.length > 0
        ? allPatterns.reduce((sum, p) => sum + p.successScore, 0) / allPatterns.length
        : 0;

    const topPatterns = [...activePatterns]
      .sort((a, b) => b.successScore - a.successScore)
      .slice(0, 5);

    return {
      totalPatterns: allPatterns.length,
      activePatterns: activePatterns.length,
      demotedPatterns: demotedPatterns.length,
      avgSuccessScore,
      topPatterns,
    };
  }

  /**
   * Reset all patterns (for testing)
   */
  reset(): void {
    this.patterns.clear();
    this.weeklyLogs.clear();
    this.subscribers.clear();
  }

  /**
   * Get a pattern by ID (for testing)
   */
  getPattern(id: string): GlobalPattern | undefined {
    return this.patterns.get(id);
  }

  /**
   * Get weekly log for a user (for testing)
   */
  getWeeklyLog(userId: string): WeeklyPromotionLog | undefined {
    const weekStart = this.getWeekStart(new Date());
    const key = `${userId}:${weekStart}`;
    return this.weeklyLogs.get(key);
  }
}

// Singleton instance
let pipelineInstance: GlobalWisdomPipeline | null = null;

/**
 * Get the singleton GlobalWisdomPipeline instance
 */
export function getGlobalWisdomPipeline(): GlobalWisdomPipeline {
  if (!pipelineInstance) {
    pipelineInstance = new GlobalWisdomPipeline();
  }
  return pipelineInstance;
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetGlobalWisdomPipeline(): void {
  if (pipelineInstance) {
    pipelineInstance.reset();
  }
  pipelineInstance = null;
}
