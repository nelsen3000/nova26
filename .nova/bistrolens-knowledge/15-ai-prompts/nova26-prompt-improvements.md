# Nova26 Prompt Engineering Improvements

## Adapted from BistroLens AI Prompt Patterns

**Source:** BistroLens `40-AI-PROMPT-ENGINEERING.md`  
**Category:** AI/LLM Prompt Design  
**Priority:** P2  
**Reusability:** 8/10

---

## Overview

BistroLens has structured prompt engineering:
- Model configuration constraints
- System prompt templates
- Safety filters (pre/post generation)
- Hallucination prevention
- Response validation

Nova26's `prompt-builder.ts` can be enhanced with these techniques.

---

## Pattern 1: Structured System Prompts

**Source:** BistroLens system prompt templates  
**Nova26 Enhancement:** Agent-specific system prompts

### Template Structure

```typescript
// src/prompts/system-prompts.ts

interface SystemPromptTemplate {
  identity: string;
  capabilities: string[];
  constraints: string[];
  outputFormat: string;
  examples?: string[];
}

const AGENT_SYSTEM_PROMPTS: Record<string, SystemPromptTemplate> = {
  VENUS: {
    identity: `You are VENUS, the UI/UX implementation specialist for Nova26.
You build beautiful, accessible React components with Tailwind CSS.
You obsess over details: spacing, colors, animations, and user experience.`,
    
    capabilities: [
      'Build React 19 components with TypeScript',
      'Style with Tailwind CSS classes only',
      'Use shadcn/ui components as building blocks',
      'Implement all 5 UI states (loading, empty, error, success, default)',
      'Ensure WCAG AA accessibility compliance',
    ],
    
    constraints: [
      'NEVER use inline styles',
      'NEVER use any type',
      'NEVER use div with onClick (use button)',
      'ALWAYS use semantic HTML',
      'ALWAYS include aria-labels for interactive elements',
    ],
    
    outputFormat: `Output TypeScript React components only.
Use this structure:
1. Imports
2. TypeScript interfaces
3. Component function with proper types
4. Export statement

Format as code blocks with language identifier.`,
  },
  
  MARS: {
    identity: `You are MARS, the TypeScript and business logic specialist for Nova26.
You write type-safe, performant code with zero any types.
You prefer explicit types over inference for public APIs.`,
    
    capabilities: [
      'Write strict TypeScript',
      'Design comprehensive type definitions',
      'Implement business logic with error handling',
      'Create pure functions for testability',
      'Optimize for performance',
    ],
    
    constraints: [
      'NEVER use any',
      'NEVER use @ts-ignore',
      'ALWAYS specify return types on exported functions',
      'ALWAYS handle error cases explicitly',
    ],
    
    outputFormat: `Output TypeScript code only.
Include:
1. Type definitions
2. Function implementations
3. Export statements

No explanatory text outside code blocks.`,
  },
  
  PLUTO: {
    identity: `You are PLUTO, the database architect for Nova26.
You design Convex schemas with proper indexing and relationships.
You prioritize query performance and data integrity.`,
    
    capabilities: [
      'Design Convex table schemas',
      'Create efficient indexes',
      'Implement query and mutation functions',
      'Set up Row Level Security',
      'Design for real-time subscriptions',
    ],
    
    constraints: [
      'ALWAYS use camelCase for field names',
      'ALWAYS include createdAt and updatedAt',
      'ALWAYS add isDeleted for soft delete support',
      'ALWAYS index fields used in .filter()',
    ],
    
    outputFormat: `Output Convex TypeScript code only.
Format:
1. Schema definitions
2. Index declarations
3. Query/mutation functions
4. Type exports`,
  },
};

export function buildSystemPrompt(agent: string): string {
  const template = AGENT_SYSTEM_PROMPTS[agent];
  if (!template) return '';
  
  return `${template.identity}

CAPABILITIES:
${template.capabilities.map(c => `- ${c}`).join('\n')}

CONSTRAINTS:
${template.constraints.map(c => `- ${c}`).join('\n')}

OUTPUT FORMAT:
${template.outputFormat}`;
}
```

---

## Pattern 2: Safety Filters

**Source:** BistroLens pre/post generation validation  
**Nova26 Enhancement:** Prompt and output validation

### Pre-Generation Filters

```typescript
// src/prompts/safety-filters.ts

const BLOCKED_PROMPT_PATTERNS = [
  // Security
  /eval\s*\(/,
  /Function\s*\(/,
  /child_process/,
  
  // Injection risks
  /SELECT\s+.*\s+FROM/i,
  /INSERT\s+INTO/i,
  /DELETE\s+FROM/i,
  
  // Anti-patterns
  /any\s*\[\s*\]/,
  /TODO|FIXME|XXX/,
];

interface ValidationResult {
  valid: boolean;
  reason?: string;
  category?: 'security' | 'performance' | 'maintainability';
}

export function validatePrompt(prompt: string): ValidationResult {
  for (const pattern of BLOCKED_PROMPT_PATTERNS) {
    if (pattern.test(prompt)) {
      return {
        valid: false,
        reason: `Prompt contains blocked pattern: ${pattern.source}`,
        category: 'security',
      };
    }
  }
  
  // Check for missing context
  if (prompt.length < 50) {
    return {
      valid: false,
      reason: 'Prompt is too short - add more context',
      category: 'maintainability',
    };
  }
  
  return { valid: true };
}

// Post-generation validation
const REQUIRED_OUTPUT_PATTERNS: Record<string, RegExp[]> = {
  VENUS: [
    /export\s+(default\s+)?function/,  // Must export a function
    /React\./,  // Must use React
    /className\s*=/,  // Must use Tailwind
  ],
  MARS: [
    /export\s+(type\s+)?\w+/,  // Must have exports
    /interface|type\s+\w+\s*=/,  // Must define types
  ],
  PLUTO: [
    /defineTable/,  // Must define tables
    /\.index\s*\(/,  // Must have indexes
  ],
};

export function validateOutput(
  agent: string,
  output: string
): ValidationResult {
  const requiredPatterns = REQUIRED_OUTPUT_PATTERNS[agent] || [];
  
  for (const pattern of requiredPatterns) {
    if (!pattern.test(output)) {
      return {
        valid: false,
        reason: `Output missing required pattern: ${pattern.source}`,
        category: 'maintainability',
      };
    }
  }
  
  return { valid: true };
}
```

---

## Pattern 3: Hallucination Prevention

**Source:** BistroLens grounding techniques  
**Nova26 Enhancement:** Constrained generation

### Grounding Techniques

```typescript
// src/prompts/hallucination-prevention.ts

interface GroundingConfig {
  temperature: number;
  topP: number;
  topK: number;
  maxTokens: number;
  constraints: string[];
}

const AGENT_GROUNDING: Record<string, GroundingConfig> = {
  VENUS: {
    temperature: 0.7,  // Balanced creativity
    topP: 0.9,
    topK: 40,
    maxTokens: 4000,
    constraints: [
      'Only use Tailwind classes from the provided design system',
      'Only use shadcn/ui components that exist in the project',
      'Do not invent new component props',
      'Use exact color values from theme',
    ],
  },
  
  MARS: {
    temperature: 0.3,  // Lower for code generation
    topP: 0.95,
    topK: 20,
    maxTokens: 3000,
    constraints: [
      'Only use types defined in the schema',
      'Do not invent new API endpoints',
      'Follow existing function naming conventions',
      'Use exact type definitions from convex/_generated',
    ],
  },
  
  PLUTO: {
    temperature: 0.2,  // Very low for schema
    topP: 0.95,
    topK: 10,
    maxTokens: 2000,
    constraints: [
      'Only use Convex validator types (v.string, v.number, etc.)',
      'Do not invent new index types',
      'Follow exact Convex syntax',
    ],
  },
};

export function applyGrounding(agent: string): GroundingConfig {
  return AGENT_GROUNDING[agent] || {
    temperature: 0.7,
    topP: 0.9,
    topK: 40,
    maxTokens: 4000,
    constraints: [],
  };
}

// Fact-check patterns
const HALLUCINATION_INDICATORS = [
  /TODO: Implement/i,
  /\/\/ .../,
  /function\s+\w+\s*\(\s*\)\s*\{\s*\/\/.*\}/,
  /import\s+.*\s+from\s+['"]\..*['"]/,  // Check for non-existent imports
];

export function detectHallucination(code: string): boolean {
  return HALLUCINATION_INDICATORS.some(pattern => pattern.test(code));
}
```

---

## Pattern 4: Response Parsing

**Source:** BistroLens JSON extraction  
**Nova26 Enhancement:** Code extraction and validation

### Code Extraction

```typescript
// src/prompts/code-extraction.ts

interface ExtractedCode {
  language: string;
  code: string;
  fileName?: string;
}

export function extractCodeBlocks(response: string): ExtractedCode[] {
  const codeBlocks: ExtractedCode[] = [];
  
  // Match markdown code blocks
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  let match;
  
  while ((match = codeBlockRegex.exec(response)) !== null) {
    codeBlocks.push({
      language: match[1] || 'text',
      code: match[2].trim(),
    });
  }
  
  return codeBlocks;
}

export function extractFileStructure(response: string): Map<string, string> {
  const files = new Map<string, string>();
  
  // Look for "File: path" annotations
  const fileRegex = /(?:File|path):\s*(.+?)\n```(\w+)?\n([\s\S]*?)```/g;
  let match;
  
  while ((match = fileRegex.exec(response)) !== null) {
    files.set(match[1].trim(), match[3].trim());
  }
  
  return files;
}

// Parse with fallback
export function parseResponse(
  response: string,
  expectedFormat: 'code' | 'json' | 'markdown'
): { success: boolean; content: any; error?: string } {
  try {
    switch (expectedFormat) {
      case 'json':
        // Try to extract JSON
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return {
            success: true,
            content: JSON.parse(jsonMatch[0]),
          };
        }
        throw new Error('No JSON found in response');
        
      case 'code':
        const codeBlocks = extractCodeBlocks(response);
        if (codeBlocks.length > 0) {
          return {
            success: true,
            content: codeBlocks,
          };
        }
        throw new Error('No code blocks found in response');
        
      case 'markdown':
        return {
          success: true,
          content: response,
        };
        
      default:
        throw new Error(`Unknown format: ${expectedFormat}`);
    }
  } catch (error) {
    return {
      success: false,
      content: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
```

---

## Pattern 5: Context Window Management

**Source:** BistroLens conversation history limits  
**Nova26 Enhancement:** Build context management

### Context Truncation

```typescript
// src/prompts/context-manager.ts

interface BuildContext {
  agentHistory: AgentCall[];
  fileHistory: FileChange[];
  errorHistory: Error[];
}

interface AgentCall {
  agent: string;
  prompt: string;
  response: string;
  tokensUsed: number;
  timestamp: number;
}

const CONTEXT_LIMITS = {
  maxMessages: 10,
  maxTokens: 8000,
  maxFiles: 20,
};

export function buildContextWindow(
  context: BuildContext,
  currentAgent: string
): string {
  let contextParts: string[] = [];
  let estimatedTokens = 0;
  
  // 1. Recent agent calls (summarized)
  const recentCalls = context.agentHistory
    .slice(-CONTEXT_LIMITS.maxMessages)
    .map(call => ({
      agent: call.agent,
      summary: summarizeAgentOutput(call.response),
    }));
  
  contextParts.push('## Recent Agent Activity\n');
  for (const call of recentCalls) {
    const part = `- ${call.agent}: ${call.summary}\n`;
    contextParts.push(part);
    estimatedTokens += part.length / 4;
  }
  
  // 2. Current file state (recent changes)
  if (context.fileHistory.length > 0) {
    contextParts.push('\n## Recent File Changes\n');
    const recentFiles = context.fileHistory.slice(-5);
    for (const file of recentFiles) {
      const part = `- ${file.path} (${file.changeType})\n`;
      contextParts.push(part);
      estimatedTokens += part.length / 4;
    }
  }
  
  // 3. Recent errors (for context)
  if (context.errorHistory.length > 0) {
    contextParts.push('\n## Recent Issues\n');
    const recentErrors = context.errorHistory.slice(-3);
    for (const error of recentErrors) {
      const part = `- ${error.message}\n`;
      contextParts.push(part);
      estimatedTokens += part.length / 4;
    }
  }
  
  return contextParts.join('');
}

function summarizeAgentOutput(output: string): string {
  // Extract key information from agent output
  const lines = output.split('\n');
  
  // Look for summary patterns
  const summaryLine = lines.find(line => 
    line.toLowerCase().includes('summary') ||
    line.toLowerCase().includes('completed') ||
    line.toLowerCase().includes('created')
  );
  
  if (summaryLine) {
    return summaryLine.slice(0, 100);
  }
  
  // Fallback: first non-empty line
  return lines.find(line => line.trim().length > 0)?.slice(0, 100) || 'Completed';
}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/prompts/system-prompts.ts` | New - agent system prompts |
| `src/prompts/safety-filters.ts` | New - prompt/output validation |
| `src/prompts/hallucination-prevention.ts` | New - grounding config |
| `src/prompts/code-extraction.ts` | New - response parsing |
| `src/prompts/context-manager.ts` | New - context window management |
| `src/llm/prompt-builder.ts` | Integrate new patterns |

---

*Adapted from BistroLens AI prompt engineering*
*For Nova26 prompt improvements*
