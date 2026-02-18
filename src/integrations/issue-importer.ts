// GitHub Issues → PRD Task Importer
// Consumes GitHub Issues/Linear URLs and auto-converts them to NOVA26 PRD tasks
// Supports: issue URL → analyze → generate PRD → optionally fix → PR

import { execSync } from 'child_process';
import type { PRD, Task } from '../types/index.js';

export interface IssueData {
  number: number;
  title: string;
  body: string;
  labels: string[];
  assignees: string[];
  state: string;
  url: string;
  repo: string;
}

/**
 * Import a GitHub issue by URL or number
 */
export function importGitHubIssue(issueRef: string): IssueData | null {
  // Parse URL or number
  let repo = '';
  let issueNumber = '';

  if (issueRef.startsWith('http')) {
    // URL format: https://github.com/owner/repo/issues/123
    const match = issueRef.match(/github\.com\/([^/]+\/[^/]+)\/issues\/(\d+)/);
    if (!match) {
      console.error('Invalid GitHub issue URL');
      return null;
    }
    repo = match[1];
    issueNumber = match[2];
  } else if (/^\d+$/.test(issueRef)) {
    // Just a number - use current repo
    issueNumber = issueRef;
  } else if (issueRef.includes('#')) {
    // Format: owner/repo#123
    const parts = issueRef.split('#');
    repo = parts[0];
    issueNumber = parts[1];
  } else {
    console.error('Unrecognized issue format. Use: URL, #123, or owner/repo#123');
    return null;
  }

  try {
    const repoArg = repo ? `-R ${repo}` : '';
    const json = execSync(
      `gh issue view ${issueNumber} ${repoArg} --json number,title,body,labels,assignees,state,url`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    );

    const data = JSON.parse(json);
    return {
      number: data.number,
      title: data.title,
      body: data.body || '',
      labels: data.labels?.map((l: { name: string }) => l.name) || [],
      assignees: data.assignees?.map((a: { login: string }) => a.login) || [],
      state: data.state,
      url: data.url,
      repo: repo || getCurrentRepo(),
    };
  } catch (error: any) {
    console.error(`Failed to fetch issue: ${error.message}`);
    return null;
  }
}

/**
 * Convert a GitHub issue to a NOVA26 PRD
 */
export function issueToPRD(issue: IssueData): PRD {
  // Determine agent based on labels
  const agentMapping: Record<string, string> = {
    'bug': 'MARS',
    'frontend': 'VENUS',
    'backend': 'MARS',
    'database': 'PLUTO',
    'security': 'ENCELADUS',
    'performance': 'IO',
    'documentation': 'CALLISTO',
    'testing': 'SATURN',
    'architecture': 'JUPITER',
    'api': 'GANYMEDE',
    'analytics': 'NEPTUNE',
    'ui': 'VENUS',
    'ux': 'VENUS',
    'devops': 'TRITON',
    'feature': 'EARTH',
    'enhancement': 'EARTH',
  };

  // Determine primary agent from labels
  let primaryAgent = 'EARTH'; // Default to spec first
  for (const label of issue.labels) {
    const mapped = agentMapping[label.toLowerCase()];
    if (mapped) {
      primaryAgent = mapped;
      break;
    }
  }

  // Generate task chain based on issue type
  const isBug = issue.labels.some(l => l.toLowerCase() === 'bug');
  const isFeature = issue.labels.some(l =>
    ['feature', 'enhancement'].includes(l.toLowerCase())
  );

  const tasks: Task[] = [];
  const now = new Date().toISOString();

  if (isBug) {
    // Bug fix workflow: MARS fix → SATURN test → MERCURY validate
    tasks.push(
      {
        id: `gh-${issue.number}-001`,
        title: `Fix: ${issue.title}`,
        description: `Fix the bug described in GitHub issue #${issue.number}.\n\n${issue.body}`,
        agent: 'MARS',
        status: 'ready',
        dependencies: [],
        phase: 0,
        attempts: 0,
        createdAt: now,
      },
      {
        id: `gh-${issue.number}-002`,
        title: `Test fix for: ${issue.title}`,
        description: `Write tests to verify the fix for #${issue.number} and prevent regression.`,
        agent: 'SATURN',
        status: 'pending',
        dependencies: [`gh-${issue.number}-001`],
        phase: 1,
        attempts: 0,
        createdAt: now,
      },
      {
        id: `gh-${issue.number}-003`,
        title: `Validate fix for: ${issue.title}`,
        description: `Validate that the fix and tests for #${issue.number} are correct and complete.`,
        agent: 'MERCURY',
        status: 'pending',
        dependencies: [`gh-${issue.number}-001`, `gh-${issue.number}-002`],
        phase: 2,
        attempts: 0,
        createdAt: now,
      }
    );
  } else if (isFeature) {
    // Feature workflow: EARTH spec → PLUTO schema → MARS impl → VENUS ui → SATURN test → MERCURY validate
    tasks.push(
      {
        id: `gh-${issue.number}-001`,
        title: `Spec: ${issue.title}`,
        description: `Create a product specification for the feature described in #${issue.number}.\n\n${issue.body}`,
        agent: 'EARTH',
        status: 'ready',
        dependencies: [],
        phase: 0,
        attempts: 0,
        createdAt: now,
      },
      {
        id: `gh-${issue.number}-002`,
        title: `Schema: ${issue.title}`,
        description: `Design database schema for #${issue.number} based on the spec.`,
        agent: 'PLUTO',
        status: 'pending',
        dependencies: [`gh-${issue.number}-001`],
        phase: 1,
        attempts: 0,
        createdAt: now,
      },
      {
        id: `gh-${issue.number}-003`,
        title: `Backend: ${issue.title}`,
        description: `Implement backend mutations/queries for #${issue.number}.`,
        agent: 'MARS',
        status: 'pending',
        dependencies: [`gh-${issue.number}-002`],
        phase: 2,
        attempts: 0,
        createdAt: now,
      },
      {
        id: `gh-${issue.number}-004`,
        title: `Frontend: ${issue.title}`,
        description: `Build UI components for #${issue.number}.`,
        agent: 'VENUS',
        status: 'pending',
        dependencies: [`gh-${issue.number}-003`],
        phase: 3,
        attempts: 0,
        createdAt: now,
      },
      {
        id: `gh-${issue.number}-005`,
        title: `Test: ${issue.title}`,
        description: `Write comprehensive tests for #${issue.number}.`,
        agent: 'SATURN',
        status: 'pending',
        dependencies: [`gh-${issue.number}-003`, `gh-${issue.number}-004`],
        phase: 4,
        attempts: 0,
        createdAt: now,
      },
      {
        id: `gh-${issue.number}-006`,
        title: `Validate: ${issue.title}`,
        description: `Validate all deliverables for #${issue.number}.`,
        agent: 'MERCURY',
        status: 'pending',
        dependencies: [`gh-${issue.number}-005`],
        phase: 5,
        attempts: 0,
        createdAt: now,
      }
    );
  } else {
    // Generic: primary agent → MERCURY validate
    tasks.push(
      {
        id: `gh-${issue.number}-001`,
        title: issue.title,
        description: `${issue.body}\n\nSource: GitHub issue #${issue.number}`,
        agent: primaryAgent,
        status: 'ready',
        dependencies: [],
        phase: 0,
        attempts: 0,
        createdAt: now,
      },
      {
        id: `gh-${issue.number}-002`,
        title: `Validate: ${issue.title}`,
        description: `Validate the output for #${issue.number}.`,
        agent: 'MERCURY',
        status: 'pending',
        dependencies: [`gh-${issue.number}-001`],
        phase: 1,
        attempts: 0,
        createdAt: now,
      }
    );
  }

  return {
    meta: {
      name: `GH-${issue.number}: ${issue.title}`,
      version: '1.0.0',
      createdAt: now,
    },
    tasks,
  };
}

/**
 * Get current repo name
 */
function getCurrentRepo(): string {
  try {
    const url = execSync('git remote get-url origin', { encoding: 'utf-8' }).trim();
    const match = url.match(/github\.com[:/]([^/]+\/[^/.]+)/);
    return match?.[1] || '';
  } catch {
    return '';
  }
}

/**
 * Import multiple issues by label
 */
export function importIssuesByLabel(label: string, limit: number = 10): IssueData[] {
  try {
    const json = execSync(
      `gh issue list --label "${label}" --state open --limit ${limit} --json number,title,body,labels,assignees,state,url`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    );

    const issues = JSON.parse(json) as Array<{
      number: number;
      title: string;
      body: string;
      labels: Array<{ name: string }>;
      assignees: Array<{ login: string }>;
      state: string;
      url: string;
    }>;

    return issues.map(i => ({
      number: i.number,
      title: i.title,
      body: i.body || '',
      labels: i.labels.map(l => l.name),
      assignees: i.assignees.map(a => a.login),
      state: i.state,
      url: i.url,
      repo: getCurrentRepo(),
    }));
  } catch (error: any) {
    console.error(`Failed to fetch issues: ${error.message}`);
    return [];
  }
}
