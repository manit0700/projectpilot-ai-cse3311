"use client";

import { ApprovalBar } from "@/components/shell";
import { TaskHandoff, handoffLogLine } from "@/components/task-handoff";
import { AGENT_LABELS } from "@/lib/agents";
import { useProjectStore } from "@/lib/store";
import type { AgentRole, TaskState } from "@/lib/types";
import { enoughDetail } from "@/lib/input-rules";
import { hasConflict, outputsReady, taskLabel } from "@/lib/workflow";
import { useId, useState } from "react";
import { useStoreExt } from "@/components/store-ext";

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
  const { tasks, agents, outputs, feedbackItems, busy, busyLabel, goTo, retryTask, skipTask, skippedTaskIds, approveTaskPlan } = useProjectStore();
  const { stopRun } = useStoreExt();

  const [skipId, setSkipId] = useState<string | null>(null);
  const ready = tasks.some((t) => ["queued", "blocked"].includes(t.state) && t.dependencies.every((id) => tasks.find((d) => d.id === id)?.state === "completed"));
  const allTerminal = tasks.length > 0 && tasks.every((t) => TERMINAL.includes(t.state));
  const failedCount = tasks.filter((t) => t.state === "failed").length;

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl text-slate-900">Agent assignment board</h1>
      <p className="mt-3 text-base leading-relaxed text-slate-600">
        {busy
          ? busyLabel
          : "Specialists work from shared context. Failed timeouts retry once."}
      </p>

      {busy && typeof stopRun === "function" && <button type="button" onClick={stopRun} className="mt-3 min-h-11 rounded-xl border border-rose-400 px-4 py-2 font-semibold text-rose-800 hover:bg-rose-50">Stop run</button>}
      <p className="mt-3 text-sm text-slate-600">Dependencies must complete before a task can run. Failed tasks can be retried individually. Open a card&apos;s Handoff to see exactly what each agent received.</p>
      {skipId && <div role="region" aria-labelledby="skip-title" className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
        <h2 id="skip-title" className="font-semibold">Skip {tasks.find((t) => t.id === skipId)?.title} for now?</h2>
        <p className="mt-2">It stays failed, its dependents remain blocked, and the final plan cannot be completed until it succeeds.</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <button type="button" disabled={busy} aria-describedby={busy ? "skip-busy-help" : undefined} className="rounded-xl border border-amber-800 px-4 py-2 disabled:opacity-50" onClick={() => { skipTask(skipId); setSkipId(null); }}>Confirm skip</button>
          <button type="button" autoFocus className="rounded-xl border border-slate-300 px-4 py-2" onClick={() => setSkipId(null)}>Cancel</button>
        </div>
        {busy && <p id="skip-busy-help" className="mt-2 text-sm text-amber-900">Skipping is paused while agents are running.</p>}
      </div>}
      {!busy && ready && <button type="button" className="mt-4 min-h-11 rounded-xl bg-teal-700 px-4 py-3 font-semibold text-white hover:bg-teal-800" onClick={() => void approveTaskPlan()}>Run remaining ready tasks</button>}
      <div className="mt-4 flex flex-wrap gap-2">
        {agents
          .filter((a) => a.role !== "manager")
          .map((a) => (
            <span
              key={a.id}
              className="rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-sm leading-relaxed text-slate-700"
            >
              <span className="font-semibold">{AGENT_LABELS[a.role]}</span>
              <span className="ml-2 text-slate-600">{a.availability}</span>
            </span>
          ))}
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {COLUMNS.map((col) => {
          const colTasks = tasks.filter((t) => t.state === col.state);
          return (
            <div
              key={col.state}
              className="min-h-48 rounded-xl border border-slate-200 bg-slate-50 p-2"
            >
              <div className="mb-2 flex items-center justify-between px-1 text-sm font-semibold uppercase tracking-wide text-slate-500">
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
                      className={`rounded-xl border border-slate-200 border-l-4 bg-white p-2.5 shadow-sm ${ROLE_COLOR[t.ownerAgent] ?? "border-l-slate-400"}`}
                    >
                      <div className="text-sm font-medium text-slate-900">
                        {taskLabel(t)}
                      </div>
                      <div className="mt-0.5 text-sm text-slate-500">
                        {AGENT_LABELS[t.ownerAgent]}
                      </div>
                      {t.state === "in_progress" && <p role="status" className="mt-2 rounded-lg bg-teal-50 px-2 py-1.5 font-mono text-xs leading-relaxed text-teal-900">{handoffLogLine(t, tasks)}</p>}
                      {t.dependencies.length > 0 && <div className="mt-3 text-sm text-slate-600">
                        <p className="font-semibold">{waitingDependencies.length ? "Blocked by" : "Dependencies complete"}</p>
                        <ul>{(waitingDependencies.length ? waitingDependencies : t.dependencies).map((id) => {
                          const dependency = tasks.find((d) => d.id === id);
                          return <li key={id}>{dependency ? taskLabel(dependency) : id}{dependency?.state === "completed" ? " (complete)" : " (waiting)"}</li>;
                        })}</ul>
                      </div>}
                      {t.state === "failed" && <div className="mt-3 space-y-2">
                        <p className="text-sm text-rose-800">{skippedTaskIds.includes(t.id) ? "Skipped for now — not completed." : "Execution failed. Unrelated successful work is preserved."}</p>
                        <button type="button" disabled={busy || retryBlocked} aria-label={`Retry task ${t.order}: ${t.title}`} aria-describedby={busy || retryBlocked ? `retry-help-${t.id}` : undefined} onClick={() => void retryTask(t.id)} className="min-h-11 rounded-xl bg-teal-700 px-3 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50">Retry task</button>
                        {!skippedTaskIds.includes(t.id) && <button type="button" disabled={busy} aria-label={`Skip task ${t.order}: ${t.title} for now`} aria-describedby={busy ? `retry-help-${t.id}` : undefined} onClick={() => setSkipId(t.id)} className="ml-2 min-h-11 rounded-xl border border-slate-300 px-3 py-2 disabled:opacity-50">Skip for now</button>}
                        {(busy || retryBlocked) && <p id={`retry-help-${t.id}`} className="text-sm text-slate-600">{busy ? "Available once the current agent run finishes." : "Complete the listed dependencies before retrying."}</p>}
                      </div>}
                      {out && (
                        <div className="mt-2 text-sm text-slate-600">
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
      </div>

      {!busy && allTerminal && (
        <ApprovalBar
          approveLabel="Review collected outputs"
          onApprove={() => goTo("review")}
          hint={failedCount ? `${failedCount} task(s) failed or were skipped. You can review the collected outputs now; the final plan stays locked until every task succeeds.` : "Every task has finished. Review each output and approve it individually."}
        />
      )}
      {!busy && !allTerminal && outputs.length > 0 && (
        <ApprovalBar
          approveLabel="Open review"
          onApprove={() => goTo("review")}
          hint="Some tasks are still queued, blocked or awaiting revision. Review what has been collected so far, or run the remaining ready tasks above."
        />
      )}
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

  return (
    <div className="max-w-4xl">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl text-slate-900">Review outputs</h1>
      <p className="mt-3 text-base leading-relaxed text-slate-600">
        Review Agent checks missing pieces and consistency. Approve before
        revisions or the final plan.
      </p>

      <div className="mt-4 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-900">
        {reviews.length === outputs.length && outputs.length > 0
          ? `${managerMode === "live" ? "AI review" : "Demo checks"} complete · ${reviews.filter((r) => r.result !== "pass").length} output(s) need attention. Human approval is still required.`
          : "Review is incomplete. Finish tasks or retry review before approving outputs."}
        {managerMode === "live" && tasks.every((t) => t.state === "completed") && <button type="button" disabled={busy} aria-describedby={busy ? retryHelpId : undefined} onClick={() => void approveTaskPlan()} className="ml-3 underline disabled:opacity-50">Retry review</button>}
        {busy && <span id={retryHelpId} className="ml-2">Available after the current run finishes.</span>}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <p className="font-medium" aria-live="polite">Approved: {outputs.filter((o) => o.approved === "approved").length} · Pending: {outputs.filter((o) => o.approved === "pending").length} · Needs revision: {outputs.filter((o) => o.approved === "rejected").length}</p>
        {!anyConflict && approvable.length > 1 && <button type="button" onClick={() => approvable.forEach((o) => approveOutput(o.id))} className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50">Approve all outputs ({approvable.length})</button>}
      </div>
      {incomplete && <div className="mt-4 rounded-xl bg-amber-50 p-4"><p>Finish unfinished tasks and retry any missing review before continuing.</p><button type="button" className="mt-2 min-h-11 underline" onClick={() => goTo("board")}>Return to agent board</button></div>}
      <ul className="mt-6 space-y-3">
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
              className="rounded-xl border border-slate-200 bg-white p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold text-slate-900">
                  {task ? taskLabel(task) : o.taskId}
                </h2>
                <span className="text-sm text-slate-500">
                  {task ? AGENT_LABELS[task.ownerAgent] : ""}
                </span>
                {review && (
                  <span
                    className={`rounded px-1.5 py-0.5 text-sm font-semibold uppercase ${
                      review.result === "pass" && !conflict
                        ? "bg-emerald-100 text-emerald-800"
                        : conflict
                          ? "bg-rose-100 text-rose-900"
                          : "bg-amber-100 text-amber-900"
                    }`}
                  >
                    {conflict ? "Conflict" : review.result === "pass" ? "Pass" : "Flagged"}
                  </span>
                )}
              </div>
              <p className={`mt-3 font-semibold ${o.approved === "approved" ? "text-teal-800" : "text-amber-900"}`}>Human review: {o.approved === "approved" ? "Approved" : o.approved === "rejected" ? "Needs revision" : "Pending review"}</p>
              <p className="mt-2 whitespace-pre-wrap text-base leading-relaxed text-slate-700">{o.summary}</p>
              <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                <div>
                  <div className="font-semibold text-slate-800">Assumptions</div>
                  <ul className="list-disc pl-4">
                    {o.assumptions.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="font-semibold text-slate-800">Next steps</div>
                  <ul className="list-disc pl-4">
                    {o.nextSteps.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                </div>
              </div>
              {review &&
                (review.missingItems.length > 0 ||
                  review.conflicts.length > 0 ||
                  review.suggestions.length > 0) && (
                  <div className="mt-3 rounded bg-slate-50 p-2 text-base leading-relaxed text-slate-700">
                    {review.missingItems.length > 0 && (
                      <p>Missing: {review.missingItems.join("; ")}</p>
                    )}
                    {review.conflicts.length > 0 && (
                      <p>Conflicts: {review.conflicts.join("; ")}</p>
                    )}
                    {review.suggestions.length > 0 && (
                      <p>Suggestions: {review.suggestions.join("; ")}</p>
                    )}
                  </div>
                )}
              {task && <TaskHandoff task={task} tasks={tasks} outputs={outputs} feedbackItems={feedbackItems} />}
              <div className="mt-4 flex flex-wrap gap-3">
                <button type="button" disabled={!!approveReason} aria-pressed={o.approved === "approved"} aria-label={`Approve output: ${task ? taskLabel(task) : o.taskId}`} aria-describedby={approveReason ? `approve-help-${o.id}` : undefined} onClick={() => approveOutput(o.id)} className={`min-h-11 rounded-xl border px-4 py-2 font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${o.approved === "approved" ? "border-teal-700 bg-teal-700 text-white" : "border-slate-300 bg-white text-slate-700"}`}>{o.approved === "approved" ? "Approved ✓" : "Approve output"}</button>
                <button type="button" disabled={!!reviseReason} aria-pressed={o.approved === "rejected"} aria-label={`Request revision: ${task ? taskLabel(task) : o.taskId}`} aria-describedby={reviseReason ? `revise-help-${o.id}` : undefined} onClick={() => requestRevision(o.id)} className={`min-h-11 rounded-xl border px-4 py-2 font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${o.approved === "rejected" ? "border-teal-700 bg-teal-700 text-white" : "border-slate-300 bg-white text-slate-700"}`}>Request revision</button>
              </div>
              {verdict && <p className={`mt-2 text-sm ${conflict ? "text-rose-900" : "text-amber-900"}`}>{verdict}</p>}
              {approveReason && <p id={`approve-help-${o.id}`} className="mt-2 text-sm text-slate-600">Approve output is unavailable: {approveReason}</p>}
              {reviseReason && <p id={`revise-help-${o.id}`} className="mt-1 text-sm text-slate-600">Request revision is unavailable: {reviseReason}</p>}
              <div className="mt-2 font-mono text-sm text-slate-600">
                Confidence {Math.round(o.confidence * 100)}% · blockers{" "}
                {o.blockers.length ? o.blockers.join("; ") : "none"}
              </div>
            </li>
          );
        })}
      </ul>

      <ApprovalBar
        approveLabel="Continue to feedback"
        disabled={busy || incomplete || (!allApproved && !hasRevision)}
        onApprove={approveOutputs}
        hint={incomplete ? "Complete every task before continuing." : !allApproved && !hasRevision ? "Approve each output or request a revision before continuing. This button does not approve any output." : "Continue to provide requested revisions or finalize approved outputs. Pending outputs will still need review."}
      />
    </div>
  );
}

export function FeedbackScreen() {
  const store = useProjectStore();
  const { submitFeedback, skipFeedback, busy, feedbackItems, tasks, outputs, revisionTaskIds, selectRevisionTasks } = store;
  const ready = outputsReady(store);
  const [text, setText] = useState("");
  const canSubmit = !busy && enoughDetail(text) && revisionTaskIds.length > 0;

  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl text-slate-900">{ready ? "Revise or finalize" : "Feedback / revision"}</h1>
      <p className="mt-3 text-base leading-relaxed text-slate-600">
        {ready ? "Every output is approved. Finalize the plan now, or describe one more change and send selected outputs back to their agents." : "Tell the Manager what to change. Affected tasks are updated only after this checkpoint."}
      </p>

      <fieldset disabled={busy} className="mt-5 space-y-3 rounded-xl border border-slate-200 p-4">
        <legend className="px-1 font-semibold">Choose outputs to revise</legend>
        <p className="text-sm text-slate-600">In Live API mode, selected outputs and all dependent outputs are revised in dependency order. Unrelated approvals are preserved. Demo mode changes only your selection.</p>
        {tasks.filter((t) => outputs.some((o) => o.taskId === t.id)).map((t) => <label key={t.id} className="flex items-start gap-3">
          <input type="checkbox" className="mt-1 size-4 shrink-0 accent-teal-700" checked={revisionTaskIds.includes(t.id)} onChange={(e) => selectRevisionTasks(e.target.checked ? [...revisionTaskIds, t.id] : revisionTaskIds.filter((id) => id !== t.id))} />
          <span>{taskLabel(t)} — {AGENT_LABELS[t.ownerAgent]}</span>
        </label>)}
      </fieldset>
      <div aria-live="polite" className="mt-4 rounded-xl bg-teal-50 p-4 text-teal-900">
        {revisionTaskIds.length ? <><p>Your feedback will send these outputs back for revision:</p><ul className="mt-2 list-disc pl-5">{tasks.filter((t) => revisionTaskIds.includes(t.id)).map((t) => <li key={t.id}>{taskLabel(t)} → {AGENT_LABELS[t.ownerAgent]}</li>)}</ul></> : <p>{ready ? "No outputs selected. Finalize the approved plan, or select an output to request another revision." : "Select at least one output to revise, or skip revisions if all outputs are approved."}</p>}
      </div>
      <textarea
        disabled={busy}
        aria-label="Feedback for the Manager Agent"
        value={text}
        onChange={(e) => setText(e.target.value)}
        minLength={12}
        rows={4}
        placeholder="e.g. Expand the UI screens list and add auth edge cases to the API plan"
        className="mt-6 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none ring-teal-700/30 focus:ring-2"
      />

      {feedbackItems.length > 0 && (
        <ul className="mt-4 space-y-2">
          {feedbackItems.map((f) => (
            <li
              key={f.id}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-base leading-relaxed text-slate-700"
            >
              <span className="font-semibold uppercase">{f.revisionStatus}</span>
              {" — "}
              {f.userRequest}
            </li>
          ))}
        </ul>
      )}

      {ready ? (
        <ApprovalBar
          approveLabel="Finalize approved plan"
          secondaryLabel={busy ? "Revising…" : "Request another revision"}
          disabled={busy}
          secondaryDisabled={!canSubmit}
          onApprove={skipFeedback}
          onSecondary={() => void submitFeedback(text)}
          hint={busy ? "Wait for the revision to finish." : canSubmit ? "Finalizing keeps every approval as it is. Requesting another revision sends only the selected outputs back." : "Finalizing keeps every approval as it is. To request another revision, select at least one output and describe the change in at least 12 characters."}
        />
      ) : (
        <ApprovalBar
          approveLabel={busy ? "Revising…" : "Apply feedback"}
          secondaryLabel="Skip revisions & return to review"
          disabled={!canSubmit}
          secondaryDisabled={busy}
          onApprove={() => void submitFeedback(text)}
          onSecondary={skipFeedback}
          hint={busy ? "Wait for the revision to finish." : canSubmit ? "Selected outputs are sent back to their agents with this feedback." : "Apply feedback is unavailable until you select outputs and describe the change in at least 12 characters. Skipping never approves pending or revised work."}
        />
      )}
    </div>
  );
}
