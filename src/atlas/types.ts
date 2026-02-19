// Kronos integration types for ATLAS memory system

export interface KronosEntry {
  project: string;
  taskId: string;
  agent: string;
  phase: number;
  content: string;
  tags: string[];
}

export interface KronosPointer {
  id: string;
  taskId: string;
  summary: string;
  relevanceScore: number;
  tokenCount: number;
}

export interface KronosSearchResult {
  pointers: KronosPointer[];
  totalTokensSaved: number;
}

// R19-02 Deep Semantic Model Types

export interface SemanticModelConfig {
  analysisDepth: 'shallow' | 'standard' | 'deep';
  updateStrategy: 'on-change' | 'periodic' | 'manual';
  cacheLocation: string;
  maxCacheSizeMB: number;
  tsMorphProjectRoot: string;
  enableContextCompaction: boolean;
  compactionTokenBudget: number;
  semanticTagSources: string[];
  refreshIntervalMinutes: number;
}

export interface CodeNode {
  id: string;
  type: 'file' | 'function' | 'class' | 'interface' | 'type' | 'export' | 'component' | 'hook' | 'page' | 'api' | 'endpoint' | 'util' | 'test';
  name: string;
  filePath: string;
  location: { line: number; column: number };
  complexity: number;
  changeFrequency: number;
  testCoverage: number;
  semanticTags: string[];
  dependents: string[];
}

export interface CodeEdge {
  fromId: string;
  toId: string;
  type: 'imports' | 'calls' | 'extends' | 'implements' | 'uses-type' | 'renders' | 'depends-on';
  weight: number;
}

export interface ImpactAnalysisResult {
  changedNode: CodeNode;
  affectedNodes: CodeNode[];
  affectedFiles: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  visualization: string; // Mermaid diagram
  suggestedTests: string[];
}

export interface SemanticDiffSummary {
  prIntent: string;
  groupedChanges: Array<{ category: string; files: string[]; summary: string }>;
  suspiciousPatterns: string[];
  overallConfidence: number;
  safeToMerge: boolean;
  humanReadableReport: string;
}

export interface CompactedContext {
  projectSummary: string;
  relevantModules: Array<{ name: string; purpose: string; keyExports: string[] }>;
  keyPatterns: string[];
  tokenCount: number;
  expand: (moduleName: string) => string;
}

export interface CodeGraph {
  nodes: Map<string, CodeNode>;
  edges: CodeEdge[];
}
