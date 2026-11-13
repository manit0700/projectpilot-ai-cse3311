# GitHub Team Instructions

Project repository:

```text
https://github.com/manit0700/projectpilot-ai-cse3311
```

## Current Shared Project Folder

If you already cloned the repo, go into your local project folder first:

```bash
cd projectpilot-ai-cse3311
```

If your folder is somewhere else, use your actual path. Example:

```bash
cd /Users/YOUR_NAME/projectpilot-ai-cse3311
```

## First Time Setup

Use this only if you do not have the project on your computer yet.

```bash
git clone https://github.com/manit0700/projectpilot-ai-cse3311.git
cd projectpilot-ai-cse3311
npm install
npm run dev
```

Then open:

```text
http://localhost:3000
```

## Always Pull Before Working

Before editing anything, pull the latest team changes:

```bash
git pull origin master
```

This prevents you from working on an old version.

## Check Current Git Status

Use this any time you want to see what changed:

```bash
git status
```

Shorter version:

```bash
git status --short --branch
```

Meaning:

- `M file` means the file was modified.
- `?? file` means the file is new and not tracked yet.
- `nothing to commit` means your local copy has no uncommitted changes.
- `ahead of origin/master` means you committed locally but did not push yet.
- `behind origin/master` means someone pushed new work and you need to pull.

## See What Changed

Show changed files:

```bash
git diff --stat
```

Show actual line changes:

```bash
git diff
```

Show recent commits:

```bash
git log --oneline -5
```

## Save Your Work To Git

After you edit files and test your work:

```bash
git status
git add .
git commit -m "Short message describing your update"
git push origin master
```

Example:

```bash
git add .
git commit -m "Improve demo UI layout"
git push origin master
```

## Pull Teammate Updates

If someone else says they pushed changes, run:

```bash
git pull origin master
```

Then restart the app if needed:

```bash
npm run dev
```

## Run The App

Install dependencies if needed:

```bash
npm install
```

Start the local app:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Build Check Before Pushing

Before pushing code changes, run:

```bash
npm run build
```

If the build fails, fix the error before pushing.

## Important Project Files

### Main App Files

```text
src/app/page.tsx
```

Main app page. It loads the ProjectPilot app.

```text
src/components/ProjectPilotApp.tsx
```

Controls which screen is shown in the workflow.

```text
src/components/screens-early.tsx
```

Early workflow screens:

- New project screen
- Guided demo button
- Clarifying questions
- Requirements approval
- Task breakdown

```text
src/components/screens-late.tsx
```

Later workflow screens:

- Agent assignment board
- Review outputs
- Feedback / revision
- Final project plan

```text
src/components/shell.tsx
```

Shared layout pieces, navigation, approval bar, and app shell.

### Logic Files

```text
src/lib/store.tsx
```

Main app state and workflow actions. This controls how the project moves from idea to questions, requirements, tasks, agents, review, feedback, and final plan.

```text
src/lib/mock-ai.ts
```

Mock AI logic. This creates questions, requirements, tasks, agent outputs, reviews, and metrics without using a real AI API yet.

```text
src/lib/agents.ts
```

Agent definitions and labels.

```text
src/lib/types.ts
```

TypeScript data types for projects, agents, tasks, requirements, reviews, feedback, and metrics.

### Documentation Files

```text
docs/PROJECT_MEMORY.md
```

Shared project memory and main decisions.

```text
docs/CURRENT_STATUS.md
```

Current state of the project.

```text
docs/DEMO_SCRIPT.md
```

Presentation demo script and step-by-step video plan.

```text
docs/demo-recordings/projectpilot-ai-demo.webm
```

Recorded silent demo video.

```text
docs/presentations/ProjectPilot_AI_Iteration1_Presentation.pptx
```

Iteration 1 presentation deck.

### Recording Script

```text
scripts/record-demo.mjs
```

Automated Playwright script that records the guided demo workflow.

## Simple Team Workflow

Use this every time:

```bash
git pull origin master
npm install
npm run dev
```

Make your changes.

Then:

```bash
npm run build
git status
git add .
git commit -m "Describe your update"
git push origin master
```

## Codex Prompt For Teammates

Use this prompt in Codex before starting work:

```text
Go to my local projectpilot-ai-cse3311 repo. Pull the latest changes from origin/master. Check git status. Run npm install if needed. Start or verify the app with npm run dev. Before editing, tell me what files are relevant for my task and do not overwrite other teammates' work.
```

Use this prompt after finishing work:

```text
Run npm run build. Show me git status and git diff summary. If the changes are correct, commit them with a clear message and push to origin/master. Do not remove or overwrite other teammates' work.
```

## Rules For Team Members

- Pull before starting work.
- Build before pushing code.
- Use clear commit messages.
- Do not edit unrelated files.
- Do not delete teammate work.
- If Git shows a conflict, stop and ask before forcing anything.
- Never run destructive commands like `git reset --hard` unless the whole team agrees.
