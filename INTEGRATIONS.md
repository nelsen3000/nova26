# Nova26 Integrations Guide

## Overview

This document describes the 6 major integrations added to Nova26 based on the GitHub research report.

---

## 1. promptfoo - Quality Gates Engine

**Purpose:** Systematic testing of all 21 agent prompts with assertions and CI/CD integration.

**Files:**
- `promptfoo/promptfooconfig.yaml` - Test configuration for all agents

**Usage:**
```bash
# Run all agent quality tests
npx promptfoo@latest eval

# View results
npx promptfoo@latest view
```

**Tests Include:**
- VENUS outputs valid React with TypeScript
- MARS never uses `any` types
- PLUTO uses proper Convex schema conventions
- All agents produce expected output formats

---

## 2. instructor-js - Structured Output Validation

**Purpose:** Forces agents to return validated, structured data (Zod schemas) with auto-retry.

**Files:**
- `src/integrations/instructor/structured-output.ts`

**Usage:**
```typescript
import { generateVenusOutput, generateMarsOutput } from './integrations/instructor/structured-output';

// Get structured output with automatic validation
const result = await generateVenusOutput(`
  Create a LoginForm component
`);

console.log(result.component);     // Validated React code
console.log(result.uiStates);      // ['loading', 'error', 'success', 'default', 'empty']
console.log(result.accessibility); // { ariaLabels: true, keyboardNav: true, ... }
console.log(result.confidence);    // 0.95
```

**Benefits:**
- No more parsing guesswork
- Automatic retries on validation failure
- Type-safe agent outputs

---

## 3. Tremor - Agent Dashboard

**Purpose:** Real-time monitoring dashboard for all 21 agents.

**Files:**
- `src/integrations/dashboard/agent-status-dashboard.tsx`

**Components:**
- `AgentStatusTracker` - Visual status of all 21 agents (colored dots)
- `MetricsOverview` - KPI cards (builds, success rate, costs)
- `AgentDetailsTable` - Detailed agent activity
- `CostBreakdownChart` - Cost by agent (Donut chart)
- `BuildHistoryChart` - 7-day build history
- `TokenUsageChart` - 24h token usage

**Usage:**
```tsx
import { AgentDashboard } from './integrations/dashboard/agent-status-dashboard';

export default function DashboardPage() {
  return <AgentDashboard />;
}
```

---

## 4. fal-ai - Video Generation

**Purpose:** Unified API for 100+ video models (Kling, LTX-Video, Wan, etc.)

**Files:**
- `src/integrations/fal-ai/video-generation.ts`

**Usage:**
```typescript
import { generateVideoAndWait, VIDEO_MODELS, VIDEO_TEMPLATES } from './integrations/fal-ai/video-generation';

// Generate video from text
const result = await generateVideoAndWait({
  prompt: 'Developer working on code in modern office',
  model: 'KLING',
  duration: 10,
});

console.log(result.videoUrl);

// Use templates for Post-Production pipeline
const productVideo = await generateVideoAndWait(
  VIDEO_TEMPLATES.productDemo('Nova26', ['21 agents', 'TypeScript', 'Convex'])
);
```

**Models Available:**
- `KLING` - High quality (10s max)
- `LTX` - Fast generation (5s max)
- `WAN` - Open source (8s max)
- `SVD` - Image-to-video (4s max)

---

## 5. Agent Squad Patterns - Ralph Loop Enhancement

**Purpose:** Production-tested orchestration patterns from AWS multi-agent-orchestrator.

**Files:**
- `src/orchestrator/enhancements/agent-squad-integration.ts`

**Features:**
- `IntentClassifier` - Route tasks to correct agent automatically
- `ChainRouter` - Generate execution chains (quick/standard/complex)
- `Supervisor` - Execute chains with dependency management

**Usage:**
```typescript
import { IntentClassifier, ChainRouter, Supervisor } from './orchestrator/enhancements/agent-squad-integration';

// Classify user intent
const classifier = new IntentClassifier();
const result = classifier.classify('Create a login form with validation');
console.log(result.agentName); // 'VENUS'

// Generate execution chain
const router = new ChainRouter();
const chain = router.generateChain('Build e-commerce checkout', 'complex');

// Execute with supervision
const supervisor = new Supervisor(chain);
await supervisor.execute(async (step, context) => {
  return await callAgent(step.agent, step.task, context);
});
```

---

## 6. Magic UI - Landing Page

**Purpose:** Animated landing page components matching monday.com aesthetic.

**Files:**
- `src/integrations/magic-ui/landing-components.tsx`

**Components:**
- `Hero` - Animated hero section with gradient background
- `NumberTicker` - Animated counting statistics
- `BentoGrid` - Feature showcase grid
- `PipelineStages` - 3-stage pipeline cards (Pre/Post/Production)
- `FeatureShowcase` - Stats cards with number tickers
- `Nova26LandingPage` - Complete landing page

**Usage:**
```tsx
import { Nova26LandingPage } from './integrations/magic-ui/landing-components';

export default function LandingPage() {
  return <Nova26LandingPage />;
}
```

---

## Installation

All dependencies are already in `package.json`. Just run:

```bash
npm install --legacy-peer-deps
```

**Note:** `--legacy-peer-deps` is needed for React 19 compatibility with Tremor.

---

## Environment Variables

Add to `.env`:

```env
# fal.ai API key (for video generation)
FAL_API_KEY=your_fal_api_key

# Ollama (for promptfoo and instructor)
OLLAMA_HOST=http://localhost:11434
```

---

## Integration Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Nova26 Core                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   SUN        │  │  Ralph Loop  │  │  MERCURY     │      │
│  │ Orchestrator │  │  (enhanced)  │  │  Validator   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│  promptfoo   │   │  instructor  │   │ Agent Squad  │
│  (testing)   │   │  (validation)│   │  (patterns)  │
└──────────────┘   └──────────────┘   └──────────────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      UI Layer                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Tremor     │  │  Magic UI    │  │   fal.ai     │      │
│  │  Dashboard   │  │Landing Page  │  │Video Engine  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

---

## Next Steps

1. **Configure promptfoo**: Edit `promptfoo/promptfooconfig.yaml` with your test cases
2. **Set up fal.ai**: Get API key from https://fal.ai
3. **Create dashboard page**: Add `<AgentDashboard />` to your app
4. **Deploy landing page**: Use `<Nova26LandingPage />` as your homepage
5. **Enhance Ralph Loop**: Import patterns from `agent-squad-integration.ts`

---

*Integrations implemented based on GitHub research report*
*All packages are TypeScript-native and Ollama-compatible*
