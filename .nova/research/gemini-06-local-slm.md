# Gemini-06: Local SLM Optimization Playbook
## Source: Gemini Deep Research Round 06 (Feb 19, 2026)
## Status: Accepted

## Top Model Recommendations (Feb 2026)

| Agent Role | Optimized Model | Reason |
|-----------|----------------|--------|
| MARS / PLUTO | Qwen 3.5 Coder (397B-A17B) | SOTA SWE-bench, handles Convex/TS perfectly |
| VENUS / EUROPA | Kimi K2.5 | Native vision, image-to-code, UI reconstruction |
| MERCURY / CHARON | MiniMax M2.5 | Highest debugging/validation scores |
| SUN / JUPITER | DeepSeek-V3.2 (Thinking) | Best multi-step reasoning |
| NEPTUNE / IO | Xiaomi MiMo-V2-Flash | Low latency for rapid metrics |

## Hardware Tier Configs

| Tier | Hardware | Models | Quantization | Config |
|------|----------|--------|-------------|--------|
| 1 | MB Air 16GB | Nemotron 3 Nano, Phi-4 | Q4_K_M | num_ctx 16384 |
| 2 | MB Pro 32GB+ | Qwen 3.5 (17B active), Kimi-VL 32B | Q5_K_M | num_ctx 32768 |
| 3 | RTX 4090/5090 | GPT OSS 120B, Qwen 3.5 Full | Q6_K | num_ctx 128000 |
| 4 | H100/MI30x | Kimi K2.5 1T, DeepSeek-V3.2 | Q8_0/FP16 | num_ctx 256000 |

## Ollama Modelfile Example (nova-qwen-coder-pro)

```
FROM qwen3.5-coder-32b:q5_k_m
PARAMETER num_ctx 65536
PARAMETER temperature 0.2
PARAMETER top_p 0.95
PARAMETER repeat_penalty 1.1
PARAMETER num_predict 4096
SYSTEM "You are Nova26's coding agent. Stack: TypeScript 5.9, React 19, Convex. Rules: Strict typing, early returns, shadcn."
```

## Key Techniques

- **Speculative Decoding**: Nemotron 3 Nano as draft + Qwen 3.5 as verifier = 2.5x throughput
- **Quantization sweet spot**: Q5_K_M reduces logic jitter by 12% vs Q4_K_M
- **Confidence escalation**: start small model, escalate if confidence < threshold
- **KV cache sharing**: agents working on same project share context

## Nova-Bench (Built-in Benchmark)

- Task A: Generate Convex mutation with 5 nested v.union validators
- Task B: Convert wireframe to framer-motion React component (vision)
- Task C: Write GitHub Action for tagged deployment
- Task D: Identify race condition in multi-user Convex subscription
- Metric: Quality-to-Latency Ratio (QLR) = ACE Score / Total Seconds
