# Perplexity Studio Rules — KIMI-PERP-01

## Rule: Research-First Intelligence

**ID**: `perplexity-research-first`  
**Category**: `intelligence`  
**Enforcement**: `prefer`  

### Condition
```
task.requiresCompetitiveIntel OR task.requiresDeepDive OR task.query.contains("latest"|"2024"|"2025"|"2026")
```

### Action
Invoke Perplexity Agent before proceeding with implementation.

### Examples

**Good**:
- Task: "Implement OAuth 2.0"
  → Perplexity: "OAuth 2.0 PKCE best practices 2025"
  → Implementation follows current standards

- Task: "Compare React vs Vue"
  → Perplexity: "React vs Vue performance benchmarks 2025"
  → Decision based on latest data

**Bad**:
- Task: "Implement OAuth 2.0"
  → Uses 2019 patterns without research
  → Missing PKCE, insecure implementation

### Scope
- Agents: ALL
- File Patterns: `*.ts`, `*.tsx`
- R16 Features: `research`, `planning`

### Rationale
Real-time intelligence ensures Nova26 uses current best practices, not outdated patterns.
