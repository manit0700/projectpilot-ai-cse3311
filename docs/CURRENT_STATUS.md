# Current Status

Last updated: November 13, 2026. This is the single current-state page; older per-iteration notes are in [archive/](archive/).

Repository: https://github.com/manit0700/projectpilot-ai-cse3311 · Production: https://projectpilot-ai-cse3311.vercel.app

## Where the code is, and what is deployed

- **Production still runs the November 1 Iteration 3 build**, deployed from the local tree with the Vercel CLI (git-based deployment is not configured). Production has `OPENAI_API_KEY`, `OPENAI_MODEL` and `LIVE_ACCESS_CODE` set server-side. Demo mode is public; Live API needs the private access code and the data-sharing consent. **None of the work below is live there yet.**
- **Commit state.** The last commit is b2102e0 (Website Studio, November 12). Everything described below, including the Gemini provider, provider fallback, all exports, the session log, the UI changes, the new tests, CI and the docs, is **uncommitted or untracked in the working tree as of writing** (137 changed or untracked paths in `git status`). Commit and tag `rc1` before the submission window closes, then redeploy that tag.

## What works in the working tree (November 13)

Developer-verified on November 13: **150 of 150 Node tests pass** across 12 files in `tests/`, lint and typecheck are clean, the production build passes, a full Demo end-to-end run downloaded all 9 available exports (the catalog has 10; the code zip needs outputs that name files) with no console errors, and a keyboard-only Chrome run passed. Only Chromium was run (`PROJECTPILOT_ENGINES=chromium`); the WebKit browser is not installed on this machine, so the WebKit half of `scripts/verify-peer-review.mjs` was not exercised. Tests mock every provider; no model is called. These are developer checks, not user evidence.

**Planning workflow**
- Idea, Clarify, Requirements, Tasks, serial specialists, cross-output review, feedback with selective regeneration, and export, in Demo and Live API. Demo is the default and needs no key.
- Clarify auto-drafts answers (model in Live, prepared drafts in Demo); the student edits them and continues with **Continue to requirements**.
- Each requirement has acceptance criteria. The idea screen takes an optional grading rubric and project rules that flow into prompts, and offers five example templates. **Approve all** exists for requirements and outputs.
- Human gates: review conflicts block approval and export; revised outputs need approval again; a model never approves its own output. Measured metrics replace the old "time saved" figure.

**Exports** (header **Export & backup** at any step, plus the Final Plan screen; `src/lib/export-*.ts`): Markdown plan with provenance header (drafts are labelled), spec bundle zip (`README.md`, `requirements.md`, `tasks.md`, `design.md`, `AGENTS.md`, `CLAUDE.md`, `plan.json`), code files zip (only when outputs name files), AI-use disclosure, GitHub issues CSV and `create-issues.sh`, `plan.json` backup with import, session log CSV and JSON, and a shareable read-only HTML page.

**Evaluation support.** A session event log (20 event types, `src/lib/session-log.ts`) and a usage chip (requests, approximate tokens, models). See [STUDY_KIT.md](STUDY_KIT.md).

**Providers and limits.** `AI_PROVIDER` is `gemini`, `openrouter` or `openai`; Gemini (free key from https://aistudio.google.com/apikey) is recommended, with `GEMINI_MODEL` tried in order (default `gemini-3.6-flash,gemini-3-flash-preview,gemini-3.1-flash-lite`).
- `AI_FALLBACK` works: ordered fallback providers used only after quota or capacity failures; OpenAI only if listed; Studio can fall back only between Gemini and OpenRouter.
- Per-model quota cooldowns, automatic one-time resume after a per-minute limit, a daily-limit message with the reset time, typed error kinds (quota, auth, transient, invalid) and a **Stop** button.
- `PLANNER_RATE_LIMIT` is wired into `/api/manager` and `/api/specialist` (default 60 per 10 minutes per IP, in memory per instance; a Vercel Firewall rule is still the real control). Live-access and Studio routes have their own limiters.
- **Free-tier budget.** Gemini's free tier has a per-day cap on each model (observed: all models returned 429 after about 60 requests in a day) and OpenRouter free is 50 requests per day. A full Live project is about 14 requests, so budget three to four per day on one key.
- Shared per-route time budgets: manager 52 s, specialists 250 s (up to 120 s per attempt, one automatic retry), Studio 105 s (up to 60 s per attempt).

**Interface.** Dark theme (follows the OS setting), mobile Settings menu, onboarding strip, keyboard shortcuts (Cmd/Ctrl+Enter, ?), branded 404, page metadata, `robots.txt` and web manifest.

**Website Studio** follows Gemini when `AI_PROVIDER=gemini`, otherwise free-only OpenRouter. It stays in Demo (prepared output with a banner) until the user unlocks and consents, saves versions ("Version N saved", up to eight, browser-local), and exports one HTML file. GitHub MCP publishing is experimental and disabled in production. See [WEBSITE_STUDIO.md](WEBSITE_STUDIO.md).

**Security and CI.** Production access code must be 20+ characters; same-origin checks and body-size caps in `src/lib/api-guard.ts`; Studio HTML has redirect, rebase and CSP meta directives stripped and previews only in a sandboxed iframe. CI (`.github/workflows/ci.yml`) runs lint, typecheck, tests and build with all provider credentials blank, plus advisory browser jobs; it has never run on GitHub because it is untracked. `npm run verify` runs lint, typecheck, tests and build.

## Not built (deliberately out of scope)

Team assignment and due dates, plan version history and diff, bring-your-own-key, and a multi-project switcher (one project per browser). See [MARKET_ANALYSIS.md](MARKET_ANALYSIS.md).

## Open items for the final submission

| Item | State |
| --- | --- |
| Commit and tag `rc1`, redeploy to Vercel | Pending. Nothing from this week is committed, and production still runs the Nov 1 build. |
| User feedback study (3–5 target students) | Not started. Protocol: [STUDY_KIT.md](STUDY_KIT.md); original template: [iteration3/Student_Feedback_Session_Kit.md](iteration3/Student_Feedback_Session_Kit.md). No results may be invented. |
| Comparative evaluation vs. a single chat session | Not started. Must be bounded (same brief, same time box, qualitative) and reported as such. |
| Final written report | Not started. Reuse the professor-feedback mapping in [ITERATION_3.md](ITERATION_3.md) and the positioning in [MARKET_ANALYSIS.md](MARKET_ANALYSIS.md). |
| Final demo video (4 min + optional Studio coda) | Script updated: [FINAL_DEMO_SCRIPT.md](FINAL_DEMO_SCRIPT.md). Recording pending. |
| Slides | Not started. Iteration 3 deck in [iteration3/](iteration3/) is the base. |
| Repository tidy-up | Docs archived November 12; about 17 MB of tracked video should move to a GitHub release (see below). |

See [SUBMISSION_CHECKLIST.md](SUBMISSION_CHECKLIST.md) for the minimum credible submission and the explicit out-of-scope list.

## Repository size note

Tracked media under `docs/` is about 17 MB (`iteration3/*.mp4` 6.7 MB and 7.2 MB, `demo-recordings/*.webm` 2.1 MB, plus slide decks and reports). Recommendation: attach the videos to a GitHub release and link them from the docs; do this only after the final recording so links do not break.

## Freeze plan

D = final submission date (FILL IN). Dates are relative so the plan survives a schedule change.

| Milestone | Rule |
| --- | --- |
| **D-14 — RC1** | Commit and tag `rc1`; deploy it to production with `vercel deploy --prod`. From here, production always runs a tagged commit. |
| **D-7 — feature freeze** | No new features. Only bug fixes, tests, docs and evidence collection. Student sessions and comparison run against the deployed RC. |
| **D-5 — evidence freeze** | Feedback sessions, comparison notes, screenshots and video are final. Report and slides are written from this evidence only. |
| **D-3 — code freeze** | Only critical fixes with a test. Tag `final`, redeploy, verify the live URL matches the tag, finish report/slides/video. |

## Team roles

Fill in from the actual team roster; no names are assumed here.

| Role | Owner | Responsibilities for the final submission |
| --- | --- | --- |
| Code and deployment | FILL IN | RC/final tags, Vercel deploy, CI green, env configuration |
| Evaluation | FILL IN | Student sessions, comparison vs. single chat, findings write-up |
| Report and slides | FILL IN | Final report, feedback-mapping table, presentation |
| Demo video | FILL IN | Record and edit the 4-minute demo per FINAL_DEMO_SCRIPT.md |
