"use client";

import { ApprovalBar, ManagerPanel, MetricsPanel } from "@/components/shell";
import { TaskHandoff, handoffLogLine } from "@/components/task-handoff";
import { DeliverableView } from "@/components/deliverable-view";
import { WorkspaceIllustration } from "@/components/workspace-illustration";
import { AGENT_LABELS } from "@/lib/agents";
import { useProjectStore } from "@/lib/store";
import type { AgentRole, TaskState } from "@/lib/types";
import { enoughDetail } from "@/lib/input-rules";
import { affectedTaskIds, hasConflict, outputsReady, taskLabel } from "@/lib/workflow";
import { useId, useState } from "react";
import { useStoreExt } from "@/components/store-ext";
import { AgentOffice } from "@/components/agent-office";

export { FinalScreen } from "@/components/screen-final";

const COLUMNS: { state: TaskState; label: string }[] = [
  { state: "blocked", label: "Blocked" },
  { state: "queued", label: "Queued" },
  { state: "in_progress", label: "In progress" },
  { state: "completed", label: "Completed" },
  { state: "needs_revision", label: "Needs revision" },
  { state: "failed", label: "Failed / skipped" },
];

const ROLE_COLOR: Partial<Record<AgentRole, string>> = {
  frontend: "border-l-sky-500",
  backend: "border-l-violet-500",
  database: "border-l-emerald-500",
  testing: "border-l-orange-500",
  documentation: "border-l-slate-500",
  manager: "border-l-teal-600",
  review: "border-l-rose-500",
};

const TERMINAL: TaskState[] = ["completed", "failed"];

export function BoardScreen() {
  const { tasks, agents, outputs, reviews, feedbackItems, busy, busyLabel, goTo, retryTask, skipTask, skippedTaskIds, approveTaskPlan } = useProjectStore();
  const { stopRun } = useStoreExt();

  const [skipId, setSkipId] = useState<string | null>(null);
  const [view, setView] = useState<"office" | "board">("office");
  const ready = tasks.some((t) => ["queued", "blocked"].includes(t.state) && t.dependencies.every((id) => tasks.find((d) => d.id === id)?.state === "completed"));
  const allTerminal = tasks.length > 0 && tasks.every((t) => TERMINAL.includes(t.state));
  const failedCount = tasks.filter((t) => t.state === "failed").length;

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] items-start gap-5 xl:grid-cols-[minmax(0,1fr)_300px] 2xl:grid-cols-[minmax(0,1fr)_320px]">
    <div className="min-w-0 rounded-[2.25rem] border border-white/70 bg-white/55 p-3 shadow-[0_24px_70px_rgba(91,33,182,0.12)] dark:border-violet-900/70 dark:bg-slate-950/55 sm:p-6">
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-bold uppercase tracking-[.2em] text-violet-600 dark:text-violet-300">AI Team · Step 5</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-violet-950 dark:text-violet-100 sm:text-5xl">Your AI Project Team</h1>
          <p className="mt-3 text-base leading-relaxed text-slate-600 dark:text-slate-300">Watch your AI team bring your project plan together.</p>
        </div>
        <div className="inline-flex w-fit rounded-2xl border border-violet-200 bg-violet-50 p-1 shadow-inner dark:border-violet-800 dark:bg-violet-950/40" aria-label="AI Team view">
          <button type="button" onClick={() => setView("office")} aria-pressed={view === "office"} className={`min-h-11 rounded-xl px-4 font-semibold transition motion-reduce:transition-none ${view === "office" ? "bg-gradient-to-r from-violet-600 to-purple-700 text-white shadow-lg" : "text-violet-800 hover:bg-white dark:text-violet-200 dark:hover:bg-violet-900"}`}>Office View</button>
          <button type="button" onClick={() => setView("board")} aria-pressed={view === "board"} className={`min-h-11 rounded-xl px-4 font-semibold transition motion-reduce:transition-none ${view === "board" ? "bg-gradient-to-r from-violet-600 to-purple-700 text-white shadow-lg" : "text-violet-800 hover:bg-white dark:text-violet-200 dark:hover:bg-violet-900"}`}>Board View</button>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-violet-100 bg-white/85 p-4 dark:border-violet-900 dark:bg-slate-950/70">
      <p className="text-base leading-relaxed text-slate-600 dark:text-slate-300">
        {busy
          ? busyLabel
          : "Specialists work from shared context. Failed timeouts retry once."}
      </p>

      <div className="mt-3 flex flex-wrap gap-3">
        {busy && typeof stopRun === "function" && <button type="button" onClick={stopRun} className="min-h-11 rounded-xl border border-rose-400 bg-white px-4 py-2 font-semibold text-rose-800 hover:bg-rose-50 dark:bg-slate-950 dark:text-rose-300">Stop run</button>}
        {!busy && ready && <button type="button" className="min-h-11 rounded-xl bg-gradient-to-r from-violet-600 to-purple-700 px-4 py-3 font-semibold text-white shadow-lg hover:from-violet-700 hover:to-purple-800" onClick={() => void approveTaskPlan()}>Run remaining ready tasks</button>}
      </div>
      <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">Dependencies must complete before a task can run. Failed tasks can be retried individually. Select an office desk or open a board card&apos;s Handoff to inspect real task context.</p>
      </div>
      {skipId && <div role="region" aria-labelledby="skip-title" className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:bg-amber-950/40 dark:border-amber-700">
        <h2 id="skip-title" className="font-semibold">Skip {tasks.find((t) => t.id === skipId)?.title} for now?</h2>
        <p className="mt-2">It stays failed, its dependents remain blocked, and the final plan cannot be completed until it succeeds.</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <button type="button" disabled={busy} aria-describedby={busy ? "skip-busy-help" : undefined} className="rounded-xl border border-amber-800 px-4 py-2 disabled:opacity-50" onClick={() => { skipTask(skipId); setSkipId(null); }}>Confirm skip</button>
          <button type="button" autoFocus className="rounded-xl border border-slate-300 px-4 py-2 dark:border-slate-600" onClick={() => setSkipId(null)}>Cancel</button>
        </div>
        {busy && <p id="skip-busy-help" className="mt-2 text-sm text-amber-900 dark:text-amber-100">Skipping is paused while agents are running.</p>}
      </div>}

      {view === "office" && <AgentOffice tasks={tasks} outputs={outputs} reviews={reviews} feedbackItems={feedbackItems} busy={busy} skippedTaskIds={skippedTaskIds} onRetry={(id) => void retryTask(id)} onSkip={setSkipId} />}

      {view === "board" && <><div className="mt-4 flex flex-wrap gap-2">
        {agents
          .filter((a) => a.role !== "manager")
          .map((a) => (
            <span
              key={a.id}
              className="rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-sm leading-relaxed text-slate-700 dark:bg-slate-950 dark:border-slate-700 dark:text-slate-200"
            >
              <span className="font-semibold">{AGENT_LABELS[a.role]}</span>
              <span className="ml-2 text-slate-600 dark:text-slate-300">{a.availability}</span>
            </span>
          ))}
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {COLUMNS.map((col) => {
          const colTasks = tasks.filter((t) => t.state === col.state);
          return (
            <div
              key={col.state}
              className="min-h-48 rounded-xl border border-slate-200 bg-slate-50 p-2 dark:bg-slate-900 dark:border-slate-700"
            >
              <div className="mb-2 flex items-center justify-between px-1 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <span>{col.label}</span>
                <span className="font-mono">{colTasks.length}</span>
              </div>
              <ul className="space-y-2">
                {colTasks.map((t) => {
                  const out = outputs.find((o) => o.taskId === t.id);
                  const waitingDependencies = t.dependencies.filter((id) => tasks.find((d) => d.id === id)?.state !== "completed");
                  const retryBlocked = waitingDependencies.length > 0;
                  return (
                    <li
                      key={t.id}
                      className={`rounded-xl border border-slate-200 border-l-4 bg-white p-2.5 shadow-sm dark:bg-slate-950 dark:border-slate-700 ${ROLE_COLOR[t.ownerAgent] ?? "border-l-slate-400"}`}
                    >
                      <div className="text-sm font-medium text-slate-900 dark:text-slate-50">
                        {taskLabel(t)}
                      </div>
                      <div className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                        {AGENT_LABELS[t.ownerAgent]}
                      </div>
                      {t.state === "in_progress" && <p role="status" className="mt-2 rounded-lg bg-teal-50 px-2 py-1.5 font-mono text-xs leading-relaxed text-teal-900 dark:bg-teal-950/50 dark:text-teal-100">{handoffLogLine(t, tasks)}</p>}
                      {t.dependencies.length > 0 && <div className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                        <p className="font-semibold">{waitingDependencies.length ? "Blocked by" : "Dependencies complete"}</p>
                        <ul>{(waitingDependencies.length ? waitingDependencies : t.dependencies).map((id) => {
                          const dependency = tasks.find((d) => d.id === id);
                          return <li key={id}>{dependency ? taskLabel(dependency) : id}{dependency?.state === "completed" ? " (complete)" : " (waiting)"}</li>;
                        })}</ul>
                      </div>}
                      {t.state === "failed" && <div className="mt-3 space-y-2">
                        <p className="text-sm text-rose-800 dark:text-rose-300">{skippedTaskIds.includes(t.id) ? "Skipped for now — not completed." : "Execution failed. Unrelated successful work is preserved."}</p>
                        <button type="button" disabled={busy || retryBlocked} aria-label={`Retry task ${t.order}: ${t.title}`} aria-describedby={busy || retryBlocked ? `retry-help-${t.id}` : undefined} onClick={() => void retryTask(t.id)} className="min-h-11 rounded-xl bg-teal-700 px-3 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50">Retry task</button>
                        {!skippedTaskIds.includes(t.id) && <button type="button" disabled={busy} aria-label={`Skip task ${t.order}: ${t.title} for now`} aria-describedby={busy ? `retry-help-${t.id}` : undefined} onClick={() => setSkipId(t.id)} className="ml-2 min-h-11 rounded-xl border border-slate-300 px-3 py-2 disabled:opacity-50 dark:border-slate-600">Skip for now</button>}
                        {(busy || retryBlocked) && <p id={`retry-help-${t.id}`} className="text-sm text-slate-600 dark:text-slate-300">{busy ? "Available once the current agent run finishes." : "Complete the listed dependencies before retrying."}</p>}
                      </div>}
                      {out && (
                        <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                          Confidence {Math.round(out.confidence * 100)}%
                          {out.retryCount > 0 && " · retried"}
                        </div>
                      )}
                      <TaskHandoff task={t} tasks={tasks} outputs={outputs} feedbackItems={feedbackItems} />
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div></>}

      {!busy && allTerminal && (
        <ApprovalBar
          variant="purple"
          approveLabel="Review collected outputs"
          onApprove={() => goTo("review")}
          hint={failedCount ? `${failedCount} task(s) failed or were skipped. You can review the collected outputs now; the final plan stays locked until every task succeeds.` : "Every task has finished. Review each output and approve it individually."}
        />
      )}
      {!busy && !allTerminal && outputs.length > 0 && (
        <ApprovalBar
          variant="purple"
          approveLabel="Open review"
          onApprove={() => goTo("review")}
          hint="Some tasks are still queued, blocked or awaiting revision. Review what has been collected so far, or run the remaining ready tasks above."
        />
      )}
    </div>
      <aside className="space-y-5 xl:sticky xl:top-6 xl:max-h-[calc(100vh-3rem)] xl:overflow-y-auto xl:pr-1" aria-label="Run information">
        <MetricsPanel variant="purple" />
        <ManagerPanel variant="purple" />
      </aside>
    </div>
  );
}

function reviewVerdict(review: { result: string; missingItems: string[] } | undefined, conflict: boolean): string | null {
  if (!review) return null;
  if (conflict) return "Conflict blocks approval and export; request a revision.";
  if (review.result === "flagged" || review.missingItems.length > 0) return "Missing items noted; you may approve or request a revision.";
  return null;
}

export function ReviewScreen() {
  const {
    outputs,
    reviews,
    tasks,
    feedbackItems,
    approveOutput, requestRevision, busy, staleTaskIds, goTo, managerMode, approveTaskPlan, approveOutputs,
  } = useProjectStore();
  const allApproved = tasks.length > 0 && tasks.every((t) => t.state === "completed" && outputs.some((o) => o.taskId === t.id && o.approved === "approved"));
  const hasRevision = outputs.some((o) => o.approved === "rejected");
  const incomplete = tasks.some((t) => t.state !== "completed") || staleTaskIds.length > 0 || outputs.some((o) => !reviews.some((r) => r.outputId === o.id));
  const retryHelpId = useId();
  // Bulk approval mirrors the per-output rules and is withheld entirely while any output has a conflict.
  const anyConflict = outputs.some((o) => hasConflict({ reviews }, o.id));
  const approvable = outputs.filter((o) => o.approved !== "approved" && !busy && reviews.some((r) => r.outputId === o.id)
    && !staleTaskIds.includes(o.taskId) && tasks.find((t) => t.id === o.taskId)?.state === "completed");
  const approvedCount = outputs.filter((o) => o.approved === "approved").length;
  const pendingCount = outputs.filter((o) => o.approved === "pending").length;
  const revisionCount = outputs.filter((o) => o.approved === "rejected").length;

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[180px_minmax(0,1fr)_250px] 2xl:grid-cols-[210px_minmax(0,1fr)_280px]">
      <WorkspaceIllustration src="/projectpilot-review-workspace.png" className="sticky top-6 hidden h-[50rem] rounded-[2rem] border border-white/50 shadow-[0_24px_60px_rgba(91,33,182,0.18)] xl:block" sizes="210px" />

      <section className="min-w-0 rounded-[2rem] border border-violet-100/90 bg-white/90 p-4 shadow-[0_24px_70px_rgba(91,33,182,0.14)] dark:border-violet-900 dark:bg-slate-950/90 sm:p-7" aria-labelledby="review-screen-title">
        <p className="text-sm font-bold uppercase tracking-[.2em] text-violet-600 dark:text-violet-300">Review · Step 6</p>
        <h1 id="review-screen-title" className="mt-2 text-3xl font-bold tracking-tight text-violet-950 dark:text-violet-100 sm:text-4xl">Review Your AI Team&apos;s Work</h1>
        <p className="mt-3 text-base leading-relaxed text-slate-600 dark:text-slate-300">Inspect each deliverable, review the findings, and approve the results or request changes.</p>

        <div className={`mt-5 rounded-2xl border px-4 py-3 text-sm leading-relaxed ${reviews.length === outputs.length && outputs.length > 0 ? "border-violet-200 bg-violet-50 text-violet-950 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-100" : "border-amber-200 bg-amber-50 text-amber-950 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-50"}`}>
          <span className="font-semibold">Review Agent:</span>{" "}
          {reviews.length === outputs.length && outputs.length > 0
            ? `${managerMode === "live" ? "AI review" : "Demo checks"} complete · ${reviews.filter((r) => r.result !== "pass").length} output(s) need attention. Human approval is still required.`
            : "Review is incomplete. Finish tasks or retry review before approving outputs."}
          {managerMode === "live" && tasks.every((t) => t.state === "completed") && <button type="button" disabled={busy} aria-describedby={busy ? retryHelpId : undefined} onClick={() => void approveTaskPlan()} className="ml-3 min-h-11 font-semibold text-violet-800 underline underline-offset-4 disabled:opacity-50 dark:text-violet-200">Retry review</button>}
          {busy && <span id={retryHelpId} className="ml-2">Available after the current run finishes.</span>}
        </div>

        <div className="mt-5 rounded-2xl border border-violet-100 bg-gradient-to-r from-violet-50/90 to-purple-50/50 p-4 dark:border-violet-900 dark:from-violet-950/40 dark:to-purple-950/20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-3" aria-live="polite">
              <div className="rounded-xl border border-emerald-200 bg-white/85 px-3 py-2 dark:bg-slate-950/70 dark:border-emerald-800"><span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Approved</span><strong className="mt-1 block font-mono text-xl text-emerald-700 dark:text-emerald-300">{approvedCount}</strong></div>
              <div className="rounded-xl border border-amber-200 bg-white/85 px-3 py-2 dark:bg-slate-950/70 dark:border-amber-800"><span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Pending</span><strong className="mt-1 block font-mono text-xl text-amber-700 dark:text-amber-300">{pendingCount}</strong></div>
              <div className="rounded-xl border border-orange-200 bg-white/85 px-3 py-2 dark:bg-slate-950/70 dark:border-orange-800"><span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Needs revision</span><strong className="mt-1 block font-mono text-xl text-orange-700 dark:text-orange-300">{revisionCount}</strong></div>
            </div>
            {!anyConflict && approvable.length > 1 && <button type="button" onClick={() => approvable.forEach((o) => approveOutput(o.id))} className="min-h-11 rounded-xl border border-violet-300 bg-white px-4 py-2 font-semibold text-violet-800 shadow-sm transition hover:border-violet-400 hover:bg-violet-100 dark:border-violet-700 dark:bg-slate-950 dark:text-violet-200">Approve all outputs ({approvable.length})</button>}
          </div>
        </div>

        {incomplete && <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-50"><p>Finish unfinished tasks and retry any missing review before continuing.</p><button type="button" className="mt-2 min-h-11 font-semibold text-violet-800 underline underline-offset-4 dark:text-violet-200" onClick={() => goTo("board")}>Return to AI Team</button></div>}

        <ul className="mt-6 space-y-6">
        {outputs.map((o) => {
          const task = tasks.find((t) => t.id === o.taskId);
          const review = reviews.find((r) => r.outputId === o.id);
          const conflict = hasConflict({ reviews }, o.id);
          const verdict = reviewVerdict(review, conflict);
          const stale = staleTaskIds.includes(o.taskId);
          const notComplete = task?.state !== "completed";
          const approveReason = busy ? "Available after the current run finishes." : !review ? "Waiting for the Review Agent result before this output can be approved." : conflict ? "A conflict blocks approval; request a revision instead." : stale ? "Requirements changed since this output was produced; rerun the plan first." : notComplete ? "The task has not completed, so there is nothing final to approve." : null;
          const reviseReason = busy ? "Available after the current run finishes." : staleTaskIds.length > 0 ? "Rerun the plan to refresh stale outputs before requesting revisions." : notComplete ? "The task has not completed yet." : null;
          return (
            <li
              key={o.id}
              className="overflow-hidden rounded-[1.75rem] border border-violet-200/80 bg-gradient-to-b from-white to-violet-50/30 shadow-[0_14px_36px_rgba(91,33,182,0.09)] dark:border-violet-900 dark:from-slate-950 dark:to-violet-950/20"
            >
              <header className="border-b border-violet-100 bg-violet-50/70 px-4 py-4 dark:border-violet-900 dark:bg-violet-950/30 sm:px-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><p className="text-xs font-bold uppercase tracking-[.18em] text-violet-600 dark:text-violet-300">{task ? AGENT_LABELS[task.ownerAgent] : "Specialist output"}</p><h2 className="mt-1 text-xl font-bold text-violet-950 dark:text-violet-100">{task ? taskLabel(task) : o.taskId}</h2></div>
                  <div className="flex flex-wrap gap-2">
                {review && (
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${
                      review.result === "pass" && !conflict
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                        : conflict
                          ? "bg-rose-100 text-rose-900 dark:bg-rose-950/50 dark:text-rose-200"
                          : "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-100"
                    }`}
                  >
                    {conflict ? "Conflict" : review.result === "pass" ? "Pass" : "Flagged"}
                  </span>
                )}
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${o.approved === "approved" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300" : o.approved === "rejected" ? "bg-orange-100 text-orange-900 dark:bg-orange-950/50 dark:text-orange-200" : "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-100"}`}>Human: {o.approved === "approved" ? "Approved" : o.approved === "rejected" ? "Needs revision" : "Pending"}</span>
                  </div>
                </div>
              </header>

              <div className="space-y-5 p-4 sm:p-6">
                <DeliverableView title="Generated deliverable" text={o.summary} humanEdited={o.humanEdited} variant="purple" />

                <div className="grid gap-3 md:grid-cols-2">
                  <section className="rounded-2xl border border-violet-100 bg-white/80 p-4 dark:border-violet-900 dark:bg-slate-950/70"><h3 className="font-bold text-violet-950 dark:text-violet-100">Assumptions</h3>{o.assumptions.length ? <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-slate-700 dark:text-slate-200">{o.assumptions.map((item) => <li key={item}>{item}</li>)}</ul> : <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">None recorded.</p>}</section>
                  <section className="rounded-2xl border border-violet-100 bg-white/80 p-4 dark:border-violet-900 dark:bg-slate-950/70"><h3 className="font-bold text-violet-950 dark:text-violet-100">Next steps</h3>{o.nextSteps.length ? <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-slate-700 dark:text-slate-200">{o.nextSteps.map((item) => <li key={item}>{item}</li>)}</ul> : <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">None recorded.</p>}</section>
                  <section className="rounded-2xl border border-violet-100 bg-white/80 p-4 dark:border-violet-900 dark:bg-slate-950/70"><h3 className="font-bold text-violet-950 dark:text-violet-100">Blockers</h3><p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-200">{o.blockers.length ? o.blockers.join("; ") : "None recorded."}</p></section>
                  <section className="rounded-2xl border border-violet-100 bg-white/80 p-4 dark:border-violet-900 dark:bg-slate-950/70"><h3 className="font-bold text-violet-950 dark:text-violet-100">Delivery details</h3><p className="mt-2 text-sm text-slate-700 dark:text-slate-200">Confidence {Math.round(o.confidence * 100)}% · {o.retryCount + 1} attempt{o.retryCount ? "s" : ""}</p>{task && <p className="mt-1 text-sm text-slate-600 dark:text-slate-300"><span className="font-semibold">Expected:</span> {task.expectedOutput}</p>}</section>
                </div>

                <section className={`rounded-2xl border p-4 ${conflict ? "border-rose-200 bg-rose-50 dark:bg-rose-950/40 dark:border-rose-800" : review?.result === "pass" ? "border-emerald-200 bg-emerald-50 dark:bg-emerald-950/40 dark:border-emerald-800" : "border-amber-200 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-800"}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2"><h3 className={`text-lg font-bold ${conflict ? "text-rose-950 dark:text-rose-100" : review?.result === "pass" ? "text-emerald-950 dark:text-emerald-100" : "text-amber-950 dark:text-amber-50"}`}>Review Agent findings</h3><span className="text-sm font-semibold uppercase">{!review ? "Waiting" : conflict ? "Conflict" : review.result}</span></div>
                  {!review ? <p className="mt-2 text-sm text-amber-950 dark:text-amber-50">No Review Agent result is available for this output yet.</p> : <div className="mt-3 grid gap-3 text-sm leading-relaxed text-slate-800 sm:grid-cols-3 dark:text-slate-100">
                    <div><h4 className="font-bold">Missing items</h4>{review.missingItems.length ? <ul className="mt-1 list-disc pl-5">{review.missingItems.map((item) => <li key={item}>{item}</li>)}</ul> : <p className="mt-1">None</p>}</div>
                    <div><h4 className="font-bold">Conflicts</h4>{review.conflicts.length ? <ul className="mt-1 list-disc pl-5">{review.conflicts.map((item) => <li key={item}>{item}</li>)}</ul> : <p className="mt-1">None</p>}</div>
                    <div><h4 className="font-bold">Suggestions</h4>{review.suggestions.length ? <ul className="mt-1 list-disc pl-5">{review.suggestions.map((item) => <li key={item}>{item}</li>)}</ul> : <p className="mt-1">None</p>}</div>
                  </div>}
                </section>

                {task && <TaskHandoff task={task} tasks={tasks} outputs={outputs} feedbackItems={feedbackItems} variant="purple" />}
                <div className="flex flex-wrap gap-3 border-t border-violet-100 pt-5 dark:border-violet-900">
                  <button type="button" disabled={!!approveReason} aria-pressed={o.approved === "approved"} aria-label={`Approve output: ${task ? taskLabel(task) : o.taskId}`} aria-describedby={approveReason ? `approve-help-${o.id}` : undefined} onClick={() => approveOutput(o.id)} className={`min-h-11 rounded-xl border px-4 py-2 font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${o.approved === "approved" ? "border-emerald-600 bg-emerald-600 text-white" : "border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:border-emerald-700 dark:text-emerald-200"}`}>{o.approved === "approved" ? "Approved ✓" : "Approve output"}</button>
                  <button type="button" disabled={!!reviseReason} aria-pressed={o.approved === "rejected"} aria-label={`Request revision: ${task ? taskLabel(task) : o.taskId}`} aria-describedby={reviseReason ? `revise-help-${o.id}` : undefined} onClick={() => requestRevision(o.id)} className={`min-h-11 rounded-xl border px-4 py-2 font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${o.approved === "rejected" ? "border-orange-600 bg-orange-600 text-white" : "border-amber-300 bg-white text-amber-900 hover:bg-amber-50 dark:bg-slate-950 dark:border-amber-700 dark:text-amber-100"}`}>Request revision</button>
                </div>
                {verdict && <p className={`text-sm ${conflict ? "text-rose-900 dark:text-rose-200" : "text-amber-900 dark:text-amber-100"}`}>{verdict}</p>}
                {approveReason && <p id={`approve-help-${o.id}`} className="text-sm text-slate-600 dark:text-slate-300">Approve output is unavailable: {approveReason}</p>}
                {reviseReason && <p id={`revise-help-${o.id}`} className="text-sm text-slate-600 dark:text-slate-300">Request revision is unavailable: {reviseReason}</p>}
              </div>
            </li>
          );
        })}
        </ul>

        <ApprovalBar
          variant="purple"
          secondaryLabel="← Back to AI Team"
          onSecondary={() => goTo("board")}
          approveLabel="Continue to Feedback →"
          disabled={busy || incomplete || (!allApproved && !hasRevision)}
          onApprove={approveOutputs}
          hint={incomplete ? "Complete every task before continuing." : !allApproved && !hasRevision ? "Approve each output or request a revision before continuing. This button does not approve any output." : "Continue to provide requested revisions or finalize approved outputs. Pending outputs will still need review."}
        />
      </section>

      <aside className="space-y-5 xl:sticky xl:top-6 xl:max-h-[calc(100vh-3rem)] xl:overflow-y-auto xl:pr-1" aria-label="Review information">
        <MetricsPanel variant="purple" />
        <ManagerPanel variant="purple" />
      </aside>
    </div>
  );
}

export function FeedbackScreen() {
  const store = useProjectStore();
  const { submitFeedback, skipFeedback, busy, feedbackItems, tasks, outputs, revisionTaskIds, selectRevisionTasks, managerMode, staleTaskIds } = store;
  const ready = outputsReady(store);
  const [text, setText] = useState("");
  const canSubmit = !busy && enoughDetail(text) && revisionTaskIds.length > 0;
  const selectableTasks = tasks.filter((task) => outputs.some((output) => output.taskId === task.id));
  const affectedIds = managerMode === "live" ? affectedTaskIds(tasks, revisionTaskIds) : revisionTaskIds;
  const automaticIds = affectedIds.filter((id) => !revisionTaskIds.includes(id));

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[180px_minmax(0,1fr)_250px] 2xl:grid-cols-[210px_minmax(0,1fr)_280px]">
      <WorkspaceIllustration src="/projectpilot-feedback-workspace.png" className="sticky top-6 hidden h-[50rem] rounded-[2rem] border border-white/50 shadow-[0_24px_60px_rgba(91,33,182,0.18)] xl:block" sizes="210px" />

      <section className="min-w-0 rounded-[2rem] border border-violet-100/90 bg-white/90 p-4 shadow-[0_24px_70px_rgba(91,33,182,0.14)] dark:border-violet-900 dark:bg-slate-950/90 sm:p-7" aria-labelledby="feedback-screen-title">
        <p className="text-sm font-bold uppercase tracking-[.2em] text-violet-600 dark:text-violet-300">Feedback · Step 7</p>
        <h1 id="feedback-screen-title" className="mt-2 text-3xl font-bold tracking-tight text-violet-950 dark:text-violet-100 sm:text-4xl">Refine Your Project</h1>
        <p className="mt-3 text-base leading-relaxed text-slate-600 dark:text-slate-300">Select the deliverables you&apos;d like to improve and tell your AI team what should change.</p>

        <div className={`mt-5 rounded-2xl border p-4 ${ready ? "border-emerald-200 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-100" : "border-violet-200 bg-violet-50 text-violet-950 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-100"}`}>
          <p className="font-semibold">{ready ? "Every output is approved and the project is ready to finalize." : "At least one output needs revision before the project can be finalized."}</p>
          <p className="mt-1 text-sm leading-relaxed">{ready ? "You can finalize without changing approvals, or select outputs below to request another revision." : "Choose the relevant outputs and describe the changes. Existing unrelated approvals will be preserved."}</p>
        </div>

        <fieldset disabled={busy} className="mt-6 rounded-2xl border border-violet-200 bg-violet-50/45 p-4 dark:border-violet-800 dark:bg-violet-950/20 sm:p-5">
          <legend className="px-2 text-lg font-bold text-violet-950 dark:text-violet-100">Choose outputs to revise</legend>
          <p className="mb-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">In Live API mode, directly selected outputs and their dependent outputs are regenerated in dependency order. Demo mode changes only your direct selections.</p>
          <div className="space-y-3">
            {selectableTasks.map((task) => {
              const output = outputs.find((item) => item.taskId === task.id);
              const selected = revisionTaskIds.includes(task.id);
              const eligible = task.state === "completed" && !staleTaskIds.includes(task.id);
              return <label key={task.id} className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition motion-reduce:transition-none ${selected ? "border-violet-400 bg-violet-100/80 shadow-[0_8px_22px_rgba(91,33,182,0.1)] dark:border-violet-600 dark:bg-violet-950/50" : "border-violet-100 bg-white/85 hover:border-violet-300 dark:border-violet-900 dark:bg-slate-950/70"} ${!eligible ? "cursor-not-allowed opacity-60" : ""}`}>
                <input type="checkbox" className="mt-0.5 size-6 shrink-0 accent-violet-700" checked={selected} disabled={!eligible} onChange={(event) => selectRevisionTasks(event.target.checked ? [...revisionTaskIds, task.id] : revisionTaskIds.filter((id) => id !== task.id))} />
                <span className="min-w-0 flex-1"><span className="block font-bold text-violet-950 dark:text-violet-100">{taskLabel(task)}</span><span className="mt-1 block text-sm text-slate-600 dark:text-slate-300">{AGENT_LABELS[task.ownerAgent]}</span></span>
                <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${output?.approved === "approved" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300" : output?.approved === "rejected" ? "bg-orange-100 text-orange-900 dark:bg-orange-950/50 dark:text-orange-200" : "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-100"}`}>{output?.approved === "approved" ? "Approved" : output?.approved === "rejected" ? "Needs revision" : "Pending"}</span>
              </label>;
            })}
          </div>
        </fieldset>

        <section aria-live="polite" className="mt-5 rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-purple-50/50 p-5 dark:border-violet-800 dark:from-violet-950/40 dark:to-purple-950/20" aria-labelledby="revision-summary-title">
          <h2 id="revision-summary-title" className="text-lg font-bold text-violet-950 dark:text-violet-100">Outputs to Be Revised</h2>
          {!revisionTaskIds.length ? <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{ready ? "No outputs selected. You may finalize the approved plan or choose an output for another revision." : "Select at least one output to revise, or return to Review without applying feedback."}</p> : <>
            <div className="mt-3 space-y-2">{tasks.filter((task) => revisionTaskIds.includes(task.id)).map((task) => <div key={task.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-violet-100 bg-white/80 px-3 py-2 dark:border-violet-900 dark:bg-slate-950/70"><span className="font-semibold text-violet-950 dark:text-violet-100">{taskLabel(task)} <span className="font-normal text-slate-500 dark:text-slate-400">→ {AGENT_LABELS[task.ownerAgent]}</span></span><span className="rounded-full bg-violet-600 px-2.5 py-1 text-xs font-bold text-white">Direct selection</span></div>)}</div>
            {automaticIds.length > 0 && <div className="mt-4"><h3 className="text-sm font-bold uppercase tracking-wide text-purple-800 dark:text-purple-200">Automatically affected dependencies</h3><div className="mt-2 space-y-2">{tasks.filter((task) => automaticIds.includes(task.id)).map((task) => <div key={task.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-purple-200 bg-purple-100/60 px-3 py-2 dark:border-purple-800 dark:bg-purple-950/40"><span className="font-semibold text-purple-950 dark:text-purple-100">{taskLabel(task)} <span className="font-normal text-slate-500 dark:text-slate-400">→ {AGENT_LABELS[task.ownerAgent]}</span></span><span className="rounded-full border border-purple-300 bg-white px-2.5 py-1 text-xs font-bold text-purple-800 dark:border-purple-700 dark:bg-slate-950 dark:text-purple-200">Dependent output</span></div>)}</div></div>}
            <p className="mt-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{managerMode === "live" ? `${affectedIds.length} output${affectedIds.length === 1 ? "" : "s"} will be regenerated. Unrelated approved outputs will be preserved.` : "Demo mode revises only the outputs you selected. Unrelated approved outputs will be preserved."}</p>
          </>}
        </section>

        <div className="mt-6">
          <label htmlFor="revision-feedback" className="text-lg font-bold text-violet-950 dark:text-violet-100">What would you like your AI team to change?</label>
          <p id="revision-feedback-help" className="mt-1 text-sm text-slate-600 dark:text-slate-300">Describe the requested change in at least 12 characters using the existing feedback requirement.</p>
          <textarea disabled={busy} id="revision-feedback" aria-label="Feedback for the Manager Agent" aria-describedby="revision-feedback-help" value={text} onChange={(event) => setText(event.target.value)} minLength={12} rows={6} placeholder="Describe the improvements, corrections, or additional details you'd like..." className="mt-3 w-full rounded-2xl border border-violet-200 bg-white px-4 py-3 text-base leading-relaxed text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-200/70 disabled:opacity-60 dark:border-violet-800 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-violet-900" />
          <p className="mt-2 text-right font-mono text-xs text-slate-500 dark:text-slate-400">{text.length} characters</p>
        </div>

        {feedbackItems.length > 0 && <section className="mt-6" aria-labelledby="feedback-history-title"><h2 id="feedback-history-title" className="text-lg font-bold text-violet-950 dark:text-violet-100">Revision history</h2><ul className="mt-3 space-y-2">{feedbackItems.map((feedback) => <li key={feedback.id} className="rounded-xl border border-violet-100 bg-violet-50/60 px-4 py-3 text-base leading-relaxed text-slate-700 dark:border-violet-900 dark:bg-violet-950/30 dark:text-slate-200"><span className={`mr-2 rounded-full px-2 py-0.5 text-xs font-bold uppercase ${feedback.revisionStatus === "applied" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300" : feedback.revisionStatus === "open" ? "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-100" : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"}`}>{feedback.revisionStatus}</span>{feedback.userRequest}</li>)}</ul></section>}

        {ready ? <ApprovalBar variant="purple" approveLabel="Finalize Approved Plan →" secondaryLabel={busy ? "Revising…" : "Request Revisions →"} disabled={busy} secondaryDisabled={!canSubmit} onApprove={skipFeedback} onSecondary={() => void submitFeedback(text)} hint={busy ? "Wait for the revision to finish." : canSubmit ? "Finalizing keeps every approval as it is. Requesting another revision sends the selected outputs and, in Live mode, their dependents back." : "Finalizing keeps every approval as it is. To request another revision, select at least one output and describe the change in at least 12 characters."} /> : <ApprovalBar variant="purple" approveLabel={busy ? "Revising…" : "Request Revisions →"} secondaryLabel="← Return to Review" disabled={!canSubmit} secondaryDisabled={busy} onApprove={() => void submitFeedback(text)} onSecondary={skipFeedback} hint={busy ? "Wait for the revision to finish." : canSubmit ? "Selected outputs are sent back to their agents with this feedback." : "Request Revisions is unavailable until you select outputs and describe the change in at least 12 characters. Returning to Review never approves pending or revised work."} />}
      </section>

      <aside className="space-y-5 xl:sticky xl:top-6 xl:max-h-[calc(100vh-3rem)] xl:overflow-y-auto xl:pr-1" aria-label="Feedback information">
        <MetricsPanel variant="purple" />
        <ManagerPanel variant="purple" />
      </aside>
    </div>
  );
}
