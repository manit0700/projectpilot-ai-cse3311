import type { MutableRefObject } from "react";
import { completedNote, dispatchNote, failedNote, haltedNote, heldNote, HALT_NOTICE, pausedNote, pausedNotice, quotaNotice, retryNote, stoppedNote, withNote, withNotes } from "./manager-log";
import { runAgentWithRetry } from "./mock-ai";
import { logEvents, logModelEvents } from "./session-events";
import { errorKind, failureLabel, haltsRun, ProviderError, runLiveReview, runLiveSpecialist, type QuotaScope } from "./specialist-client";
import { finishRunState } from "./store-reducers";
import type { Task } from "./types";
import { topologicalOrder, type WorkflowState } from "./workflow";

// The execution loop behind "Run agents", "Retry" and live revisions. It owns no React state:
// the store hands it the state ref and setters, so the loop stays testable and the store small.

export interface RunContext {
  stateRef: MutableRefObject<WorkflowState>;
  setState: (change: WorkflowState | ((s: WorkflowState) => WorkflowState)) => void;
  setBusyLabel: (label: string) => void;
  live: () => boolean;
  signal: AbortSignal;
  stopped: () => boolean;
  /** False on the one automatic resume after a rate-limit pause: a second per-minute limit then stops the run. */
  allowPause?: boolean;
}

/** What a run ended with, so the store can pause, resume or look up provider cooldowns. */
export interface RunOutcome {
  /** A per-minute quota error: wait this many seconds, then run once more. */
  pauseSeconds?: number;
  /** The run stopped on a quota or auth error. */
  halted?: { kind: "quota" | "auth"; scope?: QuotaScope; retryAfterSeconds?: number };
}

/** Longest per-minute wait the run will sit out on its own. */
export const MAX_AUTO_PAUSE_SECONDS = 60;

/** Timer seam: tests replace `timing.sleep` to control and observe the pause without real waiting. */
export const timing = {
  sleep(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) return reject(new DOMException("Stopped", "AbortError"));
      const onAbort = () => { clearTimeout(timer); reject(new DOMException("Stopped", "AbortError")); };
      const timer = setTimeout(() => { signal?.removeEventListener("abort", onAbort); resolve(); }, ms);
      signal?.addEventListener("abort", onAbort, { once: true });
    });
  },
};

const settled = (s: WorkflowState): WorkflowState => ({
  ...s, project: { ...s.project, status: "review_pending" }, agents: s.agents.map((a) => ({ ...a, availability: "available" })),
});

/** The user pressed Stop: put the interrupted task back in the queue and keep everything else. */
export function stoppedRunState(s: WorkflowState, live: boolean, task?: Task): WorkflowState {
  const next = settled({ ...s, tasks: s.tasks.map((t) => t.id === task?.id ? { ...t, state: "queued" } : t),
    workflowNotice: "Run stopped. Your work is saved; press Run remaining ready tasks to continue.",
    managerNotes: withNote(s.managerNotes, "board", stoppedNote(task)) });
  return logEvents(next, live, { type: "run_stopped", entityId: task?.id, detail: task ? "task returned to the queue" : "stopped" });
}

/** Quota or auth failure: stop dispatching, leave the failing and unstarted tasks queued, say so once. */
export function haltedRunState(s: WorkflowState, live: boolean, task: Task, error: ProviderError & { kind: "quota" | "auth" }): WorkflowState {
  const notice = error.kind === "quota" ? quotaNotice(error.scope, error.retryAfterSeconds, error.provider) : HALT_NOTICE.auth;
  const next = settled({ ...s, tasks: s.tasks.map((t) => t.id === task.id ? { ...t, state: "queued" } : t),
    workflowNotice: notice, managerNotes: withNote(s.managerNotes, "board", haltedNote(task, error.kind)) });
  return logEvents(next, live, { type: "run_failed", entityId: task.id, detail: `${failureLabel(error)}: ${error.message}` });
}

/** Per-minute quota: the task goes back to the queue and the store resumes once after `seconds`. */
export function pausedRunState(s: WorkflowState, live: boolean, task: Task, error: ProviderError, seconds: number): WorkflowState {
  const next = settled({ ...s, tasks: s.tasks.map((t) => t.id === task.id ? { ...t, state: "queued" } : t),
    workflowNotice: pausedNotice(seconds), managerNotes: withNote(s.managerNotes, "board", pausedNote(task, seconds)) });
  return logEvents(next, live, { type: "run_failed", entityId: task.id, detail: `${failureLabel(error)}: ${error.message}` });
}

export async function runTasks(ctx: RunContext, onlyId?: string): Promise<RunOutcome> {
  const { stateRef, setState, signal } = ctx;
  for (const candidate of topologicalOrder(stateRef.current.tasks)) {
    const s = stateRef.current;
    const task = s.tasks.find((t) => t.id === candidate.id)!;
    if (onlyId && task.id !== onlyId) continue;
    if (!onlyId && (task.state === "completed" || task.state === "failed" || s.skippedTaskIds.includes(task.id))) continue;
    if (task.dependencies.some((id) => s.tasks.find((t) => t.id === id)?.state !== "completed")) {
      setState((prev) => ({ ...prev, tasks: prev.tasks.map((t) => t.id === task.id ? { ...t, state: "blocked" } : t), managerNotes: withNote(prev.managerNotes, "board", heldNote(task, prev.tasks)) }));
      continue;
    }
    ctx.setBusyLabel(`Agent: ${task.title}`);
    setState((prev) => ({ ...prev,
      tasks: prev.tasks.map((t) => t.id === task.id ? { ...t, state: "in_progress" } : t),
      agents: prev.agents.map((a) => ({ ...a, availability: a.role === task.ownerAgent ? "busy" : "available" })),
      managerNotes: withNotes(prev.managerNotes, "board", dispatchNote(task, prev.tasks)),
    }));
    try {
      const pendingFeedback = s.feedbackItems.find((f) => f.revisionStatus === "open" && f.affectedTasks.includes(task.id));
      const result = ctx.live()
        ? await runLiveSpecialist(task, s, pendingFeedback?.userRequest, s.outputs.find((o) => o.taskId === task.id), signal)
        : { output: await runAgentWithRetry(task, s.project, { signal, onRetry: (attempt) => setState((prev) => ({ ...prev, managerNotes: withNote(prev.managerNotes, "board", retryNote(task, attempt)) })) }), meta: undefined };
      const { output, meta } = result;
      if (ctx.stopped()) { setState((prev) => stoppedRunState(prev, ctx.live(), task)); return {}; }
      if (output.taskId !== task.id || !output.summary?.trim()) throw new Error("Invalid agent output");
      setState((prev) => logModelEvents({ ...prev,
        tasks: prev.tasks.map((t) => t.id === task.id ? { ...t, state: "completed" } : t),
        outputs: [...prev.outputs.filter((o) => o.taskId !== task.id), { ...output, approved: "pending" }],
        staleTaskIds: prev.staleTaskIds.filter((id) => id !== task.id),
        managerNotes: withNote(prev.managerNotes, "board", completedNote(task, output)),
      }, ctx.live(), [{ type: "output_generated", entityId: output.id, detail: `${task.title}${output.retryCount ? `; ${output.retryCount} retry` : ""}`, after: output.summary }], meta));
    } catch (error) {
      if (ctx.stopped()) { setState((prev) => stoppedRunState(prev, ctx.live(), task)); return {}; }
      const message = error instanceof Error ? error.message : "Retry this task on the board.";
      if (haltsRun(error)) {
        const failure = error as ProviderError & { kind: "quota" | "auth" };
        const wait = failure.retryAfterSeconds;
        if (failure.kind === "quota" && failure.scope === "minute" && wait !== undefined && wait <= MAX_AUTO_PAUSE_SECONDS && ctx.allowPause !== false) {
          const seconds = Math.max(1, Math.ceil(wait));
          setState((prev) => pausedRunState(prev, ctx.live(), task, failure, seconds));
          return { pauseSeconds: seconds };
        }
        setState((prev) => haltedRunState(prev, ctx.live(), task, failure));
        return { halted: { kind: failure.kind, scope: failure.scope, retryAfterSeconds: failure.retryAfterSeconds } };
      }
      setState((prev) => logEvents({ ...prev,
        tasks: prev.tasks.map((t) => t.id === task.id ? { ...t, state: "failed" } : t),
        workflowNotice: `Execution failed for ${task.title}. ${message} Successful work is preserved.`,
        managerNotes: withNote(prev.managerNotes, "board", failedNote(task, message)),
      }, ctx.live(), { type: "run_failed", entityId: task.id, detail: `${failureLabel(error)}: ${message}` }));
    }
  }
  let liveReview: Awaited<ReturnType<typeof runLiveReview>> | null = null;
  let reviewError = "", reviewKind: string | undefined;
  if (ctx.live() && stateRef.current.tasks.every((t) => t.state === "completed")) {
    ctx.setBusyLabel("Review Agent: checking deliverables…");
    try { liveReview = await runLiveReview(stateRef.current, signal); }
    catch (error) {
      if (ctx.stopped()) { setState((prev) => stoppedRunState(prev, true)); return {}; }
      const kind = errorKind(error);
      reviewKind = kind ? failureLabel(error) : undefined;
      reviewError = kind === "quota" ? "Provider quota is used up." : kind === "auth" ? "The provider rejected the API key or access." : error instanceof Error ? error.message : "Review failed. Retry review.";
    }
  }
  setState((s) => finishRunState(s, ctx.live(), liveReview, reviewError, reviewKind));
  return {};
}
