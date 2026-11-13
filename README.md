# ProjectPilot AI

Live app: https://projectpilot-ai-cse3311.vercel.app

Student-focused, single-user AI project manager for class projects, hackathons, and portfolio apps (CSE 3311 MVP).

## Shared project memory

Team members should start here:

- `docs/PROJECT_MEMORY.md` - main project memory and current direction
- `docs/CURRENT_STATUS.md` - latest status and next tasks
- `docs/TEAM_DISCUSSION_CHECKLIST.md` - meeting checklist and role split

## Workflow

1. Enter a project idea  
2. Answer clarifying questions  
3. Approve requirements  
4. Review dependency-ordered tasks  
5. Approve plan → specialist agents run  
6. Review agent checks outputs / conflicts  
7. Optional feedback → manager revises affected tasks  
8. Final project plan + evaluation metrics  

## Agents

Manager, Frontend, Backend, Database, Testing, Documentation, Review.

Each agent receives: task id, description, dependencies, expected output, constraints, shared context.  
Each agent returns: summary, assumptions, blockers, confidence, next steps.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Mock AI responses are used by default (no API key required).

## Environment (optional)

Copy `.env.example` to `.env.local`. Do **not** commit real keys.

```bash
cp .env.example .env.local
```

## Security / privacy (MVP)

- No plain-text API key storage in the app  
- Sensitive upload warning before continuing  
- Human approval required for major plan/output changes  
- No automatic deployment  

## Scripts

- `npm run dev` — development server  
- `npm run build` — production build  
- `npm run start` — run production build  
- `npm run lint` — ESLint  

## Iteration 2

Manager planning now supports an explicit **Demo / Live API** selector before a project starts. Live mode calls the server-side `/api/manager` endpoint for questions, requirements, and tasks. Copy `.env.example` to `.env.local`, set `OPENAI_API_KEY`, and restart the server to use it. `OPENAI_MODEL` defaults to `gpt-4o-mini`. Keys are never sent to the browser. Specialist outputs remain prepared demo responses.

The current project is saved on this browser across refresh; reset clears that saved project. API errors preserve input and can be retried using the same button. This iteration uses single-project local browser storage, not cloud or team synchronization.

See [Iteration 2 demo and setup](docs/ITERATION_2_DEMO.md). Run `node --test tests/workflow.test.cjs`, `npm run lint`, and `npm run build` to validate.

## Iteration 3

Live API mode now runs specialists and cross-output review as well as the manager. Specialists receive prerequisite deliverables; feedback rewrites selected outputs and their dependent outputs. Failed calls retry once automatically and remain manually retryable without discarding successful work. Revised outputs require human approval. Generated code is exported as text for human integration/testing; it is not automatically executed or deployed.

See [Iteration 3 setup, screen flow, limitations and professor-feedback mapping](docs/ITERATION_3.md).

Production live requests require LIVE_ACCESS_CODE on the server. Share this access code privately with reviewers. Visitors must unlock Live API and accept the data-sharing notice; Demo mode remains public.

## Website Studio (November 12)

Open `/studio` or choose **Build a website** in the planning header. Includes free-only OpenRouter agents, editable plans, bounded developer/reviewer handoffs, code and page-text editing, sandboxed preview, browser-local versions, HTML export, and GitHub MCP import/draft pull requests. See [setup and verification](docs/WEBSITE_STUDIO.md).
