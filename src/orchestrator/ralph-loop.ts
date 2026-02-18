// Ralph Loop - Core execution loop

import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { pickNextTask, updateTaskStatus, savePRD, setTaskOutput } from './task-picker.js';
import { buildPrompt, buildRetryPrompt } from './prompt-builder.js';
import { runGates, allGatesPassed, getGatesSummary } from './gate-runner.js';
import { runCouncilVote, requiresCouncilApproval } from './council-runner.js';
import { callLLM } from '../llm/ollama-client.js';
import { KronosAtlas, KronosRetrospective } from '../atlas/index.js';
import type { LogBuildOptions } from '../atlas/index.js';
import type { PRD, Task, LLMResponse, BuildLog } from '../types/index.js';

// Singleton instances — reused across all loop iterations
const atlas = new KronosAtlas();
const retrospective = new KronosRetrospective();

export async function ralphLoop(prd: PRD, prdPath: string): Promise<void> {
  console.log('Starting Ralph Loop...');
  
  let maxIterations = prd.tasks.length * 3; // Prevent infinite loops
  let iteration = 0;
  
  while (iteration < maxIterations) {
    iteration++;
    
    // Pick next task
    const task = pickNextTask(prd);
    
    if (!task) {
      console.log('\nNo more ready tasks. Checking status...');
      
      // Check if all tasks are done
      const allDone = prd.tasks.every(t => t.status === 'done');
      const anyFailed = prd.tasks.some(t => t.status === 'failed');
      const anyRunning = prd.tasks.some(t => t.status === 'running');
      
      if (allDone) {
        console.log('\n=== All tasks completed successfully! ===');
        break;
      }
      
      if (anyFailed) {
        console.log('\n=== Some tasks failed ===');
        break;
      }
      
      if (anyRunning) {
        console.log('\nTasks still running...');
        await sleep(2000);
        continue;
      }
      
      // Check for blocked tasks
      const blocked = prd.tasks.filter(t => t.status === 'pending').filter(t => {
        return !t.dependencies.every(depId => {
          const dep = prd.tasks.find(d => d.id === depId);
          return dep?.status === 'done';
        });
      });
      
      if (blocked.length > 0) {
        console.log(`\n=== ${blocked.length} tasks blocked by dependencies ===`);
        for (const t of blocked) {
          const deps = t.dependencies.map(depId => {
            const dep = prd.tasks.find(d => d.id === depId);
            return `${depId} (${dep?.status})`;
          }).join(', ');
          console.log(`  - ${t.id}: waiting on ${deps}`);
        }
        break;
      }
      
      console.log('\n=== No more tasks to process ===');
      break;
    }
    
    console.log(`\n--- Processing: ${task.id} (${task.title}) [Phase ${task.phase}] ---`);
    
    // Mark as running
    updateTaskStatus(prd, task.id, 'running');
    savePRD(prd, prdPath);
    
    try {
      // Build prompt
      const { systemPrompt, userPrompt } = await buildPrompt(task, prd);
      
      // Call LLM
      let response: LLMResponse;
      
      try {
        response = await callLLM(systemPrompt, userPrompt, task.agent);
      } catch (llmError: any) {
        // If first attempt fails, don't retry
        console.log(`LLM call failed: ${llmError.message}`);
        
        // Mark as failed
        updateTaskStatus(prd, task.id, 'failed', llmError.message);
        savePRD(prd, prdPath);
        continue;
      }
      
      console.log(`LLM response: ${response.content.substring(0, 100)}...`);
      
      // Run gates
      const gateResults = await runGates(task, response);
      console.log(getGatesSummary(gateResults));
      
      if (!allGatesPassed(gateResults)) {
        // Gates failed - retry once
        if (task.attempts < 2) {
          console.log(`Gates failed, retrying... (attempt ${task.attempts + 1})`);
          
          const retryPrompt = buildRetryPrompt(task, getGatesSummary(gateResults), response.content);
          
          try {
            response = await callLLM(systemPrompt, retryPrompt, task.agent);
          } catch {
            // Retry failed too
            const failedMessage = `Gates failed after retry: ${getGatesSummary(gateResults)}`;
            updateTaskStatus(prd, task.id, 'failed', failedMessage);
            savePRD(prd, prdPath);
            continue;
          }
          
          const retryGateResults = await runGates(task, response);
          console.log(getGatesSummary(retryGateResults));
          
          if (!allGatesPassed(retryGateResults)) {
            const failedMessage = `Gates failed after retry: ${getGatesSummary(retryGateResults)}`;
            updateTaskStatus(prd, task.id, 'failed', failedMessage);
            savePRD(prd, prdPath);
            continue;
          }
        } else {
          const failedMessage = `Gates failed: ${getGatesSummary(gateResults)}`;
          updateTaskStatus(prd, task.id, 'failed', failedMessage);
          savePRD(prd, prdPath);
          continue;
        }
      }
      
      // Gates passed - optionally run council approval for critical tasks
      if (requiresCouncilApproval(task)) {
        console.log('\n🏛️ Task requires Council approval...');
        
        const councilDecision = await runCouncilVote(task, response.content);
        
        if (councilDecision.finalVerdict === 'rejected') {
          console.log(`Council rejected: ${councilDecision.summary}`);
          updateTaskStatus(prd, task.id, 'failed', `Council rejected: ${councilDecision.summary}`);
          savePRD(prd, prdPath);
          continue;
        }
        
        if (councilDecision.finalVerdict === 'pending') {
          console.log(`Council split - proceeding anyway: ${councilDecision.summary}`);
        }
      }
      
      // Triple-write: local builds.json + Kronos + Convex cloud (best-effort)
      const projectName = prd.meta?.name || 'nova26';
      const buildLog: BuildLog = {
        id: `${task.id}-${Date.now()}`,
        taskId: task.id,
        agent: task.agent,
        model: response.model,
        prompt: '',
        response: response.content,
        gatesPassed: true,
        duration: response.duration,
        timestamp: new Date().toISOString(),
      };
      const convexOptions: LogBuildOptions = {
        prdId: prdPath,
        prdName: projectName,
        taskTitle: task.title,
        phase: task.phase,
      };
      await atlas.logBuild(buildLog, projectName, task.phase, convexOptions);

      // Save output
      const outputPath = await saveTaskOutput(task, response);
      setTaskOutput(prd, task.id, outputPath);
      
      // Mark as done
      updateTaskStatus(prd, task.id, 'done');
      savePRD(prd, prdPath);
      
      console.log(`Task ${task.id} completed successfully.`);
      
    } catch (error: any) {
      console.error(`Error processing task ${task.id}:`, error.message);
      updateTaskStatus(prd, task.id, 'failed', error.message);
      savePRD(prd, prdPath);
    }
  }
  
  // Mark build completion in Convex cloud (best-effort)
  try {
    const allDone = prd.tasks.every(t => t.status === 'done');
    const finalStatus = allDone ? 'completed' as const : 'failed' as const;
    const failedTasks = prd.tasks.filter(t => t.status === 'failed').map(t => t.id);
    const errorMsg = failedTasks.length > 0 ? `Failed tasks: ${failedTasks.join(', ')}` : undefined;
    await atlas.completeBuild(prdPath, finalStatus, errorMsg);
  } catch {
    // Convex completion is optional — never block loop
  }

  // Phase 3: ATLAS retrospective after loop completes (best-effort)
  try {
    const projectName = prd.meta?.name || 'nova26';
    const retro = await retrospective.generateRetrospective(projectName);
    if (retro.totalBuilds > 0) {
      console.log(`\n[ATLAS] Retrospective: ${retro.totalBuilds} builds analyzed`);
      console.log(`[ATLAS] Agents: ${retro.agentStats.map(s => `${s.agent}(${(s.successRate * 100).toFixed(0)}%)`).join(', ')}`);
      for (const rec of retro.recommendations) {
        console.log(`[ATLAS] Recommendation: ${rec}`);
      }
    }
  } catch {
    // Retrospective is optional — never block loop completion
  }

  console.log('\n=== Ralph Loop finished ===');
}

async function saveTaskOutput(task: Task, response: LLMResponse): Promise<string> {
  const outputDir = join(process.cwd(), '.nova', 'output');
  
  // Ensure output directory exists
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }
  
  const outputPath = join(outputDir, `${task.id}.md`);
  
  const header = `# Output: ${task.title}
**Task ID:** ${task.id}
**Agent:** ${task.agent}
**Model:** ${response.model}
**Completed:** ${new Date().toISOString()}
**Gates:** all passed

---

${response.content}
`;
  
  writeFileSync(outputPath, header);
  
  return outputPath;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
