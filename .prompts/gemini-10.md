# Gemini Research Prompt — GEMINI-10
## Topic: Enterprise Self-Hosted Deployment

**Role**: You are a principal platform engineer specializing in enterprise software deployment, compliance, and on-premise AI infrastructure.

---

## Research Mission

Nova26's $45/month "Sovereign Tier" (from GEMINI-04) requires self-hosting. We need a complete blueprint for enterprise deployment that satisfies Fortune 500 security requirements, SOC 2 compliance, and air-gap capability.

---

## Required Research Areas

### 1. Container & Orchestration Strategy
- Docker Compose vs. Kubernetes for Nova26 self-hosted — when does each make sense?
- Helm chart design for Nova26 (what services need pods: Next.js, Convex, Redis, BullMQ, Ollama?)
- Health checks, readiness probes, graceful shutdown for AI workloads
- GPU node configuration for local model inference (CUDA vs. ROCm vs. Apple MPS)
- Resource requests/limits for LLM inference pods (memory, CPU, GPU)
- Horizontal scaling: which Nova26 components can scale horizontally? Which can't?

### 2. Authentication & Access Control
- SSO integration options: SAML 2.0, OAuth 2.0, OpenID Connect — which providers matter in enterprise? (Okta, Azure AD, Google Workspace)
- RBAC design for Nova26: what roles are needed? (Admin, Developer, Viewer, Agent-Manager)
- API key management: how to rotate agent API keys without downtime?
- Audit logging: every user action + agent action must be logged (SOC 2 requirement)
- Zero-trust network: how to enforce agent-to-agent auth in a self-hosted cluster?

### 3. Compliance & Certifications
- **SOC 2 Type II**: what Nova26 systems need to be in scope? Which controls are most relevant?
- **FedRAMP Ready**: what would it take? (for US government customers)
- **GDPR / EU AI Act (Article 86)**: data residency for self-hosted — what logs stay on-prem?
- **HIPAA**: what if a healthcare customer wants to use Nova26? What changes?
- **ISO 27001**: certification roadmap — Phase 1 (policies), Phase 2 (controls), Phase 3 (audit)
- Practical: which compliance frameworks give the most enterprise sales leverage with least effort?

### 4. Air-Gap & Data Sovereignty
- Full air-gap: running Nova26 with NO external API calls (Ollama for all models, local Convex, no Langfuse cloud)
- Data residency: how to ensure no data leaves customer VPC?
- Model weights storage: where do Qwen 3.5 Coder weights live? S3 compatible storage? NFS?
- Update management: how does an air-gapped enterprise get security patches?
- Offline documentation: how to serve Nova26 docs on-prem?

### 5. Priority Matrix
Top 10 enterprise deployment features ranked by: (a) sales unblock value, (b) implementation effort, (c) compliance requirement frequency.

---

## Output Format

```
## Executive Summary (3 bullets)
## 1. Container Strategy (Docker Compose vs. K8s decision tree)
## 2. Auth & RBAC Design (interfaces + role matrix)
## 3. Compliance Roadmap (table: Framework | Scope | Phase | Effort)
## 4. Air-Gap Architecture
## 5. Priority Matrix
## 6. Nova26 docker-compose.yml skeleton
## 7. Open Questions for Jon
```

**Depth target**: 3,000-4,000 words. Include concrete YAML/config examples.
Save output to: `.nova/research/gemini-10-enterprise-deployment.md`
