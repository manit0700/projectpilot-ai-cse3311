"use client";

import { ApprovalBar } from "@/components/shell";
import { AGENT_LABELS } from "@/lib/agents";
import { useProjectStore } from "@/lib/store";
import type { AgentRole, TaskState } from "@/lib/types";
import { useState } from "react";

const COLUMNS: { state: TaskState; label: string }[] = [
  { state: "blocked", label: "Blocked" },
  { state: "queued", label: "Queued" },
  { state: "in_progress", label: "In progress" },
  { state: "completed", label: "Completed" },
  { state: "needs_revision", label: "Needs revision" },
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
  const { tasks, agents, outputs, busy, busyLabel, goTo } = useProjectStore();

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Agent assignment board</h1>
      <p className="mt-1 text-sm text-slate-600">
        {busy
          ? busyLabel
          : "Specialists work from shared context. Failed timeouts retry once."}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {agents
          .filter((a) => a.role !== "manager")
          .map((a) => (
            <span
              key={a.id}
              className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700"
            >
              <span className="font-semibold">{AGENT_LABELS[a.role]}</span>
              <span className="ml-2 text-slate-400">{a.availability}</span>
            </span>
          ))}
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-3 xl:grid-cols-5">
        {COLUMNS.map((col) => {
          const colTasks = tasks.filter((t) => t.state === col.state);
          return (
            <div
              key={col.state}
              className="min-h-48 rounded border border-slate-200 bg-slate-50 p-2"
            >
              <div className="mb-2 flex items-center justify-between px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <span>{col.label}</span>
                <span className="font-mono">{colTasks.length}</span>
              </div>
              <ul className="space-y-2">
                {colTasks.map((t) => {
                  const out = outputs.find((o) => o.taskId === t.id);
                  return (
                    <li
                      key={t.id}
                      className={`rounded border border-slate-200 border-l-4 bg-white p-2.5 shadow-sm ${ROLE_COLOR[t.ownerAgent] ?? "border-l-slate-400"}`}
                    >
                      <div className="text-sm font-medium text-slate-900">
                        {t.title}
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-500">
                        {AGENT_LABELS[t.ownerAgent]}
                      </div>
                      {out && (
                        <div className="mt-2 text-[11px] text-slate-600">
                          conf {Math.round(out.confidence * 100)}%
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
    conflictSummary,
    approveOutputs,
  } = useProjectStore();

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-semibold text-slate-900">Review outputs</h1>
      <p className="mt-1 text-sm text-slate-600">
        Review Agent checks missing pieces, conflicts, and consistency. Approve
        before revisions or final plan.
      </p>

      {conflictSummary && (
        <div className="mt-4 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
          {conflictSummary}
        </div>
      )}

      <ul className="mt-6 space-y-3">
        {outputs.map((o) => {
          const task = tasks.find((t) => t.id === o.taskId);
          const review = reviews.find((r) => r.outputId === o.id);
          return (
            <li
              key={o.id}
              className="rounded border border-slate-200 bg-white p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-900">
                  {task?.title ?? o.taskId}
                </h3>
                <span className="text-xs text-slate-500">
                  {task ? AGENT_LABELS[task.ownerAgent] : ""}
                </span>
                {review && (
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                      review.result === "pass"
                        ? "bg-emerald-100 text-emerald-800"
                        : review.result === "conflict"
                          ? "bg-rose-100 text-rose-800"
                          : "bg-amber-100 text-amber-900"
                    }`}
                  >
                    {review.result}
                  </span>
                )}
              </div>
              <p className="mt-2 text-sm text-slate-700">{o.summary}</p>
              <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
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
                  <div className="mt-3 rounded bg-slate-50 p-2 text-xs text-slate-700">
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
              <div className="mt-2 font-mono text-[11px] text-slate-400">
                confidence {o.confidence} · blockers{" "}
                {o.blockers.length ? o.blockers.join("; ") : "none"}
              </div>
            </li>
          );
        })}
      </ul>

      <ApprovalBar
        approveLabel="Approve outputs → feedback"
        onApprove={approveOutputs}
        hint="Invalid or conflicting outputs stay flagged until you accept or revise."
      />
    </div>
  );
}

export function FeedbackScreen() {
  const { submitFeedback, skipFeedback, busy, feedbackItems } =
    useProjectStore();
  const [text, setText] = useState("");

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold text-slate-900">Feedback / revision</h1>
      <p className="mt-1 text-sm text-slate-600">
        Tell the Manager what to change. Affected tasks are updated only after this
        checkpoint.
      </p>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        placeholder="e.g. Expand the UI screens list and add auth edge cases to the API plan"
        className="mt-6 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none ring-teal-700/30 focus:ring-2"
      />

      {feedbackItems.length > 0 && (
        <ul className="mt-4 space-y-2">
          {feedbackItems.map((f) => (
            <li
              key={f.id}
              className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700"
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
        secondaryLabel="Skip to final plan"
        disabled={busy || !text.trim()}
        onApprove={() => void submitFeedback(text)}
        onSecondary={skipFeedback}
      />
    </div>
  );
}

export function FinalScreen() {
  const {
    project,
    requirements,
    tasks,
    outputs,
    reviews,
    metrics,
    reset,
    conflictSummary,
  } = useProjectStore();

  const approvedReqs = requirements.filter((r) => r.approvalStatus === "approved");

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold text-slate-900">Final project plan</h1>
      <p className="mt-1 text-sm text-slate-600">
        Packaged output for demo, graders, or your next coding sprint. No automatic
        deployment.
      </p>

      <section className="mt-6 rounded border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">{project.title}</h2>
        <p className="mt-1 text-sm text-slate-700">{project.description}</p>
        <p className="mt-2 text-xs text-slate-500">
          Users: {project.targetUser} · Status: {project.status}
        </p>
      </section>

      <section className="mt-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Approved requirements
        </h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-800">
          {approvedReqs.map((r) => (
            <li key={r.id}>{r.text}</li>
          ))}
        </ul>
      </section>

      <section className="mt-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Ordered tasks & agent outputs
        </h3>
        <ol className="mt-2 space-y-2">
          {tasks.map((t) => {
            const out = outputs.find((o) => o.taskId === t.id);
            return (
              <li
                key={t.id}
                className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
              >
                <div className="font-medium text-slate-900">
                  {t.order}. {t.title}{" "}
                  <span className="text-xs font-normal text-slate-500">
                    ({AGENT_LABELS[t.ownerAgent]})
                  </span>
                </div>
                {out && (
                  <p className="mt-1 text-xs text-slate-600">{out.summary}</p>
                )}
              </li>
            );
          })}
        </ol>
      </section>

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
        <MetricChip label="Conflict rate" value={`${metrics.conflictRate}%`} />
        <MetricChip
          label="Time saved"
          value={`~${metrics.planningTimeSavedMinutes} min`}
        />
      </section>

      {conflictSummary && (
        <p className="mt-4 text-xs text-rose-700">{conflictSummary}</p>
      )}

      <p className="mt-4 text-xs text-slate-500">
        Reviews logged: {reviews.length}. Deployment and repository writes remain
        human-gated.
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
    <div className="rounded border border-slate-200 bg-white px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="font-mono text-sm font-semibold text-slate-900">{value}</div>
    </div>
  );
}
