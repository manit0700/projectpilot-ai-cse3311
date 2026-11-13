import { AGENT_LABELS } from "./agents";
import {
  acceptanceOf, dependencyLabels, draftNote, escapeHtml as esc, isComplete, isHumanEdited, orderedTasks, outputFor, planSlug, requirementRef, scrubIds,
  shortTitle, taskTitle, usefulAssumptions, type ExportOptions,
} from "./export-common";
import { disclosureStatement } from "./export-disclosure";
import { provenanceLines } from "./plan-export";
import type { WorkflowState } from "./workflow";

// A read-only, self-contained copy of the plan to send to a teammate or instructor. No scripts, no
// links, no external requests; every piece of user text is HTML-escaped. The CSP meta tag blocks
// anything that slips past those rules.

export const SHARE_CSP = "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'";

const CSS = `:root{color-scheme:light}*{box-sizing:border-box}body{margin:0;background:#f8fafc;color:#0f172a;font:16px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:46rem;margin:0 auto;padding:1.5rem 1rem 3rem}h1{font-size:1.9rem;line-height:1.2;margin:0 0 .25rem}h2{margin:2rem 0 .5rem;font-size:1.25rem;border-bottom:1px solid #cbd5e1;padding-bottom:.25rem}
h3{margin:1.25rem 0 .25rem;font-size:1.05rem}.meta,.note{color:#475569;font-size:.9rem}.card{background:#fff;border:1px solid #cbd5e1;border-radius:.75rem;padding:.75rem 1rem;margin:.75rem 0}
.badge{display:inline-block;border:1px solid #0f766e;color:#0f766e;border-radius:999px;padding:0 .5rem;font-size:.8rem;margin-left:.25rem}
pre{white-space:pre-wrap;word-wrap:break-word;background:#f1f5f9;border-radius:.5rem;padding:.75rem;font:.9rem/1.5 ui-monospace,Menlo,Consolas,monospace;margin:.5rem 0}
ul{padding-left:1.25rem}.draft{background:#fef3c7;border:1px solid #d97706;border-radius:.5rem;padding:.5rem .75rem}
@media print{body{background:#fff;font-size:11pt}main{max-width:none;padding:0}.card{break-inside:avoid;border-color:#94a3b8}h2{break-after:avoid}pre{border:1px solid #cbd5e1;background:#fff}}`;

export const shareFilename = (s: WorkflowState): string => `${planSlug(s)}-shareable.html`;

export function shareableHtml(s: WorkflowState, opts?: ExportOptions): string {
  const clean = (v: string) => esc(scrubIds(v, s));
  const draft = draftNote(s);
  const title = shortTitle(s.project);
  const complete = isComplete(s);
  const reqs = s.requirements.map((r, i) => ({ r, ref: requirementRef(i) })).filter(({ r }) => (complete ? r.approvalStatus === "approved" : r.approvalStatus !== "rejected"));
  const tasks = orderedTasks(s);
  const body = [
    `<h1>${esc(title)}</h1>`,
    `<p class="meta">Read-only copy of a ProjectPilot AI plan. No code is deployed.</p>`,
    ...(draft ? [`<p class="draft"><strong>Draft ${esc(draft)}.</strong> Exported before every approval step was complete.</p>`] : []),
    `<h2>Provenance</h2><ul>${provenanceLines(s, opts).map((l) => `<li>${esc(l)}</li>`).join("")}</ul>`,
    `<p class="note">${esc(disclosureStatement(s, opts))}</p>`,
    `<h2>Project summary</h2><p>${clean(s.project.description) || "No idea entered yet."}</p><p class="meta">Target users: ${esc(s.project.targetUser || "not set")}</p>`,
    `<h2>${complete ? "Approved requirements" : "Requirements"}</h2>`,
    reqs.length ? `<ul>${reqs.map(({ r, ref }) => `<li><strong>${esc(ref)}</strong> [${esc(r.priority)}] ${clean(r.text)}${acceptanceOf(r).length ? `<ul>${acceptanceOf(r).map((c) => `<li>Acceptance: ${clean(c)}</li>`).join("")}</ul>` : ""}</li>`).join("")}</ul>` : "<p>None yet.</p>",
    "<h2>Ordered task plan</h2>",
    ...(tasks.length ? tasks.map((t) => `<div class="card"><h3>${esc(taskTitle(t))}</h3><p>${clean(t.description)}</p><ul><li>Agent: ${esc(AGENT_LABELS[t.ownerAgent])}</li><li>Depends on: ${esc(dependencyLabels(s, t).join("; ") || "No prerequisites")}</li><li>Expected output: ${clean(t.expectedOutput)}</li>${t.constraints ? `<li>Constraints: ${clean(t.constraints)}</li>` : ""}</ul></div>`) : ["<p>No tasks yet.</p>"]),
    "<h2>Agent outputs</h2>",
    ...tasks.flatMap((t) => {
      const o = outputFor(s, t);
      if (!o || (complete && o.approved !== "approved")) return [];
      const assumptions = usefulAssumptions(o);
      return [`<div class="card"><h3>${esc(taskTitle(t))}<span class="badge">${o.approved === "approved" ? "Approved" : "Not approved"}</span>${isHumanEdited(s, o) ? '<span class="badge">Edited by author</span>' : ""}</h3><pre>${clean(o.summary)}</pre>${assumptions.length ? `<p class="meta">Assumptions: ${assumptions.map(clean).join("; ")}</p>` : ""}<p class="meta">Confidence: ${Math.round(o.confidence * 100)}%${o.blockers.length ? ` · Blockers: ${o.blockers.map(clean).join("; ")}` : ""}</p></div>`];
    }),
  ].join("\n");
  return `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${SHARE_CSP}"><meta name="referrer" content="no-referrer"><title>${esc(title)} · plan</title><style>${CSS}</style></head><body><main>\n${body}\n</main></body></html>\n`;
}
