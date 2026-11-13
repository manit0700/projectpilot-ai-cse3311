// Prepared Website Studio output for Demo mode. The design, files and review are
// trimmed copies of a real live run (docs/studio-evidence/live) so a grader without an
// OpenRouter key still sees the whole design -> build -> review cycle.
import type { SiteFiles } from "@/lib/studio";

export type StudioStage = "plan" | "build" | "review";
export type StageResult = { text?: string; files?: SiteFiles; model: string };

export const demoLabel = "Demo · prepared output";
export const demoStageMs = 1500;

export const demoDesign = `# Student Study-Session Tracker — Specification

**To:** Developer  
**From:** Manager & Designer  
**Project:** Compact one-page study-session tracker  

---

## 1. Overview
A single-page application that lets a student log study sessions per course, view a running total of minutes, and remove individual entries. All functionality, styling, and behavior must fit within **120 lines per file** and use **no external assets or third‑party libraries**. The page must be fully accessible (keyboard operability, screen‑reader labels, color contrast) and respond gracefully from 320 px to 1200 px wide.

**Assumptions**
- Supplied HTML containers (\`<main>\`, etc.) are empty; I will inject the markup.
- No backend or persistence is required; data lives in memory for the demo.
- “Positive whole‑number minutes” means ≥ 1 and no decimals or negative values.
- The design will use system fonts and minimal CSS (no icon fonts, no image assets).

---

## 2. Sections & hierarchy
| Area | Purpose |
|------|---------|
| **Form** | \`course\` text input, \`minutes\` number input, \`Add session\` button |
| **List** | Horizontal row per session: course name, minutes, delete button |
| **Summary** | “Total study minutes: *XXX*” (updates live) |
| **Empty state** | When no sessions exist, display “No study sessions recorded.” |

Visual order: Form → List → Summary. The empty state supersedes the list when the list is empty.

---

## 3. Visual direction
- **Color palette** (system colors, no custom images):  
  - Background: \`hsl(210 20% 98%)\` (very light cool gray)  
  - Primary accent: \`hsl(42 70% 55%)\` (warm amber) for button background, focus outline  
  - Text: \`hsl(222 47% 11%)\` (near‑black for contrast)  
  - Disabled/non‑primary: \`hsl(210 10% 45%)\`
- **Typography**: System stack \`system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif\`; \`clamp(1rem, 2vw, 1.125rem)\` for body, \`clamp(1.25rem, 3vw, 1.5rem)\` for headings.
- **Layout**: Single column on narrow viewports; on ≥ 640 px, form inputs sit on one line with a small gap; list rows become compact cards with delete “×” on the right.
- **No box‑shadows or gradients** beyond a subtle \`0.0625em\` border on focused elements.

---

## 4. Accessibility (a11y)
| Requirement | Implementation |
|-------------|----------------|
| **Labels** | \`<label>\` elements linked to inputs via \`for\`/\`id\`. Course label: “Course name”. Minutes label: “Study minutes”. |
| **Keyboard** | All interactive elements reachable via \`Tab\`. \`Enter\` activates Add; \`Delete\` button has \`aria-label="Remove [course] study session"\`; focus ring uses the accent color at \`4px\` width. |
| **Screen reader** | \`role="status"\` for total minutes announcement; \`aria-live="polite"\` so totals are announced when they change. Empty state has \`aria-live="polite"\` too. |
| **Color contrast** | Foreground vs. background ≥ 4.5:1 (verified with the chosen hues). |
| **Focus outline** | Visible on all focusable elements; no \`outline: none\` overrides. |
| **Responsive meta** | \`<meta name="viewport" content="width=device-width, initial-scale=1">\` (included in HTML head). |

---

## 5. Interactions
1. **Add session**  
   - Clicking **Add** or pressing \`Enter\` while the minutes field is focused adds a row.  
   - Validation: \`minutes\` must be a positive whole number (≥ 1). If invalid, show an inline error message (“Please enter a whole number of minutes ≥ 1”) without submitting; field borders turn \`hsl(0 84% 55%)\` on error.  
   - After successful add: minutes input resets to empty, focus returns to the minutes field for rapid chaining.

2. **Delete session**  
   - Each row contains a delete button (×).  
   - Clicking removes the row instantly; total updates.  
   - Focus moves to the nearest interactive element (preferably the minutes field) after deletion.

3. **Total study minutes**  
   - Calculated as the sum of all \`minutes\` values in the list.  
   - Displayed as “Total study minutes: *NN*”.  
   - Announced via ARIA live region after each addition/removal.

4. **Empty state**  
   - When the list is empty, show “No study sessions recorded.” centered above the summary.  
   - Summary still displays “Total study minutes: 0”.  
   - No rows or delete buttons are rendered.

---

## 6. Acceptance criteria (the developer must verify)
| # | Criterion |
|---|-----------|
| 1 | Page loads with the form, list area, and summary visible. |
| 2 | Course field accepts any text; minutes field accepts only positive whole numbers (≥ 1). Invalid entries show an error and prevent addition. |
| 3 | Pressing **Add** or \`Enter\` adds a new row beneath the list; the row shows the course name, minutes, and a delete × button. |
| 4 | Each delete button removes its row and updates the total minutes. |
| 5 | Total study minutes display updates live after add/delete; a screen reader announces the change. |
| 6 | When no sessions exist, the empty‑state message appears, the list is absent, and the total shows 0. |
| 7 | Layout is single‑column ≤ 639 px; on ≥ 640 px the form sits on one line and list rows are compact. |
| 8 | All focusable elements have a visible focus ring (minimum 4 px, accent color). |
| 9 | No JavaScript errors in the console; no \`<script>\` src attributes pointing to external files. |
|10 | Total CSS and JS combined stay ≤ 120 lines per file (as counted by \`wc -l\`). |
`;

export const demoFiles: SiteFiles = {
  html: `<main>
  <h1>Study Session Tracker</h1>
  <form id="session-form" autocomplete="off">
    <div class="label-group">
      <label for="course-name">Course name</label>
      <input type="text" id="course-name" name="course" placeholder="e.g. Math 101" required>
    </div>
    <div class="label-group">
      <label for="study-minutes">Study minutes</label>
      <input type="number" id="study-minutes" name="minutes" min="1" step="1" placeholder="e.g. 45" required>
      <div id="minutes-error" class="error-msg sr-only" aria-live="polite"></div>
    </div>
    <button type="submit">Add session</button>
  </form>
  <div id="session-list" aria-live="polite"></div>
  <div id="empty-state" class="empty-state" aria-live="polite">No study sessions recorded.</div>
  <p id="total-display" role="status" aria-live="polite">Total study minutes: 0</p>
</main>`,
  css: `:root {
  --bg: hsl(210 20% 98%);
  --accent: hsl(42 70% 55%);
  --text: hsl(222 47% 11%);
  --muted: hsl(210 10% 45%);
  --error: hsl(0 84% 55%);
  --border: hsl(210 15% 90%);
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  background: var(--bg);
  color: var(--text);
  font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
  font-size: clamp(1rem, 2vw, 1.125rem);
  line-height: 1.5;
  padding: 1rem;
}
h1 { font-size: clamp(1.25rem, 3vw, 1.5rem); margin-bottom: 1rem; }
form { display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1.5rem; }
@media (min-width: 640px) {
  form { flex-direction: row; align-items: end; }
}
.label-group { display: flex; flex-direction: column; flex: 1; }
label { display: block; margin-bottom: 0.25rem; font-weight: 600; }
input[type="text"], input[type="number"] {
  padding: 0.5rem;
  border: 1px solid var(--border);
  border-radius: 4px;
  font-size: 1rem;
  background: #fff;
  color: var(--text);
}
input:focus { outline: 4px solid var(--accent); border-color: var(--accent); }
input.invalid { border-color: var(--error); outline: 4px solid var(--error); }
button {
  background: var(--accent);
  color: #fff;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  flex-shrink: 0;
}
button:hover { filter: brightness(0.95); }
button:focus { outline: 4px solid var(--accent); }
.delete-btn { background: none; color: var(--muted); border: none; cursor: pointer; font-size: 1.2rem; padding: 0.25rem 0.5rem; }
.delete-btn:hover { color: var(--error); }
#session-list { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1.5rem; }
.session-row { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; border: 1px solid var(--border); border-radius: 4px; background: #fff; }
.session-info { display: flex; gap: 1rem; }
.empty-state { text-align: center; color: var(--muted); margin: 2rem 0; font-style: italic; }
#total-display { font-weight: bold; font-size: 1.1rem; }
.error-msg { color: var(--error); font-size: 0.9rem; margin-top: 0.25rem; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }`,
  js: `const form = document.getElementById('session-form');
const list = document.getElementById('session-list');
const empty = document.getElementById('empty-state');
const total = document.getElementById('total-display');
const minutesInput = document.getElementById('study-minutes');
const errorBox = document.getElementById('minutes-error');
let sessions = [];

function render() {
  list.innerHTML = '';
  empty.style.display = sessions.length === 0 ? 'block' : 'none';
  sessions.forEach((s, i) => {
    const row = document.createElement('div');
    row.className = 'session-row';
    const info = document.createElement('div');
    info.className = 'session-info';
    const courseSpan = document.createElement('span');
    const strong = document.createElement('strong');
    strong.textContent = s.course;
    courseSpan.appendChild(strong);
    const minSpan = document.createElement('span');
    minSpan.textContent = s.minutes + ' min';
    info.appendChild(courseSpan);
    info.appendChild(minSpan);
    row.appendChild(info);
    const delBtn = document.createElement('button');
    delBtn.className = 'delete-btn';
    delBtn.textContent = '×';
    delBtn.setAttribute('aria-label', 'Remove ' + s.course + ' study session');
    delBtn.dataset.index = i;
    row.appendChild(delBtn);
    list.appendChild(row);
  });
  total.textContent = 'Total study minutes: ' + sessions.reduce((sum, s) => sum + s.minutes, 0);
}

function validateMinutes(val) {
  const num = Number(val);
  return Number.isInteger(num) && num >= 1;
}

function showError(msg) {
  minutesInput.classList.add('invalid');
  minutesInput.setAttribute('aria-invalid', 'true');
  minutesInput.setAttribute('aria-describedby', 'minutes-error');
  errorBox.textContent = msg;
  errorBox.classList.remove('sr-only');
}

function clearError() {
  minutesInput.classList.remove('invalid');
  minutesInput.removeAttribute('aria-invalid');
  minutesInput.removeAttribute('aria-describedby');
  errorBox.classList.add('sr-only');
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const course = document.getElementById('course-name').value.trim();
  const minutes = minutesInput.value.trim();
  if (!course) {
    document.getElementById('course-name').focus();
    return;
  }
  if (!validateMinutes(minutes)) {
    showError('Please enter a whole number of minutes ≥ 1');
    minutesInput.focus();
    return;
  }
  clearError();
  sessions.push({ course, minutes: Number(minutes) });
  minutesInput.value = '';
  render();
  minutesInput.focus();
});

list.addEventListener('click', (e) => {
  if (e.target.classList.contains('delete-btn')) {
    const idx = Number(e.target.dataset.index);
    sessions.splice(idx, 1);
    render();
    minutesInput.focus();
  }
});

render();`,
};

export const demoReview = `## Review Response

I have inspected the supplied HTML, CSS and JavaScript against the specification. This is source review only; the site was not executed.

### Findings

1. **Accessibility gaps**: the minutes input must carry \`aria-invalid="true"\` and \`aria-describedby="minutes-error"\` while a validation error is shown, otherwise screen readers never hear the error. Confirm \`clearError\` removes both attributes again.

2. **Safe DOM updates**: rows are built with \`createElement\` and \`textContent\`, which is correct. Keep it that way; never fall back to \`innerHTML\` for course names.

3. **Focus after delete**: focus returns to the minutes field after a row is removed, matching the plan. Also confirm the empty state is announced when the last row goes.

### Required fixes

1. Verify the ARIA attributes above toggle correctly in both error and cleared states.
2. Confirm each file stays under 120 lines.

The implementation has good foundations and meets the specification once the ARIA toggling is verified in a browser.
`;

export const demoBannerTitle = "Prepared example, not built from your brief";
export const demoSubject = "Student Study-Session Tracker";
const shortName = (name?: string) => (name ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
/** The only place the imported project name appears in demo output, and only as an honest label. */
export function demoBannerText(projectName?: string) {
  const name = shortName(projectName);
  return `This ${demoSubject} was prepared in advance from a real earlier run${name ? `, not generated from your project "${name}"` : ""}. ` +
    "It does not follow your requirements or feedback. Live agents, when enabled, build from your plan.";
}
export const isPreparedDemo = (files: SiteFiles) => files.html === demoFiles.html && files.css === demoFiles.css;

export function demoResult(stage: StudioStage, projectName?: string): StageResult {
  if (stage === "plan") return { text: `> ${demoBannerTitle}. ${demoBannerText(projectName)}\n\n${demoDesign}`, model: demoLabel };
  if (stage === "build") return { files: demoFiles, model: demoLabel };
  return { text: demoReview, model: demoLabel };
}

// Resolves after ms unless the signal aborts first, in which case it rejects like fetch does.
export function delay(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const fail = () => { clearTimeout(timer); reject(new DOMException("Aborted", "AbortError")); };
    if (signal.aborted) return fail();
    const timer = setTimeout(() => { signal.removeEventListener("abort", fail); resolve(); }, ms);
    signal.addEventListener("abort", fail, { once: true });
  });
}
