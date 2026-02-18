// Structured Output with Instructor JS
// Provides Zod schema validation for agent responses

import { z } from 'zod';
import type { LLMResponse } from '../types/index.js';
import { callLLM } from './ollama-client.js';

/**
 * Extended response type with parsed Zod schema
 */
export interface StructuredLLMResponse<T> extends LLMResponse {
  parsed: T;
}

// ============================================
// Zod Schemas for Each Agent Type
// ============================================

/**
 * EARTH Agent: Spec generation
 * Expected output: specification with fields, constraints, validation
 */
export const EarthSchema = z.object({
  specName: z.string().describe('Name of the specification'),
  overview: z.string().describe('Brief overview of what this spec defines'),
  fields: z.array(z.object({
    name: z.string().describe('Field name'),
    type: z.string().describe('Data type'),
    required: z.boolean().describe('Whether field is required'),
    constraints: z.string().optional().describe('Validation constraints'),
    description: z.string().describe('Field description'),
  })).describe('Array of field definitions'),
  validationRules: z.array(z.string()).describe('Validation rules to apply'),
  dependencies: z.array(z.string()).optional().describe('Related specifications'),
});

export type EarthOutput = z.infer<typeof EarthSchema>;

/**
 * PLUTO Agent: Database schema generation
 * Expected output: schema with defineTable code blocks
 */
export const PlutoSchema = z.object({
  tables: z.array(z.object({
    tableName: z.string().describe('Name of the database table'),
    columns: z.array(z.object({
      name: z.string().describe('Column name'),
      type: z.string().describe('SQL data type'),
      nullable: z.boolean().describe('Whether column allows NULL'),
      primaryKey: z.boolean().describe('Is primary key'),
      foreignKey: z.object({
        references: z.string().describe('Referenced table'),
        on: z.string().describe('Referenced column'),
      }).optional().describe('Foreign key constraint'),
    })).describe('Table columns'),
    indexes: z.array(z.object({
      name: z.string().describe('Index name'),
      columns: z.array(z.string()).describe('Indexed columns'),
      unique: z.boolean().describe('Is unique index'),
    })).optional().describe('Table indexes'),
  })).describe('Database tables'),
  migrations: z.array(z.string()).describe('SQL migration statements'),
});

export type PlutoOutput = z.infer<typeof PlutoSchema>;

/**
 * MERCURY Agent: Validation report
 * Expected output: validation report with PASS/FAIL
 */
export const MercurySchema = z.object({
  status: z.enum(['PASS', 'FAIL', 'WARNING']).describe('Overall validation status'),
  score: z.number().min(0).max(100).describe('Validation score 0-100'),
  issues: z.array(z.object({
    severity: z.enum(['error', 'warning', 'info']).describe('Issue severity'),
    message: z.string().describe('Issue description'),
    location: z.string().optional().describe('File/line location'),
    suggestion: z.string().optional().describe('How to fix'),
  })).describe('Issues found'),
  summary: z.string().describe('Validation summary'),
  checksPerformed: z.array(z.string()).describe('List of validation checks performed'),
});

export type MercuryOutput = z.infer<typeof MercurySchema>;

/**
 * JUPITER Agent: Architecture Decision Record (ADR)
 * Expected output: ADR with context, decision, consequences
 */
export const JupiterSchema = z.object({
  title: z.string().describe('ADR title'),
  status: z.enum(['proposed', 'accepted', 'deprecated', 'superseded']).describe('ADR status'),
  context: z.string().describe('Problem context and background'),
  decision: z.string().describe('The decision made'),
  consequences: z.object({
    positive: z.array(z.string()).describe('Positive consequences'),
    negative: z.array(z.string()).describe('Negative consequences'),
    tradeoffs: z.array(z.string()).describe('Trade-offs considered'),
  }).describe('Consequences of the decision'),
  alternatives: z.array(z.string()).describe('Alternatives considered'),
  relatedAdrs: z.array(z.string()).optional().describe('Related ADRs'),
});

export type JupiterOutput = z.infer<typeof JupiterSchema>;

/**
 * VENUS Agent: React component
 * Expected output: React component with props, state, JSX
 */
export const VenusSchema = z.object({
  componentName: z.string().describe('React component name'),
  props: z.array(z.object({
    name: z.string().describe('Prop name'),
    type: z.string().describe('TypeScript type'),
    required: z.boolean().describe('Is required'),
    defaultValue: z.string().optional().describe('Default value'),
  })).describe('Component props'),
  state: z.array(z.object({
    name: z.string().describe('State variable name'),
    type: z.string().describe('TypeScript type'),
    initialValue: z.string().optional().describe('Initial value'),
  })).optional().describe('Component state'),
  hooks: z.array(z.string()).describe('Hooks used (useEffect, useState, etc.)'),
  jsx: z.string().describe('JSX structure'),
  styles: z.object({
    approach: z.enum(['css', 'css-modules', 'styled-components', 'tailwind', 'inline']).describe('Styling approach'),
    code: z.string().describe('CSS or style code'),
  }).optional().describe('Component styles'),
});

export type VenusOutput = z.infer<typeof VenusSchema>;

/**
 * MARS Agent: TypeScript backend code
 * Expected output: TypeScript backend code with types, functions
 */
export const MarsSchema = z.object({
  fileName: z.string().describe('Output file name'),
  imports: z.array(z.string()).describe('Import statements'),
  types: z.array(z.object({
    name: z.string().describe('Type name'),
    definition: z.string().describe('Type definition'),
  })).describe('TypeScript type definitions'),
  functions: z.array(z.object({
    name: z.string().describe('Function name'),
    params: z.array(z.object({
      name: z.string().describe('Parameter name'),
      type: z.string().describe('Parameter type'),
    })).describe('Function parameters'),
    returnType: z.string().describe('Return type'),
    body: z.string().describe('Function implementation'),
    exports: z.boolean().describe('Is exported'),
  })).describe('Functions defined'),
  exports: z.array(z.string()).describe('Exported names'),
});

export type MarsOutput = z.infer<typeof MarsSchema>;

// ============================================
// Schemas for remaining 15 agents
// ============================================

/**
 * SUN Agent: PRD generation
 * Output: a structured PRD JSON with meta + tasks array
 */
export const SunSchema = z.object({
  meta: z.object({
    name: z.string().describe('PRD name'),
    version: z.string().describe('Version string e.g. "1.0.0"'),
    createdAt: z.string().describe('ISO 8601 timestamp'),
  }),
  tasks: z.array(z.object({
    id: z.string().describe('Unique task ID e.g. "task-001"'),
    title: z.string().describe('Human-readable task title'),
    description: z.string().describe('Detailed instructions for the agent'),
    agent: z.string().describe('Agent name: EARTH, PLUTO, MERCURY, etc.'),
    status: z.enum(['pending', 'ready', 'running', 'done', 'failed', 'blocked']),
    dependencies: z.array(z.string()).describe('Task IDs this task depends on'),
    phase: z.number().int().min(0).describe('Execution phase (lower runs first)'),
    attempts: z.number().int().min(0).default(0),
    createdAt: z.string().describe('ISO 8601 timestamp'),
  })).min(1).describe('All tasks in the PRD'),
});

export type SunOutput = z.infer<typeof SunSchema>;

/**
 * SATURN Agent: Test suite generation
 * Output: test files with unit, component, and E2E tests
 */
export const SaturnSchema = z.object({
  targetFile: z.string().describe('The file/module being tested'),
  testFile: z.string().describe('Output test file path'),
  unitTests: z.array(z.object({
    describe: z.string().describe('Test suite name'),
    cases: z.array(z.object({
      name: z.string().describe('Test case name (it/test description)'),
      code: z.string().describe('Full test case code'),
    })),
  })).describe('Vitest unit tests'),
  componentTests: z.array(z.object({
    component: z.string().describe('Component name'),
    cases: z.array(z.object({
      name: z.string(),
      code: z.string(),
    })),
  })).optional().describe('RTL component tests'),
  e2eTests: z.array(z.object({
    flow: z.string().describe('User flow name'),
    code: z.string().describe('Playwright test code'),
  })).optional().describe('Playwright E2E tests'),
  coverageTargets: z.object({
    mutations: z.number().min(0).max(100).describe('Required mutation coverage %'),
    components: z.number().min(0).max(100).describe('Required component coverage %'),
    overall: z.number().min(0).max(100).describe('Required overall coverage %'),
  }),
  traceabilityLinks: z.array(z.object({
    gherkinScenario: z.string(),
    testCase: z.string(),
  })).describe('Links from EARTH Gherkin scenarios to test cases'),
});

export type SaturnOutput = z.infer<typeof SaturnSchema>;

/**
 * ENCELADUS Agent: Security audit & implementation
 * Output: security review report with findings and patterns
 */
export const EnceladusSchema = z.object({
  reviewType: z.enum(['audit', 'implementation', 'validation']).describe('Type of security work'),
  targetComponent: z.string().describe('Component/feature being secured'),
  findings: z.array(z.object({
    severity: z.enum(['critical', 'high', 'medium', 'low', 'info']),
    category: z.enum(['auth', 'authorization', 'xss', 'injection', 'csrf', 'rls', 'api', 'data-exposure', 'other']),
    title: z.string(),
    description: z.string(),
    location: z.string().optional().describe('File:line or function name'),
    remediation: z.string().describe('How to fix'),
  })).describe('Security findings'),
  patterns: z.array(z.object({
    name: z.string().describe('Pattern name e.g. "requireAuth"'),
    purpose: z.string(),
    code: z.string().describe('TypeScript implementation'),
  })).describe('Security patterns to implement'),
  checklistResults: z.object({
    authImplemented: z.boolean(),
    authorizationEnforced: z.boolean(),
    inputValidated: z.boolean(),
    xssPrevented: z.boolean(),
    rowLevelSecurityApplied: z.boolean(),
    auditLoggingPresent: z.boolean(),
  }),
  overallStatus: z.enum(['APPROVED', 'NEEDS_REVISION', 'REJECTED']),
});

export type EnceladusOutput = z.infer<typeof EnceladusSchema>;

/**
 * GANYMEDE Agent: API integration
 * Output: Convex action wrappers and API client code
 */
export const GanymedeSchema = z.object({
  serviceName: z.string().describe('External service name e.g. "Stripe", "Ollama"'),
  integrationFiles: z.array(z.object({
    filePath: z.string().describe('Output file path'),
    content: z.string().describe('Full TypeScript file content'),
    description: z.string().describe('What this file does'),
  })).describe('All files to create for this integration'),
  envVarsRequired: z.array(z.object({
    name: z.string().describe('Env var name e.g. STRIPE_SECRET_KEY'),
    description: z.string(),
    required: z.boolean(),
  })).describe('Required environment variables'),
  webhooks: z.array(z.object({
    event: z.string().describe('Webhook event type'),
    handler: z.string().describe('Handler function name'),
    description: z.string(),
  })).optional().describe('Webhook events handled'),
  rateLimits: z.object({
    requestsPerMinute: z.number().optional(),
    requestsPerDay: z.number().optional(),
    strategy: z.string().describe('e.g. "exponential backoff", "token bucket"'),
  }).optional(),
});

export type GanymedeOutput = z.infer<typeof GanymedeSchema>;

/**
 * NEPTUNE Agent: Analytics queries and dashboard data
 * Output: metric definitions, aggregation queries, hooks
 */
export const NeptuneSchema = z.object({
  dashboardName: z.string(),
  metrics: z.array(z.object({
    name: z.string().describe('Metric name e.g. "daily_active_companies"'),
    definition: z.string().describe('Plain English definition'),
    calculation: z.string().describe('How it is calculated'),
    queryCode: z.string().describe('Convex query TypeScript code'),
    chartType: z.enum(['line', 'bar', 'pie', 'number', 'table', 'area']),
    refreshRate: z.enum(['realtime', 'hourly', 'daily']),
  })).describe('Metrics to display'),
  hooks: z.array(z.object({
    name: z.string().describe('React hook name e.g. "useDashboardMetrics"'),
    code: z.string().describe('Hook implementation'),
    description: z.string(),
  })).describe('React hooks for fetching dashboard data'),
  eventSchemas: z.array(z.object({
    eventName: z.string(),
    payload: z.record(z.string()).describe('Event payload fields and types'),
  })).optional().describe('Analytics events to track'),
});

export type NeptuneOutput = z.infer<typeof NeptuneSchema>;

/**
 * TITAN Agent: Real-time subscriptions and optimistic updates
 * Output: subscription hooks, optimistic patterns, presence systems
 */
export const TitanSchema = z.object({
  featureName: z.string().describe('Feature requiring real-time updates'),
  subscriptionHooks: z.array(z.object({
    name: z.string().describe('Hook name e.g. "useLiveCompany"'),
    subscribesTo: z.array(z.string()).describe('Convex query keys subscribed to'),
    code: z.string().describe('Hook implementation'),
    updateLatency: z.enum(['immediate', 'sub-second', 'seconds']),
  })).describe('Real-time subscription hooks'),
  optimisticUpdates: z.array(z.object({
    mutationName: z.string(),
    optimisticCode: z.string().describe('Optimistic update implementation with rollback'),
  })).optional().describe('Optimistic update patterns'),
  presenceFeatures: z.array(z.object({
    name: z.string().describe('Presence feature e.g. "userOnlineStatus"'),
    code: z.string(),
  })).optional().describe('User presence features'),
});

export type TitanOutput = z.infer<typeof TitanSchema>;

/**
 * MIMAS Agent: Resilience patterns
 * Output: retry logic, circuit breakers, fallback behaviors
 */
export const MimasSchema = z.object({
  targetOperation: z.string().describe('Operation being made resilient'),
  retryPolicy: z.object({
    maxAttempts: z.number().int().min(1),
    initialDelayMs: z.number(),
    backoffMultiplier: z.number().describe('e.g. 2 for exponential backoff'),
    maxDelayMs: z.number(),
    retryableErrors: z.array(z.string()).describe('Error types that trigger retry'),
  }),
  circuitBreaker: z.object({
    failureThreshold: z.number().describe('Failures before circuit opens'),
    recoveryTimeMs: z.number().describe('Time before trying again'),
    halfOpenMaxRequests: z.number().describe('Requests allowed in half-open state'),
  }).optional(),
  fallbackBehavior: z.object({
    strategy: z.enum(['cached-data', 'default-value', 'graceful-degradation', 'error-ui']),
    implementation: z.string().describe('TypeScript code for fallback'),
  }),
  code: z.string().describe('Complete resilience implementation'),
});

export type MimasOutput = z.infer<typeof MimasSchema>;

/**
 * IO Agent: Performance optimization
 * Output: performance analysis and optimization recommendations
 */
export const IoSchema = z.object({
  targetComponent: z.string().describe('Component/page being optimized'),
  baseline: z.object({
    fcp: z.number().optional().describe('First Contentful Paint (ms)'),
    lcp: z.number().optional().describe('Largest Contentful Paint (ms)'),
    bundleSize: z.number().optional().describe('Bundle size (KB)'),
    queryCount: z.number().optional().describe('Number of queries on load'),
  }).describe('Current performance metrics'),
  issues: z.array(z.object({
    type: z.enum(['render', 'bundle', 'query', 'memory', 'network', 'image']),
    severity: z.enum(['critical', 'major', 'minor']),
    description: z.string(),
    location: z.string().optional(),
    estimatedImpact: z.string().describe('e.g. "saves 200ms on LCP"'),
  })),
  optimizations: z.array(z.object({
    technique: z.string().describe('e.g. "React.memo", "code-splitting", "lazy loading"'),
    code: z.string().describe('Implementation code'),
    expectedImprovement: z.string(),
  })),
  targets: z.object({
    fcp: z.number().describe('Target FCP (ms)'),
    lcp: z.number().describe('Target LCP (ms)'),
    bundleSize: z.number().describe('Target bundle size (KB)'),
  }),
});

export type IoOutput = z.infer<typeof IoSchema>;

/**
 * TRITON Agent: DevOps and deployment
 * Output: GitHub Actions workflows, deployment configs
 */
export const TritonSchema = z.object({
  deploymentTarget: z.string().describe('e.g. "Convex production", "Vercel"'),
  workflowFiles: z.array(z.object({
    path: z.string().describe('e.g. ".github/workflows/deploy.yml"'),
    content: z.string().describe('Full workflow YAML content'),
    trigger: z.string().describe('e.g. "push to main", "PR merged"'),
  })).describe('GitHub Actions workflow files'),
  envVars: z.array(z.object({
    name: z.string(),
    scope: z.enum(['secret', 'variable']),
    description: z.string(),
    example: z.string().optional(),
  })).describe('Required environment variables and secrets'),
  deploySteps: z.array(z.object({
    name: z.string(),
    command: z.string(),
    description: z.string(),
  })).describe('Manual deployment steps if needed'),
  rollbackProcedure: z.string().describe('How to roll back a bad deployment'),
});

export type TritonOutput = z.infer<typeof TritonSchema>;

/**
 * CALLISTO Agent: Documentation generation
 * Output: README, API docs, component docs
 */
export const CallistoSchema = z.object({
  documentType: z.enum(['readme', 'api-docs', 'component-docs', 'guide', 'changelog']),
  title: z.string(),
  sections: z.array(z.object({
    heading: z.string(),
    content: z.string().describe('Markdown content for this section'),
    order: z.number().int(),
  })).describe('Document sections in order'),
  codeExamples: z.array(z.object({
    language: z.string(),
    title: z.string(),
    code: z.string(),
    description: z.string(),
  })).optional(),
  fullContent: z.string().describe('Complete document in markdown format'),
});

export type CallistoOutput = z.infer<typeof CallistoSchema>;

/**
 * CHARON Agent: Error UX and fallback screens
 * Output: error boundary components, empty states, fallback screens
 */
export const CharonSchema = z.object({
  featureName: z.string().describe('Feature whose error states are being handled'),
  errorStates: z.array(z.object({
    errorType: z.enum(['network', 'auth', 'not-found', 'validation', 'server', 'timeout', 'empty']),
    componentName: z.string(),
    userMessage: z.string().describe('User-friendly error message (no technical jargon)'),
    recoveryAction: z.object({
      label: z.string().describe('Button/link label e.g. "Try again"'),
      action: z.string().describe('What happens e.g. "refetch", "redirect to login"'),
    }).optional(),
    code: z.string().describe('React component code for this error state'),
  })).describe('All error states handled'),
  errorBoundary: z.object({
    componentName: z.string(),
    code: z.string().describe('React ErrorBoundary class component'),
  }).optional(),
  emptyStates: z.array(z.object({
    context: z.string().describe('e.g. "no companies", "no search results"'),
    headline: z.string(),
    subtext: z.string(),
    ctaLabel: z.string().optional(),
    code: z.string().describe('React component code'),
  })).describe('Empty state components'),
});

export type CharonOutput = z.infer<typeof CharonSchema>;

/**
 * URANUS Agent: R&D tool evaluation
 * Output: technology evaluation report with recommendation
 */
export const UranusSchema = z.object({
  researchQuestion: z.string().describe('What problem is being evaluated'),
  toolsEvaluated: z.array(z.object({
    name: z.string(),
    version: z.string().optional(),
    website: z.string().optional(),
    pros: z.array(z.string()),
    cons: z.array(z.string()),
    licenseType: z.string().describe('e.g. "MIT", "Apache 2.0", "commercial"'),
    weeklyDownloads: z.number().optional(),
    lastUpdated: z.string().optional(),
    compatibilityNotes: z.string().describe('Compatibility with Nova26 stack'),
    score: z.number().min(0).max(10).describe('Overall score 0-10'),
  })).min(2).describe('Tools being compared'),
  recommendation: z.object({
    tool: z.string().describe('Recommended tool name'),
    rationale: z.string().describe('Why this tool wins'),
    migrationPath: z.string().optional().describe('How to adopt it'),
    risks: z.array(z.string()),
  }),
  proofOfConcept: z.object({
    description: z.string(),
    code: z.string().describe('Working PoC code'),
  }).optional(),
});

export type UranusOutput = z.infer<typeof UranusSchema>;

/**
 * EUROPA Agent: PWA and mobile/responsive implementation
 * Output: PWA config, service worker, responsive patterns
 */
export const EuropaSchema = z.object({
  featureName: z.string(),
  pwaConfig: z.object({
    manifestJson: z.string().describe('Web app manifest JSON'),
    serviceWorkerCode: z.string().describe('Service worker implementation'),
    cacheStrategy: z.enum(['cache-first', 'network-first', 'stale-while-revalidate']),
    offlinePages: z.array(z.string()).describe('Routes that work offline'),
  }).optional().describe('PWA configuration if applicable'),
  responsivePatterns: z.array(z.object({
    component: z.string(),
    breakpoints: z.object({
      mobile: z.string().describe('Tailwind classes for mobile'),
      tablet: z.string().describe('Tailwind classes for tablet'),
      desktop: z.string().describe('Tailwind classes for desktop'),
    }),
    code: z.string().describe('Responsive component code'),
  })).describe('Responsive design implementations'),
  touchInteractions: z.array(z.object({
    gesture: z.enum(['tap', 'swipe', 'pinch', 'long-press']),
    handler: z.string().describe('Event handler code'),
  })).optional(),
  accessibilityChecks: z.array(z.object({
    criterion: z.string().describe('WCAG criterion e.g. "2.1.1 Keyboard"'),
    passed: z.boolean(),
    notes: z.string().optional(),
  })),
});

export type EuropaOutput = z.infer<typeof EuropaSchema>;

/**
 * ANDROMEDA Agent: Opportunity research and ideation
 * Output: opportunity report with market analysis and recommendations
 */
export const AndromedaSchema = z.object({
  opportunityTitle: z.string(),
  problemStatement: z.string().describe('The problem or gap identified'),
  marketContext: z.object({
    targetUsers: z.array(z.string()).describe('Who benefits'),
    estimatedMarketSize: z.string().describe('e.g. "10k developers"'),
    existingSolutions: z.array(z.object({
      name: z.string(),
      weakness: z.string().describe('Why ours would be better'),
    })),
  }),
  opportunities: z.array(z.object({
    title: z.string(),
    description: z.string(),
    effort: z.enum(['low', 'medium', 'high']),
    impact: z.enum(['low', 'medium', 'high']),
    priority: z.number().int().min(1).describe('Ranking: 1 = highest priority'),
  })).describe('Identified opportunities ranked by priority'),
  recommendation: z.object({
    topOpportunity: z.string(),
    rationale: z.string(),
    nextSteps: z.array(z.string()).describe('Concrete first actions to take'),
    risksToMonitor: z.array(z.string()),
  }),
});

export type AndromedaOutput = z.infer<typeof AndromedaSchema>;

/**
 * ATLAS Agent: Build retrospective and learnings
 * Output: retrospective with patterns, insights, and improvement actions
 */
export const AtlasSchema = z.object({
  buildId: z.string(),
  buildName: z.string(),
  retrospective: z.object({
    whatWorked: z.array(z.string()),
    whatFailed: z.array(z.string()),
    surprises: z.array(z.string()),
    timeSpent: z.string().describe('e.g. "2h 15m"'),
  }),
  patterns: z.array(z.object({
    name: z.string().describe('Pattern name'),
    description: z.string(),
    code: z.string().optional(),
    successRate: z.number().min(0).max(100).describe('How often this pattern succeeds'),
    applicableAgents: z.array(z.string()),
  })).describe('Reusable patterns extracted from this build'),
  learnings: z.array(z.object({
    insight: z.string(),
    category: z.enum(['prompt', 'gate', 'dependency', 'agent', 'architecture']),
    actionItem: z.string().describe('What to change next time'),
  })),
  agentPerformance: z.array(z.object({
    agent: z.string(),
    tasksCompleted: z.number(),
    tasksFailed: z.number(),
    avgAttempts: z.number(),
    notes: z.string().optional(),
  })),
});

export type AtlasOutput = z.infer<typeof AtlasSchema>;

/**
 * Map of agent names to their Zod schemas
 */
export const AgentSchemas: Record<string, z.ZodType<unknown>> = {
  // Original 6
  EARTH: EarthSchema,
  PLUTO: PlutoSchema,
  MERCURY: MercurySchema,
  JUPITER: JupiterSchema,
  VENUS: VenusSchema,
  MARS: MarsSchema,
  // Added 15
  SUN: SunSchema,
  SATURN: SaturnSchema,
  ENCELADUS: EnceladusSchema,
  GANYMEDE: GanymedeSchema,
  NEPTUNE: NeptuneSchema,
  TITAN: TitanSchema,
  MIMAS: MimasSchema,
  IO: IoSchema,
  TRITON: TritonSchema,
  CALLISTO: CallistoSchema,
  CHARON: CharonSchema,
  URANUS: UranusSchema,
  EUROPA: EuropaSchema,
  ANDROMEDA: AndromedaSchema,
  ATLAS: AtlasSchema,
};

/**
 * Check if an agent has a defined schema
 */
export function hasAgentSchema(agentName: string): boolean {
  return agentName in AgentSchemas;
}

/**
 * Get the schema for a specific agent
 */
export function getAgentSchema<T>(agentName: string): z.ZodType<T> | undefined {
  return AgentSchemas[agentName] as z.ZodType<T> | undefined;
}

/**
 * Extract JSON from LLM response content
 */
function extractJSON(content: string): string {
  // Try to find JSON in the response
  const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
  if (jsonMatch) {
    return jsonMatch[1].trim();
  }
  
  // Try to find any JSON object
  const objMatch = content.match(/\{[\s\S]*\}/);
  if (objMatch) {
    return objMatch[0];
  }
  
  return content;
}

/**
 * Call LLM with structured output validation
 * Uses prompt engineering to request JSON that matches the Zod schema
 * Falls back to unstructured if validation fails
 * 
 * @param systemPrompt - System prompt
 * @param userPrompt - User prompt
 * @param schema - Zod schema to validate against
 * @param agentName - Optional agent name for model selection
 * @returns Promise with content and parsed data
 */
export async function callLLMStructured<T>(
  systemPrompt: string,
  userPrompt: string,
  schema: z.ZodType<T>,
  agentName?: string
): Promise<StructuredLLMResponse<T>> {
  const startTime = Date.now();
  
  // Create a modified prompt that requests JSON output
  const schemaDescription = schema.description 
    ? `\n\nResponse must match this schema: ${schema.description}`
    : '';
  
  const structuredUserPrompt = `${userPrompt}${schemaDescription}

IMPORTANT: Respond ONLY with valid JSON that matches the schema. Do not include any other text or explanations.`;

  try {
    // Call LLM with JSON request
    const response = await callLLM(systemPrompt, structuredUserPrompt, agentName);
    
    // Extract and parse JSON from response
    const jsonStr = extractJSON(response.content);
    const parsed = JSON.parse(jsonStr) as T;
    
    // Validate against schema
    const result = schema.safeParse(parsed);
    if (!result.success) {
      console.warn(`Schema validation failed: ${result.error.message}, returning raw response`);
      return {
        content: response.content,
        parsed,
        model: response.model,
        duration: Date.now() - startTime,
        tokens: response.tokens,
      };
    }
    
    return {
      content: JSON.stringify(parsed, null, 2),
      parsed,
      model: response.model,
      duration: Date.now() - startTime,
      tokens: response.tokens,
    };
  } catch (error: any) {
    // If structured output fails, fall back to regular call
    console.warn(`Structured output failed for ${agentName}: ${error.message}, falling back to unstructured`);
    
    // Fall back to regular Ollama call
    const response = await callLLM(systemPrompt, userPrompt, agentName);
    
    // Try to parse as JSON for the parsed field
    let parsed: T;
    try {
      const jsonStr = extractJSON(response.content);
      parsed = JSON.parse(jsonStr) as T;
    } catch {
      // If not valid JSON, wrap the content
      parsed = { content: response.content } as unknown as T;
    }
    
    return {
      content: response.content,
      parsed,
      model: response.model,
      duration: Date.now() - startTime,
      tokens: response.tokens,
    };
  }
}

/**
 * Call LLM with optional structured output
 * Uses schema if available for the agent, otherwise falls back to unstructured
 * 
 * @param systemPrompt - System prompt
 * @param userPrompt - User prompt  
 * @param agentName - Agent name for schema lookup
 * @returns Promise with LLM response
 */
export async function callLLMWithSchema(
  systemPrompt: string,
  userPrompt: string,
  agentName?: string
): Promise<LLMResponse> {
  if (!agentName || !hasAgentSchema(agentName)) {
    // No schema for this agent, use regular call
    return callLLM(systemPrompt, userPrompt, agentName);
  }
  
  // Get the schema and use structured output
  const schema = getAgentSchema(agentName)!;
  const response = await callLLMStructured(systemPrompt, userPrompt, schema, agentName);
  
  return {
    content: response.content,
    model: response.model,
    duration: response.duration,
    tokens: response.tokens,
  };
}
