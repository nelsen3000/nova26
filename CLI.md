# NOVA26 CLI Reference

> Complete reference for NOVA26 command-line interface.

---

## Overview

The NOVA26 CLI is the primary interface for interacting with the orchestrator. It provides commands for checking status, resetting tasks, and running PRDs.

---

## Entry Point

```bash
npx tsx src/index.ts [command] [arguments]
```

Or with npm scripts:
```bash
npm run dev -- [command] [arguments]
```

---

## Commands

### 1. status

Check the current status of a PRD.

```bash
npx tsx src/index.ts status <prd-file>
```

**Example:**
```bash
npx tsx src/index.ts status .nova/prd-test.json
```

**Output:**
```
=== PRD Status: Test PRD ===
Total Tasks: 3
  Ready:    1
  Pending: 2
  Running: 0
  Done:     0
  Failed:   0
  Blocked:  0
By Phase:
  Phase 0: 0/1 done
  Phase 1: 0/1 done
  Phase 2: 0/1 done
Ready Tasks:
  - test-001: Write product spec for Company entity
```

---

### 2. reset

Reset a PRD to its initial state.

```bash
npx tsx src/index.ts reset <prd-file>
```

**What it does:**
- Sets all Phase 0 tasks to `ready`
- Sets all other tasks to `pending`
- Clears output paths and errors
- Does NOT delete output files

**Example:**
```bash
npx tsx src/index.ts reset .nova/prd-test.json
```

**Output:**
```
PRD reset complete. Phase 0 tasks set to ready, others to pending.
```

---

### 3. run

Execute a PRD through the Ralph Loop.

```bash
npx tsx src/index.ts run <prd-file>
```

**What it does:**
1. Loads the PRD
2. Starts the Ralph Loop
3. Processes each task through the full pipeline
4. Saves outputs to `.nova/output/`
5. Updates PRD status in real-time

**Example:**
```bash
npx tsx src/index.ts run .nova/prd-test.json
```

**Output:**
```
Starting Ralph Loop...

--- Processing: test-001 (Write product spec for Company entity) [Phase 0] ---
LLM response: # Product Spec: Company Entity...
Gates: 2 passed, 0 failed
Task test-001 completed successfully.

Promoted 1 task(s) from pending to ready.

--- Processing: test-002 (Create Company table schema) [Phase 1] ---
...

=== All tasks completed successfully! ===

=== Ralph Loop finished ===
```

---

## npm Scripts

### Quick Commands

```bash
# Development (CLI)
npm run dev

# TypeScript check
npm run build

# Tests
npm run test:mock       # Mock test (no LLM)
npm run test:integration # Full integration test
```

---

## Usage Examples

### Check Status Before Running

```bash
# Check what tasks are ready
npx tsx src/index.ts status .nova/prd-test.json

# See if any tasks failed
npx tsx src/index.ts status .nova/prd-ua-dashboard-v1.json
```

### Reset and Re-run

```bash
# Reset the PRD
npx tsx src/index.ts reset .nova/prd-test.json

# Run again
npx tsx src/index.ts run .nova/prd-test.json
```

### Run Different PRDs

```bash
# Test PRD (3 tasks)
npx tsx src/index.ts run .nova/prd-test.json

# Full UA Dashboard PRD (15 tasks)
npx tsx src/index.ts run .nova/prd-ua-dashboard-v1.json
```

---

## File Locations

### Input PRDs
```
.nova/
  prd-test.json              # 3-task test PRD
  prd-ua-dashboard-v1.json   # 15-task dashboard PRD
```

### Output Files
```
.nova/output/
  test-001.md   # Output from task test-001
  test-002.md   # Output from task test-002
  test-003.md   # Output from task test-003
```

---

## Output File Format

Each task output is saved as markdown:

```markdown
# Output: Write product spec for Company entity
**Task ID:** test-001
**Agent:** EARTH
**Model:** qwen2.5:7b
**Completed:** 2026-02-17T10:30:00Z
**Gates:** all passed

---

# Product Spec: Company Entity

## Fields
- **name**: string, unique identifier...
...
```

---

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Error (PRD not found, invalid command, etc.) |

---

## Error Handling

### PRD Not Found
```
Error: PRD file not found: .nova/prd-test.json
```
**Solution:** Check the file path is correct.

### Missing Command
```
NOVA26 CLI
Usage:
  nova26 status <prd-file>   Show PRD status
  nova26 reset <prd-file>    Reset PRD tasks
  nova26 run <prd-file>      Run PRD tasks
```
**Solution:** Provide a valid command.

### Ollama Not Running
```
Error: Ollama is not running. Start it with: ollama serve
```
**Solution:** Start Ollama or use mock test.

---

## Testing Without Ollama

### Mock Test

```bash
npm run test:mock
```

This test:
- Doesn't require Ollama
- Iterates PRD JSON directly
- Returns mock responses

**Output:**
```
=== MOCK INTEGRATION TEST ===

Processing task: test-001 (EARTH)
  Status: DONE
  Output: .nova/output/test-001.md
...

RESULT: ALL TESTS PASSED
```

### Integration Test

```bash
npm run test:integration
```

This test:
- Runs full Ralph Loop
- Uses mock LLM (injected)
- Exercises all components

**Assertions:** 25 tests covering:
- Task completion
- LLM call count
- Execution order
- Dependency context injection
- Output file creation
- State transitions

---

## Aliases

You can create aliases for common commands:

```bash
# Add to .bashrc or .zshrc
alias nova-status="npx tsx src/index.ts status"
alias nova-reset="npx tsx src/index.ts reset"
alias nova-run="npx tsx src/index.ts run"

# Usage
nova-status .nova/prd-test.json
nova-reset .nova/prd-test.json
nova-run .nova/prd-test.json
```

---

## Troubleshooting

### "Command not found"
```bash
# Use full path
npx tsx src/index.ts status .nova/prd-test.json

# Or use npm script
npm run dev -- status .nova/prd-test.json
```

### "Module not found"
```bash
# Install dependencies
npm install
```

### "TypeScript error"
```bash
# Check compilation
npx tsc --noEmit

# Fix errors before running
```

---

*Last Updated: 2026-02-18*
