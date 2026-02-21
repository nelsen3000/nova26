// Scoring Functions - Various scoring algorithms for evaluation
// Spec: .nova/specs/grok-r23-eternal-symphony.md (R23-05)

// ═══════════════════════════════════════════════════════════════════════════════
// Exact Match
// ═══════════════════════════════════════════════════════════════════════════════

export function exactMatch(actual: unknown, expected: unknown): number {
  if (actual === expected) return 1;
  
  // Handle null/undefined
  if (actual == null && expected == null) return 1;
  if (actual == null || expected == null) return 0;
  
  // String comparison
  if (typeof actual === 'string' && typeof expected === 'string') {
    return actual === expected ? 1 : 0;
  }
  
  // Deep equality for objects
  return JSON.stringify(actual) === JSON.stringify(expected) ? 1 : 0;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Fuzzy Match (Levenshtein Distance)
// ═══════════════════════════════════════════════════════════════════════════════

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

export function fuzzyMatch(
  actual: unknown,
  expected: unknown,
  options: { caseSensitive?: boolean; trimWhitespace?: boolean } = {}
): number {
  if (actual == null || expected == null) return 0;

  let actualStr = String(actual);
  let expectedStr = String(expected);

  if (!options.caseSensitive) {
    actualStr = actualStr.toLowerCase();
    expectedStr = expectedStr.toLowerCase();
  }

  if (options.trimWhitespace) {
    actualStr = actualStr.trim();
    expectedStr = expectedStr.trim();
  }

  const maxLength = Math.max(actualStr.length, expectedStr.length);
  if (maxLength === 0) return 1;

  const distance = levenshteinDistance(actualStr, expectedStr);
  return 1 - distance / maxLength;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Contains Match
// ═══════════════════════════════════════════════════════════════════════════════

export function containsMatch(
  actual: unknown,
  expected: unknown,
  options: { caseSensitive?: boolean } = {}
): number {
  if (actual == null || expected == null) return 0;

  const actualStr = String(actual);
  const expectedStr = String(expected);

  if (options.caseSensitive) {
    return actualStr.includes(expectedStr) ? 1 : 0;
  }

  return actualStr.toLowerCase().includes(expectedStr.toLowerCase()) ? 1 : 0;
}

// ═══════════════════════════════════════════════════════════════════════════════
// JSON Match (Deep Partial)
// ═══════════════════════════════════════════════════════════════════════════════

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function partialDeepMatch(actual: unknown, expected: unknown): boolean {
  if (expected === actual) return true;
  if (expected == null) return true; // null/undefined expected matches anything
  if (actual == null) return false;

  if (isObject(expected) && isObject(actual)) {
    for (const key of Object.keys(expected)) {
      if (!(key in actual)) return false;
      if (!partialDeepMatch(actual[key], expected[key])) return false;
    }
    return true;
  }

  if (Array.isArray(expected) && Array.isArray(actual)) {
    if (expected.length > actual.length) return false;
    for (let i = 0; i < expected.length; i++) {
      if (!partialDeepMatch(actual[i], expected[i])) return false;
    }
    return true;
  }

  return false;
}

export function jsonMatch(actual: unknown, expected: unknown): number {
  try {
    const actualObj = typeof actual === 'string' ? JSON.parse(actual) : actual;
    const expectedObj =
      typeof expected === 'string' ? JSON.parse(expected) : expected;

    return partialDeepMatch(actualObj, expectedObj) ? 1 : 0;
  } catch {
    return 0;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Semantic Similarity (TF-IDF Cosine)
// ═══════════════════════════════════════════════════════════════════════════════

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 0);
}

function computeTf(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const token of tokens) {
    tf.set(token, (tf.get(token) ?? 0) + 1);
  }
  // Normalize
  const maxTf = Math.max(...tf.values());
  for (const [token, count] of tf) {
    tf.set(token, count / maxTf);
  }
  return tf;
}

function computeIdf(
  documents: string[][]
): Map<string, number> {
  const idf = new Map<string, number>();
  const n = documents.length;

  // Count document frequency
  const df = new Map<string, number>();
  for (const doc of documents) {
    const unique = new Set(doc);
    for (const token of unique) {
      df.set(token, (df.get(token) ?? 0) + 1);
    }
  }

  // Compute IDF
  for (const [token, count] of df) {
    idf.set(token, Math.log(n / count));
  }

  return idf;
}

function cosineSimilarity(
  vecA: Map<string, number>,
  vecB: Map<string, number>
): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (const [token, valA] of vecA) {
    const valB = vecB.get(token) ?? 0;
    dotProduct += valA * valB;
    normA += valA * valA;
  }

  for (const valB of vecB.values()) {
    normB += valB * valB;
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function semanticSimilarity(
  actual: unknown,
  expected: unknown
): number {
  if (actual == null || expected == null) return 0;

  const actualStr = String(actual);
  const expectedStr = String(expected);

  const tokensA = tokenize(actualStr);
  const tokensB = tokenize(expectedStr);

  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  // Compute IDF from both documents
  const idf = computeIdf([tokensA, tokensB]);

  // Compute TF-IDF vectors
  const tfA = computeTf(tokensA);
  const tfB = computeTf(tokensB);

  const vecA = new Map<string, number>();
  const vecB = new Map<string, number>();

  for (const [token, tf] of tfA) {
    vecA.set(token, tf * (idf.get(token) ?? 0));
  }

  for (const [token, tf] of tfB) {
    vecB.set(token, tf * (idf.get(token) ?? 0));
  }

  // Ensure same keys in both vectors
  const allTokens = new Set([...vecA.keys(), ...vecB.keys()]);
  for (const token of allTokens) {
    if (!vecA.has(token)) vecA.set(token, 0);
    if (!vecB.has(token)) vecB.set(token, 0);
  }

  return cosineSimilarity(vecA, vecB);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Code Match (Whitespace-normalized)
// ═══════════════════════════════════════════════════════════════════════════════

export function codeMatch(actual: unknown, expected: unknown): number {
  if (actual == null || expected == null) return 0;

  function normalize(code: string): string {
    return code
      .replace(/\/\/[\s\S]*?$/gm, '') // Remove single-line comments
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  const actualNorm = normalize(String(actual));
  const expectedNorm = normalize(String(expected));

  return actualNorm === expectedNorm ? 1 : 0;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Composite Score
// ═══════════════════════════════════════════════════════════════════════════════

export interface ScoringMethod {
  method: string;
  weight: number;
  options?: Record<string, unknown>;
}

export function compositeScore(
  actual: unknown,
  expected: unknown,
  methods: ScoringMethod[]
): number {
  if (methods.length === 0) return 0;

  let totalScore = 0;
  let totalWeight = 0;

  for (const { method, weight, options } of methods) {
    const scorer = getScorer(method);
    if (!scorer) continue;

    const score = scorer(actual, expected, options as any);
    totalScore += score * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) return 0;
  return totalScore / totalWeight;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Scorer Registry
// ═══════════════════════════════════════════════════════════════════════════════

export type ScorerFunction = (actual: unknown, expected: unknown, options?: unknown) => number;

const SCORERS: Map<string, ScorerFunction> = new Map([
  ['exactMatch', exactMatch],
  ['fuzzyMatch', fuzzyMatch],
  ['containsMatch', containsMatch],
  ['jsonMatch', jsonMatch],
  ['semanticSimilarity', semanticSimilarity],
  ['codeMatch', codeMatch],
]);

export function registerScorer(name: string, scorer: ScorerFunction): void {
  SCORERS.set(name, scorer);
}

export function getScorer(name: string): ScorerFunction | undefined {
  return SCORERS.get(name);
}

export function listScorers(): string[] {
  return Array.from(SCORERS.keys());
}

export function hasScorer(name: string): boolean {
  return SCORERS.has(name);
}
