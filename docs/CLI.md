# CLI Reference

The `nova26` CLI is the primary interface for interacting with the agent swarm.

## Core Commands

### `nova26 init`

Initializes a new NOVA26 project in the current directory.
- Creates `.nova/` directory structure.
- Generates default `config.json`.
- Indexes the codebase for the agents.

### `nova26 generate "<prompt>"`

Creates a Product Requirements Document (PRD) from a natural language description.
- **Example**: `nova26 generate "Create a user login system with Google Auth"`
- **Agent**: Uses SUN to analyze and EARTH to spec out requirements.
- **Output**: Saves a `prd-*.json` file in `.nova/`.

### `nova26 run <prd-file>`

Executes the Ralph Loop on a specific PRD.
- **Example**: `nova26 run .nova/generated-123.json`
- **Flags**:
  - `--parallel`: Enable parallel agent execution.
  - `--tier <free|paid>`: Override the model tier for this run.

### `nova26 status`

Shows the current status of the build process.
- Displays completed, running, and pending tasks.
- Shows daily cost usage and token consumption.

Source: `src/cli/slash-commands.ts`

## Slash Commands (Interactive)

These commands are available within the CLI interactive mode or as quick single-shot commands.

| Command | Description | Usage |
|---------|-------------|-------|
| `/fix` | Analyzes TypeScript errors and asks MARS to fix them. | `nova26 run /fix` |
| `/commit` | Generates a Conventional Commit message from staged changes. | `nova26 run /commit` |
| `/scan` | Runs a security scan on the codebase (SAST). | `nova26 run /scan` |
| `/cost` | Displays cost tracking report and cache stats. | `nova26 run /cost [today]` |
| `/preview` | Starts a visual component preview server. | `nova26 run /preview --component Button` |
| `/skills` | Lists all available tools/skills registered in the system. | `nova26 run /skills` |
| `/agents` | Lists details about specific agents or the whole swarm. | `nova26 run /agents [NAME]` |
| `/template` | Manage agent prompt templates. | `nova26 run /template list` |

## Debugging

- **Watch Mode**: `nova26 watch` (Monitors file changes and triggers agents—experimental).
- **Logs**: Execution logs are stored in `.nova/atlas/builds.json` and can be inspected for debugging agent logic.
