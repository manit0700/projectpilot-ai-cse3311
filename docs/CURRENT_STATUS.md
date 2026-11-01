# Current Status

Last updated: September 20, 2026

## Current phase — November 1, 2026

Iteration 3 implementation: live specialist deliverables, dependency-aware revisions, AI review and bounded retries. See [Iteration 3 behavior, setup and demo](ITERATION_3.md).

- Live manager planning and browser persistence from Iteration 2 remain active.
- Live specialist calls now receive prerequisite outputs and generate task-specific deliverables.
- Feedback regenerates selected tasks and their dependents; unrelated approvals survive.
- AI review checks outputs together; review failure is visible and retryable.
- Generated code must still be inspected, integrated and tested by the user.
- External user feedback, comparative evaluation and the final written submission remain outstanding.

## Repository

https://github.com/manit0700/projectpilot-ai-cse3311 (local: projectpilot-ai)

## Iteration 2 implementation — October 10, 2026

Implemented optional live manager planning through `/api/manager`, structured response and dependency validation, browser persistence for the current project, interrupted-run recovery, and manager retry handling. Existing editing and approval gates remain active. Demo / Live mode is explicit; specialist execution remains prepared responses for Iteration 3.

See `docs/ITERATION_2_DEMO.md` for tomorrow's presentation and API configuration. A real live manager API test passed on October 11, 2026: questions, requirements, and tasks all completed successfully using the locally configured key. Browser refresh persistence was verified in Safari. The older "missing live API / persistence" notes above describe the prior iteration.

## Production hosting — November 1, 2026

Vercel production: https://projectpilot-ai-cse3311.vercel.app

Deployed from the local working tree using Vercel CLI. Production OPENAI_API_KEY and OPENAI_MODEL are configured server-side. vercel.json explicitly selects Next.js; .vercelignore excludes local secrets and course documents. Browser saves are scoped to this new origin; localhost saves do not automatically transfer.

To redeploy authorized changes: `vercel deploy --prod --scope manit-dankharas-projects`. Git-based automatic deployments have not been configured.
