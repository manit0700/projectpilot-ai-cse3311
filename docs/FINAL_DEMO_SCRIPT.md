# Final demo script (4 minutes + 60-second Studio coda)

Target: the final CSE 3311 submission video and live presentation. Total speaking time about four minutes for the planning workflow, then an optional 60-second Website Studio coda that is clearly labelled experimental.

## Setup before recording

- Fresh browser profile or cleared site data, 1440×900 window, system font size at default.
- Server running: `npm run dev -- --port 3314`, open http://localhost:3314 (or the deployed URL once the release candidate is live).
- **Demo mode** (the default on first visit). No API key, no network dependency, deterministic prepared content. Say so on camera; do not present Demo output as model output.
- Optional live segment: if you show Live mode, configure `AI_PROVIDER=gemini` with a free `GEMINI_API_KEY` (https://aistudio.google.com/apikey) and say that Live output comes from Gemini's free tier, can be slow or hit quota, and is not scripted. Keep it out of the timed recording unless a dry run succeeded the same day.
- Do a dry run first. The guided workflow's Testing specialist timeout is part of the Demo behaviour; if a dry run does not show it, reset and run again before recording.
- Have [ITERATION_3.md](ITERATION_3.md) open in a second tab for the screen specification if a question comes up.

## One-sentence framing (0:00–0:15)

"ProjectPilot AI is a project manager for student software projects: one manager agent plans, specialist agents deliver, a review agent checks their work together, and the user approves every step. This run uses Demo mode with prepared content so the recording is reliable."

## Steps

| Time | Screen | Do | Say |
| --- | --- | --- | --- |
| 0:15 | Idea | Click **Run guided workflow**, or type a two-line idea (study-session planner for students) and continue. | "We start from a rough idea and the target users." |
| 0:35 | Clarify | Show the clarifying questions and the **auto-drafted answers**. Edit one answer, then click **Continue to requirements**. | "The manager asks about purpose, data and appearance, and drafts an answer to each from the idea. In Demo these drafts are prepared; in Live they are written by the model. Either way the student reads and edits them, and an edit is never overwritten." |
| 0:55 | Requirements | Approve the first requirements. **Edit one requirement** (for example, add "works offline"), save it. | "Requirements are editable. Editing an approved requirement reopens the plan, so the manager never plans against stale text." Then **Approve requirements → build tasks**. |
| 1:25 | Tasks | Point to the owner column and the dependency column; open one task contract to show expected output and constraints. | "Tasks are dependency-ordered: database and API before UI and testing. Each contract says what the specialist must return." Click **Approve plan & run agents**. |
| 1:50 | Agents | Watch the board. The **Testing specialist times out on its first attempt and retries automatically**; point to the retry count on its card and to the handoff panel showing what it received. | "Calls fail in real life. One automatic retry, then a manual Retry task; unrelated completed work is never thrown away." |
| 2:20 | Review | Show the review findings. Point to the output with a **conflict** and try to approve it: approval is blocked. | "The review agent checks outputs against each other. A conflict blocks approval and export until it is resolved; a model can never approve its own output." Approve the clean outputs, **Request revision** on the conflicted one, **Continue to feedback**. |
| 2:50 | Feedback | Enter a one-line change and **Apply feedback**. | "Feedback regenerates the selected output and everything that depends on it, in dependency order." |
| 3:10 | Review | Show the regenerated output pending while the earlier approvals are still approved. Approve it. | "Unrelated approvals survived; only the revised output needs approval again." **Continue to feedback → Skip revisions & finalize approved plan**. |
| 3:35 | Final Plan | Click **Download Markdown**, open the file briefly (note the provenance header). Optionally open **Export & backup** and show the spec bundle (.zip) and the AI-use disclosure. Point to the metrics strip. | "The export contains approved requirements, task contracts, deliverables and the revision history. The metrics are measured from this session: acceptance, revisions, completion, review issues and elapsed time." |
| 3:55 | Any | Use the stepper to revisit Requirements, then refresh the page. | "Earlier steps stay viewable without losing work, and the current project is saved in this browser across refresh." |

Do not say: "time saved" as a productivity claim, "parallel agents", "the agents tested the code", or that this run used a live model.

## Studio coda (60 seconds, optional, labelled experimental)

Studio has a prepared Demo build that needs no key and shows a "DEMO · prepared output" banner; use it for a reliable recording and say it is prepared. Use live Studio (Gemini, or free-only OpenRouter) only if a dry run worked the same day. Open with: "This part is experimental and not in the deployed app."

1. From Tasks or Final Plan click **Confirm idea & open Website Studio**, then **Import confirmed idea**. "The approved plan, not a vague prompt, is what the builder receives."
2. Approve the manager's website plan. Show the agent cards and the live response pane as the developer builds and the reviewer responds. "Manager, developer and reviewer run in order; only validated files replace the editor."
3. Switch the preview to mobile, change one heading in the page-text editor, apply it.
4. **Download website**; open the file in a new tab. "One self-contained HTML file for the student to inspect and test. Nothing is published or deployed automatically."

## Closing line (10 seconds)

"ProjectPilot keeps the student in charge: approvals at every gate, visible retries, review that can block, and feedback that touches only what it must. The open question for the final report is whether this beats a single chat session, and that is what our student sessions measure."

## Recording checklist

- [ ] Dry run completed, Testing timeout observed, conflict observed.
- [ ] Browser zoom 100%, no personal bookmarks or tabs visible.
- [ ] Captions or voice-over state "Demo mode" at the start.
- [ ] Final video length ≤ 4:00 without the coda, ≤ 5:00 with it.
- [ ] Exported Markdown and (if recorded) exported HTML saved alongside the video as evidence.
