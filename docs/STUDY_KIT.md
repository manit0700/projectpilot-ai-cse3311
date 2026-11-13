# Student study kit (3 to 5 sessions)

A one-page protocol for the final-submission student sessions. The original session template, tasks and follow-up questions are in [iteration3/Student_Feedback_Session_Kit.md](iteration3/Student_Feedback_Session_Kit.md); this page adds the in-app session log so results are measured rather than remembered. **Only real participants count. Never invent, round up or "typical" results**, and do not count developer self-checks or peer review as sessions.

The session log (`src/lib/session-log.ts`, 20 event types) and its exports now exist: **Export & backup** in the header, available at any step, offers **Session log (.csv)**, **Session log (.json)**, **AI-use disclosure (.md)** and the `plan.json` backup. Confirm they appear in the deployed release candidate (not just on a dev machine) before the first session, and note the app tag in your records. Only the working tree on November 13 was checked; the deployed site still runs the November 1 build.

## Before each session

1. Run against the deployed release candidate (the tagged `rc1` or later), not a dev machine, so the evidence matches what graders can open.
2. Use a fresh browser profile. Use Demo mode for a consistent task, or Live mode only if the owner unlocks it privately and the student accepts the data-sharing notice.
3. Assign a participant ID (S1 to S5). Do not record names, access codes or API keys.
4. Record: date, browser and device, mode (Demo or Live), provider if Live.

## Consent wording (read aloud, note the answer)

"We are testing the application, not you. I will watch and take notes while you use it, and the app saves a log of the buttons you press and the text you edit in this browser so we can count what you accepted, changed or rejected. The log contains your project text, not your name. You can stop at any time, and you can ask me to delete your notes and log afterwards. Is it okay to observe and take notes? Is it okay to export and keep the log? Is it okay to record the screen? (Say no to any of these and we will skip it.)"

Record each yes or no separately. In Live mode also read the in-app data-sharing notice, which says project text goes to the model provider.

## Task list

Use tasks 1 to 7 of the original kit (about 15 minutes): clarify, edit a requirement, find the usefulness rating, approve the plan and inspect an output, request a revision, revisit a screen and refresh, finalize and download. Optional task 8 is keyboard-only. Do not coach; record the point of confusion first, and mark a task "completed with assistance" if you helped.

## What to record

| Source | What |
| --- | --- |
| Observer notes | Per task: unassisted / assisted / incomplete, time, exact quotes, confusion points |
| Session log export (CSV) | Every draft, edit, approval, rejection, revision request and failure, with timestamps |
| Usefulness rating | 1 to 10 plus the participant's reason, in their words |
| Follow-up | Would they use it again, and why (do not assume yes) |

At the end of each session open **Export & backup**, download **Session log (.csv)**, **Session log (.json)** and **AI-use disclosure (.md)**, rename them with the participant ID (for example `S1-session.csv`), keep them outside the repository (they contain project text), and note the app version or tag.

## Compute accept, edit and reject rates

**Easiest:** the **AI-use disclosure (.md)** export already contains a table per participant with, for clarifying answers, requirements and agent outputs, the number of AI drafts and how many were accepted unchanged, edited then accepted, rejected, or not yet decided. Copy those counts into the results table.

**From the CSV.** The columns are `at,msSinceStart,type,entityId,mode,provider,model,latencyMs,promptTokens,completionTokens,detail,before,after`. The `before` and `after` cells hold edited text and **can contain newlines and commas**, so do not use `grep`, `cut` or `awk` on the file. Use a spreadsheet (import as CSV, filter the `type` column) or Python's `csv` module, which handles quoted newlines:

```sh
python3 - S1-session.csv <<'PY'
import csv, sys
ev = list(csv.DictReader(open(sys.argv[1], newline="", encoding="utf-8")))
for kind, draft, edit, ok, no in [("answers", "answer_drafted", "answer_edited", None, None),
        ("requirements", "requirement_drafted", "requirement_edited", "requirement_approved", "requirement_rejected"),
        ("outputs", "output_generated", "output_edited", "output_approved", "output_rejected")]:
    ids = {e["entityId"] for e in ev if e["type"] == draft and e["entityId"]}
    a = ed = r = u = 0
    for i in ids:
        mine = [e["type"] for e in ev if e["entityId"] == i]
        edited = edit in mine
        last = [t for t in mine if t in (ok, no)][-1:] if ok else ["-"]
        if ok and not last: u += 1
        elif ok and last[0] == no: r += 1
        elif edited: ed += 1
        else: a += 1
    print(f"{kind}: drafts={len(ids)} accepted-unchanged={a} edited={ed} rejected={r} undecided={u}")
PY
```

Definitions, matching the disclosure export: a draft counts as **rejected** if its last decision is a rejection, **edited** if it has an edit event and was not rejected, and otherwise **accepted unchanged**. **Untouched AI-drafted clarifying answers count as accepted unchanged** once the student moves on to requirements, because answers have no separate approve button; they are never counted as rejected (the script above assumes the student did continue past Clarify). Pool sessions by summing counts, not by averaging percentages.

Check the first export by eye before trusting any number: the events you performed should appear, and `entityId` should be the same for an item's draft, edit and decision events.

## After the sessions

- Fill the "Combine real results" table in the original kit; quote only words actually said.
- In the report, state n, the mode, that sessions were small and qualitative, and what changed in the product as a result (commit or issue).
- Keep raw logs private; publish only aggregate counts and short quotes the participant allowed.
- Pair with the bounded comparison against a single chat session described in [SUBMISSION_CHECKLIST.md](SUBMISSION_CHECKLIST.md).
