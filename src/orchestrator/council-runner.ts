// LLM Council - Multi-agent consensus system
// Enables multiple agents to collaborate and reach consensus on critical decisions

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

// Council members - representing different perspectives
export const COUNCIL_MEMBERS: CouncilMember[] = [
  {
    name: 'ARCHITECT',
    role: 'Technical Architect',
    expertise: ['system-design', 'scalability', 'best-practices']
  },
  {
    name: 'REVIEWER',
    role: 'Code Reviewer',
    expertise: ['code-quality', 'security', 'performance']
  },
  {
    name: 'IMPLEMENTER',
    role: 'Implementation Lead',
    expertise: ['coding', 'testing', 'debugging']
  }
];

// Build council prompt for voting on a task decision
function buildCouncilPrompt(task: Task, responseContent: string): string {
  return `You are a member of the LLM Council reviewing a task decision.

TASK: ${task.title}
DESCRIPTION: ${task.description}
AGENT: ${task.agent}

LLM RESPONSE:
${responseContent.substring(0, 2000)}

Please evaluate whether this response is appropriate for proceeding to the next step.
Consider:
1. Technical correctness
2. Code quality and best practices
3. Security implications
4. Completeness of the solution

Respond with your vote:
- APPROVE: If the response meets all criteria
- REJECT: If there are significant issues that need fixing
- ABSTAIN: If you cannot make a clear judgment

Provide a brief reasoning for your vote (1-2 sentences).`;
}

// Run council vote - get all members to vote on a decision
export async function runCouncilVote(
  task: Task,
  responseContent: string,
  llmCaller?: typeof callLLM
): Promise<CouncilDecision> {
  const call = llmCaller || callLLM;
  const votes: CouncilVote[] = [];

  console.log(`\n🏛️ Running LLM Council vote for task: ${task.id}`);

  // Get vote from each council member
  for (const member of COUNCIL_MEMBERS) {
    const prompt = buildCouncilPrompt(task, responseContent);
    
    try {
      const result = await call(
        `${member.role} (${member.expertise.join(', ')})`,
        prompt,
        member.name
      );
      
      // Parse vote from response
      const vote = parseVoteFromResponse(result.content, member.name);
      votes.push(vote);
      
      console.log(`  ${member.name}: ${vote.vote} (${Math.round(vote.confidence * 100)}% confidence)`);
    } catch (error) {
      // If council member fails, abstain
      votes.push({
        member: member.name,
        vote: 'abstain',
        reasoning: 'Unable to evaluate',
        confidence: 0
      });
      console.log(`  ${member.name}: ABSTAIN (error)`);
    }
  }

  // Calculate consensus
  const decision = calculateConsensus(votes);
  
  console.log(`\n🏛️ Council Decision: ${decision.consensus.toUpperCase()} - ${decision.finalVerdict.toUpperCase()}`);
  
  return decision;
}

// Parse vote from LLM response
function parseVoteFromResponse(content: string, memberName: string): CouncilVote {
  const upperContent = content.toUpperCase();
  
  let vote: 'approve' | 'reject' | 'abstain' = 'abstain';
  if (upperContent.includes('APPROVE') || upperContent.includes('APPROVED')) {
    vote = 'approve';
  } else if (upperContent.includes('REJECT') || upperContent.includes('REJECTED')) {
    vote = 'reject';
  }
  
  // Extract reasoning (first sentence or first 200 chars)
  const sentences = content.split(/[.!?]/);
  const reasoning = sentences[0]?.trim() || 'No reasoning provided';
  
  // Estimate confidence based on certainty indicators
  let confidence = 0.7; // default
  if (upperContent.includes('CERTAIN') || upperContent.includes('CONFIDENT')) {
    confidence = 0.9;
  } else if (upperContent.includes('MAYBE') || upperContent.includes('UNSURE')) {
    confidence = 0.4;
  }
  
  return {
    member: memberName,
    vote,
    reasoning: reasoning.substring(0, 200),
    confidence
  };
}

// Calculate consensus from votes
function calculateConsensus(votes: CouncilVote[]): CouncilDecision {
  const approveCount = votes.filter(v => v.vote === 'approve').length;
  const rejectCount = votes.filter(v => v.vote === 'reject').length;
  const abstainCount = votes.filter(v => v.vote === 'abstain').length;
  const total = votes.length;
  
  let consensus: CouncilDecision['consensus'];
  let finalVerdict: CouncilDecision['finalVerdict'];
  
  if (approveCount === total) {
    consensus = 'unanimous';
    finalVerdict = 'approved';
  } else if (approveCount > rejectCount && approveCount > abstainCount) {
    consensus = 'majority';
    finalVerdict = 'approved';
  } else if (rejectCount > approveCount && rejectCount > abstainCount) {
    consensus = 'majority';
    finalVerdict = 'rejected';
  } else if (approveCount === rejectCount) {
    consensus = 'deadlock';
    finalVerdict = 'pending';
  } else {
    consensus = 'split';
    finalVerdict = 'pending';
  }
  
  // Build summary
  const summary = `Votes: ${approveCount} approve, ${rejectCount} reject, ${abstainCount} abstain`;
  
  return {
    consensus,
    votes,
    finalVerdict,
    summary,
    timestamp: new Date().toISOString()
  };
}

// Check if council approval is required for a task
export function requiresCouncilApproval(task: Task): boolean {
  // Require council approval for:
  // - Phase 1 tasks (critical foundation)
  // - Tasks with high impact (marked in description)
  // - Tasks that previously failed
  return task.phase === 1 || task.phase === 2 || task.error !== undefined;
}
