"use client";

import { WORKFLOW_STEPS } from "@/lib/agents";
import { useProjectStore } from "@/lib/store";
import type { WorkflowStep } from "@/lib/types";

const stepIndex = (id: WorkflowStep) =>
  WORKFLOW_STEPS.findIndex((s) => s.id === id);

export function WorkflowStepper() {
  const { currentStep } = useProjectStore();
  const active = stepIndex(currentStep);

  return (
    <nav aria-label="Project workflow" className="py-2">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-800" aria-live="polite">
          Step {active + 1} of {WORKFLOW_STEPS.length} · {WORKFLOW_STEPS[active]?.label}
        </p>
        <p className="text-sm text-slate-600">Follow each step. You approve the plan.</p>
      </div>
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
        {WORKFLOW_STEPS.map((step, i) => {
          const done = i < active;
          const current = i === active;
          const status = current ? "Current" : done ? "Completed" : "Upcoming";
          return (
            <li
              key={step.id}
              aria-current={current ? "step" : undefined}
              className={`min-w-0 rounded-xl border p-3 ${
                current
                  ? "border-teal-700 bg-teal-700 text-white shadow-sm"
                  : done
                    ? "border-teal-200 bg-teal-50 text-teal-900"
                    : "border-slate-200 bg-slate-50 text-slate-600"
              }`}
            >
              <div className="mb-2 flex items-center gap-2 text-xs font-medium">
                <span aria-hidden="true" className={`flex size-6 shrink-0 items-center justify-center rounded-full ${current ? "bg-white/20" : done ? "bg-teal-100" : "bg-slate-200"}`}>
                  {done ? "✓" : i + 1}
                </span>
                <span>{status}</span>
              </div>
              <span className="block break-words text-sm font-semibold">{step.label}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function ManagerPanel() {
  const { managerNotes, busy, busyLabel } = useProjectStore();

  return (
    <aside className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-lg font-semibold text-slate-900">Manager updates</h2>
        <p className="mt-0.5 text-sm text-slate-600">
          Planning notes from your mock Manager Agent
        </p>
      </div>
      {busy && (
        <div role="status" className="mx-4 mt-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {busyLabel || "Working…"}
        </div>
      )}
      <ul className="max-h-[32rem] space-y-3 overflow-y-auto p-5">
        {managerNotes.length === 0 && (
          <li className="text-sm text-slate-600">
            Start a project to see manager decisions here.
          </li>
        )}
        {managerNotes.map((note) => (
          <li
            key={note.id}
            className="rounded-xl border border-slate-200 bg-white p-4 text-sm leading-relaxed text-slate-700"
          >
            <div className="mb-1 flex flex-wrap justify-between gap-2 text-xs font-medium text-slate-500">
              <span>{note.step}</span>
              <span>{note.at}</span>
            </div>
            {note.message}
          </li>
        ))}
      </ul>
    </aside>
  );
}

export function MetricsPanel() {
  const { metrics, setUsefulness, currentStep } = useProjectStore();
  if (currentStep === "idea") return null;

  const items = [
    { label: "Acceptance", value: `${metrics.userAcceptanceRate}%` },
    { label: "Revisions", value: String(metrics.numberOfRevisions) },
    { label: "Tasks complete", value: `${metrics.taskCompletionRate}%` },
    { label: "Conflicts", value: `${metrics.conflictRate}%` },
    { label: "Time saved (estimate)", value: `${metrics.planningTimeSavedMinutes}m` },
  ];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-700">
          Demo metrics
        </h2>
        <label className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
          Usefulness
          <input
            type="range"
            min={1}
            max={10}
            value={metrics.usefulnessScore}
            onChange={(e) => setUsefulness(Number(e.target.value))}
            className="accent-teal-700"
          />
          <span className="w-6 font-mono text-slate-900">
            {metrics.usefulnessScore}
          </span>
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {items.map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-slate-200 bg-slate-50 p-3"
          >
            <div className="text-sm text-slate-600">
              {item.label}
            </div>
            <div className="font-mono text-xl font-semibold text-slate-900">
              {item.value}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function SecurityBanner() {
  const { sensitiveUploadAck, ackSensitiveUpload } = useProjectStore();

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950">
      <strong className="font-semibold">Privacy:</strong> Do not paste API keys or
      secrets or sensitive code. This prototype uses mock AI responses and does not
      deploy your project.
      {!sensitiveUploadAck && (
        <button
          type="button"
          onClick={ackSensitiveUpload}
          className="ml-2 underline underline-offset-2"
        >
          I understand
        </button>
      )}
      {sensitiveUploadAck && (
        <span className="ml-2 text-amber-800">Acknowledged</span>
      )}
    </div>
  );
}

export function ApprovalBar({
  onApprove,
  onSecondary,
  approveLabel = "Approve & continue",
  secondaryLabel,
  disabled,
  hint,
}: {
  onApprove: () => void;
  onSecondary?: () => void;
  approveLabel?: string;
  secondaryLabel?: string;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-slate-200 pt-6">
      <button
        type="button"
        disabled={disabled}
        onClick={onApprove}
        className="min-h-11 w-full rounded-xl bg-teal-700 px-5 py-3 text-base sm:w-auto font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {approveLabel}
      </button>
      {onSecondary && secondaryLabel && (
        <button
          type="button"
          onClick={onSecondary}
          className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-5 py-3 text-base sm:w-auto font-medium text-slate-700 hover:bg-slate-50"
        >
          {secondaryLabel}
        </button>
      )}
      {hint && <p className="w-full text-sm text-slate-600">{hint}</p>}
    </div>
  );
}
