# Issue Importer

## Source
Extracted from Nova26 `src/integrations/issue-importer.ts`

---

## Pattern: Issue Importer

A bridge between external issue trackers (GitHub Issues, Linear, Jira) and the Nova26 PRD task system. The importer fetches issue data via the `gh` CLI, analyzes labels to determine the appropriate agent workflow, and generates a fully structured PRD with phased task chains — turning a one-line bug report or feature request into an executable multi-agent build plan.

The core design principle is label-driven routing: issue labels like `bug`, `frontend`, or `database` map directly to Nova26 agents (MARS, VENUS, PLUTO), and the issue type determines the task chain template (bug fix → 3 phases, feature → 6 phases, generic → 2 phases).

---

## Implementation

### Code Example

```typescript
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
 * Import a GitHub issue by URL, number, or owner/repo#number format.
 * Uses the gh CLI to fetch structured JSON data.
 */
export function importGitHubIssue(issueRef: string): IssueData | null {
  let repo = '';
  let issueNumber = '';

  if (issueRef.startsWith('http')) {
    const match = issueRef.match(/github\.com\/([^/]+\/[^/]+)\/issues\/(\d+)/);
    if (!match) return null;
    repo = match[1];
    issueNumber = match[2];
  } else if (/^\d+$/.test(issueRef)) {
    issueNumber = issueRef;
  } else if (issueRef.includes('#')) {
    const parts = issueRef.split('#');
    repo = parts[0];
    issueNumber = parts[1];
  } else {
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
  } catch {
    return null;
  }
}

/**
 * Label-to-agent mapping. Each label routes to the Nova26 agent
 * best suited to handle that type of work.
 */
const AGENT_MAPPING: Record<string, string> = {
  bug: 'MARS',
  frontend: 'VENUS',
  backend: 'MARS',
  database: 'PLUTO',
  security: 'ENCELADUS',
  performance: 'IO',
  documentation: 'CALLISTO',
  testing: 'SATURN',
  architecture: 'JUPITER',
  api: 'GANYMEDE',
  analytics: 'NEPTUNE',
  ui: 'VENUS',
  devops: 'TRITON',
  feature: 'EARTH',
  enhancement: 'EARTH',
};

/**
 * Convert a GitHub issue into a Nova26 PRD with phased task chains.
 * Bug issues get a 3-phase chain (fix → test → validate).
 * Feature issues get a 6-phase chain (spec → schema → backend → frontend → test → validate).
 * Generic issues get a 2-phase chain (execute → validate).
 */
export function issueToPRD(issue: IssueData): PRD {
  const now = new Date().toISOString();
  const isBug = issue.labels.some(l => l.toLowerCase() === 'bug');
  const isFeature = issue.labels.some(l =>
    ['feature', 'enhancement'].includes(l.toLowerCase())
  );

  let primaryAgent = 'EARTH';
  for (const label of issue.labels) {
    const mapped = AGENT_MAPPING[label.toLowerCase()];
    if (mapped) { primaryAgent = mapped; break; }
  }

  const tasks: Task[] = [];
  const prefix = `gh-${issue.number}`;

  if (isBug) {
    tasks.push(
      makeTask(prefix, 1, `Fix: ${issue.title}`, issue.body, 'MARS', 0, []),
      makeTask(prefix, 2, `Test fix: ${issue.title}`, '', 'SATURN', 1, [`${prefix}-001`]),
      makeTask(prefix, 3, `Validate: ${issue.title}`, '', 'MERCURY', 2, [`${prefix}-001`, `${prefix}-002`]),
    );
  } else if (isFeature) {
    tasks.push(
      makeTask(prefix, 1, `Spec: ${issue.title}`, issue.body, 'EARTH', 0, []),
      makeTask(prefix, 2, `Schema: ${issue.title}`, '', 'PLUTO', 1, [`${prefix}-001`]),
      makeTask(prefix, 3, `Backend: ${issue.title}`, '', 'MARS', 2, [`${prefix}-002`]),
      makeTask(prefix, 4, `Frontend: ${issue.title}`, '', 'VENUS', 3, [`${prefix}-003`]),
      makeTask(prefix, 5, `Test: ${issue.title}`, '', 'SATURN', 4, [`${prefix}-003`, `${prefix}-004`]),
      makeTask(prefix, 6, `Validate: ${issue.title}`, '', 'MERCURY', 5, [`${prefix}-005`]),
    );
  } else {
    tasks.push(
      makeTask(prefix, 1, issue.title, issue.body, primaryAgent, 0, []),
      makeTask(prefix, 2, `Validate: ${issue.title}`, '', 'MERCURY', 1, [`${prefix}-001`]),
    );
  }

  return {
    meta: { name: `GH-${issue.number}: ${issue.title}`, version: '1.0.0', createdAt: now },
    tasks,
  };
}

/**
 * Batch import: fetch all open issues matching a label.
 */
export function importIssuesByLabel(label: string, limit: number = 10): IssueData[] {
  try {
    const json = execSync(
      `gh issue list --label "${label}" --state open --limit ${limit} --json number,title,body,labels,assignees,state,url`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    return JSON.parse(json).map((i: any) => ({
      number: i.number,
      title: i.title,
      body: i.body || '',
      labels: i.labels.map((l: { name: string }) => l.name),
      assignees: i.assignees.map((a: { login: string }) => a.login),
      state: i.state,
      url: i.url,
      repo: getCurrentRepo(),
    }));
  } catch {
    return [];
  }
}
```

### Key Concepts

- **Flexible issue reference parsing**: Accepts URLs (`https://github.com/owner/repo/issues/123`), bare numbers (`123`), and shorthand (`owner/repo#123`) — the importer normalizes all formats before fetching
- **Label-driven agent routing**: Issue labels map directly to Nova26 agents via a static lookup table, eliminating the need for LLM-based classification of simple issue types
- **Template task chains**: Bug, feature, and generic issues each produce a different phased task chain with correct dependency ordering, ensuring MERCURY validation always runs last
- **Batch import**: `importIssuesByLabel` enables triage workflows where an entire label (e.g., `p0-critical`) is imported as a batch of PRDs
- **gh CLI dependency**: All GitHub API calls go through the `gh` CLI rather than raw HTTP, leveraging the user's existing authentication and avoiding token management

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// Importing issues without structured task chains
function importIssue(url: string): { title: string; body: string } {
  const data = fetchIssue(url);
  return { title: data.title, body: data.body };
  // No agent routing, no phased tasks, no dependency chain —
  // the orchestrator has no idea what to do with this
}
```

### ✅ Do This Instead

```typescript
// Import and convert to a fully structured PRD with agent assignments
const issue = importGitHubIssue('https://github.com/acme/app/issues/42');
if (issue) {
  const prd = issueToPRD(issue);
  // prd.tasks is a phased chain: EARTH → PLUTO → MARS → VENUS → SATURN → MERCURY
  // Each task has dependencies, agent assignment, and phase number
  await orchestrator.executePRD(prd);
}
```

---

## When to Use This Pattern

✅ **Use for:**
- Converting GitHub Issues into executable Nova26 PRD builds
- Batch-importing issues by label for sprint planning or triage automation
- Bridging external project management tools with the agent orchestrator

❌ **Don't use for:**
- Issues that require human judgment to decompose (complex architectural changes) — use EARTH agent for manual spec writing instead
- Non-GitHub issue trackers without a CLI adapter (Linear and Jira support requires additional adapter modules)

---

## Benefits

1. **Zero-friction intake** — paste a GitHub issue URL and get a fully structured PRD with phased tasks, agent assignments, and dependency chains in seconds
2. **Consistent task decomposition** — bug fixes always follow fix → test → validate; features always follow spec → schema → backend → frontend → test → validate; no steps are skipped
3. **Label-based routing** — leverages existing GitHub label conventions to assign the right agent without LLM inference, keeping the import path fast and deterministic
4. **Batch operations** — `importIssuesByLabel` enables automated triage of entire issue categories, useful for sprint kickoffs or incident response

---

## Related Patterns

- See `./git-workflow.md` for the branch/commit/PR lifecycle that runs after imported issues are built
- See `../01-orchestration/ralph-loop-execution.md` for the orchestrator that executes the generated PRD task chains
- See `../02-agent-system/prd-generator.md` for the PRD generation system that the importer feeds into
- See `../15-type-system/core-types.md` for the `PRD` and `Task` type definitions used by the importer

---

*Extracted: 2026-02-19*
