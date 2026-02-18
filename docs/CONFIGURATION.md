# Configuration Reference

NOVA26 configuration is handled through a combination of environment variables and JSON config files.

## Environment Variables (.env)

These variables control the core behavior of the LLM and orchestrator.

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `NOVA26_TIER` | Model tier selection (`free`, `paid`, `hybrid`). | `free` | No |
| `NOVA26_MODEL` | Override specific model (e.g., `gpt-4o`). | Auto | No |
| `NOVA26_BUDGET` | Daily hard spending limit in USD. | `undefined` | No |
| `OPENAI_API_KEY` | Required for paid/hybrid tiers using OpenAI. | - | Conditional |
| `ANTHROPIC_API_KEY` | Required for paid/hybrid tiers using Claude. | - | Conditional |
| `OLLAMA_HOST` | URL for local Ollama instance. | `http://localhost:11434` | No |
| `CONVEX_URL` | URL for ATLAS/Convex backend. | - | No |

## File Configuration

### `.nova/config/hard-limits.json`

Defines safety constraints for agents. This file is generated during `init` and should be committed to the repo.

```json
{
  "agents": {
    "MARS": {
      "limits": [
        {
          "name": "no-delete",
          "severity": "SEVERE",
          "message": "Do not delete files outside of .nova/"
        }
      ]
    }
  }
}
```

### `.nova/config/ux-quality-gates.json`

Configures the thresholds for the validation gates.

```json
{
  "gates": {
    "visual": { "threshold": 0.9 },
    "accessibility": { "standard": "WCAG2AA" },
    "performance": { "lcp": 2500 }
  }
}
```

## Configuration Priority

Configuration is loaded in the following order (highest priority first):

1. **CLI Arguments**: (e.g., `nova26 run --tier paid`)
2. **Environment Variables**: (`NOVA26_TIER=paid`)
3. **Project Config**: (`.nova/config.json`)
4. **User Config**: (`~/.nova26/config.json`)
5. **Defaults**: (Free tier, local models)

## Ignoring Files

Create a `.novaignore` file to prevent agents from reading or modifying specific files (works like `.gitignore`).

Example `.novaignore`:
```
.env
node_modules/
dist/
secrets/
```
