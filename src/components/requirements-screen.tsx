"use client";

import { useState } from "react";
import { ApprovalBar, ManagerPanel, MetricsPanel } from "@/components/shell";
import { useStoreExt } from "@/components/store-ext";
import { WorkspaceIllustration } from "@/components/workspace-illustration";
import { enoughDetail } from "@/lib/input-rules";
import { useProjectStore } from "@/lib/store";
import type { Priority } from "@/lib/types";
import { requirementsReady } from "@/lib/workflow";

const BUTTON = "min-h-11 rounded-xl border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";
const FIELD = "mt-2 w-full rounded-2xl border border-violet-300 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-500 hover:border-violet-400 focus:border-violet-600 focus:ring-4 focus:ring-violet-200/70 focus-visible:outline-violet-600 dark:border-violet-800 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-violet-400 dark:focus:ring-violet-900/60 dark:focus-visible:outline-violet-400";

function AddRequirement({ onDone }: { onDone: () => void }) {
  const { addRequirement } = useStoreExt();
  const [text, setText] = useState("");
  const [priority, setPriority] = useState<Priority>("should");
  const [error, setError] = useState<string | null>(null);
  return (
    <form aria-label="Add requirement" className="mt-5 space-y-4 rounded-2xl border border-violet-200 bg-violet-50/70 p-5 dark:border-violet-900 dark:bg-violet-950/30" onSubmit={(event) => {
      event.preventDefault();
      if (!enoughDetail(text)) return;
      const message = addRequirement?.(text.trim(), priority) ?? null;
      setError(message);
      if (!message) onDone();
    }}>
      <label className="block font-semibold text-slate-950 dark:text-white">New requirement<textarea autoFocus required minLength={12} rows={3} value={text} onChange={(e) => setText(e.target.value)} className={FIELD} /></label>
      <label className="flex flex-wrap items-center gap-3 font-semibold text-slate-950 dark:text-white">Priority
        <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)} className="min-h-11 rounded-xl border border-violet-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-violet-600 focus:ring-4 focus:ring-violet-200/70 dark:border-violet-800 dark:bg-slate-950 dark:text-white">
          <option value="must">Must</option><option value="should">Should</option><option value="could">Could</option>
        </select>
      </label>
      <p className="text-sm text-slate-600 dark:text-slate-300">A new requirement starts pending and reopens the task plan for review.</p>
      {error && <p role="alert" className="text-sm text-rose-800 dark:text-rose-300">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button disabled={!enoughDetail(text)} className="min-h-11 rounded-xl bg-gradient-to-r from-violet-700 to-purple-600 px-4 py-2 font-semibold text-white shadow-sm disabled:opacity-50">Add requirement</button>
        <button type="button" onClick={onDone} className="min-h-11 rounded-xl border border-violet-300 bg-white px-4 py-2 font-semibold text-violet-800 hover:bg-violet-100 dark:border-violet-800 dark:bg-slate-950 dark:text-violet-200">Cancel</button>
      </div>
    </form>
  );
}

export function RequirementsScreen() {
  const store = useProjectStore();
  const { addRequirement, deleteRequirement } = useStoreExt();
  const { requirements, toggleRequirement, approveRequirements, editRequirement, busy, tasks, goTo } = store;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const ready = requirementsReady(store);
  const locked = busy || !!editingId || adding;
  const unapproved = requirements.filter((r) => r.approvalStatus !== "approved");
  const counts = [
    { label: "Approved", count: requirements.filter((r) => r.approvalStatus === "approved").length, style: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200" },
    { label: "Pending", count: requirements.filter((r) => r.approvalStatus === "pending").length, style: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200" },
    { label: "Needs revision", count: requirements.filter((r) => r.approvalStatus === "rejected").length, style: "border-orange-200 bg-orange-50 text-orange-900 dark:border-orange-900 dark:bg-orange-950/30 dark:text-orange-200" },
  ];

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_280px] 2xl:grid-cols-[250px_minmax(0,1fr)_280px]">
      <WorkspaceIllustration src="/projectpilot-requirements-workspace.png" className="sticky top-6 hidden h-[54rem] rounded-[2rem] border border-white/50 shadow-[0_24px_60px_rgba(91,33,182,0.18)] 2xl:block" sizes="250px" />

      <section className="min-w-0 rounded-[2rem] border border-violet-200/80 bg-white/95 p-5 shadow-[0_24px_70px_rgba(91,33,182,0.13)] backdrop-blur-sm dark:border-violet-900 dark:bg-slate-950/95 sm:p-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-4xl">Project Requirements</h1>
        <p className="mt-3 text-base leading-relaxed text-slate-600 dark:text-slate-300">Review the AI-generated requirements and make sure everything matches your project before continuing.</p>

        <section className="mt-6 rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-50 to-purple-50/70 p-4 dark:border-violet-900 dark:from-violet-950/60 dark:to-purple-950/30" aria-labelledby="requirements-summary-title">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="requirements-summary-title" className="font-semibold text-violet-950 dark:text-violet-100">Requirements summary</h2>
            <span className="rounded-full border border-violet-200 bg-white/80 px-2.5 py-1 text-xs font-semibold text-violet-800 dark:border-violet-800 dark:bg-slate-950/70 dark:text-violet-200">{requirements.length} total</span>
          </div>
          <div aria-live="polite" className="mt-4 grid gap-2 sm:grid-cols-3">
            {counts.map(({ label, count, style }) => <div key={label} className={`rounded-xl border px-3 py-2 ${style}`}><span className="text-xs font-semibold">{label}</span><strong className="ml-2 font-mono text-lg">{count}</strong></div>)}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {requirements.length > 1 && unapproved.length > 0 && (
              <button type="button" disabled={locked} onClick={() => unapproved.forEach((r) => toggleRequirement(r.id, "approved"))} className={`${BUTTON} border-violet-300 bg-violet-100 text-violet-900 hover:border-violet-400 hover:bg-violet-200 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-200`}>Approve all ({unapproved.length})</button>
            )}
            {typeof addRequirement === "function" && !adding && (
              <button type="button" disabled={locked} onClick={() => setAdding(true)} className={`${BUTTON} border-violet-300 bg-white text-violet-800 hover:border-violet-400 hover:bg-violet-100 dark:border-violet-800 dark:bg-slate-950 dark:text-violet-200`}><span aria-hidden="true">＋</span> Add requirement</button>
            )}
          </div>
          {adding && <AddRequirement onDone={() => setAdding(false)} />}
        </section>

        <ul className="mt-6 space-y-5">
        {requirements.map((r, index) => {
          const n = index + 1;
          const approved = r.approvalStatus === "approved";
          const rejected = r.approvalStatus === "rejected";
          const help = locked ? `req-help-${r.id}` : undefined;
          return (
            <li key={r.id} className={`space-y-4 rounded-[1.75rem] border bg-white p-5 shadow-[0_14px_38px_rgba(91,33,182,0.08)] dark:bg-slate-950 sm:p-6 ${approved ? "border-emerald-200 dark:border-emerald-900" : rejected ? "border-orange-200 dark:border-orange-900" : "border-violet-200 dark:border-violet-900"}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                  <span className="rounded-lg bg-violet-100 px-2.5 py-1 uppercase tracking-wide text-violet-800 dark:bg-violet-950 dark:text-violet-200">{r.priority}</span>
                  <span className={`rounded-lg px-2.5 py-1 ${approved ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200" : rejected ? "bg-orange-50 text-orange-900 dark:bg-orange-950/40 dark:text-orange-200" : "bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"}`}>{rejected ? "Needs revision" : approved ? "Approved" : "Pending review"}</span>
                </div>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Requirement {n} of {requirements.length}</span>
              </div>
              {editingId === r.id ? (
                <form onSubmit={(event) => { event.preventDefault(); if (enoughDetail(draft)) { editRequirement(r.id, draft); setEditingId(null); } }}>
                  <label className="block font-semibold text-slate-950 dark:text-white">Requirement text<textarea autoFocus required minLength={12} value={draft} onChange={(e) => setDraft(e.target.value)} rows={4} className={FIELD} /></label>
                  {tasks.length > 0 && <p className="my-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">Saving a change reopens the task plan and refreshes its shared-context outputs after approval. Existing tasks and history are preserved.</p>}
                  {!enoughDetail(draft) && <p className="mt-2 text-sm text-amber-900 dark:text-amber-200">Enter at least 12 characters of requirement detail.</p>}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button disabled={!enoughDetail(draft)} className="min-h-11 rounded-xl bg-gradient-to-r from-violet-700 to-purple-600 px-4 py-2 font-semibold text-white disabled:opacity-50">Save requirement</button>
                    <button type="button" onClick={() => setEditingId(null)} className="min-h-11 rounded-xl border border-violet-300 px-4 py-2 font-semibold text-violet-800 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-200 dark:hover:bg-violet-950">Cancel</button>
                  </div>
                </form>
              ) : <>
                <p className="text-lg font-semibold leading-relaxed text-slate-900 dark:text-white">{r.text}</p>
                {r.acceptance && r.acceptance.length > 0 && (
                  <details className="group rounded-2xl border border-violet-100 bg-violet-50/70 px-4 py-3 dark:border-violet-900 dark:bg-violet-950/30">
                    <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-violet-950 dark:text-violet-100 [&::-webkit-details-marker]:hidden">
                      <span>Acceptance criteria <span className="font-normal text-slate-600 dark:text-slate-300">({r.acceptance.length})</span></span>
                      <span aria-hidden="true" className="text-violet-600 transition group-open:rotate-180">▾</span>
                    </summary>
                    <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-700 marker:text-violet-500 dark:text-slate-300">{r.acceptance.map((line, i) => <li key={`${i}-${line}`}>{line}</li>)}</ul>
                  </details>
                )}
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={locked} aria-pressed={approved} aria-label={`Approve requirement ${n}`} aria-describedby={help} onClick={() => toggleRequirement(r.id, "approved")} className={`${BUTTON} ${approved ? "border-emerald-700 bg-emerald-700 text-white" : "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200"}`}>{approved ? "Approved ✓" : "Approve"}</button>
                  <button type="button" disabled={locked} aria-pressed={rejected} aria-label={`Mark requirement ${n} as needs revision`} aria-describedby={help} onClick={() => toggleRequirement(r.id, "rejected")} className={`${BUTTON} ${rejected ? "border-amber-600 bg-amber-600 text-white" : "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"}`}>Needs revision</button>
                  <button type="button" disabled={locked} aria-label={`Edit requirement ${n}`} aria-describedby={help} onClick={() => { setDraft(r.text); setEditingId(r.id); }} className={`${BUTTON} border-violet-300 bg-white text-violet-800 hover:bg-violet-50 dark:border-violet-800 dark:bg-slate-950 dark:text-violet-200 dark:hover:bg-violet-950`}>Edit</button>
                  {typeof deleteRequirement === "function" && requirements.length > 1 && (
                    <button type="button" disabled={locked} aria-label={`Delete requirement ${n}`} aria-describedby={help} onClick={() => { if (window.confirm(`Delete requirement ${n}? Tasks are reviewed again afterwards.`)) deleteRequirement(r.id); }} className={`${BUTTON} border-rose-300 bg-white text-rose-800 hover:bg-rose-50 dark:border-rose-900 dark:bg-slate-950 dark:text-rose-300 dark:hover:bg-rose-950/30`}>Delete</button>
                  )}
                </div>
                {locked && <p id={`req-help-${r.id}`} className="text-sm text-slate-600 dark:text-slate-300">{busy ? "Decisions are paused while the Manager is working." : "Finish the open edit above before changing other requirements."}</p>}
              </>}
            </li>
          );
        })}
        </ul>
        <ApprovalBar variant="purple" approveLabel={tasks.length ? "Continue to Task Plan →" : busy ? "Generating Task Plan…" : "Generate Task Plan →"}
          disabled={busy || !ready || locked} onApprove={approveRequirements}
          secondaryLabel="← Back" secondaryDisabled={busy || locked} onSecondary={() => goTo("questions")}
          hint={locked && !busy ? "Save or cancel your edit before continuing." : !ready ? "Approve or resolve all requirements before generating the task plan." : "All requirements approved. Continue to review the task plan; agents will not run yet."} />
      </section>

      <div className="min-w-0 space-y-6">
        <MetricsPanel variant="purple" />
        <ManagerPanel variant="purple" />
      </div>
    </div>
  );
}
