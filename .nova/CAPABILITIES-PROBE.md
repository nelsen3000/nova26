# NOVA26 — Agent Capabilities Probe
## Send this EXACT prompt to each of the 5 coding workers FIRST

```
You are being evaluated for a role on the Nova26 24-hour sprint team.

Before we assign you tasks, answer these questions honestly and precisely:

1. ENVIRONMENT: What tools do you have access to right now?
   - Can you read/write files directly to disk?
   - Can you run shell commands (npm, npx, tsc, vitest)?
   - Can you access the internet or search documentation?
   - Can you see the current directory structure?
   - What is your context window limit?

2. TECH STACK KNOWLEDGE: Rate yourself 1-5 on each:
   - TypeScript strict mode (no `any`, proper generics)
   - Next.js 15 App Router (not Pages Router)
   - React 19 (use() hook, Server Components)
   - Convex backend (defineQuery, defineMutation, defineAction, validators, indexes)
   - Tailwind CSS 4
   - shadcn/ui component library
   - Vitest testing framework
   - ESM imports with .js extensions

3. CONSTRAINTS: Answer yes/no:
   - Can you produce files longer than 500 lines in a single response?
   - Can you maintain context across multiple back-and-forth messages?
   - Do you have access to the Nova26 GitHub repo (nelsen3000/nova26)?
   - Can you run `npx convex dev` or `npx tsc --noEmit`?
   - Can you create multiple files in a single response?

4. WORK STYLE: 
   - If I give you a 2-hour task and walk away, can you execute it fully without further input?
   - What's the maximum number of files you can generate in one response before quality drops?
   - Do you need me to paste file contents for context, or can you read them yourself?
   - If you hit an error, do you retry automatically or wait for me?

5. QUICK TEST: Write a minimal Convex query function that:
   - Takes a userId (string) as argument
   - Queries the `agentActivityFeed` table
   - Filters by userId using the `by_user_and_time` index
   - Returns the 10 most recent items
   - Uses proper Convex validators and TypeScript types
   - Include the import statements

This test tells me if you actually know Convex or if you'll hallucinate the API.

Reply concisely. No fluff. Just answers and the code sample.
```
