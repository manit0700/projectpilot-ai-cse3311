"use client";

import { ApprovalBar } from "@/components/shell";
import { AGENT_LABELS } from "@/lib/agents";
import { useProjectStore } from "@/lib/store";
import type { AgentRole, TaskState } from "@/lib/types";
import { outputsReady, taskLabel } from "@/lib/workflow";
import { downloadPlan } from "@/lib/plan-export";
import { useState } from "react";

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

export function BoardScreen() {
  const { tasks, agents, outputs, busy, busyLabel, goTo, retryTask, skipTask, skippedTaskIds, approveTaskPlan } = useProjectStore();

  const [skipId, setSkipId] = useState<string | null>(null);
  const ready = tasks.some((t) => ["queued", "blocked"].includes(t.state) && t.dependencies.every((id) => tasks.find((d) => d.id === id)?.state === "completed"));

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl text-slate-900">Agent assignment board</h1>
      <p className="mt-3 text-base leading-relaxed text-slate-600">
        {busy
          ? busyLabel
          : "Specialists work from shared context. Failed timeouts retry once."}
      </p>

      <p className="mt-3 text-sm text-slate-600">Dependencies must complete before a task can run. Failed tasks can be retried individually.</p>
      {skipId && <div role="region" aria-labelledby="skip-title" className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
        <h2 id="skip-title" className="font-semibold">Skip {tasks.find((t) => t.id === skipId)?.title} for now?</h2>
        <p className="mt-2">It stays failed, its dependents remain blocked, and the final plan cannot be completed until it succeeds.</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <button type="button" disabled={busy} className="rounded-xl border border-amber-800 px-4 py-2" onClick={() => { skipTask(skipId); setSkipId(null); }}>Confirm skip</button>
          <button type="button" autoFocus className="rounded-xl border border-slate-300 px-4 py-2" onClick={() => setSkipId(null)}>Cancel</button>
        </div>
      </div>}
      {!busy && ready && <button type="button" className="mt-4 rounded-xl bg-teal-700 px-4 py-3 text-white" onClick={() => void approveTaskPlan()}>Run remaining ready tasks</button>}
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
                      {t.dependencies.length > 0 && <div className="mt-3 text-sm text-slate-600">
                        <p className="font-semibold">{waitingDependencies.length ? "Blocked by" : "Dependencies complete"}</p>
                        <ul>{(waitingDependencies.length ? waitingDependencies : t.dependencies).map((id) => {
                          const dependency = tasks.find((d) => d.id === id);
                          return <li key={id}>{dependency ? taskLabel(dependency) : id}{dependency?.state === "completed" ? " (complete)" : " (waiting)"}</li>;
                        })}</ul>
                      </div>}
                      {t.state === "failed" && <div className="mt-3 space-y-2">
                        <p className="text-sm text-rose-800">{skippedTaskIds.includes(t.id) ? "Skipped for now — not completed." : "Execution failed. Unrelated successful work is preserved."}</p>
                        <button type="button" disabled={busy || t.dependencies.some((id) => tasks.find((d) => d.id === id)?.state !== "completed")} onClick={() => void retryTask(t.id)} className="rounded-xl bg-teal-700 px-3 py-2 text-white disabled:opacity-50">Retry task</button>
                        {!skippedTaskIds.includes(t.id) && <button type="button" disabled={busy} onClick={() => setSkipId(t.id)} className="ml-2 rounded-xl border border-slate-300 px-3 py-2">Skip for now</button>}
                        {t.dependencies.some((id) => tasks.find((d) => d.id === id)?.state !== "completed") && <p className="text-sm">Complete the listed dependencies before retrying.</p>}
                      </div>}
                      {out && (
                        <div className="mt-2 text-sm text-slate-600">
                          Confidence {Math.round(out.confidence * 100)}%
                          {out.retryCount > 0 && " · retried"}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

      {!busy && outputs.length > 0 && (
        <ApprovalBar
          approveLabel="Open review"
          onApprove={() => goTo("review")}
        />
      )}
    </div>
  );
}

export function ReviewScreen() {
  const {
    outputs,
    reviews,
    tasks,
    approveOutputs, approveOutput, requestRevision, busy, staleTaskIds, goTo,
  } = useProjectStore();
  const allApproved = tasks.length > 0 && tasks.every((t) => t.state === "completed" && outputs.some((o) => o.taskId === t.id && o.approved === "approved"));
  const hasRevision = outputs.some((o) => o.approved === "rejected");
  const incomplete = tasks.some((t) => t.state !== "completed") || staleTaskIds.length > 0;

  return (
    <div className="max-w-4xl">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl text-slate-900">Review outputs</h1>
      <p className="mt-3 text-base leading-relaxed text-slate-600">
        Review Agent checks missing pieces and consistency. Approve before
        revisions or the final plan.
      </p>

      <div className="mt-4 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-900">
        Review complete — no conflicts found.
      </div>

      <p className="mt-4 font-medium" aria-live="polite">Approved: {outputs.filter((o) => o.approved === "approved").length} · Pending: {outputs.filter((o) => o.approved === "pending").length} · Needs revision: {outputs.filter((o) => o.approved === "rejected").length}</p>
      {incomplete && <div className="mt-4 rounded-xl bg-amber-50 p-4"><p>Finish failed, blocked, or outdated tasks before continuing.</p><button type="button" className="mt-2 underline" onClick={() => goTo("board")}>Return to agent board</button></div>}
      <ul className="mt-6 space-y-3">
        {outputs.map((o) => {
          const task = tasks.find((t) => t.id === o.taskId);
          const review = reviews.find((r) => r.outputId === o.id);
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
                      review.result === "pass"
                        ? "bg-emerald-100 text-emerald-800"
                        : review.result === "conflict"
                          ? "bg-amber-100 text-amber-900"
                          : "bg-amber-100 text-amber-900"
                    }`}
                  >
                    {review.result === "pass" ? "Pass" : review.result === "conflict" ? "Needs attention" : "Flagged"}
                  </span>
                )}
              </div>
              <p className={`mt-3 font-semibold ${o.approved === "approved" ? "text-teal-800" : "text-amber-900"}`}>Human review: {o.approved === "approved" ? "Approved" : o.approved === "rejected" ? "Needs revision" : "Pending review"}</p>
              <p className="mt-2 text-base leading-relaxed text-slate-700">{o.summary}</p>
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
                      <p>Review notes: {review.conflicts.join("; ")}</p>
                    )}
                    {review.suggestions.length > 0 && (
                      <p>Suggestions: {review.suggestions.join("; ")}</p>
                    )}
                  </div>
                )}
              <div className="mt-4 flex flex-wrap gap-3">
                <button type="button" disabled={busy || staleTaskIds.includes(o.taskId) || task?.state !== "completed"} onClick={() => approveOutput(o.id)} className={`rounded-xl border px-4 py-2 font-semibold ${o.approved === "approved" ? "border-teal-700 bg-teal-700 text-white" : "border-slate-300 bg-white text-slate-700"}`}>Approve output</button>
                <button type="button" disabled={busy || staleTaskIds.length > 0 || task?.state !== "completed"} onClick={() => requestRevision(o.id)} className={`rounded-xl border px-4 py-2 font-semibold ${o.approved === "rejected" ? "border-teal-700 bg-teal-700 text-white" : "border-slate-300 bg-white text-slate-700"}`}>Request revision</button>
              </div>
              {review && review.result !== "pass" && <p className="mt-2 text-sm text-amber-900">Review findings remain visible. Approve only if you explicitly accept these limitations, or request revision.</p>}
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

  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl text-slate-900">Feedback / revision</h1>
      <p className="mt-3 text-base leading-relaxed text-slate-600">
        Tell the Manager what to change. Affected tasks are updated only after this
        checkpoint.
      </p>

      <fieldset disabled={busy} className="mt-5 space-y-3 rounded-xl border border-slate-200 p-4">
        <legend className="px-1 font-semibold">Choose outputs to revise</legend>
        <p className="text-sm text-slate-600">Only selected outputs will change. Other output approvals are preserved. Select dependent outputs too if your change affects them.</p>
        {tasks.filter((t) => outputs.some((o) => o.taskId === t.id)).map((t) => <label key={t.id} className="flex items-start gap-3">
          <input type="checkbox" className="mt-1 size-4 shrink-0 accent-teal-700" checked={revisionTaskIds.includes(t.id)} onChange={(e) => selectRevisionTasks(e.target.checked ? [...revisionTaskIds, t.id] : revisionTaskIds.filter((id) => id !== t.id))} />
          <span>{taskLabel(t)} — {AGENT_LABELS[t.ownerAgent]}</span>
        </label>)}
      </fieldset>
      <div aria-live="polite" className="mt-4 rounded-xl bg-teal-50 p-4 text-teal-900">
        {revisionTaskIds.length ? <><p>Your feedback will send these outputs back for revision:</p><ul className="mt-2 list-disc pl-5">{tasks.filter((t) => revisionTaskIds.includes(t.id)).map((t) => <li key={t.id}>{taskLabel(t)} → {AGENT_LABELS[t.ownerAgent]}</li>)}</ul></> : <p>Select at least one output to revise, or skip revisions if all outputs are approved.</p>}
      </div>
      <textarea
        disabled={busy}
        aria-label="Feedback for the Manager Agent"
        value={text}
        onChange={(e) => setText(e.target.value)}
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

      <ApprovalBar
        approveLabel={busy ? "Revising…" : "Apply feedback"}
        secondaryLabel={ready ? "Skip revisions & finalize approved plan" : "Skip revisions & return to review"}
        disabled={busy || !text.trim() || !revisionTaskIds.length}
        secondaryDisabled={busy}
        onApprove={() => void submitFeedback(text)}
        onSecondary={skipFeedback}
        hint={busy ? "Wait for the revision to finish." : "Select outputs and describe the change to apply feedback. Skipping never approves pending or revised work."}
      />
    </div>
  );
}

export function FinalScreen() {
  const store = useProjectStore();
  const { project, requirements, tasks, outputs, reviews, metrics, reset } = store;
  const approvedOutputs = outputs.filter((o) => o.approved === "approved");
  if (!outputsReady(store) || project.status !== "complete") return <p role="alert">Complete all approval checkpoints before viewing or exporting the final plan.</p>;

  const approvedReqs = requirements.filter((r) => r.approvalStatus === "approved");

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl text-slate-900">Final project plan</h1>
      <p className="mt-3 text-base leading-relaxed text-slate-600">
        Packaged output for reviewers or your next coding sprint. No automatic
        deployment.
      </p>

      <button type="button" className="mt-5 rounded-xl bg-teal-700 px-5 py-3 font-semibold text-white" onClick={() => downloadPlan(store)}>Download Markdown</button>
      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-slate-900">Project summary</h2>
        <p className="mt-2 font-semibold">{project.title}</p>
        <p className="mt-1 text-base leading-relaxed text-slate-700">{project.description}</p>
        <p className="mt-2 text-sm text-slate-500">
          Users: {project.targetUser} · Status: {project.status}
        </p>
      </section>

      <section className="mt-4">
        <h2 className="text-lg font-semibold text-slate-900">
          Approved requirements
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-base leading-relaxed text-slate-800">
          {approvedReqs.map((r) => (
            <li key={r.id}>{r.text}</li>
          ))}
        </ul>
      </section>

      <section className="mt-4">
        <h2 className="text-lg font-semibold text-slate-900">
          Ordered task plan
        </h2>
        <ol className="mt-2 space-y-2">
          {tasks.map((t) => {
            return (
              <li
                key={t.id}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
              >
                <div className="font-medium text-slate-900">
                  {t.order}. {t.title}{" "}
                  <span className="text-sm font-normal text-slate-500">
                    ({AGENT_LABELS[t.ownerAgent]})
                  </span>
                </div>
                <p className="mt-2">{t.description}</p>
                <p className="mt-2 text-sm text-slate-600">Depends on: {t.dependencies.map((id) => { const d = tasks.find((x) => x.id === id); return d ? taskLabel(d) : id; }).join("; ") || "No prerequisites"}</p>
                <p className="mt-2 text-sm text-slate-600">Expected output: {t.expectedOutput}</p>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-semibold">Approved agent outputs</h2>
        <ul className="mt-3 space-y-4">{approvedOutputs.map((o) => {
          const task = tasks.find((t) => t.id === o.taskId)!;
          const review = reviews.find((r) => r.outputId === o.id);
          return <li key={o.id} className="rounded-xl border border-slate-200 p-4">
            <h3 className="font-semibold">{taskLabel(task)} · Approved</h3><p className="mt-2">{o.summary}</p>
            <p className="mt-2 text-sm">Assumptions: {o.assumptions.join("; ")}</p>
            <p className="mt-2 text-sm">Next steps: {o.nextSteps.join("; ")}</p>
            <p className="mt-2 text-sm">Blockers: {o.blockers.join("; ") || "None"} · Confidence: {Math.round(o.confidence * 100)}%</p>
            {review && <p className="mt-2 text-sm text-amber-900">Review findings: {[...review.missingItems, ...review.conflicts, ...review.suggestions].join("; ") || "No findings"}</p>}
          </li>;
        })}</ul>
      </section>
      {([ ["testing", "Testing / acceptance information"], ["documentation", "Documentation information"]] as const).map(([role, title]) => {
        const items = approvedOutputs.filter((o) => tasks.find((t) => t.id === o.taskId)?.ownerAgent === role);
        return items.length > 0 && <section key={role} className="mt-6"><h2 className="text-lg font-semibold">{title}</h2>{items.map((o) => <p key={o.id} className="mt-2">{o.summary}</p>)}</section>;
      })}
      <h2 className="mt-6 text-lg font-semibold">Evaluation metrics</h2>
      <p className="mt-2 text-sm text-slate-600">Counts reflect this planning session; usefulness is your rating. Planning time saved is an estimate, not a measured result.</p>
      <section className="mt-4 grid gap-2 sm:grid-cols-3">
        <MetricChip
          label="Acceptance"
          value={`${metrics.userAcceptanceRate}%`}
        />
        <MetricChip label="Revisions" value={String(metrics.numberOfRevisions)} />
        <MetricChip
          label="Usefulness"
          value={`${metrics.usefulnessScore}/10`}
        />
        <MetricChip
          label="Tasks complete"
          value={`${metrics.taskCompletionRate}%`}
        />
        <MetricChip label="Review issue rate" value={`${metrics.conflictRate}%`} />
        <MetricChip
          label="Estimated planning time saved"
          value={`Estimate: ${metrics.planningTimeSavedMinutes} minutes`}
        />
      </section>


      <p className="mt-4 text-sm text-slate-500">
        Reviews logged: {reviews.length}. Planning support only; no repository writes or deployment.
        This session is not saved across page refreshes. Download Markdown to keep the final plan.
      </p>

      <ApprovalBar
        approveLabel="Start another project"
        onApprove={reset}
      />
    </div>
  );
}

function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
      <div className="text-sm uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="font-mono text-sm font-semibold text-slate-900">{value}</div>
    </div>
  );
}
