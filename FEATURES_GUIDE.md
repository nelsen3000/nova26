# NOVA26 Feature Guide
## Complete Overview of New Capabilities

---

## 📚 Table of Contents
1. [168 Skills System](#1-168-skills-system)
2. [Swarm Mode](#2-swarm-mode)
3. [Model Router (Free/Paid Toggle)](#3-model-router)
4. [Chain of Reasoning](#4-chain-of-reasoning)
5. [Extended Slash Commands](#5-extended-slash-commands)
6. [Integration Examples](#6-integration-examples)

---

## 1. 168 Skills System

### What It Is
A modular knowledge library where each skill is a self-contained expertise pack. Skills auto-activate when relevant to your task, injecting proven patterns, code examples, and best practices directly into agent prompts.

### How It Works
```
User: "Build a Stripe checkout flow"
      ↓
System detects keywords: "stripe", "checkout", "payment"
      ↓
Auto-loads: stripe-integration skill
      ↓
Agents receive:
  - Stripe webhook handling patterns
  - PCI compliance guidelines
  - Error handling for failed payments
  - Example: 3D Secure implementation
```

### Skill Structure
Each skill contains:
```
.nova/skills/stripe-integration/
├── SKILL.md              # Overview and guidelines
├── patterns/
│   ├── webhook-handler.ts    # Reusable code patterns
│   ├── checkout-session.ts
│   └── error-handling.ts
└── examples/
    ├── basic-checkout.tsx      # Working examples
    └── subscription-flow.tsx
```

### Skill Categories

#### 💳 Payments (12 skills)
- `stripe-integration` - Checkout, subscriptions, webhooks
- `apple-pay` - iOS payment integration
- `google-pay` - Android payment integration
- `paypal` - PayPal checkout flow
- `adyen` - Enterprise payment processing
- `square` - Point-of-sale integration

**When to use:** Any e-commerce, subscription, or payment feature

#### 🔐 Authentication (15 skills)
- `convex-auth` - Built-in Convex authentication
- `clerk` - Modern auth provider
- `auth0` - Enterprise identity platform
- `oauth2` - Social login (Google, GitHub, etc.)
- `jwt-tokens` - Token-based authentication
- `magic-links` - Passwordless authentication
- `mfa-2fa` - Multi-factor authentication

**When to use:** Login systems, protected routes, user management

#### 🤖 AI/ML (18 skills)
- `openai` - GPT-4, DALL-E integration
- `anthropic-claude` - Claude API integration
- `langchain` - LLM orchestration
- `vector-databases` - Pinecone, Weaviate
- `ai-content-moderation` - Content filtering
- `ai-embeddings` - Semantic search
- `ai-chatbots` - Conversational interfaces
- `ai-image-generation` - DALL-E, Midjourney
- `ai-text-analysis` - Sentiment, classification

**When to use:** AI features, chatbots, content generation, search

#### 📱 Mobile (10 skills)
- `react-native` - Cross-platform mobile
- `flutter` - Dart-based mobile framework
- `ios` - Swift/iOS native
- `android` - Kotlin/Android native
- `push-notifications` - Firebase, APNs
- `mobile-offline` - Offline-first patterns
- `mobile-camera` - Camera integration
- `mobile-maps` - Mapbox, Google Maps

**When to use:** Mobile apps, responsive PWA features

#### 🗄️ Databases (12 skills)
- `convex` - Real-time sync database
- `postgresql` - Relational database
- `mongodb` - Document database
- `redis` - Caching and sessions
- `prisma-orm` - Database ORM
- `database-migrations` - Schema versioning
- `database-optimization` - Query tuning

**When to use:** Data persistence, caching, complex queries

#### 🚀 DevOps (14 skills)
- `docker` - Containerization
- `kubernetes` - Container orchestration
- `terraform` - Infrastructure as code
- `github-actions` - CI/CD pipelines
- `aws` - Amazon Web Services
- `gcp` - Google Cloud Platform
- `vercel` - Frontend deployment
- `monitoring` - Observability stack

**When to use:** Deployment, scaling, infrastructure

#### 🧪 Testing (10 skills)
- `vitest` - Unit testing
- `playwright` - E2E testing
- `cypress` - Browser testing
- `react-testing-library` - Component testing
- `mocking` - Test doubles
- `snapshot-testing` - UI regression testing

**When to use:** Ensuring code quality, preventing regressions

### Using Skills

```bash
# List all available skills
/skills

# View specific skill details
/skill stripe-integration

# Skills auto-load based on task description
/swarm "Build a SaaS with Stripe billing"
# → Auto-loads: stripe-integration, convex-auth, subscription-management
```

---

## 2. Swarm Mode

### What It Is
Swarm Mode repurposes NOVA26's 21 specialized agents to complete ANY task - not just app building. Agents collaborate like a team of experts working together.

### Swarm vs App Mode

| Aspect | App Mode | Swarm Mode |
|--------|----------|------------|
| **Purpose** | Build applications | Complete any task |
| **Input** | PRD file | Natural language description |
| **Output** | Full codebase | Task-specific deliverables |
| **Agents Used** | Based on task type | Dynamically selected |
| **Process** | Phased (0→4) | Collaborative |

### How It Works

```
User: /swarm "Create a technical blog post about React Server Components"

SUN (Orchestrator)
    ↓
EARTH (Requirements) - Clarifies scope, target audience
    ↓
URANUS (Research) - Gathers latest RSC information
    ↓
ANDROMEDA (Ideas) - Brainstorms angles and structure
    ↓
JUPITER (Architecture) - Decides content outline
    ↓
MARS (Implementation) - Writes the actual content
    ↓
VENUS (Presentation) - Formats with code examples
    ↓
MERCURY (Validation) - Reviews for accuracy
    ↓
CALLISTO (Documentation) - Final formatting
    ↓
Complete blog post delivered
```

### Swarm Commands

```bash
# Quick swarm - 3 agents, fast results
/swarm "Fix TypeScript error in auth hook" --quick
Agents: SUN → MARS → MERCURY
Time: ~2-5 minutes

# Full swarm - All 21 agents, comprehensive
/swarm "Design a microservices architecture" --full
Agents: All 21 collaborating
Time: ~15-30 minutes

# Adaptive swarm - System decides complexity
/swarm "Build a landing page"
# System analyzes: "This is medium complexity"
# Uses: SUN, EARTH, MARS, VENUS, MERCURY
```

### Swarm Agent Roles

| Agent | Swarm Role | Activates When |
|-------|-----------|----------------|
| ☀️ SUN | Task Coordinator | Always |
| 🌍 EARTH | Requirements Analyst | Complexity > simple |
| 🔭 URANUS | Knowledge Gatherer | Research needed |
| 🌌 ANDROMEDA | Creative Ideator | Brainstorming phase |
| 🟠 JUPITER | Strategy Advisor | Complex decisions |
| 🪐 PLUTO | Data Architect | Data storage needed |
| 🔴 MARS | Implementation Specialist | Always |
| 💫 VENUS | Interface Designer | UI deliverables |
| 🌙 TITAN | Real-time Handler | Live updates needed |
| 🌊 EUROPA | Mobile Optimizer | Mobile requirements |
| ☿️ MERCURY | Quality Gatekeeper | Always |
| 🪐 SATURN | Verification Specialist | Testing needed |
| 🔵 NEPTUNE | Metrics Collector | Analytics needed |
| 📚 ATLAS | Pattern Recorder | Always |
| 🛡️ MIMAS | Resilience Planner | Error handling needed |
| 📝 CALLISTO | Documentation Writer | Docs deliverables |

### Real-World Swarm Examples

```bash
# Content Creation
/swarm "Write a pitch deck for a fintech startup"
→ EARTH: Defines value proposition
→ URANUS: Researches market
→ ANDROMEDA: Brainstorms hooks
→ MARS: Writes slides
→ VENUS: Designs layout
→ MERCURY: Reviews messaging

# Code Review
/swarm "Review this codebase for security issues" --quick
→ MARS: Scans for vulnerabilities
→ ENCELADUS: Security analysis
→ MERCURY: Validates findings
→ CALLISTO: Documents recommendations

# Architecture Design
/swarm "Design a real-time chat system for 1M users" --full
→ EARTH: Requirements gathering
→ URANUS: Research scaling patterns
→ JUPITER: Architecture decisions
→ PLUTO: Database schema
→ TITAN: Real-time sync design
→ IO: Performance optimization
→ MIMAS: Failure mode analysis
→ SATURN: Load testing plan

# Learning/Research
/swarm "Explain quantum computing to a 10-year-old"
→ URANUS: Researches quantum concepts
→ ANDROMEDA: Finds analogies
→ MARS: Simplifies explanations
→ VENUS: Creates visual examples
→ CALLISTO: Structures the lesson
```

---

## 3. Model Router (Free/Paid Toggle)

### What It Is
A unified interface to switch between local free models (Ollama) and paid cloud APIs (OpenAI/Anthropic) based on your needs and budget.

### The Three Tiers

#### 🆓 Free Tier (Ollama - Local)
**Cost:** $0 forever
**Best for:** Development, prototyping, simple tasks
**Requirements:** Ollama installed locally

```bash
/tier free
```

**Available Models:**
| Model | Speed | Quality | Best For |
|-------|-------|---------|----------|
| qwen2.5:7b | Fast | Good | Quick iterations, simple code |
| qwen2.5:14b | Medium | Good | Complex code, analysis |
| llama3:8b | Fast | Good | General tasks, chat |
| codellama:7b | Fast | Good | Code completion, refactoring |
| deepseek-coder:6.7b | Fast | Good | Code generation, debugging |

**Pros:**
- Zero API costs
- No internet required (after download)
- Private - data stays local
- Unlimited usage

**Cons:**
- Requires powerful hardware (16GB+ RAM recommended)
- Slower than cloud APIs
- Lower quality on complex reasoning

---

#### 💎 Paid Tier (OpenAI/Anthropic - Cloud)
**Cost:** ~$0.50-$5.00 per complex build
**Best for:** Production code, complex reasoning, tight deadlines
**Requirements:** API keys in environment

```bash
/tier paid
```

**Available Models:**
| Model | Speed | Quality | Cost/1K tokens | Best For |
|-------|-------|---------|----------------|----------|
| gpt-4o-mini | Fast | Good | $0.00015 | Quick tasks, simple code |
| gpt-4o | Medium | Excellent | $0.0025 | Complex code, architecture |
| o1-mini | Slow | Excellent | $0.003 | Complex reasoning, debugging |
| claude-3-haiku | Fast | Good | $0.00025 | Quick tasks, summarization |
| claude-3-sonnet | Medium | Excellent | $0.003 | Complex code, analysis |
| claude-3-opus | Slow | Excellent | $0.015 | Most complex tasks, research |

**Pros:**
- Highest quality outputs
- Fast response times
- No local hardware requirements
- Better at complex reasoning

**Cons:**
- Costs money per use
- Requires internet connection
- Data sent to external APIs
- Rate limits apply

---

#### 🔄 Hybrid Tier (Smart Switching)
**Cost:** Variable - optimizes for cost/quality
**Best for:** Most users - balances budget and quality

```bash
/tier hybrid
```

**How it works:**
```
Task: "Fix typo in README"
→ Detected: Simple task
→ Uses: qwen2.5:7b (free)
→ Cost: $0

Task: "Implement authentication system"
→ Detected: Medium complexity
→ Uses: llama3:8b (free)
→ Cost: $0

Task: "Design distributed system architecture"
→ Detected: Complex task
→ Uses: gpt-4o (paid)
→ Cost: ~$0.50
```

**Pros:**
- Cost-effective
- Maintains quality where needed
- Automatic optimization

**Cons:**
- Requires both Ollama and API keys
- Slightly more complex setup

---

### Model Commands

```bash
# Switch tiers
/tier free
/tier paid
/tier hybrid

# Select specific model
/model qwen2.5:7b
/model gpt-4o
/model claude-3-sonnet

# View current model
/model
# Output:
# Current model: qwen2.5:7b
#   Provider: ollama
#   Context: 128k tokens
#   Speed: fast
#   Quality: good

# Compare all models
/models
# Shows detailed comparison table

# Estimate cost for a task
/swarm "Build a social media app"
# Output includes:
#   Estimated cost: ~$2.50 (paid tier)
#   or
#   Cost: Free (local model)
```

### Setting Up API Keys

```bash
# Add to .env or export in shell
export OPENAI_API_KEY="sk-..."
export ANTHROPIC_API_KEY="sk-ant-..."

# Or set preferred tier via environment
export NOVA26_TIER="hybrid"
export NOVA26_MODEL="gpt-4o"
```

### When to Use Each Tier

| Scenario | Recommended Tier | Why |
|----------|------------------|-----|
| Learning/experimenting | Free | No costs, unlimited tries |
| Prototyping | Free or Hybrid | Fast iteration, upgrade if stuck |
| Production code | Paid | Highest quality, fewer bugs |
| Tight deadline | Paid | Faster, more reliable |
| Complex architecture | Paid (Claude 3 Opus) | Best reasoning capabilities |
| Simple tasks | Free | Waste of money to use paid |
| Mixed project | Hybrid | Optimal cost/quality balance |

---

## 4. Chain of Reasoning

### What It Is
Every agent now explains its decision-making process - not just WHAT it's doing, but WHY. This transparency helps you understand, trust, and learn from the AI.

### The Five Elements

```
🧠 Chain of Reasoning:

📍 Context
   What situation triggered this action
   
🔍 Analysis  
   How the agent analyzed the situation
   
💡 Decision
   Why this specific approach was chosen
   
🔄 Alternatives Considered
   What other options were evaluated
   
✅ Confidence
   How certain the agent is (HIGH/MEDIUM/LOW)
```

### Example Reasoning Chains

#### EARTH (Requirements Analyst)
```
📍 Context: Task "Build user authentication" is at Phase 0 
            (planning phase), requiring detailed specification

🔍 Analysis: This feature involves user interactions (login/signup),
            data storage (user records), security (passwords),
            and business logic (sessions). Without clear 
            requirements, implementation agents would make 
            inconsistent assumptions about scope.

💡 Decision: Creating comprehensive PRD with Gherkin scenarios
            ensures all edge cases considered upfront and
            provides testable acceptance criteria.

🔄 Alternatives:
   • Skip spec, let MARS figure it out (too risky)
   • Create minimal one-liner description (too vague)
   • Let VENUS design UI first (would miss backend requirements)

✅ Confidence: HIGH
```

#### MARS (Backend Developer)
```
📍 Context: Schema from PLUTO is ready, EARTH has defined
            requirements. Implementation can begin.

🔍 Analysis: Feature requires CRUD operations with 
            authentication checks. User data must be
            protected with row-level security.

💡 Decision: Following 5-step mutation pattern ensures
            consistent security and error handling.
            Strong typing prevents runtime errors.

🔄 Alternatives:
   • Use simpler functions without auth (security risk)
   • Skip validation for speed (data integrity risk)
   • Use REST instead of Convex (lose real-time benefits)

✅ Confidence: HIGH
```

#### JUPITER (Architect)
```
📍 Context: Complex feature with multiple implementation
            options that will impact system long-term.

🔍 Analysis: Microservices vs monolith tradeoffs involve
            team size, deployment complexity, scalability
            needs, and operational overhead.

💡 Decision: Modular monolith provides balance - 
            clear boundaries for future extraction,
            simpler deployment now, lower complexity.

🔄 Alternatives:
   • Full microservices (operational overhead too high)
   • Pure monolith (harder to scale later)
   • Serverless functions (vendor lock-in concerns)

⚠️ Confidence: MEDIUM (architecture involves uncertainty)
```

#### ANDROMEDA (Ideation)
```
📍 Context: Feature requirements are clear but multiple
            UX approaches possible.

🔍 Analysis: First ideas are often conventional. Users
            may benefit from unconventional solutions.

💡 Decision: Exploring 5 alternative interaction patterns
            before converging on optimal solution.

🔄 Alternatives:
   • Skip ideation, go with first idea (faster but narrower)
   • Unlimited brainstorming (no convergence)
   • Copy competitors (no differentiation)

🔍 Confidence: LOW (ideation is inherently uncertain)
```

### Viewing Reasoning

```bash
# During build, press 'r' to see reasoning
Building feature X...
[Press 'r' for reasoning]

# Or use commands
/reasoning MARS          # Show reasoning for specific agent
/explain VENUS --reasoning   # Show explanation + reasoning

# View in web interface
# Click "Show Reasoning" on any agent card
```

### Why Reasoning Matters

1. **Trust**: Understand why decisions were made
2. **Learning**: See how experts approach problems
3. **Debugging**: Identify when reasoning is flawed
4. **Collaboration**: Discuss alternatives with AI
5. **Documentation**: Decisions are self-documenting

---

## 5. Extended Slash Commands

### Complete Command Reference

#### 🐝 Swarm Mode Commands

```bash
/swarm "task description" [--quick|--full]
```
Activates multiple agents to complete a task collaboratively.

```bash
/swarm "Create a landing page"
# Adaptive mode - system chooses agent count

/swarm "Fix this bug" --quick
# 3 agents (SUN, MARS, MERCURY)
# Fast, for simple tasks

/swarm "Design system architecture" --full
# All 21 agents
# Comprehensive, for complex tasks
```

---

```bash
/agents
```
Shows all 21 agents with their status and roles.

```
☀️  SUN      Orchestrator       Active
🌍 EARTH    Product Specs      Ready
🔴 MARS     Backend            Ready
💫 VENUS    Frontend           Active
☿️ MERCURY Validation          Ready
...
```

---

#### 🤖 Model Control Commands

```bash
/tier [free|paid|hybrid]
```
Switches between pricing tiers.

```bash
/tier free     # $0, local Ollama models
/tier paid     # API costs, cloud models
/tier hybrid   # Smart switching
```

---

```bash
/model [model-name]
```
Selects specific model.

```bash
/model                    # Show current model
/model qwen2.5:7b        # Fast, free
/model gpt-4o            # High quality, paid
/model claude-3-opus     # Best reasoning
```

---

```bash
/models
```
Shows comparison table of all models.

```
FREE TIER
Model         Speed   Quality  Context  Cost
qwen2.5:7b    Fast    Good     128k     Free
llama3:8b     Fast    Good     8k       Free

PAID TIER
Model         Speed   Quality  Context  Cost/1K
gpt-4o        Medium  High     128k     $0.0025
claude-3      Medium  High     200k     $0.003
```

---

```bash
/speed
```
Enables speed mode - smaller models, faster iteration.

```bash
/quality
```
Enables quality mode - larger models, higher quality.

---

#### 🔧 Development Commands

```bash
/generate "description"
```
Generates PRD from natural language.

```bash
/generate "Build a task management app with teams"
# Creates PRD with phases, tasks, specs
```

---

```bash
/fix [file-path]
```
Auto-fixes TypeScript errors using MARS agent.

```bash
/fix                    # Fix all errors
/fix src/auth.ts       # Fix specific file
```

---

```bash
/debug [task-id]
```
Debugs failing task with full context analysis.

```bash
/debug          # Debug latest failed task
/debug auth-007 # Debug specific task
```

---

```bash
/preview [port]
```
Starts visual preview server.

```bash
/preview        # Start on port 3001
/preview 8080   # Start on custom port
```

---

```bash
/test [pattern]
```
Runs tests with coverage.

```bash
/test              # Run all tests
/test auth         # Run tests matching "auth"
```

---

#### ✨ Code Quality Commands

```bash
/lint [path]
```
Runs linter and auto-fixes issues.

```bash
/lint              # Lint entire project
/lint src/components  # Lint specific folder
```

---

```bash
/format [path]
```
Formats code with Prettier.

```bash
/format            # Format entire project
/format src        # Format specific folder
```

---

```bash
/review [file-path]
```
Requests code review from MERCURY agent.

```bash
/review            # Review all changes
/review src/api.ts # Review specific file
```

---

```bash
/commit
```
Generates conventional commit message.

```bash
/commit            # Stage and commit with AI message
```

---

#### 📊 Project Commands

```bash
/status [prd-file]
```
Shows project status and progress.

```bash
/status
# 📊 Project Status:
#   Total Tasks: 24
#   ✅ Done: 18 (75%)
#   🔄 Ready: 3
#   ⏳ Pending: 2
#   ❌ Failed: 1
```

---

```bash
/reset [prd-file]
```
Resets PRD tasks to initial state.

```bash
/reset             # Reset current PRD
/reset feature.prd # Reset specific PRD
```

---

```bash
/resume
```
Resumes from last checkpoint.

```bash
/resume
# ▶️ Resuming from checkpoint...
#   Last task: auth-007 (VENUS)
#   Status: 67% complete
```

---

```bash
/export [format]
```
Exports build artifacts.

```bash
/export            # Export as zip
/export tar        # Export as tarball
```

---

```bash
/report
```
Generates build report.

```bash
/report
# 📊 Build Report
#   Duration: 45 minutes
#   Tasks: 24
#   Success Rate: 92%
#   Lines of Code: 3,456
#   Test Coverage: 89%
```

---

#### 📚 Knowledge Commands

```bash
/skills
```
Lists all 168+ available skills.

```bash
/skills
# 📚 Available Skills (168 total)
# 
# 💳 Payments:
#   stripe-integration, apple-pay, paypal...
#
# 🔐 Authentication:
#   convex-auth, clerk, auth0...
# ...
```

---

```bash
/skill [skill-name]
```
Shows skill details.

```bash
/skill stripe-integration
# 📖 Skill: stripe-integration
#   Domain: Payment Processing
#   Agents: GANYMEDE, MARS, VENUS
#   Patterns: 12
#   Auto-loads on: payment, stripe, checkout
```

---

```bash
/learn [pattern]
```
Shows what ATLAS has learned.

```bash
/learn
# 📚 ATLAS Learned Patterns:
#   ✅ Effective: Convex optimistic updates
#   ✅ Effective: Mobile-first Tailwind
#   ⚠️  Failed: Using any types (deprecated)
#   Build Success Rate: 87%
```

---

```bash
/explain [agent-name] [--reasoning]
```
Explains what an agent is doing.

```bash
/explain           # Explain current agent
/explain MARS      # Explain specific agent
/explain VENUS --reasoning  # Include reasoning
```

---

```bash
/reasoning [agent-name]
```
Shows chain of reasoning.

```bash
/reasoning         # Current agent's reasoning
/reasoning JUPITER # Specific agent's reasoning
```

---

#### ℹ️ Information Commands

```bash
/context
```
Shows current task context.

```bash
/context
# 📋 Current Task Context:
#   Task: Build Company Dashboard
#   Agent: VENUS (Frontend)
#   Dependencies: PLUTO ✓, EARTH ✓
#   Next: SATURN (tests)
```

---

```bash
/compare "A" vs "B"
```
Compares two approaches.

```bash
/compare "Redux" vs "Zustand"
# ⚖️ Comparing approaches...
# Redux:  ✅ Predictable  ❌ Boilerplate
# Zustand: ✅ Simple      ⚠️ Less tooling
```

---

```bash
/config [key] [value]
```
Shows/edits configuration.

```bash
/config            # Show all config
/config model gpt-4o  # Set model
```

---

```bash
/mode [dev|prod]
```
Switches between dev/prod modes.

```bash
/mode dev          # Fast iteration
/mode prod         # Strict quality gates
```

---

#### ❓ Help Commands

```bash
/help [command]
```
Shows help.

```bash
/help              # All commands
/help /swarm       # Specific command
```

---

```bash
/tips
```
Shows productivity tips.

---

```bash
/shortcuts
```
Shows keyboard shortcuts.

```bash
/shortcuts
# ⌨️  Keyboard Shortcuts:
#   e     - Explain current agent
#   s     - Show status
#   p     - Pause/resume build
#   q     - Quit
#   Ctrl+C - Cancel current task
```

---

## 6. Integration Examples

### Example 1: Building a SaaS Startup

```bash
# Start with free tier for prototyping
/tier free

# Generate PRD
/generate "Build a SaaS for freelance invoicing with Stripe, team collaboration, and PDF export"

# Enter swarm mode for implementation
/swarm "Implement the core invoicing system" --full

# Switch to paid for complex billing logic
/tier paid
/swarm "Implement Stripe subscription with tiered pricing"

# Back to free for UI polish
/tier free
/swarm "Polish the dashboard UI"

# Review everything
/review

# Run tests
/test

# Export the build
/export
```

### Example 2: Debugging Production Issue

```bash
# Speed mode for quick iteration
/speed

# Debug the failing component
/debug payment-042

# See MARS's reasoning for the fix
/reasoning MARS

# Fix with quick swarm
/swarm "Fix the race condition in payment processing" --quick

# Review the fix
/review src/payments.ts

# Run tests
/test payment

# Generate commit message
/commit
```

### Example 3: Learning New Technology

```bash
# Use highest quality model for learning
/tier paid
/model claude-3-opus

# Research the technology
/swarm "Explain how Convex subscriptions work internally"

# See the research reasoning
/reasoning URANUS

# Get practical example
/swarm "Create a minimal example of Convex real-time sync"

# View the skills loaded
/skill convex

# Check what ATLAS learned
/learn
```

### Example 4: Mixed Project (Optimal Cost)

```bash
# Set hybrid tier
/tier hybrid

# Simple tasks use free models automatically
/swarm "Fix typo in README"  # Uses qwen2.5:7b, $0

# Complex tasks use paid models automatically  
/swarm "Design database schema for multi-tenant app"  # Uses gpt-4o, ~$0.30

# Medium tasks might use either
/swarm "Create API endpoints for user CRUD"  # Uses llama3:8b, $0

# Check total cost
/status
# Shows: Estimated API cost: $0.30
```

### Example 5: Team Collaboration

```bash
# Generate architecture decision record
/swarm "Create ADR for choosing PostgreSQL over MongoDB" --full

# Export documentation
/export

# Share with team
# Team member reviews:
/review architecture/adr-001.md

# Team member adds tests:
/test

# Final validation:
/review
```

---

## Quick Reference Card

```
TIER SELECTION
──────────────
/tier free       $0, local, private
/tier paid       Best quality, API cost
/tier hybrid     Smart switching

SWARM MODES
───────────
/swarm "task"         Adaptive
/swarm "task" --quick 3 agents, fast
/swarm "task" --full  21 agents, thorough

INFORMATION
───────────
/agents          List all agents
/status          Project progress
/explain         What agent is doing
/reasoning       Why agent chose approach
/skills          Available skills

QUALITY
───────
/fix             Auto-fix TypeScript
/review          Code review
/test            Run tests
/lint            Lint code
/format          Format code

MODELS
──────
/models          Compare all
/model <name>    Select specific
/speed           Fast mode
/quality         Best quality

HELP
────
/help            All commands
/tips            Pro tips
/shortcuts       Key bindings
```

---

## Summary

NOVA26 now provides:
- **168 Skills** - Auto-activating expertise packs
- **Swarm Mode** - 21 agents collaborating on any task
- **Model Router** - Free/paid/hybrid with 11 model options
- **Chain of Reasoning** - Transparent AI decision-making
- **30+ Commands** - Complete control over the system

All features work together to provide a flexible, transparent, and cost-effective AI development environment.
