/**
 * instructor-js Integration for Nova26
 * Provides structured output validation with Zod schemas
 */

import OpenAI from 'openai';
import { z } from 'zod';
import Instructor from '@instructor-ai/instructor';

// Ollama-compatible OpenAI client
const ollamaClient = new OpenAI({
  baseURL: 'http://localhost:11434/v1',
  apiKey: 'ollama', // required but ignored by Ollama
});

// Create instructor client
const instructorClient = Instructor({
  client: ollamaClient,
  mode: 'JSON',
});

// ============================================================================
// Agent Output Schemas
// ============================================================================

export const VenusOutputSchema = z.object({
  component: z.string().describe('The React component code'),
  styles: z.string().describe('Tailwind CSS classes used'),
  props: z.array(z.object({
    name: z.string(),
    type: z.string(),
    required: z.boolean(),
  })).describe('Component props'),
  uiStates: z.array(z.enum(['loading', 'empty', 'error', 'success', 'default'])),
  accessibility: z.object({
    ariaLabels: z.boolean(),
    keyboardNav: z.boolean(),
    semanticHtml: z.boolean(),
  }),
  confidence: z.number().min(0).max(1),
});

export const MarsOutputSchema = z.object({
  code: z.string().describe('The TypeScript code'),
  types: z.array(z.object({
    name: z.string(),
    definition: z.string(),
  })),
  exports: z.array(z.string()),
  hasAnyTypes: z.boolean(),
  testCases: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

export const PlutoOutputSchema = z.object({
  schema: z.string().describe('Convex schema definition'),
  indexes: z.array(z.object({
    name: z.string(),
    fields: z.array(z.string()),
  })),
  tables: z.array(z.object({
    name: z.string(),
    fields: z.array(z.object({
      name: z.string(),
      type: z.string(),
      required: z.boolean(),
    })),
  })),
  confidence: z.number().min(0).max(1),
});

export const SunOutputSchema = z.object({
  prd: z.string().describe('The PRD document'),
  agentChain: z.array(z.enum([
    'SUN', 'EARTH', 'PLUTO', 'MARS', 'VENUS', 'GANYMEDE', 'TITAN',
    'SATURN', 'MERCURY', 'URANUS', 'ANDROMEDA', 'CALLISTO', 'ATLAS',
    'CHARON', 'ENCELADUS', 'EUROPA', 'IO', 'JUPITER', 'MIMAS', 'NEPTUNE', 'TRITON'
  ])),
  estimatedComplexity: z.enum(['quick', 'standard', 'complex', 'research']),
  estimatedCost: z.number(),
  confidence: z.number().min(0).max(1),
});

export const EarthOutputSchema = z.object({
  userStories: z.array(z.object({
    role: z.string(),
    goal: z.string(),
    benefit: z.string(),
  })),
  acceptanceCriteria: z.array(z.object({
    given: z.string(),
    when: z.string(),
    then: z.string(),
  })),
  constraints: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

// ============================================================================
// Type exports
// ============================================================================

export type VenusOutput = z.infer<typeof VenusOutputSchema>;
export type MarsOutput = z.infer<typeof MarsOutputSchema>;
export type PlutoOutput = z.infer<typeof PlutoOutputSchema>;
export type SunOutput = z.infer<typeof SunOutputSchema>;
export type EarthOutput = z.infer<typeof EarthOutputSchema>;

// ============================================================================
// Agent Output Functions
// ============================================================================

interface GenerateOptions {
  model?: string;
  temperature?: number;
  maxRetries?: number;
}

export async function generateVenusOutput(
  prompt: string,
  options: GenerateOptions = {}
): Promise<VenusOutput> {
  const response = await instructorClient.chat.completions.create({
    model: options.model || 'qwen2.5:7b',
    messages: [
      {
        role: 'system',
        content: `You are VENUS, the UI/UX specialist for Nova26.
Create React components with TypeScript and Tailwind CSS.
Always include all 5 UI states: loading, empty, error, success, default.
Never use 'any' types or inline styles.`
      },
      { role: 'user', content: prompt }
    ],
    response_model: { schema: VenusOutputSchema, name: 'VenusOutput' },
    max_retries: options.maxRetries || 3,
    temperature: options.temperature || 0.7,
  });

  return response as VenusOutput;
}

export async function generateMarsOutput(
  prompt: string,
  options: GenerateOptions = {}
): Promise<MarsOutput> {
  const response = await instructorClient.chat.completions.create({
    model: options.model || 'qwen2.5:7b',
    messages: [
      {
        role: 'system',
        content: `You are MARS, the TypeScript specialist for Nova26.
Write strict TypeScript with zero 'any' types.
Always specify return types on exported functions.
Include comprehensive type definitions.`
      },
      { role: 'user', content: prompt }
    ],
    response_model: { schema: MarsOutputSchema, name: 'MarsOutput' },
    max_retries: options.maxRetries || 3,
    temperature: options.temperature || 0.3, // Lower temp for code
  });

  return response as MarsOutput;
}

export async function generatePlutoOutput(
  prompt: string,
  options: GenerateOptions = {}
): Promise<PlutoOutput> {
  const response = await instructorClient.chat.completions.create({
    model: options.model || 'qwen2.5:7b',
    messages: [
      {
        role: 'system',
        content: `You are PLUTO, the database architect for Nova26.
Design Convex schemas with proper indexing.
Use camelCase for all field names.
Always include createdAt, updatedAt, and isDeleted fields.`
      },
      { role: 'user', content: prompt }
    ],
    response_model: { schema: PlutoOutputSchema, name: 'PlutoOutput' },
    max_retries: options.maxRetries || 3,
    temperature: options.temperature || 0.2, // Very low for schema
  });

  return response as PlutoOutput;
}

export async function generateSunOutput(
  prompt: string,
  options: GenerateOptions = {}
): Promise<SunOutput> {
  const response = await instructorClient.chat.completions.create({
    model: options.model || 'qwen2.5:7b',
    messages: [
      {
        role: 'system',
        content: `You are SUN, the orchestrator for Nova26.
Create comprehensive PRDs with proper agent chains.
Estimate complexity and costs accurately.
Include clear task breakdowns.`
      },
      { role: 'user', content: prompt }
    ],
    response_model: { schema: SunOutputSchema, name: 'SunOutput' },
    max_retries: options.maxRetries || 3,
    temperature: options.temperature || 0.7,
  });

  return response as SunOutput;
}

export async function generateEarthOutput(
  prompt: string,
  options: GenerateOptions = {}
): Promise<EarthOutput> {
  const response = await instructorClient.chat.completions.create({
    model: options.model || 'qwen2.5:7b',
    messages: [
      {
        role: 'system',
        content: `You are EARTH, the requirements specialist for Nova26.
Write clear user stories and acceptance criteria.
Use Gherkin format (Given/When/Then) for acceptance criteria.
Identify all constraints and edge cases.`
      },
      { role: 'user', content: prompt }
    ],
    response_model: { schema: EarthOutputSchema, name: 'EarthOutput' },
    max_retries: options.maxRetries || 3,
    temperature: options.temperature || 0.5,
  });

  return response as EarthOutput;
}

// ============================================================================
// Validation Helper
// ============================================================================

export async function validateAgentOutput<T>(
  schema: z.ZodSchema<T>,
  output: unknown,
  maxRetries: number = 3
): Promise<{ valid: boolean; data?: T; errors?: z.ZodError }> {
  const result = schema.safeParse(output);
  
  if (result.success) {
    return { valid: true, data: result.data };
  }
  
  return { valid: false, errors: result.error };
}

// ============================================================================
// Usage Example
// ============================================================================

/*
import { generateVenusOutput, generateMarsOutput } from './structured-output';

// Generate structured VENUS output
const venusResult = await generateVenusOutput(`
  Create a LoginForm component with email and password fields.
  Include loading state, error handling, and success message.
`);

console.log(venusResult.component); // Validated React code
console.log(venusResult.uiStates); // ['loading', 'error', 'success', 'default', 'empty']
console.log(venusResult.confidence); // 0.95

// Generate structured MARS output
const marsResult = await generateMarsOutput(`
  Create a function to validate user permissions.
`);

console.log(marsResult.code); // Validated TypeScript
console.log(marsResult.hasAnyTypes); // false (enforced by schema)
*/
