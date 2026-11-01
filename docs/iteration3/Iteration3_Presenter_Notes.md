# Iteration 3 presenter notes

Play the captioned MP4 at slide 4. The video is silent so you can narrate it live. Keep the final interview item open unless actual student feedback is available.

## Slide 1

Team 5, CSE 3311. Iteration 3, November 1, 2026. This update shows live specialist deliverables and a revisable workflow. Play the accompanying captioned live demo at the execution section. Source: November 1 implementation, commits 2114a17 and e1af1d5.

## Slide 2

Our target is one student working on a small class or portfolio web application. We selected a study-session tracker as a concrete demo, with course, minutes, add/delete and totals. We also tested a narrow ProjectPilot retry-design task with the real API. The current output is reviewable deliverable text, including code samples. We have not yet generated and executed a complete project directory. Target-user sessions are still pending. Source: docs/ITERATION_3.md and recorded live demo.

## Slide 3

Professor Christoph Csallner provided Iteration 2 feedback on October 26. The major requested next step was specialized agents with retry. We also made feedback change actual live output, increased readable text and deployed the app. Peer review added more specific reliability, privacy and UI findings. Those are tracked separately from target-user interviews. Sources: professor comments supplied by the team and Team 6 Iteration 2 review.

## Slide 4

Play ProjectPilot_AI_Iteration3_Demo.mp4 alongside this slide. The recording uses actual hosted OpenAI responses. It starts with access and consent, then clarifies a study-tracker brief, approves requirements and starts the task graph. Workers run serially in dependency order. A worker receives actual prerequisite outputs, which distinguishes this implementation from isolated role prompts. Source: recorded live demo and src/lib/store.tsx.

## Slide 5

The specialist returns structured fields: deliverable summary, assumptions, blockers, confidence and next steps. The review role receives all outputs and checks them against task contracts and approved requirements. Missing or invented review IDs are rejected. Conflicts block approval and final export after the peer-review fix. Missing-item flags remain visible for assessment. Model confidence is not measured accuracy. Source: specialist-schema.ts, workflow.ts and actual hosted screenshot.

## Slide 6

This is the actual feedback screen. Selected roots and their transitive dependents return to their specialist roles. Each request includes the previous deliverable and the requested change. Unrelated approvals survive, and new deliverables need fresh approval and another review. Live mode rewrites content. Demo mode clearly replaces its sample output. Source: store.tsx and real hosted recording.

## Slide 7

Server calls attempt a timeout or invalid output at most twice. Authentication and billing errors return directly. The user can retry a failed task without discarding unrelated completed work. Skipped work stays incomplete and blocks its dependents. Conflicts cannot be approved. Browser persistence restores work, and damaged saves retain a recovery copy when storage is available. Sources: 21 workflow tests and implementation.

## Slide 8

The browser owns a single saved project, not a shared cloud database. Next.js routes own the model key, input guards and output validation. A signed HttpOnly access session protects production live calls. A private invitation code and data-sharing consent precede paid requests. The app does not execute model-generated code. Source: types.ts, store.tsx, live-access.ts, specialist endpoint.

## Slide 9

All 21 automated Node tests pass. The last six specifically cover keyword boundaries, strict conflicts, signed access/consent, damaged saves, delayed timeouts and detailed export contents. The timeout deadline is scaled to 30 milliseconds in the test; we do not claim a full 55-second browser timing test. Keyboard-only flows passed in Chrome and WebKit, including editing, board navigation, review, revision, export and reset cancellation. The hosted demo makes actual live model calls. Sources: tests/workflow.test.cjs; docs/iteration3-evidence/peer-review-browser-results.json; live recording.

## Slide 10

Team 6 supplied eighteen findings about Iteration 2. Reviewers were David, Ujjwal Sood and Hardik Kari. They are not Team 5 author names. Seventeen findings are addressed through the implementation, verification and readable submission screenshots. Finding seven requires real target-student sessions and remains open. Peer review is useful feedback, but it is not a usability study. Full issue-by-issue mapping appears in the written deliverable.

## Slide 11

The primary sources show that Codex and Claude Code already perform substantial software work. ChatDev supports multi-agent workflows, and CrewAI offers orchestration abstractions. Our proposed value is a narrower classroom workflow with explicit task contracts, approvals and saved revision state. We have not measured an advantage over these tools or over one agent. Sources accessed November 1: https://developers.openai.com/blog/codex-as-a-platform ; https://code.claude.com/docs/en/overview ; https://github.com/OpenBMB/ChatDev ; https://docs.crewai.com/en/introduction .

## Slide 12

These are planning estimates for the next increment, not measured probabilities. Exposure equals probability times extra team hours. Responses: establish a narrow file manifest and build first, pass interface contracts, keep bounded retry and controlled access, restrict the first runnable app, and test with actual students before expanding scope. Full mitigation timing appears in the report.

## Slide 13

Iterations one and two established the workflow, live manager and persistence. Iteration three added real workers, feedback and hosted access. Proposed internal next-iteration targets are November 2 to 3 for file assembly, November 4 to 5 for isolated builds/tests, and November 6 to 8 for preview, ZIP and user evaluation. These are planning targets rather than confirmed course deadlines. Individual ownership still needs team agreement.

## Slide 14

The user selected complete project generation as the next iteration goal. Success means actual assembled files, a working preview, a downloadable package and honest build/test results. Start with one small stack and a study tracker. Model-generated snippets alone do not meet this goal. Feedback must change the generated files and trigger another verification pass. This is planned work, not a claim about Iteration 3.

## Slide 15

The video is captioned and silent, approximately two to four minutes depending on real API latency and conflict correction. Open the MP4 alongside the deck. It contains no API key or unmasked reviewer access code. Source citations throughout this deck refer to the implementation, professor comments, Team 6 peer review and official product documentation.
