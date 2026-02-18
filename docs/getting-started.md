# Getting Started with NOVA26

Go from zero to your first AI-built feature in 5 minutes.

## Prerequisites

- **Node.js**: v20+ installed.
- **Ollama**: Download and install from [ollama.com](https://ollama.com).
- **Pull a Model**: Run `ollama pull qwen2.5:14b` (our recommended default).

## Quick Start

### 1. Initialize

Run this in any empty directory or existing project:

```bash
npx nova26 init
```

This creates the `.nova` folder and configures your environment.

### 2. Generate a Plan

Tell NOVA26 what you want to build.

```bash
npx nova26 generate "Create a script that checks crypto prices and saves them to a CSV"
```

The SUN agent will create a comprehensive plan (PRD).

### 3. Execute

Run the plan. Watch the agents work.

```bash
npx nova26 run .nova/generated-latest.json
```

You will see:
- **SUN** orchestrating the workflow.
- **MARS** writing the TypeScript code.
- **MERCURY** validating the output.

### 4. Inspect

Check your folder. You'll see the generated TypeScript file and the CSV output.

## Troubleshooting

- **"Model not found"**: Ensure you ran `ollama pull [model_name]`. Check `npx nova26 run /cost` to see configured models.
- **"Connection refused"**: Make sure Ollama is running (`ollama serve`).
- **"Budget Exceeded"**: Check if `NOVA26_BUDGET` is set in your `.env`.

## Next Steps

- Try `/preview` to visualize components.
- Configure Hard Limits for safety.
- Deploy to Convex.
