# Slow keyboard and full-duration timeout verification

November 1, 2026. Application: https://projectpilot-ai-cse3311.vercel.app.

## Slow typing and correction

This is automated keyboard testing, not a session with a student participant. It does not close peer-review finding 7.

The test types each character with varied 150–300 ms delays and short pauses. In each text field it deliberately misspells one word, pauses, deletes that word using Backspace and retypes it correctly. It asserts the corrected field value before submitting. It does not paste the whole field in slow mode.

Application interactions use Tab and Enter, with Ctrl/Cmd+A for selecting existing text and Backspace for corrections. A fresh isolated browser context protects the owner's saved project. Demo mode avoids paid model calls and makes the keyboard checks repeatable.

| Browser | Typed characters | Spelling corrections | Tab presses | Focus visibility checks | Test duration | Outcome |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Chrome | 562 | 9 | 193 | 49 | 181.75 s | Passed |
| WebKit | 562 | 9 | 189 | 49 | 184.26 s | Passed |

Both runs covered the idea, clarification, requirement editing, task editing, bottom navigation, agent board, output approvals, feedback revision, finalization, refresh recovery and the downloaded export. Assertions checked the corrected requirement, corrected task title and revision request in the actual Markdown. The tests also checked narrow-screen overflow and absence of uncaught browser exceptions.

Focus checks verified an outline/shadow and a visible, unobscured focus target. These are targeted checks for WCAG 2.1.1, 2.4.7 and 2.4.11 in the tested workflow. They do not certify full WCAG compliance, screen-reader behavior, focus-ring contrast or the logical quality of every possible focus order. Native Reset cancellation uses Playwright's browser-dialog dismiss API; it is not an OS-level test of pressing Escape in a native browser dialog.

The Chrome video is ProjectPilot_AI_Slow_Keyboard_Test.mp4, approximately 3 minutes 2 seconds. Captions identify it as automated testing and appear in a separate band below the captured page. WebKit is a second browser engine; no manual Safari-app testing is claimed.

## Full production-length manager timeout

Result: **passed**. Observed delay: **55.23 seconds**.

A browser running the hosted UI sent its manager request to the unchanged local manager handler through Playwright request interception. The upstream provider alone was stubbed with a 60-second delay. The handler's real 55-second AbortSignal deadline was used without scaling. This is a controlled integration test, not a real OpenAI outage or a test of Vercel's platform execution ceiling. It made zero billable model requests.

The test verified the error notice, enabled retry control, preserved brief in the input and browser save, preserved brief after refresh, and successful retry once the stub provider returned a valid response. Detailed results are in ../iteration3-evidence/full-timeout/results.json.

## Reproduce

```sh
npm install --no-save playwright
npx playwright install webkit ffmpeg
SLOW_KEYBOARD=1 PROJECTPILOT_URL=https://projectpilot-ai-cse3311.vercel.app node scripts/verify-peer-review.mjs
node scripts/verify-full-timeout.mjs
```

The slow run also needs Google Chrome. The timeout test requires the private LIVE_ACCESS_CODE in the local environment to match the selected server; it never prints that code. Raw slow-run videos and event logs stay under docs/iteration3-evidence/slow-keyboard. The tests do not use participants' personal information.

## Real user validation

Use Student_Feedback_Session_Kit.md for 3 to 5 real student sessions. Record actual observations and changes before marking finding 7 complete. The kit is a blank preparation template, not evidence of completed interviews.
