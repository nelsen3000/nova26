# Gemini-02: World-Class UX Patterns & Product Polish
## Source: Gemini Deep Research Round 02 (Feb 19, 2026)
## Status: Accepted

## Top 20 Must-Steal Patterns

1. **Optimistic Task Execution** (Linear) — show "Done" immediately, validate in background
2. **Multi-Agent Activity Stream** (Dynamic Island) — agent avatars pulsing/thinking
3. **Keyboard-First Command Palette** (Raycast) — `Cmd+K` with <10ms search
4. **Semantic Diff Previews** (Cursor/Aider) — intent diffs, not line diffs
5. **Sound-as-Feedback** (Linear/Slack) — subtle woodblock clicks on quality gate pass
6. **Progressive Complexity Disclosure** (Figma) — hide agent knobs until needed
7. **Zero-Config Onboarding** (Vercel) — `nova init` detects stack, generates first PRD
8. **AI Confidence Indicators** — color gradients (green→orange) behind agent output
9. **"Undo" Safety Net** (Gmail) — 5-second window to undo agent file changes
10. **Taste Vault Visualization** — "Personal Style Graph" showing learned patterns
11. **Collaborative Agent Cursors** — ghost cursors with agent names
12. **Stress-Free Error States** (Elm) — "Fix it for me" button on errors
13. **Context Breadcrumbs** — show which files were used as agent context
14. **Ambient Emotional Intelligence** — warmer UI colors during late-night sessions
15. **Local-First Sync Indicators** — "Privacy Shield" icon when Ollama is active
16. **Interactive Changelogs** — "Try this feature" terminal commands in release notes
17. **Skeleton-to-Code Transitions** — shimmer → rendered component morphing
18. **Usage-Based Cost Transparency** — real-time "Tokens/Cost Saved" counter
19. **Community Recipe Marketplace** — `nova share` for PRD templates
20. **Voice Command "Whisper" Mode** — double-tap Ctrl to dictate

## Implementation Roadmap

- Quick wins (<1 day): confetti on build complete, keyboard shortcut legend
- Medium wins (1 week): optimistic UI for tasks, subtle sound design
- Big bets (1 month+): Agent Council UI, Voice-to-PRD

## Anti-Patterns to Avoid
- No "Clippy" proactive suggestions outside Dream Mode
- No blocking spinners — all work async/optimistic
- No redundant status logs — use ambient progress bars
