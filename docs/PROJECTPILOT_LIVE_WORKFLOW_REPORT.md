# ProjectPilot AI Live Website Workflow Report

**Course:** CSE 3311

**Prepared by:** Manit Dankhara

**Date:** November 12, 2026

## Project overview

ProjectPilot AI helps a student turn a software idea into clarified requirements, a task plan, and reviewable deliverables. The current local implementation extends the original planning application with Website Studio, where live AI agents generate a static website and the user can inspect, revise, edit, preview, and download it.

The original planning screens remain the starting point. Website generation follows confirmation of the idea and requirements, so the builder receives an explicit task plan rather than working from a vague request alone. Human decisions remain visible throughout the workflow.

This report documents the implementation and laptop demonstration completed on November 12. It describes local behavior and developer verification. The existing hosted application has not been redeployed with this feature, and publishing this report does not publish the uncommitted implementation changes.

## Confirming the idea before generation

The workflow starts with a project description and target users. The manager asks clarifying questions about the purpose, technology, data, and appearance. The user answers these questions, reviews the generated requirements, and approves or edits each requirement.

After approval, the manager generates tasks with assigned roles, dependencies, expected deliverables, and constraints. The user can review and edit this task breakdown before choosing **Confirm idea & open Website Studio**.

Studio then presents **Import confirmed idea**. This imports the project brief, approved requirements, task contracts, constraints, and dependencies. Importing preserves the previous website in saved versions before starting a new draft. The final-plan screen also supports this handoff.

The original specialist-output workflow remains available as a separate path from the task screen. Website Studio focuses on implementing the browser-facing website rather than automatically creating every possible backend or database deliverable.

## Live agent execution

OpenRouter supplies the model inference. ProjectPilot coordinates requests and passes the relevant project context between roles. An agent is a role-specific model request with a defined responsibility; the system does not claim that each role is a separately trained model.

| Role | Input | Work and handoff |
| --- | --- | --- |
| Manager and designer | Project idea, answers, and confirmed scope | Produces requirements, task contracts, and an editable website design plan. |
| Developer | Approved plan, current website files, and feedback | Generates or rewrites HTML, CSS, and JavaScript, then sends the files to the reviewer. |
| Reviewer | Approved plan and actual generated files | Performs source review and returns findings for the developer or user. It does not execute browser tests. |
| User | Plan, generated files, and review findings | Confirms scope, requests changes, edits files, tests interactions, and decides whether to export or submit a draft pull request. |

Agents run in dependency order. The reviewer waits for website files, and a developer revision uses the preceding review findings. Zero, one, or two automatic revision rounds bound each run. The user can request further changes explicitly.

The local roles were configured with `dots-studio/dots-3-note-preview:free` after random free-model routing produced intermittent failures. Models remain configurable on the server. OpenRouter requests accept only `openrouter/free` or model identifiers ending in `:free`, with prompt and completion prices capped at zero. There is no automatic paid-model fallback.

### What the user can see live

The activity cards identify each role and its task, with states such as Waiting, Working live, Completed, Needs retry, and Stopped. A live-response panel displays public model output as it arrives through server-sent events, including the returned model identifier. The conversation log records planning transfers, developer handoffs, reviewer findings, and user revision requests.

Partial generated code stays in the live-response panel. The editor receives files only after the completed response passes validation. Stopping a request or encountering a provider error preserves completed files. A separate review action allows the user to review the current website or retry a failed review without regenerating the site.

Application-written status messages describe the workflow. They are distinct from the model's authored output and do not represent hidden model reasoning.

## Website editing and delivery

Website Studio provides three code views: HTML, CSS, and JavaScript. Users can edit all three, then choose **Apply edits** to refresh the preview. A separate text editor exposes simple headings, paragraphs, links, and button labels for changes without writing code.

The preview supports desktop and mobile widths. Generated JavaScript runs inside a sandboxed iframe; network requests, form submission, and access to ProjectPilot's browser data are restricted. The preview is useful for checking interactions but does not guarantee that arbitrary generated code is correct.

Browser-local saving retains the current website and conversation. Up to eight saved versions support checkpoints and restoration. These saves belong to the browser and origin; they are not a cloud backup.

**Download website** exports one HTML file with embedded CSS and JavaScript. This file can be opened independently of ProjectPilot. Exported code should be inspected and tested before wider use.

## GitHub integration through MCP

ProjectPilot uses the official remote GitHub MCP server through a server-side MCP client. OpenRouter provides inference, while GitHub MCP provides repository tools. These are separate connections with separate credentials.

The server fixes the permitted repository. The browser cannot supply arbitrary repository destinations or MCP server URLs. Supported actions are:

- **Connect GitHub:** verify access and list permitted tools in read-only mode.
- **Import website:** read the existing `projectpilot-site/index.html` artifact from the configured base branch.
- **Create draft pull request:** create a unique `projectpilot/site-*` branch, commit the current website artifact, and open a draft pull request.

The publishing action does not merge the pull request or write directly to the base branch. The user initiates it explicitly. A partially completed operation can leave a branch or commit that should be inspected before retrying.

The laptop demonstration verified the repository connection. It did not create a real website pull request. Draft-pull-request behavior was checked with mocked GitHub tool responses.

## Laptop demonstration

The demonstration continued the existing **Help World** project in Safari. The user's original direction was a simple greeting page with blue and green styling.

1. Clarifying answers specified plain HTML, CSS, and JavaScript, local text, responsive layout, and accessible controls.
2. The live manager generated five requirements. These were reviewed and approved for the walkthrough.
3. The manager produced a five-task plan, which was carried into Website Studio.
4. The developer generated the first website draft. Its Change Greeting button changed the displayed message when clicked.
5. An initial reviewer response was cut off. The completed website remained available. Review recovery was improved and the review was rerun independently.
6. The first draft included unnecessary collaboration-platform wording. A live revision request simplified it to a greeting page and removed navigation and signup claims.
7. The developer produced a revised website, and the reviewer returned another source review.
8. The paragraph was manually changed to “Built live with ProjectPilot AI for CSE 3311.” The edit was applied and a saved version was created.
9. Mobile preview and the HTML, CSS, and JavaScript views were demonstrated. GitHub MCP connected to the configured ProjectPilot repository.
10. The exported `projectpilot-website.html` was confirmed in Safari Downloads and opened in a separate tab. Its Change Greeting button successfully changed the message.

The demonstrated result is a working local greeting page. It is not evidence that every future generated website will work without correction.

## Verification results

| Check | Result and scope |
| --- | --- |
| Automated tests | 30 tests passed, covering the original workflow and new provider, handoff, streaming, validation, and GitHub boundaries. |
| Lint and production build | Passed after the review-recovery changes. |
| Chrome workflow checks | Passed planning approval and handoff, streamed output, editing, review propagation, revision, export, restoration, review-only recovery, mobile overflow, and browser-error checks. Model calls and GitHub writes were mocked in this check. |
| Real OpenRouter requests | Planning questions, requirements, validated task generation, website generation, source review, and revision succeeded. Earlier attempts included provider errors and incomplete output. |
| Generated study-tracker example | Browser checks passed adding sessions, totals, deletion, invalid-input rejection, safe display of HTML-like text, empty state, mobile overflow, and uncaught errors. |
| Safari walkthrough | Confirmed the Help World planning flow, live build and revision, manual editing, mobile preview, repository connection, download, and standalone greeting interaction. |
| Real GitHub MCP access | Connection and read-only repository access passed. No real GitHub write was performed during verification. |

The automated and developer checks are separate from target-student evaluation. No external interview results or measured productivity improvement are claimed.

## Limitations and remaining work

Free-model availability, output quality, and account rate limits remain external constraints. Requests can fail or end before producing valid output. The application preserves completed work and exposes retry controls, but it cannot guarantee provider availability.

Review findings are advisory. During the walkthrough, some suggestions referred to document metadata already supplied by the host or requested features outside the approved scope. Human inspection and actual browser testing remain necessary.

The current builder targets static websites. It does not provide a complete backend, database, account system, package installation process, or automatic deployment of generated websites. The specialist roles do not automatically execute generated tests or inspect an arbitrary local repository.

The next priorities are to collect feedback from three to five target students, compare the workflow with a single-agent baseline, strengthen evaluation of generated output, and prepare the next course submission. Integration changes should be committed and the hosted application deployed separately after the intended release scope is reviewed.

## Running and reviewing the project

From the existing local `projectpilot-ai` checkout, start development with:

```sh
npm run dev -- --hostname 127.0.0.1 --port 3314
```

Open `http://localhost:3314`. For a new project, use **Live API**, complete the original planning flow, and continue through **Confirm idea & open Website Studio**. The guided sample is explicitly labeled as prepared Demo content.

Server credentials belong in the ignored `.env.local` file. The laptop configuration uses password-free development access; hosted access retains its existing protection. API keys and GitHub credentials must not be committed, embedded in frontend code, or shared in chat.

Verification commands in the local implementation are:

```sh
npm test
npm run lint
npm run build
npm run test:studio:browser
```

Real provider verification scripts consume free-model request quota and should be run intentionally. Course feedback, hours, grades, and submission dates must be recorded from actual team and course information.

Repository: <https://github.com/manit0700/projectpilot-ai-cse3311>
