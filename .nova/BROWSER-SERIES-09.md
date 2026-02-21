# SERIES 9: Wave 3 Mid-Sprint — Hours 18-22

## GROK 4.2

Review Llama 4 Maverick's Infinite Memory implementation (src/memory/) and AI Model Database (src/model-db/).

Memory system review:
1. Hierarchy correctness: Does L1→L2→L3 promotion/demotion work? Are capacity limits enforced? Does LRU eviction trigger at the right thresholds?
2. Retrieval quality: Does keyword search return relevant results? Is TF-IDF scoring correct? Does the hybrid retrieval strategy produce sensible rankings?
3. Compression: Does merge correctly identify similar items (>80% overlap)? Does summarization preserve key information? Does archive/restore round-trip work?
4. Persistence: Is JSON serialization correct? Can the memory store survive a restart? Is file I/O handled safely (atomic writes, corruption recovery)?

Model database review:
1. Registry correctness: Are the pre-populated model entries accurate (pricing, capabilities, limits)? Are they up-to-date for Feb 2026?
2. Capability matching: Does the matching algorithm correctly rank models for given requirements? Does it respect hard constraints (context window, provider)?
3. Cost calculation: Are cost estimates accurate? Does the cheapest-model finder work correctly?
4. Integration: Does it integrate cleanly with Kimi's model router? Are types compatible?

OUTPUT: Technical review with correctness assessment for both modules, integration validation, data accuracy check.

---

## GEMINI 3.1

GEMINI-14: Edge AI & On-Device Inference research.

1. Apple Silicon optimization: MLX framework for running models on M-series chips. Which models run well on M1/M2/M3/M4? Performance benchmarks. How to integrate MLX with a TypeScript app (FFI? subprocess? HTTP server?).
2. NVIDIA NIM: NVIDIA's inference microservices. How to run locally with a GPU. Container-based deployment. Which models are available? Latency comparison vs Ollama.
3. Ollama deep dive: Current state of Ollama (Feb 2026). New models available. Performance optimizations. Multi-model serving (run multiple models simultaneously). GPU memory management.
4. On-device fine-tuning: Can we fine-tune models on the developer's machine? LoRA/QLoRA with MLX. Training data from agent task history (ATLAS meta-learner data). Privacy benefits.
5. Hybrid cloud/edge: When to run locally vs when to call cloud APIs. Decision factors: latency requirements, cost, privacy, model capability. How to implement seamless fallback (local model fails → cloud API).
6. TinyML for agent routing: Can a tiny model (< 100MB) make routing decisions? Train a classifier on task type → best model mapping. Run it locally for zero-latency routing.

OUTPUT: Research report with: MLX integration guide, Ollama optimization recommendations, hybrid routing architecture, fine-tuning feasibility analysis, TinyML routing prototype design.

---

## CHATGPT 5.2

Write a comprehensive security guide for Nova26.

Document:
1. Authentication: Convex Auth implementation, session management, token handling, password hashing (Convex handles this), OAuth flow security.
2. Authorization: Role-based access control design. Roles: admin (full access), developer (read/write own data), viewer (read-only). How to implement in Convex functions.
3. Data Protection: What data is stored (user profiles, build history, agent activity, API keys). Encryption at rest (Convex handles). Encryption in transit (HTTPS). PII handling.
4. API Key Security: How API keys are stored (encrypted in Convex, never sent to client). How to rotate keys. How to revoke compromised keys.
5. Input Validation: All user input validated via Convex validators. XSS prevention (React handles by default, but watch for dangerouslySetInnerHTML). CSRF protection.
6. Agent Security: How to prevent agents from accessing unauthorized resources. Sandboxing agent execution. Rate limiting agent API calls. Monitoring for anomalous agent behavior.
7. Dependency Security: npm audit, Dependabot/Renovate for automated updates, supply chain attack prevention.
8. Incident Response: What to do if a security issue is found. Contact information. Disclosure policy.

OUTPUT: Complete SECURITY.md ready to commit.

---

## PERPLEXITY

Research monitoring and observability for Next.js 15 + Convex applications.

1. Vercel Analytics: What metrics does it provide? Real User Monitoring (RUM)? Web Vitals (FCP, LCP, CLS, INP)? How to set up for Next.js 15?
2. Convex Dashboard: What monitoring does Convex provide built-in? Function execution logs, error rates, latency percentiles, database size. How to access programmatically?
3. Error tracking: Sentry integration with Next.js 15 + Convex. How to capture: client-side errors, server-side errors, Convex function errors. Source maps for production debugging.
4. Custom metrics: How to track Nova26-specific metrics (agent task completion rate, model routing decisions, cost per build). Where to store them (Convex table? External service?).
5. Alerting: How to set up alerts for: error rate spikes, latency degradation, budget threshold exceeded, build failures. Email/Slack/webhook notifications.
6. Logging: Structured logging in Next.js + Convex. Log levels, log aggregation, searching logs. Pino vs Winston for Next.js.

OUTPUT: Monitoring setup guide with exact configuration for Vercel Analytics, Sentry, custom metrics, and alerting.
