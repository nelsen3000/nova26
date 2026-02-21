// KIMI-VAULT-02: Taste Vault Manager
// High-level API on top of GraphMemory for managing user taste patterns

import { 
  GraphMemory, 
  getGraphMemory, 
  resetGraphMemory,
  GraphNode, 
  NodeType, 
  // EdgeRelation imported but not directly used - kept for type consistency with graph-memory.ts 
} from './graph-memory.js';

// ============================================================================
// Tier Configuration
// ============================================================================

export interface TierConfig {
  tier: 'free' | 'premium';
  maxNodes: number;
  globalWisdomInjections: number;
  canOptIntoGlobal: boolean;
}

export const FREE_TIER: TierConfig = { 
  tier: 'free', 
  maxNodes: 500, 
  globalWisdomInjections: 4, 
  canOptIntoGlobal: true 
};

export const PREMIUM_TIER: TierConfig = { 
  tier: 'premium', 
  maxNodes: Infinity, 
  globalWisdomInjections: 12, 
  canOptIntoGlobal: true 
};

// ============================================================================
// Types
// ============================================================================

export interface LearnOptions {
  context?: string;
  source?: string;
  tags?: string[];
  confidence?: number;
  language?: string;
}

export interface BuildResult {
  taskTitle: string;
  taskDescription: string;
  agentOutput: string;
  agentName: string;
  success: boolean;
  error?: string;
}

export interface DetectedPattern {
  type: NodeType;
  content: string;
  confidence: number;
  context?: string;
}

export interface VaultSummary {
  tier: TierConfig;
  nodeCount: number;
  edgeCount: number;
  topPatterns: GraphNode[];
  byType: Record<NodeType, number>;
  avgConfidence: number;
}

// ============================================================================
// TasteVault Class
// ============================================================================

// K3-35: Hindsight hook callback types (avoids circular import)
export type HindsightLearnHook = (node: GraphNode, options?: LearnOptions) => Promise<void>;
export type HindsightReinforceHook = (nodeId: string, node: GraphNode) => Promise<void>;

export class TasteVault {
  private graph: GraphMemory;
  userId: string;
  tier: TierConfig;
  // private global wisdom tracking reserved for future use
  private hindsightLearnHook?: HindsightLearnHook;
  private hindsightReinforceHook?: HindsightReinforceHook;

  constructor(userId: string, tier: TierConfig = FREE_TIER) {
    this.userId = userId;
    this.tier = tier;
    this.graph = getGraphMemory(userId);
  }

  /**
   * K3-35: Register an optional Hindsight hook for pattern learning.
   * Called after each successful learn() to persist the pattern in Hindsight.
   */
  setHindsightLearnHook(hook: HindsightLearnHook): void {
    this.hindsightLearnHook = hook;
  }

  /**
   * K3-35: Register an optional Hindsight hook for pattern reinforcement.
   * Called after each successful reinforce() to update Hindsight memory.
   */
  setHindsightReinforceHook(hook: HindsightReinforceHook): void {
    this.hindsightReinforceHook = hook;
  }

  /** Remove all Hindsight hooks. */
  clearHindsightHooks(): void {
    this.hindsightLearnHook = undefined;
    this.hindsightReinforceHook = undefined;
  }

  // --------------------------------------------------------------------------
  // Core API
  // --------------------------------------------------------------------------

  /**
   * Learn a new pattern/fact/decision
   * Enforces maxNodes limit - removes lowest-confidence node if at limit
   */
  async learn(node: {
    type: NodeType;
    content: string;
  } & LearnOptions): Promise<GraphNode> {
    // Check for conflicts before learning
    const existingNodes = this.getAllNodes();
    const conflicts = this.detectConflicts(node.content, existingNodes);
    
    // Enforce maxNodes limit for free tier
    if (this.tier.tier === 'free') {
      const stats = this.graph.stats();
      if (stats.nodes >= this.tier.maxNodes) {
        // Remove lowest-confidence node (that has confidence < 0.9)
        const nodes = this.getAllNodes();
        const lowestConfidenceNode = nodes
          .filter(n => n.confidence < 0.9)
          .sort((a, b) => a.confidence - b.confidence)[0];
        
        if (lowestConfidenceNode) {
          this.graph.removeNode(lowestConfidenceNode.id);
        }
      }
    }

    // Create the node
    const createdNode = this.graph.addNode({
      type: node.type,
      content: node.content,
      confidence: node.confidence ?? 0.8,
      helpfulCount: 0,
      userId: this.userId,
      isGlobal: false,
      globalSuccessCount: 0,
      language: node.language,
      tags: node.tags ?? [],
    });

    // Create contradiction edges if conflicts found
    for (const conflict of conflicts) {
      this.graph.addEdge({
        sourceId: createdNode.id,
        targetId: conflict.id,
        relation: 'contradicts',
        strength: 0.9,
      });
    }

    // K3-35: Optional Hindsight hook (best-effort)
    if (this.hindsightLearnHook) {
      this.hindsightLearnHook(createdNode, node).catch((err: unknown) => {
        console.warn('[Hindsight] TasteVault learn hook failed:', err instanceof Error ? err.message : String(err));
      });
    }

    return createdNode;
  }

  /**
   * Forget a specific pattern by ID
   */
  async forget(nodeId: string): Promise<boolean> {
    return this.graph.removeNode(nodeId);
  }

  /**
   * Reinforce a pattern (increase confidence and helpful count)
   */
  async reinforce(nodeId: string): Promise<void> {
    const node = this.graph.reinforce(nodeId);
    if (!node) {
      throw new Error(`Node not found: ${nodeId}`);
    }
    this.graph.incrementHelpful(nodeId);

    // K3-35: Optional Hindsight hook (best-effort)
    if (this.hindsightReinforceHook) {
      this.hindsightReinforceHook(nodeId, node).catch((err: unknown) => {
        console.warn('[Hindsight] TasteVault reinforce hook failed:', err instanceof Error ? err.message : String(err));
      });
    }
  }

  // --------------------------------------------------------------------------
  // Retrieval
  // --------------------------------------------------------------------------

  /**
   * Get relevant patterns based on context
   * Uses semantic matching: tokenize context, score by keyword overlap + confidence + helpfulCount
   */
  async getRelevantPatterns(context: string, limit: number = 10): Promise<GraphNode[]> {
    const nodes = this.getAllNodes();
    if (nodes.length === 0) return [];

    // Tokenize context
    const contextTokens = this.tokenize(context);
    const tokenSet = new Set(contextTokens);

    // Score each node
    const scored = nodes.map(node => {
      let score = 0;

      // Keyword overlap score
      const nodeText = `${node.content} ${node.tags.join(' ')}`.toLowerCase();
      const nodeTokens = this.tokenize(nodeText);
      
      let overlap = 0;
      for (const token of nodeTokens) {
        if (tokenSet.has(token)) overlap++;
      }
      score += overlap * 10;

      // Boost by confidence (0-1)
      score += node.confidence * 20;

      // Boost by helpful count (diminishing returns)
      score += Math.log(node.helpfulCount + 1) * 5;

      return { node, score };
    });

    // Sort by score descending and return top N
    scored.sort((a, b) => b.score - a.score);
    
    return scored.slice(0, limit).map(s => s.node);
  }

  // --------------------------------------------------------------------------
  // Auto-learning
  // --------------------------------------------------------------------------

  /**
   * Learn from a build result
   * Success: extract patterns (requireAuth → Strategy, companyId → Pattern, Math.floor → Decision, z.object → Pattern)
   * Failure: create Mistake node with error info
   */
  async learnFromBuildResult(
    taskTitle: string,
    taskDescription: string,
    agentOutput: string,
    agentName: string,
    success: boolean
  ): Promise<void> {
    if (success) {
      // Extract patterns from successful output
      const patterns = this.extractPatternsFromOutput(agentOutput, agentName);
      
      for (const pattern of patterns) {
        await this.learn({
          type: pattern.type,
          content: pattern.content,
          source: agentName,
          tags: ['auto-learned', 'success', agentName.toLowerCase()],
          confidence: pattern.confidence,
        });
      }

      // Also check task description for patterns
      const descPatterns = this.extractPatternsFromDescription(taskDescription);
      for (const pattern of descPatterns) {
        await this.learn({
          type: pattern.type,
          content: pattern.content,
          source: agentName,
          tags: ['auto-learned', 'task-description'],
          confidence: pattern.confidence,
        });
      }
    } else {
      // Create Mistake node for failure
      await this.learn({
        type: 'Mistake',
        content: `Failed task: ${taskTitle}`,
        source: agentName,
        tags: ['auto-learned', 'failure', agentName.toLowerCase()],
        confidence: 0.7,
      });
    }
  }

  // --------------------------------------------------------------------------
  // Pattern Extraction
  // --------------------------------------------------------------------------

  /**
   * Detect patterns in code
   * Detects: auth guards, error handling, type annotations, etc.
   */
  async detectPatterns(code: string, language: string = 'typescript'): Promise<GraphNode[]> {
    const detected: GraphNode[] = [];
    const candidates: DetectedPattern[] = [];

    // Auth guard patterns
    if (code.includes('requireAuth')) {
      candidates.push({
        type: 'Strategy',
        content: 'Use requireAuth() for authentication guards',
        confidence: 0.95,
        context: 'Authentication pattern detected',
      });
    }

    if (code.includes('checkAuth') || code.includes('verifyToken')) {
      candidates.push({
        type: 'Strategy',
        content: 'Implement custom auth verification',
        confidence: 0.85,
      });
    }

    // Multi-tenancy patterns
    if (code.includes('companyId') || code.includes('orgId') || code.includes('tenantId')) {
      candidates.push({
        type: 'Pattern',
        content: 'Include tenant ID (companyId/orgId/tenantId) for row-level isolation',
        confidence: 0.9,
        context: 'Multi-tenancy pattern detected',
      });
    }

    // Error handling patterns
    if (code.includes('try {') && code.includes('catch')) {
      candidates.push({
        type: 'Pattern',
        content: 'Use try-catch blocks for error handling',
        confidence: 0.85,
      });
    }

    if (code.includes('Result<') || code.includes('Either<')) {
      candidates.push({
        type: 'Pattern',
        content: 'Use Result/Either types for explicit error handling',
        confidence: 0.9,
        context: 'Functional error handling pattern',
      });
    }

    // Type annotation patterns
    if (code.includes('z.object') || code.includes('zod')) {
      candidates.push({
        type: 'Pattern',
        content: 'Use Zod for runtime type validation',
        confidence: 0.95,
        context: 'Schema validation pattern',
      });
    }

    if (code.includes('interface ') && code.includes(':')) {
      candidates.push({
        type: 'Pattern',
        content: 'Define explicit TypeScript interfaces',
        confidence: 0.85,
      });
    }

    // Math patterns
    if (code.includes('Math.floor')) {
      candidates.push({
        type: 'Decision',
        content: 'Use Math.floor() for integer truncation',
        confidence: 0.9,
        context: 'Mathematical precision pattern',
      });
    }

    // React/Vue component patterns
    if (code.includes('useState') || code.includes('useEffect')) {
      candidates.push({
        type: 'Pattern',
        content: 'Follow React hooks patterns',
        confidence: 0.85,
      });
    }

    // Database patterns
    if (code.includes('index(') && code.includes('create')) {
      candidates.push({
        type: 'Pattern',
        content: 'Create database indexes for query performance',
        confidence: 0.9,
      });
    }

    // Testing patterns
    if (code.includes('describe(') && code.includes('it(')) {
      candidates.push({
        type: 'Pattern',
        content: 'Use descriptive test suites with describe/it blocks',
        confidence: 0.85,
      });
    }

    // Convert candidates to nodes
    for (const candidate of candidates) {
      const node = this.graph.addNode({
        type: candidate.type,
        content: candidate.content,
        confidence: candidate.confidence,
        helpfulCount: 0,
        userId: this.userId,
        isGlobal: false,
        globalSuccessCount: 0,
        language,
        tags: ['detected', language],
      });
      detected.push(node);
    }

    return detected;
  }

  // --------------------------------------------------------------------------
  // Conflict Detection
  // --------------------------------------------------------------------------

  /**
   * Detect conflicts between new content and existing nodes
   * Heuristic: "never X" vs "always X" → conflict
   */
  detectConflicts(newContent: string, existingNodes: GraphNode[]): GraphNode[] {
    const conflicts: GraphNode[] = [];
    const lowerContent = newContent.toLowerCase();

    for (const node of existingNodes) {
      const nodeText = node.content.toLowerCase();

      // Check for explicit "never" vs "always" conflicts
      if (this.hasNeverAlwaysConflict(lowerContent, nodeText)) {
        conflicts.push(node);
        continue;
      }

      // Check for "should" vs "should not" conflicts
      if (this.hasShouldConflict(lowerContent, nodeText)) {
        conflicts.push(node);
        continue;
      }

      // Check for existing contradiction edges
      const related = this.graph.getRelated(node.id, 'contradicts');
      if (related.length > 0) {
        // This node already has contradictions, check if new content matches
        for (const relatedNode of related) {
          if (this.contentSimilarity(lowerContent, relatedNode.content.toLowerCase()) > 0.8) {
            conflicts.push(node);
            break;
          }
        }
      }
    }

    return conflicts;
  }

  // --------------------------------------------------------------------------
  // Stats
  // --------------------------------------------------------------------------

  /**
   * Get summary of the vault
   */
  summary(): VaultSummary {
    const stats = this.graph.stats();
    const allNodes = this.getAllNodes();
    
    // Get top patterns by confidence * helpfulCount
    const topPatterns = allNodes
      .filter(n => n.type === 'Pattern' || n.type === 'Strategy' || n.type === 'Decision')
      .sort((a, b) => {
        const scoreA = a.confidence * (a.helpfulCount + 1);
        const scoreB = b.confidence * (b.helpfulCount + 1);
        return scoreB - scoreA;
      })
      .slice(0, 5);

    return {
      tier: this.tier,
      nodeCount: stats.nodes,
      edgeCount: stats.edges,
      topPatterns,
      byType: stats.byType,
      avgConfidence: stats.avgConfidence,
    };
  }

  // --------------------------------------------------------------------------
  // Persistence
  // --------------------------------------------------------------------------

  /**
   * Persist the vault to disk
   */
  async persist(): Promise<void> {
    this.graph.persist();
  }

  /**
   * Load the vault from disk
   */
  async load(): Promise<void> {
    this.graph.load();
  }

  // --------------------------------------------------------------------------
  // Private Helpers
  // --------------------------------------------------------------------------

  private getAllNodes(): GraphNode[] {
    const all: GraphNode[] = [];
    // Access the private nodes map through the GraphMemory's public methods
    // Since we don't have a getAllNodes method, we'll use search with empty string
    // or traverse from each node type
    for (const type of ['Strategy', 'Mistake', 'Preference', 'Pattern', 'Decision'] as NodeType[]) {
      all.push(...this.graph.getByType(type));
    }
    return all;
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 2)
      .filter(t => !this.isStopWord(t));
  }

  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two', 'who', 'boy', 'did', 'man', 'men', 'run', 'she', 'sun', 'way', 'what', 'with', 'have', 'this', 'will', 'your', 'from', 'they', 'know', 'want', 'been', 'good', 'much', 'some', 'time', 'very', 'when', 'come', 'here', 'just', 'like', 'long', 'make', 'many', 'over', 'such', 'take', 'than', 'them', 'well', 'were', 'that', 'said', 'each', 'which', 'their', 'would', 'there', 'could', 'other', 'after', 'first', 'never', 'these', 'think', 'where', 'being', 'every', 'great', 'might', 'shall', 'still', 'those', 'under', 'while', 'should', 'through', 'before', 'between', 'another', 'because', 'without', 'against', 'another', 'himself', 'herself', 'someone', 'everyone', 'anyone'
    ]);
    return stopWords.has(word);
  }

  private extractPatternsFromOutput(output: string, agentName: string): DetectedPattern[] {
    const patterns: DetectedPattern[] = [];

    // Agent-specific pattern extraction
    if (agentName === 'MARS' && output.includes('requireAuth')) {
      patterns.push({
        type: 'Strategy',
        content: 'All mutations use requireAuth() first',
        confidence: 0.95,
      });
    }

    if (agentName === 'PLUTO' && output.includes('companyId')) {
      patterns.push({
        type: 'Pattern',
        content: 'All tables include companyId for row-level isolation',
        confidence: 0.95,
      });
    }

    if (agentName === 'VENUS' && output.includes('loading')) {
      patterns.push({
        type: 'Pattern',
        content: 'Components implement all 5 UI states',
        confidence: 0.9,
      });
    }

    // Generic patterns
    if (output.includes('z.object')) {
      patterns.push({
        type: 'Pattern',
        content: 'Use Zod schemas for runtime validation',
        confidence: 0.9,
      });
    }

    if (output.includes('Math.floor')) {
      patterns.push({
        type: 'Decision',
        content: 'Always use Math.floor() for chip calculations, never Math.round()',
        confidence: 1.0,
      });
    }

    return patterns;
  }

  private extractPatternsFromDescription(description: string): DetectedPattern[] {
    const patterns: DetectedPattern[] = [];

    if (description.includes('Math.floor')) {
      patterns.push({
        type: 'Decision',
        content: 'Always use Math.floor() for chip calculations, never Math.round()',
        confidence: 1.0,
      });
    }

    if (description.includes('convex') && description.includes('schema')) {
      patterns.push({
        type: 'Pattern',
        content: 'Define Convex schema with proper indexes',
        confidence: 0.85,
      });
    }

    if (description.includes('react') || description.includes('component')) {
      patterns.push({
        type: 'Pattern',
        content: 'Build reusable React components',
        confidence: 0.8,
      });
    }

    return patterns;
  }

  private hasNeverAlwaysConflict(content1: string, content2: string): boolean {
    // Extract key phrases
    const extractKeyPhrase = (text: string): string | null => {
      const neverMatch = text.match(/never\s+(\w+)/);
      if (neverMatch) return neverMatch[1];
      
      const alwaysMatch = text.match(/always\s+(\w+)/);
      if (alwaysMatch) return alwaysMatch[1];
      
      return null;
    };

    const phrase1 = extractKeyPhrase(content1);
    const phrase2 = extractKeyPhrase(content2);

    if (phrase1 && phrase2 && phrase1 === phrase2) {
      const c1HasNever = content1.includes('never');
      const c1HasAlways = content1.includes('always');
      const c2HasNever = content2.includes('never');
      const c2HasAlways = content2.includes('always');

      return (c1HasNever && c2HasAlways) || (c1HasAlways && c2HasNever);
    }

    return false;
  }

  private hasShouldConflict(content1: string, content2: string): boolean {
    const should1 = content1.includes('should');
    const shouldNot1 = content1.includes('should not') || content1.includes('shouldn\'t');
    const should2 = content2.includes('should');
    const shouldNot2 = content2.includes('should not') || content2.includes('shouldn\'t');

    // Extract the action being discussed
    const extractAction = (text: string): string => {
      return text.replace(/should\s+(not\s+)?/i, '').trim().split(' ').slice(0, 3).join(' ');
    };

    if ((should1 || shouldNot1) && (should2 || shouldNot2)) {
      const action1 = extractAction(content1);
      const action2 = extractAction(content2);
      
      if (action1 && action2 && this.contentSimilarity(action1, action2) > 0.7) {
        return (should1 && !shouldNot1 && shouldNot2) || (shouldNot1 && should2 && !shouldNot2);
      }
    }

    return false;
  }

  private contentSimilarity(a: string, b: string): number {
    const tokensA = new Set(this.tokenize(a));
    const tokensB = new Set(this.tokenize(b));
    
    if (tokensA.size === 0 || tokensB.size === 0) return 0;

    const intersection = new Set([...tokensA].filter(x => tokensB.has(x)));
    const union = new Set([...tokensA, ...tokensB]);

    return intersection.size / union.size;
  }
}

// ============================================================================
// Singleton Factory
// ============================================================================

const vaultInstances = new Map<string, TasteVault>();

export function getTasteVault(userId?: string, tier?: TierConfig): TasteVault {
  const id = userId || 'default';
  
  if (!vaultInstances.has(id)) {
    vaultInstances.set(id, new TasteVault(id, tier));
  }
  
  const vault = vaultInstances.get(id)!;
  
  // Update tier if provided
  if (tier) {
    vault.tier = tier;
  }
  
  return vault;
}

export function resetTasteVault(): void {
  vaultInstances.clear();
  resetGraphMemory();
}
