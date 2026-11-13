"use client";

import { useState } from "react";
import { DeliverableView } from "@/components/deliverable-view";
import { ExportPanel } from "@/components/export-panel";
import { StudioHandoffButton } from "@/components/studio-handoff";
import { ApprovalBar } from "@/components/shell";
import { AGENT_LABELS } from "@/lib/agents";
import { planJson } from "@/lib/export-backup";
import { acceptanceOf, dependencyLabels, isHumanEdited, modelLabel, orderedTasks, outputModel, planSlug, reviewFindings, shortTitle, taskTitle, usefulAssumptions } from "@/lib/export-common";
import { disclosureStatement } from "@/lib/export-disclosure";
import { downloadFile } from "@/lib/export-download";
import { downloadPlan, provenanceLines } from "@/lib/plan-export";
import { useProjectStore } from "@/lib/store";
import { outputsReady } from "@/lib/workflow";

export function FinalScreen() {
  const store = useProjectStore();
  const [confirming, setConfirming] = useState(false);
  const [backedUp, setBackedUp] = useState(false);
  const { project, requirements, outputs, metrics, reset } = store;
  if (!outputsReady(store) || project.status !== "complete") return <p role="alert">Complete all approval checkpoints before viewing or exporting the final plan.</p>;

  const opts = { mode: store.managerMode };
  const approvedReqs = requirements.filter((r) => r.approvalStatus === "approved");
  const title = shortTitle(project);
  const provenance = provenanceLines(store, opts);

  // Backup before the project is cleared: plan.json restores everything, Markdown is the readable copy.
  function downloadBackup() {
    const snapshot = typeof store.exportState === "function" ? store.exportState() : store;
    downloadFile(`${planSlug(snapshot)}-plan.json`, planJson(snapshot, opts), "application/json;charset=utf-8");
    downloadPlan(snapshot, opts);
    setBackedUp(true);
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl text-slate-900">Final project plan</h1>
      <p className="mt-3 text-base leading-relaxed text-slate-600">
        Packaged output for reviewers or your next coding sprint. No automatic
        deployment.
      </p>

      <button type="button" className="mt-5 min-h-11 rounded-xl bg-teal-700 px-5 py-3 font-semibold text-white hover:bg-teal-800" onClick={() => downloadPlan(store, opts)}>Download Markdown</button>
      <ExportPanel className="mt-4" />
      <StudioHandoffButton />
      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <p className="mt-1 whitespace-pre-wrap text-base leading-relaxed text-slate-700">{project.description}</p>
        <p className="mt-2 text-sm text-slate-500">
          Users: {project.targetUser} · Status: {project.status}
        </p>
        <ul className="mt-2 space-y-0.5 text-sm text-slate-600">{provenance.map((line) => <li key={line}>{line}</li>)}</ul>
        <p className="mt-2 text-sm text-slate-700">{disclosureStatement(store, opts)}</p>
      </section>

      <section className="mt-4">
        <h2 className="text-lg font-semibold text-slate-900">
          Approved requirements
        </h2>
        <ul className="mt-2 list-disc space-y-2 pl-5 text-base leading-relaxed text-slate-800">
          {approvedReqs.map((r) => {
            const criteria = acceptanceOf(r);
            return (
              <li key={r.id}>
                {r.text}
                {criteria.length > 0 && <ul className="mt-1 list-[circle] space-y-0.5 pl-5 text-sm text-slate-600">{criteria.map((c, i) => <li key={i}>Acceptance: {c}</li>)}</ul>}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-4">
        <h2 className="text-lg font-semibold text-slate-900">
          Ordered task plan
        </h2>
        <ol className="mt-2 space-y-2">
          {orderedTasks(store).map((t) => (
            <li
              key={t.id}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
            >
              <div className="font-medium text-slate-900">
                {taskTitle(t)}{" "}
                <span className="text-sm font-normal text-slate-500">
                  ({AGENT_LABELS[t.ownerAgent]})
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap">{t.description}</p>
              <p className="mt-2 text-sm text-slate-600">Depends on: {dependencyLabels(store, t).join("; ") || "No prerequisites"}</p>
              <p className="mt-2 text-sm text-slate-600">Expected output: {t.expectedOutput}</p>
              {t.constraints && <p className="mt-2 text-sm text-slate-600">Constraints: {t.constraints}</p>}
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-semibold">Approved agent outputs</h2>
        <ul className="mt-3 space-y-4">{orderedTasks(store).flatMap((task) => {
          const o = outputs.find((x) => x.taskId === task.id && x.approved === "approved");
          if (!o) return [];
          const findings = reviewFindings(store, o);
          const model = outputModel(store, o);
          const assumptions = usefulAssumptions(o);
          return [<li key={o.id}>
            <DeliverableView title={taskTitle(task)} text={o.summary} humanEdited={isHumanEdited(store, o)} badge="Approved">
              <div className="mt-3 space-y-1 border-t border-slate-200 pt-3 text-sm text-slate-700">
                {model && <p>Produced by: {modelLabel(model)}</p>}
                {assumptions.length > 0 && <p>Assumptions: {assumptions.join("; ")}</p>}
                <p>Next steps: {o.nextSteps.join("; ") || "None"}</p>
                <p>Blockers: {o.blockers.join("; ") || "None"} · Confidence: {Math.round(o.confidence * 100)}%</p>
                {findings && <p className="text-amber-900">Review findings: {findings.join("; ") || "No findings"}</p>}
              </div>
            </DeliverableView>
          </li>];
        })}</ul>
      </section>
      <h2 className="mt-6 text-lg font-semibold">Evaluation metrics</h2>
      <p className="mt-2 text-sm text-slate-600">Counts reflect this planning session. Planning time is measured from when the project started. Usefulness is your own rating and stays empty until you rate it.</p>
      <section className="mt-4 grid gap-2 sm:grid-cols-3">
        <MetricChip label="Acceptance" value={`${metrics.userAcceptanceRate}%`} />
        <MetricChip label="Revisions" value={String(metrics.numberOfRevisions)} />
        <MetricChip label="Usefulness" value={metrics.usefulnessScore === null ? "Not rated" : `${metrics.usefulnessScore}/10`} />
        <MetricChip label="Tasks complete" value={`${metrics.taskCompletionRate}%`} />
        <MetricChip label="Review issue rate" value={`${metrics.conflictRate}%`} />
        <MetricChip label="Planning time (measured)" value={`${metrics.planningElapsedMinutes} min`} />
      </section>

      <p className="mt-4 text-sm text-slate-500">
        Reviews logged: {store.reviews.length}. Planning support only; no repository writes or deployment.
        Progress is saved in this browser. Download Markdown or the backup to keep a separate copy of the deliverables.
      </p>

      {confirming ? (
        <section role="alertdialog" aria-labelledby="start-over-title" className="mt-8 rounded-xl border border-amber-300 bg-amber-50 p-4">
          <h2 id="start-over-title" className="text-lg font-semibold text-amber-950">Start another project?</h2>
          <p className="mt-2 text-base text-amber-950">
            This clears the current plan from this browser. {backedUp ? "Your backup was downloaded." : "Download a backup first; it is the only way to get this plan back."}
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button type="button" onClick={downloadBackup} className="min-h-11 rounded-xl border border-slate-400 bg-white px-5 py-3 font-semibold text-slate-900 hover:bg-slate-50">
              {backedUp ? "Download backup again" : "Download backup (plan.json + Markdown)"}
            </button>
            <button type="button" onClick={reset} className="min-h-11 rounded-xl bg-rose-700 px-5 py-3 font-semibold text-white hover:bg-rose-800">
              {backedUp ? "Confirm: start another project" : "Confirm: start another project without a backup"}
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="min-h-11 rounded-xl border border-slate-400 bg-white px-5 py-3 font-semibold text-slate-900 hover:bg-slate-50">
              Keep this project
            </button>
          </div>
        </section>
      ) : (
        <ApprovalBar approveLabel="Start another project" onApprove={() => setConfirming(true)} />
      )}
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
