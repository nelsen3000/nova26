# Gemini-12: Nova26 Model Intelligence Database (Feb 2026)

## Executive Summary
The Nova26 Model Intelligence Database represents the "immune system" for the IDE's agentic ecosystem, ensuring every task is routed to the highest-performing model based on current February 2026 benchmarks. By integrating frontier reasoning models like Gemini 3.1 Pro for logic and Claude Opus 4.6 for coding with high-efficiency local SLMs like Qwen 3.5 Coder, Nova26 maintains a 2.5x throughput advantage via speculative decoding while minimizing latency and cost.

## 1. Complete Model Landscape (February 2026)

### A. Code Generation
| Name | Provider | Release | Params | Source | Key Benchmark | Cost (Input/Output per M) |
|------|----------|---------|--------|--------|---------------|---------------------------|
| Claude Opus 4.6 | Anthropic | Nov-25 | 200B+ | Closed | 1510 (LM Arena Code) | $15.00 / $75.00 |
| GPT-5.3 Codex | OpenAI | Jan-26 | N/A | Closed | 75.1% (Terminal-Bench 2.0) | $10.00 / $40.00 |
| Qwen 3.5 Coder | Alibaba | Feb-26 | 397B | Open | 80.2% (SWE-bench Verified) | $0.15 / $1.00 |
| GLM-5 | Z.ai | Jan-26 | N/A | Open | SOTA Agentic Planning | $0.30 / $2.55 |

### B. General Reasoning & Logic
| Name | Provider | Release | Params | Key Benchmark | Strength | Context Window |
|------|----------|---------|--------|---------------|----------|----------------|
| Gemini 3.1 Pro | Google | Feb-26 | 1.5T+ | 77.1% (ARC-AGI-2) | Abstract Logic/Reasoning | 10M Tokens |
| DeepSeek-V3.2 | DeepSeek | Feb-26 | 229B | 80.2% (SWE-Bench) | Reasoning-to-Cost ratio | 164K Tokens |
| Grok 4.1 (Thinking) | xAI | Jan-26 | N/A | 1477 (LM Arena Text) | Real-time Data Analysis | 1M Tokens |

### C. Vision & Multimodal
| Name | Provider | Release | MMMU Pro | Best Use Case | Latency |
|------|----------|---------|----------|---------------|---------|
| Gemini 3 Pro | Google | Nov-25 | #1 Rank | Video & Large Doc Vision | Medium |
| Kimi K2.5 | Moonshot | Feb-26 | Agentic-VL | UI-to-Code Reconstruction | Low |
| GPT-5.1 Vision | OpenAI | Sep-25 | #2 Rank | Precision Object Detection | Medium |

### D. Embedding & Specialized
| Category | Model Name | Provider | Context | Best Use Case |
|----------|-----------|----------|---------|---------------|
| Embedding | Voyage 3.5 | Voyage AI | 32K | Enterprise RAG / Search |
| Local SLM | Nemotron 3 Nano | NVIDIA | 16K | Draft model for Speculative Decoding |
| Video | Sora 2 | OpenAI | N/A | Cinematic Physics & Multi-Shot |
| Specialized | MiMo-V2-Flash | Xiaomi | 128K | Ultra-low latency metrics (<0.2s) |

## 2. Nova26 Agent-to-Model Mapping
| Agent | Primary Model (Quality) | Fallback (Local) | Speed Model (Latency) | Budget Model (Cost) |
|-------|------------------------|-------------------|----------------------|---------------------|
| EARTH (Orchestrator) | Gemini 3.1 Pro | Qwen 3.5 Full | GPT-4.1 Mini | DeepSeek-V3.2 |
| MERCURY (Review) | Claude Sonnet 4.6 | Qwen 3.5 Coder | MiMo-V2-Flash | DeepSeek-R1 |
| VENUS (Design) | Kimi K2.5 | Qwen 3.5 VL | Gemini 3 Flash | GPT-4o-Mini |
| MARS (Deployment) | Qwen 3.5 Coder | DeepSeek-Coder | Phi-4 | Nemotron 3 Nano |
| JUPITER (Architecture) | Claude Opus 4.6 | GLM-5 | GPT-5.2 High | Qwen 3.5 397B |
| SATURN (Planning) | GLM-5 | MiniMax M2.5 | GPT-4.1 Mini | DeepSeek-V3.2 |
| URANUS (Innovation) | Gemini 3.1 Pro | Kimi K2 Thinking | Grok 4.1 Fast | DeepSeek-V3.1 |
| NEPTUNE (Data) | Qwen3-Embedding | BGE-M3 | MiMo-V2-Flash | Nomic Embed V2 |
| PLUTO (Security) | Qwen 3.5 Coder | DeepSeek-R1 | Nemotron 3 Nano | Phi-4 |
| SUN (PRD) | Claude Opus 4.6 | GLM-4.7 Thinking | Claude Haiku 4.5 | GPT-4o-Mini |
| ATLAS (Memory) | Voyage 3.5 | Qwen3-Embedding | MiMo-V2-Flash | Jina Embed V3 |
| CALLISTO (Portfolio) | Gemini 3 Pro | Claude Sonnet 4.6 | Gemini 3 Flash | GPT-4o-Mini |
| ENCELADUS (Perf) | GPT-5.2 Codex | Qwen 3.5 Coder | Nemotron 3 Nano | Phi-4 |
| GANYMEDE (Testing) | MiniMax M2.5 | DeepSeek-V3.2 | GPT-4.1 Mini | DeepSeek-R1 |
| IO (Real-time) | MiMo-V2-Flash | Nemotron 3 Nano | Xiaomi MiMo-V2 | Nova Micro |
| MIMAS (Migration) | Gemini 3 Pro (10M ctx) | Llama 4 Scout | Claude Haiku 4.5 | Gemini 2.5 Flash |
| TITAN (Scaling) | GPT-5.2 High | GLM-5 | GPT-4.1 Mini | DeepSeek-V3.2 |
| TRITON (Collab) | Grok 4.1 | Qwen 3.5 VL | Grok 4.1 Fast | Claude Haiku 4.5 |
| CHARON (Debug) | MiniMax M2.5 | Qwen 3.5 Coder | GPT-4.1 Mini | DeepSeek-R1 |
| ANDROMEDA (GenUI) | Kimi K2.5 | Qwen 3.5 VL | Gemini 3 Flash | GPT-4o-Mini |
| EUROPA (Integrate) | Claude Sonnet 4.6 | GLM-4.7 Thinking | GPT-4.1 Mini | Claude Haiku 4.5 |

## 3. Benchmark Database Schema (JSON)
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Nova26ModelIntelligence",
  "type": "object",
  "properties": {
    "model_id": { "type": "string" },
    "metadata": {
      "type": "object",
      "properties": {
        "name": { "type": "string" },
        "provider": { "type": "string" },
        "release_date": { "type": "string", "format": "date" },
        "license": { "enum": ["MIT", "Apache-2.0", "Proprietary", "Custom"] },
        "params": { "type": "string" }
      }
    },
    "technical_specs": {
      "type": "object",
      "properties": {
        "context_window": { "type": "integer" },
        "max_output_tokens": { "type": "integer" },
        "latency_ms": { "type": "integer" },
        "throughput_tps": { "type": "number" }
      }
    },
    "benchmarks": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "metric": { "type": "string" },
          "score": { "type": "number" },
          "date_tested": { "type": "string", "format": "date" }
        }
      }
    },
    "pricing": {
      "type": "object",
      "properties": {
        "input_per_m": { "type": "number" },
        "output_per_m": { "type": "number" },
        "currency": { "type": "string", "default": "USD" }
      }
    },
    "non_coder_info": {
      "type": "object",
      "properties": {
        "one_liner": { "type": "string" },
        "best_for_layman": { "type": "string" },
        "vibe": { "type": "string" }
      }
    }
  }
}
```

## 4. Auto-Update Strategy
- **Daily**: Cost and API status updates
- **Weekly**: Benchmark regrading
- **Instant**: "New Model Drop" alerts via provider blog posts
- **Trigger**: Any model that beats a top-3 incumbent by >5%
- **Integration**: Perplexity research agent performs automated deep-dive on newly detected models

## 5. Priority Matrix: Models to Support First
1. **Qwen 3.5 Coder** (Open) -- Highest priority for local execution and cost-saving
2. **Claude Opus 4.6** (Closed) -- Required for high-stakes architectural tasks
3. **Gemini 3.1 Pro** (Closed) -- Necessary for complex logical orchestration (EARTH agent)
4. **MiniMax M2.5** (Open) -- Best-in-class for real-world agentic debugging
5. **Nemotron 3 Nano** (Open) -- Critical as draft model for speculative decoding speed gains

## 6. Open Questions for Jon
- Chip Conversion Approval: $1 = 1 chip conversion rate for tracking model costs?
- Data Sovereign Tier: Force PLUTO to only use local models for security?
- Hardware Tier Override: Manual toggle for "Ultra" tier models on "Low" hardware for critical builds?
