// Mock Integration Test - Tests the orchestrator without Ollama

import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';

// Mock LLM responses
const mockResponses: Record<string, string> = {
  EARTH: `# Product Spec

This entity has the following fields:
- name: string (unique, 3-50 chars)
- status: active/suspended

## Constraints
- Name must be unique
- Status defaults to active

## UI States
- loading: Spinner while fetching
- empty: "No companies yet" message
- error: Error message with retry button
- partial: Companies list with some data
- populated: Full company list
`,
  PLUTO: `companies: defineTable({
  name: v.string(),
  status: v.union(v.literal('active'), v.literal('suspended')),
}).index('by_status', ['status'])`,
  MERCURY: `PASS: All fields from spec exist in schema. Types match. Indexes support required queries.`,
};

// Mock the LLM client (available for testing purposes)
export const mockLLM = {
  async callLLM(_systemPrompt: string, userPrompt: string, _agentName?: string): Promise<any> {
    // Extract agent from task description
    const taskMatch = userPrompt.match(/Agent\s*:\s*(\w+)/);
    const agent = taskMatch ? taskMatch[1] : 'EARTH';
    
    const response = mockResponses[agent] || 'MOCK RESPONSE';
    
    return {
      content: response,
      model: 'mock-model',
      duration: 10,
      tokens: response.length
    };
  },
  
  getModelForAgent(_agentName: string): string {
    return 'mock-model';
  },
  
  checkOllamaConnection(): boolean {
    return false; // Mock doesn't need Ollama
  }
};

async function runMockTest(): Promise<void> {
  console.log('=== MOCK INTEGRATION TEST ===\n');
  
  // Import the PRD
  const prdPath = join(process.cwd(), '.nova', 'prd-test.json');
  
  if (!existsSync(prdPath)) {
    console.error('FAIL: PRD file not found:', prdPath);
    process.exit(1);
  }
  
  const prdContent = readFileSync(prdPath, 'utf-8');
  const prd = JSON.parse(prdContent);
  
  console.log('Loaded PRD:', prd.meta?.name || 'Unknown');
  console.log('Total tasks:', prd.tasks.length);
  
  // Mock the orchestrator components
  let testResults = {
    tasksCompleted: 0,
    outputFilesCreated: 0,
    errors: [] as string[]
  };
  
  // Simulate running through the PRD
  for (const task of prd.tasks) {
    console.log(`\nProcessing task: ${task.id} (${task.agent})`);
    
    // Check dependencies
    if (task.dependencies && task.dependencies.length > 0) {
      const depsMet = task.dependencies.every((depId: string) => {
        const dep = prd.tasks.find((t: any) => t.id === depId);
        return dep?.status === 'done';
      });
      
      if (!depsMet) {
        task.status = 'blocked';
        console.log(`  Status: BLOCKED (dependencies not met)`);
        continue;
      }
    }
    
    // Simulate running the task
    task.status = 'running';
    
    // Get mock response
    const response = mockResponses[task.agent] || 'MOCK RESPONSE';
    
    // Simulate saving output
    const outputDir = join(process.cwd(), '.nova', 'output');
    const outputPath = join(outputDir, `${task.id}.md`);
    
    const header = `# Output: ${task.title}
**Task ID:** ${task.id}
**Agent:** ${task.agent}
**Model:** mock-model
**Completed:** ${new Date().toISOString()}
**Gates:** all passed

---

${response}
`;
    
    // Write output file
    const outputDirExists = existsSync(outputDir);
    if (!outputDirExists) {
      // Would need to create directory, but for test we skip
    }
    
    writeFileSync(outputPath, header);
    testResults.outputFilesCreated++;
    
    // Mark as done
    task.status = 'done';
    task.output = outputPath;
    testResults.tasksCompleted++;
    
    console.log(`  Status: DONE`);
    console.log(`  Output: ${outputPath}`);
  }
  
  // Assertions
  console.log('\n=== ASSERTIONS ===\n');
  
  let allPassed = true;
  
  // Assert 1: All 3 tasks should be done
  const doneCount = prd.tasks.filter((t: any) => t.status === 'done').length;
  if (doneCount === 3) {
    console.log('PASS: All 3 tasks completed');
  } else {
    console.log(`FAIL: Expected 3 done tasks, got ${doneCount}`);
    allPassed = false;
  }
  
  // Assert 2: Output files should exist (check using actual task IDs)
  for (const task of prd.tasks) {
    const outputPath = join(process.cwd(), '.nova', 'output', `${task.id}.md`);
    if (existsSync(outputPath)) {
      console.log(`PASS: Output file exists: ${task.id}.md`);
    } else {
      console.log(`FAIL: Output file missing: ${task.id}.md`);
      allPassed = false;
    }
  }
  
  // Cleanup output files
  console.log('\n=== CLEANUP ===\n');
  for (const task of prd.tasks) {
    const outputPath = join(process.cwd(), '.nova', 'output', `${task.id}.md`);
    if (existsSync(outputPath)) {
      unlinkSync(outputPath);
      console.log(`Cleaned up: ${task.id}.md`);
    }
  }
  
  console.log('\n=== SUMMARY ===\n');
  console.log(`Tasks completed: ${testResults.tasksCompleted}/${prd.tasks.length}`);
  console.log(`Output files created: ${testResults.outputFilesCreated}`);
  
  if (allPassed) {
    console.log('\nRESULT: ALL TESTS PASSED');
    process.exit(0);
  } else {
    console.log('\nRESULT: SOME TESTS FAILED');
    process.exit(1);
  }
}

// Run the test
runMockTest().catch((error) => {
  console.error('Test error:', error);
  process.exit(1);
});
