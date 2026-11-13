# Market analysis and positioning

Written November 13, 2026 for the CSE 3311 final report. This is a desk comparison, not a measured evaluation. Competitor facts come from vendor pages and third-party write-ups listed under [Sources](#sources); they were not independently tested, and **prices, free tiers and student programs change monthly**, so re-check each source before quoting a number in the report. No claim about ProjectPilot here is a user-study result.

## Positioning

**Tagline: AI planning you can hand in.**

- From rough idea to a spec bundle your coding agent can run, free.
- Plan first, build second, no credit burn.

ProjectPilot is the planning stage for student software projects. Most competitors start at "build me an app" and spend credits generating code before the requirements are agreed. ProjectPilot stops earlier: it produces approved requirements, task contracts with dependencies, per-task deliverables and a cross-output review, then exports a plan a human (or a coding agent) can execute. Demo mode needs no key, account, IDE or card; Live mode runs on a free Gemini key.

## Competitor landscape

Grouped by what the tool is for. "Overlap" is the part of ProjectPilot's job the tool also does.

| Tool | Category | What it does | Overlap with ProjectPilot | Where ProjectPilot differs |
| --- | --- | --- | --- | --- |
| GitHub Spec Kit | Spec-driven CLI | Command-line workflow that turns a spec into plan, tasks and code inside an AI coding agent | Closest in spirit: spec, plan, tasks | Needs a repo, CLI and a paid or configured coding agent; no approval UI, no dependency checks, no review gate |
| Kiro (AWS) | Spec-driven IDE | IDE with requirements, design and task specs; has a student offer | Requirements, design, tasks | Requires installing an IDE and an account; ProjectPilot is a browser app with a free Demo mode |
| BMAD | Agent method | Prompt-based multi-role agile method run inside a coding agent | Role-based planning | A methodology you run inside another tool, not a guided app with gates |
| OpenSpec | Spec-driven CLI | Lightweight change-spec workflow for coding agents | Spec and task artefacts | Same CLI and agent prerequisite |
| Lovable | App builder | Prompt to full-stack app with hosting; student program | Idea to product | Builds first and spends credits; no requirements gate or task contracts |
| v0 (Vercel) | App/UI builder | Generates UI and apps from prompts | Idea to UI | Same build-first model; credit-metered |
| Bolt | App builder | In-browser prompt-to-app builder | Idea to product | Same build-first model; token-metered |
| Replit Agent | Cloud IDE agent | Agent that scaffolds and runs apps in Replit; education offers | Idea to product | Execution environment, not a planning artefact |
| Base44 | App builder | Prompt-to-app with managed backend | Idea to product | Build-first, hosted |
| Figma Make | Design-to-app | Prompt and design to working prototype in Figma | Idea to prototype | Design tool centred |
| Jules (Google) | Coding agent | Asynchronous agent that works on a repository task | Task execution | Needs an existing repo; no planning gate |
| GitHub Copilot coding agent | Coding agent | Assigns issues to an agent that opens pull requests | Task execution | Needs a repo and subscription; ProjectPilot can produce the issues it would consume |
| Codex / Devin | Coding agent | Autonomous software-engineering agents | Task execution | Same; paid |
| Taskade / Notion / Linear | Project tools | Task boards with AI assistants | Task lists | General tools, no requirement-to-task contracts or review conflicts |
| CrewAI / LangGraph / AutoGen / MetaGPT | Multi-agent frameworks | Libraries for building agent systems | "Multiple agents" | Frameworks for developers, not a student-facing product |

Note: Firebase Studio is shutting down on 2027-03-22 (Google's migration guide), which is relevant if a team was considering it.

## What ProjectPilot does uniquely

Each point below is implemented in the repository and covered by the Node tests unless marked otherwise; none is a claim that it improves student outcomes.

1. **Requirements gate that reopens the plan on edit.** Editing an approved requirement reopens the task plan and invalidates outputs, so the plan is never built on stale text.
2. **Task contracts with cycle checks.** Each task has an owner, dependencies, expected output and constraints; unknown, self and circular dependencies are rejected.
3. **Review conflicts that block export.** The review agent checks outputs against each other; unresolved conflicts block approval and final export, and a model never approves its own output.
4. **Selective regeneration.** Feedback regenerates only the chosen outputs and their dependents; unrelated approvals survive.
5. **Demo mode needs no key, account, IDE or card.** A reviewer can run the whole workflow offline with prepared content; Live needs one free key.
6. **Student-scoped.** Small web projects, a few screens, human-inspectable deliverables.
7. **Website Studio closes the loop.** An approved plan carries into a builder that produces a static site the student can preview and download (experimental).

## Honest gaps

- "Multiple agents" are role-specific prompts, task contracts and shared dependency outputs on one configured model, not separately trained models. Whether this beats one chat session is an open evaluation question.
- One project per browser (backup and import move it between browsers); no accounts, cloud sync, collaboration, team assignment or due dates. Team projects cannot share a live plan, only the exported files.
- Studio produces a single static HTML file, not a multi-file app, backend or tests.
- Generated code is never executed or tested by the app.
- No real-student validation yet. The study protocol is in [STUDY_KIT.md](STUDY_KIT.md); until sessions are run, usefulness claims are untested.
- Free tiers (Gemini, OpenRouter) have quotas and can fail; the app surfaces and retries but cannot guarantee availability.

## Missing capabilities, ranked, and status

Ranked by how often the researched competitors offer them and how much a student needs them to turn a plan into work. **Implemented** means it exists in the working tree as of November 13 and passed the developer tests (150 of 150) and a Demo end-to-end run that downloaded every available export. Nothing is committed or deployed yet, and none of it has been used by a student.

| Rank | Capability | Why it matters | Status |
| --- | --- | --- | --- |
| 1 | Spec-bundle export (requirements, tasks, design, `AGENTS.md`, `CLAUDE.md`, `plan.json`) | Spec-driven tools all end in files an agent consumes | Implemented (`src/lib/export-spec.ts`) |
| 2 | AI-use disclosure log | Courses increasingly require declaring AI use; also feeds the study | Implemented (disclosure export plus a 20-event session log) |
| 3 | Rubric-aware planning | Students plan against a grading rubric | Implemented (optional rubric on the idea screen flows into prompts) |
| 4 | Acceptance criteria per requirement | Makes requirements testable | Implemented |
| 5 | GitHub issues export | Hands tasks to Copilot agent or a team board | Implemented (CSV and `create-issues.sh`) |
| 6 | Project templates | Faster start for common course projects | Implemented (five example templates) |
| 7 | JSON backup and import | One project per browser is fragile | Implemented (`plan.json` export and import) |
| 8 | Constitution / project rules | Spec Kit-style standing rules every task obeys | Implemented (optional project rules on the idea screen flow into prompts) |
| 9 | Shareable HTML plan | A page a teammate or grader can open | Implemented (read-only, no scripts) |
| 10 | Team assignment and due dates | Team projects need owners and deadlines | Not built |
| 11 | Plan version history and diff | See what changed between plan revisions | Not built (revision history is in the export; no diff) |
| 12 | Bring-your-own-key | Let a student use their own provider key without hosting | Not built (keys are server-side only) |
| 13 | Multi-project switcher | More than one project per browser | Not built (one project per browser; use backup and import) |
| 14 | Collaboration / multi-user | Team projects | Out of scope for this submission |
| 15 | Repository import and test execution | Closes the loop with real code | Out of scope for this submission |

## OpenCode: evaluated and rejected as a provider

OpenCode (https://github.com/anomalyco/opencode, MIT licensed) is a coding agent plus a paid model gateway. Its free models can only be called from inside the OpenCode client (other callers receive HTTP 403), free entries are time-limited, and some train on prompts. A web server cannot use them, so it is **not usable as a runtime provider** for ProjectPilot. It remains a reasonable developer tool for the team and a plausible place to run an exported spec bundle. See the OpenCode models page in [Sources](#sources).

## Free-model facts that shape the design

- OpenRouter free models: 50 requests per day, raised to 1,000 after a one-time $10 credit. ProjectPilot's OpenRouter path allows only free models and caps prices at zero.
- Gemini free tier: quota is per model, which is why the app tries a list of models in order; Google may use free-tier prompts to improve its products, which the consent screen states.

## Sources

Third-party comparisons and vendor pages; accessed for this write-up, not independently verified. Re-check before citing.

- Spec-driven development comparison: https://uvik.net/blog/spec-driven-development-benchmark/ and https://github.com/cameronsjo/spec-compare
- Kiro for students: https://kiro.dev/students/
- App-builder pricing comparison (third party): https://getcreatr.com/ai-app-builder-pricing-comparison-2026
- v0 pricing: https://v0.app/pricing
- Lovable student program: https://lovable.dev/students
- Replit education: https://replit.com/edu/students
- Firebase Studio shutdown and migration: https://firebase.google.com/docs/studio/migrating-project
- OpenCode models and gateway: https://opencode.ai/docs/console/models
