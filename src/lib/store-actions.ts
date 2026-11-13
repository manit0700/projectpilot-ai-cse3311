import { uid } from "./agents";
import { enoughDetail } from "./input-rules";
import { titleFromIdea } from "./mock-ai";
import { acceptanceFor } from "./mock-acceptance";
import { logEvents, originalText } from "./session-events";
import { taskText } from "./store-reducers";
import type { Priority, Requirement, Task } from "./types";
import { buildApprovedSummary, invalidateTasks, requirementsReady, topologicalOrder, validateTasks, type TaskEdit, type WorkflowState } from "./workflow";

// Pure reducers for the manual-editing actions. Each returns a user-facing error or the next state
// (null when nothing changed), so the store only decides whether it may run.

type Result = { error: string } | { state: WorkflowState | null };
export type NewTask = TaskEdit & { expectedOutput?: string; constraints?: string };
const MAX_OUTPUT_TEXT = 20000;

const reopenRequirements = (s: WorkflowState): WorkflowState => ({
  ...invalidateTasks(s, s.tasks.map((t) => t.id)),
  project: { ...s.project, status: "requirements_pending" },
  currentStep: "requirements",
});

export function addRequirementState(s: WorkflowState, text: string, priority: Priority, live: boolean): Result {
  if (!s.project.id) return { error: "Start a project first." };
  if (!enoughDetail(text)) return { error: "Enter at least 12 characters for the requirement." };
  const clean = text.trim();
  const requirement: Requirement = {
    id: uid("req"), projectId: s.project.id, text: clean, priority, approvalStatus: "pending",
    ...(live ? {} : { acceptance: acceptanceFor(clean, priority) }),
  };
  return { state: logEvents({
    ...reopenRequirements(s), requirements: [...s.requirements, requirement],
    workflowNotice: s.tasks.length ? "Requirement added. Approve it, then review the preserved task plan; outputs will refresh after plan approval." : "Requirement added. Approve it before continuing.",
  }, live, { type: "requirement_edited", entityId: requirement.id, detail: "added", after: clean }) };
}

export function deleteRequirementState(s: WorkflowState, id: string, live: boolean): Result {
  const requirement = s.requirements.find((r) => r.id === id);
  if (!requirement) return { error: "Requirement not found." };
  return { state: logEvents({
    ...reopenRequirements(s), requirements: s.requirements.filter((r) => r.id !== id),
    workflowNotice: s.tasks.length ? "Requirement removed. Review the preserved task plan; outputs will refresh after plan approval." : "Requirement removed.",
  }, live, { type: "requirement_rejected", entityId: id, detail: "deleted", before: originalText(s.events, id, requirement.text), after: requirement.text }) };
}

export function addTaskState(s: WorkflowState, input: NewTask, live: boolean): Result {
  if (!requirementsReady(s) || !s.tasks.length) return { error: "Approve requirements and generate the task plan before adding a task." };
  const task: Task = {
    id: uid("task"), projectId: s.project.id, title: input.title.trim(), description: input.description.trim(), ownerAgent: input.ownerAgent,
    dependencies: [...new Set(input.dependencies)], expectedOutput: input.expectedOutput?.trim() || `Deliverable for ${input.title.trim()}`,
    constraints: input.constraints?.trim() ?? "", state: "queued", order: Math.max(0, ...s.tasks.map((t) => t.order)) + 1,
  };
  const tasks = [...s.tasks, task];
  const error = validateTasks(tasks);
  if (error) return { error };
  const added = invalidateTasks({ ...s, tasks: topologicalOrder(tasks) }, [task.id]);
  return { state: logEvents({
    ...added, tasks: added.tasks.map((t) => t.id === task.id ? { ...t, state: "queued" } : t),
    project: { ...s.project, status: "tasks_pending" }, currentStep: "tasks",
    workflowNotice: "Task added. The plan needs your approval again; only the new task will run.",
  }, live, { type: "task_edited", entityId: task.id, detail: "added", after: taskText(task) }) };
}

export function editIdeaState(s: WorkflowState, idea: string, targetUser: string, live: boolean): Result {
  if (!s.project.id) return { error: "Start a project first." };
  if (!enoughDetail(idea)) return { error: "Enter at least 12 characters for the idea." };
  if (targetUser.trim().length < 3) return { error: "Enter at least 3 characters for the target user." };
  const description = idea.trim(), user = targetUser.trim();
  if (description === s.project.description && user === s.project.targetUser) return { state: null };
  const reopened = s.tasks.length ? invalidateTasks(s, s.tasks.map((t) => t.id)) : s;
  const project = { ...s.project, description, targetUser: user, title: titleFromIdea(description) };
  const withTasks = s.tasks.length > 0;
  return { state: logEvents({
    ...reopened, project: { ...project, status: withTasks ? "tasks_pending" : s.project.status,
      approvedSummary: withTasks ? buildApprovedSummary(project, s.requirements, s.tasks) : s.project.approvedSummary },
    currentStep: withTasks ? "tasks" : s.currentStep,
    workflowNotice: s.requirements.length ? "Idea updated. Check that the requirements and task plan still fit; outputs will refresh after plan approval." : null,
  }, live, { type: "answer_edited", entityId: s.project.id, detail: "idea", before: s.project.description, after: description }) };
}

export function editOutputSummaryState(s: WorkflowState, outputId: string, text: string, live: boolean): Result {
  const output = s.outputs.find((o) => o.id === outputId);
  if (!output) return { error: "Output not found." };
  const clean = text.trim();
  if (!enoughDetail(clean) || clean.length > MAX_OUTPUT_TEXT) return { error: `Enter between 12 and ${MAX_OUTPUT_TEXT} characters.` };
  if (clean === output.summary) return { state: null };
  return { state: logEvents({
    ...s, outputs: s.outputs.map((o) => o.id === outputId ? { ...o, summary: clean, humanEdited: true, approved: "pending" } : o),
    workflowNotice: "Output edited. It is marked as human-edited and needs your approval again.",
  }, live, { type: "output_edited", entityId: outputId, before: originalText(s.events, outputId, output.summary), after: clean }) };
}
