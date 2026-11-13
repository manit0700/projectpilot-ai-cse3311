import { uid } from "./agents";
import {
  feedbackNote, finalNote, requirementChangedNote, reviewNotes, revisionRequestedNote, taskEditedNote, withNote, withNotes,
} from "./manager-log";
import { reviewOutputs, reviseAgentOutput } from "./mock-ai";
import { logEvents, logModelEvents, originalText, type ModelMeta } from "./session-events";
import type { Review, Task } from "./types";
import {
  affectedTaskIds, canVisit, describeTaskIds, hasConflict, invalidateTasks, outputsReady, requirementsReady, taskLabel, topologicalOrder, validateTasks,
  type TaskEdit, type WorkflowState,
} from "./workflow";

// Pure state transitions for the planning store. Each returns the unchanged
// state when its approval gate is not met, so callers never need extra guards.

export const taskText = (task: Pick<Task, "title" | "description" | "ownerAgent" | "dependencies">) =>
  `${task.title}: ${task.description} (${task.ownerAgent}; depends on ${task.dependencies.length})`;

export function editRequirementState(s: WorkflowState, id: string, text: string, live = false): WorkflowState {
  const requirement = s.requirements.find((r) => r.id === id);
  if (!requirement || requirement.text === text.trim()) return s;
  return logEvents({
    ...invalidateTasks(s, s.tasks.map((t) => t.id)),
    requirements: s.requirements.map((r) => r.id === id ? { ...r, text: text.trim(), approvalStatus: "pending" } : r),
    project: { ...s.project, status: "requirements_pending" },
    currentStep: "requirements",
    workflowNotice: s.tasks.length ? "Requirement changed. Review the preserved task plan after approving requirements; all tasks share this context and their outputs need refreshing." : "Requirement saved. Approve it again before continuing.",
    managerNotes: withNote(s.managerNotes, "requirements", requirementChangedNote(s.tasks.length)),
  }, live, { type: "requirement_edited", entityId: id, before: originalText(s.events, id, requirement.text), after: text.trim() });
}

export function toggleRequirementState(s: WorkflowState, id: string, status: "approved" | "rejected", live = false): WorkflowState {
  const requirement = s.requirements.find((r) => r.id === id);
  if (!requirement || requirement.approvalStatus === status) return s;
  const next = requirement.approvalStatus === "approved" ? invalidateTasks(s, s.tasks.map((t) => t.id)) : s;
  return logEvents({
    ...next,
    requirements: s.requirements.map((r) => r.id === id ? { ...r, approvalStatus: status } : r),
    project: { ...s.project, status: "requirements_pending" },
    currentStep: "requirements",
  }, live, { type: status === "approved" ? "requirement_approved" : "requirement_rejected", entityId: id, after: requirement.text });
}

/** Returns a user-facing error, or the next state (null when nothing changed). */
export function editTaskState(s: WorkflowState, id: string, edit: TaskEdit, live = false): { error: string } | { state: WorkflowState | null } {
  if (s.planApproved || !requirementsReady(s)) return { error: "Task editing is available before plan approval." };
  const task = s.tasks.find((t) => t.id === id);
  if (!task) return { error: "Task not found." };
  const updated = { ...task, ...edit, title: edit.title.trim(), description: edit.description.trim(), dependencies: [...new Set(edit.dependencies)] };
  const tasks = s.tasks.map((t) => t.id === id ? updated : t);
  const error = validateTasks(tasks);
  if (error) return { error };
  if (JSON.stringify(task) === JSON.stringify(updated)) return { state: null };
  const affected = affectedTaskIds(tasks, [id]);
  return { state: logEvents({
    ...invalidateTasks({ ...s, tasks: topologicalOrder(tasks) }, affected),
    project: { ...s.project, status: "tasks_pending" },
    workflowNotice: "Task saved. The plan still needs your approval; only this task and its dependents will be refreshed.",
    managerNotes: withNote(s.managerNotes, "tasks", taskEditedNote(updated, tasks.filter((t) => affected.includes(t.id)))),
  }, live, { type: "task_edited", entityId: id, before: taskText(task), after: taskText(updated) }) };
}

export function approveOutputState(s: WorkflowState, id: string, live: boolean): WorkflowState {
  const output = s.outputs.find((o) => o.id === id);
  if ((live && !s.reviews.some((r) => r.outputId === id)) || !output || hasConflict(s, id) || !s.planApproved || !requirementsReady(s) || s.staleTaskIds.includes(output.taskId) || s.tasks.find((t) => t.id === output.taskId)?.state !== "completed") return s;
  return logEvents({ ...s,
    outputs: s.outputs.map((o) => o.id === id ? { ...o, approved: "approved" } : o),
    revisionTaskIds: s.revisionTaskIds.filter((taskId) => taskId !== output.taskId),
  }, live, { type: "output_approved", entityId: id, detail: taskLabel(s.tasks.find((t) => t.id === output.taskId)!) });
}

export function requestRevisionState(s: WorkflowState, id: string, live = false): WorkflowState {
  const output = s.outputs.find((o) => o.id === id);
  const task = output && s.tasks.find((t) => t.id === output.taskId);
  if (!output || !task || !s.planApproved || !requirementsReady(s) || s.staleTaskIds.length || task.state !== "completed") return s;
  return logEvents({ ...s,
    outputs: s.outputs.map((o) => o.id === id ? { ...o, approved: "rejected" } : o),
    revisionTaskIds: [...new Set([...s.revisionTaskIds, output.taskId])],
    project: { ...s.project, status: "feedback_pending" },
    workflowNotice: "Revision requested. Choose Continue to feedback to describe the change; other approvals are preserved.",
    managerNotes: withNote(s.managerNotes, "review", revisionRequestedNote(task)),
  }, live, { type: "output_rejected", entityId: id, detail: taskLabel(task) });
}

export function selectRevisionTasksState(s: WorkflowState, ids: string[]): WorkflowState {
  return { ...s, revisionTaskIds: [...new Set(ids)].filter((id) => s.outputs.some((o) => o.taskId === id) && s.tasks.find((t) => t.id === id)?.state === "completed" && !s.staleTaskIds.includes(id)) };
}

export function approveOutputsState(s: WorkflowState): WorkflowState {
  if (!s.planApproved || s.staleTaskIds.length || !s.tasks.every((t) => t.state === "completed")) return s;
  if (!outputsReady(s) && !s.outputs.some((o) => o.approved === "rejected")) return s;
  return { ...s, currentStep: "feedback", project: { ...s.project, status: "feedback_pending" }, workflowNotice: null };
}

/** Finalize when every output is approved; otherwise send the user back to review. */
export function skipFeedbackState(s: WorkflowState, live = false): WorkflowState {
  if (!canVisit(s, "review")) return s;
  if (!outputsReady(s)) return { ...s, currentStep: "review", workflowNotice: "Skipping feedback does not approve outputs. Review pending or rejected outputs before finalizing." };
  return logEvents({ ...s, revisionTaskIds: [], currentStep: "final", completedAt: s.completedAt ?? Date.now(),
    project: { ...s.project, status: "complete" }, workflowNotice: null,
    managerNotes: withNote(s.managerNotes, "final", finalNote(s.outputs.filter((o) => o.approved === "approved").length, s.feedbackItems.filter((f) => f.revisionStatus === "applied").length)),
  }, live, { type: "plan_finalized", entityId: s.project.id, detail: `${s.outputs.filter((o) => o.approved === "approved").length} approved outputs` });
}

/** Open a revision round. Live mode reopens transitive dependents too, so a changed interface never leaves approved consumers pointing at stale work. */
export function openRevisionState(s: WorkflowState, selected: string[], text: string, live: boolean): { state: WorkflowState; feedbackId: string } {
  const affected = live ? affectedTaskIds(s.tasks, selected) : selected;
  const feedback = { id: uid("fb"), projectId: s.project.id, userRequest: text.trim(), affectedTasks: affected, revisionStatus: "open" as const };
  const opened: WorkflowState = { ...s,
    tasks: s.tasks.map((t) => affected.includes(t.id) ? { ...t, state: "needs_revision" } : t),
    outputs: s.outputs.map((o) => affected.includes(o.taskId) ? { ...o, approved: "pending" } : o),
    reviews: live ? [] : s.reviews, revisionTaskIds: affected, feedbackItems: [feedback, ...s.feedbackItems],
    project: { ...s.project, status: "revising" },
    managerNotes: withNote(s.managerNotes, "feedback", feedbackNote(selected, affected, s.tasks)),
  };
  return { feedbackId: feedback.id, state: logEvents(opened, live, [
    { type: "revision_requested", entityId: feedback.id, detail: describeTaskIds(affected, s.tasks) },
    { type: "feedback_submitted", entityId: feedback.id, after: text.trim() },
  ]) };
}

/** Demo-mode revision result: selected outputs rewritten, re-reviewed, and queued for explicit approval. */
export function reviseDemoOutputsState(prev: WorkflowState, selected: string[], text: string, feedbackId: string): WorkflowState {
  const revisedIds = prev.outputs.filter((o) => selected.includes(o.taskId));
  const outputs = prev.outputs.map((o) => {
    const task = prev.tasks.find((t) => t.id === o.taskId);
    return task && selected.includes(o.taskId) ? reviseAgentOutput(task, o, text.trim()) : o;
  });
  const tasks = prev.tasks.map((t) => selected.includes(t.id) ? { ...t, state: "completed" as const } : t);
  const { reviews, conflictSummary } = reviewOutputs(outputs, tasks);
  return logEvents({ ...prev, tasks, outputs, reviews, conflictSummary,
    feedbackItems: prev.feedbackItems.map((f) => f.id === feedbackId ? { ...f, revisionStatus: "applied" } : f),
    revisionTaskIds: [], currentStep: "review", project: { ...prev.project, status: "review_pending" },
    workflowNotice: "Revisions are ready. Review and explicitly approve each revised output; unaffected approvals were preserved.",
    managerNotes: withNote(prev.managerNotes, "review", `Revised ${selected.length} selected output(s) for your feedback; each revision needs your approval`),
  }, false, revisedIds.map((o) => ({ type: "output_generated" as const, entityId: o.id, detail: `revision for ${describeTaskIds([o.taskId], prev.tasks)}` })));
}

/** Close an execution pass: record reviews, settle feedback, log the Review Agent's findings. The step stays on the board. */
export function finishRunState(s: WorkflowState, live: boolean, liveReview: { reviews: Review[]; conflictSummary: string | null; meta?: ModelMeta } | null, reviewError: string, reviewKind?: string): WorkflowState {
  const { reviews, conflictSummary } = live ? liveReview || { reviews: [], conflictSummary: null } : reviewOutputs(s.outputs, s.tasks);
  const complete = s.tasks.every((t) => t.state === "completed");
  const unfinished = s.tasks.filter((t) => t.state !== "completed").length;
  const notes = reviewError ? [`Review Agent unavailable: ${reviewError} Outputs are preserved; use Retry review`]
    : complete ? [...reviewNotes(reviews, s.outputs, s.tasks), "All outputs collected; open Review collected outputs when ready"]
    : [`${unfinished} task(s) unfinished; retry or skip them on the board before review`];
  const reviewed = reviews.length > 0 && !reviewError;
  const summary = `${reviews.filter((r) => r.result === "pass").length} of ${reviews.length} passed; ${reviews.filter((r) => r.result === "flagged").length} flagged; ${reviews.filter((r) => r.result === "conflict").length} conflict`;
  const next: WorkflowState = { ...s, reviews, conflictSummary,
    workflowNotice: reviewError ? `Review unavailable: ${reviewError} Use Retry review; outputs are preserved.` : complete ? null : s.workflowNotice,
    feedbackItems: s.feedbackItems.map((f) => f.revisionStatus === "open" && f.affectedTasks.every((id) => s.tasks.find((t) => t.id === id)?.state === "completed") ? { ...f, revisionStatus: "applied" } : f),
    revisionTaskIds: complete ? [] : s.revisionTaskIds,
    project: { ...s.project, status: "review_pending" },
    agents: s.agents.map((a) => ({ ...a, availability: "available" })),
    managerNotes: withNotes(s.managerNotes, complete ? "review" : "board", notes),
  };
  if (reviewError) return logEvents(next, live, { type: "run_failed", detail: `review${reviewKind ? ` (${reviewKind})` : ""}: ${reviewError}` });
  return reviewed ? logModelEvents(next, live, [{ type: "review_completed", entityId: s.project.id, detail: summary }], liveReview?.meta) : next;
}
