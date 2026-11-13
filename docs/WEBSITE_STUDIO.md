# Website Studio

Experimental. First committed November 12, 2026 (b2102e0); the Gemini provider, Demo build and hardening described below are uncommitted work from November 13. Not deployed to production. Website Studio is the execution step for approved frontend tasks: after the planning workflow confirms the idea, requirements and task plan, **Confirm idea & open Website Studio** then **Import confirmed idea** carries that context into `/studio`, where agents build a static website that the user inspects, revises, edits, previews and downloads. Importing checkpoints the previous website instead of discarding it.

## Setup

Studio runs on the same provider as the planning workflow when that is Gemini (`AI_PROVIDER=gemini` with `GEMINI_API_KEY`, using the same `GEMINI_MODEL` fallback list and per-role overrides). Otherwise it uses OpenRouter with free-only models, even when `AI_PROVIDER=openai`, because Studio has no OpenAI path. Put secrets in the ignored `.env.local` and restart the server.

Gemini (recommended; free key from https://aistudio.google.com/apikey, no card):

```dotenv
AI_PROVIDER=gemini
GEMINI_API_KEY=your-key
# Optional: models tried in order when one is busy, retired or out of quota
GEMINI_MODEL=gemini-3.6-flash,gemini-3-flash-preview,gemini-3.1-flash-lite
LIVE_ACCESS_CODE=a-private-reviewer-passphrase-of-20-plus-chars
```

Free OpenRouter alternative:

```dotenv
OPENROUTER_API_KEY=your-key
OPENROUTER_MODEL=openrouter/free
LIVE_ACCESS_CODE=a-private-reviewer-passphrase-of-20-plus-chars
```

Open `/studio`, expand **Unlock live agents**, enter the access code and accept the consent notice: project and source text is sent to the active provider (Google for Gemini, whose free tier may use prompts to improve its products; OpenRouter and its model providers otherwise). Locally, an empty `LIVE_ACCESS_CODE` hides the code field and only consent is required.

**Consent gate:** Studio stays in Demo (prepared output) until the visitor has unlocked live access and accepted the consent notice in this tab, even when a key is configured. **No key needed:** a local starter website and a prepared Studio demo build are available without any key. Demo output is labelled with a **DEMO · prepared output** banner and is replayed content from an earlier real run, not a live model response. Live runs show **LIVE · Gemini** or **LIVE · OpenRouter** instead.

OpenRouter model IDs must be `openrouter/free` or end in `:free`; requests also cap prompt/completion prices at zero, so there is no paid fallback. Optional per-role overrides: `OPENROUTER_MANAGER_MODEL`, `OPENROUTER_DEVELOPER_MODEL`, `OPENROUTER_REVIEWER_MODEL`. Random free-model routing produced intermittent failures and truncated output during development; pinning a single compatible free model per role was more reliable. Set `OPENROUTER_REASONING=off` only for a fixed model that supports non-reasoning mode. The Studio route shares one 105 s budget across every model and provider attempt, with up to 60 s per attempt (route `maxDuration` 120; `ROUTE_BUDGETS.studio` in `src/lib/provider-chain.ts`). `AI_FALLBACK` can let Studio fall back between Gemini and OpenRouter only; OpenAI is never a Studio provider. See [`.env.example`](../.env.example) for the full provider notes.

## What works

| Role | Receives | Produces |
| --- | --- | --- |
| Manager / designer | Imported brief, requirements, task contracts | Editable website plan; the user approves it before any build |
| Developer | Approved plan, current files, review findings or user feedback | HTML, CSS and JavaScript files |
| Reviewer | Approved plan and the actual generated files | Source-review findings for the next developer round or the user |
| User | Plan, files, findings | Approves, requests changes, edits, previews, exports |

- Agents run in dependency order (manager → developer → reviewer), never simultaneously; zero, one or two automatic revision rounds bound each build. One plan costs one request; a build costs two, four or six requests depending on revision rounds.
- Public manager/developer/reviewer output streams over server-sent events into a live response pane; agent cards show role, task, state (Waiting, Working, Completed, Needs retry, Stopped) and the returned model name. Only completed, validated files replace the editor; partial code stays in the pane. Status messages are application-generated, not model reasoning.
- Request further changes against the current files, including manual edits; a separate review action re-reviews the current website without rebuilding it.
- Edit HTML, CSS and JavaScript directly, or edit simple page text (headings, paragraphs, links, button labels) without code, then apply to the preview.
- Sandboxed iframe preview at desktop and mobile widths; network, form submission and access to ProjectPilot's browser data are restricted.
- Autosave plus up to eight browser-local versions with restore (saving shows "Version N saved"); download one self-contained HTML file.
- Stop a run at any time; completed output survives a later failure, provider error or rate limit.

A November 12 walkthrough in Safari took a greeting-page idea through planning, live build, a reviewer response that was cut off (the completed site survived; review was rerun independently), a live revision that removed out-of-scope wording, a manual text edit, mobile preview and download; the exported file worked standalone. This is one example, not evidence that every generated site works without correction. Evidence files: [studio-evidence/](studio-evidence/).

## Limits

- Static websites only. No package installation, backend, database, account system, generated-test execution or deployment of generated sites.
- The reviewer performs source review only; findings are advisory and were sometimes out of scope during testing. Human inspection and real browser testing remain necessary.
- Free-model availability, quality and rate limits are external; requests can fail or return incomplete output. The app preserves completed work and exposes retries but cannot guarantee availability.
- Browser saves belong to one browser/origin; they are not a cloud backup.
- **GitHub publishing is experimental and disabled in production.** When `GITHUB_MCP_TOKEN`, `GITHUB_MCP_REPOSITORY` and `GITHUB_MCP_BASE_BRANCH` are set, the server acts as an MCP client to GitHub's remote MCP server with a fixed repository and only `get_file_contents`, `create_branch`, `push_files`, `create_pull_request`. **Connect** lists tools read-only; **Import website** reads `projectpilot-site/index.html` from the base branch; **Create draft pull request** (explicit user click) commits that one file to a unique `projectpilot/site-*` branch and opens a draft PR. It never merges or writes to the base branch. A failed publish can leave a branch; inspect it before retrying. Use a fine-grained token limited to one repository with Contents and Pull requests read/write. Note the code defaults the base branch to `main` when unset; this repository uses `master`.

## Verification

```sh
npm test            # includes Studio endpoint tests with mocked upstream services
npm run lint
npm run build
PROJECTPILOT_URL=http://localhost:3314 npm run test:studio:browser   # Chrome; model calls and GitHub writes mocked
# Real requests spend free-model quota; run deliberately:
node scripts/verify-planning-live.mjs
node scripts/verify-studio-live.mjs
node scripts/verify-generated-site.mjs   # browser-checks the real generated fixture, no model calls
```

Status at b2102e0 plus the November 13 working tree (developer checks, not user evidence; the full suite of 62 tests passed on November 13): endpoint tests cover access, origin validation, free-only enforcement, incomplete output, rate-limit behaviour, credential boundaries, fixed repository/path and mocked draft-PR creation. Browser checks cover editing, iframe interaction, ordered handoffs, review propagation, revisions, export, refresh recovery, GitHub UI, error recovery, mobile overflow and uncaught errors. Real OpenRouter planning, build, review and one revision passed on a synthetic brief. A real GitHub MCP read-only connection passed; no real GitHub write has been performed. Production dependency audit reported zero vulnerabilities after the Next.js 16.4.6 update.

References: [OpenRouter API](https://openrouter.ai/docs/api/reference/overview) · [GitHub remote MCP server](https://github.com/github/github-mcp-server/blob/main/docs/remote-server.md) · earlier narrative in [archive/PROJECTPILOT_LIVE_WORKFLOW_REPORT.md](archive/PROJECTPILOT_LIVE_WORKFLOW_REPORT.md).
