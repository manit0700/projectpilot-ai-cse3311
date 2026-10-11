# Current Status

Last updated: September 20, 2026

## Current Phase

Iteration 1 demo polish complete enough to present. Shared GitHub repo is active on `master`.

## Repo

- GitHub: https://github.com/manit0700/projectpilot-ai-cse3311
- Local folder: `projectpilot-ai` (tracks `origin/master`)
- Latest commits include UI improvements PR merge and demo-first presentation assets

## What Is Done

- Student-focused, single-user MVP scope locked in project memory
- Full mock workflow live: idea → questions → requirements → tasks → agents → review → feedback → final plan
- Guided classroom demo sample (`Run guided demo`)
- Per-output human approval and request-revision loop
- Task editing before plan approval; editable requirements
- Markdown final-plan download
- Workflow helpers + basic workflow tests (`tests/workflow.test.cjs`)
- Demo script, demo recording (`.webm`), GitHub team instructions
- Iteration 1 presentations in `docs/presentations/` (including demo-first deck + screenshots)
- UI layout improvements merged from PR #1

## What Is Still Missing / Out Of Scope For Now

- Live AI API calls (intentionally mock-only unless team requests API work)
- Persistence across refresh (session is in-memory)
- Automatic deployment / repo write actions (blocked by design)
- Enterprise / multi-user collaboration features (out of MVP scope)

## What Needs Team Input

- Confirm final project name stays ProjectPilot AI
- Assign the four team member roles / presenters
- Confirm repo public vs private and teammate write access
- Collect quick feedback from 3 to 5 students
- Confirm whether OpenAI is the first planned AI API (later iteration)

## Next Team Tasks

1. Run the guided demo locally before presenting (`npm run dev` → `Run guided demo`)
2. Practice with `docs/DEMO_SCRIPT.md`
3. Use the demo-first deck in `docs/presentations/`
4. Collect student feedback after the demo
5. Decide next iteration priorities (persistence vs live AI vs polish only)

## Simple Team Update Message

ProjectPilot AI MVP is demo-ready on GitHub. The app runs a full mock Manager-led workflow with approval checkpoints, per-output review, feedback revisions, and Markdown export. Iteration 1 presentation and demo script are in `docs/`. Still mock-only and in-memory; no auto-deploy. Next: practice the guided demo and gather student feedback.

## Iteration 2 implementation — October 10, 2026

Implemented optional live manager planning through `/api/manager`, structured response and dependency validation, browser persistence for the current project, interrupted-run recovery, and manager retry handling. Existing editing and approval gates remain active. Demo / Live mode is explicit; specialist execution remains prepared responses for Iteration 3.

See `docs/ITERATION_2_DEMO.md` for tomorrow's presentation and API configuration. Live end-to-end verification still needs a configured API key; this checkout contains none. Browser refresh persistence was verified in Safari. The older "missing live API / persistence" notes above describe the prior iteration.
