# Council Consensus Voting

## Source
Extracted from Nova26 `src/orchestrator/council-runner.ts`

---

## Pattern: Council Consensus Voting

The LLM Council runs multiple specialized agents (ARCHITECT, REVIEWER, IMPLEMENTER) to vote on critical task outputs. Each council member evaluates the response from their area of expertise, casting approve/reject/abstain with a confidence score. Consensus is calculated from the votes — unanimous, majority, split, or deadlock — and determines whether execution proceeds or the task is rejected. Council approval is triggered for high-stakes tasks (early phases or previously failed tasks).

---

## Implementation

### Code Example

```typescript
import { callLLM } from '../llm/ollama-client.js';
import type { Task } from '../types/index.js';

export interface CouncilMember {
  name: string;
  role: string;
  expertise: string[];
}

export interface CouncilVote {
  member: string;
  vote: 'approve' | 'reject' | 'abstain';
  reasoning: string;
  confidence: number; // 0-1
}

export interface CouncilDecision {
  consensus: 'unanimous' | 'majority' | 'split' | 'deadlock';
  votes: CouncilVote[];
  finalVerdict: 'approved' | 'rejected' | 'pending';
  summary: string;
  timestamp: string;
}

export const COUNCIL_MEMBERS: CouncilMember[] = [
  { name: 'ARCHITECT',    role: 'Technical Architect',   expertise: ['system-design', 'scalability', 'best-practices'] },
  { name: 'REVIEWER',     role: 'Code Reviewer',         expertise: ['code-quality', 'security', 'performance'] },
  { name: 'IMPLEMENTER',  role: 'Implementation Lead',   expertise: ['coding', 'testing', 'debugging'] },
];

export async function runCouncilVote(
  task: Task,
  responseContent: string,
  llmCaller?: typeof callLLM
): Promise<CouncilDecision> {
  const call = llmCaller || callLLM;
  const votes: CouncilVote[] = [];

  for (const member of COUNCIL_MEMBERS) {
    const prompt = buildCouncilPrompt(task, responseContent);
    try {
      const result = await call(`${member.role} (${member.expertise.join(', ')})`, prompt, member.name);
      votes.push(parseVoteFromResponse(result.content, member.name));
    } catch {
      votes.push({ member: member.name, vote: 'abstain', reasoning: 'Unable to evaluate', confidence: 0 });
    }
  }

  return calculateConsensus(votes);
}

function calculateConsensus(votes: CouncilVote[]): CouncilDecision {
  const approveCount = votes.filter(v => v.vote === 'approve').length;
  const rejectCount  = votes.filter(v => v.vote === 'reject').length;
  const total = votes.length;

  let consensus: CouncilDecision['consensus'];
  let finalVerdict: CouncilDecision['finalVerdict'];

  if (approveCount === total)            { consensus = 'unanimous'; finalVerdict = 'approved'; }
  else if (approveCount > rejectCount)   { consensus = 'majority';  finalVerdict = 'approved'; }
  else if (rejectCount > approveCount)   { consensus = 'majority';  finalVerdict = 'rejected'; }
  else if (approveCount === rejectCount) { consensus = 'deadlock';  finalVerdict = 'pending'; }
  else                                   { consensus = 'split';     finalVerdict = 'pending'; }

  return {
    consensus, votes, finalVerdict,
    summary: `Votes: ${approveCount} approve, ${rejectCount} reject, ${votes.length - approveCount - rejectCount} abstain`,
    timestamp: new Date().toISOString(),
  };
}

export function requiresCouncilApproval(task: Task): boolean {
  return task.phase === 1 || task.phase === 2 || task.error !== undefined;
}
```

### Key Concepts

- Three-member council: ARCHITECT (design), REVIEWER (quality/security), IMPLEMENTER (coding/testing)
- Graceful failure: if a council member's LLM call fails, they abstain rather than crashing the vote
- Confidence scoring: parsed from LLM response using certainty indicators (certain/confident → 0.9, maybe/unsure → 0.4)
- Selective triggering: council only runs for phase 1/2 tasks or previously failed tasks to avoid overhead

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// Council on every task — 3x LLM calls per task is too slow and expensive
export function requiresCouncilApproval(task: Task): boolean {
  return true; // Runs council on all 20+ tasks
}

// Single voter — no consensus benefit
const COUNCIL_MEMBERS = [{ name: 'ARCHITECT' }]; // One vote = no consensus

// Ignoring abstain votes — treating them as approvals
if (approveCount + abstainCount > rejectCount) { finalVerdict = 'approved'; }
```

### ✅ Do This Instead

```typescript
// Only for high-stakes tasks
export function requiresCouncilApproval(task: Task): boolean {
  return task.phase === 1 || task.phase === 2 || task.error !== undefined;
}

// Multiple voters with diverse expertise
const COUNCIL_MEMBERS = [
  { name: 'ARCHITECT', expertise: ['system-design'] },
  { name: 'REVIEWER',  expertise: ['code-quality'] },
  { name: 'IMPLEMENTER', expertise: ['coding'] },
];
```

---

## When to Use This Pattern

✅ **Use for:**
- Critical decisions where multiple perspectives reduce the risk of a single-agent blind spot
- High-stakes outputs (architecture decisions, security-sensitive code) that benefit from peer review

❌ **Don't use for:**
- Low-risk, high-volume tasks where the 3x LLM call overhead is not justified

---

## Benefits

1. Multi-perspective validation — catches issues that a single agent might miss
2. Fault-tolerant voting — abstain on LLM failure prevents one broken call from blocking the pipeline
3. Auditable decisions — every vote includes reasoning and confidence, creating a reviewable record

---

## Related Patterns

- See `ralph-loop-execution.md` for where council approval is invoked in the task processing pipeline
- See `gate-runner-pipeline.md` for the quality gates that run before council approval
- See `prompt-builder-dependency-injection.md` for how council prompts are constructed

---

*Extracted: 2025-07-15*
