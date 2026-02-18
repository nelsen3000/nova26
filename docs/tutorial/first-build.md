# Tutorial: Build Your First App with NOVA26

This guide takes you through the complete lifecycle of a NOVA26 build: from a natural language idea to generated code.

**Goal**: Build a simple "Todo App" with an Express backend and React frontend.

## Step 1: Initialize

Open your terminal in a new folder and run:

```bash
npx nova26 init
```

Output:
```
NOVA26 initialized in ./my-app
   - Created .nova directory
   - Configured local agents
   - Indexed workspace
```

## Step 2: Generate the Plan (PRD)

Ask the SUN agent to plan the application.

```bash
npx nova26 generate "Create a simple Todo App. Backend: Express API with in-memory storage. Frontend: React with a list and add button."
```

Output:
```
SUN is analyzing your request...
   - Decomposing requirements
   - Assigning agents (MARS for backend, VENUS for frontend)
   - Defining 5 tasks
Saved to .nova/generated-17082024.json
```

## Step 3: Review the PRD

Open `.nova/generated-17082024.json`. You'll see a JSON structure defining tasks.

- **Task 1**: Setup project structure (Agent: SUN)
- **Task 2**: Create Express server (Agent: MARS)
- **Task 3**: Create React components (Agent: VENUS)

## Step 4: Run the Build

Execute the plan using the Ralph Loop.

```bash
npx nova26 run .nova/generated-17082024.json
```

Terminal Output:
```
Starting Ralph Loop...
Using standard LLM calls

--- Processing: TASK-001 (Setup) ---
SUN: Creating directory structure...
Task completed.

--- Processing: TASK-002 (Express Server) ---
Task Progress:
  Analyze requirements
  Implementing MARS deliverable...
MARS: Writing server.ts...
running tsc check...
Gates passed: response-validation, mercury-validator
Task completed.

...
```

## Step 5: Verify Output

Check the `.nova/output/` directory (or the actual generated files if you ran in write-mode).

- **MARS** produced strict TypeScript code.
- **VENUS** produced React components with 5 UI states (Loading, Empty, etc.).

## Step 6: Iterate

Want to add persistence? Run a new generation command:

```bash
npx nova26 generate "Refactor the Todo App to use a SQLite database instead of in-memory."
```

NOVA26 will detect the existing code, assign PLUTO to design the schema, and MARS to update the API.
