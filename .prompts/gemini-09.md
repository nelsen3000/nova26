# Gemini Research Prompt — GEMINI-09
## Topic: AI-Native Testing & Quality Assurance

**Role**: You are a principal test infrastructure engineer specializing in AI-generated code quality, automated evaluation frameworks, and quality gate systems.

---

## Research Mission

Nova26's GANYMEDE agent writes tests, and our gate system validates agent output. We need to understand the frontier of AI-native testing — specifically, how to test code written by AI, how AI can write better tests, and what quality gate patterns stop hallucinations from shipping.

---

## Required Research Areas

### 1. AI Code Bug Taxonomy (2026)
- What types of bugs does AI-generated code most commonly introduce? (type errors, off-by-one, race conditions, security misconfigs, API misuse)
- Which bug classes are hardest for AI to self-detect vs. easy for static analysis?
- Nova26 relevance: which of GANYMEDE's test gaps should we target first?
- Research from: Anthropic, OpenAI evals, GitHub Copilot bug studies, DeepMind AlphaCode analysis

### 2. Auto-Fix Patterns
- How do Devin, SWE-bench agents, and Cursor fix their own bugs?
- Test-Fix-Retest loops: what's the best implementation pattern? (we have this in src/orchestrator/test-fix-retest-loop.ts)
- Repair agents: separate agent for fixing vs. same agent with retry?
- Error attribution: how do you trace a test failure back to the specific agent output that caused it?
- Mutation testing for AI: how does it differ from traditional mutation testing?

### 3. Eval Frameworks
Deep-dive on each:
- **Braintrust**: LLM eval platform — how to use for Nova26 gate scoring
- **LangSmith** (LangChain): prompt tracing + eval — how does it integrate with our LANGFUSE setup?
- **Promptfoo**: open-source LLM testing — CI/CD integration, red-teaming
- **Evals (OpenAI/Anthropic)**: first-party eval frameworks — what's new in 2026?
- **HELM** (Stanford): holistic evaluation — which scenarios matter for code agents?
- **HellaSwag / ARC / MMLU**: relevance to code quality specifically?

### 4. Quality Gate Patterns
For Nova26's gate system (`src/orchestrator/gate-runner.ts`):
- Gate hierarchy: what should be FATAL vs. WARNING vs. INFO?
- Confidence gates: how do you gate on LLM output confidence, not just deterministic checks?
- Coverage gates: what coverage threshold should GANYMEDE aim for in 2026? (80% is old news)
- Security gates: SAST tools that work with TypeScript/Python AI-generated code (Semgrep, CodeQL, Snyk)
- Performance gates: how to measure regression from baseline for AI-generated code?
- Semantic gates: does the code DO what the PRD says? (LLM-judged semantic correctness)

### 5. Priority Matrix
Top 10 quality improvements for Nova26's gate system, ranked by: (a) defect prevention value, (b) implementation effort, (c) user confidence boost.

---

## Output Format

```
## Executive Summary (3 bullets)
## 1. AI Code Bug Taxonomy
## 2. Auto-Fix Patterns
## 3. Eval Framework Comparison (table: Tool | Type | Nova26 Fit | Integration Effort)
## 4. Quality Gate Patterns (with severity classifications)
## 5. Priority Matrix
## 6. Recommended Gate Suite for Nova26 (specific gates to add/modify)
## 7. Open Questions for Jon
```

**Depth target**: 3,000-4,000 words.
Save output to: `.nova/research/gemini-09-ai-native-testing.md`
