# Multi-Agent Coordination Directive — Reusable Template

> **Purpose**: Copy this file into any project to spin up parallel AI agent development.
> **Created**: February 18, 2026 | **Author**: Claude Code + Jonathan Nelsen
> **Proven on**: NOVA26 (72 tasks, 5 agents, same-day delivery)

---

## STEP 1: Give This to Your Coordinator Agent (Claude Code)

Paste this into Claude Code at the start of any new project:

```
You are the COORDINATOR for a multi-agent development sprint on this project. Your responsibilities:

1. ASSESS the project — read the codebase, identify completion %, find gaps
2. CREATE a TASK-BOARD.md at .nova/TASK-BOARD.md (or project equivalent) with ALL tasks needed
3. ASSIGN tasks to available agents based on their capabilities (see Agent Capabilities below)
4. DEFINE file ownership — each agent gets exclusive directories to avoid merge conflicts
5. DEFINE branch strategy — each agent works on their own branch
6. GENERATE copy-pasteable prompts for each agent with:
   - Project context (what this project is, tech stack, repo URL)
   - Their role and branch name
   - Their file ownership (what they can/cannot touch)
   - Ordered task list with detailed descriptions
   - Quality standards (must compile, must pass tests, world-class quality)
   - Coordination rules (update task board after each task, commit, push)
7. WORK on your own assigned tasks (core engine, merging, testing)
8. MERGE agent branches to main periodically and resolve conflicts
9. VERIFY quality after each merge (compile check, test run)
10. ASSIGN new tasks when any agent finishes their queue

## Agent Capabilities

### Claude Code (Coordinator)
- Full local filesystem access (read, write, execute)
- Can run terminal commands (git, npm, tsc, vitest, etc.)
- Can merge branches and resolve conflicts
- Best for: core logic, testing, build verification, coordination
- Limitation: must be actively prompted by user

### Kiro
- GitHub repo access, unlimited Opus 4.6
- Has tasks.md for batch execution ("run all")
- Can edit files directly on filesystem
- Best for: large coding tasks, UI/frontend, agent templates
- Limitation: works best with tasks.md batch format

### OpenAI/ChatGPT
- GitHub connector (read/write files, create branches, create PRs)
- Cannot run local commands
- Strong architectural reasoning
- Best for: code generation via GitHub PRs, testing, security, CI/CD
- Limitation: can't execute code locally, must use apply_patch

### Perplexity
- GitHub read/write access (create/update files, branches, PRs)
- Real-time web search (best for research-backed work)
- Cannot run local commands
- Best for: research, documentation, competitive analysis, cutting-edge patterns
- Limitation: can't execute code locally

### Kimi
- Agent mode for autonomous multi-step coding
- Can read/write files
- Best for: bulk repetitive tasks, template modernization, wiring existing code
- Limitation: needs clear sequential instructions

### Google Gemini (optional)
- No direct repo access (generates code in conversation)
- Deep reasoning, large context window
- Best for: architectural design, complex algorithm design
- Limitation: user must manually apply code

### MiniMax (optional, if credits available)
- Similar to Kimi capabilities
- Best for: additional parallel coding capacity
- Limitation: credit-based

## Coordination Rules (include in every agent prompt)

1. BRANCH ISOLATION: Each agent works ONLY on their designated branch
2. FILE OWNERSHIP: Agents only modify files in their assigned directories — NO OVERLAP
3. UPDATE ON COMPLETION: After each task, check off the task in TASK-BOARD.md, commit, push
4. BLOCKERS: If blocked, note it under the task and move to the next one
5. COORDINATOR MERGES: Only the coordinator (Claude Code) merges branches to main
6. QUALITY BAR: All code must compile (tsc --noEmit = 0 errors), all tests must pass
7. WORLD-CLASS: Every component must be cutting-edge, production-quality, best-in-class

## Task Board Format

Use this exact format for TASK-BOARD.md:

# [PROJECT NAME] TASK BOARD — [DATE]

## Agent Roster
| Agent | Branch | Domain | Status |
|-------|--------|--------|--------|

## CATEGORY 1: [Name]
**Owner: [Agent]**
- [ ] `ID-01` Task description
- [ ] `ID-02` Task description

## Progress Summary
| Agent | Assigned | Completed | % |
|-------|----------|-----------|---|

## Coordination Rules
[Copy from above]
```

---

## STEP 2: Template Prompt for Each Agent

Copy, fill in the `[BRACKETS]`, and paste to each agent:

```
# [PROJECT_NAME] Multi-Agent Sprint — [AGENT_NAME] Assignment: [ROLE]

## Context
You are one of [N] AI agents working in parallel on [PROJECT_NAME] ([REPO_URL]).
[1-2 sentence project description].
Your role is [ROLE DESCRIPTION].

## Your Branch
Work on branch: `[agent-name]/[feature-name]`

## File Ownership (only modify these)
- [directory1/] — description
- [directory2/] — description
- DO NOT modify anything outside these directories

## Tech Stack
- [Language/framework]
- [UI library]
- [Database]
- [Other key deps]

## Your Tasks (do them in order)

### [ID]-01: [Task Title]
[Detailed description with specific files, functions, and expected output]

### [ID]-02: [Task Title]
[Detailed description]

[...continue for all tasks...]

## After EACH task completion:
1. Commit your changes to your branch
2. Update `.nova/TASK-BOARD.md` — change `[ ]` to `[x]` for your completed task
3. Push to remote
4. If blocked on anything, note it under the task and move to the next one

## Quality Standards
- [Language] strict mode, zero warnings
- All new code must have tests (if applicable to this agent)
- Follow existing code patterns in the codebase
- This must be WORLD-CLASS — [reference a known high-quality example]

## When All Tasks Are Done
Commit a final message: "[AGENT_NAME] sprint complete — [N] tasks done"
Push your branch. The coordinator (Claude Code) will merge your work.
```

---

## STEP 3: Quick-Start Checklist

For any new project, follow these steps:

### Preparation (5 minutes)
- [ ] Ensure project is on GitHub (all agents need repo access)
- [ ] Grant Perplexity GitHub access (Settings → Integrations)
- [ ] Grant OpenAI/ChatGPT GitHub access (via connector)
- [ ] Ensure Kiro has project access
- [ ] Ensure Kimi can access the project files

### Launch (10 minutes)
- [ ] Open Claude Code in the project directory
- [ ] Paste the STEP 1 coordinator directive
- [ ] Tell Claude: "Assess this project and create a multi-agent sprint plan"
- [ ] Claude generates TASK-BOARD.md and agent prompts
- [ ] Copy each prompt to its respective agent
- [ ] Tell Kiro to "run all" (if using tasks.md)
- [ ] Tell Kimi to enable Agent Mode

### Monitor (ongoing)
- [ ] Watch TASK-BOARD.md on GitHub for real-time progress
- [ ] When an agent reports done, tell Claude to merge their branch
- [ ] Claude assigns new tasks if backlog remains
- [ ] Final merge + verification when all tasks complete

### Wrap-Up (5 minutes)
- [ ] Claude runs final: tsc, tests, lint
- [ ] Claude merges all branches to main
- [ ] Claude pushes to origin/main
- [ ] Review TASK-BOARD.md — all boxes checked

---

## STEP 4: Scaling Tips

### Adding More Agents
- Each new agent needs: a branch, file ownership, and a prompt
- Split an existing agent's domain if adding capacity to the same area
- Never have 2 agents modify the same file

### Handling Merge Conflicts
- The coordinator (Claude Code) is the ONLY one who merges
- If conflicts arise, Claude resolves them using the later agent's changes as base
- Re-run tests after every merge

### Task Dependencies
- If Task B depends on Task A from a different agent:
  - Mark Task B as "BLOCKED by [A-ID]" in the task board
  - Agent skips it and moves to next task
  - Coordinator unblocks it after merging Task A's branch

### Mid-Sprint Reprioritization
- User tells Claude to reprioritize
- Claude updates TASK-BOARD.md with new ordering
- Agents pick up changes on next task board read

### Quality Escalation
- If an agent's output fails quality checks after merge:
  - Claude fixes it directly, OR
  - Claude creates a fix task and assigns it back to the agent

---

## STEP 5: Project Assessment Template

When starting a new project, Claude should answer:

1. **What % complete is this project?**
   - Break down by: Backend, Frontend, Testing, Docs, Infrastructure, Security
2. **What are the top 10 gaps?**
   - Ranked by user impact
3. **What can be parallelized?**
   - Group tasks by file ownership (no overlap = safe to parallelize)
4. **What's the critical path?**
   - Which tasks block other tasks?
5. **How many agents do we need?**
   - Fewer agents = less coordination overhead
   - More agents = faster but more merge risk
   - Sweet spot: 3-5 agents for most projects

---

## Example: Agent Capability Matrix

Use this to decide which agent gets which domain:

| Capability | Claude | Kiro | OpenAI | Perplexity | Kimi |
|-----------|--------|------|--------|------------|------|
| Local filesystem | Yes | Yes | No | No | Yes |
| Run commands | Yes | Yes | No | No | Partial |
| GitHub API | Via CLI | Yes | Yes | Yes | No |
| Web research | No | No | Limited | Best | No |
| Large coding tasks | Good | Best | Good | OK | Good |
| Bulk repetitive tasks | OK | Good | OK | OK | Best |
| Testing/verification | Best | OK | Good | No | OK |
| Documentation | Good | OK | Good | Best | OK |
| Merge/coordinate | Best | No | No | No | No |
| Architecture design | Best | Good | Best | Good | Good |
