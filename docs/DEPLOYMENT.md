# NOVA26 Deployment Guide

This guide covers setting up NOVA26 for local development, Dockerized execution, and production deployment with Convex.

## 1. Local Development Setup (Recommended)

Run the full agent swarm locally using Ollama for zero-cost builds.

### Prerequisites
- **Node.js**: v20.10.0 or higher
- **Ollama**: Installed and running
- **Git**: For version control

### Steps

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Pull Required Models**
   NOVA26 uses specific models for different agent tiers (see `src/llm/model-router.ts`).
   ```bash
   ollama pull qwen2.5:14b   # For "Balanced" tier
   ollama pull deepseek-coder:6.7b # For coding tasks
   ollama pull llama3:8b     # For general reasoning
   ```

3. **Initialize Configuration**
   ```bash
   npx nova26 init
   ```

4. **Verify Setup**
   Run the skills check to ensure local tools are accessible.
   ```bash
   npx nova26 run /skills
   ```

## 2. Convex Backend Setup (Optional)

NOVA26 uses Convex (v1.31+) for persistent memory (ATLAS), real-time dashboards, and vector search.

1. **Create Convex Project**
   ```bash
   npx convex dev
   ```
   This creates a `.env.local` file with your `CONVEX_DEPLOYMENT` and `CONVEX_URL`.

2. **Sync Schema**
   NOVA26 defines its schema in `convex/schema.ts`. Push this to your instance:
   ```bash
   npx convex push
   ```

3. **Enable Vector Search**
   Ensure your Convex plan supports vector search indices, used by ATLAS to retrieve past build patterns.

## 3. Environment Variables

Create a `.env` file in the root directory.

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `NOVA26_TIER` | No | `free` (Ollama), `paid` (Cloud), or `hybrid` | `free` |
| `NOVA26_MODEL` | No | Override specific model (e.g., `gpt-4o`) | Auto-select |
| `NOVA26_BUDGET` | No | Daily spend limit in USD (e.g., `5.00`) | `undefined` |
| `OPENAI_API_KEY` | If Paid | Key for OpenAI models | - |
| `ANTHROPIC_API_KEY` | If Paid | Key for Claude models | - |
| `CONVEX_URL` | If Hybrid | URL for Convex backend | - |
| `OLLAMA_HOST` | No | Custom Ollama host URL | `http://localhost:11434` |

## 4. Docker Deployment

Run NOVA26 in an isolated container.

**Dockerfile:**
```dockerfile
FROM node:20-slim

# Install system dependencies
RUN apt-get update && apt-get install -y git curl

# Install Ollama CLI (optional, if running internal model)
RUN curl -fsSL https://ollama.com/install.sh | sh

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Build TypeScript
RUN npm run build

# Default command
CMD ["npm", "start"]
```

Run with host networking (to access local Ollama):
```bash
docker run --network host -v $(pwd)/.nova:/app/.nova nova26-image
```

## 5. Production Checklist

Before using NOVA26 on sensitive codebases or in production:

- [ ] **Configure `.novaignore`**: Ensure secrets and `.env` files are ignored.
- [ ] **Set Budget Limits**: Set `NOVA26_BUDGET` to prevent runaway API costs.
- [ ] **Run Security Scan**: Use `/scan` to check for pre-existing vulnerabilities.
- [ ] **Audit Compliance**: Review P-04 Compliance Requirements if handling PII.
- [ ] **Backups**: Ensure `.nova/atlas` or your Convex database is backed up regularly.
