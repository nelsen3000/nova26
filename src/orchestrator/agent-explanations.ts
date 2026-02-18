// Agent Explanations with Chain of Reasoning
// Shows WHAT agents do AND WHY they do it

import type { Task } from '../types/index.js';

export interface AgentExplanation {
  simple: string;
  detailed: string;
  technical: string;
  emoji: string;
  learnMore?: string;
  reasoning?: ChainOfReasoning;
}

/**
 * Chain of Reasoning - Explains the agent's thought process
 * Shows WHY decisions are made, not just WHAT is being done
 */
export interface ChainOfReasoning {
  context: string;      // What situation triggered this action
  analysis: string;     // How the agent analyzed the situation
  decision: string;     // Why this specific approach was chosen
  alternatives: string[]; // What other options were considered
  confidence: 'high' | 'medium' | 'low'; // How certain the agent is
}

/**
 * Get explanation with chain of reasoning for what an agent is doing
 */
export function getAgentExplanation(task: Task): AgentExplanation {
  const explanations: Record<string, (task: Task) => AgentExplanation> = {
    'EARTH': (t) => ({
      emoji: '🌍',
      simple: `Planning out the details for "${t.title}"`,
      detailed: `EARTH is writing a product specification that describes what needs to be built, what data is involved, and how users will interact with it. This is like writing a blueprint before construction.`,
      technical: `EARTH is generating a PRD section with user stories, acceptance criteria, Gherkin scenarios, and UI state definitions. Output will define data models, mutations, and queries needed.`,
      reasoning: {
        context: `Task "${t.title}" is at Phase 0 (planning phase), which requires a detailed specification before implementation can begin.`,
        analysis: `This feature involves user interactions, data storage, and business logic. Without clear requirements, implementation agents would make inconsistent assumptions.`,
        decision: `Creating a comprehensive PRD section with Gherkin scenarios ensures all edge cases are considered upfront and provides testable acceptance criteria.`,
        alternatives: [
          'Skip spec and let MARS figure it out (too risky)',
          'Create minimal one-liner description (too vague)',
          'Let VENUS design UI first (would miss backend requirements)'
        ],
        confidence: 'high'
      }
    }),
    
    'PLUTO': (t) => ({
      emoji: '🪐',
      simple: `Designing the database structure for "${t.title}"`,
      detailed: `PLUTO is creating database tables and relationships. Think of this as designing the filing system where all the app's data will be stored securely.`,
      technical: `PLUTO is defining Convex tables with validators, indexes for query performance, and row-level isolation via companyId. Output: convex/schema.ts additions.`,
      reasoning: {
        context: `EARTH has defined data requirements for "${t.title}". Now we need to translate those requirements into a schema that ensures data integrity.`,
        analysis: `The feature requires storing relational data with company-level isolation. Query patterns suggest we need indexes on companyId + status for filtering.`,
        decision: `Using Convex v3 schema with validators provides type safety and runtime validation. Adding compound indexes ensures queries remain fast as data grows.`,
        alternatives: [
          'Use plain JSON without validation (too error-prone)',
          'Create separate table per company (unscalable)',
          'Use MongoDB-style nested documents (harder to query)'
        ],
        confidence: 'high'
      }
    }),
    
    'MARS': (t) => ({
      emoji: '🔴',
      simple: `Writing the backend code for "${t.title}"`,
      detailed: `MARS is writing the server-side code that handles saving data, fetching records, and business logic. This is the engine that powers the feature.`,
      technical: `MARS is implementing Convex mutations (5-step pattern: auth→validate→logic→execute→return) and queries with proper TypeScript types and error handling.`,
      reasoning: {
        context: `Schema is ready and EARTH has defined requirements. Implementation of "${t.title}" can now begin with proper type safety.`,
        analysis: `The feature requires CRUD operations with authentication checks. The 5-step pattern ensures consistent security and error handling across all mutations.`,
        decision: `Following the established 5-step mutation pattern maintains code consistency and ensures auth checks are never skipped. Strong typing prevents runtime errors.`,
        alternatives: [
          'Use simpler functions without auth (security risk)',
          'Skip validation for speed (data integrity risk)',
          'Use REST API instead (would lose real-time benefits)'
        ],
        confidence: 'high'
      }
    }),
    
    'VENUS': (t) => ({
      emoji: '💫',
      simple: `Building the user interface for "${t.title}"`,
      detailed: `VENUS is creating the buttons, forms, and screens that users will see and interact with. Making it look good and work smoothly on all devices.`,
      technical: `VENUS is building React 19 components with Tailwind CSS, shadcn/ui, handling all 5 UI states (loading, empty, error, partial, populated) with framer-motion animations.`,
      reasoning: {
        context: `Backend APIs from MARS are ready for "${t.title}". Users need a visual interface to interact with these capabilities.`,
        analysis: `Users expect responsive, accessible interfaces with clear feedback for all states. 5-state handling ensures users aren't left wondering what happened.`,
        decision: `Using shadcn/ui components provides consistent, accessible UI. Tailwind enables rapid styling. Framer Motion adds polish without complexity.`,
        alternatives: [
          'Build custom components from scratch (too time-consuming)',
          'Use raw HTML/CSS (inconsistent with design system)',
          'Skip error states (bad UX)'
        ],
        confidence: 'high'
      }
    }),
    
    'MERCURY': (t) => ({
      emoji: '☿️',
      simple: `Checking the quality of "${t.title}"`,
      detailed: `MERCURY is reviewing the work to make sure it meets standards, follows patterns, and doesn't have any issues. Like a code review, but automated.`,
      technical: `MERCURY is running validation gates: type checking, pattern matching, completeness verification. Returns PASS/FAIL with specific issues if found.`,
      reasoning: {
        context: `Implementation of "${t.title}" is complete. Before marking done, we must verify it meets quality standards and follows established patterns.`,
        analysis: `Quality gates prevent technical debt accumulation. Automated checking is faster than manual review and catches issues humans might miss.`,
        decision: `Running type check, pattern matching, and completeness verification ensures consistent quality. Failures are specific and actionable.`,
        alternatives: [
          'Skip validation to go faster (technical debt)',
          'Rely on manual review only (inconsistent)',
          'Use external CI only (slower feedback loop)'
        ],
        confidence: 'high'
      }
    }),
    
    'SATURN': (t) => ({
      emoji: '🪐',
      simple: `Writing tests for "${t.title}"`,
      detailed: `SATURN is creating automated tests that will catch bugs before they reach users. Testing happy paths, edge cases, and error scenarios.`,
      technical: `SATURN is writing Vitest unit tests, React Testing Library component tests, and Playwright E2E tests. Enforcing 85%+ coverage thresholds.`,
      reasoning: {
        context: `Code for "${t.title}" passes quality gates. Now we need automated tests to prevent regressions as the codebase evolves.`,
        analysis: `Manual testing is unreliable and doesn't scale. Automated tests at unit, integration, and E2E levels provide confidence in refactors and deployments.`,
        decision: `Three-layer testing: unit tests for logic, integration for components, E2E for critical flows. 85% coverage threshold balances quality and pragmatism.`,
        alternatives: [
          'Skip tests to ship faster (regression risk)',
          'Only unit tests (miss integration issues)',
          '100% coverage mandate (diminishing returns)'
        ],
        confidence: 'high'
      }
    }),
    
    'JUPITER': (t) => ({
      emoji: '🟠',
      simple: `Making architectural decisions for "${t.title}"`,
      detailed: `JUPITER is deciding how different parts of the system should connect and work together, documenting trade-offs and why certain approaches were chosen.`,
      technical: `JUPITER is creating Architecture Decision Records (ADRs) with context, decision, consequences, and alternatives considered. Output: .nova/architecture/adrs/`,
      reasoning: {
        context: `Complex feature "${t.title}" requires architectural decisions that will impact the system long-term. These decisions need documentation.`,
        analysis: `Architecture decisions made without documentation lead to confusion and inconsistent patterns. Future developers need to understand WHY choices were made.`,
        decision: `Creating ADRs in the established format captures context, trade-offs, and consequences. Stored in version control for historical reference.`,
        alternatives: [
          'Keep decisions in Slack (lost history)',
          'No documentation (knowledge silos)',
          'Verbal handoffs (subject to forgetting)'
        ],
        confidence: 'medium' // Architecture decisions involve more uncertainty
      }
    }),
    
    'TITAN': (t) => ({
      emoji: '🌙',
      simple: `Adding real-time updates to "${t.title}"`,
      detailed: `TITAN is making the feature update instantly when data changes, without needing to refresh the page. Like Google Docs showing edits live.`,
      technical: `TITAN is implementing Convex subscriptions with useQuery(), optimistic updates via withOptimisticUpdate(), and presence tracking for collaborative features.`,
      reasoning: {
        context: `Feature "${t.title}" currently requires manual refresh to see updates. Users expect real-time sync in modern applications.`,
        analysis: `Polling creates unnecessary server load and latency. Convex subscriptions provide true real-time updates with minimal overhead.`,
        decision: `Using Convex subscriptions with optimistic updates provides instant feedback. Presence tracking enables collaborative features if needed later.`,
        alternatives: [
          'Polling every 5 seconds (wasteful)',
          'WebSocket manual implementation (complex)',
          'No real-time (poor UX)'
        ],
        confidence: 'high'
      }
    }),
    
    'EUROPA': (t) => ({
      emoji: '🌊',
      simple: `Optimizing "${t.title}" for mobile devices`,
      detailed: `EUROPA is ensuring the feature works great on phones and tablets - touch-friendly buttons, fast loading, and responsive layouts.`,
      technical: `EUROPA is defining responsive Tailwind patterns, PWA configurations, service worker patterns, and touch gesture handlers. Guidelines for VENUS implementation.`,
      reasoning: {
        context: `Feature "${t.title}" is currently desktop-focused. Mobile traffic represents 60%+ of users and needs first-class support.`,
        analysis: `Responsive design isn't just about screen size - touch targets, performance, and offline capability matter for mobile users.`,
        decision: `Providing mobile-first guidelines and patterns ensures consistent implementation. PWA capabilities enable app-like experience.`,
        alternatives: [
          'Desktop-only (excluding mobile users)',
          'Separate mobile app (duplicate effort)',
          'Basic responsive only (misses touch optimization)'
        ],
        confidence: 'high'
      }
    }),
    
    'ATLAS': (t) => ({
      emoji: '📚',
      simple: `Learning from the build to improve future work`,
      detailed: `ATLAS is recording what worked well and what didn't, so the system gets smarter over time. Like keeping a journal of lessons learned.`,
      technical: `ATLAS is logging build metrics, storing effective/failure patterns, creating timing benchmarks, and generating pre-task briefings for future similar tasks.`,
      reasoning: {
        context: `Task "${t.title}" completed. The system should learn from this experience to improve future similar tasks.`,
        analysis: `Without learning from past builds, we repeat mistakes and rediscover effective patterns. Build data contains valuable insights for optimization.`,
        decision: `Recording metrics, patterns, and timing enables data-driven improvements. Pre-task briefings help agents start with relevant context.`,
        alternatives: [
          'No learning (stagnant system)',
          'Manual documentation only (incomplete)',
          'Focus only on failures (miss success patterns)'
        ],
        confidence: 'medium'
      }
    }),
    
    'SUN': (t) => ({
      emoji: '☀️',
      simple: `Coordinating the overall project plan`,
      detailed: `SUN is the project manager, breaking down big ideas into specific tasks and making sure they get done in the right order.`,
      technical: `SUN is orchestrating the Ralph Loop, managing task dependencies, promoting tasks from pending→ready→running→done, and handling agent coordination.`,
      reasoning: {
        context: `A new PRD has been loaded with ${t.context?.taskCount || 'multiple'} tasks that need to be completed in the correct order with proper dependencies.`,
        analysis: `Tasks have dependencies (EARTH before MARS, MARS before VENUS). Some can run in parallel. Need a system to track state and coordinate handoffs.`,
        decision: `Ralph Loop with dependency tracking ensures correct ordering. Parallel execution where possible maximizes efficiency. Agent specialization optimizes quality.`,
        alternatives: [
          'Sequential only (too slow)',
          'Fully parallel (dependency chaos)',
          'Manual coordination (error-prone)'
        ],
        confidence: 'high'
      }
    }),
    
    'URANUS': (t) => ({
      emoji: '🔭',
      simple: `Researching best practices for "${t.title}"`,
      detailed: `URANUS is exploring what approaches have worked for similar problems, researching libraries, patterns, and potential pitfalls before implementation starts.`,
      technical: `URANUS performs pre-implementation research: library evaluation, pattern research, competitor analysis, and creating decision matrices for approach selection.`,
      reasoning: {
        context: `Complex feature "${t.title}" has multiple implementation options. Choosing the wrong approach now creates costly rework later.`,
        analysis: `Reinventing solutions wastes time. Learning from others' successes and failures informs better decisions. Library choice affects maintenance burden.`,
        decision: `Research phase before implementation identifies proven patterns, evaluates libraries against requirements, and documents trade-offs for the team.`,
        alternatives: [
          'Pick first option found (risky)',
          'Use whatever is familiar (might not fit)',
          'Build everything custom (time-consuming)'
        ],
        confidence: 'medium'
      }
    }),
    
    'NEPTUNE': (t) => ({
      emoji: '🔵',
      simple: `Setting up analytics for "${t.title}"`,
      detailed: `NEPTUNE is adding tracking so we can understand how users interact with the feature - what's working well and what needs improvement.`,
      technical: `NEPTUNE implements event tracking, creates dashboard queries, defines success metrics, and sets up anomaly detection for feature performance.`,
      reasoning: {
        context: `Feature "${t.title}" is nearly complete. We need visibility into user behavior and feature performance to make data-driven improvements.`,
        analysis: `Without metrics, we're flying blind. Guessing about user behavior leads to wasted effort on wrong features. Data guides prioritization.`,
        decision: `Instrumenting key events and creating dashboards provides real-time visibility. Success metrics align with business goals.`,
        alternatives: [
          'No tracking (blind to issues)',
          'Basic page views only (misses feature usage)',
          'Track everything (noise overload)'
        ],
        confidence: 'high'
      }
    }),
    
    'ANDROMEDA': (t) => ({
      emoji: '🌌',
      simple: `Brainstorming ideas for "${t.title}"`,
      detailed: `ANDROMEDA is exploring creative possibilities and generating alternative approaches that might not be obvious at first glance.`,
      technical: `ANDROMEDA performs divergent thinking exercises, generates "what if" scenarios, and creates idea matrices to explore solution space beyond obvious choices.`,
      reasoning: {
        context: `For feature "${t.title}", the obvious solution might not be the best. Exploring alternatives can reveal breakthrough approaches.`,
        analysis: `First ideas are often conventional. Deliberate exploration of alternatives can find simpler, more elegant, or more powerful solutions.`,
        decision: `Structured brainstorming with "how might we" questions and constraint removal generates diverse options before converging on a choice.`,
        alternatives: [
          'Take first idea (miss better options)',
          'Skip ideation (narrow thinking)',
          'Unstructured brainstorming (misses categories)'
        ],
        confidence: 'low' // Ideation is inherently uncertain
      }
    }),
    
    'default': (t) => ({
      emoji: '🤖',
      simple: `Working on "${t.title}"`,
      detailed: `${t.agent} is handling its specialized part of this feature according to its domain expertise.`,
      technical: `${t.agent} agent executing task with domain-specific patterns and validation.`,
      reasoning: {
        context: `Task "${t.title}" is in progress and assigned to ${t.agent} based on its domain specialization.`,
        analysis: `${t.agent} has the specific skills and patterns needed for this type of work. Following established agent-task matching ensures quality.`,
        decision: `Executing with domain-specific knowledge and patterns maintains consistency and leverages accumulated expertise.`,
        alternatives: ['Use general-purpose approach (lower quality)'],
        confidence: 'medium'
      }
    }),
  };
  
  const getExplanation = explanations[task.agent] || explanations['default'];
  return getExplanation(task);
}

/**
 * Format chain of reasoning for display
 */
export function formatReasoning(reasoning: ChainOfReasoning): string {
  const confidenceEmoji = {
    high: '✅',
    medium: '⚠️',
    low: '🔍'
  };
  
  return `
🧠 Chain of Reasoning:

📍 Context:
   ${reasoning.context}

🔍 Analysis:
   ${reasoning.analysis}

💡 Decision:
   ${reasoning.decision}

🔄 Alternatives Considered:
${reasoning.alternatives.map(a => `   • ${a}`).join('\n')}

${confidenceEmoji[reasoning.confidence]} Confidence: ${reasoning.confidence.toUpperCase()}
`;
}

/**
 * Format explanation for CLI output with optional reasoning
 */
export function formatExplanation(
  explanation: AgentExplanation, 
  showDetail: boolean = false,
  showReasoning: boolean = false
): string {
  const lines = [
    ``,
    `  ${explanation.emoji} ${explanation.simple}`,
    ``,
  ];
  
  if (showDetail) {
    lines.push(`  📖 ${explanation.detailed}`);
    lines.push(`  `);
    lines.push(`  🔧 ${explanation.technical}`);
  }
  
  if (showReasoning && explanation.reasoning) {
    lines.push('');
    lines.push(formatReasoning(explanation.reasoning).split('\n').map(l => '  ' + l).join('\n'));
  }
  
  if (!showDetail && !showReasoning) {
    lines.push(`  💡 Press 'e' for details, 'r' for reasoning`);
  }
  
  if (explanation.learnMore) {
    lines.push(`  `);
    lines.push(`  📚 Learn more: ${explanation.learnMore}`);
  }
  
  lines.push('');
  return lines.join('\n');
}

/**
 * Generate HTML version with reasoning
 */
export function generateExplanationHTML(explanation: AgentExplanation, task: Task): string {
  const reasoningHTML = explanation.reasoning ? `
    <details class="explanation-reasoning">
      <summary>🧠 Chain of Reasoning</summary>
      <div class="reasoning-content">
        <div class="reasoning-section">
          <h5>📍 Context</h5>
          <p>${explanation.reasoning.context}</p>
        </div>
        <div class="reasoning-section">
          <h5>🔍 Analysis</h5>
          <p>${explanation.reasoning.analysis}</p>
        </div>
        <div class="reasoning-section">
          <h5>💡 Decision</h5>
          <p>${explanation.reasoning.decision}</p>
        </div>
        <div class="reasoning-section">
          <h5>🔄 Alternatives Considered</h5>
          <ul>
            ${explanation.reasoning.alternatives.map(a => `<li>${a}</li>`).join('')}
          </ul>
        </div>
        <div class="reasoning-confidence ${explanation.reasoning.confidence}">
          ${explanation.reasoning.confidence === 'high' ? '✅' : explanation.reasoning.confidence === 'medium' ? '⚠️' : '🔍'} 
          Confidence: ${explanation.reasoning.confidence.toUpperCase()}
        </div>
      </div>
    </details>
  ` : '';
  
  return `
<div class="agent-explanation" data-agent="${task.agent}">
  <div class="explanation-header">
    <span class="agent-emoji">${explanation.emoji}</span>
    <span class="agent-name">${task.agent}</span>
    <span class="task-title">${task.title}</span>
  </div>
  
  <div class="explanation-simple">
    ${explanation.simple}
  </div>
  
  <details class="explanation-details">
    <summary>What is ${task.agent} doing?</summary>
    <div class="explanation-detailed">
      <p>${explanation.detailed}</p>
    </div>
    <div class="explanation-technical">
      <h4>Technical Details:</h4>
      <p>${explanation.technical}</p>
    </div>
  </details>
  
  ${reasoningHTML}
</div>

<style>
.agent-explanation {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  border-radius: 12px;
  padding: 20px;
  margin: 16px 0;
  color: white;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.explanation-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.agent-emoji {
  font-size: 24px;
}

.agent-name {
  font-weight: 600;
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #60a5fa;
}

.task-title {
  color: rgba(255,255,255,0.7);
  font-size: 14px;
}

.explanation-simple {
  font-size: 18px;
  font-weight: 500;
  margin-bottom: 16px;
  line-height: 1.4;
}

.explanation-details,
.explanation-reasoning {
  border-top: 1px solid rgba(255,255,255,0.1);
  padding-top: 16px;
  margin-top: 16px;
}

.explanation-details summary,
.explanation-reasoning summary {
  cursor: pointer;
  color: #60a5fa;
  font-size: 14px;
  user-select: none;
}

.explanation-details summary:hover,
.explanation-reasoning summary:hover {
  color: #93c5fd;
}

.explanation-detailed {
  margin-top: 12px;
  padding: 12px;
  background: rgba(255,255,255,0.05);
  border-radius: 8px;
  line-height: 1.6;
}

.explanation-technical {
  margin-top: 12px;
  padding: 12px;
  background: rgba(0,0,0,0.2);
  border-radius: 8px;
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 13px;
}

.explanation-technical h4 {
  margin: 0 0 8px 0;
  color: #fbbf24;
  font-size: 12px;
  text-transform: uppercase;
}

.reasoning-content {
  margin-top: 16px;
}

.reasoning-section {
  margin-bottom: 16px;
  padding: 12px;
  background: rgba(255,255,255,0.03);
  border-radius: 8px;
}

.reasoning-section h5 {
  margin: 0 0 8px 0;
  color: #a78bfa;
  font-size: 12px;
  text-transform: uppercase;
}

.reasoning-section p {
  margin: 0;
  line-height: 1.6;
  color: rgba(255,255,255,0.9);
}

.reasoning-section ul {
  margin: 8px 0;
  padding-left: 20px;
}

.reasoning-section li {
  margin: 4px 0;
  color: rgba(255,255,255,0.7);
}

.reasoning-confidence {
  margin-top: 12px;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
}

.reasoning-confidence.high {
  background: rgba(34, 197, 94, 0.2);
  color: #4ade80;
}

.reasoning-confidence.medium {
  background: rgba(234, 179, 8, 0.2);
  color: #facc15;
}

.reasoning-confidence.low {
  background: rgba(239, 68, 68, 0.2);
  color: #f87171;
}
</style>
`;
}

/**
 * Interactive CLI prompt with reasoning option
 */
export function showInteractiveExplanation(task: Task): void {
  const explanation = getAgentExplanation(task);
  
  console.log('\n' + '─'.repeat(60));
  console.log(`${explanation.emoji} ${task.agent} is working on: ${task.title}`);
  console.log('─'.repeat(60));
  console.log();
  console.log('📋 Simple explanation:');
  console.log(`   ${explanation.simple}`);
  console.log();
  console.log('💡 Press [e] for details, [r] for reasoning, [Enter] to continue...');
  console.log();
}
