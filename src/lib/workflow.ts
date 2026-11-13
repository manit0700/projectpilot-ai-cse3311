import { WORKFLOW_STEPS, AGENTS } from "./agents";
import type { SessionEvent } from "./session-log";
import type { Project, ProjectContext, Requirement, Task, UsageSummary, WorkflowStep } from "./types";

// Client-only bookkeeping; the existing project/task/output models stay unchanged.
export type WorkflowState = ProjectContext & {
  staleTaskIds: string[];
  revisionTaskIds: string[];
  skippedTaskIds: string[];
  workflowNotice: string | null;
  /** Epoch ms when the final plan was reached; freezes the measured planning time. */
  completedAt: number | null;
  draftBrief?: { idea: string; targetUser: string };
  /** Append-only evaluation log (capped at 2,000 events); see session-log.ts. */
  events: SessionEvent[];
  /** Model calls made in this project, summed from route `meta`. Zero in Demo mode. */
  usage: UsageSummary;
};

export const EMPTY_USAGE: UsageSummary = { requests: 0, promptTokens: 0, completionTokens: 0, totalLatencyMs: 0, models: [] };

export type TaskEdit = Pick<Task, "title" | "description" | "ownerAgent" | "dependencies">;
export const taskCode = (task: Task) => `TASK-${String(task.order).padStart(2, "0")}`;
export const taskLabel = (task: Task) => `${taskCode(task)} · ${task.title}`;
/** "TASK-03 · Title; TASK-04 · Title" for a list of task ids. Unknown ids are skipped, never printed raw. */
export function describeTaskIds(ids: string[], tasks: Task[]): string {
  return ids.map((id) => tasks.find((t) => t.id === id)).filter((t): t is Task => t !== undefined).map(taskLabel).join("; ");
}
export const requirementsReady = (s: ProjectContext) =>
  s.requirements.length > 0 && s.requirements.every((r) => r.approvalStatus === "approved");

export function hasConflict(s: Pick<ProjectContext, "reviews">, outputId: string): boolean {
  return s.reviews.some((r) => r.outputId === outputId && (r.result === "conflict" || r.conflicts.length > 0));
}

export function outputsReady(s: WorkflowState): boolean {
  return requirementsReady(s) && s.planApproved && s.staleTaskIds.length === 0 &&
    s.tasks.length > 0 && s.tasks.every((task) => task.state === "completed" &&
      s.outputs.some((o) => o.taskId === task.id && o.approved === "approved" && s.reviews.some((r) => r.outputId === o.id) && !hasConflict(s, o.id)));
}

export function frontier(s: ProjectContext): number {
  switch (s.project.status) {
    case "draft": return 0;
    case "clarifying": return 1;
    case "requirements_pending": return 2;
    case "tasks_pending": return 3;
    case "plan_approved":
    case "agents_running": return 4;
    case "review_pending": return 5;
    case "feedback_pending":
    case "revising": return 6;
    case "complete": return 7;
  }
}

export function canVisit(s: WorkflowState, step: WorkflowStep): boolean {
  const index = WORKFLOW_STEPS.findIndex((item) => item.id === step);
  if (index < 0 || index > frontier(s)) return false;
  if (index >= 3 && !requirementsReady(s)) return false;
  if (index >= 4 && !s.planApproved) return false;
  if (step === "final" && !outputsReady(s)) return false;
  return true;
}

export function affectedTaskIds(tasks: Task[], roots: string[]): string[] {
  const affected = new Set(roots);
  let changed = true;
  while (changed) {
    changed = false;
    for (const task of tasks) {
      if (!affected.has(task.id) && task.dependencies.some((id) => affected.has(id))) {
        affected.add(task.id);
        changed = true;
      }
    }
  }
  return tasks.filter((task) => affected.has(task.id)).map((task) => task.id);
}

export function validateTasks(tasks: Task[]): string | null {
  const ids = new Set(tasks.map((t) => t.id));
  if (ids.size !== tasks.length) return "Task IDs must be unique.";
  for (const task of tasks) {
    if (task.title.trim().length < 3 || task.description.trim().length < 12) return "Enter at least 3 characters for the title and 12 for the description.";
    if (!AGENTS.some((a) => a.role === task.ownerAgent && !["manager", "review"].includes(a.role))) return "Choose a specialist agent.";
    if (task.dependencies.includes(task.id)) return "A task cannot depend on itself.";
    if (task.dependencies.some((id) => !ids.has(id))) return "Choose dependencies from the existing task list.";
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const byId = new Map(tasks.map((task) => [task.id, task]));
  function cycle(id: string): boolean {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    if (byId.get(id)!.dependencies.some(cycle)) return true;
    visiting.delete(id);
    visited.add(id);
    return false;
  }
  return tasks.some((t) => cycle(t.id)) ? "These dependencies would create a circular dependency. Choose another task." : null;
}

/** Dependencies first, then the original order; the schedule agents run in. */
export function topologicalOrder(tasks: Task[]): Task[] {
  const byId = Object.fromEntries(tasks.map((t) => [t.id, t]));
  const visited = new Set<string>();
  const result: Task[] = [];
  function visit(id: string) {
    if (visited.has(id)) return;
    visited.add(id);
    const task = byId[id];
    if (!task) return;
    task.dependencies.forEach(visit);
    result.push(task);
  }
  [...tasks].sort((a, b) => a.order - b.order).forEach((t) => visit(t.id));
  return result;
}

export function buildApprovedSummary(project: Project, requirements: Requirement[], tasks: Task[]): string {
  const musts = requirements.filter((r) => r.priority === "must" && r.approvalStatus === "approved").map((r) => r.text);
  return [
    `Project: ${project.title}`,
    `Users: ${project.targetUser}`,
    `Idea: ${project.description}`,
    `Must-haves: ${musts.join(" | ") || "none listed"}`,
    `Tasks planned: ${tasks.length} (dependency-ordered)`,
  ].join("\n");
}

export function invalidateTasks(s: WorkflowState, ids: string[]): WorkflowState {
  const staleTaskIds = [...new Set([...s.staleTaskIds, ...ids])];
  return {
    ...s,
    staleTaskIds,
    planApproved: false,
    revisionTaskIds: [],
    skippedTaskIds: s.skippedTaskIds.filter((id) => !ids.includes(id)),
    tasks: s.tasks.map((t) => ids.includes(t.id) ? { ...t, state: "needs_revision" } : t),
    outputs: s.outputs.map((o) => ids.includes(o.taskId) ? { ...o, approved: "pending" } : o),
  };
}
