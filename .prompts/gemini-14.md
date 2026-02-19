# GEMINI DEEP RESEARCH — Round 14: Edge AI & On-Device Inference

> Assigned to: Gemini (Deep Research mode)
> Round: GEMINI-14
> Date issued: 2026-02-19
> Status: Queued (deliver after GEMINI-13)
> Purpose: Research every path to maximizing on-device AI performance for Nova26

---

## Context

Nova26 is local-first by design. Gemini-06 already identified Qwen 3.5 Coder as the local
model king and created hardware-tiered configs. But the landscape is evolving fast:

- Apple MLX framework is maturing rapidly on M4 chips (16GB unified memory)
- NVIDIA NIM microservices enable GPU-optimized inference
- WebGPU/WebNN enable browser-based inference
- Quantization techniques (GGUF, AWQ, GPTQ, EXL2) keep improving
- New edge-native models are shipping monthly

**The goal:** Nova26 should run 100% on-device for users who want it, with performance
that rivals cloud APIs. "Sovereign AI" — your data never leaves your machine.

---

## What We Need You to Research

### 1. Apple MLX Deep Dive (M1→M4 Pro/Max/Ultra)
- MLX framework current state (February 2026)
- Which models run well on MLX? Performance benchmarks
- MLX vs llama.cpp vs Ollama — when to use each
- M4 16GB sweet spot (what's the biggest model that fits?)
- M4 Pro 36GB/48GB — unlock larger models?
- Unified memory optimization tricks
- MLX-Swift for native macOS integration
- Metal Performance Shaders for custom operations

### 2. NVIDIA NIM & Local GPU Inference
- NIM container architecture — how does it work?
- Which consumer GPUs are supported? (RTX 4060→4090, RTX 5080→5090)
- VRAM requirements per model size
- TensorRT-LLM optimization for code models
- Triton Inference Server vs vLLM vs TGI for local serving
- Multi-GPU inference (NVLink, tensor parallelism)
- Cost-to-performance ratio by GPU tier

### 3. Quantization & Compression State of the Art
- GGUF (llama.cpp) — Q4_K_M, Q5_K_M, Q6_K, Q8_0 quality comparison
- AWQ vs GPTQ vs EXL2 vs SqueezeLLM — which wins in 2026?
- Speculative decoding for local models (draft model + verify model)
- Pruning techniques (SparseGPT, Wanda) — do they work for code models?
- Knowledge distillation (train small model from large model outputs)
- Mixture of Experts (MoE) for efficient local inference

### 4. Edge-Native Models (February 2026)
- Complete survey of models designed for edge/on-device:
  - Phi-4/Phi-4-mini (Microsoft)
  - Gemma 2 / Gemma 3 (Google)
  - Qwen 3.5 family (Alibaba)
  - SmolLM / SmolLM2 (Hugging Face)
  - TinyLlama variants
  - Any new entrants since Gemini-06
- Benchmark comparison: HumanEval, MBPP, code completion accuracy
- Memory footprint and inference speed per model

### 5. Hybrid Cloud/Edge Architecture
- When should Nova26 fall back to cloud? (model too large, task too complex)
- Seamless fallback patterns (start local, escalate to cloud if quality too low)
- Split inference (embeddings local, generation cloud)
- Federated learning for model improvement without data leaving device
- Caching strategies (cache cloud responses for future local reference)

### 6. WebGPU/WebNN for Browser-Based Inference
- Current state of WebGPU inference (Transformers.js, ONNX Runtime Web)
- Can Nova26's Tauri app use WebGPU for inference?
- Performance comparison: WebGPU vs native (Metal/CUDA)
- Which models can run in browser today?
- WebNN specification status and browser support

### 7. Hardware Tiering Strategy
Update the Gemini-06 hardware tiers with 2026 data:
- Tier 1: M1/M2 8GB / GTX 1060 (bare minimum)
- Tier 2: M2/M3 16GB / RTX 3060 (comfortable)
- Tier 3: M4 16GB / RTX 4070 (recommended)
- Tier 4: M4 Pro 36GB / RTX 4090 (power user)
- Tier 5: M4 Ultra 192GB / Multi-GPU (enterprise)

For each tier: best model, expected tokens/sec, quality trade-offs

---

## Output Format

```
1. Executive summary (the on-device AI opportunity)
2. MLX deep dive (benchmarks, model compatibility, optimization tricks)
3. NVIDIA NIM analysis (setup, GPU requirements, performance data)
4. Quantization comparison matrix (technique × model × quality × speed)
5. Edge-native model catalog (every viable model with benchmarks)
6. Hybrid cloud/edge architecture recommendation
7. WebGPU/WebNN assessment (ready or not?)
8. Updated hardware tiering (5 tiers with specific model recommendations)
9. Nova26 integration roadmap (what to implement first)
10. Open questions for Jon
```
