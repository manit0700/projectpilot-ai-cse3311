import { AGENT_LABELS } from "./agents";
import { outputsReady, taskLabel, type WorkflowState } from "./workflow";

export function planMarkdown(s: WorkflowState): string {
  if (!outputsReady(s) || s.project.status !== "complete") throw new Error("Complete human approval before exporting the final plan.");
  const approved = s.outputs.filter((o) => o.approved === "approved");
  const sections = [
    `# ${s.project.title}`,
    "> ProjectPilot AI · Planning output. No application code is deployed. Time savings are estimates, not measured productivity.",
    "## Project summary", s.project.description, `Target users: ${s.project.targetUser}`,
    "## Approved requirements", s.requirements.filter((r) => r.approvalStatus === "approved").map((r) => `- ${r.text}`).join("\n"),
    "## Ordered task plan", s.tasks.map((t) => {
      const dependencies = t.dependencies.map((id) => s.tasks.find((x) => x.id === id)).filter((t) => t !== undefined);
      return `### ${taskLabel(t)}\n\n${t.description}\n\n- Task ID: ${t.id}\n- Agent: ${AGENT_LABELS[t.ownerAgent]}\n- Depends on: ${dependencies.map(taskLabel).join("; ") || "No prerequisites"}\n- Expected output: ${t.expectedOutput}\n- State: ${t.state}`;
    }).join("\n\n"),
    "## Approved agent outputs", approved.map((o) => {
      const task = s.tasks.find((t) => t.id === o.taskId)!;
      const review = s.reviews.find((r) => r.outputId === o.id);
      return `### ${taskLabel(task)}\n\n${o.summary}\n\n- Human approval: Approved\n- Assumptions: ${o.assumptions.join("; ")}\n- Blockers: ${o.blockers.join("; ") || "None"}\n- Confidence: ${Math.round(o.confidence * 100)}%\n- Next steps: ${o.nextSteps.join("; ")}\n- Review findings: ${review ? [...review.missingItems, ...review.conflicts, ...review.suggestions].join("; ") || "No findings" : "No review recorded"}`;
    }).join("\n\n"),
  ];
  for (const [role, title] of [["testing", "Testing / acceptance information"], ["documentation", "Documentation information"]] as const) {
    const items = approved.filter((o) => s.tasks.find((t) => t.id === o.taskId)?.ownerAgent === role);
    if (items.length) sections.push(`## ${title}`, items.map((o) => o.summary).join("\n\n"));
  }
  sections.push("## Evaluation metrics",
    `- Requirement acceptance in this session: ${s.metrics.userAcceptanceRate}%\n- Completed tasks: ${s.metrics.taskCompletionRate}%\n- Review issue rate: ${s.metrics.conflictRate}%\n- Revision rounds: ${s.metrics.numberOfRevisions}\n- User usefulness rating: ${s.metrics.usefulnessScore}/10\n- Estimated planning time saved: ${s.metrics.planningTimeSavedMinutes} minutes (not measured)`);
  if (s.feedbackItems.length) sections.push("## Revision history", s.feedbackItems.map((f) => `- ${f.userRequest} (${f.revisionStatus}; tasks: ${f.affectedTasks.join(", ")})`).join("\n"));
  return sections.join("\n\n") + "\n";
}

export function downloadPlan(s: WorkflowState): void {
  const blob = new Blob([planMarkdown(s)], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const filename = s.project.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70) || "projectpilot";
  link.download = `${filename}-plan.md`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
