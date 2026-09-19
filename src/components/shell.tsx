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
    <nav aria-label="Workflow steps" className="overflow-x-auto">
      <ol className="flex min-w-max gap-1">
        {WORKFLOW_STEPS.map((step, i) => {
          const done = i < active;
          const current = i === active;
          return (
            <li key={step.id} className="flex items-center gap-1">
              <div
                className={`rounded px-2.5 py-1.5 text-xs font-medium tracking-wide ${
                  current
                    ? "bg-teal-700 text-white"
                    : done
                      ? "bg-slate-200 text-slate-800"
                      : "bg-slate-100 text-slate-500"
                }`}
              >
                <span className="mr-1 opacity-70">{i + 1}.</span>
                {step.label}
              </div>
              {i < WORKFLOW_STEPS.length - 1 && (
                <span className="px-0.5 text-slate-300" aria-hidden>
                  →
                </span>
              )}
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
    <aside className="flex h-full flex-col border-l border-slate-200 bg-slate-50">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">Manager reasoning</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Shared context updates from the Manager Agent
        </p>
      </div>
      {busy && (
        <div className="mx-4 mt-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {busyLabel || "Working…"}
        </div>
      )}
      <ul className="flex-1 space-y-2 overflow-y-auto p-4">
        {managerNotes.length === 0 && (
          <li className="text-xs text-slate-500">
            Start a project to see manager decisions here.
          </li>
        )}
        {managerNotes.map((note) => (
          <li
            key={note.id}
            className="rounded border border-slate-200 bg-white px-3 py-2 text-xs leading-relaxed text-slate-700"
          >
            <div className="mb-1 flex justify-between gap-2 text-[10px] uppercase tracking-wide text-slate-400">
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
    { label: "Task done", value: `${metrics.taskCompletionRate}%` },
    { label: "Conflicts", value: `${metrics.conflictRate}%` },
    { label: "Time saved", value: `${metrics.planningTimeSavedMinutes}m` },
  ];

  return (
    <section className="border-t border-slate-200 bg-white px-4 py-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Evaluation metrics
        </h2>
        <label className="flex items-center gap-2 text-xs text-slate-600">
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
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {items.map((item) => (
          <div
            key={item.label}
            className="rounded border border-slate-200 bg-slate-50 px-2.5 py-2"
          >
            <div className="text-[10px] uppercase tracking-wide text-slate-500">
              {item.label}
            </div>
            <div className="font-mono text-sm font-semibold text-slate-900">
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
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-950">
      <strong className="font-semibold">Privacy:</strong> Do not paste API keys or
      secrets. Warn before uploading sensitive code. Repo changes and deployment
      require your approval — automatic deployment is disabled in this MVP.
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
    <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-slate-200 pt-4">
      <button
        type="button"
        disabled={disabled}
        onClick={onApprove}
        className="rounded bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {approveLabel}
      </button>
      {onSecondary && secondaryLabel && (
        <button
          type="button"
          onClick={onSecondary}
          className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          {secondaryLabel}
        </button>
      )}
      {hint && <p className="w-full text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
