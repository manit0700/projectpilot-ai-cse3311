"use client";

import { useId } from "react";
import { cooldownLine, useStoreExt, usageLine } from "@/components/store-ext";
import { WORKFLOW_STEPS } from "@/lib/agents";
import { useProjectStore } from "@/lib/store";
import { frontier, outputsReady } from "@/lib/workflow";
import type { WorkflowStep } from "@/lib/types";

const stepIndex = (id: WorkflowStep) =>
  WORKFLOW_STEPS.findIndex((s) => s.id === id);

export function WorkflowStepper() {
  const store = useProjectStore();
  const { currentStep, canNavigate, goTo, busy } = store;
  const reached = frontier(store);
  const active = stepIndex(currentStep);
  const helpId = useId();

  const stepList = (
    <ol className="relative grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8 lg:gap-1 lg:before:absolute lg:before:left-[6%] lg:before:right-[6%] lg:before:top-5 lg:before:h-px lg:before:bg-violet-300 dark:lg:before:bg-violet-800">
      {WORKFLOW_STEPS.map((step, i) => {
        const done = i < reached && (step.id !== "review" || outputsReady(store)) && (step.id !== "board" || store.tasks.every((t) => t.state === "completed"));
        const current = i === active;
        const available = canNavigate(step.id);
        const status = current ? "Current" : done ? "Completed" : available ? "Available" : "Upcoming";
        return (
          <li key={step.id} className="relative z-10 min-w-0">
            <button type="button" aria-current={current ? "step" : undefined}
              aria-label={`${step.label} — ${status}`} disabled={!available || current}
              aria-describedby={!available && !current ? helpId : undefined}
              onClick={() => goTo(step.id)}
              className={`flex min-h-11 w-full items-center gap-2 rounded-full px-2 py-1.5 text-left transition focus-visible:outline-offset-2 disabled:cursor-not-allowed lg:justify-center ${
              current
                ? "bg-gradient-to-r from-violet-700 to-purple-600 pr-4 text-white shadow-[0_7px_20px_rgba(109,40,217,0.28)]"
                : done
                  ? "text-violet-950 hover:bg-violet-100 dark:text-violet-100 dark:hover:bg-violet-950"
                  : available ? "text-slate-800 hover:bg-white/70 dark:text-slate-200 dark:hover:bg-white/5" : "text-slate-600 dark:text-slate-400"
            }`}
          >
            <span aria-hidden="true" className={`flex size-9 shrink-0 items-center justify-center rounded-full border text-sm font-bold ${current ? "border-white/30 bg-white/15 text-white" : done ? "border-violet-600 bg-violet-100 text-violet-800 dark:border-violet-400 dark:bg-violet-950 dark:text-violet-200" : "border-violet-300 bg-white text-slate-700 dark:border-violet-800 dark:bg-slate-950 dark:text-slate-300"}`}>{i + 1}</span>
            <span className="block break-words text-sm font-semibold lg:max-w-[6.5rem]">{step.label}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );

  return (
    <nav aria-label="Project workflow">
      <div className="flex flex-wrap items-center justify-between gap-2 sm:mb-3">
        <p className="sr-only text-sm font-semibold text-slate-800 sm:not-sr-only dark:text-slate-100" aria-live="polite">
          Step {active + 1} of {WORKFLOW_STEPS.length} · {WORKFLOW_STEPS[active]?.label}
        </p>
        <p id={helpId} className={`text-sm text-slate-600 dark:text-slate-300 ${busy ? "" : "hidden sm:block"}`}>{busy ? "Assigned agents are working. Navigation pauses until they finish." : "Revisit available steps. Upcoming steps unlock after the current approval."}</p>
      </div>
      <details className="sm:hidden">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-slate-800 dark:text-slate-100 [&::-webkit-details-marker]:hidden"><span aria-hidden="true">Step {active + 1} of {WORKFLOW_STEPS.length} · {WORKFLOW_STEPS[active]?.label}</span><span className="text-violet-700 underline underline-offset-2 dark:text-violet-300">Show all steps</span></summary>
        <div className="mt-3">{stepList}</div>
      </details>
      <div className="hidden sm:block">{stepList}</div>
    </nav>
  );
}

export function ManagerPanel({ variant = "default" }: { variant?: "default" | "purple" }) {
  const { managerNotes, busy, busyLabel } = useProjectStore();
  const { usage, stopRun, providerCooldowns } = useStoreExt();
  const usageText = usageLine(usage);
  const cooldownText = cooldownLine(providerCooldowns);
  const questionsTheme = variant === "purple";

  return (
    <aside aria-labelledby="manager-log-title" className={`flex min-w-0 flex-col overflow-hidden bg-white dark:bg-slate-950 ${questionsTheme ? "rounded-[1.75rem] border border-violet-200/90 shadow-[0_14px_38px_rgba(91,33,182,0.09)] dark:border-violet-900" : "rounded-2xl border-2 border-teal-200 shadow-md dark:border-teal-800"}`}>
      <div className={questionsTheme ? "border-b border-violet-100 bg-gradient-to-r from-violet-50 to-purple-50/60 px-5 py-4 dark:border-violet-900 dark:from-violet-950/60 dark:to-purple-950/30" : "border-b border-teal-100 bg-teal-50 px-5 py-4 dark:bg-teal-950/50"}>
        <div className="flex items-center justify-between gap-2">
          <h2 id="manager-log-title" className={`flex items-center gap-2 text-xl font-semibold tracking-tight ${questionsTheme ? "text-violet-950 dark:text-violet-100" : "text-teal-950 dark:text-teal-50"}`}>
            {questionsTheme && <span className="flex size-8 items-center justify-center rounded-lg bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-200" aria-hidden="true"><svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 5h14v11H8l-3 3V5Z" strokeLinecap="round" strokeLinejoin="round" /></svg></span>}
            Manager Agent log
          </h2>
          <span className={`rounded-full bg-white px-2 py-0.5 font-mono text-xs dark:bg-slate-950 ${questionsTheme ? "text-violet-800 ring-1 ring-violet-200 dark:text-violet-200 dark:ring-violet-800" : "text-teal-900 dark:text-teal-100"}`}>{managerNotes.length}</span>
        </div>
        <p className={`mt-2 text-sm leading-relaxed ${questionsTheme ? "text-violet-900/80 dark:text-violet-200" : "text-teal-900 dark:text-teal-100"}`}>
          Decisions and handoffs, newest first. Nothing here changes without your approval.
        </p>
      </div>
      {usageText && <p className="mx-4 mt-3 rounded border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200">{usageText}</p>}
      {cooldownText && <p role="status" className="mx-4 mt-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-100">{cooldownText}</p>}
      {busy && (
        <div role="status" className="mx-4 mt-3 flex flex-wrap items-center justify-between gap-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-100">
          <span>{busyLabel || "Working…"}</span>
          {typeof stopRun === "function" && <button type="button" onClick={stopRun} className="min-h-11 rounded-lg border border-rose-400 px-3 font-semibold text-rose-800 hover:bg-rose-50 dark:text-rose-300">Stop</button>}
        </div>
      )}
      <div role="region" aria-label="Manager notes log" tabIndex={0} className={questionsTheme ? "max-h-[34rem] overflow-y-auto" : "max-h-[32rem] overflow-y-auto"}>
      <ol aria-live="polite" aria-label="Manager notes, newest first" className={`p-5 ${questionsTheme ? "relative space-y-0 before:absolute before:bottom-7 before:left-[1.7rem] before:top-7 before:w-px before:bg-violet-200 dark:before:bg-violet-800" : "space-y-3"}`}>
        {managerNotes.length === 0 && (
          <li className="text-sm text-slate-600 dark:text-slate-300">
            Start a project to see manager decisions here.
          </li>
        )}
        {managerNotes.map((note, i) => (
          <li
            key={note.id}
            className={questionsTheme
              ? `relative ml-4 border-b border-violet-100 py-4 pl-4 text-sm leading-relaxed text-slate-700 last:border-b-0 dark:border-violet-900 dark:text-slate-200 before:absolute before:-left-[1.3rem] before:top-[1.35rem] before:size-2.5 before:rounded-full before:border-2 before:border-white dark:before:border-slate-950 ${i === 0 ? "before:bg-violet-600" : "before:bg-violet-300 dark:before:bg-violet-700"}`
              : `rounded-xl border p-4 text-sm leading-relaxed text-slate-700 dark:text-slate-200 ${i === 0 ? "border-teal-300 bg-teal-50/60 dark:border-teal-700" : "border-slate-200 bg-slate-50 dark:bg-slate-900 dark:border-slate-700"}`}
          >
            <div className="mb-1 flex flex-wrap justify-between gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              <span>{i === 0 ? "Latest · " : ""}{note.step}</span>
              <span>{note.at}</span>
            </div>
            {note.message}
          </li>
        ))}
      </ol>
      </div>
    </aside>
  );
}

export function MetricsPanel({ variant = "default" }: { variant?: "default" | "purple" }) {
  const { metrics, setUsefulness, currentStep } = useProjectStore();
  if (currentStep === "idea") return null;
  const rated = metrics.usefulnessScore !== null;
  const questionsTheme = variant === "purple";

  const items = [
    { label: "Acceptance", value: `${metrics.userAcceptanceRate}%` },
    { label: "Revisions", value: String(metrics.numberOfRevisions) },
    { label: "Tasks complete", value: `${metrics.taskCompletionRate}%` },
    { label: "Review issues", value: `${metrics.conflictRate}%` },
    { label: "Planning time (measured)", value: `${metrics.planningElapsedMinutes} min` },
  ];

  return (
    <section aria-labelledby="planning-metrics-title" className={questionsTheme ? "rounded-[1.75rem] border border-violet-200/90 bg-gradient-to-br from-white to-violet-50/60 p-5 shadow-[0_14px_38px_rgba(91,33,182,0.09)] dark:border-violet-900 dark:from-slate-950 dark:to-violet-950/30" : "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:bg-slate-950 dark:border-slate-700"}>
      <div className={`flex flex-wrap items-center justify-between gap-2 ${questionsTheme ? "mb-4" : "mb-2"}`}>
        <h2 id="planning-metrics-title" className={`flex items-center gap-2 font-semibold ${questionsTheme ? "text-lg text-violet-950 dark:text-violet-100" : "text-sm text-slate-700 dark:text-slate-200"}`}>
          {questionsTheme && <span className="flex size-8 items-center justify-center rounded-lg bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-200" aria-hidden="true"><svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 19V9M12 19V5M19 19v-7" /></svg></span>}
          Planning metrics
        </h2>
        <label className={`flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-slate-300 ${questionsTheme ? "w-full" : ""}`}>
          Usefulness
          <input
            type="range"
            min={1}
            max={10}
            value={metrics.usefulnessScore ?? 5}
            onChange={(e) => setUsefulness(Number(e.target.value))}
            aria-describedby="usefulness-help"
            aria-valuetext={rated ? `${metrics.usefulnessScore} of 10` : "Not rated"}
            className={`min-h-6 ${questionsTheme ? "min-w-0 flex-1 accent-violet-700" : "accent-teal-700"}`}
          />
          <span className={`font-mono ${rated ? "w-6 text-slate-900 dark:text-slate-50" : "text-slate-600 dark:text-slate-300"}`}>
            {rated ? metrics.usefulnessScore : "Not rated"}
          </span>
        </label>
      </div>
      <p id="usefulness-help" className={`mb-4 text-slate-600 dark:text-slate-300 ${questionsTheme ? "text-xs leading-relaxed" : "text-sm"}`}>Usefulness is your rating from 1 (not useful) to 10 (very useful); it shows “Not rated” until you move the slider. It is saved with this session and included in export. It does not affect agent decisions, approvals or navigation. Planning time is measured from when the project started.</p>
      <div className={`grid grid-cols-2 gap-3 ${questionsTheme ? "" : "md:grid-cols-5"}`}>
        {items.map((item) => (
          <div
            key={item.label}
            className={questionsTheme ? "rounded-xl border border-violet-100 bg-white/80 p-3 dark:border-violet-900 dark:bg-slate-950/70" : "rounded-xl border border-slate-200 bg-slate-50 p-3 dark:bg-slate-900 dark:border-slate-700"}
          >
            <div className={`text-slate-600 dark:text-slate-300 ${questionsTheme ? "text-xs leading-snug" : "text-sm"}`}>
              {item.label}
            </div>
            <div className={`font-mono font-semibold text-slate-900 dark:text-white ${questionsTheme ? "mt-1 text-lg text-violet-950 dark:text-violet-100" : "text-xl"}`}>
              {item.value}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ApprovalBar({
  onApprove,
  onSecondary,
  approveLabel = "Approve & continue",
  secondaryLabel,
  secondaryDisabled,
  disabled,
  hint,
  variant = "default",
}: {
  onApprove: () => void;
  onSecondary?: () => void;
  approveLabel?: string;
  secondaryLabel?: string;
  secondaryDisabled?: boolean;
  disabled?: boolean;
  hint?: string;
  variant?: "default" | "purple";
}) {
  const hintId = useId();
  const questionsTheme = variant === "purple";

  return (
    <div className={`mt-4 flex flex-wrap items-center gap-3 border-t pt-4 sm:mt-8 sm:pt-6 ${questionsTheme ? "justify-between border-violet-100 dark:border-violet-900" : "border-slate-200 dark:border-slate-700"}`}>
      {questionsTheme && onSecondary && secondaryLabel && (
        <button
          type="button"
          aria-describedby={hint ? hintId : undefined}
          disabled={secondaryDisabled}
          onClick={onSecondary}
          className="min-h-12 rounded-xl border border-violet-300 bg-white px-5 py-3 font-semibold text-violet-800 transition hover:border-violet-400 hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-violet-800 dark:bg-slate-950 dark:text-violet-200 dark:hover:bg-violet-950"
        >
          {secondaryLabel}
        </button>
      )}
      <button
        type="button"
        aria-describedby={hint ? hintId : undefined}
        disabled={disabled}
        data-primary-action=""
        onClick={onApprove}
        className={questionsTheme ? "min-h-12 rounded-xl bg-gradient-to-r from-violet-700 to-purple-600 px-6 py-3 text-base font-bold text-white shadow-[0_10px_24px_rgba(109,40,217,0.26)] transition hover:from-violet-800 hover:to-purple-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none max-sm:w-full" : "min-h-11 w-full rounded-xl bg-teal-700 px-5 py-3 text-base font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"}
      >
        {approveLabel}
      </button>
      {!questionsTheme && onSecondary && secondaryLabel && (
        <button
          type="button"
          aria-describedby={hint ? hintId : undefined}
          disabled={secondaryDisabled}
          onClick={onSecondary}
          className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-5 py-3 text-base sm:w-auto font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-950 dark:border-slate-600 dark:text-slate-200"
        >
          {secondaryLabel}
        </button>
      )}
      {hint && <p id={hintId} className="w-full text-sm text-slate-600 dark:text-slate-300">{hint}</p>}
    </div>
  );
}

export function BottomNavigation() {
  const { currentStep, canNavigate, goTo, busy } = useProjectStore();
  const i = WORKFLOW_STEPS.findIndex((s) => s.id === currentStep);
  const previous = WORKFLOW_STEPS[i-1], next = WORKFLOW_STEPS[i+1];
  const previousDisabled = busy || !previous || !canNavigate(previous.id);
  const nextDisabled = busy || !next || !canNavigate(next.id);
  const helpId = useId();
  const reason = busy ? "Navigation pauses while agents are running." : !next ? "This is the last step." : nextDisabled ? `Complete the current approval to unlock ${next.label}.` : "Both directions are available. Going back never discards work.";
  return <nav aria-label="Bottom workflow navigation" className="mt-8 flex flex-wrap items-center gap-4 border-t border-slate-200 pt-5 dark:border-slate-700">
    <button type="button" disabled={previousDisabled} aria-describedby={previousDisabled ? helpId : undefined} onClick={() => previous && goTo(previous.id)} className="min-h-11 rounded-xl border border-slate-300 px-4 py-3 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600">Previous step</button>
    <button type="button" disabled={nextDisabled} aria-describedby={nextDisabled ? helpId : undefined} onClick={() => next && goTo(next.id)} className="min-h-11 rounded-xl border border-slate-300 px-4 py-3 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600">Next step</button>
    <p id={helpId} className="text-sm text-slate-600 dark:text-slate-300">Step {i+1} of {WORKFLOW_STEPS.length}. {reason}</p>
  </nav>;
}
