# Iteration 3 — Live specialist deliverables and feedback

Implemented November 1, 2026 on OpenAI; provider wording and retry behaviour updated November 13 to match the current code (Gemini, OpenRouter and OpenAI are all supported; see [CURRENT_STATUS.md](CURRENT_STATUS.md)). Sections headed with a date record what was verified on that date. This iteration extends the Iteration 2 live manager with live specialist execution, bounded retries, cross-output review and real revisions.

## Supported scope

Single-user, small student web applications: a study-session planner, a local task tracker, or a club event signup prototype. ProjectPilot itself is also a suitable scoped example: design a failed-task retry flow. Keep briefs focused on a few screens and explicit inputs/outputs. Specialists can generate implementation text/code, database schemas, screen designs, test examples and README instructions, depending on the approved task contract.

Generated code is a deliverable for a human to inspect, run and integrate. The application does not execute generated tests, inspect an existing repository automatically, write files to a repository, deploy an application, or guarantee a complete working project. Repository/document import, database integration, risk/competitor research and open-source model hosting remain future work. Do not present this iteration as having those capabilities.

## Run and verify

From the repository root, use Node.js 22 and npm:

```sh
npm ci
cp .env.example .env.local
# Optional for Live API: set AI_PROVIDER and one key in .env.local, for example
#   AI_PROVIDER=gemini and GEMINI_API_KEY=... (free key from https://aistudio.google.com/apikey)
# OpenRouter (free models) and OpenAI (paid) are alternatives; see .env.example.
npm run dev -- --port 3314
```

Open http://localhost:3314. Select **Agent mode → Live API** before creating a project. The manager, specialist and review requests all use the server-side key of the configured provider. Demo mode remains available without a key and uses prepared responses. The mode cannot change midway through a saved project; reset before starting in another mode.

```sh
node --test tests/workflow.test.cjs
npm run lint
npm run build
```

Optional verification against a running server:

```sh
# Chrome and WebKit browser checks of the demo workflow, approvals, export and refresh recovery.
PROJECTPILOT_URL=http://localhost:3314 node scripts/verify-peer-review.mjs
# Makes live API requests that spend quota (or money, on OpenAI) on the configured provider; only run intentionally.
node scripts/verify-iteration3-live.mjs
```

Set PROJECTPILOT_URL if the server uses another address (browser scripts default to http://localhost:3314). The earlier `verify-iteration3-browser.mjs` smoke script is superseded by `verify-peer-review.mjs`. Browser smoke checks use a fresh isolated browser context and do not clear your normal browser's saved project.

## Behavior and design

1. The user approves all requirements, edits the task contracts as needed, and approves the task plan.
2. Tasks run serially in dependency order. A specialist receives the approved brief/requirements, the task contract and actual completed prerequisite deliverables. Serial execution bounds API use; it is not a claim of parallel agent execution.
3. Each specialist produces summary/deliverable text, assumptions, blockers, confidence and next steps. Generated code can be included as Markdown code blocks with filenames. Application-generated IDs and pending approval prevent a model from approving its own output.
4. Production live calls require a private reviewer access code and explicit data-sharing consent. Signed HttpOnly cookies expire after eight hours. Demo remains public.

Retry behaviour differs by route. As of the November 13 code, the specialist route (task execution and review) makes up to two attempts inside one shared 250 second budget, each attempt at most 120 seconds (route limit 300 seconds on Vercel), retrying a timeout, malformed response or transient 5xx failure once; quota, authentication and invalid-request errors are not retried automatically. The manager route (answers, requirements, tasks) makes one request chain inside a 52 second budget (route limit 60 seconds) and does not retry the whole request; the user retries from the screen. Within one request the server may move to the next Gemini model, or to a provider listed in `AI_FALLBACK`, after a quota or capacity failure (src/lib/provider-chain.ts). A Stop button cancels a run. Authentication and rate/billing failures return directly on every route. After failure, the board preserves completed unrelated work and offers **Retry task**. Prerequisites remain blocked until the failed task succeeds.
5. When all tasks complete, the live review agent checks the actual outputs together against their contracts and requirements. A validated review must include exactly one entry per output. Missing reviews prevent final export. **Retry review** reruns review without rerunning completed specialists. Findings stay visible during human approval. Unresolved conflicts block approval and final export.
6. Feedback regenerates selected outputs and their transitive dependents in dependency order. It sends the original feedback and previous deliverable to each affected specialist. Unrelated approvals are preserved; revised outputs require approval again. An open feedback record survives failures so manual retry can reuse the request.
7. Editing an approved requirement reopens the existing task plan and invalidates outputs. Review/edit the task contracts before approving again. Requirement changes do not automatically invent new tasks; the preserved plan still needs human checking.
8. Browser storage retains the project, feedback and outputs. Interrupted work can be retried. Final Markdown includes approved deliverables and revision history.

The workflow supports returning to requirements and feedback after execution; it is not a one-way waterfall. Multiple agents here mean role-specific prompts, task contracts and shared dependency outputs using the configured model, not separately trained models. Whether this is more useful than one agent remains an evaluation question, not a measured result.

## Screens / transition specification

| Screen | Inputs and outputs | Normal transition | Exceptional path |
| --- | --- | --- | --- |
| Task breakdown | Editable title, description, role, dependencies; expected output shown | Approve → agent board | Unknown/self/circular dependencies rejected |
| Agent board | Status columns, prerequisite names, retry/skip controls | All complete → review | Failed task → retry; unrelated tasks preserved; skip cannot unlock final |
| Review | Deliverable, assumptions, next steps, blockers, findings, human approval | Approve/request revision → feedback | Missing AI review → retry review; model output never self-approves |
| Feedback | Selected task IDs and free-text change | Regenerate affected dependency chain → review | Failure → board; open feedback retained for retry |
| Final | Approved requirements, task contracts, deliverables and metrics | Download Markdown | Incomplete tasks, missing reviews or pending approvals block final |

Review text preserves whitespace/code formatting, and the shared small-text size is increased for presentation readability. Desktop/mobile screenshots are in iteration3-evidence/. A live demo should show the failed-task recovery and feedback loop; retain a video as backup.

## Key code

- src/app/api/specialist/route.ts: origin/body/approval/dependency validation; server-side provider calls through src/lib/ai-service.ts; two-attempt bound.
- src/lib/specialist-schema.ts: output/review schemas and independent runtime validation.
- src/lib/specialist-client.ts: browser requests without credentials, response validation.
- src/lib/store.tsx: scheduling, state recovery, dependency-aware feedback and human gates.
- tests/workflow.test.cjs: prior regression coverage plus new live-path tests using mocked service responses.

## Professor feedback mapping

| October 26 comment | Iteration 3 response |
| --- | --- |
| Specialized agent with retry | Live specialists, one automatic retry, manual per-task retry |
| Does feedback affect results? | Real regeneration with previous deliverable and dependency propagation |
| Small demo font | Shared small-text size increased; preserved multiline output |
| No screen designs | Screen transition specification above; frontend specialist instructed to deliver layouts/transitions when requested |
| Try it on this class project | Opt-in live smoke brief targets ProjectPilot's retry-screen design; this is a narrow self-check, not an end-user study |
| Why multiple agents / versus existing tools? | Explicit role contracts, dependency context and approval history; comparative value still needs user evidence |
| Testing and feedback | Automated regression/live-path coverage plus browser/live smoke scripts; external student feedback still needs collection |

## Sources

Iteration 3 shipped on the OpenAI Responses API with the strict JSON-schema output format described in [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs). The current code sends the same schemas through `src/lib/ai-service.ts` to Google Gemini or free-only OpenRouter as well (with schema adjustments for Gemini), tries Gemini models in a fallback list, and can fall back to other configured free providers. In every case local validation rejects malformed or mismatched responses. Route handlers follow the installed Next.js route-handler documentation in node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md.

Professor feedback source: Christoph Csallner, Iteration 2 comments, October 26, 2026, supplied by the team on November 1. Implemented behavior addresses that feedback; no external student interviews or measured productivity gains are claimed.

## Verification results — November 1, 2026 (historical; OpenAI build)

- 21 Node tests passed, including all 11 earlier regression tests and specialist/review/live-workflow and peer-review regression tests. Live-path tests inject service responses; they do not prove model-generated code works.
- Production build and TypeScript compilation passed.
- ESLint: zero errors. Removed the unused capture helper during review cleanup.
- Chrome browser smoke: demo workflow, individual approvals, Markdown download, refresh restore, mobile overflow check, Live-mode feedback/review UI with mocked service responses, and no uncaught browser exceptions passed.
- Real server/API smoke: specialist output, cross-output review and changed feedback revision passed on the ProjectPilot retry-design example. Review returned flagged, not a guaranteed correctness verdict. The first smoke attempt failed with a timeout/invalid-output response; an explicit rerun passed. This illustrates why manual recovery remains necessary.
- These are developer checks. External customer/user interviews and comparison with a single-agent baseline have not been conducted as part of this implementation.

## Peer review fixes in progress

The November 1 review pass adds production Live API access-code authentication with a signed HttpOnly cookie and a required data-sharing consent screen. LIVE_ACCESS_CODE must be set server-side before deploying this revision. Demo remains public. Live access is invite-based; distributed usage quotas are not implemented.

Metrics are now above the workflow, with an explanation of the usefulness rating. Bottom Previous/Next controls preserve approval gates. Detail fields enforce minimum lengths. The demo AI keyword uses word boundaries. Damaged saves retain a recovery copy when storage permits. Further timeout, corrupted-save, keyboard, browser and export verification is in progress. External student sessions still require real participants.

## Verified peer-review resolution

Findings 1 to 4: usefulness explanation, metrics above the workflow, bottom navigation, and minimum detail lengths. Finding 5: readable screenshots in the accompanying report. Finding 6: recorded real hosted manager/specialist/review/revision calls. Finding 8: unresolved conflicts block individual approval and final export. Finding 9: Live API regenerates outputs and dependents; Demo now replaces the sample deliverable instead of appending text. Finding 10: correct saved-state message. Finding 11: word-boundary AI keyword matching. Findings 12 and 13: complete keyboard workflow in Chrome and WebKit. Finding 14: mandatory data-sharing consent before live access. Finding 15: delayed abort test preserves the draft and permits retry; deadline scaled to 30 ms for the automated test. Finding 16: invalid JSON, old saves and malformed collections retain a recovery copy and usable session. Finding 17: production requests require a signed access session. This is invite-based authentication, not per-user distributed quotas. Finding 18: edited data, dependency order, approvals, revisions and Markdown character export checks.

Finding 7 remains open: target-student interviews require actual participants. Peer review is documented separately and is not presented as a completed usability study. Full browser results are in docs/iteration3-evidence/peer-review-browser-results.json. WebKit is a second browser engine, not a claim of manual testing in the Safari desktop app.

## Additional verification November 1

Slow keyboard simulation passed in Chrome and WebKit with 562 typed characters and nine deliberate spelling corrections per browser. A separate browser integration test used the actual 55-second manager timeout without scaling; the observed 55.23-second failure preserved the draft through refresh and allowed retry. Only the provider was stubbed, so it did not incur model charges or simulate student participation. See docs/iteration3/Keyboard_Test_Report.md for scope and limitations, and Student_Feedback_Session_Kit.md for real sessions that remain outstanding.

## Related documents

Current state, open items and the freeze plan: [CURRENT_STATUS.md](CURRENT_STATUS.md). Iteration 2 setup notes and the pre-Iteration 3 plans are archived in [archive/](archive/). The Website Studio execution step added after this iteration is described in [WEBSITE_STUDIO.md](WEBSITE_STUDIO.md).
