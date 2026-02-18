# P-05: Open-Source Video Generation State (February 2026)

## Overview

This document surveys the state of open-source video generation as of February 2026, focusing on projects that are practically usable for developers building AI-powered video tools: Open-Sora, Genmo Mochi 1, and selected models from Alibaba and others.[web:156][web:159][web:161][web:164] It emphasizes quality vs commercial models, licensing, API availability, and self-hosting requirements.

## 1. Open-Sora (HPCAI Tech)

- **Project**: https://github.com/hpcaitech/Open-Sora[web:156]
- **License**: Open-source (weights and code released; check repo for exact license terms).[web:159]

### 1.1 Capabilities

- Open-Sora 1.0 / 1.1 / 1.2:
  - Supports text-to-image, text-to-video, image-to-video, video-to-video, and infinite-length video generation pipelines.[web:156][web:159]
  - Single-shot videos up to **16 seconds** at resolutions up to **720p** with flexible aspect ratios.[web:159][web:160]
  - Unified architecture for multiple tasks via masking and bucketed training over (resolution, frames, aspect ratio).[web:159]

### 1.2 Performance & Quality

- Generates HD (720p) short clips with coherent motion and reasonable prompt adherence; quality still lags best proprietary models like OpenAI Sora 2, especially for complex human motion and fine detail.[web:159][web:160][web:166]
- Multi-stage training improves quality by starting with low-resolution, short clips and progressively increasing resolution and length.[web:159]

### 1.3 Self-Hosting Requirements

- Open-Sora is computationally heavy:
  - Community benchmarks report ~10 minutes to generate a 16s 720p video on a single **A100 80GB** GPU.[web:160]
  - Lower resolutions or shorter clips can run on smaller GPUs, but practical deployment for interactive workloads likely needs multi-GPU setups.
- Developer ergonomics:
  - Provides a full training and inference pipeline; Gradio demos and scripts exist for experimentation.[web:156][web:159]

## 2. Mochi 1 (Genmo)

- **Project**: https://github.com/genmo/models (weights and reference code); Mochi 1 is described in Genmo’s blog and community posts.[web:161][web:164][web:167]
- **License**: Apache 2.0 open-source license for the full model weights, enabling commercial use.[web:161][web:164][web:167]

### 2.1 Capabilities

- 10B parameter video diffusion model (Asymmetric Diffusion Transformer, AsymmDiT) with a video VAE.[web:161][web:164][web:167]
- Outputs **5.4 second** clips at **480p, 30 fps** in the initial release.[web:161][web:164][web:167]
- Strong prompt adherence and motion realism, designed to compete with proprietary models in short-form video segments.[web:161][web:164][web:167]

### 2.2 Performance & Ecosystem

- Can run on ~24GB VRAM GPUs with generation times of ~15–25 minutes per clip, according to community reports.[web:161]
- Includes:
  - Web playground and hosted inference for quick testing.[web:164][web:167]
  - CLI and Gradio examples.
  - ComfyUI integration wrappers for node-based workflows.[web:161]
- Roadmap includes 720p variants, longer durations, and richer control modes (image-to-video, style transfer) in future releases.[web:161][web:164]

## 3. Other Notable Open-Source or Semi-Open Projects

- **Wan / Wan 2.x (Alibaba)**
  - Alibaba has published papers and demos around Wan (and later versions) for high-quality video generation, but fully open weights are not consistently available; licensing tends to be more restrictive than Apache-style models.
- **Stable Video Diffusion and AnimateDiff**
  - Stable diffusion-based approaches extended to video via temporal consistency modules; useful for style-preserving animations and short clips rather than fully general text-to-video.
- **Research Prototypes (Open-Sora Plan, etc.)**
  - The Open-Sora Plan paper lays out a roadmap for more scalable architectures, including Wavelet-Flow VAEs and improved denoisers.[web:163]

## 4. Quality vs Commercial Models

- **Closed models (e.g., OpenAI Sora 2)**
  - Offer best-in-class physical realism, dynamic camera motion, and complex multi-shot narratives.[web:157][web:158][web:169]
  - Provide convenient APIs and managed infrastructure at the cost of vendor lock-in and per-minute pricing.

- **Open-Sora vs Sora 2**
  - Open-Sora has improved to 720p and 16s with a robust open pipeline but still exhibits issues such as noise, temporal consistency gaps, and weaker human figure realism.[web:159][web:160][web:166]
  - However, it enables full control over training, fine-tuning, and deployment.

- **Mochi 1 vs Proprietary Models**
  - Mochi 1 delivers strong motion realism and prompt fidelity in 5.4s 480p clips and is often cited as closing much of the gap for short-form content.[web:161][web:164][web:167]
  - Open Apache 2.0 licensing and open weights make it attractive for research and product prototypes.

## 5. API Availability & Integration Options

- **Hosted APIs**
  - Genmo provides a hosted API and playground for Mochi 1, lowering the barrier to experimentation without running GPUs locally.[web:164][web:167]
  - Some Open-Sora community forks host demos via Gradio or Hugging Face Spaces.[web:156][web:159]

- **Self-Hosted**
  - Both Open-Sora and Mochi 1 can be run locally using Docker/conda + PyTorch, with recommended hardware starting at 24GB VRAM and scaling up.
  - ComfyUI and other node-based tools provide integration hooks for creative pipelines.[web:161][web:164]

## 6. Self-Hosting Considerations (RTX 4090 vs A100/H100)

- **RTX 4090 (24GB VRAM)**
  - Capable of running Mochi 1 at 480p with ~15–25 minute generation times per clip; similar or slightly slower performance for optimized Open-Sora settings.[web:161][web:160]
  - Best for experimentation, small-batch generation, and developer workstations.

- **A100 80GB / H100**
  - Required for reasonably fast 720p and longer Open-Sora generations (e.g., 10 minutes for 16s 720p on A100 as reported by community).[web:160][web:159]
  - Suitable for production pipelines where throughput and latency matter.

## Recommendations for Nova26

- **Treat open-source video models as external services/tools**
  - For any Nova26 integration, abstract video generation behind a tool interface (HTTP API or CLI) so underlying models (Open-Sora, Mochi 1, others) can be swapped.[file:9]

- **Prioritize Mochi 1 for local/enterprise deployments**
  - Apache 2.0 licensing, strong quality, and 24GB VRAM feasibility make Mochi 1 the most practical open candidate for self-hosted installations.[web:161][web:164][web:167]

- **Use Open-Sora where long-form or 720p is essential**
  - For longer or higher-resolution content, Open-Sora’s 16s 720p capabilities are compelling, especially when A100/H100-class GPUs are available.[web:159][web:160]

- **Design Nova26’s future "media agent" around pluggable backends**
  - Similar to how LLM providers are abstracted, define a video-generation agent in Nova26 that calls configured backends with consistent prompts and receives standardized metadata.

- **Document GPU and infra requirements clearly**
  - Provide guidance in Nova26’s docs for teams choosing between RTX 4090, A100/H100, and hosted APIs for video generation workloads.
