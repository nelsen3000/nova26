# P-04: Compliance Requirements for Nova26 (SOC 2 Type II & ISO/IEC 42001)

## Overview

Nova26 is an AI-powered IDE that orchestrates multi-agent LLM workflows to read, write, and refactor user codebases, primarily in local environments (Node.js + Ollama) with an optional Convex-backed cloud component.[file:9][file:11] This profile maps closely to a SaaS developer tool that handles sensitive source code and potentially personal data. This document outlines what Nova26 needs to achieve SOC 2 Type II and ISO/IEC 42001 alignment, focusing on practical controls and design decisions rather than checkbox compliance.[web:147][web:150]

## 1. SOC 2 Type II: What It Means for an AI Coding Tool

- **Scope of SOC 2**
  - Evaluates controls mapped to the Trust Services Criteria: Security, Availability, Processing Integrity, Confidentiality, and Privacy.[web:147][web:150]
  - Type II tests not only design of controls but operating effectiveness over a period (typically 6–12 months).[web:147][web:150]
- Relevant systems for Nova26:
  - Source code repositories (GitHub, GitLab) and CI/CD pipelines.
  - Optional Convex backend (ATLAS data, dashboard, any cloud-hosted features).
  - Identity providers (e.g., Okta, Google Workspace) if used for hosted dashboards.
  - Logging & monitoring (SIEM, metrics, incident tooling).[web:147][web:153]

### 1.1 Key SOC 2 Control Themes for Nova26

- **Identity & Access Management (IAM)**
  - Enforce least privilege access for production Convex and any hosted Nova26 services.[web:147][web:150]
  - MFA for all admin accounts; SSO for enterprise tenants.[web:147][web:150]
  - Joiner/mover/leaver workflows; periodic access reviews (at least quarterly).[web:147][web:153]

- **Secure SDLC**
  - All changes to Nova26 code and Convex functions go through pull requests, code review, and approvals.[web:147][web:153]
  - Automated tests and static analysis integrated into CI (linting, type-checks, security scanning).
  - Documented release processes with rollback procedures.

- **Change Management**
  - Link production deploys to tickets; require approvals; maintain change logs.[web:147][web:153]
  - Segregate environments: dev, staging, production; restrict access to production configs.

- **Logging, Monitoring, & Incident Response**
  - Centralized logging for backend (Convex) and any orchestration services; capture admin actions, auth events, and errors.[web:147][web:153]
  - Documented incident response plan with clear severity levels, triage steps, and post-incident reviews.[web:147]

- **Data Protection**
  - Encryption in transit (TLS everywhere) and at rest (managed KMS for Convex storage, encrypted disks), especially for logs and ATLAS data.[web:147][web:150]
  - Data classification policies for code vs configuration vs personal data.
  - Retention and deletion policies for logs and customer data.

## 2. ISO/IEC 42001: AI Management System

ISO/IEC 42001 is an AI management system standard that extends classic ISMS/quality ideas (like ISO 27001) to AI-specific risks and governance.[web:134] For Nova26, the most relevant pillars are:

- **Risk Management for AI Systems**
  - Identify risks associated with LLM usage: data leakage, hallucinated code, biased outputs, unsafe suggestions.
  - Maintain a risk register with mitigation actions (quality gates, human review, safe defaults).

- **AI Lifecycle Governance**
  - Define processes for model selection, evaluation, deployment, monitoring, and deprecation.[web:134]
  - Document how Nova26 chooses models (local Ollama vs cloud APIs) and when to escalate to higher-capability models.

- **Transparency & User Control**
  - Clearly explain to users what Nova26 does, where data flows, and what is logged.
  - Provide configuration options: disable cloud calls, restrict telemetry, opt-in for hosted dashboards.

- **Data Management & Traceability**
  - Maintain traceability from user actions → LLM calls → generated changes → applied code, via ATLAS and logs.[file:9][file:11]
  - Provide mechanisms for reproducibility (e.g., capturing prompts, model versions, and inputs).

## 3. Nova26 Data Flow (Conceptual Diagram)

```mermaid
flowchart LR
  Dev[Developer IDE/CLI] -->|PRD + Commands| NovaCLI[Nova26 CLI]
  NovaCLI -->|LLM Calls| Ollama[(Local LLM)]
  NovaCLI -->|Optional API Calls| CloudLLM[(Cloud LLM APIs)]
  NovaCLI -->|Build Logs, Tasks| ATLAS[(Convex / .nova/atlas)]
  ATLAS -->|Dashboard Views| WebUI[Nova26 Dashboard]
  Dev -->|Code Push| GitHub[(Git Repo)]
  WebUI -->|Auth (SSO/OIDC)| IdP[(Identity Provider)]
```

- Local mode: all LLM calls and code operations stay on developer machine; only metadata may reach Convex if configured.[file:9]
- Hybrid mode: some LLM calls go to cloud providers; ATLAS and dashboard are hosted on Convex + frontend.

## 4. Gap Analysis: Nova26 vs SOC 2 & ISO 42001

### 4.1 Strengths

- Local-first design minimizes cloud exposure for source code.[file:9]
- PRD + Ralph Loop + ATLAS architecture already supports strong traceability for builds and decisions (foundation for audit trails).[file:9][file:11]

### 4.2 Gaps

- No formal IAM and RBAC model for hosted components (Convex dashboard, multi-tenant instances).
- No documented secure SDLC, change management, and incident response procedures.
- No explicit data classification or retention policies for ATLAS logs and telemetry.
- No explicit AI risk management process or AI governance committee.

## 5. Roadmap to SOC 2 Type II for Nova26

1. **Define Scope & Ownership**
   - Scope: hosted Nova26 services (Convex backend, dashboard), integrations to GitHub/GitLab, and any telemetry pipelines.[web:147][web:153]
   - Assign owners for security, compliance, infrastructure, and engineering.

2. **Establish Core Policies & Procedures**
   - Security policy, access control policy, change management, incident response, vendor management, backup & recovery, and acceptable use.
   - Map each policy to Trust Services Criteria (Security, Availability, etc.).[web:147][web:150]

3. **Implement Technical Controls**
   - Enforce SSO + MFA for admins and enterprise customers.
   - Configure centralized logging and metric collection (e.g., Datadog, OpenTelemetry + SIEM).
   - Harden Convex deployment (restricted IPs, secrets management, environment separation).

4. **Integrate Compliance into Nova26 Features**
   - Add audit logging in ATLAS for all LLM calls, agent decisions, gate failures, and approvals.[file:11]
   - Add configuration toggles: "local-only mode," "cloud-LLM allowed", "telemetry on/off".

5. **Run Readiness Assessment & Type I Audit**
   - Use a compliance platform or auditor to run a gap assessment.[web:147][web:153]
   - Perform a Type I SOC 2 report to validate control design.

6. **Operate Controls for ≥6 Months & Pursue Type II**
   - Collect evidence (access reviews, incident drills, change approvals) over the audit period.[web:147][web:150]
   - Undergo Type II audit with an external firm.

## 6. Roadmap to ISO/IEC 42001 Alignment

1. **Define an AI Management System (AIMS)**
   - Document the scope: Nova26 orchestrator, 21 agents, model router, ATLAS memory layer, and any hosted LLM integrations.[file:9][file:11]

2. **Perform AI Risk Assessment**
   - Identify risks (code corruption, insecure suggestions, data leakage, compliance violations) and map to controls (quality gates, test enforcement, approvals, data minimization).

3. **Establish AI Governance Roles**
   - Define responsibilities for AI owners (e.g., CTO, Head of Product, security lead) to approve models and evaluate new LLM providers.

4. **Document AI Lifecycle Processes**
   - Model selection and evaluation (benchmarks, red-teaming).
   - Deployment and rollback processes for new agents or gates.
   - Monitoring for model drift, performance regressions, and failure patterns.[web:134]

5. **Implement Transparency and User Controls**
   - In docs and UI, clearly describe:
     - Where code and prompts flow (local vs cloud).[file:9]
     - What logs are stored in ATLAS/Convex and for how long.[file:11]
     - How users can disable or restrict certain flows.

6. **Continuous Improvement Loop**
   - Use ATLAS data to identify recurring failure patterns (e.g., frequent MERCURY gate failures) and feed them into model and prompt improvements.

## Recommendations for Nova26

- **Treat observability and logging as first-class features**
  - Expand ATLAS and Convex usage to capture all relevant events (LLM calls, agent transitions, quality gate outcomes, approvals) with trace IDs.[file:11]

- **Design Nova26’s dashboard with compliance in mind**
  - Include views for audits: who ran what builds, which agents produced which outputs, where failures occurred.

- **Align product features with SOC 2 & ISO 42001**
  - Provide configuration knobs and clear docs so customers can run Nova26 in local-only mode or controlled hybrid mode.

- **Start with a lightweight AIMS**
  - Even before formal certification, start operating AI-specific risk management and governance processes that mirror ISO/IEC 42001 expectations.[web:134]

- **Plan for eventual certification**
  - After Nova26’s hosted components stabilize and gain users, pursue SOC 2 Type II and evaluate ISO/IEC 42001 certification, reusing evidence where possible.
