"use client";

import { useState } from "react";
import { DeliverableView } from "@/components/deliverable-view";
import { ExportPanel } from "@/components/export-panel";
import { MetricsPanel, ManagerPanel } from "@/components/shell";
import { StudioHandoffButton } from "@/components/studio-handoff";
import { WorkspaceIllustration } from "@/components/workspace-illustration";
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
  const { project, requirements, outputs, metrics, reset, tasks } = store;
  if (!outputsReady(store) || project.status !== "complete") return <p role="alert">Complete all approval checkpoints before viewing or exporting the final plan.</p>;

  const opts = { mode: store.managerMode };
  const approvedReqs = requirements.filter((requirement) => requirement.approvalStatus === "approved");
  const approvedOutputs = outputs.filter((output) => output.approved === "approved");
  const completedTasks = tasks.filter((task) => task.state === "completed");
  const title = shortTitle(project);
  const provenance = provenanceLines(store, opts);

  function downloadBackup() {
    const snapshot = typeof store.exportState === "function" ? store.exportState() : store;
    downloadFile(`${planSlug(snapshot)}-plan.json`, planJson(snapshot, opts), "application/json;charset=utf-8");
    downloadPlan(snapshot, opts);
    setBackedUp(true);
  }

  return (
    <div className="grid min-w-0 gap-5 xl:grid-cols-[180px_minmax(0,1fr)_250px] 2xl:grid-cols-[210px_minmax(0,1fr)_280px]">
      <WorkspaceIllustration src="/projectpilot-final-workspace.png" className="sticky top-6 hidden h-[50rem] rounded-[2rem] border border-white/50 shadow-[0_24px_60px_rgba(91,33,182,0.18)] xl:block" priority sizes="210px" />

      <section className="min-w-0 rounded-[2rem] border border-violet-100/90 bg-white/90 p-4 shadow-[0_24px_70px_rgba(91,33,182,0.14)] dark:border-violet-900 dark:bg-slate-950/90 sm:p-7" aria-labelledby="final-screen-title">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-bold uppercase tracking-[.2em] text-violet-600 dark:text-violet-300">Final · Step 8</p>
            <h1 id="final-screen-title" className="mt-2 text-3xl font-bold tracking-tight text-violet-950 dark:text-violet-100 sm:text-4xl">Your Project Is Ready</h1>
            <p className="mt-3 max-w-3xl text-base leading-relaxed text-slate-600 dark:text-slate-300">Your AI team has completed the planning workflow. Review your approved deliverables and download your project files.</p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"><span aria-hidden="true">✓</span> Finalized</span>
        </div>

        <div className="mt-6 rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-50 to-purple-50/60 p-5 dark:border-violet-800 dark:from-violet-950/45 dark:to-purple-950/25">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div><h2 className="text-xl font-bold text-violet-950 dark:text-violet-100">{title}</h2><p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">A readable copy of your approved plan, requirements, tasks, outputs, and provenance.</p></div>
            <button type="button" className="min-h-12 rounded-xl bg-gradient-to-r from-violet-700 to-purple-600 px-5 py-3 font-bold text-white shadow-[0_10px_24px_rgba(109,40,217,0.24)] transition hover:from-violet-800 hover:to-purple-700" onClick={() => downloadPlan(store, opts)}>Download Markdown ↓</button>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-sm leading-relaxed text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100"><strong>Planning package only.</strong> ProjectPilot does not automatically write to a repository or deploy a generated application.</div>

        <section className="mt-6" aria-labelledby="completion-overview-title">
          <h2 id="completion-overview-title" className="text-xl font-bold text-violet-950 dark:text-violet-100">Completion overview</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <SummaryCard label="Requirements approved" value={`${approvedReqs.length}/${requirements.length}`} />
            <SummaryCard label="Tasks completed" value={`${completedTasks.length}/${tasks.length}`} />
            <SummaryCard label="Deliverables approved" value={`${approvedOutputs.length}/${outputs.length}`} />
            <SummaryCard label="Revisions" value={String(metrics.numberOfRevisions)} />
          </div>
        </section>

        <details open className="mt-6 rounded-2xl border border-violet-100 bg-white dark:border-violet-900 dark:bg-slate-950">
          <summary className="min-h-12 cursor-pointer px-5 py-4 text-lg font-bold text-violet-950 marker:text-violet-500 dark:text-violet-100">Project overview</summary>
          <div className="border-t border-violet-100 px-5 py-4 dark:border-violet-900">
            <p className="whitespace-pre-wrap text-base leading-relaxed text-slate-700 dark:text-slate-200">{project.description}</p>
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Users: {project.targetUser} · Status: {project.status}</p>
            <ul className="mt-3 space-y-1 text-sm text-slate-600 dark:text-slate-300">{provenance.map((line) => <li key={line}>{line}</li>)}</ul>
            <p className="mt-3 rounded-xl bg-violet-50 px-4 py-3 text-sm leading-relaxed text-violet-950 dark:bg-violet-950/40 dark:text-violet-100">{disclosureStatement(store, opts)}</p>
          </div>
        </details>

        <ExportPanel className="mt-6" variant="purple" />

        <section className="mt-6 rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-purple-50/60 p-5 dark:border-violet-900 dark:from-violet-950/35 dark:to-purple-950/20" aria-labelledby="studio-handoff-title">
          <h2 id="studio-handoff-title" className="text-xl font-bold text-violet-950 dark:text-violet-100">Continue in Website Studio</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">Move this approved planning context into the separate Website Studio workspace. It builds and reviews a static website; it does not implement a backend, database, or deployment.</p>
          <StudioHandoffButton variant="purple" />
        </section>

        <details open className="mt-6 rounded-2xl border border-violet-100 bg-violet-50/35 dark:border-violet-900 dark:bg-violet-950/20">
          <summary className="min-h-12 cursor-pointer px-5 py-4 text-lg font-bold text-violet-950 marker:text-violet-500 dark:text-violet-100">Approved requirements <CountBadge value={approvedReqs.length} /></summary>
          <ul className="space-y-3 border-t border-violet-100 px-5 py-4 dark:border-violet-900">{approvedReqs.map((requirement) => {
            const criteria = acceptanceOf(requirement);
            return <li key={requirement.id} className="rounded-xl border border-violet-100 bg-white p-4 text-base leading-relaxed text-slate-800 dark:border-violet-900 dark:bg-slate-950 dark:text-slate-100"><p className="font-semibold">{requirement.text}</p>{criteria.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-300">{criteria.map((criterion, index) => <li key={index}>Acceptance: {criterion}</li>)}</ul>}</li>;
          })}</ul>
        </details>

        <details open className="mt-4 rounded-2xl border border-violet-100 bg-violet-50/35 dark:border-violet-900 dark:bg-violet-950/20">
          <summary className="min-h-12 cursor-pointer px-5 py-4 text-lg font-bold text-violet-950 marker:text-violet-500 dark:text-violet-100">Ordered task plan <CountBadge value={tasks.length} /></summary>
          <ol className="space-y-3 border-t border-violet-100 px-5 py-4 dark:border-violet-900">{orderedTasks(store).map((task) => <li key={task.id} className="rounded-xl border border-violet-100 bg-white p-4 text-sm leading-relaxed dark:border-violet-900 dark:bg-slate-950">
            <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-bold text-violet-950 dark:text-violet-100">{taskTitle(task)}</p><span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-800 dark:bg-violet-900 dark:text-violet-200">{AGENT_LABELS[task.ownerAgent]}</span></div>
            <p className="mt-2 whitespace-pre-wrap text-slate-700 dark:text-slate-200">{task.description}</p>
            <p className="mt-2 text-slate-600 dark:text-slate-300"><strong>Depends on:</strong> {dependencyLabels(store, task).join("; ") || "No prerequisites"}</p>
            <p className="mt-1 text-slate-600 dark:text-slate-300"><strong>Expected output:</strong> {task.expectedOutput}</p>
            {task.constraints && <p className="mt-1 text-slate-600 dark:text-slate-300"><strong>Constraints:</strong> {task.constraints}</p>}
          </li>)}</ol>
        </details>

        <details open className="mt-4 rounded-2xl border border-violet-100 bg-violet-50/35 dark:border-violet-900 dark:bg-violet-950/20">
          <summary className="min-h-12 cursor-pointer px-5 py-4 text-lg font-bold text-violet-950 marker:text-violet-500 dark:text-violet-100">Approved agent outputs <CountBadge value={approvedOutputs.length} /></summary>
          <ul className="space-y-4 border-t border-violet-100 px-5 py-4 dark:border-violet-900">{orderedTasks(store).flatMap((task) => {
            const output = outputs.find((item) => item.taskId === task.id && item.approved === "approved");
            if (!output) return [];
            const findings = reviewFindings(store, output);
            const model = outputModel(store, output);
            const assumptions = usefulAssumptions(output);
            return [<li key={output.id}><DeliverableView title={taskTitle(task)} text={output.summary} humanEdited={isHumanEdited(store, output)} badge="Approved"><div className="mt-3 space-y-1 border-t border-violet-100 pt-3 text-sm text-slate-700 dark:border-violet-900 dark:text-slate-200">
              {model && <p>Produced by: {modelLabel(model)}</p>}
              {assumptions.length > 0 && <p>Assumptions: {assumptions.join("; ")}</p>}
              <p>Next steps: {output.nextSteps.join("; ") || "None"}</p>
              <p>Blockers: {output.blockers.join("; ") || "None"} · Confidence: {Math.round(output.confidence * 100)}%</p>
              {findings && <p className="text-amber-900 dark:text-amber-200">Review findings: {findings.join("; ") || "No findings"}</p>}
            </div></DeliverableView></li>];
          })}</ul>
        </details>

        <p className="mt-5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">Reviews logged: {store.reviews.length}. Progress remains saved in this browser; download Markdown or Backup (plan.json) to keep a separate copy.</p>

        {confirming ? <section role="alertdialog" aria-labelledby="start-over-title" className="mt-8 rounded-2xl border border-amber-300 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950/30">
          <h2 id="start-over-title" className="text-lg font-bold text-amber-950 dark:text-amber-100">Start another project?</h2>
          <p className="mt-2 text-base leading-relaxed text-amber-950 dark:text-amber-100">This clears the current plan from this browser. {backedUp ? "Your backup was downloaded." : "Download a backup first; it is the only way to get this plan back."}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" onClick={downloadBackup} className="min-h-11 rounded-xl border border-violet-300 bg-white px-5 py-3 font-semibold text-violet-800 hover:bg-violet-50 dark:border-violet-800 dark:bg-slate-950 dark:text-violet-200">{backedUp ? "Download backup again" : "Download backup (plan.json + Markdown)"}</button>
            <button type="button" onClick={reset} className="min-h-11 rounded-xl bg-rose-700 px-5 py-3 font-semibold text-white hover:bg-rose-800">{backedUp ? "Confirm: start another project" : "Confirm: start another project without a backup"}</button>
            <button type="button" onClick={() => setConfirming(false)} className="min-h-11 rounded-xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">Keep this project</button>
          </div>
        </section> : <div className="mt-8 border-t border-violet-100 pt-6 dark:border-violet-900"><button type="button" onClick={() => setConfirming(true)} className="min-h-11 rounded-xl border border-violet-300 bg-white px-5 py-3 font-semibold text-violet-800 transition hover:border-violet-500 hover:bg-violet-50 dark:border-violet-800 dark:bg-slate-950 dark:text-violet-200">Start another project</button><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">You will be asked to confirm before browser-stored project data is replaced.</p></div>}
      </section>

      <aside className="space-y-5 xl:sticky xl:top-6 xl:max-h-[calc(100vh-3rem)] xl:overflow-y-auto xl:pr-1" aria-label="Final project information">
        <MetricsPanel variant="purple" />
        <ManagerPanel variant="purple" />
      </aside>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-violet-100 bg-violet-50/65 p-4 dark:border-violet-900 dark:bg-violet-950/30"><p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">{label}</p><p className="mt-2 font-mono text-2xl font-bold text-violet-950 dark:text-violet-100">{value}</p></div>;
}

function CountBadge({ value }: { value: number }) {
  return <span className="ml-2 rounded-full bg-violet-100 px-2.5 py-1 text-xs text-violet-800 dark:bg-violet-900 dark:text-violet-200">{value}</span>;
}
