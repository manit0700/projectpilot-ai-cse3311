# Website Studio and OpenRouter integration

Implemented November 12, 2026. Start at `/` with the original ProjectPilot idea-confirmation workflow. After approving requirements and reviewing the task breakdown, choose **Confirm idea & open Website Studio**, then **Import confirmed idea**. This carries the real brief, requirements, task contracts, constraints and dependencies into `/studio`. Importing checkpoints the previous website rather than silently discarding it. The final-plan screen offers the same handoff. New projects automatically select Live API when OpenRouter is configured; the optional guided sample stays explicitly labeled as prepared Demo content.

## What works

- A local starter website is available without model credentials.
- Approve an editable manager/design plan before the developer builds.
- Developer receives the approved plan and current website files. Reviewer receives the actual files. Review findings are passed to the next developer call, with zero, one, or two automatic revision rounds.
- Stream public manager/developer/reviewer output as it arrives through server-sent events. Live agent cards show each role, its current task, Working/Completed/Needs retry/Stopped state, and the selected model. Only completed, validated files replace the editor; partial code stays in the live response pane. Agents run in dependency order, not simultaneously.
- Display actual manager/reviewer responses and developer handoff status, including the returned model name. Handoff status is application-generated; it is not a transcript of hidden model reasoning.
- Request additional changes against the current files, including manual edits.
- Edit HTML, CSS, and JavaScript directly; edit simple page text without writing code; apply changes to a sandboxed desktop/mobile preview.
- Download a self-contained HTML file with embedded CSS/JavaScript.
- Save browser-local work automatically; retain up to eight versions and restore them. Browser saves are local to the origin/device and are not cloud backups.
- Stop agent requests. Completed output remains available if a later stage fails.

The implementation targets static websites. It does not install packages, generate a working backend, run generated tests, deploy generated sites automatically, or guarantee that generated code is correct. The reviewer performs source review only. Generated scripts run only inside the sandboxed iframe or when the user opens the downloaded website.

## OpenRouter setup

Keep secrets in the ignored `.env.local` file:

```dotenv
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=your-key
OPENROUTER_MODEL=openrouter/free
LIVE_ACCESS_CODE=your-private-reviewer-code
```

Restart the server after configuring secrets. Open `/studio`, expand **Unlock OpenRouter agents**, enter the private access code, and accept sharing of project/source data with OpenRouter and its model providers.

Website Studio always uses OpenRouter. The original manager/specialist/review routes also use OpenRouter when its key is configured, unless `AI_PROVIDER=openai` explicitly selects the existing OpenAI integration. Set `AI_PROVIDER=openrouter` to require OpenRouter even when the key is missing. There is no automatic paid-provider fallback.

Optional per-role settings: `OPENROUTER_MANAGER_MODEL`, `OPENROUTER_DEVELOPER_MODEL`, `OPENROUTER_REVIEWER_MODEL`. All OpenRouter model IDs must be `openrouter/free` or end in `:free`; requests additionally cap prompt/completion prices at zero. Original workflow requests require structured-output support. Availability and schema support depend on the model/provider.

A plan uses one request. A build with zero/one/two revision rounds uses two/four/six requests. Manual retries use additional requests. Rate-limit failures preserve browser state. OpenRouter's free-model availability and account limits can change; check https://openrouter.ai/collections/free-models/.

## GitHub MCP

ProjectPilot is the MCP client. OpenRouter provides model inference; GitHub's remote MCP server provides repository operations. No local MCP executable is required.

```dotenv
GITHUB_MCP_TOKEN=your-repository-scoped-token
GITHUB_MCP_REPOSITORY=owner/repository
GITHUB_MCP_BASE_BRANCH=main
```

Use the actual default/base branch; the existing ProjectPilot repository uses `master`. Give the token repository contents and pull-request permissions for publishing. Keep the token server-side. The current laptop has local configuration from its existing GitHub CLI login and explicitly selects `AI_PROVIDER=openrouter`; no credentials are committed or exposed in browser responses. Production requires separately configured credentials; do not upload a broad personal token as a public shared service credential.

1. **Connect GitHub** initializes the official remote MCP server and lists allowed tools in read-only mode.
2. **Import website** reads only `projectpilot-site/index.html` from the configured base branch. The imported source becomes current editor content and may be sent in subsequent agent requests. The file must already exist, usually after merging an earlier Studio pull request.
3. **Create draft pull request** is an explicit user action. It creates a unique `projectpilot/site-*` branch, commits only `projectpilot-site/index.html`, and opens a draft PR against the configured base. It never merges or writes directly to the base branch.

Allowed MCP tools are `get_file_contents`, `create_branch`, `push_files`, and `create_pull_request`. Arbitrary model-selected tools, arbitrary MCP URLs, and arbitrary repositories are not accepted from the browser. A failed/cancelled publish can leave a branch or commit; inspect the reported branch before retrying. GitHub publishing currently requires a user click; agents do not autonomously browse or modify arbitrary repositories.

## Verification

```sh
npm test
npm run lint
npm run build
# Real requests consume free-model quota; run deliberately.
node scripts/verify-planning-live.mjs
node scripts/verify-studio-live.mjs
# Uses the real generated fixture without further model requests:
node scripts/verify-generated-site.mjs
PROJECTPILOT_URL=http://localhost:3314 npm run test:studio:browser
```

- Automated endpoint tests verify access, origin validation, free-only requests, incomplete output, rate-limit behavior, credential boundaries, fixed GitHub repository/path, and draft-PR creation using mocked upstream services.
- Chrome browser checks verify code/text editing, iframe interaction, ordered agent handoffs, review propagation, revisions, export, refresh recovery, GitHub UI, error recovery, mobile overflow, and uncaught errors. Live generation and GitHub writes are mocked in this script.
- A real GitHub MCP read-only connection and README read passed; the app's actual connection endpoint returned 200 for `manit0700/projectpilot-ai-cse3311`.
- No real GitHub write was performed during verification.
- Real OpenRouter verification passed: the original planning manager generated clarifying questions, approved-test requirements and five valid tasks; the website manager generated a plan, the developer built files, the reviewer returned findings, and a subsequent developer/reviewer revision passed. Actual model output streamed during the website requests. Synthetic test context was used; this is not external student feedback.
- The real revised study tracker passed browser checks for adding sessions, totals, deletion, fractional/blank-input rejection, safe display of HTML-like text, empty state, mobile overflow and uncaught errors. These checks cover this example, not every future generated site.
- Initial random free-model requests failed intermittently or truncated output. Local roles are pinned to `dots-studio/dots-3-note-preview:free`, which passed planning/build/review. `OPENROUTER_REASONING=off` is set locally for that compatible model. When using automatic routing or mandatory-reasoning models, leave that setting unset; default low-effort reasoning is excluded from streamed output. Rate limits and provider capacity still apply.
- Production dependency audit: zero vulnerabilities after updating Next.js to 16.4.6. The full dependency audit still reports moderate development-tool findings.

Original provider API: https://openrouter.ai/docs/api/reference/overview
GitHub MCP setup: https://github.com/github/github-mcp-server/blob/main/docs/remote-server.md

UI verification: the new component hardcoded-value and token-reference checks passed. The rendered Studio snapshot passed all 63 measured default/hover/focus contrast checks with both normal and dark-attribute gate runs; the current app retains its established light theme. The skill reference accuracy suite reported 37/37, which checks its reference examples rather than this application. Taste checks reported two medium heuristics (repeated conversation entries and a wide paragraph); these were reviewed as appropriate to this workspace.

## Laptop access without a password

Local development now has `LIVE_ACCESS_CODE` unset, so no password is needed. The access form hides the password field when the server reports no code is configured; the data-sharing checkbox remains available in the form. Production continues to require its server-configured access code.
