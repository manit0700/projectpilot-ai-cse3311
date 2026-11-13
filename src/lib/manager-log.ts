import { AGENT_LABELS, uid } from "./agents";
import { taskLabel } from "./workflow";
import type { AgentOutput, ClarifyingQuestion, ManagerNote, Requirement, Review, Task, WorkflowStep } from "./types";

// Builders for the Manager log. Each message states the actual decision the
// manager made and the data it was derived from, so the log reads as reasoning,
// not as status chatter. Messages stay on one line.

const MAX_NOTES = 40;

export function makeNote(step: WorkflowStep, message: string): ManagerNote {
  return { id: uid("note"), at: new Date().toLocaleTimeString(), step, message };
}

/** Newest note first; several messages passed together keep their reading order. */
export function withNotes(notes: ManagerNote[], step: WorkflowStep, messages: string[]): ManagerNote[] {
  return [...messages.map((m) => makeNote(step, m)).reverse(), ...notes].slice(0, MAX_NOTES);
}
export const withNote = (notes: ManagerNote[], step: WorkflowStep, message: string) => withNotes(notes, step, [message]);

const byId = (tasks: Task[], ids: string[]) => ids.map((id) => tasks.find((t) => t.id === id)).filter((t): t is Task => t !== undefined);
const codes = (tasks: Task[]) => tasks.map(taskLabel).join("; ");
const lower = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

const TOPICS: [RegExp, string][] = [
  [/primary user|who/i, "users"],
  [/important feature/i, "scope"],
  [/stack|language|host|db/i, "stack"],
  [/login|auth/i, "auth"],
  [/native|pwa|responsive/i, "platform"],
  [/ai api|prepared responses/i, "data source"],
];

export function questionsAskedNote(questions: ClarifyingQuestion[]): string {
  const topics = [...new Set(questions.map((q) => TOPICS.find(([pattern]) => pattern.test(q.prompt))?.[1] ?? "details"))];
  return `Asked ${questions.length} clarifying questions about ${topics.join(", ")}`;
}

export const answersDraftedNote = (count: number, source: string) =>
  `Drafted ${count} suggested answers from your idea and target user (${source}); edit any before generating requirements`;

export function requirementsDraftedNote(requirements: Requirement[]): string {
  const musts = requirements.filter((r) => r.priority === "must").length;
  return `Drafted ${requirements.length} requirements from your answers (${musts} must-have)`;
}

/** One summary line, then one ordering decision per dependent task, derived from its dependencies. */
export function planNotes(tasks: Task[], requirements: Requirement[]): string[] {
  const roles = new Set(tasks.map((t) => t.ownerAgent)).size;
  const notes = [`Approved ${requirements.length} requirements; planned ${tasks.length} tasks for ${roles} specialist agents`];
  for (const task of tasks) {
    const deps = byId(tasks, task.dependencies);
    if (!deps.length) continue;
    const reasons = [...new Set(deps.map((d) => lower(d.expectedOutput)))].join(" and ");
    notes.push(`Ordered ${taskLabel(task)} after ${codes(deps)} because it depends on ${reasons}`);
  }
  return notes;
}

export function dispatchNote(task: Task, tasks: Task[]): string[] {
  const deps = byId(tasks, task.dependencies);
  const agent = AGENT_LABELS[task.ownerAgent];
  const notes = [`Dispatched ${agent}: ${taskLabel(task)}, expected output ${lower(task.expectedOutput)}, ${deps.length} prerequisite${deps.length === 1 ? "" : "s"}`];
  if (deps.length) notes.push(`${agent} received ${codes(deps)} output as shared context`);
  return notes;
}

export const retryNote = (task: Task, attempt: number) => `Specialist timed out on ${taskLabel(task)}, retrying (attempt ${attempt + 1})`;

export function completedNote(task: Task, output: AgentOutput): string {
  const retries = output.retryCount ? ` after ${output.retryCount} retry` : "";
  return `${AGENT_LABELS[task.ownerAgent]} completed ${taskLabel(task)} (confidence ${Math.round(output.confidence * 100)}%${retries})`;
}

export const failedNote = (task: Task, message: string) => `${taskLabel(task)} failed: ${message} Completed work is preserved; retry or skip it on the board`;

export function heldNote(task: Task, tasks: Task[]): string {
  const waiting = byId(tasks, task.dependencies).filter((d) => d.state !== "completed");
  return `Held ${taskLabel(task)}: waiting on ${codes(waiting) || "prerequisites"}`;
}

export function reviewNotes(reviews: Review[], outputs: AgentOutput[], tasks: Task[]): string[] {
  const notes: string[] = [];
  for (const review of reviews) {
    if (review.result === "pass") continue;
    const task = tasks.find((t) => t.id === outputs.find((o) => o.id === review.outputId)?.taskId);
    const label = task ? taskLabel(task) : "an output";
    const findings = [...review.conflicts, ...review.missingItems].join("; ") || review.suggestions.join("; ");
    notes.push(review.result === "conflict" ? `Review Agent found a conflict on ${label}: ${findings}` : `Review Agent flagged ${label}: ${findings}`);
  }
  const passed = reviews.filter((r) => r.result === "pass").length;
  notes.push(`Review Agent passed ${passed} of ${reviews.length} outputs; each output still needs your approval`);
  return notes;
}

export function feedbackNote(selected: string[], affected: string[], tasks: Task[]): string {
  const dependents = byId(tasks, affected.filter((id) => !selected.includes(id)));
  return `Feedback affects ${codes(byId(tasks, selected))}${dependents.length ? ` and dependents ${codes(dependents)}` : ""}`;
}

export const revisionRequestedNote = (task: Task) => `Revision requested for ${taskLabel(task)}; other approvals are preserved`;

export const requirementChangedNote = (staleCount: number) =>
  staleCount ? `Requirement changed; ${staleCount} task outputs marked for refresh after re-approval` : "Requirement changed; approve it again before planning tasks";

export const taskEditedNote = (task: Task, affected: Task[]) =>
  `Edited ${taskLabel(task)}; ${affected.length} task${affected.length === 1 ? "" : "s"} will be refreshed after plan approval`;

export const finalNote = (approved: number, revisions: number) =>
  `Final plan assembled from ${approved} approved outputs after ${revisions} revision round${revisions === 1 ? "" : "s"}`;

export const stoppedNote = (task: Task | undefined) =>
  task ? `Run stopped by you during ${taskLabel(task)}; it is queued again and finished outputs are preserved` : "Run stopped by you; finished outputs are preserved";

export const haltedNote = (task: Task, kind: string) =>
  `Run paused after ${taskLabel(task)} hit a ${kind} error; remaining tasks stay queued and finished outputs are preserved`;

export const HALT_NOTICE: Record<"quota" | "auth", string> = {
  quota: "Provider quota is used up. Your work is saved; press Run remaining ready tasks when quota resets or switch provider.",
  auth: "The provider rejected the API key or access. Your work is saved; fix the key or switch provider, then press Run remaining ready tasks.",
};

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** "about 12 hours", "about 5 minutes"; empty when the provider gave no reset time. */
export function resetPhrase(seconds: number | undefined): string {
  if (seconds === undefined) return "";
  if (seconds < 90) return "in under 2 minutes";
  if (seconds < 3300) return `in about ${Math.round(seconds / 60)} minutes`;
  const hours = Math.round(seconds / 3600);
  return `in about ${hours} hour${hours === 1 ? "" : "s"}`;
}

/** The single notice shown when a run stops on a quota error, with the human reset time when known. */
export function quotaNotice(scope: "day" | "minute" | undefined, retryAfterSeconds: number | undefined, provider?: string): string {
  const reset = resetPhrase(retryAfterSeconds);
  if (scope === "day") {
    const name = provider ? `${capitalize(provider)} daily quota` : "Provider daily quota";
    return `${name} is used up${reset ? `; it resets ${reset}` : ""}. Your work is saved; press Run remaining ready tasks later, or add a fallback provider.`;
  }
  if (scope === "minute" && reset) return `Provider rate limit reached; it clears ${reset}. Your work is saved; press Run remaining ready tasks then, or add a fallback provider.`;
  return HALT_NOTICE.quota;
}

export const pausedNotice = (seconds: number) => `Provider rate limit reached. Resuming automatically in about ${seconds} second${seconds === 1 ? "" : "s"}; press Stop to cancel.`;
export const pausedNote = (task: Task, seconds: number) => `Run paused after ${taskLabel(task)} hit the per-minute rate limit; resuming once in ${seconds}s, then stopping if it repeats`;
