"use client";

import { useState } from "react";
import { ApprovalBar } from "@/components/shell";
import { useStoreExt } from "@/components/store-ext";
import { enoughDetail } from "@/lib/input-rules";
import { useProjectStore } from "@/lib/store";
import type { Priority } from "@/lib/types";
import { requirementsReady } from "@/lib/workflow";

const BUTTON = "min-h-11 rounded-xl border px-4 py-2 font-semibold disabled:cursor-not-allowed disabled:opacity-50";
const IDLE = "border-slate-300 bg-white text-slate-700";
const ON = "border-teal-700 bg-teal-700 text-white";

function AddRequirement({ onDone }: { onDone: () => void }) {
  const { addRequirement } = useStoreExt();
  const [text, setText] = useState("");
  const [priority, setPriority] = useState<Priority>("should");
  const [error, setError] = useState<string | null>(null);
  return (
    <form aria-label="Add requirement" className="mt-4 space-y-3 rounded-xl border border-teal-200 bg-teal-50 p-4" onSubmit={(event) => {
      event.preventDefault();
      if (!enoughDetail(text)) return;
      const message = addRequirement?.(text.trim(), priority) ?? null;
      setError(message);
      if (!message) onDone();
    }}>
      <label className="block font-medium">New requirement<textarea autoFocus required minLength={12} rows={3} value={text} onChange={(e) => setText(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3" /></label>
      <label className="block font-medium">Priority
        <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)} className="ml-2 min-h-11 rounded-lg border border-slate-300 bg-white p-2">
          <option value="must">Must</option><option value="should">Should</option><option value="could">Could</option>
        </select>
      </label>
      <p className="text-sm text-slate-700">A new requirement starts pending and reopens the task plan for review.</p>
      {error && <p role="alert" className="text-sm text-rose-800">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button disabled={!enoughDetail(text)} className="min-h-11 rounded-xl bg-teal-700 px-4 py-2 font-semibold text-white disabled:opacity-50">Add requirement</button>
        <button type="button" onClick={onDone} className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 py-2">Cancel</button>
      </div>
    </form>
  );
}

export function RequirementsScreen() {
  const store = useProjectStore();
  const { addRequirement, deleteRequirement } = useStoreExt();
  const { requirements, toggleRequirement, approveRequirements, editRequirement, busy, tasks } = store;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const ready = requirementsReady(store);
  const locked = busy || !!editingId || adding;
  const unapproved = requirements.filter((r) => r.approvalStatus !== "approved");
  const counts = [
    ["Approved", requirements.filter((r) => r.approvalStatus === "approved").length],
    ["Pending", requirements.filter((r) => r.approvalStatus === "pending").length],
    ["Needs revision", requirements.filter((r) => r.approvalStatus === "rejected").length],
  ];

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl text-slate-900">Requirements summary</h1>
      <p className="mt-3 text-base leading-relaxed text-slate-600">Review each requirement. Edited requirements always need approval again.</p>
      <div aria-live="polite" className="mt-5 flex flex-wrap items-center gap-3">
        {counts.map(([label, count]) => <span key={label} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 font-medium">{label}: {count}</span>)}
        {requirements.length > 1 && unapproved.length > 0 && (
          <button type="button" disabled={locked} onClick={() => unapproved.forEach((r) => toggleRequirement(r.id, "approved"))} className={`${BUTTON} ${IDLE} hover:bg-slate-50`}>Approve all ({unapproved.length})</button>
        )}
        {typeof addRequirement === "function" && !adding && (
          <button type="button" disabled={locked} onClick={() => setAdding(true)} className={`${BUTTON} ${IDLE} hover:bg-slate-50`}>Add requirement</button>
        )}
      </div>
      {adding && <AddRequirement onDone={() => setAdding(false)} />}
      <ul className="mt-6 space-y-3">
        {requirements.map((r, index) => {
          const n = index + 1;
          const approved = r.approvalStatus === "approved";
          const rejected = r.approvalStatus === "rejected";
          const help = locked ? `req-help-${r.id}` : undefined;
          return (
            <li key={r.id} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap gap-2 text-sm font-semibold">
                <span className="rounded bg-slate-100 px-2 py-1 uppercase">{r.priority}</span>
                <span className={`rounded px-2 py-1 ${approved ? "bg-teal-50 text-teal-800" : "bg-amber-50 text-amber-900"}`}>{rejected ? "Needs revision" : approved ? "Approved" : "Pending review"}</span>
              </div>
              {editingId === r.id ? (
                <form onSubmit={(event) => { event.preventDefault(); if (enoughDetail(draft)) { editRequirement(r.id, draft); setEditingId(null); } }}>
                  <label className="block font-medium">Requirement text<textarea autoFocus required minLength={12} value={draft} onChange={(e) => setDraft(e.target.value)} rows={4} className="mt-2 w-full rounded-xl border border-slate-300 p-3" /></label>
                  {tasks.length > 0 && <p className="my-3 text-sm text-amber-900">Saving a change reopens the task plan and refreshes its shared-context outputs after approval. Existing tasks and history are preserved.</p>}
                  {!enoughDetail(draft) && <p className="mt-2 text-sm text-amber-900">Enter at least 12 characters of requirement detail.</p>}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button disabled={!enoughDetail(draft)} className="min-h-11 rounded-xl bg-teal-700 px-4 py-2 text-white disabled:opacity-50">Save requirement</button>
                    <button type="button" onClick={() => setEditingId(null)} className="min-h-11 rounded-xl border border-slate-300 px-4 py-2">Cancel</button>
                  </div>
                </form>
              ) : <>
                <p className="text-base leading-relaxed text-slate-800">{r.text}</p>
                {r.acceptance && r.acceptance.length > 0 && (
                  <div className="rounded-lg bg-slate-50 px-3 py-2">
                    <p className="text-sm font-semibold text-slate-800">Acceptance criteria</p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-slate-700">{r.acceptance.map((line, i) => <li key={`${i}-${line}`}>{line}</li>)}</ul>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={locked} aria-pressed={approved} aria-label={`Approve requirement ${n}`} aria-describedby={help} onClick={() => toggleRequirement(r.id, "approved")} className={`${BUTTON} ${approved ? ON : IDLE}`}>{approved ? "Approved ✓" : "Approve"}</button>
                  <button type="button" disabled={locked} aria-pressed={rejected} aria-label={`Mark requirement ${n} as needs revision`} aria-describedby={help} onClick={() => toggleRequirement(r.id, "rejected")} className={`${BUTTON} ${rejected ? ON : IDLE}`}>Needs revision</button>
                  <button type="button" disabled={locked} aria-label={`Edit requirement ${n}`} aria-describedby={help} onClick={() => { setDraft(r.text); setEditingId(r.id); }} className={`${BUTTON} border-slate-300 font-medium`}>Edit</button>
                  {typeof deleteRequirement === "function" && requirements.length > 1 && (
                    <button type="button" disabled={locked} aria-label={`Delete requirement ${n}`} aria-describedby={help} onClick={() => { if (window.confirm(`Delete requirement ${n}? Tasks are reviewed again afterwards.`)) deleteRequirement(r.id); }} className={`${BUTTON} border-rose-300 font-medium text-rose-800`}>Delete</button>
                  )}
                </div>
                {locked && <p id={`req-help-${r.id}`} className="text-sm text-slate-600">{busy ? "Decisions are paused while the Manager is working." : "Finish the open edit above before changing other requirements."}</p>}
              </>}
            </li>
          );
        })}
      </ul>
      <ApprovalBar approveLabel={tasks.length ? "Continue to task plan" : "Approve requirements → build tasks"}
        disabled={busy || !ready || locked} onApprove={approveRequirements}
        hint={locked && !busy ? "Save or cancel your edit before continuing." : !ready ? "Approve or resolve all requirements before generating the task plan." : "All requirements approved. Continue to review the task plan; agents will not run yet."} />
    </div>
  );
}
