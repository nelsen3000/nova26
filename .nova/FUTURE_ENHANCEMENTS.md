NOVA26 — Future Enhancements (Phase 1+)
Status: FLAGGED — Do NOT build in Phase 0. Implement after the core orchestrator (SUN + GSD + Ralph Loop) is working and at least 1 successful end-to-end build is complete.
Source: Reviewed from 11-step relay output. 3 items survived skeptical review by Claude. Everything else was rejected as premature, scope creep, or hardware-incompatible.

Enhancement #1: Clarify-then-Build (LLM Council)
What it is: Before SUN dispatches a task to EARTH for spec writing, add a clarification step where 2-3 cheap local models each rephrase what the user is asking for. The user sees 3 interpretation cards and picks the best one (or merges parts from multiple cards). The selected interpretation becomes the confirmed intent that EARTH writes the spec from.
Why it matters: This directly solves the #1 failure mode in AI coding: "built the wrong thing perfectly." The user's request is ambiguous. Three different models will interpret it three different ways. Showing the user those interpretations before committing to a spec catches misunderstandings before any code is written.
Where it fits in Nova26 architecture:

SUN receives user request
NEW STEP: SUN sends request to 2-3 local models (Qwen at different temperatures, or Qwen + Llama + Mistral if available)
Each model returns: plain-language interpretation, short rationale, draft build prompt
User picks one (or merges fields from multiple)
Selected interpretation goes to EARTH as confirmed intent
EARTH writes the full spec from confirmed intent (existing flow continues)

Implementation notes:

Use local models only (free, fast, no API cost)
On 16GB hardware: run sequentially through single Ollama instance (not parallel)
On 64GB hardware (post-Upgrade #8): can run 2-3 models in parallel
Log which model's interpretation was chosen (feeds Enhancement #3 below)
Keep it simple: 3 cards, pick one, done. No toggles, no SWOT, no improvement suggestions — those add UX clutter without proportional value

Phase: 1+ (after orchestrator works and ATLAS has build data to compare against)
Depends on: Working SUN orchestrator, working EARTH spec agent, Ollama running locally

Enhancement #2: Convex MCP Server
What it is: Convex provides an official MCP server (npx convex mcp start) that exposes your Convex database to external AI tools via the Model Context Protocol. This lets tools like Claude Desktop, Kiro, or any MCP-compatible client query and mutate your Convex tables through a standardized interface.
Why it matters: Right now, the only way to interact with your Convex data is through your app's UI or direct Convex dashboard. The MCP server lets any AI tool in your workflow read company data, chip balances, agent logs, ATLAS tables, etc. without building custom integrations for each tool.
Where it fits:

Install after your Convex schema is deployed and has real data
Exposes queries and mutations that already exist in your codebase
Does NOT replace any Nova26 agent — it's infrastructure that agents benefit from
GANYMEDE (API Integration agent) would define how Nova26 interacts with it

Implementation notes:

Already exists: npx convex mcp start — no custom code needed
Free, official, maintained by Convex team
Configure in .kiro/mcp.json or equivalent MCP config
Respects existing Convex auth and validation rules
Row-level isolation (companyId) still enforced at the query/mutation level

Phase: 1 (install as soon as Convex schema is deployed, before any Phase 1 feature work)
Depends on: Deployed Convex schema with tables (companies, agents, chips, etc.)

Enhancement #3: Selection Logging / Authority ROI Tracking
What it is: When Enhancement #1 (Clarify-then-Build) is active, track which model's interpretation the user chose, what fields were merged from other models, and whether the resulting build succeeded or failed. Over time, this data shows which models produce the best interpretations for which types of tasks.
Why it matters: This is exactly what ATLAS (the meta-learner) should be doing. Instead of building a separate tracking system, wire this data directly into ATLAS's existing 6 Convex tables. ATLAS already logs builds and retrieves patterns — this just adds "which model clarified the intent" as a tracked variable.
Where it fits in Nova26 architecture:

ATLAS already has: builds table (logs every build), patterns table (stores what works), briefings table (pre-task advice)
Add to builds table: clarificationModelChosen, clarificationModelsOffered, fieldsmergedFrom
ATLAS retrospective already asks "what worked?" — now it can correlate success with which clarifier model was used
Over time, ATLAS briefings can say: "For frontend tasks, Qwen-7B interpretations have 80% success rate vs Llama-3B at 60%. Recommend prioritizing Qwen interpretation."

Implementation notes:

Do NOT build a separate logging system — extend ATLAS
Do NOT build this before Enhancement #1 exists (nothing to log)
Schema addition is minimal: 3-4 fields on the existing builds table
Aligns with NOVA v2.1 Section 25 (Model Performance Tracking) and Section 9 (Authority ROI Backtesting)

Phase: 1+ (after Enhancement #1 is implemented and ATLAS is logging builds)
Depends on: Enhancement #1 (Clarify-then-Build), working ATLAS with Convex tables

Build Order

Enhancement #2 (Convex MCP) — Install as soon as schema is deployed. No custom code. 5 minutes.
Enhancement #1 (Clarify-then-Build) — After orchestrator works. Requires local models + SUN dispatching. 1-2 days.
Enhancement #3 (Selection Logging) — After Enhancement #1 is live and ATLAS is logging. Schema change + wiring. Half day.
