# P-03: Convex 1.31 Features and Nova26 Migration Guide

## Overview

Nova26 currently targets Convex around version 1.16.[file:11] This document summarizes key Convex features and changes up to version 1.31 (focusing on agents, vector search, preview deployments, and component improvements) and outlines a migration path for Nova26 from 1.16 → 1.31.[web:130][web:133][web:136]

> Note: Convex maintains living docs rather than a single "1.31" page; this report composes information from feature docs and the official Convex agent library.[web:130][web:133][web:136]

## Convex Agents Framework

- The `get-convex/agent` package provides a high-level abstraction for building AI agents on Convex with persistent chat history and integrated tools.[web:133][web:136]
- Core concepts:
  - **Threads and messages**: Each conversation is stored as a thread with messages (user, assistant, tool) in Convex tables.[web:133]
  - **ContextOptions**: Configurations for how much context to load (recentMessages, search across other threads, include tool calls, etc.).[web:133][web:136]
  - **Search options**: Ability to search within messages by text and/or vector search per thread or across threads.[web:133][web:136]
  - **Tool system**: `createTool` allows defining tools that use Convex queries, mutations, and actions as part of agent workflows.[web:133][web:136]
- Relevance to Nova26:
  - Provides a ready-made pattern for storing build logs, prompts, and decisions in Convex instead of flat files.
  - Offers a structured way to expose Nova26 internal APIs (PRD status, task history, ATLAS insights) as tools to agents.

## Vector Search & AI Features

- Convex now supports **vector search** for documents via vector indexes and the `ctx.vectorSearch` API.[web:130]
- Capabilities:
  - Store embedding vectors inside Convex documents and index them for similarity search.[web:130]
  - Perform vector searches in Convex actions, with filters and limits (up to 256 results, 64 filters).[web:130]
- Constraints:
  - Vector search is only available in actions, not queries/mutations, so transactional patterns must be carefully designed.[web:130]
- Relevance to Nova26:
  - ATLAS patterns, builds, and learnings can be enriched with embeddings for agent memory and pattern retrieval.[file:11][web:130]
  - PRD snippets, previous outputs, and error cases can be indexed for retrieval-augmented prompts.

## Preview Deployments & Components (High-Level)

- Convex has improved its developer experience with features like preview deployments and component-based app structures (e.g., in frameworks like Next.js/React with Convex integration).[web:130]
- While detailed 1.16 vs 1.31 changelog lines are not centrally documented, the trend is:
  - Better support for dev/staging environments and preview deploys tied to branches.
  - Cleaner patterns for structuring Convex functions and schema in larger apps.
- For Nova26:
  - Preview deployments matter more for the UA Dashboard app and any Nova26 dashboard/portal.
  - Components can help structure Nova26's future web UI (status dashboards, ATLAS views) on top of Convex.

## Changes & Considerations from 1.16 → 1.31

Because Convex uses rolling releases, the key changes relevant to Nova26 are feature additions rather than breaking core semantics.[web:130][web:136]

- Likely safe upgrades:
  - Schema definitions remain TypeScript-based; Nova26's existing schema.ts should require minimal adjustment.[file:11]
  - Index definitions (including vector indexes) are additive and can co-exist with existing indexes.[web:130]
- Areas to validate carefully:
  - **Package versions**: Ensure `convex` npm package and CLI versions are in sync with the targeted 1.31 runtime.
  - **Auth & environment config**: Any changes to environment variable names or auth providers must be mapped in Nova26's deployment docs.
  - **Breaking changes**: Review Convex release notes and migration guides for any removed APIs or changed function signatures used by Nova26 (queries, mutations, actions).

## Proposed Migration Steps for Nova26

1. **Inventory current Convex usage**
   - Confirm Nova26 only uses Convex for schema definition and (future) UA Dashboard data; no production deployment yet.[file:11]
   - List all tables, indexes, and function entry points in `convex/schema.ts` and any `convex/` directory modules.[file:11]

2. **Upgrade Convex dependencies in package.json**
   - Bump the `convex` package to the latest that corresponds to the 1.31 runtime; update any Convex-related dev tools.
   - Run `npx convex dev` (or equivalent) in a sample environment to validate.

3. **Introduce vector indexes for ATLAS patterns**
   - Add vector fields (e.g., `embedding`) to ATLAS tables like `patterns`, `tasks`, `learnings` where semantic search is valuable.[file:11][web:130]
   - Define vector indexes in `schema.ts` and implement actions that perform `ctx.vectorSearch` to retrieve similar patterns or tasks.[web:130]

4. **Adopt Convex Agent patterns for Nova26 agents**
   - Create a Convex `threads` table for agent conversations (SUN, MERCURY, ATLAS, etc.), with messages stored as structured documents.[web:133][web:136]
   - Implement tools via `createTool` that let agents query ATLAS tables, UA Dashboard data, and PRD status.
   - Use Convex as the persistent backing store for Nova26's build logs instead of only `.nova/atlas` JSON.[file:9][file:11]

5. **Add preview deployment workflows for UA Dashboard**
   - Configure Convex + front-end deployment (e.g., Vercel) to support preview deployments per branch for the UA Dashboard and future Nova26 portals.
   - Ensure schema migrations are safe for both main and preview environments.

6. **Update documentation & examples**
   - Reflect Convex 1.31 features (vector search, agents) in Nova26 docs and example code.
   - Provide example queries/actions integrating vector search into Nova26 agents for RAG-style context.

## New Patterns Nova26 Should Adopt

1. **Vector-Enhanced ATLAS Memory**
   - Use Convex vector search to index and retrieve past task outputs, patterns, and learnings when building prompts for agents like SUN, MERCURY, and MARS.[web:130][file:11]

2. **Convex-Backed Agent Context**
   - Model agent runs as threads in Convex using `get-convex/agent`, with context options that strike the right balance between recent history and search-based recall.[web:133][web:136]

3. **Tool-Driven Agents for Data Access**
   - Define Convex tools (via `createTool`) for common operations: fetching PRD status, listing failed tasks, reading UA Dashboard entities, etc.[web:133][web:136]
   - Enables Nova26's agents to act as thin planners around reliable, typed data access paths.

4. **Preview-First Dashboard Development**
   - Treat the Nova26 dashboard and UA views as preview-deployed Convex+frontend apps tied to branches.
   - Aligns with modern multi-env workflows and makes it easier to test changes to ATLAS visualizations.

## Recommendations for Nova26

- **Upgrade Convex early in the Nova26 roadmap**
  - Since Nova26 is not yet deployed, migrating from 1.16 to 1.31 carries low risk and unlocks important capabilities (vector search, agent toolkit).

- **Refactor ATLAS to use Convex Agent patterns**
  - Move build logs, decisions, and agent interactions from file-based `.nova/atlas` into Convex tables using the `get-convex/agent` primitives.[web:133][web:136][file:9][file:11]
  - This sets up better observability and debugging for multi-agent runs.

- **Leverage vector search for smarter prompts**
  - Add embeddings to ATLAS records and use `ctx.vectorSearch` to pull the most relevant prior patterns into new prompts.[web:130][file:11]

- **Design Nova26's future UI around Convex preview deployments**
  - Use Convex's environment support to power a Nova26 dashboard that can be safely iterated on branches and feature previews.

- **Document a clear 1.16 → 1.31 migration checklist**
  - Once concrete release notes and version numbers are fixed for Nova26, codify exact steps (package versions, CLI commands, schema diffs) in DEPLOYMENT and SCHEMA docs.

By upgrading to Convex 1.31 and embracing the agents + vector search features, Nova26 can turn its ATLAS layer into a production-ready memory and observability fabric for the Ralph Loop and the 21 agents.
