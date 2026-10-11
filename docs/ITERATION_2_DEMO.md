# Iteration 2: Manager planning and saved progress

## What is implemented

- Demo / Live API selector before starting a project.
- Server-side OpenAI Responses integration for clarifying questions, requirements, and task planning.
- Structured manager responses validated before entering the workflow. Empty plans, unknown task dependencies, circular dependencies, and invalid agent assignments are rejected.
- Existing human editing and approval gates remain required.
- Current project, answers, approvals, outputs, and workflow position saved in this browser across refresh. This is single-project browser storage, not a shared database.
- Interrupted specialist execution restores unfinished work as retryable; completed outputs are preserved.
- Manager failures keep existing input and allow retry with the same action button. No silent switch to demo results.
- Specialist execution still uses prepared demo responses. Live specialist agents are Iteration 3 scope.

## Live setup

Copy `.env.example` to `.env.local`. Set `OPENAI_API_KEY` locally and optionally `OPENAI_MODEL` (default `gpt-4o-mini`). Restart the server. Do not commit the key.

Run `npm run dev`, open the printed local URL, select Live API, enter an idea, and start clarifying questions. Live requests send the idea and approved planning context to OpenAI. The key stays on the server.

The integration follows the official Structured Outputs documentation:
https://developers.openai.com/api/docs/guides/structured-outputs

## Tomorrow's demo (about 3 minutes)

1. Choose Demo and Run guided workflow for a dependable demonstration.
2. Approve one requirement, refresh the browser, and show the approval and current screen are restored.
3. Approve the remaining requirements and generate the task plan.
4. Edit a task and demonstrate that self-dependencies or circular dependencies are rejected.
5. Approve the plan, collect demo specialist outputs, and approve outputs individually.
6. Show feedback / revision and export the final Markdown plan.
7. If a working API key is configured, start a separate Live API project and show idea-specific manager questions, requirements, and tasks.

## Validation

Production build and workflow tests cover approval gates, non-destructive navigation, targeted revisions, dependency validation, structured API responses, missing keys, API limits, and refresh recovery. A real billed API call has not been verified because this checkout has no API key configured. Safari was used to verify a sample project and requirement approval survive a refresh.
