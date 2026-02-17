/**
 * REAL Integration Test for Nova26 Orchestrator
 *
 * Unlike mock-run.ts (which iterates JSON directly), this test
 * calls the actual ralphLoop() with a mock LLM injected.
 *
 * What gets exercised:
 * - pickNextTask() dependency resolution
 * - promotePendingTasks() state transitions
 * - buildPrompt() with dependency context injection
 * - runGates() response + mercury validation
 * - saveTaskOutput() file writing
 * - Ralph Loop iteration, retry, and completion logic
 *
 * Usage: npx tsx src/test/integration-test.ts
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { ralphLoop } from '../orchestrator/ralph-loop.js';
import type { PRD, LLMResponse, LLMCaller } from '../types/index.js';


// ── Test Configuration ──────────────────────────────────────────────

const TEST_DIR = join(process.cwd(), '.nova', 'test-run');
const TEST_PRD_PATH = join(TEST_DIR, 'prd-integration.json');
const OUTPUT_DIR = join(process.cwd(), '.nova', 'output');

let callCount = 0;
let promptsReceived: { system: string; user: string; agent?: string }[] = [];


// ── Mock LLM ────────────────────────────────────────────────────────

const mockCallLLM: LLMCaller = async (
  systemPrompt: string,
  userPrompt: string,
  agentName?: string
): Promise<LLMResponse> => {
  callCount++;

  // Record what was sent so we can verify dependency context injection
  promptsReceived.push({ system: systemPrompt, user: userPrompt, agent: agentName });


  // Return agent-specific responses that pass the gate keyword checks
  const responses: Record<string, string> = {
    EARTH: `# Product Spec: Company Entity

## Fields

- **name**: string, unique identifier for the company, 3-50 characters
- **status**: enum (active/suspended/bankrupt), defaults to active

## Constraints

- Name must be unique across all companies
- Status transitions: active → suspended → bankrupt (no reverse)

## Validation Rules

- Name: required, trimmed, no special characters except hyphens
- Status: must be one of the three valid values

## Edge Cases

- Company with no divisions yet (empty state)
- Company suspension during active tasks (graceful shutdown)
`,
    PLUTO: `# Convex Schema: Companies Table

\`\`\`typescript
companies: defineTable({
  name: v.string(),
  status: v.union(v.literal("active"), v.literal("suspended"), v.literal("bankrupt")),
  createdAt: v.string(),
}).index("by_status", ["status"])
\`\`\`

## Schema Notes

- Root entity — no companyId field needed
- Index on status enables filtered dashboard queries
`,
    MERCURY: `# Validation Report

**PASS**: All fields from the spec exist in the schema.

## Checks Performed

1. ✓ name field: spec says string 3-50 chars → schema has v.string() (length validation at mutation level)
2. ✓ status field: spec says active/suspended/bankrupt → schema uses v.union with correct literals
3. ✓ createdAt field: present in schema as v.string()
4. ✓ Indexes: by_status index supports dashboard filtering


## Result: PASS — spec and schema are consistent.
`,
  };

  const content = responses[agentName || ''] || 'Generic response for unknown agent with enough content to pass validation gates.';

  return {
    content,
    model: 'mock-model',
    duration: 50,
    tokens: content.split(/\s+/).length,
  };
};


// ── Test PRD ────────────────────────────────────────────────────────

function createTestPRD(): PRD {
  return {
    meta: {
      name: 'Integration Test PRD',
      version: '1.0.0',
      createdAt: new Date().toISOString(),
    },
    tasks: [
      {
        id: 'int-001',
        title: 'Define company data model',
        description: 'Write a product spec for the Company entity with fields, constraints, and validation rules.',
        agent: 'EARTH',
        status: 'ready',
        dependencies: [],
        phase: 0,
        attempts: 0,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'int-002',
        title: 'Design company schema',
        description: 'Based on the spec from int-001, write the Convex defineTable with schema and index definitions.',
        agent: 'PLUTO',
        status: 'pending',
        dependencies: ['int-001'],
        phase: 1,
        attempts: 0,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'int-003',
        title: 'Validate spec vs schema',
        description: 'Compare the spec from int-001 against the schema from int-002. Return PASS or FAIL.',
        agent: 'MERCURY',
        status: 'pending',
        dependencies: ['int-001', 'int-002'],
        phase: 2,
        attempts: 0,
        createdAt: new Date().toISOString(),
      },
    ],
  };
}


// ── Assertions ──────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string, detail?: string): void {
  if (condition) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.log(`  ✗ ${name}${detail ? ': ' + detail : ''}`);
    failed++;
  }
}


// ── Cleanup ─────────────────────────────────────────────────────────

function cleanup(): void {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true });
  }
  for (const id of ['int-001', 'int-002', 'int-003']) {
    const outputPath = join(OUTPUT_DIR, `${id}.md`);
    if (existsSync(outputPath)) {
      rmSync(outputPath);
    }
  }
}


// ── Main Test ───────────────────────────────────────────────────────

async function runTest(): Promise<void> {
  console.log('\n=== Nova26 Integration Test ===\n');

  cleanup();
  if (!existsSync(TEST_DIR)) mkdirSync(TEST_DIR, { recursive: true });
  if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });

  const prd = createTestPRD();
  writeFileSync(TEST_PRD_PATH, JSON.stringify(prd, null, 2));

  callCount = 0;
  promptsReceived = [];

  console.log('Running ralphLoop with mock LLM...\n');
  await ralphLoop(prd, TEST_PRD_PATH, mockCallLLM);

  const finalPRD: PRD = JSON.parse(readFileSync(TEST_PRD_PATH, 'utf-8'));

  console.log('\n--- Assertions ---\n');

  console.log('Task completion:');
  for (const task of finalPRD.tasks) {
    assert(task.status === 'done', `${task.id} status is "done"`, `got "${task.status}"`);
  }


  console.log('\nLLM calls:');
  assert(callCount === 3, `LLM called 3 times`, `called ${callCount} times`);

  console.log('\nExecution order:');
  assert(promptsReceived.length >= 3, '3+ prompts recorded');
  if (promptsReceived.length >= 3) {
    assert(promptsReceived[0].agent === 'EARTH', 'First call was EARTH', promptsReceived[0].agent);
    assert(promptsReceived[1].agent === 'PLUTO', 'Second call was PLUTO', promptsReceived[1].agent);
    assert(promptsReceived[2].agent === 'MERCURY', 'Third call was MERCURY', promptsReceived[2].agent);
  }

  console.log('\nDependency context injection:');
  if (promptsReceived.length >= 2) {
    const plutoPrompt = promptsReceived[1].user;
    assert(plutoPrompt.includes('int-001'), 'PLUTO prompt includes dependency task ID "int-001"');
    assert(
      plutoPrompt.includes('Product Spec') || plutoPrompt.includes('Company Entity') || plutoPrompt.includes('spec'),
      'PLUTO prompt includes content from EARTH\'s output'
    );
  }

  if (promptsReceived.length >= 3) {
    const mercuryPrompt = promptsReceived[2].user;
    assert(
      mercuryPrompt.includes('int-001') && mercuryPrompt.includes('int-002'),
      'MERCURY prompt includes both dependency task IDs'
    );
  }

  console.log('\nOutput files:');
  for (const id of ['int-001', 'int-002', 'int-003']) {
    const outputPath = join(OUTPUT_DIR, `${id}.md`);
    assert(existsSync(outputPath), `${id}.md exists in .nova/output/`);
    if (existsSync(outputPath)) {
      const content = readFileSync(outputPath, 'utf-8');
      assert(content.includes('Task ID:'), `${id}.md has structured header`);
      assert(content.length > 100, `${id}.md has substantial content`, `${content.length} chars`);
    }
  }

  console.log('\nPRD output paths:');
  for (const task of finalPRD.tasks) {
    assert(
      task.output !== undefined && task.output.length > 0,
      `${task.id} has output path recorded`,
      task.output || 'undefined'
    );
  }

  console.log('\nState transitions:');
  assert(finalPRD.tasks.find(t => t.id === 'int-002')?.status === 'done', 'int-002 (started as pending) reached done state');
  assert(finalPRD.tasks.find(t => t.id === 'int-003')?.status === 'done', 'int-003 (started as pending, 2 deps) reached done state');

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);

  cleanup();

  if (failed > 0) {
    process.exit(1);
  }
}

runTest().catch((error) => {
  console.error('\nTest crashed:', error);
  cleanup();
  process.exit(1);
});
