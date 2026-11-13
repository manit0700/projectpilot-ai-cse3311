# Final submission checklist

The minimum credible final submission for ProjectPilot AI (CSE 3311). Each item is binary; if it cannot be checked, the report must say so rather than imply it. Dates follow the freeze plan in [CURRENT_STATUS.md](CURRENT_STATUS.md).

## Code and deployment

Legend: `[x]` exists in the working tree as of November 13 and was checked; `[ ]` is still to do. Nothing from this week is committed yet.

- [ ] **Commit everything and tag `rc1`** (D-14), deploy it with `vercel deploy --prod`, and confirm the live URL serves it.
- [ ] A tagged commit (`final`) is what production serves; the live URL and the tag are both in the report.
- [x] `npm run verify` exists (lint, typecheck, tests, build); 150 of 150 tests passed locally on November 13, with lint, typecheck and the production build clean.
- [ ] The same checks are green on the tagged commit in GitHub Actions (the workflow is untracked until committed).
- [ ] Production has `LIVE_ACCESS_CODE` (20+ characters) set; Demo mode is public; the Vercel WAF rate-limit rule exists for `/api/*`. If Gemini is used in production, `AI_PROVIDER=gemini` and `GEMINI_API_KEY` are set server-side.
- [x] `.env.example` documents the variables the code reads, including `AI_FALLBACK` and `PLANNER_RATE_LIMIT`, both implemented and wired on November 13. Re-check after any later provider change.
- [ ] No secrets anywhere in the repository history being submitted.
- [x] Demo mode opens by default and completes the full workflow without a key (covered by tests, a Demo end-to-end run that downloaded all 9 available exports, and a keyboard-only Chrome run; WebKit was not installed locally, so only Chromium was run).
- [ ] Redeploy to Vercel from the tagged commit: production still runs the November 1 build, so none of the exports, providers or UI changes are live yet.

## Evidence

- [ ] **Feedback-mapping table**: every professor comment from Iteration 2 and 3 reviews, the change made, and where to see it (commit, screen, test). Base: the table in [ITERATION_3.md](ITERATION_3.md).
- [ ] **3–5 student sessions** run with the deployed release candidate using [STUDY_KIT.md](STUDY_KIT.md) (which points to [iteration3/Student_Feedback_Session_Kit.md](iteration3/Student_Feedback_Session_Kit.md)): consent noted, session-log CSV exported per participant, accept/edit/reject rates computed per the kit, task given, observed problems, verbatim quotes, what changed as a result. Real participants only; no invented results.
- [ ] **Bounded comparison vs. a single chat session**: same brief, same time box, same evaluator rubric (completeness, dependency correctness, number of corrections needed). Report it as a small qualitative comparison, not a measured productivity gain.
- [ ] Automated-test, lint and build output captured for the tagged commit (screenshot or CI link).
- [x] Exports exist for the evidence the report needs: Markdown plan, spec bundle, AI-use disclosure, session log CSV/JSON, `plan.json` backup. Attach examples from the recorded run.
- [ ] [MARKET_ANALYSIS.md](MARKET_ANALYSIS.md) turned into the report's related-work section; re-check every price and student-program claim against its source first, since they change monthly.

## Deliverables

- [ ] Final written report: problem, design, what was built per iteration, evaluation evidence, limitations, future work; uses only the evidence above.
- [ ] Slides for the final presentation.
- [ ] Demo video (≤ 4 minutes, Demo mode, per [FINAL_DEMO_SCRIPT.md](FINAL_DEMO_SCRIPT.md)); optional Studio coda labelled experimental.
- [ ] Exported Markdown plan from the recorded run attached as an artifact.

## Repository hygiene

- [x] README describes one product, providers, current run and verification commands, and links to docs that exist (links checked November 13).
- [x] Superseded documents live in `docs/archive/`; docs were aligned to `CURRENT_STATUS.md` on November 13. Re-read after any later change.
- [ ] Unreferenced scripts, large media duplicates and template assets removed (list in the November 12 tidy-up report).
- [x] `artifacts/`, `.env*`, `.claude-flow/` and `.code-review-graph/` are git-ignored.
- [ ] No untracked files left behind (everything from this week is untracked until committed); about 17 MB of tracked video is moved to a GitHub release or accepted knowingly.

## Explicitly out of scope for the final submission

State these in the report and presentation so they are not read as missing work:

- Automated GitHub publishing or deployment of generated websites (the GitHub MCP draft-PR path stays experimental and disabled in production).
- Backend generation, package installation or test execution for generated websites; Studio builds static sites only and the reviewer performs source review only.
- Multi-user accounts, cloud persistence or team synchronization; one project per browser/origin.
- A statistically valid productivity comparison; the comparison is small and qualitative.
- Guaranteed availability or quality of free OpenRouter models; failures are surfaced and retryable, not prevented.
