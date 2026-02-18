# Security & Compliance

NOVA26 is designed for enterprise-grade security and compliance alignment (SOC 2 Type II, ISO 42001).

## 1. Threat Model

We identify and mitigate the following key risks:

| Risk | Description | Mitigation |
|------|-------------|------------|
| **Prompt Injection** | Malicious instructions in user prompts affecting agent behavior. | **System Prompts**: Locked XML structures in agent definitions. **MERCURY Gate**: Validates outputs against safety specs. |
| **Code Exfiltration** | Sensitive code sent to cloud LLMs. | **Local Tier**: Run entirely on Ollama/local hardware. **`.novaignore`**: Prevents reading sensitive files (env, keys). |
| **Runaway Costs** | Infinite loops or excessive token usage. | **Budget Limits**: `NOVA26_BUDGET` hard stop. **Ralph Loop**: Max iteration caps. |
| **Insecure Code** | Agents generating vulnerabilities (XSS, SQLi). | **ENCELADUS Agent**: Dedicated security review step. **Security Gate**: Automated static analysis (SAST) on outputs. |

## 2. Data Flow

```
User --> Prompt --> CLI --> Agent --> Model Router
                                        |
                            +-----------+-----------+
                            |                       |
                      Tier: Free              Tier: Paid
                      (Local Ollama)          (OpenAI/Anthropic)
                            |                       |
                            +----------+------------+
                                       |
                                  Quality Gates
                                       |
                            +----------+----------+
                            |                     |
                          Pass                  Fail
                       (File System)         (Retry Loop)
                            |
                       ATLAS Event Store
                        (Convex Cloud)
```

## 3. SOC 2 Roadmap

Based on research document P-04, NOVA26 is building towards SOC 2 readiness.

### Current Controls (Phase 1)
- **Audit Logging**: All LLM calls, costs, and gate results are logged to ATLAS (Convex) with trace IDs.
- **Access Control**: Role-based agent permissions (defined in `hard-limits.json`).
- **Encryption**: Secrets management via `.env` (never committed).

### Planned Controls (Phase 2 - 6 Months)
- **SSO Integration**: For the web dashboard.
- **Change Management**: Enforced "Council Approval" step for critical path changes.
- **Incident Response**: Automated alerts via the MIMAS resilience agent.

## 4. ISO 42001 (AI Management System)

NOVA26 aligns with ISO/IEC 42001 by implementing:

- **AI Risk Assessment**: The MERCURY agent acts as a continuous risk validator.
- **Transparency**: The ATLAS event store provides full traceability of why an agent made a decision.
- **Human Oversight**: The Ralph Loop supports "Plan Approval" mode, requiring human sign-off before execution.
