import { AGENT_LABELS } from "./agents";
import {
  acceptanceOf, bullets, dependencyLabels, draftNote, exportDate, isComplete, isHumanEdited, modeLabel, modelLabel, modelsUsed,
  orderedTasks, outputModel, outputFor, planSlug, planningMinutes, requirementRef, resolveMode, reviewFindings, scrubIds, shortTitle, taskTitle,
  usefulAssumptions, usageOf, NOT_RECORDED, type ExportOptions,
} from "./export-common";
import { downloadFile } from "./export-download";
import { formatUsefulness } from "./metrics";
import type { WorkflowState } from "./workflow";

export const planFilename = (s: WorkflowState): string => `${planSlug(s)}-plan.md`;

/** One-line provenance used by Markdown, README and HTML: mode, model, date, measured time. */
export function provenanceLines(s: WorkflowState, opts?: ExportOptions): string[] {
  const mode = resolveMode(s, opts);
  const models = modelsUsed(s);
  const usage = usageOf(s);
  const tokens = usage && (usage.promptTokens !== null || usage.completionTokens !== null) ? ` · ${(usage.promptTokens ?? 0) + (usage.completionTokens ?? 0)} tokens` : "";
  const lines = [`Mode: ${modeLabel(mode)}`];
  if (mode === "live") lines.push(`AI provider / model: ${models.length ? models.join("; ") : NOT_RECORDED}${usage?.requests != null ? ` (${usage.requests} requests${tokens})` : ""}`);
  else lines.push("AI provider / model: none (prepared demo responses; no AI model was called)");
  lines.push(`Exported: ${exportDate(opts)}`);
  lines.push(`Planning time (measured): ${planningMinutes(s, opts)} minutes${isComplete(s) ? " from project start to final plan" : " so far"}`);
  return lines;
}

export function planMarkdown(s: WorkflowState, opts?: ExportOptions): string {
  const complete = isComplete(s);
  const draft = draftNote(s);
  const title = shortTitle(s.project);
  const clean = (value: string) => scrubIds(value, s);
  const tasks = orderedTasks(s);
  const requirements = s.requirements.map((r, i) => ({ r, ref: requirementRef(i) })).filter(({ r }) => (complete ? r.approvalStatus === "approved" : r.approvalStatus !== "rejected"));
  const outputs = tasks.map((t) => ({ t, o: outputFor(s, t) })).filter((x): x is { t: typeof tasks[number]; o: NonNullable<ReturnType<typeof outputFor>> } => Boolean(x.o) && (!complete || x.o!.approved === "approved"));

  const sections = [
    `# ${title}${draft ? ` ${draft}` : ""}`,
    "> ProjectPilot AI · Planning output. No application code is deployed. Planning time is the measured wall-clock time of this session, not a productivity claim.",
    ...(draft ? [`> **Draft export ${draft}.** This plan was exported before every approval checkpoint was complete; unapproved content is labelled.`] : []),
    "## Provenance", bullets(provenanceLines(s, opts)),
    "## Project summary", clean(s.project.description) || "No idea entered yet.", `Target users: ${s.project.targetUser || "not set"}`,
    complete ? "## Approved requirements" : "## Requirements", requirements.length ? requirements.map(({ r, ref }) => {
      const criteria = acceptanceOf(r);
      return `- **${ref}** [${r.priority}]${complete ? "" : ` (${r.approvalStatus})`} ${clean(r.text)}${criteria.length ? `\n${criteria.map((c) => `  - Acceptance: ${clean(c)}`).join("\n")}` : ""}`;
    }).join("\n") : "None yet.",
    "## Ordered task plan", tasks.length ? tasks.map((t) => {
      const deps = dependencyLabels(s, t);
      return `### ${taskTitle(t)}\n\n${clean(t.description)}\n\n- Agent: ${AGENT_LABELS[t.ownerAgent]}\n- Depends on: ${deps.join("; ") || "No prerequisites"}\n- Expected output: ${clean(t.expectedOutput)}${t.constraints ? `\n- Constraints: ${clean(t.constraints)}` : ""}\n- State: ${t.state}`;
    }).join("\n\n") : "No tasks yet.",
    complete ? "## Approved agent outputs" : "## Agent outputs", outputs.length ? outputs.map(({ t, o }) => {
      const findings = reviewFindings(s, o);
      const model = outputModel(s, o);
      const assumptions = usefulAssumptions(o);
      return `### ${taskTitle(t)}\n\n${clean(o.summary)}\n\n- Human approval: ${o.approved === "approved" ? "Approved" : o.approved === "rejected" ? "Rejected" : "Pending"}\n- Edited by a human: ${isHumanEdited(s, o) ? "Yes" : "No"}\n- Produced by: ${model ? modelLabel(model) : resolveMode(s, opts) === "demo" ? "prepared demo response" : NOT_RECORDED}${assumptions.length ? `\n- Assumptions: ${assumptions.map(clean).join("; ")}` : ""}\n- Blockers: ${o.blockers.map(clean).join("; ") || "None"}\n- Confidence: ${Math.round(o.confidence * 100)}%\n- Next steps: ${o.nextSteps.map(clean).join("; ") || "None"}\n- Review findings: ${findings ? findings.map(clean).join("; ") || "No findings" : "No review recorded"}`;
    }).join("\n\n") : "No agent outputs yet.",
  ];
  for (const [role, heading] of [["testing", "Testing / acceptance information"], ["documentation", "Documentation information"]] as const) {
    const items = outputs.filter(({ t }) => t.ownerAgent === role);
    if (items.length) sections.push(`## ${heading}`, items.map(({ o }) => clean(o.summary)).join("\n\n"));
  }
  sections.push("## Evaluation metrics",
    `- Requirement acceptance in this session: ${s.metrics.userAcceptanceRate}%\n- Completed tasks: ${s.metrics.taskCompletionRate}%\n- Review issue rate: ${s.metrics.conflictRate}%\n- Revision rounds: ${s.metrics.numberOfRevisions}\n- User usefulness rating: ${formatUsefulness(s.metrics.usefulnessScore)}\n- Planning time (measured): ${planningMinutes(s, opts)} minutes ${complete ? "from project start to final plan" : "so far"}`);
  if (s.feedbackItems.length) {
    sections.push("## Revision history", s.feedbackItems.map((f) => {
      const labels = f.affectedTasks.map((id) => s.tasks.find((t) => t.id === id)).filter((t): t is NonNullable<typeof t> => Boolean(t)).map((t) => taskTitle(t).split(" · ")[0]);
      return `- ${clean(f.userRequest)} (${f.revisionStatus}; tasks: ${labels.join(", ") || "none"})`;
    }).join("\n"));
  }
  return sections.join("\n\n") + "\n";
}

export function downloadPlan(s: WorkflowState, opts?: ExportOptions): void {
  downloadFile(planFilename(s), planMarkdown(s, opts), "text/markdown;charset=utf-8");
}
