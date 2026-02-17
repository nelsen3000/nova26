import { PRD, Task, AgentTemplate, LLMResponse, GateResult } from '../types/index.js';
import { readJSON, writeJSON, getNovaPath, ensureDir, writeMarkdown } from '../utils/file-io.js';
import { log, success, error, warn, taskStart, taskComplete, taskBlocked, gateFailed, summaryTable } from '../utils/logger.js';
import { callOllama } from '../llm/ollama-client.js';
import { selectModel } from '../llm/model-router.js';
import { loadAgent } from './agent-loader.js';
import { buildPrompt, buildRetryPrompt, isResponseBlocked, extractBlockedReason } from './prompt-builder.js';
import { pickNextTask, updateTaskStatus, allTasksComplete, getTaskCounts } from './task-picker.js';
import { runGates } from '../gates/gate-runner.js';
import { logBuild } from '../atlas/build-logger.js';

const OUTPUT_DIR = '.nova/output';
const DEFAULT_PRD_PATH = '.nova/prd.json';

/**
 * Run the Ralph Loop - the main execution engine for NOVA26
 */
export async function runRalphLoop(prdPath: string = DEFAULT_PRD_PATH): Promise<void> {
  const startTime = Date.now();
  
  // Load PRD
  log(`Loading PRD from ${prdPath}`);
  const prd = await readJSON<PRD>(prdPath);
  
  // Ensure output directory exists
  await ensureDir(getNovaPath('output'));
  
  // Count tasks
  const counts = getTaskCounts(prd);
  log(`Ralph Loop starting. ${counts.total} tasks total.`);
  log(`Status: ${counts.ready} ready, ${counts.inProgress} in progress, ${counts.done} done, ${counts.blocked} blocked.`);
  
  let currentPrd = prd;
  let loopCount = 0;
  const maxLoops = currentPrd.phases.flatMap(p => p.tasks).length * 2; // Prevent infinite loops
  
  while (loopCount < maxLoops) {
    loopCount++;
    
    // Pick next task
    const task = pickNextTask(currentPrd);
    
    // If no task ready, check if we're done
    if (!task) {
      if (allTasksComplete(currentPrd)) {
        break;
      }
      
      // All remaining tasks are blocked or waiting on dependencies
      const blocked = currentPrd.phases
        .flatMap(p => p.tasks)
        .filter(t => t.status === 'blocked');
      
      const waiting = currentPrd.phases
        .flatMap(p => p.tasks)
        .filter(t => t.status === 'ready');
      
      if (blocked.length > 0) {
        warn(`All remaining tasks are blocked:`);
        blocked.forEach(t => {
          warn(`  - ${t.id}: ${t.blockedReason}`);
        });
      }
      
      if (waiting.length > 0) {
        warn(`${waiting.length} task(s) waiting on dependencies.`);
      }
      
      break;
    }
    
    // Mark task as in_progress
    currentPrd = updateTaskStatus(currentPrd, task.id, 'in_progress');
    await writeJSON(prdPath, currentPrd);
    
    // Execute task
    const result = await executeTask(currentPrd, task, prdPath);
    
    // Update PRD with result
    currentPrd = result.prd;
  }
  
  // Print summary
  const finalCounts = getTaskCounts(currentPrd);
  const durationMs = Date.now() - startTime;
  
  summaryTable({
    total: finalCounts.total,
    done: finalCounts.done,
    blocked: finalCounts.blocked,
    durationMs,
  });
}

/**
 * Execute a single task
 */
async function executeTask(
  prd: PRD,
  task: Task,
  prdPath: string
): Promise<{ prd: PRD; success: boolean }> {
  const startedAt = new Date().toISOString();
  
  // Log task start
  taskStart(task.id, task.title, task.agent);
  
  try {
    // Load agent template
    const agent = await loadAgent(task.agent);
    
    // Select model
    const model = selectModel(task.agent, task);
    
    // Build prompt
    const llmRequest = buildPrompt(agent, task);
    llmRequest.model = model;
    
    // Call LLM
    let llmResponse: LLMResponse;
    try {
      llmResponse = await callOllama(llmRequest);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      error(`LLM call failed: ${errorMessage}`);
      
      // Mark as blocked
      const updatedPrd = updateTaskStatus(prd, task.id, 'blocked', {
        blockedReason: `LLM call failed: ${errorMessage}`,
      });
      await writeJSON(prdPath, updatedPrd);
      taskBlocked(task.id, errorMessage);
      
      return { prd: updatedPrd, success: false };
    }
    
    // Check for self-reported block
    if (isResponseBlocked(llmResponse.content)) {
      const reason = extractBlockedReason(llmResponse.content) ?? 'Unknown reason';
      const updatedPrd = updateTaskStatus(prd, task.id, 'blocked', {
        blockedReason: `Agent self-reported block: ${reason}`,
      });
      await writeJSON(prdPath, updatedPrd);
      taskBlocked(task.id, `Agent self-reported block: ${reason}`);
      
      return { prd: updatedPrd, success: false };
    }
    
    // Run gates
    const gateResults = await runGates(task, llmResponse, agent);
    
    // Check if all gates passed
    const allPassed = gateResults.every(g => g.passed);
    const criticalFailed = gateResults.some(g => !g.passed && g.severity === 'critical');
    
    if (allPassed) {
      // Save output
      const outputPath = getNovaPath('output', `${task.id}.md`);
      await writeMarkdown(outputPath, llmResponse.content);
      
      // Update task status
      const updatedPrd = updateTaskStatus(prd, task.id, 'done', {
        output: outputPath,
      });
      await writeJSON(prdPath, updatedPrd);
      
      // Log build to ATLAS
      await logBuild({
        taskId: task.id,
        agent: task.agent,
        model: llmResponse.model,
        attempt: task.attempts,
        startedAt,
        completedAt: new Date().toISOString(),
        durationMs: llmResponse.durationMs,
        gateResults,
        success: true,
        outputPath,
      });
      
      taskComplete(task.id);
      
      return { prd: updatedPrd, success: true };
    }
    
    // Gates failed - retry once
    if (task.attempts < 2) {
      const failureMessages = gateResults
        .filter(g => !g.passed)
        .map(g => `${g.gateName}: ${g.message}`);
      
      warn(`Gate failed. Retrying with feedback...`);
      
      // Rebuild prompt with failure context
      const retryRequest = buildRetryPrompt(agent, task, failureMessages, llmResponse.content);
      retryRequest.model = model;
      
      let retryResponse: LLMResponse;
      try {
        retryResponse = await callOllama(retryRequest);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        
        const updatedPrd = updateTaskStatus(prd, task.id, 'blocked', {
          blockedReason: `Retry LLM call failed: ${errorMessage}`,
        });
        await writeJSON(prdPath, updatedPrd);
        taskBlocked(task.id, errorMessage);
        
        return { prd: updatedPrd, success: false };
      }
      
      // Run gates again
      const retryGateResults = await runGates(task, retryResponse, agent);
      const retryPassed = retryGateResults.every(g => g.passed);
      
      if (retryPassed) {
        const outputPath = getNovaPath('output', `${task.id}.md`);
        await writeMarkdown(outputPath, retryResponse.content);
        
        const updatedPrd = updateTaskStatus(prd, task.id, 'done', {
          output: outputPath,
        });
        await writeJSON(prdPath, updatedPrd);
        
        await logBuild({
          taskId: task.id,
          agent: task.agent,
          model: retryResponse.model,
          attempt: task.attempts + 1,
          startedAt,
          completedAt: new Date().toISOString(),
          durationMs: retryResponse.durationMs,
          gateResults: retryGateResults,
          success: true,
          outputPath,
        });
        
        taskComplete(task.id);
        
        return { prd: updatedPrd, success: true };
      }
    }
    
    // Failed after retry - mark as blocked
    const failureMessages = gateResults
      .filter(g => !g.passed)
      .map(g => `${g.gateName}: ${g.message}`)
      .join('; ');
    
    const updatedPrd = updateTaskStatus(prd, task.id, 'blocked', {
      blockedReason: `Gates failed: ${failureMessages}`,
    });
    await writeJSON(prdPath, updatedPrd);
    
    await logBuild({
      taskId: task.id,
      agent: task.agent,
      model: llmResponse.model,
      attempt: task.attempts,
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs: llmResponse.durationMs,
      gateResults,
      success: false,
    });
    
    taskBlocked(task.id, failureMessages);
    
    return { prd: updatedPrd, success: false };
    
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    error(`Task execution error: ${errorMessage}`);
    
    const updatedPrd = updateTaskStatus(prd, task.id, 'blocked', {
      blockedReason: `Execution error: ${errorMessage}`,
    });
    await writeJSON(prdPath, updatedPrd);
    
    taskBlocked(task.id, errorMessage);
    
    return { prd: updatedPrd, success: false };
  }
}
