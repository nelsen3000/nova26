# SERIES 6: Wave 2 Mid-Sprint — Hours 10-14

## GROK 4.2

Review Kimi's model routing implementation (src/llm/model-router.ts, src/llm/speculative-decoder.ts, src/llm/agent-profiles.ts).

Validate:
1. UCB Algorithm correctness: Is the Upper Confidence Bound formula implemented correctly? Does exploration/exploitation balance make sense for 21 agents × N models? Is the cold-start problem handled (new models with 0 data)?
2. Speculative decoding: Is the draft-verify pattern correct? Does acceptance rate tracking work? Is the decision to use/skip speculative decoding sound?
3. Agent profiles: Do the 21 agent profiles make sense? Is SUN (orchestrator) getting high-reasoning models? Is VENUS (frontend) getting code-gen models? Are cost budgets realistic?
4. Cost optimizer: Does budget enforcement work? What happens at 80%, 95%, 100% budget consumption? Are the automatic downgrade rules sensible?
5. Integration: Does the router integrate cleanly with the existing LLM client in src/llm/? Are there type mismatches?
6. Test quality: Are the 79+ tests comprehensive? Do they test convergence, edge cases, error paths?

OUTPUT: Detailed technical review with algorithm correctness assessment, integration issues, test gap analysis.

---

## GEMINI 3.1

GEMINI-10: Enterprise Self-Hosted Deployment research.

1. Docker/Kubernetes deployment: How to containerize Nova26 (Next.js + Convex + Ollama). Multi-container setup with docker-compose. K8s manifests for production. GPU node pools for Ollama.
2. SSO/RBAC: Enterprise auth patterns. SAML 2.0 / OIDC integration with Convex Auth. Role-based access control for teams (admin, developer, viewer). How to implement team-based isolation.
3. SOC 2 / FedRAMP considerations: What would Nova26 need for compliance? Audit logging requirements, data encryption at rest/in transit, access controls, incident response.
4. Air-gapped deployment: Can Nova26 run completely offline? Ollama provides local LLM. Convex needs cloud — what's the self-hosted alternative? (Consider: Convex self-hosted, or swap to PostgreSQL + Prisma for self-hosted).
5. Update management: How to handle updates in enterprise environments. Blue-green deployments, canary releases, rollback procedures. Schema migration strategy for Convex.

OUTPUT: Enterprise deployment architecture document with: Docker/K8s configs, SSO integration guide, compliance checklist, air-gap feasibility analysis, update strategy.

---

## CHATGPT 5.2

Write detailed API documentation for all Convex functions being built by Haiku 4.

Document each function in convex/dashboard.ts, convex/auth.ts, convex/realtime.ts, convex/users.ts:

For each function:
- Name and type (query/mutation/action)
- Description (what it does, when to use it)
- Parameters (name, type, required/optional, description, example value)
- Return type (full TypeScript type with field descriptions)
- Auth requirements (does it require authentication?)
- Example usage (React hook call with expected response)
- Error cases (what errors can it throw, when)
- Rate limits (if applicable)
- Related functions (what other functions are commonly used with this one)

Group by file. Include a "Quick Reference" table at the top with all function names, types, and one-line descriptions.

OUTPUT: Complete API documentation in markdown, suitable for docs/API.md.

---

## PERPLEXITY

Research real-time data patterns with Convex subscriptions + React 19.

1. Convex reactive queries: How do `useQuery` subscriptions work under the hood? WebSocket? Long polling? How does Convex handle reconnection after network drop?
2. Optimistic updates with Convex: How to implement optimistic mutations that update UI immediately before server confirms? `useMutation` with `optimisticUpdate` option — exact patterns.
3. Real-time activity feed patterns: Best practices for displaying a live-updating feed. Auto-scroll behavior, new item animations, handling high-frequency updates (debouncing/throttling), maximum items in DOM.
4. Presence indicators: How to show which users are online, cursor positions, "user is typing" indicators using Convex. Is there a built-in presence feature or do we need to build it?
5. Performance at scale: How does Convex handle 1000+ concurrent subscriptions? What's the recommended approach for dashboards with many real-time widgets?

OUTPUT: Implementation guide with exact code patterns for each real-time feature, performance recommendations, known limitations.
