# SERIES 3: Wave 1 Support — Hours 4-8

## GROK 4.2

GROK-R22-02: Write the Shannon Patterns Adaptation spec.

Nova26 uses Shannon-inspired patterns from Kocoro-lab and KeygraphHQ reference architectures. Write a spec adapting these for Nova26's architecture.

Cover:
1. Temporal Replay Patterns — how to replay agent execution history for debugging and learning. Define: ReplayEvent type, ReplayStore interface, replay visualization data format. Integration with ATLAS meta-learner.
2. UCB Router Adaptation — Upper Confidence Bound algorithm for model routing. Define: UCBState type, exploration vs exploitation balance, how to handle cold-start (new models with no data). Integration with Kimi's model-router.ts.
3. WASI Sandbox Adaptation — since MicroVM was cut (no KVM on macOS), adapt sandbox patterns using WASI (WebAssembly System Interface). Define: SandboxConfig, resource limits, I/O isolation. What can WASI sandbox vs what needs trust-based isolation.
4. Information-theoretic agent selection — use Shannon entropy to measure agent uncertainty. Route tasks to agents with lowest entropy (highest confidence) for their task type.

OUTPUT: Full spec in Grok format (analogy opener, TypeScript interfaces, file paths, test strategy, open questions). Save as `.nova/specs/grok-r22-02-shannon-patterns.md`.

---

## GEMINI 3.1

GEMINI-08: Developer Productivity Metrics research.

1. DORA Metrics for AI IDEs: deployment frequency, lead time, change failure rate, MTTR. How to adapt these for an AI agent system where "deployments" are agent task completions?
2. SPACE Framework: Satisfaction, Performance, Activity, Communication, Efficiency. How to measure each for Nova26's 21-agent system.
3. Nova26-specific metrics: agent task success rate, model routing accuracy, cost per task, latency percentiles, code quality scores, test coverage delta per build.
4. Analytics dashboard design: which metrics to show on the Nova26 dashboard, visualization types (line charts for trends, bar charts for comparisons, gauges for current status), recharts component recommendations.
5. Benchmarking: how to compare Nova26's productivity against manual coding, single-agent IDEs (Cursor, Copilot), and other multi-agent systems.

OUTPUT: Metrics specification with: metric definitions, collection methods, visualization recommendations (recharts), dashboard wireframe description, benchmarking methodology.

---

## CHATGPT 5.2

Write docs/GETTING-STARTED.md for Nova26. Target: developer who's never seen the project.

Step-by-step:
1. Prerequisites: Node.js 20+, pnpm (why pnpm over npm/yarn), Ollama installed and running, Git
2. Clone + Install: exact commands, expected output, common errors
3. Configure Convex: create account, `npx convex dev` first run, what to expect, env vars to set
4. Configure Auth: set AUTH_SECRET, optional GitHub OAuth setup
5. Configure Ollama: which models to pull (`ollama pull qwen2.5-coder:7b`), verify with `ollama list`
6. Run Development Server: `npm run dev`, what URL to open, what you should see
7. Run Tests: `vitest run`, expected output (4,007+ tests passing), how to run specific test files
8. Project Tour: key directories explained, where to find agent templates, where to find specs
9. Your First Contribution: pick a task from TASK-BOARD.md, understand the domain map, make a change, run tests, submit PR
10. Troubleshooting: common issues (Convex connection fails, Ollama not running, TS errors after pull, test failures)

OUTPUT: Complete GETTING-STARTED.md ready to commit.

---

## PERPLEXITY

Research Vercel deployment for Next.js 15 + Convex backend.

1. Vercel configuration: `vercel.json` settings for Next.js 15, build command that includes `npx convex deploy`, environment variables needed (NEXT_PUBLIC_CONVEX_URL, CONVEX_DEPLOY_KEY, AUTH_SECRET)
2. Convex production deployment: `npx convex deploy` vs `npx convex dev`, production vs development URLs, how to manage schema migrations in production
3. Domain configuration: custom domain setup on Vercel, CORS configuration for Convex
4. CI/CD: GitHub Actions workflow for auto-deploy on push to main, running tests before deploy, Convex deploy as part of CI
5. Monitoring: Vercel Analytics setup, Convex dashboard monitoring, error tracking (Sentry integration?)
6. Cost: Vercel free tier limits, Convex free tier limits, when you'd need to upgrade

OUTPUT: Complete deployment guide with exact configuration files and commands. Draft DEPLOYMENT.md content.
