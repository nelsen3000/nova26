# Agent Explanations

## Source
Extracted from Nova26 `src/orchestrator/agent-explanations.ts`

---

## Pattern: Agent Explanation with Chain of Reasoning

The Agent Explanations pattern provides multi-level, human-readable descriptions of what each agent is doing and why. Every agent task gets three explanation tiers (simple, detailed, technical) plus an optional Chain of Reasoning that documents the decision-making process — context, analysis, decision rationale, alternatives considered, and confidence level. This makes the orchestrator's behavior transparent to developers and end users.

---

## Implementation

### Code Example

```typescript
import type { Task } from '../types/index.js';

export interface AgentExplanation {
  simple: string;
  detailed: string;
  technical: string;
  emoji: string;
  learnMore?: string;
  reasoning?: ChainOfReasoning;
}

export interface ChainOfReasoning {
  context: string;        // What situation triggered this action
  analysis: string;       // How the agent analyzed the situation
  decision: string;       // Why this specific approach was chosen
  alternatives: string[]; // What other options were considered
  confidence: 'high' | 'medium' | 'low';
}

export function getAgentExplanation(task: Task): AgentExplanation {
  const explanations: Record<string, (task: Task) => AgentExplanation> = {
    'EARTH': (t) => ({
      emoji: '🌍',
      simple: `Planning out the details for "${t.title}"`,
      detailed: `EARTH is writing a product specification that describes what needs to be built...`,
      technical: `EARTH is generating a PRD section with user stories, acceptance criteria, Gherkin scenarios...`,
      reasoning: {
        context: `Task "${t.title}" is at Phase 0 (planning phase)...`,
        analysis: `This feature involves user interactions, data storage, and business logic...`,
        decision: `Creating a comprehensive PRD section with Gherkin scenarios ensures all edge cases are considered upfront...`,
        alternatives: [
          'Skip spec and let MARS figure it out (too risky)',
          'Create minimal one-liner description (too vague)',
          'Let VENUS design UI first (would miss backend requirements)'
        ],
        confidence: 'high'
      }
    }),
    // ... one entry per agent (SUN, PLUTO, MARS, VENUS, MERCURY, SATURN, JUPITER, etc.)
    'default': (t) => ({
      emoji: '🤖',
      simple: `Working on "${t.title}"`,
      detailed: `${t.agent} is handling its specialized part...`,
      technical: `${t.agent} agent executing task with domain-specific patterns...`,
      reasoning: {
        context: `Task "${t.title}" is in progress...`,
        analysis: `${t.agent} has the specific skills needed...`,
        decision: `Executing with domain-specific knowledge...`,
        alternatives: ['Use general-purpose approach (lower quality)'],
        confidence: 'medium'
      }
    }),
  };

  const getExplanation = explanations[task.agent] || explanations['default'];
  return getExplanation(task);
}
```

### Formatting and Display

```typescript
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
    lines.push(`  🔧 ${explanation.technical}`);
  }

  if (showReasoning && explanation.reasoning) {
    lines.push(formatReasoning(explanation.reasoning));
  }

  return lines.join('\n');
}
```

### Key Concepts

- Three explanation tiers: simple (one-liner), detailed (plain English), technical (implementation specifics)
- Chain of Reasoning captures the "why" behind every agent action
- Confidence levels (high/medium/low) communicate certainty to the user
- Alternatives list shows what was considered and rejected
- A `default` fallback ensures every agent — even unknown ones — gets an explanation
- HTML generation enables rich rendering in browser-based dashboards

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// Single opaque status message with no reasoning
function getStatus(task: Task): string {
  return `${task.agent} is running task ${task.id}`;
}
```

Users have no idea what the agent is doing, why it was chosen, or what alternatives exist.

### ✅ Do This Instead

```typescript
// Multi-level explanation with reasoning chain
function getAgentExplanation(task: Task): AgentExplanation {
  return {
    simple: `Planning out the details for "${task.title}"`,
    detailed: `EARTH is writing a product specification...`,
    technical: `Generating PRD with Gherkin scenarios...`,
    emoji: '🌍',
    reasoning: {
      context: `Task is at Phase 0...`,
      analysis: `Feature involves data storage and business logic...`,
      decision: `Comprehensive PRD ensures edge cases are covered...`,
      alternatives: ['Skip spec (risky)', 'Minimal description (vague)'],
      confidence: 'high'
    }
  };
}
```

Progressive disclosure lets users choose their depth of understanding.

---

## When to Use This Pattern

✅ **Use for:**
- Any multi-agent system where users need to understand agent behavior
- AI orchestrators that should be transparent about decision-making
- CLI or dashboard UIs that display agent progress

❌ **Don't use for:**
- Internal-only logging where structured logs suffice
- Systems where agent behavior is trivially obvious (single-step pipelines)

---

## Benefits

1. Transparency — users understand what agents do and why
2. Progressive disclosure — simple → detailed → technical → reasoning
3. Debuggability — Chain of Reasoning helps trace unexpected decisions
4. Trust — showing alternatives considered builds confidence in the system's choices
5. Multi-format output — CLI text and HTML rendering from the same data

---

## Related Patterns

- See `./agent-loader.md` for how agent prompts are loaded before explanations are generated
- See `../01-orchestration/ralph-loop-execution.md` for the orchestration loop that triggers agent explanations
- See `../01-orchestration/task-picker.md` for how tasks are selected and assigned to agents

---

*Extracted: 2026-02-18*
