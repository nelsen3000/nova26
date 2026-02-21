# Gemini Research Prompt — GEMINI-11
## Topic: AI Design Systems & Component Generation

**Role**: You are a principal design systems engineer with expertise in AI-native UI generation, design tokens, component libraries, and screenshot-to-code pipelines.

---

## Research Mission

Nova26's VENUS agent generates UI components. We need to understand the state of the art in AI-assisted design systems — specifically, how to make VENUS generate production-quality components that match a brand design system, not just boilerplate Tailwind.

---

## Required Research Areas

### 1. Design Token Systems (2026)
- W3C Design Token Community Group spec — what's the standard format in 2026?
- Style Dictionary vs. Theo vs. Tokens Studio — which integrates best with shadcn/ui and Tailwind?
- Multi-brand token architecture: how to support white-label Nova26 (enterprise customers with their own brand)
- Dark mode token strategy: semantic tokens (bg-primary vs. gray-900) — the right patterns
- Animation tokens: how to encode motion design into tokens (Spring, duration, easing)
- How to feed design tokens to an LLM for component generation (token-aware prompting)

### 2. AI Component Generation Pipelines
Deep-dive on each:
- **Vercel v0**: prompt→component pipeline, what makes it good, what are its limits?
- **Galileo AI**: design-to-component, how does it handle real-world complexity?
- **Screenshot-to-code** (Nutlope/Claude): image→React+Tailwind, accuracy in 2026
- **Builder.io**: visual editor + AI generation — enterprise usage patterns
- **Figma Dev Mode + MCP**: design hand-off via MCP tool server — current state?
- **Locofy/Anima**: Figma→code tools — are they still relevant vs. pure LLM generation?

### 3. Multi-Screen Journey Generation
- How to generate a COHERENT multi-screen user journey (not just one component at a time)?
- State machines for UI (XState) — does VENUS need to understand state before generating?
- Navigation patterns: how does an AI know when to use drawer vs. modal vs. page navigation?
- Component composition: how to make AI understand compound components vs. primitives?
- Design system compliance scoring: how to automatically score a generated component against brand guidelines?

### 4. VENUS Agent Improvements
Based on the research, what should change in Nova26's VENUS agent?
- Better prompt templates for component generation
- Design token injection into prompts
- Component complexity scoring (when to split into sub-components?)
- Storybook integration: auto-generate stories for every component VENUS creates
- Visual regression testing: how to catch VENUS regressions before shipping?
- figma-to-prompt pipeline: if user pastes a Figma link, how does VENUS use it?

### 5. Priority Matrix
Top 10 design system improvements for Nova26, ranked by: (a) component quality impact, (b) developer experience, (c) enterprise value.

---

## Output Format

```
## Executive Summary (3 bullets)
## 1. Design Token System Recommendations
## 2. AI Component Generation Pipeline Comparison (table)
## 3. Multi-Screen Journey Generation Patterns
## 4. VENUS Agent Improvement Roadmap
## 5. Priority Matrix
## 6. Concrete VENUS Prompt Improvements (before/after examples)
## 7. Open Questions for Jon
```

**Depth target**: 3,000-4,000 words. Include specific prompt templates where relevant.
Save output to: `.nova/research/gemini-11-ai-design-systems.md`
