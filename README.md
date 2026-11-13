# ProjectPilot AI

Live app: https://projectpilot-ai-cse3311.vercel.app (Demo mode is public; Live API needs a private access code.)

ProjectPilot AI is a single-user AI project manager for student software projects (CSE 3311 course project). A manager agent turns a rough idea into clarified requirements and a dependency-ordered task plan, specialist agents produce reviewable deliverables for each task, a review agent checks the outputs together, and the user stays in control: nothing advances without explicit approval, and feedback regenerates only the affected work.

"Multiple agents" here means role-specific prompts, task contracts and shared dependency outputs on one configured model, not separately trained models. Generated code is a deliverable for a human to inspect, run and integrate; the app does not execute tests, write to repositories or deploy anything on its own.

## Workflow

1. **Idea** — describe the project and its users.
2. **Clarify** — the manager drafts answers to its clarifying questions (model-written in Live, prepared drafts in Demo); read and edit them, then **Continue to requirements**.
3. **Requirements** — edit and approve each requirement; editing an approved requirement reopens the plan.
4. **Tasks** — review the task contracts (title, role, dependencies, expected output, constraints); unknown, self or circular dependencies are rejected.
5. **Agents** — specialists run serially in dependency order; each receives the brief, its contract and completed prerequisite deliverables. A failed specialist call is retried once automatically (not after quota or auth errors), a **Stop** button cancels a run, and any failed call can be retried manually without losing other work. Handoff panels show what each specialist received and returned.
6. **Review** — the review agent checks all outputs against their contracts; unresolved conflicts block approval and export.
7. **Feedback** — request changes on selected outputs; they and their dependents are regenerated, unrelated approvals survive, revised outputs need approval again.
8. **Final Plan** — export approved requirements, contracts, deliverables and revision history as Markdown, with measured session metrics (acceptance, revisions, completion, review issues, elapsed time).

### Inputs that shape the plan

On the idea screen you can start from an example template (CRUD web app, REST API, mobile app, ML notebook, small game) and optionally paste a **grading rubric** and **project rules** (stack, course constraints); both flow into the manager and specialist prompts. Each requirement carries **acceptance criteria**. Requirements and outputs can be approved one by one or with **Approve all**.

### Exports

Everything is under **Export & backup** (available at any step; unfinished plans are labelled as drafts) and on the Final Plan screen:

| Group | File | Notes |
| --- | --- | --- |
| Hand it to your coding agent | Plan (Markdown) | Requirements, tasks, outputs and a provenance header (mode, model, date, measured time) |
| | Spec bundle (.zip) | `README.md`, `requirements.md`, `tasks.md`, `design.md`, `AGENTS.md` and `CLAUDE.md` for Claude Code, Copilot or Kiro, and `plan.json` |
| | Code files (.zip) | Only when deliverables name files in fenced code blocks (`filename=` hint, a heading, or a `// file:` first line) |
| Proof of how AI was used | AI-use disclosure (.md) | Accepted unchanged vs edited vs rejected AI drafts, models and tokens, and a statement for a class policy |
| GitHub | Issues (.csv) and `create-issues.sh` | One issue per task with role labels; the script runs `gh issue create`, so read it before running it |
| Backup and logs | `plan.json` backup | Import it later to continue in any browser; also session log CSV and JSON |
| Share | Shareable page (.html) | One read-only file with no scripts or links; print it to PDF |

Builders live in `src/lib/export-*.ts`. The session log records 20 event types (`src/lib/session-log.ts`), and a usage chip shows requests, approximate tokens and models for the current run. Only the exports present in your build count; the list above was checked against `src/lib/export-catalog.ts` on November 13.

## Demo vs. Live API

| | Demo | Live API |
| --- | --- | --- |
| Needs a key | No | Yes, server-side: one of `GEMINI_API_KEY` (free, recommended), `OPENROUTER_API_KEY` (free models) or `OPENAI_API_KEY` (paid) |
| Responses | Prepared, deterministic content; same screens and gates | Real model output validated against strict JSON schemas |
| Access in production | Public | Access code + data-sharing consent, signed 8-hour cookie |
| Persistence | Current project saved in this browser | Same |

Demo is the default on first visit. The mode is chosen before a project starts and cannot change mid-project; reset to switch.

## Interface notes

A dark theme follows the operating system setting; on small screens the header settings sit in a **Settings** menu; a first-visit onboarding strip explains the steps; **Cmd/Ctrl+Enter** advances the primary action and **?** lists the shortcuts. The app ships a branded 404 page, page metadata and Open Graph tags, `robots.txt` (disallows `/api/`) and a web app manifest. The keyboard-only workflow is covered by the browser check in `scripts/verify-peer-review.mjs`.

## Run locally

```bash
npm install
cp .env.example .env.local   # optional; Demo mode runs with no keys
npm run dev -- --port 3314
```

Open http://localhost:3314. Node.js 22 is assumed.

## Environment

All configuration is server-side and documented inline in [`.env.example`](.env.example). Keys are never sent to the browser. Never commit `.env.local`.

**Providers.** Set `AI_PROVIDER` to `gemini`, `openrouter` or `openai`.

| Provider | Cost | Notes |
| --- | --- | --- |
| `gemini` (recommended) | Free tier, no card | Key from https://aistudio.google.com/apikey as `GEMINI_API_KEY`. `GEMINI_MODEL` is a comma-separated list (default `gemini-3.6-flash,gemini-3-flash-preview,gemini-3.1-flash-lite`) tried in order when a model is busy, retired or out of quota; free quota is per model. Per-role overrides `GEMINI_MANAGER_MODEL`, `GEMINI_DEVELOPER_MODEL`, `GEMINI_REVIEWER_MODEL`; `GEMINI_REASONING_EFFORT` is `low` (default) or `off`. Google may use free-tier prompts to improve its products. |
| `openrouter` | Free models only | 50 requests/day, 1,000 after a one-time $10 credit. Models must be `openrouter/free` or end in `:free`; prices are capped at zero. |
| `openai` | Paid, owner pays | Responses API with strict JSON-schema output. |

If `AI_PROVIDER` is unset, the first of OpenRouter, Gemini, OpenAI with a key is used. Website Studio follows Gemini when `AI_PROVIDER=gemini`, otherwise free-only OpenRouter.

**Fallback, quotas and limits** (`src/lib/provider-chain.ts`, `provider-cooldown.ts`, `provider-errors.ts`): `AI_FALLBACK` is an ordered, comma-separated list of providers tried only after the primary (and its model list) fails with a quota or capacity problem; a rejected key or invalid request stops the chain, only listed providers that have a key are used, and OpenAI is used only if listed explicitly (Studio can fall back only between Gemini and OpenRouter). After a quota failure the model (or the whole provider, for account-wide limits) is put on a cooldown so later calls skip it; per-minute limits pause and resume the run automatically once, and a daily limit shows a message with the reset time. Errors are typed (quota, auth, transient, invalid) so messages and retries differ by kind. `PLANNER_RATE_LIMIT` caps requests per 10 minutes per IP on `/api/manager` and `/api/specialist` (default 60, wired into both routes, in-memory per server instance, so a Vercel Firewall rule remains the real control).

**Free-tier budget.** Gemini's free tier has a per-day cap on each model: in testing, every listed model returned 429 after about 60 requests in one day. OpenRouter free is 50 requests per day. A full Live project costs about 14 requests, so plan for roughly three to four Live projects per day on one free key, and use Demo for rehearsals.

**Access.** `LIVE_ACCESS_CODE` (20+ characters, required in production) gates Live API; the experimental GitHub MCP block is off unless its three variables are set.

**Timeouts.** Each route shares one time budget across every model and provider attempt: manager 52 s (route limit 60 s), specialists 250 s with up to 120 s per attempt (route limit 300 s on Vercel), Website Studio 105 s with up to 60 s per attempt (route limit 120 s). See `ROUTE_BUDGETS` in `src/lib/provider-chain.ts`.

## Verification

```bash
npm test          # Node tests in tests/*.test.cjs (mocked providers, no model calls)
npm run lint
npm run typecheck
npm run build
npm run verify    # lint + typecheck + tests + build in one command
```

GitHub Actions (`.github/workflows/ci.yml`) runs the same checks with every provider credential blank, plus advisory browser checks. Browser checks (`npm run test:browser`, `npm run test:studio:browser`) and live-provider scripts live in `scripts/` and expect a running server at `PROJECTPILOT_URL` (default `http://localhost:3314`); outputs go to `artifacts/`, which is git-ignored. Live scripts spend real API quota; run them deliberately.

## Website Studio (experimental)

Website Studio is the execution step for approved frontend tasks. After confirming the idea and task plan, **Confirm idea & open Website Studio** carries the brief, requirements and task contracts into `/studio`, where a manager plan is approved, a developer agent builds a static site (HTML/CSS/JS), a reviewer performs source review, and up to two bounded revision rounds run, all streamed live. The user can edit code or page text, preview in a sandboxed iframe at desktop and mobile widths, keep up to eight browser-local versions, and download a single HTML file. It follows the planning provider when that is Gemini, otherwise free-only OpenRouter models, and has a prepared Demo build that needs no key (it stays in Demo until you unlock and consent to sharing text with the provider, and shows a prepared-example banner). It is not yet deployed to production. Automated GitHub publishing (draft pull request via GitHub MCP) exists behind server-side configuration and is disabled in production. Details: [docs/WEBSITE_STUDIO.md](docs/WEBSITE_STUDIO.md).

## Security and privacy

- API keys and the access code live only on the server; no key storage in the browser.
- Production live requests require the private access code and explicit consent to share project text with the model provider; Demo mode sends nothing to a provider.
- Review conflicts block approval; revised outputs require human approval; models cannot approve their own output.
- Generated code and websites are exported for human inspection; nothing is executed server-side, published or deployed automatically. Studio previews run only in a sandboxed iframe.
- Browser-local storage holds one project per browser/origin; there is no account system or cloud sync.
- Production access codes must be 20+ characters; live-access and Studio routes are rate limited in memory (defence in depth; use a Vercel Firewall rule as the real control); Studio strips redirect and CSP meta directives from generated HTML and previews it only in a sandboxed iframe.

## Documentation

- [docs/CURRENT_STATUS.md](docs/CURRENT_STATUS.md) — what is deployed, what works, open items, freeze plan.
- [docs/MARKET_ANALYSIS.md](docs/MARKET_ANALYSIS.md) — positioning, competitor comparison, gaps.
- [docs/STUDY_KIT.md](docs/STUDY_KIT.md) — protocol for the student sessions and how to compute accept/edit/reject rates.
- [docs/SUBMISSION_CHECKLIST.md](docs/SUBMISSION_CHECKLIST.md) — minimum credible final submission and out-of-scope list.
- [docs/FINAL_DEMO_SCRIPT.md](docs/FINAL_DEMO_SCRIPT.md) — 4-minute demo script.
- [docs/ITERATION_3.md](docs/ITERATION_3.md) — live specialist design, screen specification, professor-feedback mapping, verification record.
- [docs/WEBSITE_STUDIO.md](docs/WEBSITE_STUDIO.md) — Studio setup, limits and verification.
- [docs/iteration3/](docs/iteration3/) — Iteration 3 submission package and student feedback session kit.
- [docs/archive/](docs/archive/) — superseded plans, Iteration 1–2 material and earlier reports.
